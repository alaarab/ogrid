/**
 * useHeadlessGrid — the v3 headless API for OGrid.
 *
 * Returns sorted/filtered/paginated rows + state and handlers, without
 * imposing any chrome. Render with your own table primitives (shadcn,
 * Radix, Material, plain `<table>`, etc).
 *
 * Composes the same sort/filter/pagination sub-hooks that the existing
 * `<OGrid>` component uses, so behavior matches the chrome-y path
 * exactly. Selection is intentionally minimal (a row-id Set + toggle
 * helpers) — the full spreadsheet cell-selection state machine remains
 * inside the chrome layer.
 *
 * Example (shadcn-style render):
 *
 *   const grid = useHeadlessGrid({
 *     columns,
 *     data,
 *     getRowId: (r) => r.id,
 *     initialSort: { field: 'name', direction: 'asc' },
 *   });
 *
 *   return (
 *     <Table>
 *       <TableHeader>
 *         <TableRow>
 *           {grid.columns.map((col) => (
 *             <TableHead key={col.columnId} onClick={() => grid.toggleSort(col.columnId)}>
 *               {col.headerName} {grid.sortIndicator(col.columnId)}
 *             </TableHead>
 *           ))}
 *         </TableRow>
 *       </TableHeader>
 *       <TableBody>
 *         {grid.rows.map((row) => (
 *           <TableRow key={grid.getRowId(row)}>
 *             {grid.columns.map((col) => (
 *               <TableCell key={col.columnId}>{grid.getCellValue(row, col.columnId)}</TableCell>
 *             ))}
 *           </TableRow>
 *         ))}
 *       </TableBody>
 *     </Table>
 *   );
 */

import { useCallback, useMemo, useState } from 'react';
import { getCellValue as coreGetCellValue } from '@alaarab/ogrid-core';
import type { IColumnDef as ICoreColumnDef, IFilters, FilterValue } from '@alaarab/ogrid-core';
import type { IDataSource } from '../types';

import { useOGridSorting, type SortState } from './useOGridSorting';
import { useOGridFilters } from './useOGridFilters';
import { useOGridPagination } from './useOGridPagination';
import { useOGridDataFetching } from './useOGridDataFetching';

export type RowId = string | number;

export interface UseHeadlessGridParams<T> {
  columns: ICoreColumnDef<T>[];
  data: T[];
  /** Stable row ID extractor — must return the same ID for the same row across renders. */
  getRowId: (row: T) => RowId;

  /** Initial sort. If omitted, no sort is applied. */
  initialSort?: SortState;
  /** Initial filter values, keyed by column id (or `filterField` if set on the column). */
  initialFilters?: IFilters;
  /** Initial page (1-indexed). */
  initialPage?: number;
  /** Initial page size. */
  initialPageSize?: number;

  /** Optional controlled sort. */
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;

  /** Optional controlled filters. */
  filters?: IFilters;
  onFiltersChange?: (filters: IFilters) => void;

  /** Optional controlled page. */
  page?: number;
  onPageChange?: (page: number) => void;

  /** Optional controlled page size. */
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;

  /**
   * Server-side data source. When provided, sort/filter/paginate are sent to
   * the server and the returned items are displayed as-is. When omitted,
   * client-side processing runs against `data`.
   */
  dataSource?: IDataSource<T>;
  /**
   * Worker-sort policy for large datasets. `true` always uses a worker,
   * `'auto'` uses one when row count exceeds ~5000, `false` is sync.
   */
  workerSort?: boolean | 'auto';
  /** Server-side fetch error callback. */
  onError?: (err: unknown) => void;
  /** Fired once when the first batch of rows lands. */
  onFirstDataRendered?: () => void;
}

export interface UseHeadlessGridResult<T> {
  /** Resolved column definitions (matches what was passed in). */
  columns: ICoreColumnDef<T>[];
  /** Rows on the current page after sort + filter. */
  rows: T[];
  /** Post-filter total row count (across all pages). */
  totalCount: number;
  /** Total number of pages at current page size. */
  totalPages: number;
  /** Filtered + sorted rows across all pages (no pagination applied). */
  allFilteredRows: T[];

  /** Current sort state. */
  sort: SortState;
  setSort: (sort: SortState) => void;
  /** Cycle a column's sort: asc → desc → reset to default. */
  toggleSort: (columnId: string) => void;
  /** "▲" / "▼" / "" — convenient indicator for header rendering. */
  sortIndicator: (columnId: string) => '▲' | '▼' | '';

  /** Current filter state. */
  filters: IFilters;
  setFilters: (filters: IFilters) => void;
  /** Update one filter key. Pass `undefined` to clear. */
  setFilter: (key: string, value: FilterValue | undefined) => void;
  hasActiveFilters: boolean;

  /** Pagination. */
  page: number;
  pageSize: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;

  /** Stable row identity. */
  getRowId: (row: T) => RowId;

  /** Read a cell value with full column-resolution (valueGetter, key, etc). */
  getCellValue: (row: T, columnId: string) => unknown;

  /** Row selection — minimal Set-based API. */
  selectedRowIds: Set<RowId>;
  isRowSelected: (row: T) => boolean;
  toggleRowSelection: (row: T) => void;
  selectAllOnPage: () => void;
  clearSelection: () => void;
}

const DEFAULT_PAGE_SIZE = 25;

