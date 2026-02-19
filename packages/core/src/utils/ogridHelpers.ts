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
    (value.type === 'date' && !value.value.from && !value.value.to) ||
    (value.type === 'people' && !value.value);
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
  // Collect multiSelect columns upfront
  const filterCols: { col: IColumnDef<T>; field: string }[] = [];
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    const f = col.filterable && typeof col.filterable === 'object' ? col.filterable : null;
    if (f?.type === 'multiSelect') {
      filterCols.push({ col, field: getFilterField(col) });
    }
  }
  if (filterCols.length === 0) return {};

  // Single pass through items, collecting values for all filter columns simultaneously
  const valueSets = new Map<string, Set<string>>();
  for (let i = 0; i < filterCols.length; i++) {
    valueSets.set(filterCols[i].field, new Set<string>());
  }
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    for (let j = 0; j < filterCols.length; j++) {
      const v = getCellValue(item, filterCols[j].col);
      if (v != null && v !== '') valueSets.get(filterCols[j].field)!.add(String(v));
    }
  }

  const out: Record<string, string[]> = {};
  for (let i = 0; i < filterCols.length; i++) {
    out[filterCols[i].field] = Array.from(valueSets.get(filterCols[i].field)!).sort();
  }
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
