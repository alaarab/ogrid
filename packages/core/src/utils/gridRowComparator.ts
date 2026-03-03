/**
 * Checks whether a given row index falls within a selection range.
 * O(1)  -  used by React.memo comparators to skip unchanged rows.
 */
export function isRowInRange(range: { startRow: number; endRow: number } | null, rowIndex: number): boolean {
  if (!range) return false;
  const minR = Math.min(range.startRow, range.endRow);
  const maxR = Math.max(range.startRow, range.endRow);
  return rowIndex >= minR && rowIndex <= maxR;
}

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
  // Comparator-only props (may not be used in render, but drive re-render decisions)
  selectionRange: { startRow: number; endRow: number; startCol: number; endCol: number } | null;
  activeCell: { rowIndex: number; columnIndex: number } | null;
  cutRange: { startRow: number; endRow: number; startCol: number; endCol: number } | null;
  copyRange: { startRow: number; endRow: number; startCol: number; endCol: number } | null;
  isDragging: boolean;
  editingRowId: string | number | null;
  // Framework-specific structure props (these must be compared by identity)
  visibleCols?: unknown; // Radix/Fluent use visibleCols array
  columnMeta?: unknown; // Radix uses columnMeta object
  cellClassMap?: unknown; // Fluent uses cellClassMap
  columnLayouts?: unknown; // Material uses columnLayouts array
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
export function areGridRowPropsEqual(prev: GridRowComparatorProps, next: GridRowComparatorProps): boolean {
  // Data / structure changes  -  always re-render
  if (prev.item !== next.item) return false;
  if (prev.isSelected !== next.isSelected) return false;
  if (prev.hasCheckboxCol !== next.hasCheckboxCol) return false;

  // Framework-specific structure props (compared by identity)
  if (prev.visibleCols !== next.visibleCols) return false;
  if (prev.columnMeta !== next.columnMeta) return false;
  if (prev.cellClassMap !== next.cellClassMap) return false;
  if (prev.columnLayouts !== next.columnLayouts) return false;

  const ri = prev.rowIndex;

  // Editing cell in this row?
  if (prev.editingRowId !== next.editingRowId) {
    if (prev.editingRowId === prev.rowId || next.editingRowId === next.rowId) return false;
  }

  // Active cell in this row?
  const prevActive = prev.activeCell?.rowIndex === ri;
  const nextActive = next.activeCell?.rowIndex === ri;
  if (prevActive !== nextActive) return false;
  if (prevActive && nextActive && prev.activeCell?.columnIndex !== next.activeCell?.columnIndex) return false;

  // Selection range touches this row?
  const prevInSel = isRowInRange(prev.selectionRange, ri);
  const nextInSel = isRowInRange(next.selectionRange, ri);
  if (prevInSel !== nextInSel) return false;
  if (prevInSel && nextInSel) {
    if (prev.selectionRange?.startCol !== next.selectionRange?.startCol ||
        prev.selectionRange?.endCol !== next.selectionRange?.endCol) return false;
  }

  // Fill handle (selection end row) + isDragging
  const prevIsEnd = prev.selectionRange?.endRow === ri;
  const nextIsEnd = next.selectionRange?.endRow === ri;
  if (prevIsEnd !== nextIsEnd) return false;
  if ((prevIsEnd || nextIsEnd) && prev.isDragging !== next.isDragging) return false;

  // Cut/copy ranges touch this row?
  if (prev.cutRange !== next.cutRange) {
    if (isRowInRange(prev.cutRange, ri) || isRowInRange(next.cutRange, ri)) return false;
  }
  if (prev.copyRange !== next.copyRange) {
    if (isRowInRange(prev.copyRange, ri) || isRowInRange(next.copyRange, ri)) return false;
  }

  return true;
}
