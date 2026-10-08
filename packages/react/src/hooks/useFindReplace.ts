/**
 * useFindReplace — headless Excel-style Find & Replace.
 *
 * Holds the panel state (open, mode, query, replacement, options), computes
 * the matching cells with `findMatches` from core, walks them with wrapping
 * next/previous, and turns Replace / Replace all into value changes that went
 * through each column's `valueParser`. It renders nothing and moves nothing:
 * `onNavigate` is where you make the match the active cell and scroll to it,
 * and `onCellEdit` is where you apply the changes (one call per replace, so a
 * replace all is a single undo step if you batch it).
 *
 * Example:
 *
 *   const find = useFindReplace({
 *     rows, columns, getRowId: (r) => r.id,
 *     activeCell: range.activeCell,
 *     onNavigate: (m) => range.setActiveCell({ row: m.rowIndex, col: m.columnIndex }),
 *     onCellEdit: (events) => setRows((prev) => applyEvents(prev, events)),
 *   });
 *
 *   // Ctrl+F on your grid container: find.open('find'); Ctrl+H: find.open('replace')
 *   // <input value={find.query} onChange={(e) => find.setQuery(e.target.value)} />
 *   // <span aria-live="polite">{find.statusText}</span>
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_FIND_OPTIONS,
  findMatches,
  findNextMatchIndex,
  formatFindStatus,
  planReplace,
} from '@alaarab/ogrid-core';
import type {
  IFindOptions,
  IFindMatch,
  IFindSource,
  IFindFormulaEdit,
  ICellValueChangedEvent,
  ISelectionRange,
  RowId,
} from '@alaarab/ogrid-core';
import type { IColumnDef } from '../types';
import { useLatestRef } from './useLatestRef';

export type FindReplaceMode = 'find' | 'replace';

export interface UseFindReplaceParams<T> {
  /** Every searchable row in display order (all pages, not just the visible one). Holes are skipped. */
  rows: readonly (T | undefined)[];
  /** Visible columns in display order. */
  columns: readonly IColumnDef<T>[];
  getRowId: (item: T) => RowId;
  /**
   * Applies a replace. Called once per Replace / Replace all with every
   * accepted value change (already parsed by the column's `valueParser`), plus
   * formula writes when `getFormula` is set. Return a committed count (or a
   * promise of it) when writes can be rejected; void accepts the whole plan.
   * Omit to make the hook find-only.
   */
  // biome-ignore lint/suspicious/noConfusingVoidType: void handlers accept the complete plan; counts can settle after validation
  onCellEdit?: (events: ICellValueChangedEvent<T>[], formulaEdits: IFindFormulaEdit<T>[]) => number | Promise<number> | void;
  /** Called when a match becomes the current one: make it the active cell and scroll it into view. */
  onNavigate?: (match: IFindMatch) => void;
  /** Where the search starts (row/column indexes into `rows`/`columns`), usually the active cell. */
  activeCell?: { rowIndex: number; columnIndex: number } | null;
  /**
   * The current selection (indexes into `rows`/`columns`). It is captured when
   * the panel opens and searched when `options.scope` is `'selection'`. A
   * single-cell selection searches the whole grid, as in Excel.
   */
  selection?: ISelectionRange | null;
  /** Set to false to disable replacing (read-only grid). Default true. */
  editable?: boolean;
  /** Cell formula accessor (see `IFindSource.getFormula`). Enables formula search and formula writes. */
  getFormula?: IFindSource<T>['getFormula'];
  /** Computed value of a formula cell, searched with `lookIn: 'values'`. */
  getFormulaValue?: IFindSource<T>['getFormulaValue'];
  /** True for cells hidden under a merged cell. */
  isCoveredCell?: IFindSource<T>['isCoveredCell'];
  /** Initial options. */
  defaultOptions?: IFindOptions;
}

/** Outcome of a Replace / Replace all. */
export interface FindReplaceResult {
  replaced: number;
  skipped: number;
  skippedReadOnly: number;
  skippedInvalid: number;
  skippedFormula: number;
}

