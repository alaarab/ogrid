import type { IColumnDef } from '../types/columnTypes';
import type { IGridDataAccessor } from '../formula/types';

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

/**
 * Check whether a column is editable for a given row item.
 * Handles both boolean and function-based `editable` definitions.
 */
export function isColumnEditable<T>(col: IColumnDef<T>, item: T): boolean {
  return col.editable === true || (typeof col.editable === 'function' && col.editable(item));
}

/**
 * Create an IGridDataAccessor from items and flat columns.
 * Shared factory used by the formula engine integration.
 */
export function createGridDataAccessor<T>(
  items: T[],
  flatColumns: IColumnDef<T>[],
): IGridDataAccessor {
  return {
    getCellValue: (col: number, row: number): unknown => {
      if (row < 0 || row >= items.length) return null;
      if (col < 0 || col >= flatColumns.length) return null;
      return getCellValue(items[row], flatColumns[col]);
    },
    getRowCount: () => items.length,
    getColumnCount: () => flatColumns.length,
  };
}
