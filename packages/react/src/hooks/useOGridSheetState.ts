import { useSheetScopedState } from './useSheetScopedState';
import type { SortState } from './useOGridSorting';
import type { SheetScopedGridState } from './useOGrid.types';
import type { IFilters, RowId } from '../types';

/** Which sheet-scoped slots the host controls. A controlled slot is never written on a sheet switch. */
export interface SheetStateControlled {
  visibleColumns: boolean;
  sort: boolean;
  filters: boolean;
  page: boolean;
  selectedRows: boolean;
  columnOrder: boolean;
}

/** Internal-state setters a sheet switch writes through. */
export interface SheetStateSetters {
  setVisibleColumns: (cols: Set<string>) => void;
  setSort: (sort: SortState) => void;
  setFilters: (filters: IFilters) => void;
  setPage: (page: number) => void;
  setSelectedRows: (rows: Set<RowId>) => void;
  setColumnOrder: (order: string[] | undefined) => void;
  setColumnWidths: (widths: Record<string, number>) => void;
  setPinned: (pinned: Record<string, 'left' | 'right'>) => void;
}

/** State for a sheet seen for the first time: its own defaults, nothing inherited. */
export function sheetStateDefaults(defaultSort: SortState): SheetScopedGridState {
  return {
    visibleColumns: undefined,
    sort: defaultSort,
    filters: {},
    page: 1,
    selectedRows: new Set<RowId>(),
    columnOrder: undefined,
    columnWidths: {},
    pinned: undefined,
  };
}

/**
 * Writes a captured (or default) sheet state into the grid's internal state.
 * Controlled slots are left to the host. `visibleColumns` and `pinned` are
 * skipped when `undefined` (a first-time sheet): their own hooks reconcile
 * against the incoming column defs, which is what preserves a deliberate hide
 * for a column both sheets share. Widths are always internal.
 */
export function applySheetState(
  state: SheetScopedGridState,
  controlled: SheetStateControlled,
  set: SheetStateSetters,
): void {
  if (!controlled.visibleColumns && state.visibleColumns !== undefined) set.setVisibleColumns(state.visibleColumns);
  if (!controlled.sort) set.setSort(state.sort);
  if (!controlled.filters) set.setFilters(state.filters);
  if (!controlled.page) set.setPage(state.page);
  if (!controlled.selectedRows) set.setSelectedRows(state.selectedRows);
  if (!controlled.columnOrder) set.setColumnOrder(state.columnOrder);
  set.setColumnWidths(state.columnWidths);
  if (state.pinned !== undefined) set.setPinned(state.pinned);
}

export interface UseOGridSheetStateParams {
  activeSheet: string | undefined;
  current: SheetScopedGridState;
  defaultSortField: string;
  defaultSortDirection: SortState['direction'];
  controlled: SheetStateControlled;
  setters: SheetStateSetters;
}

/**
 * Per-sheet UI state. Everything here is keyed on ids that belong to one
 * sheet: column ids (visibility, sort field, filter keys, order, widths, pins)
 * and row ids (selection), plus a page index that only makes sense against
 * that sheet's row count. It is captured when the user leaves a sheet and
 * restored when they come back, and a sheet seen for the first time starts
 * from its own defaults instead of inheriting the previous sheet's.
 *
 * `pageSize` is deliberately NOT sheet-scoped: it is a viewport preference,
 * not something the sheet's columns or rows give meaning to.
 */
export function useOGridSheetState(params: UseOGridSheetStateParams): void {
  const { activeSheet, current, defaultSortField, defaultSortDirection, controlled, setters } = params;
  useSheetScopedState<SheetScopedGridState>({
    activeSheet,
    current,
    defaults: () => sheetStateDefaults({ field: defaultSortField, direction: defaultSortDirection }),
    apply: (state) => applySheetState(state, controlled, setters),
  });
}
