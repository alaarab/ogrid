/** Column pinning state for reorder zone constraints. */
export type ColumnPinState = 'left' | 'right' | 'unpinned';
/** Result of computing a drop target during column drag. */
export interface IDropTarget {
    /** The index in the column order array where the dragged column should be inserted. */
    targetIndex: number;
    /** X position (px) for the visual drop indicator, or null if dropping at the same position (no-op). */
    indicatorX: number | null;
}
/**
 * Determine which pin zone a column belongs to.
 */
export declare function getPinStateForColumn(columnId: string, pinnedColumns?: {
    left?: string[];
    right?: string[];
}): ColumnPinState;
/**
 * Remove `columnId` from `order` and insert it at `targetIndex`.
 * Returns a new array (does not mutate the input).
 */
export declare function reorderColumnArray(order: string[], columnId: string, targetIndex: number): string[];
/**
 * Calculate the drop target for a dragged column based on mouse position.
 *
 * Iterates visible column header elements (queried via `[data-column-id]`),
 * finds the midpoint of each header cell, and determines insertion side.
 * Respects pinning zones: a left-pinned column can only drop among left-pinned, etc.
 *
 * @param mouseX - Current mouse X position (client coordinates)
 * @param columnOrder - Current column display order (array of column ids)
 * @param draggedColumnId - The column being dragged
 * @param draggedPinState - Pin state of the dragged column
 * @param tableElement - The table (or grid container) DOM element to query headers from
 * @param pinnedColumns - Pinned column configuration
 * @returns Drop target with insertion index and indicator X, or null if no valid target.
 */
export declare function calculateDropTarget(mouseX: number, columnOrder: string[], draggedColumnId: string, draggedPinState: ColumnPinState, tableElement: Element, pinnedColumns?: {
    left?: string[];
    right?: string[];
}): IDropTarget | null;
