import { useImperativeHandle, type Ref, type Dispatch, type SetStateAction } from 'react';
import { useLatestRef } from './useLatestRef';
import type { RowId, IOGridApi } from '../types';
import type { UseOGridSortingState } from './useOGridSorting';
import type { UseOGridFiltersState } from './useOGridFilters';
import type { UseOGridDataFetchingState } from './useOGridDataFetching';

export interface UseOGridImperativeHandleParams<T> {
  ref: Ref<IOGridApi<T>>;
  isServerSide: boolean;
  /** Controlled `columnOrder` prop referenced by the handle. */
  columnOrder: string[] | undefined;
  onColumnOrderChange?: (order: string[]) => void;
  /**
   * Sets the row selection the same way the grid does (uncontrolled state,
   * then onSelectionChange with selectedItems resolved for every id).
   */
  commitSelection: (rowIds: Iterable<RowId>, extraItems?: readonly T[]) => void;
  /** Sub-hook states whose methods the handle invokes. */
  sortingState: UseOGridSortingState;
  filtersState: UseOGridFiltersState;
  dataFetchingState: UseOGridDataFetchingState<T>;
  /** Writers owned by sibling hooks / useOGrid (stable useState setters or useCallbacks). */
  setVisibleColumns: (cols: Set<string>) => void;
  setInternalColumnOrder: Dispatch<SetStateAction<string[] | undefined>>;
  setColumnWidthOverrides: Dispatch<SetStateAction<Record<string, number>>>;
  setPinnedOverrides: Dispatch<SetStateAction<Record<string, 'left' | 'right'>>>;
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
  scrollToRowRef: React.RefObject<IOGridApi<T>['scrollToRow'] | null>;
  /** Cell and structure-edit methods (stable callbacks from useOGridCellApi / useOGridStructureEdits). */
  editApi: Pick<IOGridApi<T>, 'getCellValue' | 'setCellValue' | 'insertRows' | 'deleteRows' | 'insertColumn' | 'deleteColumn'>;
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
    onColumnOrderChange,
    commitSelection,
    sortingState,
    filtersState,
    dataFetchingState,
    setVisibleColumns,
    setInternalColumnOrder,
    setColumnWidthOverrides,
    setPinnedOverrides,
    setInternalData,
    setInternalLoading,
    visibleColumns,
    effectiveColumnOrder,
    columnWidthOverrides,
    pinnedOverrides,
    effectiveSelectedRows,
    columns,
    getRowId,
    scrollToRowRef,
    editApi,
  } = params;
  const { getCellValue, setCellValue, insertRows, deleteRows, insertColumn, deleteColumn } = editApi;

  const visibleColumnsRef = useLatestRef(visibleColumns);
  const sortRef = useLatestRef(sortingState.sort);
  const sortModelRef = useLatestRef(sortingState.sortModel);
  const columnOrderRef = useLatestRef(effectiveColumnOrder);
  const columnWidthOverridesRef = useLatestRef(columnWidthOverrides);
  const pinnedOverridesRef = useLatestRef(pinnedOverrides);
  const filtersRef = useLatestRef(filtersState.filters);
  const effectiveSelectedRowsRef = useLatestRef(effectiveSelectedRows);
  // Sparse windowed rows use absolute indices; API row lists contain loaded records only.
  const loadedItems = dataFetchingState.windowed
    ? Object.values(dataFetchingState.windowed.loadedRows ?? dataFetchingState.displayItems)
    : dataFetchingState.displayItems;
  const displayItemsRef = useLatestRef(loadedItems);
  const allFilteredItemsRef = useLatestRef(dataFetchingState.allFilteredItems);
  const getRowIdRef = useLatestRef(getRowId);
  const columnsRef = useLatestRef(columns);
  // Depend on the member functions, not the state objects (new literals every render).
  const { setSort, setSortModel, resetSort } = sortingState;
  const { setFilters } = filtersState;
  const { refreshData } = dataFetchingState;

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
        // Only multi-level sorts add `sortModel`; `sort` alone describes a single level.
        ...(sortModelRef.current.length > 1 ? { sortModel: sortModelRef.current } : {}),
        columnOrder: columnOrderRef.current ?? undefined,
        columnWidths: Object.keys(columnWidthOverridesRef.current).length > 0 ? columnWidthOverridesRef.current : undefined,
        filters: Object.keys(filtersRef.current).length > 0 ? filtersRef.current : undefined,
        pinnedColumns: Object.keys(pinnedOverridesRef.current).length > 0 ? pinnedOverridesRef.current : undefined,
      }),
      applyColumnState: (state: Partial<import('../types').IGridColumnState>) => {
        if (state.visibleColumns) setVisibleColumns(new Set(state.visibleColumns));
        if (state.sortModel) setSortModel(state.sortModel);
        else if (state.sort) setSort(state.sort);
        if (state.columnOrder) {
          if (columnOrder === undefined) setInternalColumnOrder(state.columnOrder);
          onColumnOrderChange?.(state.columnOrder);
        }
        if (state.columnWidths) setColumnWidthOverrides(state.columnWidths);
        if (state.filters) setFilters(state.filters);
        if (state.pinnedColumns) setPinnedOverrides(state.pinnedColumns);
      },
      setFilterModel: setFilters,
      getSelectedRows: () => Array.from(effectiveSelectedRowsRef.current),
      setSelectedRows: (rowIds: RowId[]) => commitSelection(rowIds),
      selectAll: () => {
        // Client-side: every filtered row across pages. Server-side only has the loaded page.
        const items = allFilteredItemsRef.current.length > 0 ? allFilteredItemsRef.current : displayItemsRef.current;
        commitSelection(items.map((item) => getRowIdRef.current(item)), items);
      },
      deselectAll: () => commitSelection([]),
      clearFilters: () => setFilters({}),
      clearSort: resetSort,
      resetGridState: (options?: { keepSelection?: boolean }) => {
        setFilters({});
        resetSort();
        if (!options?.keepSelection) commitSelection([]);
      },
      getDisplayedRows: () => displayItemsRef.current,
      refreshData: () => {
        if (isServerSide) refreshData();
      },
      getColumnOrder: () => columnOrderRef.current ?? columnsRef.current.map((c) => c.columnId),
      setColumnOrder: (order: string[]) => {
        if (columnOrder === undefined) setInternalColumnOrder(order);
        onColumnOrderChange?.(order);
      },
      scrollToRow: (index, options) => scrollToRowRef.current?.(index, options),
      getCellValue,
      setCellValue,
      insertRows,
      deleteRows,
      insertColumn,
      deleteColumn,
    }),
    [
      isServerSide, setVisibleColumns, setSort, setSortModel, resetSort, setFilters,
      columnOrder, onColumnOrderChange, commitSelection, refreshData,
      columnOrderRef, columnWidthOverridesRef, columnsRef, displayItemsRef, allFilteredItemsRef,
      effectiveSelectedRowsRef, filtersRef, getRowIdRef, pinnedOverridesRef,
      sortRef, sortModelRef, visibleColumnsRef,
      // Stable useState setters (passed as params, so listed explicitly to satisfy
      // exhaustive-deps); their identity never changes, so recreation frequency is
      // unchanged from the original inline handle.
      setInternalData, setInternalLoading, setInternalColumnOrder,
      setColumnWidthOverrides, setPinnedOverrides,
      scrollToRowRef,
      getCellValue, setCellValue, insertRows, deleteRows, insertColumn, deleteColumn,
    ]
  );
}
