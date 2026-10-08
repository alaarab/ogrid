import { useCallback, useEffect, useRef } from 'react';
import { captureCutSource, resolveCutClear, tilePastedRows, formatTsvAsHtmlTable } from '@alaarab/ogrid-core';
import type { IPasteFormulaSource } from '@alaarab/ogrid-core';
import { formatSelectionAsTsv, parseTsvClipboard, applyPastedValues } from '../utils';
import { normalizeSelectionRange } from '../types';
import type { ISelectionRange, IActiveCell, ICellValueChangedEvent, IColumnDef, RowId } from '../types';
import { useLatestRef } from './useLatestRef';
import { getPastedText, useClipboardMarks } from './useClipboardMarks';

export interface UseClipboardParams<T> {
  items: T[];
  visibleCols: IColumnDef<T>[];
  colOffset: number;
  selectionRange: ISelectionRange | null;
  activeCell: IActiveCell | null;
  editable?: boolean;
  // biome-ignore lint/suspicious/noConfusingVoidType: Existing void handlers remain compatible; false signals a rejected mutation.
  onCellValueChanged: ((event: ICellValueChangedEvent<T>, onAccepted?: () => void) => boolean | void) | undefined;
  beginBatch?: () => void;
  /** Run after deferred validation decisions and destination writes. */
  afterBatch?: (action: () => void) => void;
  /** Internal source erasure is part of the move, not new user input. */
  onCutClear?: (event: ICellValueChangedEvent<T>) => void;
  /** Prospective source erasure for validation; actual clearing follows accepted writes. */
  previewCutClears?: (read: (accepted: (row: number, columnId: string) => boolean) => ICellValueChangedEvent<T>[]) => void;
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
  // biome-ignore lint/suspicious/noConfusingVoidType: Existing void handlers remain compatible; false signals a rejected mutation.
  setFormula?: (col: number, row: number, formula: string | null, onAccepted?: () => void) => boolean | void;
  /** Cells covered by a merged cell (not its anchor): copied as empty, skipped on paste. */
  isCoveredCell?: (row: number, col: number) => boolean;
  /** Computed value of a formula cell (flat column + row), for "paste values only" and the HTML copy. */
  getFormulaValue?: (col: number, row: number) => unknown;
  /** Sheet row of a displayed row, so pasted formulas shift by sheet distance. Defaults to the display row. */
  formulaRow?: (rowIndex: number) => number;
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
  /**
   * Programmatic "paste values only" (context menu): like `handlePaste`, but
   * formulas copied from this grid paste as their computed values and pasted
   * text starting with "=" is stored as text, not as a formula.
   */
  handlePasteValues: () => Promise<void>;
  /**
   * Make the next native `paste` event (within a second) paste values only.
   * Ctrl/Cmd+Shift+V calls this on keydown and leaves the paste event to follow.
   */
  armPasteValues: () => void;
  /** Current cut range for UI (marching ants). Null when no cut or after paste. */
  cutRange: ISelectionRange | null;
  /** Current copy range for UI (marching ants). Null when no copy or after paste/cut. */
  copyRange: ISelectionRange | null;
  /** Clear both copy and cut ranges (dismisses marching ants). Called on Escape. */
  clearClipboardRanges: () => void;
}

/** What a copy puts on the clipboard: TSV plus an HTML table of the values. */
interface ClipboardPayload {
  tsv: string;
  html: string;
}

/** The last in-grid copy: the in-page clipboard, its computed values, and where it came from. */
interface InternalClipboard {
  text: string;
  valuesText: string;
  source: IPasteFormulaSource;
}

const normalizeClipboardText = (s: string): string => s.replace(/\r\n?/g, '\n').replace(/\n+$/, '');

/** How long after Ctrl/Cmd+Shift+V its paste event still pastes values only. */
const PASTE_VALUES_WINDOW_MS = 1000;

