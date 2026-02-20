import * as React from 'react';
import {
  useMemo,
  useCallback,
  useState,
  useImperativeHandle,
  useEffect,
  useRef,
} from 'react';

import { flattenColumns } from '../utils';
import { validateColumns, validateRowIds } from '@alaarab/ogrid-core';
import { useOGridPagination } from './useOGridPagination';
import { useOGridSorting } from './useOGridSorting';
import { useOGridFilters } from './useOGridFilters';
import { useOGridDataFetching } from './useOGridDataFetching';
import { useLatestRef } from './useLatestRef';
import { useSideBarState } from './useSideBarState';
import type { SideBarProps } from '../components/SideBar';
import type {
  RowId,
  IOGridProps,
  IOGridDataGridProps,
  IOGridApi,
  IRowSelectionChangeEvent,
  IStatusBarProps,
  IColumnDefinition,
} from '../types';

const DEFAULT_PAGE_SIZE = 25;
const EMPTY_LOADING_OPTIONS: Record<string, boolean> = {};

/** Resolved column chooser placement. */
export type ColumnChooserPlacement = 'toolbar' | 'sidebar' | 'none';

/** Pagination state and handlers. */
export interface UseOGridPagination {
  page: number;
  pageSize: number;
  displayTotalCount: number;
  setPage: (p: number) => void;
  setPageSize: (size: number) => void;
  pageSizeOptions?: number[];
  entityLabelPlural: string;
}

/** Column chooser state and handlers. */
export interface UseOGridColumnChooser {
  columns: IColumnDefinition[];
  visibleColumns: Set<string>;
  onVisibilityChange: (columnKey: string, isVisible: boolean) => void;
  onSetVisibleColumns: (columns: Set<string>) => void;
  placement: ColumnChooserPlacement;
}

/** Layout / chrome configuration. */
export interface UseOGridLayout {
  toolbar: React.ReactNode;
  toolbarBelow: React.ReactNode;
  className?: string;
  emptyState?: { message?: React.ReactNode; render?: () => React.ReactNode };
  sideBarProps: SideBarProps | null;
}

/** Filter state. */
export interface UseOGridFilters {
  hasActiveFilters: boolean;
  setFilters: (f: import('../types').IFilters) => void;
}

export interface UseOGridResult<T> {
  dataGridProps: IOGridDataGridProps<T>;
  pagination: UseOGridPagination;
  columnChooser: UseOGridColumnChooser;
  layout: UseOGridLayout;
  filters: UseOGridFilters;
}

/**
 * Top-level orchestration hook for OGrid: manages pagination, sorting, filtering, column visibility, and sidebar.
 * Delegates to focused sub-hooks for each concern.
 * @param props - All OGrid props (columns, data, callbacks, feature flags).
 * @param ref - Forwarded ref for imperative API (refresh, export, applyColumnState).
 * @returns Grouped props for DataGridTable, pagination controls, column chooser, layout, and filters.
 */
