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
 *
 * Every prop not in the row-scoped interaction group below (selectionRange,
 * activeCell, cutRange, copyRange, isDragging, editingRowId) is compared by
 * identity, including props not declared here, so anything that affects a
 * row's output must reach GridRow as a prop.
 */
export interface GridRowComparatorProps {
  item: unknown;
  rowIndex: number;
  rowId: string | number;
  isSelected: boolean;
  hasCheckboxCol: boolean;
  /** Whether the row-number column renders. */
  hasRowNumbersCol?: boolean;
  /** Offset added to the displayed row number (earlier pages). */
  rowNumberOffset?: number;
  /** aria-rowindex base (header rows + page offset); optional. */
  ariaRowIndexBase?: number;
  /** Formula recalculation counter: any change repaints every row, since a recalc can change any cell. */
  formulaVersion?: number;
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

/** Props compared per row (below) instead of by identity. */
const ROW_SCOPED_PROPS = new Set<string>([
  'selectionRange', 'activeCell', 'cutRange', 'copyRange', 'isDragging', 'editingRowId',
]);

function isSingleCell(range: { startRow: number; endRow: number; startCol: number; endCol: number } | null): boolean {
  return range != null && range.startRow === range.endRow && range.startCol === range.endCol;
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
  // Data, structure and render inputs (item, rowIndex, column meta, row-number
  // column, formulaVersion, render callbacks, ...): any identity change re-renders.
  const p = prev as unknown as Record<string, unknown>;
  const n = next as unknown as Record<string, unknown>;
  for (const key in p) {
    if (!ROW_SCOPED_PROPS.has(key) && p[key] !== n[key]) return false;
  }
  for (const key in n) {
    if (!(key in p)) return false;
  }

  const ri = prev.rowIndex;

  // Editing cell in this row?
  if (prev.editingRowId !== next.editingRowId) {
    if (prev.editingRowId === prev.rowId || next.editingRowId === next.rowId) return false;
  }

  // Active cell in this row? (Its highlight is hidden while drag-selecting.)
  const prevActive = prev.activeCell?.rowIndex === ri;
  const nextActive = next.activeCell?.rowIndex === ri;
  if (prevActive !== nextActive) return false;
  if (prevActive && nextActive && prev.activeCell?.columnIndex !== next.activeCell?.columnIndex) return false;
  if (nextActive && prev.isDragging !== next.isDragging) return false;

  // Selection range touches this row?
  const prevInSel = isRowInRange(prev.selectionRange, ri);
  const nextInSel = isRowInRange(next.selectionRange, ri);
  if (prevInSel !== nextInSel) return false;
  if (prevInSel && nextInSel) {
    if (prev.selectionRange?.startCol !== next.selectionRange?.startCol ||
        prev.selectionRange?.endCol !== next.selectionRange?.endCol) return false;
    // A single-cell selection isn't highlighted as a range; growing it to more rows is.
    if (isSingleCell(prev.selectionRange) !== isSingleCell(next.selectionRange)) return false;
  }

  // Fill handle (selection end row): hidden while dragging or while a cut/copy range is shown.
  const prevIsEnd = prev.selectionRange?.endRow === ri;
  const nextIsEnd = next.selectionRange?.endRow === ri;
  if (prevIsEnd !== nextIsEnd) return false;
  if (prevIsEnd || nextIsEnd) {
    if (prev.isDragging !== next.isDragging) return false;
    if ((prev.cutRange == null) !== (next.cutRange == null)) return false;
    if ((prev.copyRange == null) !== (next.copyRange == null)) return false;
  }

  // Cut/copy ranges touch this row?
  if (prev.cutRange !== next.cutRange) {
    if (isRowInRange(prev.cutRange, ri) || isRowInRange(next.cutRange, ri)) return false;
  }
  if (prev.copyRange !== next.copyRange) {
    if (isRowInRange(prev.copyRange, ri) || isRowInRange(next.copyRange, ri)) return false;
  }

  return true;
}
