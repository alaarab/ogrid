/**
 * Checks whether a given row index falls within a selection range.
 * O(1) — used by React.memo comparators to skip unchanged rows.
 */
export declare function isRowInRange(range: {
    startRow: number;
    endRow: number;
} | null, rowIndex: number): boolean;
/**
 * Props for GridRow comparator (generic to work with all 3 UI frameworks).
 * Includes both render props and comparator-only props used to decide re-renders.
 */
export interface GridRowComparatorProps {
    item: unknown;
    rowIndex: number;
    rowId: string | number;
    isSelected: boolean;
    hasCheckboxCol: boolean;
    selectionRange: {
        startRow: number;
        endRow: number;
        startCol: number;
        endCol: number;
    } | null;
    activeCell: {
        rowIndex: number;
        columnIndex: number;
    } | null;
    cutRange: {
        startRow: number;
        endRow: number;
        startCol: number;
        endCol: number;
    } | null;
    copyRange: {
        startRow: number;
        endRow: number;
        startCol: number;
        endCol: number;
    } | null;
    isDragging: boolean;
    editingRowId: string | number | null;
    visibleCols?: unknown;
    columnMeta?: unknown;
    cellClassMap?: unknown;
    columnLayouts?: unknown;
}
/**
 * Shared React.memo comparator for GridRow components across all 3 UI packages.
 * Skips re-render for rows unaffected by selection/editing/interaction changes.
 *
 * Used by:
 * - packages/radix/src/DataGridTable/DataGridTable.tsx
 * - packages/fluent/src/DataGridTable/DataGridTable.tsx
 * - packages/material/src/DataGridTable/DataGridTable.tsx
 */
export declare function areGridRowPropsEqual(prev: GridRowComparatorProps, next: GridRowComparatorProps): boolean;
