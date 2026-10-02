import { getCellValue } from './cellValue';
import type { IColumnDef } from '../types/columnTypes';
import type { ISelectionRange } from '../types/dataGridTypes';
import { normalizeSelectionRange } from '../types/dataGridTypes';

const NUMERIC_STRING_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

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

  let totalCells = 0;
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  let count = 0;

  for (let r = norm.startRow; r <= norm.endRow; r++) {
    for (let c = norm.startCol; c <= norm.endCol; c++) {
      if (r >= items.length || c >= visibleCols.length) continue;
      totalCells++;
      const item = items[r];
      const col = visibleCols[c];
      if (item === undefined || col === undefined) continue;
      const raw = getCellValue(item, col);
      // Blanks, booleans, Dates and non-numeric text are skipped (Excel COUNT semantics).
      if (typeof raw !== 'number' && (typeof raw !== 'string' || !NUMERIC_STRING_RE.test(raw.trim()))) continue;
      const num = Number(raw);
      if (!Number.isNaN(num) && Number.isFinite(num)) {
        sum += num;
        if (num < min) min = num;
        if (num > max) max = num;
        count++;
      }
    }
  }

  // Need at least 2 cells selected and at least 1 numeric value to show aggregation
  if (totalCells < 2 || count === 0) return null;

  return {
    sum,
    avg: sum / count,
    min,
    max,
    count,
  };
}
