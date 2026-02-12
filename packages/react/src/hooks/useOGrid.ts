import * as React from 'react';
import {
  useMemo,
  useCallback,
  useState,
  useEffect,
  useRef,
  useImperativeHandle,
} from 'react';
import {
  mergeFilter,
  deriveFilterOptionsFromData,
  getMultiSelectFilterFields,
  flattenColumns,
  processClientSideData,
} from '../utils';
import { useFilterOptions } from './useFilterOptions';
import { useSideBarState } from './useSideBarState';
import type { SideBarProps } from '../components/SideBar';
import type {
  RowId,
  IOGridProps,
  IOGridDataGridProps,
  IOGridApi,
  IFilters,
  FilterValue,
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
  setFilters: (f: IFilters) => void;
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
    freezeRows,
    freezeCols,
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
    statusBar,
    pageSizeOptions,
    sideBar,
    onFirstDataRendered,
    onError,
    columnChooser: columnChooserProp,
    columnReorder,
    virtualScroll,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
  } = props;

  // Resolve column chooser placement
  const columnChooserPlacement: ColumnChooserPlacement =
    columnChooserProp === false ? 'none'
    : columnChooserProp === 'sidebar' ? 'sidebar'
    : 'toolbar';

  const columns = useMemo(() => flattenColumns(columnsProp), [columnsProp]);
  const isServerSide = dataSource != null;
  const isClientSide = !isServerSide;

  const [internalData, setInternalData] = useState<T[]>([]);
  const [internalLoading, setInternalLoading] = useState(false);

  const displayData = data ?? internalData;
  const displayLoading = controlledLoading ?? internalLoading;

  const defaultSortField = defaultSortBy ?? columns[0]?.columnId ?? '';

  const [internalPage, setInternalPage] = useState(1);
  const [internalPageSize, setInternalPageSize] = useState(defaultPageSize);
  const [internalSort, setInternalSort] = useState<{
    field: string;
    direction: 'asc' | 'desc';
  }>({
    field: defaultSortField,
    direction: defaultSortDirection,
  });
  const [internalFilters, setInternalFilters] = useState<IFilters>({});
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

  const [columnWidthOverrides, setColumnWidthOverrides] = useState<Record<string, number>>({});
  const [pinnedOverrides, setPinnedOverrides] = useState<Record<string, 'left' | 'right'>>({});

  const page = controlledPage ?? internalPage;
  const pageSize = controlledPageSize ?? internalPageSize;
  const sort = controlledSort ?? internalSort;
  const filters = controlledFilters ?? internalFilters;
  const visibleColumns = controlledVisibleColumns ?? internalVisibleColumns;

  const setPage = useCallback(
    (p: number) => {
      if (controlledPage === undefined) setInternalPage(p);
      onPageChange?.(p);
    },
    [controlledPage, onPageChange]
  );

  const setPageSize = useCallback(
    (size: number) => {
      if (controlledPageSize === undefined) setInternalPageSize(size);
      onPageSizeChange?.(size);
      setPage(1);
    },
    [controlledPageSize, onPageSizeChange, setPage]
  );

  const setSort = useCallback(
    (s: { field: string; direction: 'asc' | 'desc' }) => {
      if (controlledSort === undefined) setInternalSort(s);
      onSortChange?.(s);
      setPage(1);
    },
    [controlledSort, onSortChange, setPage]
  );

  const setFilters = useCallback(
    (f: IFilters) => {
      if (controlledFilters === undefined) setInternalFilters(f);
      onFiltersChange?.(f);
      setPage(1);
    },
    [controlledFilters, onFiltersChange, setPage]
  );

  const setVisibleColumns = useCallback(
    (cols: Set<string>) => {
      if (controlledVisibleColumns === undefined) setInternalVisibleColumns(cols);
      onVisibleColumnsChange?.(cols);
    },
    [controlledVisibleColumns, onVisibleColumnsChange]
  );

  const handleSort = useCallback(
    (columnKey: string) => {
      setSort({
        field: columnKey,
        direction:
          sort.field === columnKey && sort.direction === 'asc' ? 'desc' : 'asc',
      });
    },
    [sort, setSort]
  );

  /** Single filter change handler — wraps discriminated FilterValue into mergeFilter. */
  const handleFilterChange = useCallback(
    (key: string, value: FilterValue | undefined) => {
      setFilters(mergeFilter(filters, key, value));
    },
    [filters, setFilters]
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

  const [internalSelectedRows, setInternalSelectedRows] = useState<Set<RowId>>(
    new Set()
  );
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

  const multiSelectFilterFields = useMemo(
    () => getMultiSelectFilterFields(columns),
    [columns]
  );

  const filterOptionsSource = useMemo(
    () => dataSource ?? { fetchFilterOptions: undefined },
    [dataSource]
  );

  const { filterOptions: serverFilterOptions, loadingOptions: loadingFilterOptions } =
    useFilterOptions(filterOptionsSource, multiSelectFilterFields);

  const hasServerFilterOptions = dataSource?.fetchFilterOptions != null;
  const clientFilterOptions = useMemo(() => {
    if (hasServerFilterOptions)
      return serverFilterOptions;
    return deriveFilterOptionsFromData(displayData, columns);
  }, [hasServerFilterOptions, displayData, columns, serverFilterOptions]);

  // --- Client-side filtering & sorting ---
  const clientItemsAndTotal = useMemo(() => {
    if (!isClientSide) return null;
    const rows = processClientSideData(
      displayData,
      columns,
      filters,
      sort.field,
      sort.direction
    );
    const total = rows.length;
    const start = (page - 1) * pageSize;
    const paged = rows.slice(start, start + pageSize);
    return { items: paged, totalCount: total };
  }, [
    isClientSide,
    displayData,
    columns,
    filters,
    sort.field,
    sort.direction,
    page,
    pageSize,
  ]);

  const [serverItems, setServerItems] = useState<T[]>([]);
  const [serverTotalCount, setServerTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const fetchIdRef = useRef(0);

  // Ref counter to trigger server-side re-fetches
  const refreshCounterRef = useRef(0);
  const [refreshCounter, setRefreshCounter] = useState(0);

  useEffect(() => {
    if (!isServerSide || !dataSource) {
      if (!isServerSide) setLoading(false);
      return;
    }
    const id = ++fetchIdRef.current;
    setLoading(true);
    dataSource
      .fetchPage({
        page,
        pageSize,
        sort: { field: sort.field, direction: sort.direction },
        filters,
      })
      .then((res) => {
        if (id !== fetchIdRef.current) return;
        setServerItems(res.items);
        setServerTotalCount(res.totalCount);
      })
      .catch((err) => {
        if (id !== fetchIdRef.current) return;
        onError?.(err);
        setServerItems([]);
        setServerTotalCount(0);
      })
      .finally(() => {
        if (id === fetchIdRef.current) setLoading(false);
      });
  }, [
    isServerSide,
    dataSource,
    page,
    pageSize,
    sort.field,
    sort.direction,
    filters,
    onError,
    refreshCounter,
  ]);

  const displayItems =
    isClientSide && clientItemsAndTotal
      ? clientItemsAndTotal.items
      : serverItems;
  const displayTotalCount =
    isClientSide && clientItemsAndTotal
      ? clientItemsAndTotal.totalCount
      : serverTotalCount;

  // Fire onFirstDataRendered once when the grid first has data
  const firstDataRenderedRef = useRef(false);
  useEffect(() => {
    if (!firstDataRenderedRef.current && displayItems.length > 0) {
      firstDataRenderedRef.current = true;
      onFirstDataRendered?.();
    }
  }, [displayItems.length, onFirstDataRendered]);

  useImperativeHandle(
    ref,
    () => ({
      setRowData: (d: T[]) => {
        if (!isServerSide) setInternalData(d);
      },
      setLoading: setInternalLoading,
      getColumnState: () => ({
        visibleColumns: Array.from(visibleColumns),
        sort,
        columnOrder: columnOrder ?? undefined,
        columnWidths: Object.keys(columnWidthOverrides).length > 0 ? columnWidthOverrides : undefined,
        filters: Object.keys(filters).length > 0 ? filters : undefined,
        pinnedColumns: Object.keys(pinnedOverrides).length > 0 ? pinnedOverrides : undefined,
      }),
      applyColumnState: (state: Partial<import('../types').IGridColumnState>) => {
        if (state.visibleColumns) {
          setVisibleColumns(new Set(state.visibleColumns));
        }
        if (state.sort) {
          setSort(state.sort);
        }
        if (state.columnOrder && onColumnOrderChange) {
          onColumnOrderChange(state.columnOrder);
        }
        if (state.columnWidths) {
          setColumnWidthOverrides(state.columnWidths);
        }
        if (state.filters) {
          setFilters(state.filters);
        }
        if (state.pinnedColumns) {
          setPinnedOverrides(state.pinnedColumns);
        }
      },
      setFilterModel: setFilters,
      getSelectedRows: () => Array.from(effectiveSelectedRows),
      setSelectedRows: (rowIds: RowId[]) => {
        if (selectedRows === undefined) setInternalSelectedRows(new Set(rowIds));
      },
      selectAll: () => {
        const allIds = new Set(displayItems.map((item) => getRowId(item)));
        if (selectedRows === undefined) setInternalSelectedRows(allIds);
        onSelectionChange?.({
          selectedRowIds: Array.from(allIds),
          selectedItems: displayItems,
        });
      },
      deselectAll: () => {
        if (selectedRows === undefined) setInternalSelectedRows(new Set());
        onSelectionChange?.({
          selectedRowIds: [],
          selectedItems: [],
        });
      },
      clearFilters: () => setFilters({}),
      clearSort: () => setSort({ field: defaultSortField, direction: defaultSortDirection }),
      resetGridState: (options?: { keepSelection?: boolean }) => {
        setFilters({});
        setSort({ field: defaultSortField, direction: defaultSortDirection });
        if (!options?.keepSelection) {
          if (selectedRows === undefined) setInternalSelectedRows(new Set());
          onSelectionChange?.({ selectedRowIds: [], selectedItems: [] });
        }
      },
      getDisplayedRows: () => displayItems,
      refreshData: () => {
        if (isServerSide) {
          refreshCounterRef.current += 1;
          setRefreshCounter(refreshCounterRef.current);
        }
      },
      getColumnOrder: () => columnOrder ?? columns.map((c) => c.columnId),
      setColumnOrder: (order: string[]) => {
        onColumnOrderChange?.(order);
      },
      scrollToRow: () => {
        // No-op at orchestration level — DataGridTable components implement
        // this via useVirtualScroll.scrollToIndex when virtual scrolling is active.
      },
    }),
    [
      visibleColumns,
      sort,
      columnOrder,
      columnWidthOverrides,
      pinnedOverrides,
      filters,
      setFilters,
      setSort,
      setVisibleColumns,
      onColumnOrderChange,
      isServerSide,
      effectiveSelectedRows,
      selectedRows,
      displayItems,
      getRowId,
      onSelectionChange,
      defaultSortField,
      defaultSortDirection,
    ]
  );

  // With discriminated union, any defined value is active (mergeFilter already strips empties)
  const hasActiveFilters = useMemo(() => {
    return Object.values(filters).some((v) => v !== undefined);
  }, [filters]);

  const columnChooserColumns: IColumnDefinition[] = useMemo(
    () =>
      columns.map((c) => ({
        columnId: c.columnId,
        name: c.name,
        required: c.required === true,
      })),
    [columns]
  );

  const statusBarConfig = useMemo((): IStatusBarProps | undefined => {
    if (!statusBar) return undefined;
    if (typeof statusBar === 'object') return statusBar;
    const totalData = isClientSide ? (data?.length ?? 0) : serverTotalCount;
    const filteredData = displayTotalCount;
    return {
      totalCount: totalData,
      filteredCount: hasActiveFilters ? filteredData : undefined,
      selectedCount: effectiveSelectedRows.size,
      suppressRowCount: true, // OGrid always has pagination which shows the total
    };
  }, [
    statusBar,
    isClientSide,
    data,
    serverTotalCount,
    displayTotalCount,
    hasActiveFilters,
    effectiveSelectedRows.size,
  ]);

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
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [columnId]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [columnId]: pinned };
      });
      onColumnPinned?.(columnId, pinned);
    },
    [onColumnPinned]
  );

  // --- Side bar ---
  const sideBarState = useSideBarState({ config: sideBar });

  const filterableColumns = useMemo(
    () =>
      columns
        .filter((c) => c.filterable && c.filterable.type)
        .map((c) => ({
          columnId: c.columnId,
          name: c.name,
          filterField: c.filterable!.filterField ?? c.columnId,
          filterType: c.filterable!.type as 'text' | 'multiSelect' | 'people' | 'date',
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
      filters,
      onFilterChange: handleFilterChange,
      filterOptions: clientFilterOptions,
    };
  }, [
    sideBarState.isEnabled,
    sideBarState.activePanel,
    sideBarState.setActivePanel,
    sideBarState.panels,
    sideBarState.position,
    columnChooserColumns,
    visibleColumns,
    handleVisibilityChange,
    setVisibleColumns,
    filterableColumns,
    filters,
    handleFilterChange,
    clientFilterOptions,
  ]);

  const clearAllFilters = useCallback(() => setFilters({}), [setFilters]);
  const isLoadingResolved = (isServerSide && loading) || displayLoading;

  const dataGridProps = useMemo<IOGridDataGridProps<T>>(() => ({
    items: displayItems,
    columns: columnsProp,
    getRowId,
    sortBy: sort.field,
    sortDirection: sort.direction,
    onColumnSort: handleSort,
    visibleColumns,
    columnOrder,
    onColumnOrderChange,
    onColumnResized: handleColumnResized,
    onColumnPinned: handleColumnPinned,
    pinnedColumns: pinnedOverrides,
    initialColumnWidths: columnWidthOverrides,
    freezeRows,
    freezeCols,
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
    statusBar: statusBarConfig,
    isLoading: isLoadingResolved,
    filters,
    onFilterChange: handleFilterChange,
    filterOptions: clientFilterOptions,
    loadingFilterOptions: dataSource?.fetchFilterOptions ? loadingFilterOptions : EMPTY_LOADING_OPTIONS,
    peopleSearch: dataSource?.searchPeople,
    getUserByEmail: dataSource?.getUserByEmail,
    layoutMode,
    suppressHorizontalScroll,
    columnReorder,
    virtualScroll,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    emptyState: {
      hasActiveFilters,
      onClearAll: clearAllFilters,
      message: emptyState?.message,
      render: emptyState?.render,
    },
  }), [
    displayItems, columnsProp, getRowId, sort.field, sort.direction, handleSort,
    visibleColumns, columnOrder, onColumnOrderChange, handleColumnResized,
    handleColumnPinned, pinnedOverrides, columnWidthOverrides, freezeRows, freezeCols,
    editable, cellSelection, onCellValueChanged, onUndo, onRedo, canUndo, canRedo,
    rowSelection, effectiveSelectedRows, handleSelectionChange, statusBarConfig,
    isLoadingResolved, filters, handleFilterChange, clientFilterOptions, dataSource,
    loadingFilterOptions, layoutMode, suppressHorizontalScroll, columnReorder, virtualScroll,
    ariaLabel, ariaLabelledBy,
    hasActiveFilters, clearAllFilters, emptyState,
  ]);

  const pagination = useMemo<UseOGridPagination>(() => ({
    page,
    pageSize,
    displayTotalCount,
    setPage,
    setPageSize,
    pageSizeOptions,
    entityLabelPlural,
  }), [page, pageSize, displayTotalCount, setPage, setPageSize, pageSizeOptions, entityLabelPlural]);

  const columnChooser = useMemo<UseOGridColumnChooser>(() => ({
    columns: columnChooserColumns,
    visibleColumns,
    onVisibilityChange: handleVisibilityChange,
    placement: columnChooserPlacement,
  }), [columnChooserColumns, visibleColumns, handleVisibilityChange, columnChooserPlacement]);

  const layout = useMemo<UseOGridLayout>(() => ({
    toolbar,
    toolbarBelow,
    className,
    emptyState,
    sideBarProps,
  }), [toolbar, toolbarBelow, className, emptyState, sideBarProps]);

  const filtersResult = useMemo<UseOGridFilters>(() => ({
    hasActiveFilters,
    setFilters,
  }), [hasActiveFilters, setFilters]);

  return {
    dataGridProps,
    pagination,
    columnChooser,
    layout,
    filters: filtersResult,
  };
}
