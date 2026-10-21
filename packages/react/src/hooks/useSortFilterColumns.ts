import { useRef } from 'react';
import type { IColumnDef } from '@alaarab/ogrid-core';

function sameFilterable(a: IColumnDef['filterable'], b: IColumnDef['filterable']): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a == null || b == null) return false;
  const ra = a as unknown as Record<string, unknown>;
  const rb = b as unknown as Record<string, unknown>;
  const keys = Object.keys(ra);
  if (keys.length !== Object.keys(rb).length) return false;
  return keys.every((key) => ra[key] === rb[key]);
}

/** Display fields the quick filter matches against (it searches the shown text). */
type SearchField = 'valueFormatter' | 'dateFormat';

/** True when two column lists filter and sort rows identically (render-only fields are ignored). */
function sameSortFilterColumns<T>(a: IColumnDef<T>[], b: IColumnDef<T>[], extra: readonly SearchField[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] as IColumnDef<T>;
    const y = b[i] as IColumnDef<T>;
    if (x === y) continue;
    if (
      x.columnId !== y.columnId ||
      x.type !== y.type ||
      x.valueGetter !== y.valueGetter ||
      x.compare !== y.compare ||
      !sameFilterable(x.filterable, y.filterable) ||
      extra.some((field) => x[field] !== y[field])
    ) return false;
  }
  return true;
}

const NO_FIELDS: readonly SearchField[] = [];

/** Pass as `extraFields` for columns the quick filter searches: their shown text matters too. */
export const QUICK_FILTER_FIELDS: readonly SearchField[] = ['valueFormatter', 'dateFormat'];

/**
 * The columns to filter and sort with. Keeps the previous array while only
 * render fields changed (e.g. an inline `columns` prop with inline `renderCell`),
 * so the grid doesn't re-filter, re-sort and re-derive filter options on every
 * render, and an edited row keeps its place until the user sorts again.
 */
export function useSortFilterColumns<T>(columns: IColumnDef<T>[], extraFields: readonly SearchField[] = NO_FIELDS): IColumnDef<T>[] {
  const ref = useRef(columns);
  if (ref.current !== columns && !sameSortFilterColumns(ref.current, columns, extraFields)) {
    ref.current = columns;
  }
  return ref.current;
}
