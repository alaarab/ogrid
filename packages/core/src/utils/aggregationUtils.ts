import { getCellValue } from './cellValue';
import type { IColumnDef } from '../types/columnTypes';
import type { ISelectionRange } from '../types/dataGridTypes';
import { normalizeSelectionRange } from '../types/dataGridTypes';

export interface AggregationResult {
  sum: number;
  avg: number;
  min: number;
  max: number;
  count: number;
}

/**
 * Computes numeric aggregations (sum, avg, min, max, count) for selected cells.
 * Only numeric values are included in sum/avg/min/max. Count includes only numeric cells.
 * Returns null when selection is absent, has fewer than 2 cells, or contains no numeric values.
 */
export function computeAggregations<T>(
  items: T[],
  visibleCols: IColumnDef<T>[],
  selectionRange: ISelectionRange | null
): AggregationResult | null {
  if (!selectionRange) return null;

  const norm = normalizeSelectionRange(selectionRange);

  const numericValues: number[] = [];
  let totalCells = 0;

  for (let r = norm.startRow; r <= norm.endRow; r++) {
    for (let c = norm.startCol; c <= norm.endCol; c++) {
      if (r >= items.length || c >= visibleCols.length) continue;
      totalCells++;
      const item = items[r];
      const col = visibleCols[c];
      const raw = getCellValue(item, col);
      // Use Number() instead of parseFloat() so date strings like "2020-08-22"
      // return NaN instead of partially parsing to 2020
      const num = typeof raw === 'number' ? raw : Number(raw);
      if (!isNaN(num) && isFinite(num)) {
        numericValues.push(num);
      }
    }
  }

  // Need at least 2 cells selected and at least 1 numeric value to show aggregation
  if (totalCells < 2 || numericValues.length === 0) return null;

  let sum = 0;
  let min = numericValues[0];
  let max = numericValues[0];
  for (let i = 0; i < numericValues.length; i++) {
    const v = numericValues[i];
    sum += v;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return {
    sum,
    avg: sum / numericValues.length,
    min,
    max,
    count: numericValues.length,
  };
}
