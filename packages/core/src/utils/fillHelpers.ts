/**
 * Pure fill handle helpers shared across React, Vue, Angular, and JS.
 * No framework dependencies  -  operates on plain arrays and column definitions.
 */
import type { IColumnDef, ICellValueChangedEvent } from '../types/columnTypes';
import type { ISelectionRange } from '../types/dataGridTypes';
import { getCellValue, isColumnEditable } from './cellValue';
import { parseValue } from './valueParsers';
import { normalizeSelectionRange } from '../types';
import { rangesEqual } from './selectionHelpers';
import { adjustFormulaReferences } from '../formula/cellAddressUtils';
import { detectFillSeries } from './fillSeries';
import type { IFillSeries } from './fillSeries';

/**
 * Series behavior for a fill (see `detectFillSeries`). Without it a fill
 * copies its source.
 */
export interface IFillSeriesOptions {
  /** Continue detected series (numbers, dates, weekdays, months, quarters, "Item 1"). Default true. */
  series?: boolean;
  /**
   * Excel's Ctrl-drag: a lone number counts up instead of copying, and any
   * other series is copied instead of continued.
   */
  alternate?: boolean;
}

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
 * The range a fill-handle drag covers when the pointer is over cell
 * (`row`, `col`): the source block extended along ONE axis (Excel behavior).
 *
 * The axis is the one along which the pointer is farther outside the block,
 * measured in cells: more rows outside than columns fills down/up and keeps
 * the source columns; more columns outside fills right/left and keeps the
 * source rows. An exact tie fills along rows. A pointer inside the block
 * (also the case while dragging back into it, i.e. shrinking) returns the
 * normalized source range, which is a no-op fill.
 *
 * @param source  The original selection the fill extends (any corner order).
 * @param row     Row index under the pointer.
 * @param col     Column index under the pointer (data column, no offset).
 * @returns       The normalized fill range, which always contains `source`.
 */
