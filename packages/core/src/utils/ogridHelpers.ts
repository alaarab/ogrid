import type { IColumnDef, IFilters, FilterValue } from '../types';
import { getCellValue } from './cellValue';

/** Resolve the filter field key for a column (filterField or columnId). */
export function getFilterField<T>(col: IColumnDef<T>): string {
  const f = col.filterable && typeof col.filterable === 'object' ? col.filterable : null;
  return (f?.filterField ?? col.columnId) as string;
}

/** Merge a single filter change into a full IFilters object. Strips empty values automatically. */
export function mergeFilter(
  prev: IFilters,
  key: string,
  value: FilterValue | undefined
): IFilters {
  const next = { ...prev };
  const isEmpty =
    value === undefined ||
    (value.type === 'text' && value.value.trim() === '') ||
    (value.type === 'multiSelect' && value.value.length === 0) ||
    (value.type === 'date' && !value.value.from && !value.value.to);
  if (isEmpty) {
    delete next[key];
  } else {
    next[key] = value;
  }
  return next;
}

/** Derive filter options for multiSelect columns from client-side data. */
export function deriveFilterOptionsFromData<T>(
  items: T[],
  columns: IColumnDef<T>[]
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  columns.forEach((col) => {
    const f = col.filterable && typeof col.filterable === 'object' ? col.filterable : null;
    if (f?.type !== 'multiSelect') return;
    const field = getFilterField(col);
    const values = new Set<string>();
    items.forEach((item) => {
      const v = getCellValue(item, col);
      if (v != null && v !== '') values.add(String(v));
    });
    out[field] = Array.from(values).sort();
  });
  return out;
}

/** Get list of filter fields that use multiSelect (for useFilterOptions). */
export function getMultiSelectFilterFields<T>(columns: IColumnDef<T>[]): string[] {
  const fields: string[] = [];
  columns.forEach((col) => {
    const f = col.filterable && typeof col.filterable === 'object' ? col.filterable : null;
    if (f?.type === 'multiSelect') fields.push(getFilterField(col));
  });
  return fields;
}
