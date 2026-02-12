import type { IColumnDef } from '../types/columnTypes';
/**
 * Get the cell value for a row/column, using valueGetter when defined otherwise item[columnId].
 */
export declare function getCellValue<T>(item: T, col: IColumnDef<T>): unknown;
