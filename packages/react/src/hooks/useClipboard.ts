import { useCallback, useEffect, useRef, useState } from 'react';
import { formatSelectionAsTsv, parseTsvClipboard, applyPastedValues, applyCutClear } from '../utils';
import { normalizeSelectionRange } from '../types';
import type { ISelectionRange, IActiveCell, ICellValueChangedEvent, IColumnDef, RowId } from '../types';
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
  /** Row identity used to keep a pending cut pointing at the same rows after a sort/page change. Falls back to row object identity. */
  getRowId?: (item: T) => RowId;
  /** Called when reading the system clipboard fails (e.g. permission denied). The paste is abandoned. */
  onClipboardError?: (error: unknown) => void;
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

const normalizeNewlines = (s: string): string => s.replace(/\r\n?/g, '\n').replace(/\n+$/, '');

/** Resolve transferred cut cells by identity and leave rejected or clipped source cells intact. */
function resolveCutCells<T>(
  source: { rowKeys: unknown[]; columnIds: string[] },
  items: T[],
  visibleCols: IColumnDef<T>[],
  rowKeyOf: (item: T) => unknown,
  transferred: Set<string>,
  anchorRow: number,
  anchorCol: number
): ICellValueChangedEvent<T>[] {
  const rowIndexByKey = new Map<unknown, number>();
  items.forEach((item, i) => { rowIndexByKey.set(rowKeyOf(item), i); });
  const events: ICellValueChangedEvent<T>[] = [];
  for (const [sourceRow, key] of source.rowKeys.entries()) {
    const r = rowIndexByKey.get(key);
    if (r === undefined) continue;
    for (const [sourceCol, columnId] of source.columnIds.entries()) {
      const targetColumn = visibleCols[anchorCol + sourceCol];
      if (!targetColumn || !transferred.has(`${anchorRow + sourceRow}|${targetColumn.columnId}`)) continue;
      const c = visibleCols.findIndex((col) => col.columnId === columnId);
      if (c < 0) continue;
      events.push(...applyCutClear({ startRow: r, endRow: r, startCol: c, endCol: c }, items, visibleCols));
    }
  }
  return events;
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

  // Volatile values accessed via refs  -  keeps callbacks stable
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

  const getRowIdRef = useLatestRef(params.getRowId);
  const onClipboardErrorRef = useLatestRef(params.onClipboardError);

  /**
   * Pending cut source, captured by identity (row ids or row objects, column ids)
   * so a sort/filter/page/column change before paste cannot clear the wrong cells.
   */
  const cutSourceRef = useRef<{
    range: ISelectionRange;
    rowKeys: unknown[];
    columnIds: string[];
    tsv: string;
  } | null>(null);
  const [cutRange, setCutRange] = useState<ISelectionRange | null>(null);
  const [copyRange, setCopyRange] = useState<ISelectionRange | null>(null);
  /** In-page clipboard fallback when system clipboard is unavailable. */
  const internalClipboardRef = useRef<string | null>(null);
  /** Guard against async clipboard reads completing after unmount. */
  const isMountedRef = useRef(true);
  // Re-arm on every mount: StrictMode runs mount, cleanup, mount in development.
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const rowKeyOf = useCallback((item: T): unknown => {
    const getRowId = getRowIdRef.current;
    return getRowId ? getRowId(item) : item;
  }, [getRowIdRef]);

  /** Resolve current effective range from selection or active cell. */
  const getEffectiveRange = useCallback((): ISelectionRange | null => {
    const sel = selectionRangeRef.current;
    const ac = activeCellRef.current;
    // Normalized so paste anchors at the top-left even when the selection was
    // made upward/leftward (start below/right of end).
    if (sel) return normalizeSelectionRange(sel);
    return ac != null
      ? { startRow: ac.rowIndex, startCol: ac.columnIndex - colOffset, endRow: ac.rowIndex, endCol: ac.columnIndex - colOffset }
      : null;
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
    // A new copy replaces any pending cut.
    cutSourceRef.current = null;
    setCutRange(null);
    setCopyRange(norm);
    // navigator.clipboard is undefined outside secure contexts (plain http);
    // the internal clipboard above still makes copy/paste work in-page.
    void navigator.clipboard?.writeText(tsv).catch(() => {});
  }, [getEffectiveRange, itemsRef, visibleColsRef, formulasRef, flatColumnsRef, getFormulaRef, hasFormulaRef, colOffset]);

  const handleCut = useCallback(() => {
    if (editableRef.current === false) return;
    const range = getEffectiveRange();
    if (range == null || onCellValueChangedRef.current == null) return;
    const norm = normalizeSelectionRange(range);
    // handleCopy clears any pending cut; the new cut is registered after it.
    handleCopy();
    const items = itemsRef.current;
    const visibleCols = visibleColsRef.current;
    const rowKeys: unknown[] = [];
    for (let r = norm.startRow; r <= norm.endRow; r++) {
      const item = items[r];
      rowKeys.push(item === undefined ? undefined : rowKeyOf(item));
    }
    const columnIds: string[] = [];
    for (let c = norm.startCol; c <= norm.endCol; c++) columnIds.push(visibleCols[c]?.columnId ?? '');
    cutSourceRef.current = { range: norm, rowKeys, columnIds, tsv: internalClipboardRef.current ?? '' };
    setCutRange(norm);
    // handleCopy sets copyRange  -  override it back since this is a cut
    setCopyRange(null);
  }, [getEffectiveRange, handleCopy, editableRef, onCellValueChangedRef, itemsRef, visibleColsRef, rowKeyOf]);

  const handlePaste = useCallback(async () => {
    if (editableRef.current === false) return;
    const onCellValueChanged = onCellValueChangedRef.current;
    if (onCellValueChanged == null) return;
    let text: string;
    if (navigator.clipboard?.readText) {
      try {
        text = await navigator.clipboard.readText();
      } catch (err) {
        // A rejected read (permission denied, unfocused document) must not paste
        // a possibly stale in-grid copy over what the user meant to paste.
        onClipboardErrorRef.current?.(err);
        return;
      }
    } else {
      // No system clipboard (plain http): the in-page copy is the only source.
      text = internalClipboardRef.current ?? '';
    }
    // Bail out if component unmounted during async clipboard read
    if (!isMountedRef.current) return;
    if (!text.trim()) return;
    const norm = getEffectiveRange();
    const anchorRow = norm ? norm.startRow : 0;
    const anchorCol = norm ? norm.startCol : 0;
    const items = itemsRef.current;
    const visibleCols = visibleColsRef.current;
    const parsedRows = parseTsvClipboard(text);
    // Cells that received a pasted formula (they produce no value event).
    const pastedFormulaKeys: string[] = [];
    const flatColumns = flatColumnsRef.current;
    const setFormula = setFormulaRef.current;
    const formulaOptions = formulasRef.current && flatColumns
      ? {
          colOffset,
          flatColumns,
          setFormula: setFormula && ((col: number, row: number, formula: string | null) => {
            pastedFormulaKeys.push(`${row}|${flatColumns[col]?.columnId}`);
            setFormula(col, row, formula);
          }),
        }
      : undefined;
    beginBatch?.();
    try {
      const pasteEvents = applyPastedValues(parsedRows, anchorRow, anchorCol, items, visibleCols, formulaOptions);
      for (const evt of pasteEvents) onCellValueChanged(evt);
      const cutSource = cutSourceRef.current;
      if (cutSource) {
        cutSourceRef.current = null;
        setCutRange(null);
        // Only clear the cut cells when the pasted text is what the cut put on the
        // clipboard; something copied elsewhere in the meantime leaves them alone.
        if (normalizeNewlines(text) === normalizeNewlines(cutSource.tsv)) {
          // Skip cells the paste just wrote (values and formulas): when the paste
          // overlaps the cut source, clearing them afterwards would wipe them.
          const pastedKeys = new Set(pasteEvents.map((e) => `${e.rowIndex}|${e.columnId}`));
          for (const key of pastedFormulaKeys) pastedKeys.add(key);
          const cutEvents = resolveCutCells(cutSource, items, visibleCols, rowKeyOf, pastedKeys, anchorRow, anchorCol)
            .filter((e) => !pastedKeys.has(`${e.rowIndex}|${e.columnId}`));
          for (const evt of cutEvents) onCellValueChanged(evt);
        }
      }
    } finally {
      endBatch?.();
    }
    setCopyRange(null);
  }, [getEffectiveRange, itemsRef, visibleColsRef, editableRef, onCellValueChangedRef, beginBatch, endBatch, formulasRef, flatColumnsRef, setFormulaRef, colOffset, onClipboardErrorRef, rowKeyOf]);

  const clearClipboardRanges = useCallback(() => {
    setCopyRange(null);
    setCutRange(null);
    cutSourceRef.current = null;
  }, []);

  return { handleCopy, handleCut, handlePaste, cutRange, copyRange, clearClipboardRanges };
}
