/**
 * Pure fill handle helpers shared across React, Vue, Angular, and JS.
 * No framework dependencies  -  operates on plain arrays and column definitions.
 */
import type { IColumnDef, ICellValueChangedEvent } from '../types/columnTypes';
import type { ISelectionRange } from '../types/dataGridTypes';
import { getCellValue, isColumnEditable } from './cellValue';
import { parseValue } from './valueParsers';
import { normalizeSelectionRange } from '../types';
import { adjustFormulaReferences } from '../formula/cellAddressUtils';

/**
 * Check whether two columns are type-compatible for fill operations.
 *
 * Columns are compatible when they share the same built-in type AND the same cellEditor.
 * This prevents dragging a text value onto a color picker, or a rating onto a date field.
 */
export function areFillCompatible<T>(source: IColumnDef<T>, target: IColumnDef<T>): boolean {
  if (source.columnId === target.columnId) return true;

  // Built-in type must match (undefined counts as 'text')
  const srcType = source.type ?? 'text';
  const tgtType = target.type ?? 'text';
  if (srcType !== tgtType) return false;

  // If either column uses a custom cell editor, they must use the same one.
  // Built-in string editors (like 'select') are compared by value equality.
  // Framework component editors are compared by reference equality, which works
  // because column defs reuse the same component import.
  if (source.cellEditor !== target.cellEditor) return false;

  return true;
}

/**
 * Options for formula-aware fill. When provided, source cells with formulas will
 * have their relative references adjusted instead of copying raw values.
 */
export interface IFillFormulaOptions<T> {
  /** Flat (unfiltered) column list used to map visible col indices to formula storage indices. */
  flatColumns: IColumnDef<T>[];
  /** Returns the formula string for a given (flatColIndex, rowIndex), or undefined if none. */
  getFormula?: (col: number, row: number) => string | undefined;
  /** Returns true if the cell at (flatColIndex, rowIndex) has a formula. */
  hasFormula?: (col: number, row: number) => boolean;
  /** Sets or clears the formula at (flatColIndex, rowIndex). Pass null to clear. */
  setFormula?: (col: number, row: number, formula: string | null) => void;
  /**
   * Sheet row of a displayed row. Relative references shift by the sheet
   * distance between source and target, which differs from the on-screen
   * distance once rows are sorted or filtered. Defaults to the display row.
   */
  formulaRow?: (rowIndex: number) => number;
}

/**
 * Apply fill values across a normalized selection range.
 *
 * Without `sourceRange`, copies the value of the single source cell
 * (`sourceRow`/`sourceCol`, which may be any cell of the range, e.g. the
 * bottom cell of an upward fill) to every other editable cell.
 *
 * With `sourceRange` (the original selection the fill extends), the source
 * block is tiled over the rest of `range` (Excel semantics): each target cell
 * takes the value of the source cell at the same offset modulo the block size,
 * and the source cells themselves are never overwritten. Ctrl+D passes the
 * top row of the selection as `sourceRange`, so each column's top cell is
 * copied down that column.
 *
 * If formulaOptions is provided and a source cell has a formula, relative references
 * in the formula are adjusted for each target cell instead of copying the raw value.
 *
 * @param range           The normalized fill range (contains the source cell/range).
 * @param sourceRow       The original source row index (skipped during fill).
 * @param sourceCol       The original source col index (skipped during fill).
 * @param items           Array of all row data objects.
 * @param visibleCols     Visible column definitions.
 * @param formulaOptions  Optional formula-aware fill configuration.
 * @param sourceRange     Optional normalized source block to tile across `range`.
 * @returns Array of cell value changed events to apply. Empty if source cell is out of bounds.
 */
export function applyFillValues<T>(
  range: ISelectionRange,
  sourceRow: number,
  sourceCol: number,
  items: T[],
  visibleCols: IColumnDef<T>[],
  formulaOptions?: IFillFormulaOptions<T>,
  sourceRange?: ISelectionRange
): ICellValueChangedEvent<T>[] {
  const events: ICellValueChangedEvent<T>[] = [];
  const src = sourceRange ? normalizeSelectionRange(sourceRange) : null;
  const srcHeight = src ? src.endRow - src.startRow + 1 : 1;
  const srcWidth = src ? src.endCol - src.startCol + 1 : 1;
  if (!items[sourceRow] || !visibleCols[sourceCol]) return events;

  // Precompute columnId -> flat index once instead of findIndex per filled cell
  // (a large fill over a wide grid was O(cells x flatColumns)).
  const flatColIndexById = formulaOptions
    ? new Map(formulaOptions.flatColumns.map((c, i) => [c.columnId, i] as const))
    : null;

  for (let row = range.startRow; row <= range.endRow; row++) {
    for (let col = range.startCol; col <= range.endCol; col++) {
      let srcRow = sourceRow;
      let srcCol = sourceCol;
      if (src) {
        if (row >= src.startRow && row <= src.endRow && col >= src.startCol && col <= src.endCol) continue;
        srcRow = src.startRow + ((((row - src.startRow) % srcHeight) + srcHeight) % srcHeight);
        srcCol = src.startCol + ((((col - src.startCol) % srcWidth) + srcWidth) % srcWidth);
      } else if (row === sourceRow && col === sourceCol) {
        continue;
      }
      const startItem = items[srcRow];
      const startColDef = visibleCols[srcCol];
      if (!startItem || !startColDef) continue;
      if (row >= items.length || col >= visibleCols.length) continue;
      const item = items[row];
      const colDef = visibleCols[col];
      if (item === undefined || colDef === undefined) continue;
      if (!areFillCompatible(startColDef, colDef)) continue;
      if (!isColumnEditable(colDef, item)) continue;

      // Formula-aware path: if source cell has a formula, adjust and propagate it
      if (formulaOptions?.hasFormula && formulaOptions.getFormula && formulaOptions.setFormula) {
        const srcFlatColIndex = flatColIndexById?.get(startColDef.columnId) ?? -1;
        if (srcFlatColIndex >= 0 && formulaOptions.hasFormula(srcFlatColIndex, srcRow)) {
          const srcFormula = formulaOptions.getFormula(srcFlatColIndex, srcRow);
          if (srcFormula) {
            const targetFlatColIdx = flatColIndexById?.get(colDef.columnId) ?? -1;
            // Shift references by the sheet distance from this cell's own (tiled)
            // source cell: flat columns and sheet rows, not the on-screen
            // distance, which hidden columns and sorting distort.
            const toSheetRow = formulaOptions.formulaRow;
            const rowDelta = toSheetRow ? toSheetRow(row) - toSheetRow(srcRow) : row - srcRow;
            const colDelta = targetFlatColIdx - srcFlatColIndex;
            const adjusted = adjustFormulaReferences(srcFormula, colDelta, rowDelta);
            if (targetFlatColIdx >= 0) {
              formulaOptions.setFormula(targetFlatColIdx, row, adjusted);
              // Skip normal value fill  -  formula evaluation will provide the value
              continue;
            }
          }
        }
      }

      // Normal value fill path
      const startValue = getCellValue(startItem, startColDef);
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
