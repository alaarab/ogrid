import { useCallback, useEffect, useRef, useState } from 'react';
import { formatSelectionAsTsv, parseTsvClipboard, applyPastedValues, applyCutClear } from '../utils';
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
  /** When true, enables formula-aware copy/paste. */
  formulas?: boolean;
  /** Flat (unfiltered) column list used to map visible col to flat col index. */
  flatColumns?: IColumnDef<T>[];
  /** Returns the formula string for a flat column + row, or undefined if none. */
  getFormula?: (col: number, row: number) => string | undefined;
  /** Returns true if a flat column + row has a formula. */
  hasFormula?: (col: number, row: number) => boolean;
  /** Sets or clears a formula for a flat column + row. */
  setFormula?: (col: number, row: number, formula: string | null) => void;
}

export interface UseClipboardResult {
  handleCopy: () => void;
  handleCut: () => void;
  handlePaste: () => Promise<void>;
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
  const formulasRef = useLatestRef(params.formulas);
  const flatColumnsRef = useLatestRef(params.flatColumns);
  const getFormulaRef = useLatestRef(params.getFormula);
  const hasFormulaRef = useLatestRef(params.hasFormula);
  const setFormulaRef = useLatestRef(params.setFormula);

  const cutRangeRef = useRef<ISelectionRange | null>(null);
  const [cutRange, setCutRange] = useState<ISelectionRange | null>(null);
  const [copyRange, setCopyRange] = useState<ISelectionRange | null>(null);
  /** In-page clipboard fallback when system clipboard is unavailable. */
  const internalClipboardRef = useRef<string | null>(null);
  /** Guard against async clipboard reads completing after unmount. */
  const isMountedRef = useRef(true);
  useEffect(() => () => { isMountedRef.current = false; }, []);

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
    const formulaOptions = formulasRef.current && flatColumnsRef.current
      ? {
          colOffset,
          flatColumns: flatColumnsRef.current,
          getFormula: getFormulaRef.current,
          hasFormula: hasFormulaRef.current,
        }
      : undefined;
    const tsv = formatSelectionAsTsv(itemsRef.current, visibleColsRef.current, norm, formulaOptions);
    internalClipboardRef.current = tsv;
    setCopyRange(norm);
    void navigator.clipboard.writeText(tsv).catch(() => {});
  }, [getEffectiveRange, itemsRef, visibleColsRef, formulasRef, flatColumnsRef, getFormulaRef, hasFormulaRef, colOffset]);

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
    // Bail out if component unmounted during async clipboard read
    if (!isMountedRef.current) return;
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
    const formulaOptions = formulasRef.current && flatColumnsRef.current
      ? {
          colOffset,
          flatColumns: flatColumnsRef.current,
          setFormula: setFormulaRef.current,
        }
      : undefined;
    beginBatch?.();
    const pasteEvents = applyPastedValues(parsedRows, anchorRow, anchorCol, items, visibleCols, formulaOptions);
    for (const evt of pasteEvents) onCellValueChanged(evt);
    if (cutRangeRef.current) {
      const cutEvents = applyCutClear(cutRangeRef.current, items, visibleCols);
      for (const evt of cutEvents) onCellValueChanged(evt);
      cutRangeRef.current = null;
      setCutRange(null);
    }
    endBatch?.();
    setCopyRange(null);
  }, [getEffectiveRange, itemsRef, visibleColsRef, editableRef, onCellValueChangedRef, beginBatch, endBatch, formulasRef, flatColumnsRef, setFormulaRef, colOffset]);

  const clearClipboardRanges = useCallback(() => {
    setCopyRange(null);
    setCutRange(null);
    cutRangeRef.current = null;
  }, []);

  return { handleCopy, handleCut, handlePaste, cutRange, copyRange, clearClipboardRanges };
}
