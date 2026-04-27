/**
 * createHeadlessGrid — the v3 headless API for OGrid (Angular).
 *
 * Returns Angular-signal–backed sort/filter/paginate state and rows,
 * without imposing any chrome. Render with your own table primitives
 * (Material `<mat-table>`, plain `<table>`, your own component, etc).
 *
 * Mirrors the React `useHeadlessGrid` API (see `@alaarab/ogrid-react`)
 * with Angular-idiomatic returns: signals for state, computed for
 * derived values, plain methods for actions. Inputs accept signals or
 * plain values — the factory normalizes both via `Signal<T> | T` getters.
 *
 * Example (standalone component):
 *
 *   @Component({
 *     standalone: true,
 *     template: `
 *       <table>
 *         <thead>
 *           <tr>
 *             @for (col of grid.columns(); track col.columnId) {
 *               <th (click)="grid.toggleSort(col.columnId)">
 *                 {{ col.name }} {{ grid.sortIndicator(col.columnId)() }}
 *               </th>
 *             }
 *           </tr>
 *         </thead>
 *         <tbody>
 *           @for (row of grid.rows(); track grid.getRowId(row)) {
 *             <tr>
 *               @for (col of grid.columns(); track col.columnId) {
 *                 <td>{{ grid.getCellValue(row, col.columnId) }}</td>
 *               }
 *             </tr>
 *           }
 *         </tbody>
 *       </table>
 *     `,
 *   })
 *   export class MyTableComponent {
 *     grid = createHeadlessGrid({
 *       columns: () => this.columns,
 *       data: () => this.data,
 *       getRowId: (r) => r.id,
 *       initialSort: { field: 'name', direction: 'asc' },
 *     });
 *   }
 */

import { signal, computed, effect, type Signal, type WritableSignal } from '@angular/core';
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

/** Accepts a signal, a getter function, or a plain value. */
export type SignalLike<T> = Signal<T> | (() => T) | T;

export interface CreateHeadlessGridParams<T> {
  columns: SignalLike<IColumnDef<T>[]>;
  data: SignalLike<T[]>;
  /** Stable row ID extractor — must return the same ID for the same row across renders. */
  getRowId: (row: T) => RowId;

  initialSort?: SortState;
  initialFilters?: IFilters;
  initialPage?: number;
  initialPageSize?: number;

  /**
   * Server-side data source. When provided, sort/filter/paginate are sent
   * to the server and the returned items are displayed as-is. When omitted,
   * client-side processing runs against `data`.
   */
  dataSource?: IDataSource<T>;
  /** Server-side fetch error callback. */
  onError?: (err: unknown) => void;
}

export interface HeadlessGridResult<T> {
  /** Resolved column definitions (reactive signal). */
  columns: Signal<IColumnDef<T>[]>;
  /** Rows on the current page after sort + filter. */
  rows: Signal<T[]>;
  /** Post-filter total row count. */
  totalCount: Signal<number>;
  /** Total number of pages at current page size. */
  totalPages: Signal<number>;
  /** Filtered + sorted rows across all pages. */
  allFilteredRows: Signal<T[]>;

  /** Current sort state (writable signal). */
  sort: WritableSignal<SortState>;
  setSort: (sort: SortState) => void;
  toggleSort: (columnId: string) => void;
  /** Reactive sort indicator: returns Signal<'▲' | '▼' | ''>. */
  sortIndicator: (columnId: string) => Signal<'▲' | '▼' | ''>;

  /** Current filter state (writable signal). */
  filters: WritableSignal<IFilters>;
  setFilters: (filters: IFilters) => void;
  setFilter: (key: string, value: FilterValue | undefined) => void;
  hasActiveFilters: Signal<boolean>;

  /** Pagination (writable signals). */
  page: WritableSignal<number>;
  pageSize: WritableSignal<number>;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;

  /** Stable row identity. */
  getRowId: (row: T) => RowId;
  /** Read a cell value with full column-resolution. */
  getCellValue: (row: T, columnId: string) => unknown;

  /** Row selection — minimal Set-based API. */
  selectedRowIds: WritableSignal<Set<RowId>>;
  isRowSelected: (row: T) => boolean;
  toggleRowSelection: (row: T) => void;
  selectAllOnPage: () => void;
  clearSelection: () => void;

  /** True while a server-side fetch is in flight. Always false in client-side mode. */
  serverLoading: Signal<boolean>;
  /** Force a fresh server-side fetch (no-op in client-side mode). */
  refreshData: () => void;
}

const DEFAULT_PAGE_SIZE = 25;

function normalize<T>(input: SignalLike<T>): Signal<T> {
  if (typeof input === 'function') {
    // Could be a Signal (function-callable) or a plain getter; both work as signals via computed.
    return computed(() => (input as () => T)());
  }
  // Plain value — wrap once.
  return computed(() => input);
}