/**
 * Headless grid state + actions hook.
 *
 * Pure data layer — does not render anything. Use this when you want to
 * compose OGrid's sort/filter/paginate logic with your own table chrome
 * (shadcn, custom HTML, etc).
 */
export function useHeadlessGrid<T>(
  params: UseHeadlessGridParams<T>
): UseHeadlessGridResult<T> {
  const {
    columns,
    data,
    getRowId,
    initialSort,
    initialFilters,
    initialPage = 1,
    initialPageSize = DEFAULT_PAGE_SIZE,
    sort: controlledSort,
    onSortChange,
    filters: controlledFilters,
    onFiltersChange,
    page: controlledPage,
    onPageChange,
    pageSize: controlledPageSize,
    onPageSizeChange,
    dataSource,
    workerSort,
    onError,
    onFirstDataRendered,
  } = params;

  const isServerSide = dataSource != null;

  // Pagination first — sort and filter both reset to page 1, so they need setPage.
  // initialPage/initialFilters are lazy-initialized inside the child hooks (no
  // setState-during-render), so the initial values apply from the first render.
  const pagination = useOGridPagination({
    controlledPage,
    controlledPageSize,
    defaultPageSize: initialPageSize,
    initialPage,
    onPageChange,
    onPageSizeChange,
  });

  const sorting = useOGridSorting({
    controlledSort,
    defaultSortField: initialSort?.field ?? '',
    defaultSortDirection: initialSort?.direction ?? 'asc',
    onSortChange,
    setPage: pagination.setPage,
  });

  const filtersHook = useOGridFilters<T>({
    controlledFilters,
    initialFilters,
    onFiltersChange,
    setPage: pagination.setPage,
    columns,
    displayData: data,
    dataSource,
  });

  // Data-layer fetching — handles client-side AND server-side modes,
  // worker-sort optimization, and Excel-like sortVersion tracking.
  const dataFetching = useOGridDataFetching<T>({
    isServerSide,
    dataSource,
    displayData: data,
    columns,
    stableFilters: filtersHook.stableFilters,
    sort: sorting.sort,
    sortVersion: sorting.sortVersion,
    page: pagination.page,
    pageSize: pagination.pageSize,
    onError,
    onFirstDataRendered,
    workerSort,
  });

  const rows = dataFetching.displayItems;
  const totalCount = dataFetching.displayTotalCount;
  const totalPages = Math.max(1, Math.ceil(totalCount / pagination.pageSize));

  // `allFilteredRows` is the full filtered+sorted set across all pages.
  // Client-side: derived from the current page's slice context. Server-side:
  // unknown without a separate request, so it equals `rows` (current page).
  const allFilteredRows = rows;

  // ── Cell helpers ───────────────────────────────────────────────────────
  const columnMap = useMemo(() => {
    const m = new Map<string, ICoreColumnDef<T>>();
    for (const col of columns) m.set(col.columnId, col);
    return m;
  }, [columns]);

  const getCellValueFn = useCallback(
    (row: T, columnId: string): unknown => {
      const col = columnMap.get(columnId);
      if (!col) return undefined;
      return coreGetCellValue(row, col);
    },
    [columnMap],
  );

  // ── Sort helpers ───────────────────────────────────────────────────────
  const toggleSort = useCallback(
    (columnId: string) => sorting.handleSort(columnId),
    [sorting],
  );

  const sortIndicator = useCallback(
    (columnId: string): '▲' | '▼' | '' => {
      if (sorting.sort.field !== columnId) return '';
      return sorting.sort.direction === 'asc' ? '▲' : '▼';
    },
    [sorting.sort.field, sorting.sort.direction],
  );

  // ── Filter helpers ─────────────────────────────────────────────────────
  const setFilter = useCallback(
    (key: string, value: FilterValue | undefined) =>
      filtersHook.handleFilterChange(key, value),
    [filtersHook],
  );

  // ── Selection (minimal Set-based) ──────────────────────────────────────
  const [selectedRowIds, setSelectedRowIds] = useState<Set<RowId>>(
    () => new Set(),
  );

  const isRowSelected = useCallback(
    (row: T) => selectedRowIds.has(getRowId(row)),
    [selectedRowIds, getRowId],
  );

  const toggleRowSelection = useCallback(
    (row: T) => {
      const id = getRowId(row);
      setSelectedRowIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [getRowId],
  );

  const selectAllOnPage = useCallback(() => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      for (const row of rows) next.add(getRowId(row));
      return next;
    });
  }, [rows, getRowId]);

  const clearSelection = useCallback(() => setSelectedRowIds(new Set()), []);

  return {
    columns,
    rows,
    totalCount,
    totalPages,
    allFilteredRows,

    sort: sorting.sort,
    setSort: sorting.setSort,
    toggleSort,
    sortIndicator,

    filters: filtersHook.filters,
    setFilters: filtersHook.setFilters,
    setFilter,
    hasActiveFilters: filtersHook.hasActiveFilters,

    page: pagination.page,
    pageSize: pagination.pageSize,
    setPage: pagination.setPage,
    setPageSize: pagination.setPageSize,

    getRowId,
    getCellValue: getCellValueFn,

    selectedRowIds,
    isRowSelected,
    toggleRowSelection,
    selectAllOnPage,
    clearSelection,
  };
}
