/**
 * useHeadlessGrid — the v3 headless API for OGrid (Vue).
 *
 * Returns reactive sort/filter/paginate state and rows, without imposing
 * any chrome. Render with your own table primitives.
 *
 * Mirrors the React `useHeadlessGrid` API (see `@alaarab/ogrid-react`)
 * with Vue-idiomatic returns: refs for state, computed for derived
 * values, plain functions for actions. Inputs accept refs, getters, or
 * plain values via `toValue()`.
 *
 * Example:
 *
 *   const grid = useHeadlessGrid({
 *     columns,
 *     data,
 *     getRowId: (r) => r.id,
 *     initialSort: { field: 'name', direction: 'asc' },
 *   });
 *
 *   <template>
 *     <table>
 *       <thead>
 *         <tr>
 *           <th v-for="col in grid.columns.value" :key="col.columnId"
 *               @click="grid.toggleSort(col.columnId)">
 *             {{ col.name }} {{ grid.sortIndicator(col.columnId).value }}
 *           </th>
 *         </tr>
 *       </thead>
 *       <tbody>
 *         <tr v-for="row in grid.rows.value" :key="grid.getRowId(row)">
 *           <td v-for="col in grid.columns.value" :key="col.columnId">
 *             {{ grid.getCellValue(row, col.columnId) }}
 *           </td>
 *         </tr>
 *       </tbody>
 *     </table>
 *   </template>
 */

import { ref, shallowRef, computed, toValue, watch, type ComputedRef, type Ref, type MaybeRefOrGetter } from 'vue';
import {
  processClientSideData,
  getCellValue as coreGetCellValue,
  computeNextSortState,
  mergeFilter,
} from '@alaarab/ogrid-core';
import type { IColumnDef, IFilters, FilterValue, IDataSource } from '@alaarab/ogrid-core';

export type RowId = string | number;

export interface SortState {
  field: string;
  direction: 'asc' | 'desc';
}

export interface UseHeadlessGridParams<T> {
  columns: MaybeRefOrGetter<IColumnDef<T>[]>;
  data: MaybeRefOrGetter<T[]>;
  /** Stable row ID extractor — must return the same ID for the same row across renders. */
  getRowId: (row: T) => RowId;

  initialSort?: SortState;
  initialFilters?: IFilters;
  initialPage?: number;
  initialPageSize?: number;

  /**
   * Server-side data source. When provided, sort/filter/paginate are sent to
   * the server and the returned items are displayed as-is. When omitted,
   * client-side processing runs against `data`.
   */
  dataSource?: IDataSource<T>;
  /** Server-side fetch error callback. */
  onError?: (err: unknown) => void;
}

export interface UseHeadlessGridResult<T> {
  /** Resolved column definitions (reactive). */
  columns: ComputedRef<IColumnDef<T>[]>;
  /** Rows on the current page after sort + filter (reactive). */
  rows: ComputedRef<T[]>;
  /** Post-filter total row count (reactive). */
  totalCount: ComputedRef<number>;
  /** Total number of pages at current page size (reactive). */
  totalPages: ComputedRef<number>;
  /** Filtered + sorted rows across all pages (reactive). */
  allFilteredRows: ComputedRef<T[]>;

  /** Current sort state (mutable ref). */
  sort: Ref<SortState>;
  setSort: (sort: SortState) => void;
  /** Cycle a column's sort: asc → desc → reset. */
  toggleSort: (columnId: string) => void;
  /** Reactive sort indicator: returns ComputedRef<'▲' | '▼' | ''>. */
  sortIndicator: (columnId: string) => ComputedRef<'▲' | '▼' | ''>;

  /** Current filter state (mutable ref). */
  filters: Ref<IFilters>;
  setFilters: (filters: IFilters) => void;
  setFilter: (key: string, value: FilterValue | undefined) => void;
  hasActiveFilters: ComputedRef<boolean>;

  /** Pagination (mutable refs). */
  page: Ref<number>;
  pageSize: Ref<number>;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;

  /** Stable row identity. */
  getRowId: (row: T) => RowId;
  /** Read a cell value with full column-resolution (valueGetter, key, etc). */
  getCellValue: (row: T, columnId: string) => unknown;

  /** Row selection — minimal Set-based API. */
  selectedRowIds: Ref<Set<RowId>>;
  isRowSelected: (row: T) => boolean;
  toggleRowSelection: (row: T) => void;
  selectAllOnPage: () => void;
  clearSelection: () => void;

  /** True while a server-side fetch is in flight. Always false in client-side mode. */
  serverLoading: Ref<boolean>;
  /** Force a fresh server-side fetch (no-op in client-side mode). */
  refreshData: () => void;
}

const DEFAULT_PAGE_SIZE = 25;

/**
 * Headless grid state + actions composable for Vue.
 *
 * Pure data layer — does not render anything. Use this when you want to
 * compose OGrid's sort/filter/paginate logic with your own table chrome.
 */