/**
 * Headless grid state + actions factory for Angular.
 *
 * Pure data layer — does not render anything. Use this when you want to
 * compose OGrid's sort/filter/paginate logic with your own table chrome.
 *
 * Call from a component constructor or field initializer; not a service.
 * The returned signals are owned by the caller.
 */
export function createHeadlessGrid<T>(
  params: CreateHeadlessGridParams<T>,
): HeadlessGridResult<T> {
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

  const sort = signal<SortState>(initialSort ?? { field: '', direction: 'asc' });
  const filters = signal<IFilters>({ ...initialFilters });
  const page = signal(initialPage);
  const pageSize = signal(initialPageSize);

  const columns = normalize(columnsInput);
  const data = normalize(dataInput);

  const isServerSide = dataSource != null;

  // ── Server-side fetch state ────────────────────────────────────────
  const serverItems = signal<T[]>([]);
  const serverTotalCount = signal(0);
  const serverLoading = signal(isServerSide);
  const refreshCounter = signal(0);
  // Stale-fetch guard — only the latest write wins.
  let fetchId = 0;

  if (isServerSide && dataSource) {
    effect((onCleanup) => {
      // Read every signal we want to track for re-fetching.
      const p = page();
      const ps = pageSize();
      const s = sort();
      const f = filters();
      void refreshCounter();

      const id = ++fetchId;
      const controller = new AbortController();
      serverLoading.set(true);
      dataSource
        .fetchPage({
          page: p,
          pageSize: ps,
          sort: { field: s.field, direction: s.direction },
          filters: f,
          signal: controller.signal,
        })
        .then((res) => {
          if (id !== fetchId || controller.signal.aborted) return;
          serverItems.set(res.items);
          serverTotalCount.set(res.totalCount);
        })
        .catch((err) => {
          if (id !== fetchId || controller.signal.aborted) return;
          onError?.(err);
          serverItems.set([]);
          serverTotalCount.set(0);
        })
        .finally(() => {
          if (id === fetchId && !controller.signal.aborted) {
            serverLoading.set(false);
          }
        });

      onCleanup(() => controller.abort());
    });
  }

  // ── Client-side derivation (only used when isServerSide === false) ─
  const allFilteredRows = computed(() => {
    if (isServerSide) return serverItems();
    const sortField = sort().field;
    return processClientSideData(
      data(),
      columns(),
      filters(),
      sortField || undefined,
      sortField ? sort().direction : undefined,
    );
  });

  const totalCount = computed(() =>
    isServerSide ? serverTotalCount() : allFilteredRows().length,
  );
  const totalPages = computed(() =>
    Math.max(1, Math.ceil(totalCount() / pageSize())),
  );

  const rows = computed(() => {
    if (isServerSide) return serverItems();
    const start = (page() - 1) * pageSize();
    return allFilteredRows().slice(start, start + pageSize());
  });

  const refreshData = () => refreshCounter.update((n) => n + 1);

  // ── Actions ─────────────────────────────────────────────────────────
  const setPage = (p: number) => page.set(p);
  const setPageSize = (size: number) => {
    pageSize.set(size);
    page.set(1);
  };

  const setSort = (s: SortState) => {
    sort.set(s);
    page.set(1);
  };
  const toggleSort = (columnId: string) => {
    setSort(computeNextSortState(sort(), columnId));
  };

  const setFilters = (f: IFilters) => {
    filters.set(f);
    page.set(1);
  };
  const setFilter = (key: string, value: FilterValue | undefined) => {
    setFilters(mergeFilter(filters(), key, value));
  };

  const hasActiveFilters = computed(() =>
    Object.values(filters()).some((v) => v !== undefined),
  );

  // ── Cell helpers ────────────────────────────────────────────────────
  const columnMap = computed(() => {
    const m = new Map<string, IColumnDef<T>>();
    for (const col of columns()) m.set(col.columnId, col);
    return m;
  });

  const getCellValueFn = (row: T, columnId: string): unknown => {
    const col = columnMap().get(columnId);
    if (!col) return undefined;
    return coreGetCellValue(row, col);
  };

  const sortIndicator = (columnId: string): Signal<'▲' | '▼' | ''> =>
    computed(() => {
      if (sort().field !== columnId) return '';
      return sort().direction === 'asc' ? '▲' : '▼';
    });

  // ── Selection ───────────────────────────────────────────────────────
  const selectedRowIds = signal<Set<RowId>>(new Set());

  const isRowSelected = (row: T) => selectedRowIds().has(getRowId(row));

  const toggleRowSelection = (row: T) => {
    const id = getRowId(row);
    const next = new Set(selectedRowIds());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedRowIds.set(next);
  };

  const selectAllOnPage = () => {
    const next = new Set(selectedRowIds());
    for (const row of rows()) next.add(getRowId(row));
    selectedRowIds.set(next);
  };

  const clearSelection = () => selectedRowIds.set(new Set());

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
