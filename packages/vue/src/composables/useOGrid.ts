import { ref, computed, watch, shallowRef, h, onMounted, onUnmounted, type Ref } from 'vue';
import {
  mergeFilter,
  deriveFilterOptionsFromData,
  getMultiSelectFilterFields,
  flattenColumns,
  processClientSideData,
  processClientSideDataAsync,
  computeNextSortState,
  shouldUseWorkerSort,
  validateColumns,
  validateRowIds,
  columnLetterToIndex,
  getCellValue,
} from '@alaarab/ogrid-core';
import { useFilterOptions } from './useFilterOptions';
import { useFormulaEngine } from './useFormulaEngine';
import { useFormulaBar } from './useFormulaBar';
import { useSideBarState } from './useSideBarState';
import { FormulaBar } from '../components/FormulaBar';
import { SheetTabs } from '../components/SheetTabs';
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
  fullScreen?: boolean;
  /** Formula bar element (rendered between toolbar and grid). */
  formulaBar?: unknown;
  /** Sheet tabs element (rendered between grid and footer). */
  sheetTabs?: unknown;
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
      onAutosizeColumn: p.onAutosizeColumn,
      onColumnPinned: p.onColumnPinned,
      columnChooser: p.columnChooser,
    };
  });

  // Group 2: Data identity (stable or rarely changes)
  const dataProps = computed(() => {
    const p = props.value;
    const data = ('data' in p ? p.data : undefined) as T[] | undefined;
    const dataSource = ('dataSource' in p ? p.dataSource : undefined);
    if (data && dataSource) {
      console.warn('[OGrid] Both data and dataSource provided. dataSource takes precedence.');
    }
    return {
      getRowId: p.getRowId,
      data,
      dataSource,
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
  const internalColumnOrder = ref<string[] | undefined>(undefined);
  const internalVisibleColumns = ref<Set<string>>((() => {
    const visible = columns.value
      .filter((c) => c.defaultVisible !== false)
      .map((c) => c.columnId);
    return new Set(visible.length > 0 ? visible : columns.value.map((c) => c.columnId));
  })()) as Ref<Set<string>>;

  const columnWidthOverrides = ref<Record<string, number>>({});
  const initialPinned: Record<string, 'left' | 'right'> = {};
  for (const col of flattenColumns(props.value.columns)) {
    if (col.pinned) initialPinned[col.columnId] = col.pinned;
  }
  const pinnedOverrides = ref<Record<string, 'left' | 'right'>>(initialPinned);

  const page = computed(() => controlledState.value.page ?? internalPage.value);
  const pageSize = computed(() => controlledState.value.pageSize ?? internalPageSize.value);
  const sort = computed(() => controlledState.value.sort ?? internalSort.value);
  const filters = computed(() => controlledState.value.filters ?? internalFilters.value);
  const effectiveColumnOrder = computed(() => columnProps.value.columnOrder ?? internalColumnOrder.value);
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

  // Increments each time the user explicitly sorts. Used to snapshot sort state so that
  // subsequent cell edits (which change displayData) don't trigger a re-sort (Excel-like behavior).
  const sortVersion = ref(0);

  const setSort = (s: { field: string; direction: 'asc' | 'desc' }) => {
    if (controlledState.value.sort === undefined) internalSort.value = s;
    callbacks.value.onSortChange?.(s);
    setPage(1);
    sortVersion.value++;
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
  const workerSortEnabled = computed(() => shouldUseWorkerSort(props.value.workerSort, displayData.value.length, {
    columns: columns.value,
    filters: filters.value,
    sortBy: sort.value.field,
  }));

  // Stable sorted order (index-based, same approach as React).
  // sortedIndices stores indices into displayData from the last explicit sort/filter pass.
  // When only displayData changes (cell edit, sortVersion/filters unchanged), we reuse
  // these indices to look up updated row objects - preserving order without re-sorting.
  let sortedIndices: number[] | null = null;
  let prevSortVersion = -1;
  let prevFilters: IFilters | null = null;
  let prevColumns: typeof columns.value | null = null;
  let prevDataLength = -1;

  /** Sync path: used when workerSort is off. */
  const clientItemsAndTotal = computed(() => {
    if (!isClientSide.value || workerSortEnabled.value) return null;

    const data = displayData.value;
    const cols = columns.value;
    const f = filters.value;
    const sv = sortVersion.value;
    const sf = sort.value.field;
    const sd = sort.value.direction;

    const needsResort =
      sv !== prevSortVersion ||
      f !== prevFilters ||
      cols !== prevColumns ||
      data.length !== prevDataLength;

    let orderedRows: T[];

    if (needsResort || sortedIndices === null) {
      prevSortVersion = sv;
      prevFilters = f;
      prevColumns = cols;
      prevDataLength = data.length;

      const sorted = processClientSideData(data, cols, f, sf, sd);
      const indexMap = new Map<T, number>();
      for (let i = 0; i < data.length; i++) indexMap.set(data[i], i);
      sortedIndices = sorted.map((row) => {
        const idx = indexMap.get(row);
        return idx !== undefined ? idx : -1;
      }).filter((idx) => idx !== -1);
      orderedRows = sorted;
    } else {
      // Cell edit: preserve existing order, look up updated row objects by index.
      orderedRows = sortedIndices.map((idx) => data[idx]).filter((r) => r !== undefined) as T[];
    }

    const total = orderedRows.length;
    const start = (page.value - 1) * pageSize.value;
    const paged = orderedRows.slice(start, start + pageSize.value);
    return { items: paged, totalCount: total };
  });

  /** Async path: worker sort result. */
  const asyncClientItems = ref<{ items: T[]; totalCount: number } | null>(null) as Ref<{ items: T[]; totalCount: number } | null>;
  let workerSortAbortId = 0;
  let asyncSortedIndices: number[] | null = null;
  let asyncPrevSortVersion = -1;
  let asyncPrevFilters: IFilters | null = null;
  let asyncPrevColumns: typeof columns.value | null = null;
  let asyncPrevDataLength = -1;

  // Worker sort effect
  watch(
    [isClientSide, workerSortEnabled, displayData, columns, filters, sortVersion, page, pageSize],
    () => {
      if (!isClientSide.value || !workerSortEnabled.value) return;

      const data = displayData.value;
      const cols = columns.value;
      const f = filters.value;
      const sv = sortVersion.value;
      const sf = sort.value.field;
      const sd = sort.value.direction;
      const p = page.value;
      const ps = pageSize.value;
      const abortId = ++workerSortAbortId;

      const needsResortAsync =
        sv !== asyncPrevSortVersion ||
        f !== asyncPrevFilters ||
        cols !== asyncPrevColumns ||
        data.length !== asyncPrevDataLength;

      if (needsResortAsync || asyncSortedIndices === null) {
        asyncPrevSortVersion = sv;
        asyncPrevFilters = f;
        asyncPrevColumns = cols;
        asyncPrevDataLength = data.length;
        asyncSortedIndices = null;

        processClientSideDataAsync(data, cols, f, sf, sd)
          .then((rows) => {
            if (abortId !== workerSortAbortId || isDestroyed) return;
            const indexMap = new Map<T, number>();
            for (let i = 0; i < data.length; i++) indexMap.set(data[i], i);
            asyncSortedIndices = (rows as T[]).map((row) => {
              const idx = indexMap.get(row);
              return idx !== undefined ? idx : -1;
            }).filter((idx) => idx !== -1);
            const total = rows.length;
            const start = (p - 1) * ps;
            const paged = rows.slice(start, start + ps);
            asyncClientItems.value = { items: paged as T[], totalCount: total };
          })
          .catch(() => {
            if (abortId !== workerSortAbortId || isDestroyed) return;
            // Fallback: sync
            const rows = processClientSideData(data, cols, f, sf, sd);
            const indexMap = new Map<T, number>();
            for (let i = 0; i < data.length; i++) indexMap.set(data[i], i);
            asyncSortedIndices = rows.map((row) => {
              const idx = indexMap.get(row);
              return idx !== undefined ? idx : -1;
            }).filter((idx) => idx !== -1);
            const total = rows.length;
            const start = (p - 1) * ps;
            const paged = rows.slice(start, start + ps);
            asyncClientItems.value = { items: paged, totalCount: total };
          });
      } else {
        // Preserve order: look up updated rows by stored indices.
        const orderedRows = asyncSortedIndices.map((idx) => data[idx]).filter((r) => r !== undefined) as T[];
        const total = orderedRows.length;
        const start = (p - 1) * ps;
        const paged = orderedRows.slice(start, start + ps);
        asyncClientItems.value = { items: paged, totalCount: total };
      }
    },
    { immediate: true }
  );

  /** Resolved client items  -  sync or async depending on workerSort. */
  const resolvedClientItems = computed(() => {
    const syncResult = clientItemsAndTotal.value;
    if (syncResult) return syncResult;
    return asyncClientItems.value;
  });

  // --- Server-side fetching ---
  const serverItems = ref<T[]>([]) as Ref<T[]>;
  const serverTotalCount = ref(0);
  const loading = ref(false);
  let fetchId = 0;
  let fetchAbortController: AbortController | null = null;
  let isDestroyed = false;
  const refreshCounter = ref(0);

  const doFetch = () => {
    if (!isServerSide.value || !dataProps.value.dataSource) {
      if (!isServerSide.value) loading.value = false;
      return;
    }
    const id = ++fetchId;
    fetchAbortController?.abort();
    const controller = new AbortController();
    fetchAbortController = controller;
    loading.value = true;
    dataProps.value.dataSource
      .fetchPage({
        page: page.value,
        pageSize: pageSize.value,
        sort: { field: sort.value.field, direction: sort.value.direction },
        filters: filters.value,
        signal: controller.signal,
      })
      .then((res) => {
        if (id !== fetchId || isDestroyed || controller.signal.aborted) return;
        serverItems.value = res.items;
        serverTotalCount.value = res.totalCount;
      })
      .catch((err) => {
        if (id !== fetchId || isDestroyed || controller.signal.aborted) return;
        callbacks.value.onError?.(err);
        serverItems.value = [];
        serverTotalCount.value = 0;
      })
      .finally(() => {
        if (id === fetchId && !isDestroyed && !controller.signal.aborted) loading.value = false;
      });
  };

  // Validate columns once on mount
  onMounted(() => {
    validateColumns(columns.value as Parameters<typeof validateColumns>[0]);
    doFetch();
  });

  // Subsequent fetches on page/sort/filter changes (no immediate  -  onMounted handles initial).
  // Getter functions are used for nested properties (sort.value.field) that Vue
  // can't track through a raw ref; top-level refs are passed directly.
  watch(
    [() => dataProps.value.dataSource, page, pageSize, () => sort.value.field, () => sort.value.direction, filters, refreshCounter],
    () => {
      doFetch();
    }
  );

  onUnmounted(() => {
    isDestroyed = true;
    fetchAbortController?.abort();
    fetchAbortController = null;
  });

  const displayItems = computed<T[]>(() =>
    isClientSide.value && resolvedClientItems.value
      ? resolvedClientItems.value.items
      : serverItems.value
  );
  const displayTotalCount = computed(() =>
    isClientSide.value && resolvedClientItems.value
      ? resolvedClientItems.value.totalCount
      : serverTotalCount.value
  );

  // --- Formula engine (opt-in, tree-shakeable) ---
  const formulasRef = computed(() => !!props.value.formulas);
  const formulaVersionRef = ref(0);
  const wrappedOnFormulaRecalc = (result: import('@alaarab/ogrid-core').IRecalcResult) => {
    formulaVersionRef.value += 1;
    props.value.onFormulaRecalc?.(result);
  };
  const formulaEngine = useFormulaEngine({
    formulas: formulasRef,
    items: displayItems,
    flatColumns: columns,
    initialFormulas: props.value.initialFormulas,
    onFormulaRecalc: wrappedOnFormulaRecalc,
    formulaFunctions: props.value.formulaFunctions,
    namedRanges: props.value.namedRanges,
    sheets: props.value.sheets,
  });

  // Fire onFirstDataRendered once; also validate row IDs on first data
  let firstDataRendered = false;
  let rowIdsValidated = false;
  watch(displayItems, (items) => {
    if (!firstDataRendered && items.length > 0) {
      firstDataRendered = true;
      callbacks.value.onFirstDataRendered?.();
    }
    if (!rowIdsValidated && items.length > 0) {
      rowIdsValidated = true;
      validateRowIds(items, dataProps.value.getRowId as (item: typeof items[0]) => import('@alaarab/ogrid-core').RowId);
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

  const handleAutosizeColumn = (columnId: string, width: number) => {
    columnWidthOverrides.value = { ...columnWidthOverrides.value, [columnId]: width };
    (columnProps.value.onAutosizeColumn ?? columnProps.value.onColumnResized)?.(columnId, width);
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
  // Use a shallowRef to hold sideBarState so sideBarProps computed re-runs when config changes
  const sideBarStateRef = shallowRef(useSideBarState({ config: props.value.sideBar }));
  watch(() => props.value.sideBar, (newConfig) => {
    sideBarStateRef.value = useSideBarState({ config: newConfig });
  });

  const filterableColumns = computed(() =>
    columns.value
      .filter((c) => c.filterable && c.filterable.type)
      .map((c) => ({
        columnId: c.columnId,
        name: c.name,
        filterField: c.filterable?.filterField ?? c.columnId,
        filterType: c.filterable?.type as 'text' | 'multiSelect' | 'people' | 'date',
      }))
  );

  const sideBarProps = computed<SideBarProps | null>(() => {
    const sideBarState = sideBarStateRef.value;
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

  // --- Name box / formula bar (active cell reference + coordinates) ---
  const activeCellRef = ref<string | null>(null);
  const activeCellCoords = ref<{ col: number; row: number } | null>(null);
  const onActiveCellChange = (cellRef: string | null) => {
    activeCellRef.value = cellRef;
    if (cellRef) {
      // Parse "A1" -> { col: 0, row: 0 }
      const m = cellRef.match(/^([A-Z]+)(\d+)$/);
      if (m) {
        activeCellCoords.value = { col: columnLetterToIndex(m[1]), row: parseInt(m[2], 10) - 1 };
      } else {
        activeCellCoords.value = null;
      }
    } else {
      activeCellCoords.value = null;
    }
  };

  // --- Formula bar composable (only meaningful when formulas are enabled) ---
  const formulaBarActiveCol = computed(() => activeCellCoords.value?.col ?? null);
  const formulaBarActiveRow = computed(() => activeCellCoords.value?.row ?? null);

  const getRawValue = (col: number, row: number): unknown => {
    const items = displayItems.value;
    const cols = columns.value;
    if (row < 0 || row >= items.length || col < 0 || col >= cols.length) return undefined;
    return getCellValue(items[row], cols[col]);
  };

  const formulaBarState = useFormulaBar({
    activeCol: formulaBarActiveCol,
    activeRow: formulaBarActiveRow,
    activeCellRef,
    getFormula: formulaEngine.enabled.value ? formulaEngine.getFormula : undefined,
    getRawValue,
    setFormula: formulaEngine.enabled.value ? formulaEngine.setFormula : undefined,
  });

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
      columnOrder: effectiveColumnOrder.value,
      onColumnOrderChange: columnProps.value.onColumnOrderChange,
      onColumnResized: handleColumnResized,
      onAutosizeColumn: handleAutosizeColumn,
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
      showRowNumbers: p.showRowNumbers || p.cellReferences || p.formulas,
      showColumnLetters: !!(p.cellReferences || p.formulas),
      showNameBox: !!(p.cellReferences && !p.formulas), // formula bar includes name box
      onActiveCellChange: (p.cellReferences || p.formulas) ? onActiveCellChange : undefined,
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
      stickyHeader: p.stickyHeader ?? true,
      columnReorder: p.columnReorder,
      responsiveColumns: p.responsiveColumns,
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
      formulas: p.formulas,
      formulaVersion: formulaVersionRef.value,
      ...(formulaEngine.enabled.value ? {
        getFormulaValue: formulaEngine.getFormulaValue,
        hasFormula: formulaEngine.hasFormula,
        getFormula: formulaEngine.getFormula,
        setFormula: formulaEngine.setFormula,
        onFormulaCellChanged: formulaEngine.onCellChanged,
        getPrecedents: formulaEngine.getPrecedents,
        getDependents: formulaEngine.getDependents,
        getAuditTrail: formulaEngine.getAuditTrail,
      } : {}),
      formulaReferences: formulaBarState.referencedCells.value.length > 0 ? formulaBarState.referencedCells.value : undefined,
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

  const layout = computed<UseOGridLayout>(() => {
    const p = props.value;
    const formulas = !!p.formulas;
    const showNameBox = !!p.cellReferences && !formulas; // formula bar has its own name box
    let resolvedToolbar: unknown = p.toolbar;
    if (showNameBox) {
      const nameBoxEl = h('div', {
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          padding: '0 8px',
          fontFamily: "'Consolas', 'Courier New', monospace",
          fontSize: '12px',
          border: '1px solid rgba(0,0,0,0.12)',
          borderRadius: '3px',
          height: '24px',
          marginRight: '8px',
          background: '#fff',
          minWidth: '40px',
          color: 'rgba(0,0,0,0.6)',
        },
        'aria-label': 'Active cell reference',
      }, activeCellRef.value ?? '\u2014');
      resolvedToolbar = [nameBoxEl, resolvedToolbar];
    }

    // Formula bar element (only when formulas are enabled)
    const formulaBarEl = formulas
      ? h(FormulaBar, {
          cellRef: formulaBarState.cellRef.value,
          formulaText: formulaBarState.formulaText.value,
          isEditing: formulaBarState.isEditing.value,
          onInputChange: formulaBarState.onInputChange,
          onCommit: formulaBarState.onCommit,
          onCancel: formulaBarState.onCancel,
          onStartEditing: formulaBarState.startEditing,
        })
      : undefined;

    // Sheet tabs element (only when sheetDefs are provided)
    const sheetTabsEl = (p.sheetDefs && p.sheetDefs.length > 0 && p.activeSheet && p.onSheetChange)
      ? h(SheetTabs, {
          sheets: p.sheetDefs,
          activeSheet: p.activeSheet,
          showAddButton: !!p.onSheetAdd,
          onSheetChange: p.onSheetChange,
          onSheetAdd: p.onSheetAdd ?? (() => {}),
        })
      : undefined;

    return {
      toolbar: resolvedToolbar,
      toolbarBelow: p.toolbarBelow,
      className: p.className,
      emptyState: p.emptyState,
      sideBarProps: sideBarProps.value,
      fullScreen: p.fullScreen,
      formulaBar: formulaBarEl,
      sheetTabs: sheetTabsEl,
    };
  });

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
      columnOrder: effectiveColumnOrder.value ?? undefined,
      columnWidths: Object.keys(columnWidthOverrides.value).length > 0 ? columnWidthOverrides.value : undefined,
      filters: Object.keys(filters.value).length > 0 ? filters.value : undefined,
      pinnedColumns: Object.keys(pinnedOverrides.value).length > 0 ? pinnedOverrides.value : undefined,
    }),
    applyColumnState: (state: Partial<IGridColumnState>) => {
      if (state.visibleColumns) setVisibleColumns(new Set(state.visibleColumns));
      if (state.sort) setSort(state.sort);
      if (state.columnOrder) {
        if (columnProps.value.columnOrder === undefined) internalColumnOrder.value = state.columnOrder;
        columnProps.value.onColumnOrderChange?.(state.columnOrder);
      }
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
      // No-op at orchestration level  -  DataGridTable components implement
      // this via useVirtualScroll.scrollToRow when virtual scrolling is active.
    },
    getColumnOrder: () => effectiveColumnOrder.value ?? columns.value.map((c) => c.columnId),
    setColumnOrder: (order: string[]) => {
      if (columnProps.value.columnOrder === undefined) internalColumnOrder.value = order;
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