export function useOGrid<T>(
  props: IOGridProps<T>,
  ref: React.Ref<IOGridApi<T>>
): UseOGridResult<T> {
  const {
    columns: columnsProp,
    getRowId,
    data,
    dataSource,
    page: controlledPage,
    pageSize: controlledPageSize,
    sort: controlledSort,
    filters: controlledFilters,
    visibleColumns: controlledVisibleColumns,
    isLoading: controlledLoading,
    onPageChange,
    onPageSizeChange,
    onSortChange,
    onFiltersChange,
    onVisibleColumnsChange,
    columnOrder,
    onColumnOrderChange,
    onColumnResized,
    onColumnPinned,
    defaultPageSize = DEFAULT_PAGE_SIZE,
    defaultSortBy,
    defaultSortDirection = 'asc',
    toolbar,
    toolbarBelow,
    emptyState,
    entityLabelPlural = 'items',
    className,
    layoutMode = 'fill',
    suppressHorizontalScroll,
    editable,
    cellSelection,
    onCellValueChanged,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
    rowSelection = 'none',
    selectedRows,
    onSelectionChange,
    showRowNumbers,
    statusBar,
    pageSizeOptions,
    sideBar,
    onFirstDataRendered,
    onError,
    columnChooser: columnChooserProp,
    columnReorder,
    virtualScroll,
    rowHeight,
    density = 'normal',
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
  } = props;

  // --- Derived column state ---
  const columnChooserPlacement: ColumnChooserPlacement =
    columnChooserProp === false ? 'none'
    : columnChooserProp === 'sidebar' ? 'sidebar'
    : 'toolbar';

  const columns = useMemo(() => flattenColumns(columnsProp), [columnsProp]);
  const isServerSide = dataSource != null;

  // --- Runtime validation (dev-only, runs once on mount) ---
  const rowIdsValidatedRef = useRef(false);
  useEffect(() => {
    validateColumns(columns as Parameters<typeof validateColumns>[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — run once at mount
  const defaultSortField = defaultSortBy ?? columns[0]?.columnId ?? '';

  // --- Internal data state (for imperative setRowData/setLoading API) ---
  const [internalData, setInternalData] = useState<T[]>([]);
  const [internalLoading, setInternalLoading] = useState(false);
  const displayData = data ?? internalData;
  const displayLoading = controlledLoading ?? internalLoading;

  // --- Sub-hooks ---
  const paginationState = useOGridPagination({
    controlledPage, controlledPageSize, defaultPageSize,
    onPageChange, onPageSizeChange,
  });

  const sortingState = useOGridSorting({
    controlledSort, defaultSortField, defaultSortDirection,
    onSortChange, setPage: paginationState.setPage,
  });

  const filtersState = useOGridFilters({
    controlledFilters, onFiltersChange,
    setPage: paginationState.setPage,
    columns, displayData, dataSource,
  });

  const dataFetchingState = useOGridDataFetching({
    isServerSide, dataSource, displayData, columns,
    stableFilters: filtersState.stableFilters,
    filters: filtersState.filters,
    sort: sortingState.sort,
    page: paginationState.page,
    pageSize: paginationState.pageSize,
    onError, onFirstDataRendered,
  });

  // Validate row IDs once on first data render
  useEffect(() => {
    const items = dataFetchingState.displayItems;
    if (!rowIdsValidatedRef.current && items.length > 0) {
      rowIdsValidatedRef.current = true;
      validateRowIds(items, getRowId as (item: T) => import('@alaarab/ogrid-core').RowId);
    }
  }, [dataFetchingState.displayItems, getRowId]);

  // --- Column visibility ---
  const [internalVisibleColumns, setInternalVisibleColumns] = useState<Set<string>>(
    () => {
      const visible = columns
        .filter((c) => c.defaultVisible !== false)
        .map((c) => c.columnId);
      return new Set(
        visible.length > 0 ? visible : columns.map((c) => c.columnId)
      );
    }
  );

  const visibleColumns = controlledVisibleColumns ?? internalVisibleColumns;

  const setVisibleColumns = useCallback(
    (cols: Set<string>) => {
      if (controlledVisibleColumns === undefined) setInternalVisibleColumns(cols);
      onVisibleColumnsChange?.(cols);
    },
    [controlledVisibleColumns, onVisibleColumnsChange]
  );

  const handleVisibilityChange = useCallback(
    (columnKey: string, isVisible: boolean) => {
      const next = new Set(visibleColumns);
      if (isVisible) next.add(columnKey);
      else next.delete(columnKey);
      setVisibleColumns(next);
    },
    [visibleColumns, setVisibleColumns]
  );

  // --- Row selection ---
  const [internalSelectedRows, setInternalSelectedRows] = useState<Set<RowId>>(new Set());
  const effectiveSelectedRows = selectedRows ?? internalSelectedRows;

  const handleSelectionChange = useCallback(
    (event: IRowSelectionChangeEvent<T>) => {
      if (selectedRows === undefined) {
        setInternalSelectedRows(new Set(event.selectedRowIds));
      }
      onSelectionChange?.(event);
    },
    [selectedRows, onSelectionChange]
  );

  // --- Column resize & pin ---
  const [columnWidthOverrides, setColumnWidthOverrides] = useState<Record<string, number>>({});
  const [pinnedOverrides, setPinnedOverrides] = useState<Record<string, 'left' | 'right'>>({});

  const handleColumnResized = useCallback(
    (columnId: string, width: number) => {
      setColumnWidthOverrides((prev) => ({ ...prev, [columnId]: width }));
      onColumnResized?.(columnId, width);
    },
    [onColumnResized]
  );

  const handleColumnPinned = useCallback(
    (columnId: string, pinned: 'left' | 'right' | null) => {
      setPinnedOverrides((prev) => {
        if (pinned === null) {
          const { [columnId]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [columnId]: pinned };
      });
      onColumnPinned?.(columnId, pinned);
    },
    [onColumnPinned]
  );

  // --- Imperative handle (stabilized via refs to avoid invalidation on every state change) ---
  const visibleColumnsRef = useLatestRef(visibleColumns);
  const sortRef = useLatestRef(sortingState.sort);
  const columnOrderRef = useLatestRef(columnOrder);
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
        if (state.columnOrder && onColumnOrderChange) onColumnOrderChange(state.columnOrder);
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
        onColumnOrderChange?.(order);
      },
      scrollToRow: () => {
        // No-op at orchestration level — DataGridTable components implement
        // this via useVirtualScroll.scrollToIndex when virtual scrolling is active.
      },
    }),
    [
      isServerSide, setVisibleColumns, sortingState, filtersState,
      onColumnOrderChange, selectedRows, onSelectionChange, dataFetchingState,
      columnOrderRef, columnWidthOverridesRef, columnsRef, displayItemsRef,
      effectiveSelectedRowsRef, filtersRef, getRowIdRef, pinnedOverridesRef,
      sortRef, visibleColumnsRef,
    ]
  );

  // --- Status bar ---
  const statusBarConfig = useMemo((): IStatusBarProps | undefined => {
    if (!statusBar) return undefined;
    if (typeof statusBar === 'object') return statusBar;
    const totalData = !isServerSide ? (data?.length ?? 0) : dataFetchingState.displayTotalCount;
    const filteredData = dataFetchingState.displayTotalCount;
    return {
      totalCount: totalData,
      filteredCount: filtersState.hasActiveFilters ? filteredData : undefined,
      selectedCount: effectiveSelectedRows.size,
      suppressRowCount: true,
    };
  }, [statusBar, isServerSide, data, dataFetchingState.displayTotalCount, filtersState.hasActiveFilters, effectiveSelectedRows.size]);

  // --- Side bar ---
  const sideBarState = useSideBarState({ config: sideBar });

  const columnChooserColumns: IColumnDefinition[] = useMemo(
    () => columns.map((c) => ({ columnId: c.columnId, name: c.name, required: c.required === true })),
    [columns]
  );

  const filterableColumns = useMemo(
    () =>
      columns
        .filter((c) => c.filterable && c.filterable.type)
        .map((c) => ({
          columnId: c.columnId,
          name: c.name,
          filterField: c.filterable?.filterField ?? c.columnId,
          filterType: c.filterable?.type as 'text' | 'multiSelect' | 'people' | 'date',
        })),
    [columns]
  );

  const sideBarProps: SideBarProps | null = useMemo(() => {
    if (!sideBarState.isEnabled) return null;
    return {
      activePanel: sideBarState.activePanel,
      onPanelChange: sideBarState.setActivePanel,
      panels: sideBarState.panels,
      position: sideBarState.position,
      columns: columnChooserColumns,
      visibleColumns,
      onVisibilityChange: handleVisibilityChange,
      onSetVisibleColumns: setVisibleColumns,
      filterableColumns,
      filters: filtersState.filters,
      onFilterChange: filtersState.handleFilterChange,
      filterOptions: filtersState.clientFilterOptions,
    };
  }, [
    sideBarState.isEnabled, sideBarState.activePanel, sideBarState.setActivePanel,
    sideBarState.panels, sideBarState.position,
    columnChooserColumns, visibleColumns, handleVisibilityChange, setVisibleColumns,
    filterableColumns, filtersState.filters, filtersState.handleFilterChange, filtersState.clientFilterOptions,
  ]);

  // --- Assembly ---
  const clearAllFilters = useCallback(() => filtersState.setFilters({}), [filtersState]);
  const isLoadingResolved = (isServerSide && dataFetchingState.serverLoading) || displayLoading;

  const dataGridProps = useMemo<IOGridDataGridProps<T>>(() => ({
    items: dataFetchingState.displayItems,
    columns: columnsProp,
    getRowId,
    sortBy: sortingState.sort.field,
    sortDirection: sortingState.sort.direction,
    onColumnSort: sortingState.handleSort,
    visibleColumns,
    columnOrder,
    onColumnOrderChange,
    onColumnResized: handleColumnResized,
    onColumnPinned: handleColumnPinned,
    pinnedColumns: pinnedOverrides,
    initialColumnWidths: columnWidthOverrides,
    editable,
    cellSelection,
    onCellValueChanged,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
    rowSelection,
    selectedRows: effectiveSelectedRows,
    onSelectionChange: handleSelectionChange,
    showRowNumbers,
    currentPage: paginationState.page,
    pageSize: paginationState.pageSize,
    statusBar: statusBarConfig,
    isLoading: isLoadingResolved,
    filters: filtersState.filters,
    onFilterChange: filtersState.handleFilterChange,
    filterOptions: filtersState.clientFilterOptions,
    loadingFilterOptions: dataSource?.fetchFilterOptions ? filtersState.loadingFilterOptions : EMPTY_LOADING_OPTIONS,
    peopleSearch: dataSource?.searchPeople,
    getUserByEmail: dataSource?.getUserByEmail,
    layoutMode,
    suppressHorizontalScroll,
    columnReorder,
    virtualScroll,
    rowHeight,
    density,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    emptyState: {
      hasActiveFilters: filtersState.hasActiveFilters,
      onClearAll: clearAllFilters,
      message: emptyState?.message,
      render: emptyState?.render,
    },
  }), [
    dataFetchingState.displayItems, columnsProp, getRowId,
    sortingState.sort.field, sortingState.sort.direction, sortingState.handleSort,
    visibleColumns, columnOrder, onColumnOrderChange, handleColumnResized,
    handleColumnPinned, pinnedOverrides, columnWidthOverrides,
    editable, cellSelection, onCellValueChanged, onUndo, onRedo, canUndo, canRedo,
    rowSelection, effectiveSelectedRows, handleSelectionChange, showRowNumbers,
    paginationState.page, paginationState.pageSize, statusBarConfig,
    isLoadingResolved, filtersState.filters, filtersState.handleFilterChange,
    filtersState.clientFilterOptions, dataSource, filtersState.loadingFilterOptions,
    layoutMode, suppressHorizontalScroll, columnReorder, virtualScroll,
    rowHeight, density, ariaLabel, ariaLabelledBy,
    filtersState.hasActiveFilters, clearAllFilters, emptyState,
  ]);

  const pagination = useMemo<UseOGridPagination>(() => ({
    page: paginationState.page,
    pageSize: paginationState.pageSize,
    displayTotalCount: dataFetchingState.displayTotalCount,
    setPage: paginationState.setPage,
    setPageSize: paginationState.setPageSize,
    pageSizeOptions,
    entityLabelPlural,
  }), [paginationState.page, paginationState.pageSize, dataFetchingState.displayTotalCount, paginationState.setPage, paginationState.setPageSize, pageSizeOptions, entityLabelPlural]);

  const columnChooser = useMemo<UseOGridColumnChooser>(() => ({
    columns: columnChooserColumns,
    visibleColumns,
    onVisibilityChange: handleVisibilityChange,
    onSetVisibleColumns: setVisibleColumns,
    placement: columnChooserPlacement,
  }), [columnChooserColumns, visibleColumns, handleVisibilityChange, setVisibleColumns, columnChooserPlacement]);

  const layout = useMemo<UseOGridLayout>(() => ({
    toolbar,
    toolbarBelow,
    className,
    emptyState,
    sideBarProps,
  }), [toolbar, toolbarBelow, className, emptyState, sideBarProps]);

  const filtersResult = useMemo<UseOGridFilters>(() => ({
    hasActiveFilters: filtersState.hasActiveFilters,
    setFilters: filtersState.setFilters,
  }), [filtersState.hasActiveFilters, filtersState.setFilters]);

  return {
    dataGridProps,
    pagination,
    columnChooser,
    layout,
    filters: filtersResult,
  };
}
