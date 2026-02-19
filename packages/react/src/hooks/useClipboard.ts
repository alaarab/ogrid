import { useCallback, useRef, useState } from 'react';
import { getCellValue, parseValue, formatSelectionAsTsv, parseTsvClipboard } from '../utils';
import { normalizeSelectionRange } from '../types';
import type { ISelectionRange, IActiveCell, ICellValueChangedEvent, IColumnDef } from '../types';
import { useLatestRef } from './useLatestRef';

export interface UseClipboardParams<T> {
  items: T[];
  visibleCols: IColumnDef<T>[];
  colOffset: number;
  selectionRange: ISelectionRange | null;
  activeCell: IActiveCell | null;
  editable?: boolean;
  onCellValueChanged: ((event: ICellValueChangedEvent<T>) => void) | undefined;
  beginBatch?: () => void;
  endBatch?: () => void;
}

export interface UseClipboardResult {
  handleCopy: () => void;
  handleCut: () => void;
  handlePaste: () => Promise<void>;
  cutRangeRef: React.MutableRefObject<ISelectionRange | null>;
  /** Current cut range for UI (marching ants). Null when no cut or after paste. */
  cutRange: ISelectionRange | null;
  /** Current copy range for UI (marching ants). Null when no copy or after paste/cut. */
  copyRange: ISelectionRange | null;
  /** Clear both copy and cut ranges (dismisses marching ants). Called on Escape. */
  clearClipboardRanges: () => void;
}

/**
 * Manages copy, cut, and paste operations for cell ranges with TSV clipboard format.
 * @param params - Items, columns, selection, editability, and value change callback.
 * @returns Copy/cut/paste handlers, cut/copy ranges, and range clear function.
 */
export function useClipboard<T>(params: UseClipboardParams<T>): UseClipboardResult {
  const {
    colOffset,
    beginBatch,
    endBatch,
  } = params;

  // Volatile values accessed via refs — keeps callbacks stable
  const itemsRef = useLatestRef(params.items);
  const visibleColsRef = useLatestRef(params.visibleCols);
  const selectionRangeRef = useLatestRef(params.selectionRange);
  const activeCellRef = useLatestRef(params.activeCell);
  const editableRef = useLatestRef(params.editable);
  const onCellValueChangedRef = useLatestRef(params.onCellValueChanged);

  const cutRangeRef = useRef<ISelectionRange | null>(null);
  const [cutRange, setCutRange] = useState<ISelectionRange | null>(null);
  const [copyRange, setCopyRange] = useState<ISelectionRange | null>(null);
  /** In-page clipboard fallback when system clipboard is unavailable. */
  const internalClipboardRef = useRef<string | null>(null);

  /** Resolve current effective range from selection or active cell. */
  const getEffectiveRange = useCallback((): ISelectionRange | null => {
    const sel = selectionRangeRef.current;
    const ac = activeCellRef.current;
    return sel ?? (ac != null
      ? { startRow: ac.rowIndex, startCol: ac.columnIndex - colOffset, endRow: ac.rowIndex, endCol: ac.columnIndex - colOffset }
      : null);
  }, [colOffset, selectionRangeRef, activeCellRef]);

  const handleCopy = useCallback(() => {
    const range = getEffectiveRange();
    if (range == null) return;
    const norm = normalizeSelectionRange(range);
    const tsv = formatSelectionAsTsv(itemsRef.current, visibleColsRef.current, norm);
    internalClipboardRef.current = tsv;
    setCopyRange(norm);
    void navigator.clipboard.writeText(tsv).catch(() => {});
  }, [getEffectiveRange, itemsRef, visibleColsRef]);

  const handleCut = useCallback(() => {
    if (editableRef.current === false) return;
    const range = getEffectiveRange();
    if (range == null || onCellValueChangedRef.current == null) return;
    const norm = normalizeSelectionRange(range);
    cutRangeRef.current = norm;
    setCutRange(norm);
    setCopyRange(null);
    handleCopy();
    // handleCopy sets copyRange — override it back since this is a cut
    setCopyRange(null);
  }, [getEffectiveRange, handleCopy, editableRef, onCellValueChangedRef]);

  const handlePaste = useCallback(async () => {
    if (editableRef.current === false) return;
    const onCellValueChanged = onCellValueChangedRef.current;
    if (onCellValueChanged == null) return;
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      text = '';
    }
    if (!text.trim() && internalClipboardRef.current != null) {
      text = internalClipboardRef.current;
    }
    if (!text.trim()) return;
    const norm = getEffectiveRange();
    const anchorRow = norm ? norm.startRow : 0;
    const anchorCol = norm ? norm.startCol : 0;
    const items = itemsRef.current;
    const visibleCols = visibleColsRef.current;
    const parsedRows = parseTsvClipboard(text);
    beginBatch?.();
    for (let r = 0; r < parsedRows.length; r++) {
      const cells = parsedRows[r];
      for (let c = 0; c < cells.length; c++) {
        const targetRow = anchorRow + r;
        const targetCol = anchorCol + c;
        if (targetRow >= items.length || targetCol >= visibleCols.length) continue;
        const item = items[targetRow];
        const col = visibleCols[targetCol];
        const colEditable =
          col.editable === true ||
          (typeof col.editable === 'function' && col.editable(item));
        if (!colEditable) continue;
        const rawValue = cells[c] ?? '';
        const oldValue = getCellValue(item, col);
        const result = parseValue(rawValue, oldValue, item, col);
        if (!result.valid) continue;
        onCellValueChanged({
          item,
          columnId: col.columnId,
          oldValue,
          newValue: result.value,
          rowIndex: targetRow,
        });
      }
    }
    if (cutRangeRef.current) {
      const cut = cutRangeRef.current;
      for (let r = cut.startRow; r <= cut.endRow; r++) {
        for (let c = cut.startCol; c <= cut.endCol; c++) {
          if (r >= items.length || c >= visibleCols.length) continue;
          const item = items[r];
          const col = visibleCols[c];
          const colEditable =
            col.editable === true ||
            (typeof col.editable === 'function' && col.editable(item));
          if (!colEditable) continue;
          const oldValue = getCellValue(item, col);
          const result = parseValue('', oldValue, item, col);
          if (!result.valid) continue;
          onCellValueChanged({
            item,
            columnId: col.columnId,
            oldValue,
            newValue: result.value,
            rowIndex: r,
          });
        }
      }
      cutRangeRef.current = null;
      setCutRange(null);
    }
    endBatch?.();
    setCopyRange(null);
  }, [getEffectiveRange, itemsRef, visibleColsRef, editableRef, onCellValueChangedRef, beginBatch, endBatch]);

  const clearClipboardRanges = useCallback(() => {
    setCopyRange(null);
    setCutRange(null);
    cutRangeRef.current = null;
  }, []);

  return { handleCopy, handleCut, handlePaste, cutRangeRef, cutRange, copyRange, clearClipboardRanges };
}
