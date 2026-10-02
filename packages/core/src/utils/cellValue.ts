import type { IColumnDef } from '../types/columnTypes';
import type { IGridDataAccessor } from '../formula/types';
import type { RowId } from '../types/dataGridTypes';

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
      const item = items[row];
      const colDef = flatColumns[col];
      if (item === undefined || colDef === undefined) return null;
      return getCellValue(item, colDef);
    },
    getRowCount: () => items.length,
    getColumnCount: () => flatColumns.length,
  };
}

/**
 * Translates rows between the grid's view and the formula engine.
 *
 * Formulas, A1 references, row numbers and the name box all use "sheet"
 * coordinates: the column is the column's index in the flat column
 * definitions (so hiding, reordering or pinning columns doesn't move it) and
 * the row is the record's index in the full, unsorted, unfiltered data. The
 * grid renders a view of that sheet (the current page of the sorted and
 * filtered rows); this map converts between the two, so a formula stays with
 * its record through sort, filter and paging.
 */
export interface IFormulaRowMap {
  /** Sheet row of the record at `displayRow` (its index in the grid's `items`), or -1. */
  toSheetRow(displayRow: number): number;
  /** Display row of `sheetRow`, or -1 when it is filtered out or on another page. */
  toDisplayRow(sheetRow: number): number;
}

/**
 * Build an IFormulaRowMap for displayed rows drawn from a client-side data
 * set. `sheetRowById` maps each row id to its index in the full data.
 */
export function createFormulaRowMap<T>(
  sheetRowById: ReadonlyMap<RowId, number>,
  displayItems: readonly T[],
  getRowId: (item: T) => RowId,
): IFormulaRowMap {
  const sheetRows = new Array<number>(displayItems.length);
  const displayRows = new Map<number, number>();
  for (let i = 0; i < displayItems.length; i++) {
    const item = displayItems[i];
    const sheetRow = item === undefined ? -1 : (sheetRowById.get(getRowId(item)) ?? -1);
    sheetRows[i] = sheetRow;
    if (sheetRow >= 0) displayRows.set(sheetRow, i);
  }
  return {
    toSheetRow: (displayRow) => sheetRows[displayRow] ?? -1,
    toDisplayRow: (sheetRow) => displayRows.get(sheetRow) ?? -1,
  };
}

/**
 * IFormulaRowMap for a page of `count` rows that starts at sheet row `offset`
 * (server-side data, where only the current page is loaded).
 */
export function createOffsetFormulaRowMap(offset: number, count: number): IFormulaRowMap {
  return {
    toSheetRow: (displayRow) => (displayRow >= 0 && displayRow < count ? offset + displayRow : -1),
    toDisplayRow: (sheetRow) => {
      const displayRow = sheetRow - offset;
      return displayRow >= 0 && displayRow < count ? displayRow : -1;
    },
  };
}
