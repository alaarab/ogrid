import type { IColumnDef } from '../types/columnTypes';

/**
 * Get the cell value for a row/column, using valueGetter when defined otherwise item[columnId].
 */
export function getCellValue<T>(item: T, col: IColumnDef<T>): unknown {
  if (col.valueGetter) return col.valueGetter(item);
  return (item as Record<string, unknown>)[col.columnId];
}
