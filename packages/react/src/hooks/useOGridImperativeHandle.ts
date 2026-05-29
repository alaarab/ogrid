import { useImperativeHandle, type Ref, type Dispatch, type SetStateAction } from 'react';
import { useLatestRef } from './useLatestRef';
import type { RowId, IOGridApi, IRowSelectionChangeEvent } from '../types';
import type { UseOGridSortingState } from './useOGridSorting';
import type { UseOGridFiltersState } from './useOGridFilters';
import type { UseOGridDataFetchingState } from './useOGridDataFetching';

export interface UseOGridImperativeHandleParams<T> {
  ref: Ref<IOGridApi<T>>;
  isServerSide: boolean;
  /** Controlled `columnOrder` / `selectedRows` props referenced by the handle. */
  columnOrder: string[] | undefined;
  selectedRows: Set<RowId> | undefined;
  onColumnOrderChange?: (order: string[]) => void;
  onSelectionChange?: (event: IRowSelectionChangeEvent<T>) => void;
  /** Sub-hook states whose methods the handle invokes. */
  sortingState: UseOGridSortingState;
  filtersState: UseOGridFiltersState;
  dataFetchingState: UseOGridDataFetchingState<T>;
  /** Writers owned by sibling hooks / useOGrid (stable useState setters or useCallbacks). */
  setVisibleColumns: (cols: Set<string>) => void;
  setInternalColumnOrder: Dispatch<SetStateAction<string[] | undefined>>;
  setColumnWidthOverrides: Dispatch<SetStateAction<Record<string, number>>>;
  setPinnedOverrides: Dispatch<SetStateAction<Record<string, 'left' | 'right'>>>;
  setInternalSelectedRows: Dispatch<SetStateAction<Set<RowId>>>;
  setInternalData: Dispatch<SetStateAction<T[]>>;
  setInternalLoading: Dispatch<SetStateAction<boolean>>;
  /** Current values snapshotted into refs so the handle reads them lazily. */
  visibleColumns: Set<string>;
  effectiveColumnOrder: string[] | undefined;
  columnWidthOverrides: Record<string, number>;
  pinnedOverrides: Record<string, 'left' | 'right'>;
  effectiveSelectedRows: Set<RowId>;
  columns: ReadonlyArray<{ columnId: string }>;
  getRowId: (item: T) => RowId;
}

/**
 * Wires the imperative `IOGridApi` handle for useOGrid. Volatile state is read
 * through `useLatestRef` snapshots so the handle is recreated only when one of
 * its method sources changes identity — matching useOGrid's original behavior.
 */
