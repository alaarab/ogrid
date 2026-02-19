/**
 * Pure keyboard navigation helpers shared across React, Vue, Angular, and JS.
 * No framework dependencies — takes plain values, returns plain values.
 */

/**
 * Excel-style Ctrl+Arrow: find the target position along a 1D axis.
 * - Non-empty current + non-empty next → scan through non-empties, stop at last before empty/edge.
 * - Otherwise → skip empties, land on next non-empty or edge.
 *
 * @param pos   Current position (row or column index).
 * @param edge  The boundary position (0 for backward, max for forward).
 * @param step  Direction: +1 (forward) or -1 (backward).
 * @param isEmpty  Predicate: returns true if the cell at this index is empty.
 * @returns     The target position after the jump.
 */
export function findCtrlArrowTarget(
  pos: number,
  edge: number,
  step: number,
  isEmpty: (i: number) => boolean
): number {
  if (pos === edge) return pos;
  const next = pos + step;
  if (!isEmpty(pos) && !isEmpty(next)) {
    // Scan forward through non-empties; stop at the last before an empty or edge
    let p = next;
    while (p !== edge) {
      if (isEmpty(p + step)) return p;
      p += step;
    }
    return edge;
  }
  // Skip empties; land on first non-empty or edge
  let p = next;
  while (p !== edge) {
    if (!isEmpty(p)) return p;
    p += step;
  }
  return edge;
}

/**
 * Compute the new Tab navigation position given the current position and direction.
 *
 * @param rowIndex      Current row index.
 * @param columnIndex   Current absolute column index (includes checkbox offset).
 * @param maxRowIndex   Maximum row index (items.length - 1).
 * @param maxColIndex   Maximum absolute column index.
 * @param colOffset     Number of non-data leading columns (checkbox column offset).
 * @param shiftKey      True if Shift is held (backward tab).
 * @returns New { rowIndex, columnIndex } after tab.
 */
export function computeTabNavigation(
  rowIndex: number,
  columnIndex: number,
  maxRowIndex: number,
  maxColIndex: number,
  colOffset: number,
  shiftKey: boolean
): { rowIndex: number; columnIndex: number } {
  let newRow = rowIndex;
  let newCol = columnIndex;
  if (shiftKey) {
    if (columnIndex > colOffset) {
      newCol = columnIndex - 1;
    } else if (rowIndex > 0) {
      newRow = rowIndex - 1;
      newCol = maxColIndex;
    }
  } else {
    if (columnIndex < maxColIndex) {
      newCol = columnIndex + 1;
    } else if (rowIndex < maxRowIndex) {
      newRow = rowIndex + 1;
      newCol = colOffset;
    }
  }
  return { rowIndex: newRow, columnIndex: newCol };
}
