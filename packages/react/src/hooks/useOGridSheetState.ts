import { useSheetScopedState } from './useSheetScopedState';
import type { SortState, UseOGridSortingState } from './useOGridSorting';
import type { UseOGridFiltersState } from './useOGridFilters';
import type { UseOGridPaginationState } from './useOGridPagination';
import type { UseOGridRowSelectionState } from './useOGridRowSelection';
import type { UseOGridColumnLayoutState } from './useOGridColumnLayout';
import type { UseOGridColumnVisibilityState } from './useOGridColumnVisibility';
import type { SheetScopedGridState } from './useOGrid.types';
import type { IOGridProps, RowId } from '../types';

/** The props whose presence makes a sheet-scoped slot controlled (never written on a sheet switch). */
export type SheetStateControlProps = Pick<
  IOGridProps<unknown>,
  'visibleColumns' | 'sort' | 'filters' | 'page' | 'selectedRows' | 'columnOrder'
>;

/** The raw (non-notifying) setters a sheet switch writes through. */
export interface SheetStateSlices {
  visibility: Pick<UseOGridColumnVisibilityState, 'setInternalVisibleColumns'>;
  sorting: Pick<UseOGridSortingState, 'setInternalSort'>;
  filters: Pick<UseOGridFiltersState, 'setInternalFilters'>;
  pagination: Pick<UseOGridPaginationState, 'setInternalPage'>;
  selection: Pick<UseOGridRowSelectionState<unknown>, 'setInternalSelectedRows'>;
  columnLayout: Pick<UseOGridColumnLayoutState, 'setInternalColumnOrder' | 'setColumnWidthOverrides' | 'setPinnedOverrides'>;
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
 * for a column both sheets share. Widths have no controlled prop.
 */
export function applySheetState(state: SheetScopedGridState, props: SheetStateControlProps, s: SheetStateSlices): void {
  if (props.visibleColumns === undefined && state.visibleColumns !== undefined) {
    s.visibility.setInternalVisibleColumns(state.visibleColumns);
  }
  if (props.sort === undefined) s.sorting.setInternalSort(state.sort);
  if (props.filters === undefined) s.filters.setInternalFilters(state.filters);
  if (props.page === undefined) s.pagination.setInternalPage(state.page);
  if (props.selectedRows === undefined) s.selection.setInternalSelectedRows(state.selectedRows);
  if (props.columnOrder === undefined) s.columnLayout.setInternalColumnOrder(state.columnOrder);
  s.columnLayout.setColumnWidthOverrides(state.columnWidths);
  if (state.pinned !== undefined) s.columnLayout.setPinnedOverrides(state.pinned);
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
export function useOGridSheetState(
  props: SheetStateControlProps & Pick<IOGridProps<unknown>, 'activeSheet'>,
  current: SheetScopedGridState,
  defaultSortField: string,
  defaultSortDirection: SortState['direction'],
  slices: SheetStateSlices,
): void {
  useSheetScopedState<SheetScopedGridState>({
    activeSheet: props.activeSheet,
    current,
    defaults: () => sheetStateDefaults({ field: defaultSortField, direction: defaultSortDirection }),
    apply: (state) => applySheetState(state, props, slices),
  });
}
