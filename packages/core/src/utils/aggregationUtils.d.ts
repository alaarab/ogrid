import type { IColumnDef } from '../types/columnTypes';
import type { ISelectionRange } from '../types/dataGridTypes';
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
export declare function computeAggregations<T>(items: T[], visibleCols: IColumnDef<T>[], selectionRange: ISelectionRange | null): AggregationResult | null;