export function useHeadlessGrid<T>(
  params: UseHeadlessGridParams<T>,
): UseHeadlessGridResult<T> {
  const {
    columns: columnsInput,
    data: dataInput,
    getRowId,
    initialSort,
    initialFilters = {},
    initialPage = 1,
    initialPageSize = DEFAULT_PAGE_SIZE,
    dataSource,
    onError,
  } = params;

  const sort = ref<SortState>(initialSort ?? { field: '', direction: 'asc' });
  const filters = ref<IFilters>({ ...initialFilters });
  const page = ref(initialPage);
  const pageSize = ref(initialPageSize);

  const columns = computed(() => toValue(columnsInput));
  const data = computed(() => toValue(dataInput));

  const isServerSide = dataSource != null;

  // ── Server-side fetch state ────────────────────────────────────────
  // shallowRef so consumer's row type T isn't reactively unwrapped to
  // UnwrapRefSimple<T> — same pattern as useInlineEdit's editingContext.
  const serverItems = shallowRef<T[]>([]);
  const serverTotalCount = ref(0);
  const serverLoading = ref(isServerSide);
  const refreshCounter = ref(0);
  // Stale-fetch guard: increment per fetch, only the latest write wins.
  let fetchId = 0;

  if (isServerSide && dataSource) {
    watch(
      [
        page,
        pageSize,
        () => sort.value.field,
        () => sort.value.direction,
        filters,
        refreshCounter,
      ],
      () => {
        const id = ++fetchId;
        const controller = new AbortController();
        serverLoading.value = true;
        dataSource
          .fetchPage({
            page: page.value,
            pageSize: pageSize.value,
            sort: { field: sort.value.field, direction: sort.value.direction },
            filters: filters.value,
            signal: controller.signal,
          })
          .then((res) => {
            if (id !== fetchId || controller.signal.aborted) return;
            serverItems.value = res.items;
            serverTotalCount.value = res.totalCount;
          })
          .catch((err) => {
            if (id !== fetchId || controller.signal.aborted) return;
            onError?.(err);
            serverItems.value = [];
            serverTotalCount.value = 0;
          })
          .finally(() => {
            if (id === fetchId && !controller.signal.aborted) {
              serverLoading.value = false;
            }
          });
        return () => controller.abort();
      },
      { immediate: true, deep: true },
    );
  }

  // ── Client-side derivation (only used when isServerSide === false) ─
  const allFilteredRows = computed(() => {
    if (isServerSide) return serverItems.value;
    const sortField = sort.value.field;
    return processClientSideData(
      data.value,
      columns.value,
      filters.value,
      sortField || undefined,
      sortField ? sort.value.direction : undefined,
    );
  });

  const totalCount = computed(() =>
    isServerSide ? serverTotalCount.value : allFilteredRows.value.length,
  );
  const totalPages = computed(() =>
    Math.max(1, Math.ceil(totalCount.value / pageSize.value)),
  );

  const rows = computed(() => {
    if (isServerSide) return serverItems.value;
    const start = (page.value - 1) * pageSize.value;
    return allFilteredRows.value.slice(start, start + pageSize.value);
  });

  const refreshData = () => {
    refreshCounter.value += 1;
  };

  // ── Actions ─────────────────────────────────────────────────────────
  const setPage = (p: number) => {
    page.value = p;
  };
  const setPageSize = (size: number) => {
    pageSize.value = size;
    page.value = 1;
  };

  const setSort = (s: SortState) => {
    sort.value = s;
    page.value = 1;
  };
  const toggleSort = (columnId: string) => {
    setSort(computeNextSortState(sort.value, columnId));
  };

  const setFilters = (f: IFilters) => {
    filters.value = f;
    page.value = 1;
  };
  const setFilter = (key: string, value: FilterValue | undefined) => {
    setFilters(mergeFilter(filters.value, key, value));
  };

  const hasActiveFilters = computed(() =>
    Object.values(filters.value).some((v) => v !== undefined),
  );

  // ── Cell helpers ────────────────────────────────────────────────────
  const columnMap = computed(() => {
    const m = new Map<string, IColumnDef<T>>();
    for (const col of columns.value) m.set(col.columnId, col);
    return m;
  });

  const getCellValueFn = (row: T, columnId: string): unknown => {
    const col = columnMap.value.get(columnId);
    if (!col) return undefined;
    return coreGetCellValue(row, col);
  };

  // ── Sort indicator (reactive) ───────────────────────────────────────
  const sortIndicator = (columnId: string): ComputedRef<'▲' | '▼' | ''> =>
    computed(() => {
      if (sort.value.field !== columnId) return '';
      return sort.value.direction === 'asc' ? '▲' : '▼';
    });

  // ── Selection ───────────────────────────────────────────────────────
  const selectedRowIds = ref<Set<RowId>>(new Set());

  const isRowSelected = (row: T) => selectedRowIds.value.has(getRowId(row));

  const toggleRowSelection = (row: T) => {
    const id = getRowId(row);
    const next = new Set(selectedRowIds.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedRowIds.value = next;
  };

  const selectAllOnPage = () => {
    const next = new Set(selectedRowIds.value);
    for (const row of rows.value) next.add(getRowId(row));
    selectedRowIds.value = next;
  };

  const clearSelection = () => {
    selectedRowIds.value = new Set();
  };

  return {
    columns,
    rows,
    totalCount,
    totalPages,
    allFilteredRows,

    sort,
    setSort,
    toggleSort,
    sortIndicator,

    filters,
    setFilters,
    setFilter,
    hasActiveFilters,

    page,
    pageSize,
    setPage,
    setPageSize,

    getRowId,
    getCellValue: getCellValueFn,

    selectedRowIds,
    isRowSelected,
    toggleRowSelection,
    selectAllOnPage,
    clearSelection,

    serverLoading,
    refreshData,
  };
}
