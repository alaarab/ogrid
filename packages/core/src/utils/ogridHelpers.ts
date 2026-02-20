import type { IColumnDef, IColumnFilterDef, IFilters, FilterValue } from '../types';
import { getCellValue } from './cellValue';

/** Type guard: returns true if val is an IColumnFilterDef (an object with a filter type). */
export function isFilterConfig(val: unknown): val is IColumnFilterDef {
  return val != null && typeof val === 'object' && 'type' in val;
}

/** Resolve the filter field key for a column (filterField or columnId). */
export function getFilterField<T>(col: IColumnDef<T>): string {
  const f = isFilterConfig(col.filterable) ? col.filterable : null;
  return (f?.filterField ?? col.columnId) as string;
}

/** Merge a single filter change into a full IFilters object. Strips empty values automatically. */
export function mergeFilter(
  prev: IFilters,
  key: string,
  value: FilterValue | undefined
): IFilters {
  const isEmpty =
    value === undefined ||
    (value.type === 'text' && value.value.trim() === '') ||
    (value.type === 'multiSelect' && value.value.length === 0) ||
    (value.type === 'date' && !value.value.from && !value.value.to) ||
    (value.type === 'people' && !value.value);
  if (isEmpty) {
    const { [key]: _, ...rest } = prev;
    return rest;
  }
  return { ...prev, [key]: value };
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
    const f = isFilterConfig(col.filterable) ? col.filterable : null;
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
      const set = valueSets.get(filterCols[j].field);
      if (v != null && v !== '' && set) set.add(String(v));
    }
  }

  const out: Record<string, string[]> = {};
  for (let i = 0; i < filterCols.length; i++) {
    const set = valueSets.get(filterCols[i].field);
    out[filterCols[i].field] = set ? Array.from(set).sort() : [];
  }
  return out;
}

/** Get list of filter fields that use multiSelect (for useFilterOptions). */
export function getMultiSelectFilterFields<T>(columns: IColumnDef<T>[]): string[] {
  const fields: string[] = [];
  for (const col of columns) {
    const f = isFilterConfig(col.filterable) ? col.filterable : null;
    if (f?.type === 'multiSelect') fields.push(getFilterField(col));
  }
  return fields;
}
