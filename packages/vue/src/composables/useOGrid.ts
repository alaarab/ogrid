import { ref, computed, watch, onMounted, onUnmounted, type Ref } from 'vue';
import {
  mergeFilter,
  deriveFilterOptionsFromData,
  getMultiSelectFilterFields,
  flattenColumns,
  processClientSideData,
  computeNextSortState,
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
  // --- Destructure props reactively (grouped by change frequency) ---

  // Group 1: Column-related (changes rarely)
  const columnProps = computed(() => {
    const p = props.value;
    return {
      columns: p.columns,
      columnOrder: p.columnOrder,
      onColumnOrderChange: p.onColumnOrderChange,
      onColumnResized: p.onColumnResized,
      onColumnPinned: p.onColumnPinned,
      columnChooser: p.columnChooser,
    };
  });

  // Group 2: Data identity (stable or rarely changes)
  const dataProps = computed(() => {
    const p = props.value;
    return {
      getRowId: p.getRowId,
      data: ('data' in p ? p.data : undefined) as T[] | undefined,
      dataSource: ('dataSource' in p ? p.dataSource : undefined),
    };
  });

  // Group 3: Controlled state (changes on user interaction)
  const controlledState = computed(() => {
    const p = props.value;
    return {
      page: p.page,
      pageSize: p.pageSize,
      sort: p.sort,
      filters: p.filters,
      visibleColumns: p.visibleColumns,
      isLoading: p.isLoading,
    };
  });

  // Group 4: Callbacks (stable references)
  const callbacks = computed(() => {
    const p = props.value;
    return {
      onPageChange: p.onPageChange,
      onPageSizeChange: p.onPageSizeChange,
      onSortChange: p.onSortChange,
      onFiltersChange: p.onFiltersChange,
      onVisibleColumnsChange: p.onVisibleColumnsChange,
      onFirstDataRendered: p.onFirstDataRendered,
      onError: p.onError,
    };
  });

  // Group 5: Config defaults (stable)
  const defaults = computed(() => {
    const p = props.value;
    return {
      defaultPageSize: p.defaultPageSize ?? DEFAULT_PAGE_SIZE,
      defaultSortBy: p.defaultSortBy,
      defaultSortDirection: (p.defaultSortDirection ?? 'asc') as 'asc' | 'desc',
      entityLabelPlural: p.entityLabelPlural ?? 'items',
    };
  });

  // Resolve column chooser placement
  const columnChooserPlacement = computed<ColumnChooserPlacement>(() =>
    columnProps.value.columnChooser === false ? 'none'
    : columnProps.value.columnChooser === 'sidebar' ? 'sidebar'
    : 'toolbar'
  );

  const columns = computed(() => flattenColumns(columnProps.value.columns));
  const isServerSide = computed(() => dataProps.value.dataSource != null);
  const isClientSide = computed(() => !isServerSide.value);

  const internalData = ref<T[]>([]) as Ref<T[]>;
  const internalLoading = ref(false);

  const displayData = computed(() => dataProps.value.data ?? internalData.value);
  const displayLoading = computed(() => controlledState.value.isLoading ?? internalLoading.value);

  const defaultSortField = computed(() => defaults.value.defaultSortBy ?? columns.value[0]?.columnId ?? '');

  const internalPage = ref(1);
  const internalPageSize = ref(defaults.value.defaultPageSize);
  const internalSort = ref<{ field: string; direction: 'asc' | 'desc' }>({
    field: defaultSortField.value,
    direction: defaults.value.defaultSortDirection,
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

  const page = computed(() => controlledState.value.page ?? internalPage.value);
  const pageSize = computed(() => controlledState.value.pageSize ?? internalPageSize.value);
  const sort = computed(() => controlledState.value.sort ?? internalSort.value);
  const filters = computed(() => controlledState.value.filters ?? internalFilters.value);
  const visibleColumns = computed(() => controlledState.value.visibleColumns ?? internalVisibleColumns.value);

  const setPage = (p: number) => {
    if (controlledState.value.page === undefined) internalPage.value = p;
    callbacks.value.onPageChange?.(p);
  };

  const setPageSize = (size: number) => {
    if (controlledState.value.pageSize === undefined) internalPageSize.value = size;
    callbacks.value.onPageSizeChange?.(size);
    setPage(1);
  };

  const setSort = (s: { field: string; direction: 'asc' | 'desc' }) => {
    if (controlledState.value.sort === undefined) internalSort.value = s;
    callbacks.value.onSortChange?.(s);
    setPage(1);
  };

  const setFilters = (f: IFilters) => {
    if (controlledState.value.filters === undefined) internalFilters.value = f;
    callbacks.value.onFiltersChange?.(f);
    setPage(1);
  };

  const setVisibleColumns = (cols: Set<string>) => {
    if (controlledState.value.visibleColumns === undefined) internalVisibleColumns.value = cols;
    callbacks.value.onVisibleColumnsChange?.(cols);
  };

  const handleSort = (columnKey: string, direction?: 'asc' | 'desc' | null) => {
    setSort(computeNextSortState(sort.value, columnKey, direction));
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

  const filterOptionsSource = computed(() => dataProps.value.dataSource ?? { fetchFilterOptions: undefined });

  const { filterOptions: serverFilterOptions, loadingOptions: loadingFilterOptions } =
    useFilterOptions(filterOptionsSource, multiSelectFilterFields);

  const hasServerFilterOptions = computed(() => dataProps.value.dataSource?.fetchFilterOptions != null);
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
  let isDestroyed = false;
  const refreshCounter = ref(0);

  const doFetch = () => {
    if (!isServerSide.value || !dataProps.value.dataSource) {
      if (!isServerSide.value) loading.value = false;
      return;
    }
    const id = ++fetchId;
    loading.value = true;
    dataProps.value.dataSource
      .fetchPage({
        page: page.value,
        pageSize: pageSize.value,
        sort: { field: sort.value.field, direction: sort.value.direction },
        filters: filters.value,
      })
      .then((res) => {
        if (id !== fetchId || isDestroyed) return;
        serverItems.value = res.items;
        serverTotalCount.value = res.totalCount;
      })
      .catch((err) => {
        if (id !== fetchId || isDestroyed) return;
        callbacks.value.onError?.(err);
        serverItems.value = [];
        serverTotalCount.value = 0;
      })
      .finally(() => {
        if (id === fetchId && !isDestroyed) loading.value = false;
      });
  };

  // Initial fetch on mount
  onMounted(() => {
    doFetch();
  });

  // Subsequent fetches on page/sort/filter changes (no immediate — onMounted handles initial)
  watch(
    [() => dataProps.value.dataSource, page, pageSize, () => sort.value.field, () => sort.value.direction, filters, refreshCounter],
    () => {
      doFetch();
    }
  );

  onUnmounted(() => {
    isDestroyed = true;
  });

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
      callbacks.value.onFirstDataRendered?.();
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
    const totalData = isClientSide.value ? (dataProps.value.data?.length ?? 0) : serverTotalCount.value;
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
    columnProps.value.onColumnResized?.(columnId, width);
  };

  const handleColumnPinned = (columnId: string, pinned: 'left' | 'right' | null) => {
    if (pinned === null) {
      const { [columnId]: _removed, ...rest } = pinnedOverrides.value;
      pinnedOverrides.value = rest;
    } else {
      pinnedOverrides.value = { ...pinnedOverrides.value, [columnId]: pinned };
    }
    columnProps.value.onColumnPinned?.(columnId, pinned);
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

  const dataGridProps = computed<IOGridDataGridProps<T>>(() => {
    const p = props.value;
    const ds = dataProps.value.dataSource;
    return {
      items: displayItems.value,
      columns: columnProps.value.columns,
      getRowId: dataProps.value.getRowId,
      sortBy: sort.value.field,
      sortDirection: sort.value.direction,
      onColumnSort: handleSort,
      visibleColumns: visibleColumns.value,
      columnOrder: columnProps.value.columnOrder,
      onColumnOrderChange: columnProps.value.onColumnOrderChange,
      onColumnResized: handleColumnResized,
      onColumnPinned: handleColumnPinned,
      pinnedColumns: pinnedOverrides.value,
      initialColumnWidths: columnWidthOverrides.value,
      editable: p.editable,
      cellSelection: p.cellSelection,
      onCellValueChanged: p.onCellValueChanged,
      onUndo: p.onUndo,
      onRedo: p.onRedo,
      canUndo: p.canUndo,
      canRedo: p.canRedo,
      rowSelection: p.rowSelection ?? 'none',
      selectedRows: effectiveSelectedRows.value,
      onSelectionChange: handleSelectionChange,
      showRowNumbers: p.showRowNumbers,
      currentPage: page.value,
      pageSize: pageSize.value,
      statusBar: statusBarConfig.value,
      isLoading: isLoadingResolved.value,
      filters: filters.value,
      onFilterChange: handleFilterChange,
      filterOptions: clientFilterOptions.value,
      loadingFilterOptions: ds?.fetchFilterOptions ? loadingFilterOptions.value : EMPTY_LOADING_OPTIONS,
      peopleSearch: ds?.searchPeople,
      getUserByEmail: ds?.getUserByEmail,
      layoutMode: p.layoutMode,
      suppressHorizontalScroll: p.suppressHorizontalScroll,
      columnReorder: p.columnReorder,
      virtualScroll: p.virtualScroll,
      rowHeight: p.rowHeight,
      density: p.density ?? 'normal',
      'aria-label': p['aria-label'],
      'aria-labelledby': p['aria-labelledby'],
      emptyState: {
        hasActiveFilters: hasActiveFilters.value,
        onClearAll: clearAllFilters,
        message: p.emptyState?.message,
        render: p.emptyState?.render,
      },
    };
  });

  const pagination = computed<UseOGridPagination>(() => ({
    page: page.value,
    pageSize: pageSize.value,
    displayTotalCount: displayTotalCount.value,
    setPage,
    setPageSize,
    pageSizeOptions: props.value.pageSizeOptions,
    entityLabelPlural: defaults.value.entityLabelPlural,
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
      columnOrder: columnProps.value.columnOrder ?? undefined,
      columnWidths: Object.keys(columnWidthOverrides.value).length > 0 ? columnWidthOverrides.value : undefined,
      filters: Object.keys(filters.value).length > 0 ? filters.value : undefined,
      pinnedColumns: Object.keys(pinnedOverrides.value).length > 0 ? pinnedOverrides.value : undefined,
    }),
    applyColumnState: (state: Partial<IGridColumnState>) => {
      if (state.visibleColumns) setVisibleColumns(new Set(state.visibleColumns));
      if (state.sort) setSort(state.sort);
      if (state.columnOrder && columnProps.value.onColumnOrderChange) columnProps.value.onColumnOrderChange(state.columnOrder);
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
      const allIds = new Set(displayItems.value.map((item) => dataProps.value.getRowId(item)));
      if (selectedRowsProp.value === undefined) internalSelectedRows.value = allIds;
      props.value.onSelectionChange?.({ selectedRowIds: Array.from(allIds), selectedItems: displayItems.value });
    },
    deselectAll: () => {
      if (selectedRowsProp.value === undefined) internalSelectedRows.value = new Set();
      props.value.onSelectionChange?.({ selectedRowIds: [], selectedItems: [] });
    },
    clearFilters: () => setFilters({}),
    clearSort: () => setSort({ field: defaultSortField.value, direction: defaults.value.defaultSortDirection }),
    resetGridState: (options?: { keepSelection?: boolean }) => {
      setFilters({});
      setSort({ field: defaultSortField.value, direction: defaults.value.defaultSortDirection });
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
    getColumnOrder: () => columnProps.value.columnOrder ?? columns.value.map((c) => c.columnId),
    setColumnOrder: (order: string[]) => {
      columnProps.value.onColumnOrderChange?.(order);
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