export function computeFillRange(source: ISelectionRange, row: number, col: number): ISelectionRange {
  const src = normalizeSelectionRange(source);
  const rowDist = row < src.startRow ? src.startRow - row : row > src.endRow ? row - src.endRow : 0;
  const colDist = col < src.startCol ? src.startCol - col : col > src.endCol ? col - src.endCol : 0;
  if (rowDist === 0 && colDist === 0) return src;
  if (rowDist >= colDist) {
    return {
      startRow: Math.min(src.startRow, row),
      startCol: src.startCol,
      endRow: Math.max(src.endRow, row),
      endCol: src.endCol,
    };
  }
  return {
    startRow: src.startRow,
    startCol: Math.min(src.startCol, col),
    endRow: src.endRow,
    endCol: Math.max(src.endCol, col),
  };
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
 * @param seriesOptions   With `sourceRange`: continue series instead of copying
 *                        (each source column when filling down/up, each source
 *                        row when filling right/left). Lines that hold a formula,
 *                        or are not a series, are still tiled.
 * @returns Array of cell value changed events to apply. Empty if source cell is out of bounds.
 */
export function applyFillValues<T>(
  range: ISelectionRange,
  sourceRow: number,
  sourceCol: number,
  items: T[],
  visibleCols: IColumnDef<T>[],
  formulaOptions?: IFillFormulaOptions<T>,
  sourceRange?: ISelectionRange,
  seriesOptions?: IFillSeriesOptions
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

  const series = src && seriesOptions && seriesOptions.series !== false
    ? detectLineSeries(range, src, items, visibleCols, seriesOptions, formulaOptions, flatColIndexById)
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

      // Series path: this cell continues its line's series.
      const line = series?.lines.get(series.vertical ? col : row);
      if (line && src) {
        const k = series?.vertical ? row - src.startRow : col - src.startCol;
        const oldValue = getCellValue(item, colDef);
        const result = parseValue(line.valueAt(k), oldValue, item, colDef);
        if (!result.valid) continue;
        events.push({ item, columnId: colDef.columnId, oldValue, newValue: result.value, rowIndex: row });
        continue;
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

/**
 * The series of each source line of a fill, keyed by column (filling down/up)
 * or row (filling right/left). Lines that are not a series, or hold a formula
 * (formulas fill by shifting their references), are absent and get copied.
 */
function detectLineSeries<T>(
  range: ISelectionRange,
  src: ISelectionRange,
  items: T[],
  visibleCols: IColumnDef<T>[],
  options: IFillSeriesOptions,
  formulaOptions: IFillFormulaOptions<T> | undefined,
  flatColIndexById: Map<string, number> | null
): { vertical: boolean; lines: Map<number, IFillSeries> } | null {
  const vertical = range.startRow < src.startRow || range.endRow > src.endRow;
  if (!vertical && range.startCol >= src.startCol && range.endCol <= src.endCol) return null;
  const lines = new Map<number, IFillSeries>();
  const [from, to] = vertical ? [src.startCol, src.endCol] : [src.startRow, src.endRow];
  const [start, end] = vertical ? [src.startRow, src.endRow] : [src.startCol, src.endCol];
  for (let line = from; line <= to; line++) {
    const values: unknown[] = [];
    let usable = true;
    for (let i = start; i <= end; i++) {
      const r = vertical ? i : line;
      const c = vertical ? line : i;
      const item = items[r];
      const colDef = visibleCols[c];
      const flat = colDef ? (flatColIndexById?.get(colDef.columnId) ?? -1) : -1;
      if (item === undefined || colDef === undefined || (flat >= 0 && formulaOptions?.hasFormula?.(flat, r))) {
        usable = false;
        break;
      }
      values.push(getCellValue(item, colDef));
    }
    if (!usable) continue;
    const series = detectFillSeries(values, { alternate: options.alternate });
    if (series) lines.set(line, series);
  }
  return lines.size > 0 ? { vertical, lines } : null;
}

/**
 * The edits a fill-handle drag makes when released over cell (`row`, `col`):
 * the fill `range` (`computeFillRange`) and the `events` that tile `source`
 * over it (`applyFillValues`). `<OGrid>` and the headless `useFillHandle`
 * both commit through this, so their fills cannot drift apart. `events` is
 * empty when the cell is inside `source` (no extension).
 *
 * @param source          The selection the fill extends (any corner order).
 * @param row             Row index the drag ended on.
 * @param col             Column index the drag ended on (data column, no offset).
 * @param items           Array of all row data objects.
 * @param visibleCols     Visible column definitions.
 * @param formulaOptions  Optional formula-aware fill configuration.
 * @param seriesOptions   Series behavior. Series are continued by default (Excel);
 *                        pass `{ alternate: true }` for a Ctrl-drag, or
 *                        `{ series: false }` to always copy.
 */
export function computeFillDragEdits<T>(
  source: ISelectionRange,
  row: number,
  col: number,
  items: T[],
  visibleCols: IColumnDef<T>[],
  formulaOptions?: IFillFormulaOptions<T>,
  seriesOptions: IFillSeriesOptions = {}
): { range: ISelectionRange; events: ICellValueChangedEvent<T>[] } {
  const src = normalizeSelectionRange(source);
  const range = computeFillRange(src, row, col);
  // A range equal to the source has nothing outside it to tile over.
  if (rangesEqual(range, src)) return { range, events: [] };
  return { range, events: applyFillValues(range, src.startRow, src.startCol, items, visibleCols, formulaOptions, src, seriesOptions) };
}

/**
 * The last row a double-click on the fill handle fills down to (Excel): the
 * end of the contiguous data in the column left of `source`, or, when that
 * column has nothing below the source, the column to its right. Returns -1
 * when neither neighbor has data directly below the source (nothing to fill).
 *
 * @param source         The selection the fill extends (any corner order).
 * @param items          Array of all row data objects.
 * @param visibleCols    Visible column definitions.
 * @param isCoveredCell  Optional: cells covered by a merged cell count as empty.
 */
export function computeAutoFillEndRow<T>(
  source: ISelectionRange,
  items: T[],
  visibleCols: IColumnDef<T>[],
  isCoveredCell?: (row: number, col: number) => boolean
): number {
  const src = normalizeSelectionRange(source);
  const hasData = (r: number, c: number): boolean => {
    const item = items[r];
    const colDef = visibleCols[c];
    if (item === undefined || colDef === undefined) return false;
    if (isCoveredCell?.(r, c)) return false;
    const v = getCellValue(item, colDef);
    return v != null && v !== '';
  };
  const first = src.endRow + 1;
  const neighbor = [src.startCol - 1, src.endCol + 1].find((c) => c >= 0 && c < visibleCols.length && hasData(first, c));
  if (neighbor === undefined) return -1;
  let end = first;
  while (end + 1 < items.length && hasData(end + 1, neighbor)) end++;
  return end;
}
