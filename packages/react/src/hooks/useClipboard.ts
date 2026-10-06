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

/** The parts of a native or React `ClipboardEvent` the paste handler reads. */
export type ClipboardPasteEventLike = {
  clipboardData: Pick<DataTransfer, 'getData'> | null;
  preventDefault: () => void;
};

/** The parts of a native or React `ClipboardEvent` the copy and cut handlers use. */
export type ClipboardCopyEventLike = {
  clipboardData: Pick<DataTransfer, 'setData'> | null;
  preventDefault: () => void;
};

export interface UseClipboardResult {
  /**
   * Programmatic copy (context menu): writes the TSV with
   * `navigator.clipboard.writeText`, which needs a secure context.
   */
  handleCopy: () => void;
  /** Programmatic cut (context menu); see `handleCopy`. */
  handleCut: () => void;
  /**
   * Copy from a native `copy` event (Ctrl/Cmd+C). Puts the TSV on
   * `event.clipboardData` (works on plain http, no permission) and calls
   * `preventDefault()`. Same state changes as `handleCopy`.
   */
  handleCopyEvent: (event: ClipboardCopyEventLike) => void;
  /** Cut from a native `cut` event (Ctrl/Cmd+X); see `handleCopyEvent`. */
  handleCutEvent: (event: ClipboardCopyEventLike) => void;
  /**
   * Programmatic paste (context menu): reads the system clipboard with
   * `navigator.clipboard.readText`, which needs a secure context and, in
   * Firefox/Safari, a permission the user is often not asked for.
   */
  handlePaste: () => Promise<void>;
  /**
   * Paste from a native `paste` event (Ctrl/Cmd+V, Shift+Insert). Takes the
   * text from `event.clipboardData` without any permission prompt, calls
   * `preventDefault()` and applies the same TSV paste as `handlePaste`. The
   * keyboard shortcut must not call `handlePaste` as well, or it pastes twice.
   */
  handlePasteEvent: (event: ClipboardPasteEventLike) => void;
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

// navigator.clipboard is undefined outside secure contexts (plain http);
// the in-page clipboard still makes copy/paste work there.
function writeSystemClipboard(tsv: string | null): void {
  if (tsv != null) void navigator.clipboard?.writeText(tsv).catch(() => {});
}

/** Put the TSV on the event's clipboardData; falls back to writeText if the event has none. */
function fillClipboardEvent(event: ClipboardCopyEventLike, tsv: string | null): void {
  if (tsv == null) return;
  if (event.clipboardData) {
    event.clipboardData.setData('text/plain', tsv);
    event.preventDefault();
  } else {
    writeSystemClipboard(tsv);
  }
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

  /** Mark the effective range as copied and fill the in-page clipboard. Returns the TSV, or null with no range. */
  const copySelection = useCallback((): string | null => {
    const range = getEffectiveRange();
    if (range == null) return null;
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
    return tsv;
  }, [getEffectiveRange, itemsRef, visibleColsRef, formulasRef, flatColumnsRef, getFormulaRef, hasFormulaRef, colOffset]);

  /** Copy, then register the range as a pending cut. Returns the TSV, or null when cut is not allowed. */
  const cutSelection = useCallback((): string | null => {
    if (editableRef.current === false) return null;
    const range = getEffectiveRange();
    if (range == null || onCellValueChangedRef.current == null) return null;
    const norm = normalizeSelectionRange(range);
    // copySelection clears any pending cut; the new cut is registered after it.
    const tsv = copySelection() ?? '';
    const items = itemsRef.current;
    const visibleCols = visibleColsRef.current;
    const rowKeys: unknown[] = [];
    for (let r = norm.startRow; r <= norm.endRow; r++) {
      const item = items[r];
      rowKeys.push(item === undefined ? undefined : rowKeyOf(item));
    }
    const columnIds: string[] = [];
    for (let c = norm.startCol; c <= norm.endCol; c++) columnIds.push(visibleCols[c]?.columnId ?? '');
    cutSourceRef.current = { range: norm, rowKeys, columnIds, tsv };
    setCutRange(norm);
    // copySelection sets copyRange  -  override it back since this is a cut
    setCopyRange(null);
    return tsv;
  }, [getEffectiveRange, copySelection, editableRef, onCellValueChangedRef, itemsRef, visibleColsRef, rowKeyOf]);

  const handleCopy = useCallback(() => {
    writeSystemClipboard(copySelection());
  }, [copySelection]);

  const handleCut = useCallback(() => {
    writeSystemClipboard(cutSelection());
  }, [cutSelection]);

  const handleCopyEvent = useCallback((event: ClipboardCopyEventLike) => {
    fillClipboardEvent(event, copySelection());
  }, [copySelection]);

  const handleCutEvent = useCallback((event: ClipboardCopyEventLike) => {
    fillClipboardEvent(event, cutSelection());
  }, [cutSelection]);

  /** Apply clipboard text at the selection anchor: values, formulas, pending cut, undo batch. */
  const pasteText = useCallback((text: string) => {
    const onCellValueChanged = onCellValueChangedRef.current;
    if (onCellValueChanged == null) return;
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
  }, [getEffectiveRange, itemsRef, visibleColsRef, onCellValueChangedRef, beginBatch, endBatch, formulasRef, flatColumnsRef, setFormulaRef, colOffset, rowKeyOf]);

  const handlePaste = useCallback(async () => {
    if (editableRef.current === false) return;
    if (onCellValueChangedRef.current == null) return;
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
    pasteText(text);
  }, [editableRef, onCellValueChangedRef, onClipboardErrorRef, pasteText]);

  const handlePasteEvent = useCallback((event: ClipboardPasteEventLike) => {
    if (editableRef.current === false) return;
    if (onCellValueChangedRef.current == null) return;
    const data = event.clipboardData;
    // The browser hands over the clipboard text with the event, so this works
    // on plain http and in browsers that deny navigator.clipboard.readText.
    let text = data?.getData('text/plain') || data?.getData('text') || '';
    // An in-grid copy on plain http never reached the system clipboard, so it
    // is the only thing the user can have meant when the event carries nothing.
    if (!text.trim()) text = internalClipboardRef.current ?? '';
    event.preventDefault();
    pasteText(text);
  }, [editableRef, onCellValueChangedRef, pasteText]);

  const clearClipboardRanges = useCallback(() => {
    setCopyRange(null);
    setCutRange(null);
    cutSourceRef.current = null;
  }, []);

  return { handleCopy, handleCut, handleCopyEvent, handleCutEvent, handlePaste, handlePasteEvent, cutRange, copyRange, clearClipboardRanges };
}
