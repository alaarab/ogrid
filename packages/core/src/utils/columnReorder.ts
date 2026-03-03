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
export function getPinStateForColumn(
  columnId: string,
  pinnedColumns?: { left?: string[]; right?: string[] }
): ColumnPinState {
  if (!pinnedColumns) return 'unpinned';
  if (pinnedColumns.left?.includes(columnId)) return 'left';
  if (pinnedColumns.right?.includes(columnId)) return 'right';
  return 'unpinned';
}

/**
 * Remove `columnId` from `order` and insert it at `targetIndex`.
 * Returns a new array (does not mutate the input).
 */
export function reorderColumnArray(
  order: string[],
  columnId: string,
  targetIndex: number
): string[] {
  const filtered = order.filter(id => id !== columnId);
  const clampedIndex = Math.max(0, Math.min(targetIndex, filtered.length));
  const result = [...filtered];
  result.splice(clampedIndex, 0, columnId);
  return result;
}

/** Parameters for {@link calculateDropTarget}. */
export interface ICalculateDropTargetParams {
  /** Current mouse X position (client coordinates). */
  mouseX: number;
  /** Current column display order (array of column ids). */
  columnOrder: string[];
  /** The column being dragged. */
  draggedColumnId: string;
  /** Pin state of the dragged column. */
  draggedPinState: ColumnPinState;
  /** The table (or grid container) DOM element to query headers from. */
  tableElement: Element;
  /** Pinned column configuration. */
  pinnedColumns?: { left?: string[]; right?: string[] };
}

/**
 * Calculate the drop target for a dragged column based on mouse position.
 *
 * Iterates visible column header elements (queried via `[data-column-id]`),
 * finds the midpoint of each header cell, and determines insertion side.
 * Respects pinning zones: a left-pinned column can only drop among left-pinned, etc.
 *
 * @param params - Options object containing mouseX, columnOrder, draggedColumnId,
 *   draggedPinState, tableElement, and optional pinnedColumns.
 * @returns Drop target with insertion index and indicator X, or null if no valid target.
 */
export function calculateDropTarget(
  params: ICalculateDropTargetParams
): IDropTarget | null {
  const { mouseX, columnOrder, draggedColumnId, draggedPinState, tableElement, pinnedColumns } = params;
  const headerCells = tableElement.querySelectorAll<HTMLElement>('[data-column-id]');
  if (headerCells.length === 0) return null;

  // Build ordered list of header rects for columns in the same pin zone
  const targets: { columnId: string; left: number; right: number; midX: number; orderIndex: number }[] = [];

  headerCells.forEach(cell => {
    const colId = cell.getAttribute('data-column-id');
    if (!colId) return;

    const pinState = getPinStateForColumn(colId, pinnedColumns);
    if (pinState !== draggedPinState) return;

    const rect = cell.getBoundingClientRect();
    const orderIndex = columnOrder.indexOf(colId);
    if (orderIndex === -1) return;

    targets.push({
      columnId: colId,
      left: rect.left,
      right: rect.right,
      midX: rect.left + rect.width / 2,
      orderIndex,
    });
  });

  if (targets.length === 0) return null;

  // Sort by visual position (left edge)
  targets.sort((a, b) => a.left - b.left);

  // Find where mouse falls relative to column midpoints
  let targetIndex: number;
  let indicatorX: number;

  if (mouseX <= targets[0].midX) {
    // Before the first target
    targetIndex = targets[0].orderIndex;
    indicatorX = targets[0].left;
  } else if (mouseX >= targets[targets.length - 1].midX) {
    // After the last target
    const last = targets[targets.length - 1];
    targetIndex = last.orderIndex + 1;
    indicatorX = last.right;
  } else {
    // Between two targets  -  find the boundary
    let matchIndex = -1;
    for (let i = 0; i < targets.length - 1; i++) {
      if (mouseX >= targets[i].midX && mouseX < targets[i + 1].midX) {
        matchIndex = i;
        break;
      }
    }
    if (matchIndex === -1) return null;
    targetIndex = targets[matchIndex].orderIndex + 1;
    indicatorX = targets[matchIndex].right;
  }

  // Check if this is a no-op (dropping at same position)
  const currentIndex = columnOrder.indexOf(draggedColumnId);
  if (currentIndex === targetIndex || currentIndex + 1 === targetIndex) {
    return { targetIndex, indicatorX: null };
  }

  return { targetIndex, indicatorX };
}