export interface UseFindReplaceResult {
  isOpen: boolean;
  mode: FindReplaceMode;
  /** Open the panel (Ctrl+F: 'find', Ctrl+H: 'replace'). Captures the current selection. */
  open: (mode?: FindReplaceMode) => void;
  close: () => void;
  setMode: (mode: FindReplaceMode) => void;
  query: string;
  setQuery: (query: string) => void;
  replacement: string;
  setReplacement: (replacement: string) => void;
  options: Required<IFindOptions>;
  setOptions: (options: Partial<IFindOptions>) => void;
  /** Matching cells in visit order. */
  matches: IFindMatch[];
  /** Index of the current match in `matches`, or -1. */
  activeIndex: number;
  activeMatch: IFindMatch | null;
  /** Go to the next match (wraps). */
  next: () => void;
  /** Go to the previous match (wraps). */
  prev: () => void;
  /** False when the grid is read-only or there is no `onCellEdit`. */
  canReplace: boolean;
  /** Replace the current match and go to the next one. With no current match, goes to the next match. */
  replace: () => FindReplaceResult;
  /** Replace every match in one `onCellEdit` call. */
  replaceAll: () => FindReplaceResult;
  /** Result of the last replace, cleared when the search changes. */
  lastResult: FindReplaceResult | null;
  /** "3 of 12", "No results", or the last replace's outcome. */
  statusText: string;
  /** True when the cell is a match (for highlighting). */
  isMatch: (rowId: RowId, columnId: string) => boolean;
}

const EMPTY_RESULT: FindReplaceResult = { replaced: 0, skipped: 0, skippedReadOnly: 0, skippedInvalid: 0, skippedFormula: 0 };

function matchKey(rowId: RowId, columnId: string): string {
  return `${String(rowId)}\u0000${columnId}`;
}

function isMultiCell(range: ISelectionRange | null | undefined): range is ISelectionRange {
  return range != null && (range.startRow !== range.endRow || range.startCol !== range.endCol);
}

/** Text of a replace outcome, e.g. "Replaced 5 cells, 2 skipped". */
export function formatReplaceStatus(result: FindReplaceResult): string {
  const cells = result.replaced === 1 ? '1 cell' : `${result.replaced} cells`;
  return result.skipped > 0 ? `Replaced ${cells}, ${result.skipped} skipped` : `Replaced ${cells}`;
}

