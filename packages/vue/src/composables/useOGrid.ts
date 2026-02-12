import { ref, computed, watch, type Ref } from 'vue';
import {
  mergeFilter,
  deriveFilterOptionsFromData,
  getMultiSelectFilterFields,
  flattenColumns,
  processClientSideData,
} from '@alaarab/ogrid-core';
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
  IGridColumnState,
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
  toolbar: unknown;
  toolbarBelow: unknown;
  className?: string;
  emptyState?: { message?: unknown; render?: () => unknown };
  sideBarProps: SideBarProps | null;
}

/** Filter state. */
export interface UseOGridFilters {
  hasActiveFilters: boolean;
  setFilters: (f: IFilters) => void;
}

export interface UseOGridResult<T> {
  dataGridProps: Ref<IOGridDataGridProps<T>>;
  pagination: Ref<UseOGridPagination>;
  columnChooser: Ref<UseOGridColumnChooser>;
  layout: Ref<UseOGridLayout>;
  filters: Ref<UseOGridFilters>;
  /** Imperative API object for programmatic grid control. */
  api: Ref<IOGridApi<T>>;
}

/**
 * Top-level orchestration composable for OGrid: manages pagination, sorting, filtering,
 * column visibility, and sidebar.
 */
export function useOGrid<T>(
  props: Ref<IOGridProps<T>>
): UseOGridResult<T> {
  // --- Destructure props reactively ---
  const columnsProp = computed(() => props.value.columns);
  const getRowId = computed(() => props.value.getRowId);
  const data = computed(() => ('data' in props.value ? props.value.data : undefined) as T[] | undefined);
  const dataSource = computed(() => ('dataSource' in props.value ? props.value.dataSource : undefined));
  const controlledPage = computed(() => props.value.page);
  const controlledPageSize = computed(() => props.value.pageSize);
  const controlledSort = computed(() => props.value.sort);
  const controlledFilters = computed(() => props.value.filters);
  const controlledVisibleColumns = computed(() => props.value.visibleColumns);
  const controlledLoading = computed(() => props.value.isLoading);
  const onPageChange = computed(() => props.value.onPageChange);
  const onPageSizeChange = computed(() => props.value.onPageSizeChange);
  const onSortChange = computed(() => props.value.onSortChange);
  const onFiltersChange = computed(() => props.value.onFiltersChange);
  const onVisibleColumnsChange = computed(() => props.value.onVisibleColumnsChange);
  const columnOrder = computed(() => props.value.columnOrder);
  const onColumnOrderChange = computed(() => props.value.onColumnOrderChange);
  const onColumnResized = computed(() => props.value.onColumnResized);
  const onColumnPinned = computed(() => props.value.onColumnPinned);
  const defaultPageSize = computed(() => props.value.defaultPageSize ?? DEFAULT_PAGE_SIZE);
  const defaultSortBy = computed(() => props.value.defaultSortBy);
  const defaultSortDirection = computed(() => props.value.defaultSortDirection ?? 'asc');
  const entityLabelPlural = computed(() => props.value.entityLabelPlural ?? 'items');
  const columnChooserProp = computed(() => props.value.columnChooser);
  const onFirstDataRendered = computed(() => props.value.onFirstDataRendered);
  const onError = computed(() => props.value.onError);

  // Resolve column chooser placement
  const columnChooserPlacement = computed<ColumnChooserPlacement>(() =>
    columnChooserProp.value === false ? 'none'
    : columnChooserProp.value === 'sidebar' ? 'sidebar'
    : 'toolbar'
  );

  const columns = computed(() => flattenColumns(columnsProp.value));
  const isServerSide = computed(() => dataSource.value != null);
  const isClientSide = computed(() => !isServerSide.value);

  const internalData = ref<T[]>([]) as Ref<T[]>;
  const internalLoading = ref(false);

  const displayData = computed(() => data.value ?? internalData.value);
  const displayLoading = computed(() => controlledLoading.value ?? internalLoading.value);

  const defaultSortField = computed(() => defaultSortBy.value ?? columns.value[0]?.columnId ?? '');

  const internalPage = ref(1);
  const internalPageSize = ref(defaultPageSize.value);
  const internalSort = ref<{ field: string; direction: 'asc' | 'desc' }>({
    field: defaultSortField.value,
    direction: defaultSortDirection.value,
  });
  const internalFilters = ref<IFilters>({});
  const internalVisibleColumns = ref<Set<string>>((() => {
    const visible = columns.value
      .filter((c) => c.defaultVisible !== false)
      .map((c) => c.columnId);
    return new Set(visible.length > 0 ? visible : columns.value.map((c) => c.columnId));
  })()) as Ref<Set<string>>;

  const columnWidthOverrides = ref<Record<string, number>>({});
  const pinnedOverrides = ref<Record<string, 'left' | 'right'>>({});

  const page = computed(() => controlledPage.value ?? internalPage.value);
  const pageSize = computed(() => controlledPageSize.value ?? internalPageSize.value);
  const sort = computed(() => controlledSort.value ?? internalSort.value);
  const filters = computed(() => controlledFilters.value ?? internalFilters.value);
  const visibleColumns = computed(() => controlledVisibleColumns.value ?? internalVisibleColumns.value);

  const setPage = (p: number) => {
    if (controlledPage.value === undefined) internalPage.value = p;
    onPageChange.value?.(p);
  };

  const setPageSize = (size: number) => {
    if (controlledPageSize.value === undefined) internalPageSize.value = size;
    onPageSizeChange.value?.(size);
    setPage(1);
  };

  const setSort = (s: { field: string; direction: 'asc' | 'desc' }) => {
    if (controlledSort.value === undefined) internalSort.value = s;
    onSortChange.value?.(s);
    setPage(1);
  };

  const setFilters = (f: IFilters) => {
    if (controlledFilters.value === undefined) internalFilters.value = f;
    onFiltersChange.value?.(f);
    setPage(1);
  };

  const setVisibleColumns = (cols: Set<string>) => {
    if (controlledVisibleColumns.value === undefined) internalVisibleColumns.value = cols;
    onVisibleColumnsChange.value?.(cols);
  };

  const handleSort = (columnKey: string) => {
    setSort({
      field: columnKey,
      direction: sort.value.field === columnKey && sort.value.direction === 'asc' ? 'desc' : 'asc',
    });
  };

  const handleFilterChange = (key: string, value: FilterValue | undefined) => {
    setFilters(mergeFilter(filters.value, key, value));
  };

  const handleVisibilityChange = (columnKey: string, isVisible: boolean) => {
    const next = new Set(visibleColumns.value);
    if (isVisible) next.add(columnKey);
    else next.delete(columnKey);
    setVisibleColumns(next);
  };

  const internalSelectedRows = ref<Set<RowId>>(new Set()) as Ref<Set<RowId>>;
  const selectedRowsProp = computed(() => props.value.selectedRows);
  const effectiveSelectedRows = computed(() => selectedRowsProp.value ?? internalSelectedRows.value);

  const handleSelectionChange = (event: IRowSelectionChangeEvent<T>) => {
    if (selectedRowsProp.value === undefined) {
      internalSelectedRows.value = new Set(event.selectedRowIds);
    }
    props.value.onSelectionChange?.(event);
  };

  const multiSelectFilterFields = computed(() => getMultiSelectFilterFields(columns.value));

  const filterOptionsSource = computed(() => dataSource.value ?? { fetchFilterOptions: undefined });

  const { filterOptions: serverFilterOptions, loadingOptions: loadingFilterOptions } =
    useFilterOptions(filterOptionsSource, multiSelectFilterFields);

  const hasServerFilterOptions = computed(() => dataSource.value?.fetchFilterOptions != null);
  const clientFilterOptions = computed(() => {
    if (hasServerFilterOptions.value) return serverFilterOptions.value;
    return deriveFilterOptionsFromData(displayData.value, columns.value);
  });

  // --- Client-side filtering & sorting ---
  const clientItemsAndTotal = computed(() => {
    if (!isClientSide.value) return null;
    const rows = processClientSideData(
      displayData.value,
      columns.value,
      filters.value,
      sort.value.field,
      sort.value.direction
    );
    const total = rows.length;
    const start = (page.value - 1) * pageSize.value;
    const paged = rows.slice(start, start + pageSize.value);
    return { items: paged, totalCount: total };
  });

  // --- Server-side fetching ---
  const serverItems = ref<T[]>([]) as Ref<T[]>;
  const serverTotalCount = ref(0);
  const loading = ref(true);
  let fetchId = 0;
  const refreshCounter = ref(0);

  watch(
    [isServerSide, dataSource, page, pageSize, () => sort.value.field, () => sort.value.direction, filters, refreshCounter],
    () => {
      if (!isServerSide.value || !dataSource.value) {
        if (!isServerSide.value) loading.value = false;
        return;
      }
      const id = ++fetchId;
      loading.value = true;
      dataSource.value
        .fetchPage({
          page: page.value,
          pageSize: pageSize.value,
          sort: { field: sort.value.field, direction: sort.value.direction },
          filters: filters.value,
        })
        .then((res) => {
          if (id !== fetchId) return;
          serverItems.value = res.items;
          serverTotalCount.value = res.totalCount;
        })
        .catch((err) => {
          if (id !== fetchId) return;
          onError.value?.(err);
          serverItems.value = [];
          serverTotalCount.value = 0;
        })
        .finally(() => {
          if (id === fetchId) loading.value = false;
        });
    },
    { immediate: true }
  );

  const displayItems = computed<T[]>(() =>
    isClientSide.value && clientItemsAndTotal.value
      ? clientItemsAndTotal.value.items
      : serverItems.value
  );
  const displayTotalCount = computed(() =>
    isClientSide.value && clientItemsAndTotal.value
      ? clientItemsAndTotal.value.totalCount
      : serverTotalCount.value
  );

  // Fire onFirstDataRendered once
  let firstDataRendered = false;
  watch(displayItems, (items) => {
    if (!firstDataRendered && items.length > 0) {
      firstDataRendered = true;
      onFirstDataRendered.value?.();
    }
  });

  // With discriminated union, any defined value is active
  const hasActiveFilters = computed(() => Object.values(filters.value).some((v) => v !== undefined));

  const columnChooserColumns = computed<IColumnDefinition[]>(() =>
    columns.value.map((c) => ({
      columnId: c.columnId,
      name: c.name,
      required: c.required === true,
    }))
  );

  const statusBarConfig = computed((): IStatusBarProps | undefined => {
    const sb = props.value.statusBar;
    if (!sb) return undefined;
    if (typeof sb === 'object') return sb;
    const totalData = isClientSide.value ? (data.value?.length ?? 0) : serverTotalCount.value;
    const filteredData = displayTotalCount.value;
    return {
      totalCount: totalData,
      filteredCount: hasActiveFilters.value ? filteredData : undefined,
      selectedCount: effectiveSelectedRows.value.size,
      suppressRowCount: true,
    };
  });

  const handleColumnResized = (columnId: string, width: number) => {
    columnWidthOverrides.value = { ...columnWidthOverrides.value, [columnId]: width };
    onColumnResized.value?.(columnId, width);
  };

  const handleColumnPinned = (columnId: string, pinned: 'left' | 'right' | null) => {
    if (pinned === null) {
      const { [columnId]: _, ...rest } = pinnedOverrides.value;
      pinnedOverrides.value = rest;
    } else {
      pinnedOverrides.value = { ...pinnedOverrides.value, [columnId]: pinned };
    }
    onColumnPinned.value?.(columnId, pinned);
  };

  // --- Side bar ---
  const sideBarState = useSideBarState({ config: props.value.sideBar });

  const filterableColumns = computed(() =>
    columns.value
      .filter((c) => c.filterable && c.filterable.type)
      .map((c) => ({
        columnId: c.columnId,
        name: c.name,
        filterField: c.filterable!.filterField ?? c.columnId,
        filterType: c.filterable!.type as 'text' | 'multiSelect' | 'people' | 'date',
      }))
  );

  const sideBarProps = computed<SideBarProps | null>(() => {
    if (!sideBarState.isEnabled) return null;
    // Re-read reactive deps so the computed tracks them, but use getters for
    // activePanel/isOpen so that a stored reference stays current after toggle/close.
    const _activePanel = sideBarState.activePanel.value;
    const _isOpen = sideBarState.isOpen.value;
    void _activePanel;
    void _isOpen;
    return {
      get activePanel() { return sideBarState.activePanel.value; },
      onPanelChange: sideBarState.setActivePanel,
      panels: sideBarState.panels,
      position: sideBarState.position,
      get isOpen() { return sideBarState.isOpen.value; },
      toggle: sideBarState.toggle,
      close: sideBarState.close,
      columns: columnChooserColumns.value,
      visibleColumns: visibleColumns.value,
      onVisibilityChange: handleVisibilityChange,
      onSetVisibleColumns: setVisibleColumns,
      filterableColumns: filterableColumns.value,
      filters: filters.value,
      onFilterChange: handleFilterChange,
      filterOptions: clientFilterOptions.value,
    };
  });

  const clearAllFilters = () => setFilters({});
  const isLoadingResolved = computed(() => (isServerSide.value && loading.value) || displayLoading.value);

  // --- Build result objects ---

  const dataGridProps = computed<IOGridDataGridProps<T>>(() => ({
    items: displayItems.value,
    columns: columnsProp.value,
    getRowId: getRowId.value,
    sortBy: sort.value.field,
    sortDirection: sort.value.direction,
    onColumnSort: handleSort,
    visibleColumns: visibleColumns.value,
    columnOrder: columnOrder.value,
    onColumnOrderChange: onColumnOrderChange.value,
    onColumnResized: handleColumnResized,
    onColumnPinned: handleColumnPinned,
    pinnedColumns: pinnedOverrides.value,
    initialColumnWidths: columnWidthOverrides.value,
    freezeRows: props.value.freezeRows,
    freezeCols: props.value.freezeCols,
    editable: props.value.editable,
    cellSelection: props.value.cellSelection,
    onCellValueChanged: props.value.onCellValueChanged,
    onUndo: props.value.onUndo,
    onRedo: props.value.onRedo,
    canUndo: props.value.canUndo,
    canRedo: props.value.canRedo,
    rowSelection: props.value.rowSelection ?? 'none',
    selectedRows: effectiveSelectedRows.value,
    onSelectionChange: handleSelectionChange,
    statusBar: statusBarConfig.value,
    isLoading: isLoadingResolved.value,
    filters: filters.value,
    onFilterChange: handleFilterChange,
    filterOptions: clientFilterOptions.value,
    loadingFilterOptions: dataSource.value?.fetchFilterOptions ? loadingFilterOptions.value : EMPTY_LOADING_OPTIONS,
    peopleSearch: dataSource.value?.searchPeople,
    getUserByEmail: dataSource.value?.getUserByEmail,
    layoutMode: props.value.layoutMode,
    suppressHorizontalScroll: props.value.suppressHorizontalScroll,
    virtualScroll: props.value.virtualScroll,
    'aria-label': props.value['aria-label'],
    'aria-labelledby': props.value['aria-labelledby'],
    emptyState: {
      hasActiveFilters: hasActiveFilters.value,
      onClearAll: clearAllFilters,
      message: props.value.emptyState?.message,
      render: props.value.emptyState?.render,
    },
  }));

  const pagination = computed<UseOGridPagination>(() => ({
    page: page.value,
    pageSize: pageSize.value,
    displayTotalCount: displayTotalCount.value,
    setPage,
    setPageSize,
    pageSizeOptions: props.value.pageSizeOptions,
    entityLabelPlural: entityLabelPlural.value,
  }));

  const columnChooser = computed<UseOGridColumnChooser>(() => ({
    columns: columnChooserColumns.value,
    visibleColumns: visibleColumns.value,
    onVisibilityChange: handleVisibilityChange,
    placement: columnChooserPlacement.value,
  }));

  const layout = computed<UseOGridLayout>(() => ({
    toolbar: props.value.toolbar,
    toolbarBelow: props.value.toolbarBelow,
    className: props.value.className,
    emptyState: props.value.emptyState,
    sideBarProps: sideBarProps.value,
  }));

  const filtersResult = computed<UseOGridFilters>(() => ({
    hasActiveFilters: hasActiveFilters.value,
    setFilters,
  }));

  // --- Imperative API ---
  const api = computed<IOGridApi<T>>(() => ({
    setRowData: (d: T[]) => {
      if (!isServerSide.value) internalData.value = d;
    },
    setLoading: (v: boolean) => { internalLoading.value = v; },
    getColumnState: () => ({
      visibleColumns: Array.from(visibleColumns.value),
      sort: sort.value,
      columnOrder: columnOrder.value ?? undefined,
      columnWidths: Object.keys(columnWidthOverrides.value).length > 0 ? columnWidthOverrides.value : undefined,
      filters: Object.keys(filters.value).length > 0 ? filters.value : undefined,
      pinnedColumns: Object.keys(pinnedOverrides.value).length > 0 ? pinnedOverrides.value : undefined,
    }),
    applyColumnState: (state: Partial<IGridColumnState>) => {
      if (state.visibleColumns) setVisibleColumns(new Set(state.visibleColumns));
      if (state.sort) setSort(state.sort);
      if (state.columnOrder && onColumnOrderChange.value) onColumnOrderChange.value(state.columnOrder);
      if (state.columnWidths) columnWidthOverrides.value = state.columnWidths;
      if (state.filters) setFilters(state.filters);
      if (state.pinnedColumns) pinnedOverrides.value = state.pinnedColumns;
    },
    setFilterModel: setFilters,
    getSelectedRows: () => Array.from(effectiveSelectedRows.value),
    setSelectedRows: (rowIds: RowId[]) => {
      if (selectedRowsProp.value === undefined) internalSelectedRows.value = new Set(rowIds);
    },
    selectAll: () => {
      const allIds = new Set(displayItems.value.map((item) => getRowId.value(item)));
      if (selectedRowsProp.value === undefined) internalSelectedRows.value = allIds;
      props.value.onSelectionChange?.({ selectedRowIds: Array.from(allIds), selectedItems: displayItems.value });
    },
    deselectAll: () => {
      if (selectedRowsProp.value === undefined) internalSelectedRows.value = new Set();
      props.value.onSelectionChange?.({ selectedRowIds: [], selectedItems: [] });
    },
    clearFilters: () => setFilters({}),
    clearSort: () => setSort({ field: defaultSortField.value, direction: defaultSortDirection.value }),
    resetGridState: (options?: { keepSelection?: boolean }) => {
      setFilters({});
      setSort({ field: defaultSortField.value, direction: defaultSortDirection.value });
      if (!options?.keepSelection) {
        if (selectedRowsProp.value === undefined) internalSelectedRows.value = new Set();
        props.value.onSelectionChange?.({ selectedRowIds: [], selectedItems: [] });
      }
    },
    getDisplayedRows: () => displayItems.value,
    refreshData: () => {
      if (isServerSide.value) refreshCounter.value++;
    },
    scrollToRow: () => {
      // No-op at orchestration level — DataGridTable components implement
      // this via useVirtualScroll.scrollToRow when virtual scrolling is active.
    },
    getColumnOrder: () => columnOrder.value ?? columns.value.map((c) => c.columnId),
    setColumnOrder: (order: string[]) => {
      onColumnOrderChange.value?.(order);
    },
  }));

  return {
    dataGridProps,
    pagination,
    columnChooser,
    layout,
    filters: filtersResult,
    api,
  };
}
