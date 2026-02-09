import { useCallback, useRef, useState } from 'react';
import { getCellValue } from '../utils';
import { parseValue } from '../utils/valueParsers';
import { normalizeSelectionRange } from '../types';
import type { ISelectionRange, IActiveCell, ICellValueChangedEvent, IColumnDef } from '../types';

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

export function useClipboard<T>(params: UseClipboardParams<T>): UseClipboardResult {
  const {
    items,
    visibleCols,
    colOffset,
    selectionRange,
    activeCell,
    editable,
    onCellValueChanged,
    beginBatch,
    endBatch,
  } = params;

  const cutRangeRef = useRef<ISelectionRange | null>(null);
  const [cutRange, setCutRange] = useState<ISelectionRange | null>(null);
  const [copyRange, setCopyRange] = useState<ISelectionRange | null>(null);
  /** In-page clipboard fallback when system clipboard is unavailable. */
  const internalClipboardRef = useRef<string | null>(null);

  const handleCopy = useCallback(() => {
    const range =
      selectionRange ??
      (activeCell != null
        ? {
            startRow: activeCell.rowIndex,
            startCol: activeCell.columnIndex - colOffset,
            endRow: activeCell.rowIndex,
            endCol: activeCell.columnIndex - colOffset,
          }
        : null);
    if (range == null) return;
    const norm = normalizeSelectionRange(range);
    const rows: string[] = [];
    for (let r = norm.startRow; r <= norm.endRow; r++) {
      const cells: string[] = [];
      for (let c = norm.startCol; c <= norm.endCol; c++) {
        if (r >= items.length || c >= visibleCols.length) break;
        const item = items[r];
        const col = visibleCols[c];
        const raw = getCellValue(item, col);
        const val = col.valueFormatter ? col.valueFormatter(raw, item) : raw;
        cells.push(
          val != null && val !== '' ? String(val).replace(/\t/g, ' ').replace(/\n/g, ' ') : ''
        );
      }
      rows.push(cells.join('\t'));
    }
    const tsv = rows.join('\r\n');
    internalClipboardRef.current = tsv;
    setCopyRange(norm);
    void navigator.clipboard.writeText(tsv).catch(() => {});
  }, [selectionRange, activeCell, colOffset, items, visibleCols]);

  const handleCut = useCallback(() => {
    if (editable === false) return;
    const range =
      selectionRange ??
      (activeCell != null
        ? {
            startRow: activeCell.rowIndex,
            startCol: activeCell.columnIndex - colOffset,
            endRow: activeCell.rowIndex,
            endCol: activeCell.columnIndex - colOffset,
          }
        : null);
    if (range == null || onCellValueChanged == null) return;
    const norm = normalizeSelectionRange(range);
    cutRangeRef.current = norm;
    setCutRange(norm);
    setCopyRange(null);
    handleCopy();
    // handleCopy sets copyRange — override it back since this is a cut
    setCopyRange(null);
  }, [selectionRange, activeCell, colOffset, handleCopy, editable, onCellValueChanged]);

  const handlePaste = useCallback(async () => {
    if (editable === false) return;
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
    const norm =
      selectionRange ??
      (activeCell != null
        ? {
            startRow: activeCell.rowIndex,
            startCol: activeCell.columnIndex - colOffset,
            endRow: activeCell.rowIndex,
            endCol: activeCell.columnIndex - colOffset,
          }
        : null);
    const anchorRow = norm ? norm.startRow : 0;
    const anchorCol = norm ? norm.startCol : 0;
    const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
    beginBatch?.();
    for (let r = 0; r < lines.length; r++) {
      const cells = lines[r].split('\t');
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
          field: col.columnId,
          oldValue,
          newValue: result.value,
          rowIndex: targetRow,
        } as ICellValueChangedEvent<T>);
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
            field: col.columnId,
            oldValue,
            newValue: result.value,
            rowIndex: r,
          } as ICellValueChangedEvent<T>);
        }
      }
      cutRangeRef.current = null;
      setCutRange(null);
    }
    endBatch?.();
    setCopyRange(null);
  }, [selectionRange, activeCell, colOffset, items, visibleCols, editable, onCellValueChanged, beginBatch, endBatch]);

  const clearClipboardRanges = useCallback(() => {
    setCopyRange(null);
    setCutRange(null);
    cutRangeRef.current = null;
  }, []);

  return { handleCopy, handleCut, handlePaste, cutRangeRef, cutRange, copyRange, clearClipboardRanges };
}
