/**
 * Pure keyboard navigation helpers shared by the React UI packages.
 * No framework dependencies  -  takes plain values, returns plain values.
 */
import type { ISelectionRange } from '../types/dataGridTypes';
import type { IColumnDef, ICellValueChangedEvent } from '../types/columnTypes';
import { normalizeSelectionRange } from '../types/dataGridTypes';
import { getCellValue, isColumnEditable } from './cellValue';
import { parseValue } from './valueParsers';

/**
 * Excel-style Ctrl+Arrow: find the target position along a 1D axis.
 * - Non-empty current + non-empty next  to  scan through non-empties, stop at last before empty/edge.
 * - Otherwise  to  skip empties, land on next non-empty or edge.
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
  // Bail out when we are already at (or past) the edge in the direction of
  // travel. A strict `pos === edge` check is not enough: a stale position on
  // the far side of the edge  -  e.g. an activeCell left over after a filter
  // shrank the row count  -  would step away from `edge` forever.
  const atOrPastEdge = step > 0 ? pos >= edge : pos <= edge;
  if (atOrPastEdge) return pos;

  const inBounds = (p: number): boolean => (step > 0 ? p < edge : p > edge);

  const next = pos + step;
  if (!isEmpty(pos) && !isEmpty(next)) {
    // Scan forward through non-empties; stop at the last before an empty or edge
    let p = next;
    while (inBounds(p)) {
      if (isEmpty(p + step)) return p;
      p += step;
    }
    return edge;
  }
  // Skip empties; land on first non-empty or edge
  let p = next;
  while (inBounds(p)) {
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
 * @param maxRowIndex   Maximum row index (items.length - 1). Must be >= 0.
 * @param maxColIndex   Maximum absolute column index. Must be >= 0.
 * @param colOffset     Number of non-data leading columns (checkbox column offset).
 * @param shiftKey      True if Shift is held (backward tab).
 * @returns New { rowIndex, columnIndex } after tab. Caller must ensure maxRowIndex and maxColIndex are non-negative.
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

/** Input parameters for arrow navigation computation. */
export interface ArrowNavigationContext {
  direction: 'ArrowDown' | 'ArrowUp' | 'ArrowLeft' | 'ArrowRight';
  rowIndex: number;
  columnIndex: number;
  dataColIndex: number;
  colOffset: number;
  maxRowIndex: number;
  maxColIndex: number;
  visibleColCount: number;
  isCtrl: boolean;
  isShift: boolean;
  selectionRange: ISelectionRange | null;
  isEmptyAt: (r: number, c: number) => boolean;
}

/** Result of arrow navigation computation. */
export interface ArrowNavigationResult {
  newRowIndex: number;
  newColumnIndex: number;
  newDataColIndex: number;
  newRange: ISelectionRange;
}

/**
 * Computes the next active cell position and selection range for a single arrow key press.
 * Handles Ctrl+Arrow (jump to edge), Shift+Arrow (extend selection), and plain Arrow (move).
 *
 * Pure function  -  no framework dependencies.
 *
 * @param ctx  Arrow navigation context with current position, direction, modifiers, and grid bounds.
 * @returns The new row/column indices and selection range.
 */
export function computeArrowNavigation(ctx: ArrowNavigationContext): ArrowNavigationResult {
  const {
    direction, rowIndex, columnIndex, dataColIndex, colOffset,
    maxRowIndex, maxColIndex, visibleColCount, isCtrl, isShift,
    selectionRange, isEmptyAt,
  } = ctx;

  let newRowIndex = rowIndex;
  let newColumnIndex = columnIndex;

  if (direction === 'ArrowDown') {
    newRowIndex = isCtrl
      ? findCtrlArrowTarget(rowIndex, maxRowIndex, 1, (r) => isEmptyAt(r, Math.max(0, dataColIndex)))
      : Math.min(rowIndex + 1, maxRowIndex);
  } else if (direction === 'ArrowUp') {
    newRowIndex = isCtrl
      ? findCtrlArrowTarget(rowIndex, 0, -1, (r) => isEmptyAt(r, Math.max(0, dataColIndex)))
      : Math.max(rowIndex - 1, 0);
  } else if (direction === 'ArrowRight') {
    if (isCtrl && dataColIndex >= 0) {
      newColumnIndex = findCtrlArrowTarget(dataColIndex, visibleColCount - 1, 1, (c) => isEmptyAt(rowIndex, c)) + colOffset;
    } else {
      newColumnIndex = Math.min(columnIndex + 1, maxColIndex);
    }
  } else { // ArrowLeft
    if (isCtrl && dataColIndex >= 0) {
      newColumnIndex = findCtrlArrowTarget(dataColIndex, 0, -1, (c) => isEmptyAt(rowIndex, c)) + colOffset;
    } else {
      newColumnIndex = Math.max(columnIndex - 1, colOffset);
    }
  }

  const newDataColIndex = newColumnIndex - colOffset;
  const isVertical = direction === 'ArrowDown' || direction === 'ArrowUp';

  let newRange: ISelectionRange;
  if (isShift) {
    if (isVertical) {
      newRange = normalizeSelectionRange({
        startRow: selectionRange?.startRow ?? rowIndex,
        startCol: selectionRange?.startCol ?? dataColIndex,
        endRow: newRowIndex,
        endCol: selectionRange?.endCol ?? dataColIndex,
      });
    } else {
      newRange = normalizeSelectionRange({
        startRow: selectionRange?.startRow ?? rowIndex,
        startCol: selectionRange?.startCol ?? dataColIndex,
        endRow: selectionRange?.endRow ?? rowIndex,
        endCol: newDataColIndex,
      });
    }
  } else {
    newRange = {
      startRow: newRowIndex,
      startCol: newDataColIndex,
      endRow: newRowIndex,
      endCol: newDataColIndex,
    };
  }

  return { newRowIndex, newColumnIndex, newDataColIndex, newRange };
}

/**
 * Apply cell deletion (Delete/Backspace key) across a selection range.
 * For each editable cell in the range, parses an empty string as the new value
 * and emits a cell value changed event.
 *
 * Pure function  -  no framework dependencies.
 *
 * @param range       The normalized selection range to clear.
 * @param items       Array of all row data objects.
 * @param visibleCols Visible column definitions.
 * @returns Array of cell value changed events to apply.
 */
export function applyCellDeletion<T>(
  range: ISelectionRange,
  items: T[],
  visibleCols: IColumnDef<T>[]
): ICellValueChangedEvent<T>[] {
  const norm = normalizeSelectionRange(range);
  const events: ICellValueChangedEvent<T>[] = [];
  for (let r = norm.startRow; r <= norm.endRow; r++) {
    for (let c = norm.startCol; c <= norm.endCol; c++) {
      if (r >= items.length || c >= visibleCols.length) continue;
      const item = items[r];
      const col = visibleCols[c];
      if (item === undefined || col === undefined) continue;
      if (!isColumnEditable(col, item)) continue;
      const oldValue = getCellValue(item, col);
      const result = parseValue('', oldValue, item, col);
      if (!result.valid) continue;
      events.push({
        item,
        columnId: col.columnId,
        oldValue,
        newValue: result.value,
        rowIndex: r,
      });
    }
  }
  return events;
}
