import { ref, shallowRef, isRef, type Ref, type ShallowRef } from 'vue';
import { normalizeSelectionRange, formatSelectionAsTsv, parseTsvClipboard, applyPastedValues, applyCutClear } from '@alaarab/ogrid-core';
import type { ISelectionRange, IActiveCell, ICellValueChangedEvent, IColumnDef } from '../types';

export interface UseClipboardParams<T> {
  items: Ref<T[]>;
  visibleCols: Ref<IColumnDef<T>[]>;
  colOffset: Ref<number> | number;
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
}

/**
 * Manages copy, cut, and paste operations for cell ranges with TSV clipboard format.
 */
export function useClipboard<T>(params: UseClipboardParams<T>): UseClipboardResult {
  const {
    items,
    visibleCols,
    selectionRange,
    activeCell,
    editable,
    onCellValueChanged,
    beginBatch,
    endBatch,
  } = params;
  const getColOffset = () => isRef(params.colOffset) ? params.colOffset.value : params.colOffset;

  const cutRange = shallowRef<ISelectionRange | null>(null);
  const copyRange = shallowRef<ISelectionRange | null>(null);
  const internalClipboardRef = ref<string | null>(null);

  const getEffectiveRange = (): ISelectionRange | null => {
    const sel = selectionRange.value;
    const ac = activeCell.value;
    const colOffset = getColOffset();
    return sel ?? (ac != null
      ? { startRow: ac.rowIndex, startCol: ac.columnIndex - colOffset, endRow: ac.rowIndex, endCol: ac.columnIndex - colOffset }
      : null);
  };

  const handleCopy = () => {
    const range = getEffectiveRange();
    if (range == null) return;
    const norm = normalizeSelectionRange(range);
    const tsv = formatSelectionAsTsv(items.value, visibleCols.value, norm);
    internalClipboardRef.value = tsv;
    copyRange.value = norm;
    void navigator.clipboard.writeText(tsv).catch((err) => {
      if (typeof console !== 'undefined') console.warn('[OGrid] Clipboard write failed:', err);
    });
  };

  const handleCut = () => {
    if (editable.value === false) return;
    const range = getEffectiveRange();
    if (range == null || onCellValueChanged.value == null) return;
    const norm = normalizeSelectionRange(range);
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
    const parsedRows = parseTsvClipboard(text);
    beginBatch?.();
    const pasteEvents = applyPastedValues(parsedRows, anchorRow, anchorCol, currentItems, currentCols);
    for (const evt of pasteEvents) callback(evt);
    if (cutRange.value) {
      const cutEvents = applyCutClear(cutRange.value, currentItems, currentCols);
      for (const evt of cutEvents) callback(evt);
      cutRange.value = null;
    }
    endBatch?.();
    copyRange.value = null;
  };

  const clearClipboardRanges = () => {
    copyRange.value = null;
    cutRange.value = null;
  };

  return { handleCopy, handleCut, handlePaste, cutRange, copyRange, clearClipboardRanges };
}
