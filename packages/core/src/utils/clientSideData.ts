import type { IColumnDef, IFilters, ISortModelItem } from '../types';
import { getCellValue } from './cellValue';
import { createConditionPredicate } from './conditionFilter';
import { normalizeSortModel } from './sortHelpers';
import { formatCellValue } from './cellFormatting';
import { getFilterField } from './ogridHelpers';
import { compareSortKeys, compareTimestamps, toDateTimestamp, toSortKey, createSortCollator } from '../workers/sortFilterPrimitives';

const sortCollator = createSortCollator();

// Shared with the Web Worker path so both sort and filter identically.
export { toDateTimestamp };

/**
 * Cached column map to avoid rebuilding on every call.
 * WeakMap keyed by columns array reference.
 */
const columnMapCache = new WeakMap<IColumnDef<unknown>[], Map<string, IColumnDef<unknown>>>();

/**
 * Apply client-side filtering and sorting to data.
 * Extracted from useOGrid for testability and reuse.
 *
 * @param data - The full dataset to process
 * @param columns - Column definitions (used for filtering and sorting)
 * @param filters - Current filter state (discriminated FilterValue union)
 * @param sortBy - Column ID to sort by, or a multi-level sort model (primary first). Optional.
 * @param sortDirection - Sort direction when `sortBy` is a column ID (default ascending)
 * @returns Filtered and sorted array
 */
export function processClientSideData<T>(
  data: T[],
  columns: IColumnDef<T>[],
  filters: IFilters,
  sortBy?: string | readonly ISortModelItem[],
  sortDirection?: 'asc' | 'desc'
): T[] {
  // Get or build column lookup map (cached via WeakMap)
  let columnMap = columnMapCache.get(columns as IColumnDef<unknown>[]) as Map<string, IColumnDef<T>> | undefined;
  if (!columnMap) {
    columnMap = new Map<string, IColumnDef<T>>();
    for (let i = 0; i < columns.length; i++) {
      const c = columns[i];
      if (c === undefined) continue;
      columnMap.set(c.columnId, c);
    }
    columnMapCache.set(columns as IColumnDef<unknown>[], columnMap as Map<string, IColumnDef<unknown>>);
  }

  // --- Filtering (single-pass: build predicates, then one .filter()) ---
  // Each predicate reads its cell value inline, so a row rejected by an earlier
  // filter is never read by later ones (no per-filter whole-dataset caches).
  const predicates: ((row: T) => boolean)[] = [];

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    if (col === undefined) continue;
    const filterKey = getFilterField(col);
    const val = filters[filterKey];
    if (!val) continue;

    switch (val.type) {
      case 'multiSelect':
        // Cell values are coerced to string; null/undefined share the empty-string blank option.
        // Object-typed column values will produce "[object Object]"  -  use valueGetter or
        // valueFormatter on the column def to ensure meaningful string representation.
        if (val.value.length > 0) {
          const allowedSet = new Set(val.value);
          predicates.push((r) => allowedSet.has(String(getCellValue(r, col) ?? '')));
        }
        break;
      case 'text': {
        const trimmed = val.value.trim();
        if (trimmed) {
          const lower = trimmed.toLowerCase();
          // A row passes when its raw value or its displayed text contains the query.
          // The formatter only runs when the raw value doesn't match.
          predicates.push((r) => {
            const v = getCellValue(r, col);
            return (
              String(v ?? '').toLowerCase().includes(lower) ||
              (formatCellValue(v, r, col) ?? '').toLowerCase().includes(lower)
            );
          });
        }
        break;
      }
      case 'people': {
        const email = val.value.email.toLowerCase();
        predicates.push((r) => String(getCellValue(r, col) ?? '').toLowerCase() === email);
        break;
      }
      case 'condition': {
        // Top N and above/below average compare against every row passed in,
        // before the other columns' filters.
        const matches = createConditionPredicate(val.value, () => data.map((r) => getCellValue(r, col)));
        if (matches) predicates.push((r) => matches(getCellValue(r, col)));
        break;
      }
      case 'date': {
        const dv = val.value;
        // Pre-compute filter boundary timestamps to avoid repeated Date parsing in the filter loop
        const fromTs = dv.from ? new Date(dv.from + 'T00:00:00Z').getTime() : NaN;
        const toTs = dv.to ? new Date(dv.to + 'T23:59:59.999Z').getTime() : NaN;
        predicates.push((r) => {
          const cellTs = toDateTimestamp(getCellValue(r, col));
          if (Number.isNaN(cellTs)) return false;
          if (!Number.isNaN(fromTs) && cellTs < fromTs) return false;
          if (!Number.isNaN(toTs) && cellTs > toTs) return false;
          return true;
        });
        break;
      }
    }
  }

  const filtered = predicates.length > 0;
  const rows = filtered
    ? data.filter((row) => {
        for (let i = 0; i < predicates.length; i++) {
          const predicate = predicates[i];
          if (predicate !== undefined && !predicate(row)) return false;
        }
        return true;
      })
    : data;

  // --- Sorting ---
  // Default to ascending when unspecified, matching the worker path in
  // workerSortFilter.ts  -  otherwise the same grid sorts in opposite
  // directions depending on whether the async path was taken.
  const levels = normalizeSortModel(sortBy, sortDirection);
  if (levels.length === 0) return rows;

  // Copy before sorting if we didn't filter (filter already creates a new array).
  // This avoids mutating the caller's original data array.
  const sortable = filtered ? rows : rows.slice();
  const comparators = levels.map((level) => buildLevelComparator(sortable, columnMap.get(level.field), level.field, level.direction === 'desc' ? -1 : 1));
  const first = comparators[0];
  if (comparators.length === 1 && first) {
    sortable.sort(first);
  } else {
    // Later levels only break ties of earlier ones; Array#sort is stable, so
    // rows equal on every level keep their data order.
    sortable.sort((a, b) => {
      for (let i = 0; i < comparators.length; i++) {
        const r = (comparators[i] as (a: T, b: T) => number)(a, b);
        if (r !== 0) return r;
      }
      return 0;
    });
  }
  return sortable;
}

/**
 * Comparator for one sort level. Keys are precomputed once per row so the
 * O(n log n) comparisons don't re-read or re-parse cell values. Caches are
 * scoped to this call, so mutating rows between calls is safe.
 */
function buildLevelComparator<T>(
  rows: T[],
  sortCol: IColumnDef<T> | undefined,
  field: string,
  dir: number,
): (a: T, b: T) => number {
  const compare = sortCol?.compare;
  if (compare) return (a, b) => compare(a, b) * dir;
  const read = (row: T): unknown => (sortCol ? getCellValue(row, sortCol) : (row as Record<string, unknown>)[field]);

  if (sortCol?.type === 'date') {
    // Invalid dates stay NaN so they group with nulls (first in asc order),
    // matching the date filter instead of sorting as 1970.
    const timestampCache = new Map<T, number>();
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row !== undefined) timestampCache.set(row, toDateTimestamp(read(row)));
    }
    return (a, b) => compareTimestamps(timestampCache.get(a) ?? NaN, timestampCache.get(b) ?? NaN) * dir;
  }

  // Numbers keep their raw form; text is lowercased once. null/undefined map
  // to `undefined` so they stay distinct from empty strings.
  const keyCache = new Map<T, string | number | undefined>();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row !== undefined) keyCache.set(row, toSortKey(read(row)));
  }
  return (a, b) => compareSortKeys(keyCache.get(a), keyCache.get(b), sortCollator) * dir;
}
