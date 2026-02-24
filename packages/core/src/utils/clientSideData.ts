import type { IColumnDef, IFilters } from '../types';
import { getCellValue } from './cellValue';
import { getFilterField } from './ogridHelpers';

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
 * @param sortBy - Column ID to sort by (optional)
 * @param sortDirection - Sort direction (optional)
 * @returns Filtered and sorted array
 */
export function processClientSideData<T>(
  data: T[],
  columns: IColumnDef<T>[],
  filters: IFilters,
  sortBy?: string,
  sortDirection?: 'asc' | 'desc'
): T[] {
  // Get or build column lookup map (cached via WeakMap)
  let columnMap = columnMapCache.get(columns as IColumnDef<unknown>[]) as Map<string, IColumnDef<T>> | undefined;
  if (!columnMap) {
    columnMap = new Map<string, IColumnDef<T>>();
    for (let i = 0; i < columns.length; i++) {
      columnMap.set(columns[i].columnId, columns[i]);
    }
    columnMapCache.set(columns as IColumnDef<unknown>[], columnMap as Map<string, IColumnDef<unknown>>);
  }

  // --- Filtering (single-pass: build predicates, then one .filter()) ---
  const predicates: ((row: T) => boolean)[] = [];

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    const filterKey = getFilterField(col);
    const val = filters[filterKey];
    if (!val) continue;

    switch (val.type) {
      case 'multiSelect':
        // NOTE: Cell values are coerced to string via String() for set membership checks.
        // Object-typed column values will produce "[object Object]" — use valueGetter or
        // valueFormatter on the column def to ensure meaningful string representation.
        if (val.value.length > 0) {
          const allowedSet = new Set(val.value);
          predicates.push((r) => allowedSet.has(String(getCellValue(r, col))));
        }
        break;
      case 'text': {
        const trimmed = val.value.trim();
        if (trimmed) {
          const lower = trimmed.toLowerCase();
          // Schwartzian transform: pre-compute lowercase strings to avoid
          // O(n) String() + toLowerCase() inside every filter predicate call.
          const textCache = new Map<T, string>();
          for (let j = 0; j < data.length; j++) {
            textCache.set(data[j], String(getCellValue(data[j], col) ?? '').toLowerCase());
          }
          predicates.push((r) => (textCache.get(r) ?? '').includes(lower));
        }
        break;
      }
      case 'people': {
        const email = val.value.email.toLowerCase();
        // Pre-compute lowercase strings for people filter
        const peopleCache = new Map<T, string>();
        for (let j = 0; j < data.length; j++) {
          peopleCache.set(data[j], String(getCellValue(data[j], col) ?? '').toLowerCase());
        }
        predicates.push((r) => (peopleCache.get(r) ?? '') === email);
        break;
      }
      case 'date': {
        const dv = val.value;
        // Pre-compute filter boundary timestamps to avoid repeated Date parsing in the filter loop
        const fromTs = dv.from ? new Date(dv.from + 'T00:00:00').getTime() : NaN;
        const toTs = dv.to ? new Date(dv.to + 'T23:59:59.999').getTime() : NaN;
        // Pre-compute cell timestamps (same pattern as sort) to avoid N Date allocations
        const dateCache = new Map<T, number>();
        for (let j = 0; j < data.length; j++) {
          const cellVal = getCellValue(data[j], col);
          if (cellVal == null) {
            dateCache.set(data[j], NaN);
          } else {
            const t = new Date(String(cellVal)).getTime();
            dateCache.set(data[j], Number.isNaN(t) ? NaN : t);
          }
        }
        predicates.push((r) => {
          const cellTs = dateCache.get(r) ?? NaN;
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
          if (!predicates[i](row)) return false;
        }
        return true;
      })
    : data;

  // --- Sorting ---
  if (sortBy) {
    // Copy before sorting if we didn't filter (filter already creates a new array).
    // This avoids mutating the caller's original data array.
    const sortable = filtered ? rows : rows.slice();
    const sortCol = columnMap.get(sortBy);
    const compare = sortCol?.compare;
    const dir = sortDirection === 'asc' ? 1 : -1;
    const isDateSort = sortCol?.type === 'date';

    // For date columns, pre-compute timestamps to avoid repeated new Date() in O(n log n) comparisons.
    // NOTE: The timestamp cache is scoped to this single sort invocation. It is rebuilt on every call,
    // so mutating row objects between calls is safe — stale timestamps cannot persist across invocations.
    if (isDateSort && !compare) {
      const timestampCache = new Map<T, number>();
      for (let i = 0; i < sortable.length; i++) {
        const row = sortable[i];
        const val = sortCol ? getCellValue(row, sortCol) : (row as Record<string, unknown>)[sortBy];
        if (val == null) {
          timestampCache.set(row, NaN);
        } else {
          const t = new Date(String(val)).getTime();
          timestampCache.set(row, Number.isNaN(t) ? 0 : t);
        }
      }
      sortable.sort((a, b) => {
        const at = timestampCache.get(a) ?? NaN;
        const bt = timestampCache.get(b) ?? NaN;
        if (Number.isNaN(at) && Number.isNaN(bt)) return 0;
        if (Number.isNaN(at)) return -1 * dir;
        if (Number.isNaN(bt)) return 1 * dir;
        return at === bt ? 0 : at > bt ? dir : -dir;
      });
    } else if (!compare) {
      // Pre-compute sort keys before sort to avoid repeated String().toLowerCase()
      // in O(n log n) comparisons. Numeric values use their raw form (no string conversion needed).
      // NOTE: Cache is scoped to this sort invocation — rebuilt on every call, safe for mutations.
      // We use `undefined` as a sentinel for null/undefined cell values so we can distinguish
      // them from empty strings (both null and undefined map to undefined here).
      const keyCache = new Map<T, string | number | undefined>();
      for (let i = 0; i < sortable.length; i++) {
        const row = sortable[i];
        const v = sortCol
          ? getCellValue(row, sortCol)
          : (row as Record<string, unknown>)[sortBy];
        if (v == null) {
          keyCache.set(row, undefined);
        } else if (typeof v === 'number') {
          keyCache.set(row, v);
        } else {
          keyCache.set(row, String(v).toLowerCase());
        }
      }
      sortable.sort((a, b) => {
        const av = keyCache.get(a);
        const bv = keyCache.get(b);
        if (av === undefined && bv === undefined) return 0;
        if (av === undefined) return -1 * dir;
        if (bv === undefined) return 1 * dir;
        if (typeof av === 'number' && typeof bv === 'number')
          return av === bv ? 0 : av > bv ? dir : -dir;
        return av === bv ? 0 : (av as string) > (bv as string) ? dir : -dir;
      });
    } else {
      sortable.sort((a, b) => compare(a, b) * dir);
    }
    return sortable;
  }

  return rows;
}
