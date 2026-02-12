import { ref, shallowRef, type Ref, type ShallowRef } from 'vue';
import { getCellValue, parseValue, normalizeSelectionRange } from '@alaarab/ogrid-core';
import type { ISelectionRange, IActiveCell, ICellValueChangedEvent, IColumnDef } from '../types';

export interface UseClipboardParams<T> {
  items: Ref<T[]>;
  visibleCols: Ref<IColumnDef<T>[]>;
  colOffset: number;
  selectionRange: Ref<ISelectionRange | null> | ShallowRef<ISelectionRange | null>;
  activeCell: Ref<IActiveCell | null> | ShallowRef<IActiveCell | null>;
  editable: Ref<boolean | undefined>;
  onCellValueChanged: Ref<((event: ICellValueChangedEvent<T>) => void) | undefined>;
  beginBatch?: () => void;
  endBatch?: () => void;
}

export interface UseClipboardResult {
  handleCopy: () => void;
  handleCut: () => void;
  handlePaste: () => Promise<void>;
  cutRange: ShallowRef<ISelectionRange | null>;
  copyRange: ShallowRef<ISelectionRange | null>;
  clearClipboardRanges: () => void;
  cutRangeRef: Ref<ISelectionRange | null>;
}

/**
 * Manages copy, cut, and paste operations for cell ranges with TSV clipboard format.
 */
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

  const cutRangeRef = ref<ISelectionRange | null>(null);
  const cutRange = shallowRef<ISelectionRange | null>(null);
  const copyRange = shallowRef<ISelectionRange | null>(null);
  const internalClipboardRef = ref<string | null>(null);

  const getEffectiveRange = (): ISelectionRange | null => {
    const sel = selectionRange.value;
    const ac = activeCell.value;
    return sel ?? (ac != null
      ? { startRow: ac.rowIndex, startCol: ac.columnIndex - colOffset, endRow: ac.rowIndex, endCol: ac.columnIndex - colOffset }
      : null);
  };

  const handleCopy = () => {
    const range = getEffectiveRange();
    if (range == null) return;
    const norm = normalizeSelectionRange(range);
    const currentItems = items.value;
    const currentCols = visibleCols.value;
    const rows: string[] = [];
    for (let r = norm.startRow; r <= norm.endRow; r++) {
      const cells: string[] = [];
      for (let c = norm.startCol; c <= norm.endCol; c++) {
        if (r >= currentItems.length || c >= currentCols.length) break;
        const item = currentItems[r];
        const col = currentCols[c];
        const raw = getCellValue(item, col);
        const val = col.valueFormatter ? col.valueFormatter(raw, item) : raw;
        cells.push(
          val != null && val !== '' ? String(val).replace(/\t/g, ' ').replace(/\n/g, ' ') : ''
        );
      }
      rows.push(cells.join('\t'));
    }
    const tsv = rows.join('\r\n');
    internalClipboardRef.value = tsv;
    copyRange.value = norm;
    void navigator.clipboard.writeText(tsv).catch(() => {});
  };

  const handleCut = () => {
    if (editable.value === false) return;
    const range = getEffectiveRange();
    if (range == null || onCellValueChanged.value == null) return;
    const norm = normalizeSelectionRange(range);
    cutRangeRef.value = norm;
    cutRange.value = norm;
    copyRange.value = null;
    handleCopy();
    copyRange.value = null;
  };

  const handlePaste = async () => {
    if (editable.value === false) return;
    const callback = onCellValueChanged.value;
    if (callback == null) return;
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      text = '';
    }
    if (!text.trim() && internalClipboardRef.value != null) {
      text = internalClipboardRef.value;
    }
    if (!text.trim()) return;
    const norm = getEffectiveRange();
    const anchorRow = norm ? norm.startRow : 0;
    const anchorCol = norm ? norm.startCol : 0;
    const currentItems = items.value;
    const currentCols = visibleCols.value;
    const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
    beginBatch?.();
    for (let r = 0; r < lines.length; r++) {
      const cells = lines[r].split('\t');
      for (let c = 0; c < cells.length; c++) {
        const targetRow = anchorRow + r;
        const targetCol = anchorCol + c;
        if (targetRow >= currentItems.length || targetCol >= currentCols.length) continue;
        const item = currentItems[targetRow];
        const col = currentCols[targetCol];
        const colEditable =
          col.editable === true ||
          (typeof col.editable === 'function' && col.editable(item));
        if (!colEditable) continue;
        const rawValue = cells[c] ?? '';
        const oldValue = getCellValue(item, col);
        const result = parseValue(rawValue, oldValue, item, col);
        if (!result.valid) continue;
        callback({
          item,
          columnId: col.columnId,
          oldValue,
          newValue: result.value,
          rowIndex: targetRow,
        });
      }
    }
    if (cutRangeRef.value) {
      const cut = cutRangeRef.value;
      for (let r = cut.startRow; r <= cut.endRow; r++) {
        for (let c = cut.startCol; c <= cut.endCol; c++) {
          if (r >= currentItems.length || c >= currentCols.length) continue;
          const item = currentItems[r];
          const col = currentCols[c];
          const colEditable =
            col.editable === true ||
            (typeof col.editable === 'function' && col.editable(item));
          if (!colEditable) continue;
          const oldValue = getCellValue(item, col);
          const result = parseValue('', oldValue, item, col);
          if (!result.valid) continue;
          callback({
            item,
            columnId: col.columnId,
            oldValue,
            newValue: result.value,
            rowIndex: r,
          });
        }
      }
      cutRangeRef.value = null;
      cutRange.value = null;
    }
    endBatch?.();
    copyRange.value = null;
  };

  const clearClipboardRanges = () => {
    copyRange.value = null;
    cutRange.value = null;
    cutRangeRef.value = null;
  };

  return { handleCopy, handleCut, handlePaste, cutRange, copyRange, clearClipboardRanges, cutRangeRef };
}
