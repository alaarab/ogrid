import type { IColumnDef, IColumnGroupDef } from '../types/columnTypes';

function isColumnGroupDef<T>(
  c: IColumnGroupDef<T> | IColumnDef<T>
): c is IColumnGroupDef<T> {
  return 'children' in c && Array.isArray((c as IColumnGroupDef<T>).children);
}

/**
 * Flattens a tree of column groups and column definitions into a single array of leaf columns.
 * Used for body rendering and when the grid accepts grouped columns.
 */
export function flattenColumns<T>(
  columns: (IColumnGroupDef<T> | IColumnDef<T>)[]
): IColumnDef<T>[] {
  const result: IColumnDef<T>[] = [];
  for (const c of columns) {
    if (isColumnGroupDef(c)) {
      result.push(...flattenColumns(c.children));
    } else {
      result.push(c);
    }
  }
  return result;
}
