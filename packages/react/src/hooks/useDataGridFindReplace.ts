/**
 * Find & Replace wiring for <OGrid>'s DataGridTable: adapts the headless
 * `useFindReplace` to the grid's rows, pages, active cell, merged cells,
 * formulas and undo-batched edit path, and owns the Ctrl+F / Ctrl+H binding.
 * Kept separate from useKeyboardNavigation so the shortcut stays isolated.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type * as React from 'react';
import { isCoveredCell as isCoveredMergeCell } from '@alaarab/ogrid-core';
import type { ICellValueChangedEvent, IFindFormulaEdit, IFindMatch, ISelectionRange, IMergeLayout } from '@alaarab/ogrid-core';
import type { IActiveCell, IColumnDef, PageSize, RowId } from '../types';
import { useFindReplace } from './useFindReplace';
import type { UseFindReplaceResult } from './useFindReplace';
import { useLatestRef } from './useLatestRef';

export interface UseDataGridFindReplaceParams<T> {
  enabled: boolean;
  /** Displayed rows (current page, or every row when not paginated). */
  items: T[];
  /** Every filtered row across pages; omitted when `items` holds them all. */
  findRows?: T[];
  onFindPageChange?: (page: number) => void;
  currentPage: number;
  pageSize: PageSize | undefined;
  visibleCols: IColumnDef<T>[];
  colOffset: number;
  getRowId: (item: T) => RowId;
  activeCell: IActiveCell | null;
  setActiveCell: (cell: IActiveCell | null) => void;
  selectionRange: ISelectionRange | null;
  setSelectionRange: (range: ISelectionRange | null) => void;
  editingCell: unknown;
  /** Grid-level `editable`; false makes the panel find-only. */
  editable: boolean | undefined;
  /** The undo-wrapped value change handler (undefined when the grid has none). */
  onCellValueChanged: ((event: ICellValueChangedEvent<T>) => void) | undefined;
  beginBatch: () => void;
  endBatch: () => void;
  /** Formula accessors in (flat column, displayed row) coordinates. */
  getFormula?: (col: number, row: number) => string | undefined;
  setFormula?: (col: number, row: number, formula: string | null) => void;
  /** Computed formula value in sheet coordinates. */
  getFormulaValue?: (col: number, row: number) => unknown;
  formulaCol: (columnId: string) => number;
  formulaRow: (displayRow: number) => number;
  mergeLayout: IMergeLayout | null;
  wrapperRef: React.RefObject<HTMLDivElement | null>;
}

export interface DataGridFindReplaceState {
  enabled: boolean;
  find: UseFindReplaceResult;
  /** Handles Ctrl+F / Ctrl+H on the grid. Returns true when it consumed the event. */
  handleKeyDown: (e: React.KeyboardEvent) => boolean;
  /** Close the panel and return focus to the active cell. */
  close: () => void;
  /** Bumped each time the panel is (re)opened, so the panel can refocus its input. */
  focusRequest: number;
  /** Value for the wrapper's `data-ogrid-find` attribute that scopes `highlightCss`. */
  scopeId: string;
  /** CSS highlighting the displayed matches, or '' when there are none. */
  highlightCss: string;
}

/** Highlight rules beyond this many cells are dropped (the count stays exact). */
const MAX_HIGHLIGHTS = 2000;
let scopeCounter = 0;

function cssString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\a ')}"`;
}

