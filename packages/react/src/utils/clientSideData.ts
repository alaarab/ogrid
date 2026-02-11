import type { IColumnDef, IFilters } from '../types';
import { getCellValue } from './cellValue';
import { getFilterField } from './ogridHelpers';

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
  // --- Filtering (single-pass: build predicates, then one .filter()) ---
  const predicates: ((row: T) => boolean)[] = [];

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    const filterKey = getFilterField(col);
    const val = filters[filterKey];
    if (!val) continue;

    switch (val.type) {
      case 'multiSelect':
        if (val.value.length > 0) {
          const allowedSet = new Set(val.value);
          predicates.push((r) => allowedSet.has(String(getCellValue(r, col))));
        }
        break;
      case 'text': {
        const trimmed = val.value.trim();
        if (trimmed) {
          const lower = trimmed.toLowerCase();
          predicates.push((r) => String(getCellValue(r, col) ?? '').toLowerCase().includes(lower));
        }
        break;
      }
      case 'people': {
        const email = val.value.email.toLowerCase();
        predicates.push((r) => String(getCellValue(r, col) ?? '').toLowerCase() === email);
        break;
      }
      case 'date': {
        const dv = val.value;
        predicates.push((r) => {
          const cellVal = getCellValue(r, col);
          if (cellVal == null) return false;
          const cellDate = new Date(String(cellVal));
          if (Number.isNaN(cellDate.getTime())) return false;
          const cellDateStr = cellDate.toISOString().split('T')[0];
          if (dv.from && cellDateStr < dv.from) return false;
          if (dv.to && cellDateStr > dv.to) return false;
          return true;
        });
        break;
      }
    }
  }

  let rows = predicates.length > 0
    ? data.filter((row) => {
        for (let i = 0; i < predicates.length; i++) {
          if (!predicates[i](row)) return false;
        }
        return true;
      })
    : data.slice();

  // --- Sorting ---
  if (sortBy) {
    const sortCol = columns.find((c) => c.columnId === sortBy);
    const compare = sortCol?.compare;
    const dir = sortDirection === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      if (compare) return compare(a, b) * dir;
      const av = sortCol
        ? getCellValue(a, sortCol)
        : (a as Record<string, unknown>)[sortBy];
      const bv = sortCol
        ? getCellValue(b, sortCol)
        : (b as Record<string, unknown>)[sortBy];
      if (av == null && bv == null) return 0;
      if (av == null) return -1 * dir;
      if (bv == null) return 1 * dir;
      if (sortCol?.type === 'date') {
        const at = new Date(String(av)).getTime();
        const bt = new Date(String(bv)).getTime();
        const aN = Number.isNaN(at) ? 0 : at;
        const bN = Number.isNaN(bt) ? 0 : bt;
        return aN === bN ? 0 : aN > bN ? dir : -dir;
      }
      if (typeof av === 'number' && typeof bv === 'number')
        return av === bv ? 0 : av > bv ? dir : -dir;
      const as = String(av).toLowerCase();
      const bs = String(bv).toLowerCase();
      return as === bs ? 0 : as > bs ? dir : -dir;
    });
  }

  return rows;
}
