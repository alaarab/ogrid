import { type Ref } from 'vue';
import type { IColumnDef } from '../types';
export interface UseColumnResizeParams {
    columnSizingOverrides: Ref<Record<string, {
        widthPx: number;
    }>>;
    setColumnSizingOverrides: (value: Record<string, {
        widthPx: number;
    }>) => void;
    minWidth?: number;
    defaultWidth?: number;
    onColumnResized?: (columnId: string, width: number) => void;
}
export interface UseColumnResizeResult<T> {
    handleResizeStart: (e: MouseEvent, col: IColumnDef<T>) => void;
    getColumnWidth: (col: IColumnDef<T>) => number;
}
/**
 * Manages column resize drag interactions with RAF-throttled state updates.
 */
export declare function useColumnResize<T>(params: UseColumnResizeParams): UseColumnResizeResult<T>;