export function useDataGridFindReplace<T>(params: UseDataGridFindReplaceParams<T>): DataGridFindReplaceState {
  const {
    enabled, items, findRows, onFindPageChange, currentPage, pageSize, visibleCols, colOffset, getRowId,
    activeCell, setActiveCell, selectionRange, setSelectionRange, editingCell, editable,
    onCellValueChanged, beginBatch, endBatch, getFormula, setFormula, getFormulaValue,
    formulaCol, formulaRow, mergeLayout, wrapperRef,
  } = params;
  const [scopeId] = useState(() => `f${++scopeCounter}`);
  const [focusRequest, setFocusRequest] = useState(0);

  const rows = findRows ?? items;
  const pageOffset = findRows && typeof pageSize === 'number' ? (currentPage - 1) * pageSize : 0;

  // Grid coordinates (displayed row, column with colOffset) <-> find coordinates (rows index, data column).
  const findActiveCell = useMemo(
    () => (activeCell ? { rowIndex: activeCell.rowIndex + pageOffset, columnIndex: activeCell.columnIndex - colOffset } : null),
    [activeCell, pageOffset, colOffset]
  );
  const findSelection = useMemo<ISelectionRange | null>(
    () => (selectionRange
      ? { startRow: selectionRange.startRow + pageOffset, endRow: selectionRange.endRow + pageOffset, startCol: selectionRange.startCol, endCol: selectionRange.endCol }
      : null),
    [selectionRange, pageOffset]
  );

  const isCoveredCell = useMemo(() => {
    if (!mergeLayout) return undefined;
    return (rowIndex: number, columnIndex: number) => isCoveredMergeCell(mergeLayout, rowIndex - pageOffset, columnIndex);
  }, [mergeLayout, pageOffset]);

  const formulaAccessors = useMemo(() => {
    if (!getFormula) return { getFormula: undefined, getFormulaValue: undefined };
    return {
      getFormula: (_item: T, column: { columnId: string }, rowIndex: number) => {
        const col = formulaCol(column.columnId);
        return col >= 0 ? getFormula(col, rowIndex - pageOffset) : undefined;
      },
      getFormulaValue: getFormulaValue && ((_item: T, column: { columnId: string }, rowIndex: number) => {
        const col = formulaCol(column.columnId);
        const row = formulaRow(rowIndex - pageOffset);
        return col >= 0 && row >= 0 ? getFormulaValue(col, row) : undefined;
      }),
    };
  }, [getFormula, getFormulaValue, formulaCol, formulaRow, pageOffset]);

  const canEdit = editable !== false && onCellValueChanged != null;
  const editRef = useLatestRef({ onCellValueChanged, setFormula, beginBatch, endBatch, formulaCol, pageOffset });
  const onCellEdit = useCallback((events: ICellValueChangedEvent<T>[], formulaEdits: IFindFormulaEdit<T>[]) => {
    const st = editRef.current;
    st.beginBatch();
    try {
      // Events carry displayed-row indexes, like every other grid edit; rows on
      // other pages get indexes outside the displayed range.
      for (const e of events) st.onCellValueChanged?.({ ...e, rowIndex: e.rowIndex - st.pageOffset });
      for (const f of formulaEdits) {
        const col = st.formulaCol(f.columnId);
        if (col >= 0) st.setFormula?.(col, f.rowIndex - st.pageOffset, f.newFormula);
      }
    } finally {
      st.endBatch();
    }
  }, [editRef]);

  // --- Navigation: make the match the active cell, changing page first if needed ---
  const navRef = useLatestRef({ items, findRows, pageSize, currentPage, onFindPageChange, colOffset, getRowId, pageOffset, setActiveCell, setSelectionRange });
  const pendingRef = useRef<IFindMatch | null>(null);
  const scopeIsSelectionRef = useRef(false);

  const showMatch = useCallback((match: IFindMatch, displayRow: number) => {
    const st = navRef.current;
    const columnIndex = match.columnIndex + st.colOffset;
    st.setActiveCell({ rowIndex: displayRow, columnIndex });
    // Searching within a selection keeps it; otherwise the match becomes the selection.
    if (!scopeIsSelectionRef.current) {
      st.setSelectionRange({ startRow: displayRow, endRow: displayRow, startCol: match.columnIndex, endCol: match.columnIndex });
    }
  }, [navRef]);

  const onNavigate = useCallback((match: IFindMatch) => {
    const st = navRef.current;
    const displayRow = match.rowIndex - st.pageOffset;
    if (displayRow >= 0 && displayRow < st.items.length) {
      pendingRef.current = null;
      showMatch(match, displayRow);
      return;
    }
    if (st.findRows && typeof st.pageSize === 'number' && st.pageSize > 0 && st.onFindPageChange) {
      pendingRef.current = match;
      st.onFindPageChange(Math.floor(match.rowIndex / st.pageSize) + 1);
    }
  }, [navRef, showMatch]);

  // The page holding a pending match rendered: show it.
  useEffect(() => {
    const match = pendingRef.current;
    if (!match) return;
    const displayRow = items.findIndex((item) => getRowId(item) === match.rowId);
    if (displayRow < 0) return;
    pendingRef.current = null;
    showMatch(match, displayRow);
  }, [items, getRowId, showMatch]);

  const find = useFindReplace<T>({
    rows,
    columns: visibleCols,
    getRowId,
    onCellEdit: canEdit ? onCellEdit : undefined,
    onNavigate,
    activeCell: findActiveCell,
    selection: findSelection,
    getFormula: formulaAccessors.getFormula,
    getFormulaValue: formulaAccessors.getFormulaValue,
    isCoveredCell,
  });
  scopeIsSelectionRef.current = find.options.scope === 'selection';

  const { open, close: closeFind, isOpen } = find;

  // Turning the feature off closes the panel.
  useEffect(() => {
    if (!enabled && isOpen) closeFind();
  }, [enabled, isOpen, closeFind]);

  const editingRef = useLatestRef(editingCell);
  const handleKeyDown = useCallback((e: React.KeyboardEvent): boolean => {
    if (!enabled || e.altKey || e.shiftKey || !(e.ctrlKey || e.metaKey)) return false;
    const key = e.key.toLowerCase();
    if (key !== 'f' && key !== 'h') return false;
    // A cell editor keeps its own shortcuts.
    if (editingRef.current != null) return false;
    e.preventDefault();
    e.stopPropagation();
    open(key === 'h' ? 'replace' : 'find');
    setFocusRequest((n) => n + 1);
    return true;
  }, [enabled, open, editingRef]);

  const close = useCallback(() => {
    closeFind();
    pendingRef.current = null;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    // The roving tab stop is the active cell; the wrapper stands in while it isn't rendered.
    const cell = wrapper.querySelector<HTMLElement>('tbody td[tabindex="0"]');
    (cell ?? wrapper).focus({ preventScroll: true });
  }, [closeFind, wrapperRef]);

  const { matches } = find;
  const highlightCss = useMemo(() => {
    if (!isOpen || matches.length === 0) return '';
    const selectors: string[] = [];
    const end = pageOffset + items.length;
    for (const m of matches) {
      if (m.rowIndex < pageOffset || m.rowIndex >= end) continue;
      selectors.push(`[data-ogrid-find="${scopeId}"] [data-row-id=${cssString(String(m.rowId))}] > [data-column-id=${cssString(m.columnId)}]`);
      if (selectors.length >= MAX_HIGHLIGHTS) break;
    }
    if (selectors.length === 0) return '';
    return `${selectors.join(',\n')} { box-shadow: inset 0 0 0 9999px var(--ogrid-find-match-bg, rgba(255, 213, 0, 0.28)); }`;
  }, [isOpen, matches, pageOffset, items.length, scopeId]);

  return { enabled, find, handleKeyDown, close, focusRequest, scopeId, highlightCss };
}
