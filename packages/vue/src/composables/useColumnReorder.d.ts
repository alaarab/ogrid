import { type Ref } from 'vue';
export interface UseColumnReorderParams {
    columnOrder: Ref<string[]>;
    onColumnOrderChange: Ref<((order: string[]) => void) | undefined>;
    tableRef: Ref<HTMLElement | null>;
    pinnedColumns?: Ref<{
        left?: string[];
        right?: string[];
    } | undefined>;
}
export interface UseColumnReorderResult {
    isDragging: Ref<boolean>;
    dropIndicatorX: Ref<number | null>;
    handleHeaderMouseDown: (columnId: string, event: MouseEvent) => void;
}
/**
 * Manages column reordering via drag-and-drop on header cells.
 * Uses RAF-throttled mouse tracking and core's calculateDropTarget/reorderColumnArray.
 */
export declare function useColumnReorder(params: UseColumnReorderParams): UseColumnReorderResult;
