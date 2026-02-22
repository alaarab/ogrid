/**
 * Pure fill handle helpers shared across React, Vue, Angular, and JS.
 * No framework dependencies — operates on plain arrays and column definitions.
 */
import type { IColumnDef, ICellValueChangedEvent } from '../types/columnTypes';
import type { ISelectionRange } from '../types/dataGridTypes';
import { getCellValue, isColumnEditable } from './cellValue';
import { parseValue } from './valueParsers';

/**
 * Apply fill values from a source cell across a normalized selection range.
 * Copies the value from the start cell of the range to every other editable cell.
 *
 * @param range           The normalized fill range (startRow/startCol is the source).
 * @param sourceRow       The original source row index (skipped during fill).
 * @param sourceCol       The original source col index (skipped during fill).
 * @param items           Array of all row data objects.
 * @param visibleCols     Visible column definitions.
 * @returns Array of cell value changed events to apply. Empty if source cell is out of bounds.
 */
export function applyFillValues<T>(
  range: ISelectionRange,
  sourceRow: number,
  sourceCol: number,
  items: T[],
  visibleCols: IColumnDef<T>[]
): ICellValueChangedEvent<T>[] {
  const events: ICellValueChangedEvent<T>[] = [];
  const startItem = items[range.startRow];
  const startColDef = visibleCols[range.startCol];
  if (!startItem || !startColDef) return events;

  const startValue = getCellValue(startItem, startColDef);

  for (let row = range.startRow; row <= range.endRow; row++) {
    for (let col = range.startCol; col <= range.endCol; col++) {
      if (row === sourceRow && col === sourceCol) continue;
      if (row >= items.length || col >= visibleCols.length) continue;
      const item = items[row];
      const colDef = visibleCols[col];
      if (!isColumnEditable(colDef, item)) continue;
      const oldValue = getCellValue(item, colDef);
      const result = parseValue(startValue, oldValue, item, colDef);
      if (!result.valid) continue;
      events.push({
        item,
        columnId: colDef.columnId,
        oldValue,
        newValue: result.value,
        rowIndex: row,
      });
    }
  }
  return events;
}