export function useOGridImperativeHandle<T>(params: UseOGridImperativeHandleParams<T>): void {
  const {
    ref,
    isServerSide,
    columnOrder,
    selectedRows,
    onColumnOrderChange,
    onSelectionChange,
    sortingState,
    filtersState,
    dataFetchingState,
    setVisibleColumns,
    setInternalColumnOrder,
    setColumnWidthOverrides,
    setPinnedOverrides,
    setInternalSelectedRows,
    setInternalData,
    setInternalLoading,
    visibleColumns,
    effectiveColumnOrder,
    columnWidthOverrides,
    pinnedOverrides,
    effectiveSelectedRows,
    columns,
    getRowId,
  } = params;

  const visibleColumnsRef = useLatestRef(visibleColumns);
  const sortRef = useLatestRef(sortingState.sort);
  const columnOrderRef = useLatestRef(effectiveColumnOrder);
  const columnWidthOverridesRef = useLatestRef(columnWidthOverrides);
  const pinnedOverridesRef = useLatestRef(pinnedOverrides);
  const filtersRef = useLatestRef(filtersState.filters);
  const effectiveSelectedRowsRef = useLatestRef(effectiveSelectedRows);
  const displayItemsRef = useLatestRef(dataFetchingState.displayItems);
  const getRowIdRef = useLatestRef(getRowId);
  const columnsRef = useLatestRef(columns);

  useImperativeHandle(
    ref,
    () => ({
      setRowData: (d: T[]) => {
        if (!isServerSide) setInternalData(d);
      },
      setLoading: setInternalLoading,
      getColumnState: () => ({
        visibleColumns: Array.from(visibleColumnsRef.current),
        sort: sortRef.current,
        columnOrder: columnOrderRef.current ?? undefined,
        columnWidths: Object.keys(columnWidthOverridesRef.current).length > 0 ? columnWidthOverridesRef.current : undefined,
        filters: Object.keys(filtersRef.current).length > 0 ? filtersRef.current : undefined,
        pinnedColumns: Object.keys(pinnedOverridesRef.current).length > 0 ? pinnedOverridesRef.current : undefined,
      }),
      applyColumnState: (state: Partial<import('../types').IGridColumnState>) => {
        if (state.visibleColumns) setVisibleColumns(new Set(state.visibleColumns));
        if (state.sort) sortingState.setSort(state.sort);
        if (state.columnOrder) {
          if (columnOrder === undefined) setInternalColumnOrder(state.columnOrder);
          onColumnOrderChange?.(state.columnOrder);
        }
        if (state.columnWidths) setColumnWidthOverrides(state.columnWidths);
        if (state.filters) filtersState.setFilters(state.filters);
        if (state.pinnedColumns) setPinnedOverrides(state.pinnedColumns);
      },
      setFilterModel: filtersState.setFilters,
      getSelectedRows: () => Array.from(effectiveSelectedRowsRef.current),
      setSelectedRows: (rowIds: RowId[]) => {
        if (selectedRows === undefined) setInternalSelectedRows(new Set(rowIds));
      },
      selectAll: () => {
        const items = displayItemsRef.current;
        const allIds = new Set(items.map((item) => getRowIdRef.current(item)));
        if (selectedRows === undefined) setInternalSelectedRows(allIds);
        onSelectionChange?.({ selectedRowIds: Array.from(allIds), selectedItems: items });
      },
      deselectAll: () => {
        if (selectedRows === undefined) setInternalSelectedRows(new Set());
        onSelectionChange?.({ selectedRowIds: [], selectedItems: [] });
      },
      clearFilters: () => filtersState.setFilters({}),
      clearSort: () => sortingState.setSort({ field: sortingState.defaultSortField, direction: sortingState.defaultSortDirection }),
      resetGridState: (options?: { keepSelection?: boolean }) => {
        filtersState.setFilters({});
        sortingState.setSort({ field: sortingState.defaultSortField, direction: sortingState.defaultSortDirection });
        if (!options?.keepSelection) {
          if (selectedRows === undefined) setInternalSelectedRows(new Set());
          onSelectionChange?.({ selectedRowIds: [], selectedItems: [] });
        }
      },
      getDisplayedRows: () => displayItemsRef.current,
      refreshData: () => {
        if (isServerSide) dataFetchingState.refreshData();
      },
      getColumnOrder: () => columnOrderRef.current ?? columnsRef.current.map((c) => c.columnId),
      setColumnOrder: (order: string[]) => {
        if (columnOrder === undefined) setInternalColumnOrder(order);
        onColumnOrderChange?.(order);
      },
      scrollToRow: () => {
        // No-op at orchestration level  -  DataGridTable components implement
        // this via useVirtualScroll.scrollToIndex when virtual scrolling is active.
      },
    }),
    [
      isServerSide, setVisibleColumns, sortingState, filtersState,
      columnOrder, onColumnOrderChange, selectedRows, onSelectionChange, dataFetchingState,
      columnOrderRef, columnWidthOverridesRef, columnsRef, displayItemsRef,
      effectiveSelectedRowsRef, filtersRef, getRowIdRef, pinnedOverridesRef,
      sortRef, visibleColumnsRef,
      // Stable useState setters (passed as params, so listed explicitly to satisfy
      // exhaustive-deps); their identity never changes, so recreation frequency is
      // unchanged from the original inline handle.
      setInternalData, setInternalLoading, setInternalColumnOrder,
      setColumnWidthOverrides, setPinnedOverrides, setInternalSelectedRows,
    ]
  );
}