// navigator.clipboard is undefined outside secure contexts (plain http);
// the in-page clipboard still makes copy/paste work there.
function writeSystemClipboard(payload: ClipboardPayload | null): void {
  if (payload == null) return;
  const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
  if (!clipboard) return;
  if (typeof clipboard.write === 'function' && typeof ClipboardItem !== 'undefined') {
    const item = new ClipboardItem({
      'text/plain': new Blob([payload.tsv], { type: 'text/plain' }),
      'text/html': new Blob([payload.html], { type: 'text/html' }),
    });
    void clipboard.write([item]).catch(() => clipboard.writeText?.(payload.tsv).catch(() => {}));
    return;
  }
  void clipboard.writeText?.(payload.tsv).catch(() => {});
}

/** Put the TSV and HTML on the event's clipboardData; falls back to the async clipboard if the event has none. */
function fillClipboardEvent(event: ClipboardCopyEventLike, payload: ClipboardPayload | null): void {
  if (payload == null) return;
  if (event.clipboardData) {
    event.clipboardData.setData('text/plain', payload.tsv);
    event.clipboardData.setData('text/html', payload.html);
    event.preventDefault();
  } else {
    writeSystemClipboard(payload);
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
    endBatch, afterBatch, onCutClear, previewCutClears,
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
  const isCoveredCellRef = useLatestRef(params.isCoveredCell);
  const getFormulaValueRef = useLatestRef(params.getFormulaValue);
  const formulaRowRef = useLatestRef(params.formulaRow);

  const getRowIdRef = useLatestRef(params.getRowId);
  const onClipboardErrorRef = useLatestRef(params.onClipboardError);

  // Copy/cut marks and the pending cut (captured by identity, so a
  // sort/filter/page/column change before paste cannot clear the wrong cells),
  // shared with the headless useCellClipboard.
  const { cutRange, copyRange, markCopied, markCut, takePendingCut, clearMarks: clearClipboardRanges } = useClipboardMarks();
  /**
   * The last in-grid copy. It is the paste source when the system clipboard is
   * unavailable, and, when a paste carries the same text, says where the
   * copied formulas came from (to shift their references) and what they
   * computed (for paste values only).
   */
  const internalClipboardRef = useRef<InternalClipboard | null>(null);
  /** When Ctrl/Cmd+Shift+V armed a values-only paste (ms timestamp), or 0. */
  const pasteValuesArmedAtRef = useRef(0);
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
    // The checkbox column (active with no range) holds no cell data.
    return ac != null && ac.columnIndex >= colOffset
      ? { startRow: ac.rowIndex, startCol: ac.columnIndex - colOffset, endRow: ac.rowIndex, endCol: ac.columnIndex - colOffset }
      : null;
  }, [colOffset, selectionRangeRef, activeCellRef]);

  /** Mark the effective range as copied and fill the in-page clipboard. Returns the clipboard payload, or null with no range. */
  const copySelection = useCallback((): ClipboardPayload | null => {
    const range = getEffectiveRange();
    if (range == null) return null;
    const norm = normalizeSelectionRange(range);
    const items = itemsRef.current;
    const visibleCols = visibleColsRef.current;
    const flatColumns = flatColumnsRef.current;
    const formulaOptions = formulasRef.current && flatColumns
      ? {
          colOffset,
          flatColumns,
          getFormula: getFormulaRef.current,
          hasFormula: hasFormulaRef.current,
          getFormulaValue: getFormulaValueRef.current,
        }
      : undefined;
    const tsv = formatSelectionAsTsv(items, visibleCols, norm, formulaOptions, isCoveredCellRef.current);
    // Formulas copy as text/plain; their computed values feed paste values
    // only and the HTML table (other apps cannot evaluate grid formulas).
    const valuesText = formulaOptions
      ? formatSelectionAsTsv(items, visibleCols, norm, { ...formulaOptions, valuesOnly: true }, isCoveredCellRef.current)
      : tsv;
    const toSheetRow = formulaRowRef.current;
    const sheetRows: number[] = [];
    for (let r = norm.startRow; r <= norm.endRow; r++) sheetRows.push(toSheetRow ? toSheetRow(r) : r);
    const flatCols: number[] = [];
    for (let c = norm.startCol; c <= norm.endCol; c++) {
      const id = visibleCols[c]?.columnId;
      flatCols.push(flatColumns ? flatColumns.findIndex((fc) => fc.columnId === id) : c);
    }
    internalClipboardRef.current = { text: tsv, valuesText, source: { sheetRows, flatCols } };
    markCopied(norm);
    return { tsv, html: formatTsvAsHtmlTable(valuesText) };
  }, [getEffectiveRange, itemsRef, visibleColsRef, formulasRef, flatColumnsRef, getFormulaRef, hasFormulaRef, getFormulaValueRef, formulaRowRef, colOffset, markCopied, isCoveredCellRef]);

  /** Copy, then register the range as a pending cut. Returns the clipboard payload, or null when cut is not allowed. */
  const cutSelection = useCallback((): ClipboardPayload | null => {
    if (editableRef.current === false) return null;
    const range = getEffectiveRange();
    if (range == null || onCellValueChangedRef.current == null) return null;
    const norm = normalizeSelectionRange(range);
    // copySelection fills the in-page clipboard; the cut mark then replaces its copy mark.
    const payload = copySelection();
    markCut(norm, captureCutSource(norm, itemsRef.current, visibleColsRef.current, rowKeyOf, payload?.tsv ?? ''));
    return payload;
  }, [getEffectiveRange, copySelection, editableRef, onCellValueChangedRef, itemsRef, visibleColsRef, rowKeyOf, markCut]);

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

  /**
   * Apply clipboard text at the selection anchor: values, formulas, pending
   * cut, undo batch. A block repeats over a selection that is an exact
   * multiple of it (Excel). Formulas copied from this grid shift their
   * relative references to the paste position; with `valuesOnly` they paste
   * as their computed values and nothing becomes a formula.
   */
  const pasteText = useCallback((text: string, valuesOnly = false) => {
    const onCellValueChanged = onCellValueChangedRef.current;
    if (onCellValueChanged == null) return;
    if (!text.trim()) return;
    const norm = getEffectiveRange();
    // An active cell with no range is the checkbox column: nothing to paste into.
    if (norm == null && activeCellRef.current != null) return;
    const anchorRow = norm ? norm.startRow : 0;
    const anchorCol = norm ? norm.startCol : 0;
    const items = itemsRef.current;
    const visibleCols = visibleColsRef.current;
    const internal = internalClipboardRef.current;
    const fromGrid = internal != null && normalizeClipboardText(internal.text) === normalizeClipboardText(text);
    // Taken up front: a cut moves its block once, never repeated over the selection.
    const cut = takePendingCut();
    const block = parseTsvClipboard(valuesOnly && fromGrid ? internal.valuesText : text);
    const parsedRows = norm && !cut ? tilePastedRows(block, norm) : block;
    // Cells that received a pasted formula (they produce no value event).
    const pastedFormulaKeys: string[] = [];
    const plannedFormulaKeys: { row: number; columnId: string }[] = [];
    const flatColumns = flatColumnsRef.current;
    const setFormula = setFormulaRef.current;
    const formulaOptions = formulasRef.current && flatColumns && !valuesOnly
      ? {
          colOffset,
          flatColumns,
          setFormula: setFormula && ((col: number, row: number, formula: string | null) => {
            if (formula) plannedFormulaKeys.push({ row, columnId: flatColumns[col]?.columnId ?? '' });
            const accepted = () => { pastedFormulaKeys.push(`${row}|${flatColumns[col]?.columnId}`); };
            if (afterBatch) setFormula(col, row, formula, accepted);
            else if (setFormula(col, row, formula) !== false) accepted();
          }),
          // A cut moves formulas unchanged (Excel); a copy shifts them.
          source: fromGrid && !cut ? internal.source : undefined,
          formulaRow: formulaRowRef.current,
        }
      : undefined;
    beginBatch?.();
    try {
      const pasteEvents = applyPastedValues(parsedRows, anchorRow, anchorCol, items, visibleCols, formulaOptions, isCoveredCellRef.current);
      const acceptedPasteEvents: ICellValueChangedEvent<T>[] = [];
      for (const evt of pasteEvents) {
        if (afterBatch) onCellValueChanged(evt, () => { acceptedPasteEvents.push(evt); });
        else if (onCellValueChanged(evt) !== false) acceptedPasteEvents.push(evt);
      }
      if (cut) previewCutClears?.(accepted => resolveCutClear({ cut, text,
        pasteEvents: pasteEvents.filter(event => accepted(event.rowIndex, event.columnId)),
        pastedFormulaCells: plannedFormulaKeys.filter(cell => accepted(cell.row, cell.columnId)).map(cell => `${cell.row}|${cell.columnId}`),
        anchorRow, anchorCol, items, visibleCols, rowKeyOf,
      }));
      const clearSource = () => { if (cut) {
        const cutEvents = resolveCutClear({ cut, text, pasteEvents: acceptedPasteEvents, pastedFormulaCells: pastedFormulaKeys, anchorRow, anchorCol, items, visibleCols, rowKeyOf });
        for (const evt of cutEvents) (onCutClear ?? onCellValueChanged)(evt);
      } };
      if (afterBatch) afterBatch(clearSource);
      else clearSource();
    } finally {
      endBatch?.();
    }
  }, [getEffectiveRange, activeCellRef, itemsRef, visibleColsRef, onCellValueChangedRef, beginBatch, endBatch, formulasRef, flatColumnsRef, setFormulaRef, formulaRowRef, colOffset, rowKeyOf, takePendingCut, isCoveredCellRef, afterBatch, onCutClear, previewCutClears]);

  /** Read the clipboard for a programmatic paste (context menu), or null when the read failed. */
  const readClipboardText = useCallback(async (): Promise<string | null> => {
    if (navigator.clipboard?.readText) {
      try {
        return await navigator.clipboard.readText();
      } catch (err) {
        // A rejected read (permission denied, unfocused document) must not paste
        // a possibly stale in-grid copy over what the user meant to paste.
        onClipboardErrorRef.current?.(err);
        return null;
      }
    }
    // No system clipboard (plain http): the in-page copy is the only source.
    return internalClipboardRef.current?.text ?? '';
  }, [onClipboardErrorRef]);

  const handlePasteValues = useCallback(async () => {
    if (editableRef.current === false) return;
    if (onCellValueChangedRef.current == null) return;
    const text = await readClipboardText();
    if (text == null || !isMountedRef.current) return;
    pasteText(text, true);
  }, [editableRef, onCellValueChangedRef, readClipboardText, pasteText]);

  const armPasteValues = useCallback(() => {
    pasteValuesArmedAtRef.current = Date.now();
  }, []);

  const handlePaste = useCallback(async () => {
    if (editableRef.current === false) return;
    if (onCellValueChangedRef.current == null) return;
    const text = await readClipboardText();
    // Bail out if the read failed or the component unmounted during it.
    if (text == null || !isMountedRef.current) return;
    pasteText(text);
  }, [editableRef, onCellValueChangedRef, readClipboardText, pasteText]);

  const handlePasteEvent = useCallback((event: ClipboardPasteEventLike) => {
    const armedAt = pasteValuesArmedAtRef.current;
    pasteValuesArmedAtRef.current = 0;
    if (editableRef.current === false) return;
    if (onCellValueChangedRef.current == null) return;
    const data = event.clipboardData;
    // The browser hands over the clipboard text with the event, so this works
    // on plain http and in browsers that deny navigator.clipboard.readText.
    let text = getPastedText(data);
    // An in-grid copy on plain http never reached the system clipboard, so it
    // is the only thing the user can have meant when the event carries nothing.
    if (!text.trim()) text = internalClipboardRef.current?.text ?? '';
    event.preventDefault();
    pasteText(text, armedAt > 0 && Date.now() - armedAt < PASTE_VALUES_WINDOW_MS);
  }, [editableRef, onCellValueChangedRef, pasteText]);

  return {
    handleCopy,
    handleCut,
    handleCopyEvent,
    handleCutEvent,
    handlePaste,
    handlePasteEvent,
    handlePasteValues,
    armPasteValues,
    cutRange,
    copyRange,
    clearClipboardRanges,
  };
}
