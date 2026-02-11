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

  const sum = numericValues.reduce((a, b) => a + b, 0);
  return {
    sum,
    avg: sum / numericValues.length,
    min: Math.min(...numericValues),
    max: Math.max(...numericValues),
    count: numericValues.length,
  };
}
