import type { IColumnDef } from '../types/columnTypes';

/**
 * Get the cell value for a row/column, using valueGetter when defined otherwise item[columnId].
 *
 * @param item - The row data object.
 * @param col  - Column definition. If `valueGetter` is defined it takes priority;
 *               otherwise the value is read via `item[col.columnId]`.
 *               Assumes `columnId` is a valid key on the item when no `valueGetter` is provided.
 * @returns The raw cell value (`unknown`). May be `undefined` if the key does not exist on the item.
 */
export function getCellValue<T>(item: T, col: IColumnDef<T>): unknown {
  if (col.valueGetter) return col.valueGetter(item);
  return (item as Record<string, unknown>)[col.columnId];
}
