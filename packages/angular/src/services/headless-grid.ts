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

import { signal, computed, type Signal, type WritableSignal } from '@angular/core';
import {
  processClientSideData,
  getCellValue as coreGetCellValue,
  computeNextSortState,
  mergeFilter,
} from '@alaarab/ogrid-core';
import type { IColumnDef, IFilters, FilterValue } from '@alaarab/ogrid-core';

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
  } = params;

  const sort = signal<SortState>(initialSort ?? { field: '', direction: 'asc' });
  const filters = signal<IFilters>({ ...initialFilters });
  const page = signal(initialPage);
  const pageSize = signal(initialPageSize);

  const columns = normalize(columnsInput);
  const data = normalize(dataInput);

  const allFilteredRows = computed(() => {
    const sortField = sort().field;
    return processClientSideData(
      data(),
      columns(),
      filters(),
      sortField || undefined,
      sortField ? sort().direction : undefined,
    );
  });

  const totalCount = computed(() => allFilteredRows().length);
  const totalPages = computed(() =>
    Math.max(1, Math.ceil(totalCount() / pageSize())),
  );

  const rows = computed(() => {
    const start = (page() - 1) * pageSize();
    return allFilteredRows().slice(start, start + pageSize());
  });

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
  };
}