/** Headless Excel-style Find & Replace over grid rows. */
export function useFindReplace<T>(params: UseFindReplaceParams<T>): UseFindReplaceResult {
  const {
    rows, columns, getRowId, onCellEdit, editable = true,
    getFormula, getFormulaValue, isCoveredCell, defaultOptions,
  } = params;
  const onNavigateRef = useLatestRef(params.onNavigate);
  const onCellEditRef = useLatestRef(onCellEdit);
  const activeCellRef = useLatestRef(params.activeCell);
  const selectionRef = useLatestRef(params.selection);

  const [isOpen, setIsOpen] = useState(false);
  const [mode, setModeState] = useState<FindReplaceMode>('find');
  const [query, setQueryState] = useState('');
  const [replacement, setReplacement] = useState('');
  const [options, setOptionsState] = useState<Required<IFindOptions>>(() => ({ ...DEFAULT_FIND_OPTIONS, ...defaultOptions }));
  const [scopeRange, setScopeRange] = useState<ISelectionRange | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<FindReplaceResult | null>(null);
  const [replacing, setReplacing] = useState(false);
  /** Last visited cell; next/prev continue from here when the current match is gone. */
  const anchorRef = useRef<{ rowIndex: number; columnIndex: number } | null>(null);
  /** Set by a search change; the next render's matches jump to the first match at/after the active cell. */
  const pendingJumpRef = useRef(false);

  const canReplace = editable && onCellEdit != null;

  const source = useMemo<IFindSource<T>>(
    () => ({ items: rows, columns, getRowId, getFormula, getFormulaValue, isCoveredCell }),
    [rows, columns, getRowId, getFormula, getFormulaValue, isCoveredCell]
  );

  // A single-cell (or no) selection searches the whole grid, as in Excel.
  const effectiveMatches = useMemo(() => {
    if (!isOpen) return [];
    const range = options.scope === 'selection' && isMultiCell(scopeRange) ? scopeRange : null;
    return findMatches(source, query, range ? options : { ...options, scope: 'grid' }, range);
  }, [isOpen, source, query, options, scopeRange]);

  const indexByKey = useMemo(() => {
    const m = new Map<string, number>();
    effectiveMatches.forEach((match, i) => {
      m.set(matchKey(match.rowId, match.columnId), i);
    });
    return m;
  }, [effectiveMatches]);

  const activeIndex = activeKey != null ? (indexByKey.get(activeKey) ?? -1) : -1;
  const activeMatch = activeIndex >= 0 ? (effectiveMatches[activeIndex] ?? null) : null;

  const goTo = useCallback((match: IFindMatch | undefined) => {
    if (!match) {
      setActiveKey(null);
      return;
    }
    anchorRef.current = { rowIndex: match.rowIndex, columnIndex: match.columnIndex };
    setActiveKey(matchKey(match.rowId, match.columnId));
    onNavigateRef.current?.(match);
  }, [onNavigateRef]);

  // After a search change, jump to the first match at or after the active cell.
  useEffect(() => {
    if (!pendingJumpRef.current) return;
    pendingJumpRef.current = false;
    const i = findNextMatchIndex(effectiveMatches, activeCellRef.current, 1, options.searchOrder, true);
    goTo(i >= 0 ? effectiveMatches[i] : undefined);
  }, [effectiveMatches, options.searchOrder, activeCellRef, goTo]);

  const searchChanged = useCallback(() => {
    pendingJumpRef.current = true;
    setLastResult(null);
  }, []);

  const setQuery = useCallback((q: string) => {
    setQueryState(q);
    searchChanged();
  }, [searchChanged]);

  const setOptions = useCallback((partial: Partial<IFindOptions>) => {
    setOptionsState((prev) => ({ ...prev, ...partial }));
    searchChanged();
  }, [searchChanged]);

  const open = useCallback((nextMode: FindReplaceMode = 'find') => {
    setModeState(nextMode === 'replace' && canReplace ? 'replace' : 'find');
    setScopeRange(selectionRef.current ?? null);
    setIsOpen(true);
    setLastResult(null);
  }, [canReplace, selectionRef]);

  const close = useCallback(() => {
    setIsOpen(false);
    setActiveKey(null);
    setLastResult(null);
  }, []);

  const setMode = useCallback((m: FindReplaceMode) => {
    setModeState(m === 'replace' && canReplace ? 'replace' : 'find');
  }, [canReplace]);

  const step = useCallback((direction: 1 | -1) => {
    const n = effectiveMatches.length;
    if (n === 0) return;
    setLastResult(null);
    const i = activeIndex >= 0
      ? (activeIndex + direction + n) % n
      : findNextMatchIndex(effectiveMatches, anchorRef.current ?? activeCellRef.current, direction, options.searchOrder, anchorRef.current == null);
    goTo(effectiveMatches[i]);
  }, [effectiveMatches, activeIndex, options.searchOrder, activeCellRef, goTo]);

  const next = useCallback(() => step(1), [step]);
  const prev = useCallback(() => step(-1), [step]);

  const apply = useCallback((targets: IFindMatch[]): FindReplaceResult => {
    const edit = onCellEditRef.current;
    if (!canReplace || !edit || targets.length === 0) return EMPTY_RESULT;
    const plan = planReplace({ source, matches: targets, query, replacement, options, allowFormulas: getFormula != null });
    const { replaced, skipped, skippedReadOnly, skippedInvalid, skippedFormula } = plan;
    const outcome = (committed: number): FindReplaceResult => ({ replaced: committed, skipped: skipped + replaced - committed, skippedReadOnly, skippedInvalid: skippedInvalid + replaced - committed, skippedFormula });
    const committed = plan.replaced > 0 ? edit(plan.events, plan.formulaEdits) : 0;
    if (committed instanceof Promise) {
      setReplacing(true); setLastResult(null);
      void committed.then(count => { setReplacing(false); setLastResult(outcome(count)); });
      return EMPTY_RESULT;
    }
    const result = outcome(committed ?? replaced);
    setLastResult(result);
    return result;
  }, [canReplace, onCellEditRef, source, query, replacement, options, getFormula]);

  const replace = useCallback((): FindReplaceResult => {
    if (!activeMatch) {
      step(1);
      return EMPTY_RESULT;
    }
    const result = apply([activeMatch]);
    const n = effectiveMatches.length;
    // Move on to the next match; the replaced cell may still match (e.g. "a" -> "aa").
    if (n > 1) goTo(effectiveMatches[(activeIndex + 1) % n]);
    return result;
  }, [activeMatch, activeIndex, apply, effectiveMatches, goTo, step]);

  const replaceAll = useCallback((): FindReplaceResult => {
    setActiveKey(null);
    return apply(effectiveMatches);
  }, [apply, effectiveMatches]);

  const isMatch = useCallback(
    (rowId: RowId, columnId: string) => indexByKey.has(matchKey(rowId, columnId)),
    [indexByKey]
  );

  const statusText = replacing ? 'Waiting for validation…' : lastResult
    ? formatReplaceStatus(lastResult)
    : query === '' ? '' : formatFindStatus(activeIndex, effectiveMatches.length);

  return {
    isOpen, mode, open, close, setMode,
    query, setQuery, replacement, setReplacement,
    options, setOptions,
    matches: effectiveMatches, activeIndex, activeMatch,
    next, prev,
    canReplace, replace, replaceAll, lastResult,
    statusText, isMatch,
  };
}
