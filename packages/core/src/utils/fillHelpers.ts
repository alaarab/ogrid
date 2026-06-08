/**
 * Pure fill handle helpers shared across React, Vue, Angular, and JS.
 * No framework dependencies  -  operates on plain arrays and column definitions.
 */
import type { IColumnDef, ICellValueChangedEvent } from '../types/columnTypes';
import type { ISelectionRange } from '../types/dataGridTypes';
import { getCellValue, isColumnEditable } from './cellValue';
import { parseValue } from './valueParsers';
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
}

/**
 * Apply fill values from a source cell across a normalized selection range.
 * Copies the value from the start cell of the range to every other editable cell.
 * If formulaOptions is provided and the source cell has a formula, relative references
 * in the formula are adjusted for each target cell instead of copying the raw value.
 *
 * @param range           The normalized fill range (startRow/startCol is the source).
 * @param sourceRow       The original source row index (skipped during fill).
 * @param sourceCol       The original source col index (skipped during fill).
 * @param items           Array of all row data objects.
 * @param visibleCols     Visible column definitions.
 * @param formulaOptions  Optional formula-aware fill configuration.
 * @returns Array of cell value changed events to apply. Empty if source cell is out of bounds.
 */
export function applyFillValues<T>(
  range: ISelectionRange,
  sourceRow: number,
  sourceCol: number,
  items: T[],
  visibleCols: IColumnDef<T>[],
  formulaOptions?: IFillFormulaOptions<T>
): ICellValueChangedEvent<T>[] {
  const events: ICellValueChangedEvent<T>[] = [];
  const startItem = items[range.startRow];
  const startColDef = visibleCols[range.startCol];
  if (!startItem || !startColDef) return events;

  const startValue = getCellValue(startItem, startColDef);

  // Pre-compute source flat col index for formula lookup
  const srcFlatColIndex = formulaOptions
    ? formulaOptions.flatColumns.findIndex(c => c.columnId === startColDef.columnId)
    : -1;
  // Precompute columnId -> flat index once instead of findIndex per filled cell
  // (a large fill over a wide grid was O(cells x flatColumns)).
  const flatColIndexById = formulaOptions
    ? new Map(formulaOptions.flatColumns.map((c, i) => [c.columnId, i] as const))
    : null;

  const compatibleCols = new Set<number>();
  for (let col = range.startCol; col <= range.endCol; col++) {
    if (col < visibleCols.length && areFillCompatible(startColDef, visibleCols[col])) {
      compatibleCols.add(col);
    }
  }

  for (let row = range.startRow; row <= range.endRow; row++) {
    for (let col = range.startCol; col <= range.endCol; col++) {
      if (row === sourceRow && col === sourceCol) continue;
      if (row >= items.length || !compatibleCols.has(col)) continue;
      const item = items[row];
      const colDef = visibleCols[col];
      if (!isColumnEditable(colDef, item)) continue;

      // Formula-aware path: if source cell has a formula, adjust and propagate it
      if (
        formulaOptions &&
        formulaOptions.hasFormula &&
        formulaOptions.getFormula &&
        formulaOptions.setFormula &&
        srcFlatColIndex >= 0 &&
        formulaOptions.hasFormula(srcFlatColIndex, sourceRow)
      ) {
        const srcFormula = formulaOptions.getFormula(srcFlatColIndex, sourceRow);
        if (srcFormula) {
          const rowDelta = row - sourceRow;
          const colDelta = col - sourceCol;
          const adjusted = adjustFormulaReferences(srcFormula, colDelta, rowDelta);
          const targetFlatColIdx = flatColIndexById?.get(colDef.columnId) ?? -1;
          if (targetFlatColIdx >= 0) {
            formulaOptions.setFormula(targetFlatColIdx, row, adjusted);
            // Skip normal value fill  -  formula evaluation will provide the value
            continue;
          }
        }
      }

      // Normal value fill path
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
