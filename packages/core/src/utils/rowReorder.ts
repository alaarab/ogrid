/**
 * Pure row-reorder helpers for drag-and-drop row dragging.
 *
 * Positions are display indices (the order the grid renders), never source
 * positions, so a filtered or paginated view keeps its own addressing. All
 * helpers are non-mutating and take/return plain arrays.
 */
import type { RowId } from '../types/dataGridTypes';

/** The event a row drag emits: the new row order plus what moved. */
export interface IRowOrderChange<T> {
  /** Every displayed row id, in the new order. */
  rowIds: RowId[];
  /** Display index of the first moved row before the drag. */
  fromIndex: number;
  /** Display index of the first moved row after the drag. */
  toIndex: number;
  /** The full reordered row array. */
  data: T[];
}

/**
 * The index in `data` a row id now sits at, or -1.
 */
function indexOfId<T>(data: readonly T[], id: RowId, getRowId: (row: T) => RowId): number {
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (row !== undefined && getRowId(row) === id) return i;
  }
  return -1;
}

/**
 * Move the rows at `fromIndices` so the block lands before display index
 * `insertIndex` (the gap the drop indicator marks). `insertIndex` is measured
 * in the current array; indices inside the moved block are a no-op.
 *
 * @returns The reordered array and the block's final index. `changed` is false
 *          when the move leaves the order unchanged (a drop on the block).
 */
export function moveRows<T>(
  rows: readonly T[],
  fromIndices: readonly number[],
  insertIndex: number,
): { data: T[]; toIndex: number; changed: boolean } {
  if (fromIndices.length === 0) return { data: [...rows], toIndex: 0, changed: false };
  const moved = new Set(fromIndices);
  const first = Math.min(...fromIndices);
  const last = Math.max(...fromIndices);
  // Dropping on or immediately around the dragged block changes nothing.
  if (insertIndex >= first && insertIndex <= last + 1) {
    return { data: [...rows], toIndex: first, changed: false };
  }
  const block: T[] = [];
  for (let i = first; i <= last; i++) {
    const row = rows[i];
    if (row !== undefined && moved.has(i)) block.push(row);
  }
  const keep = rows.filter((_, i) => !moved.has(i));
  const removedBefore = fromIndices.filter((i) => i < insertIndex).length;
  const toIndex = Math.max(0, Math.min(insertIndex - removedBefore, keep.length));
  const data = [...keep.slice(0, toIndex), ...block, ...keep.slice(toIndex)];
  return { data, toIndex, changed: true };
}

/**
 * Reorder `rows` to match `orderedIds`, keeping the order of every id not
 * listed (appended in source order after the listed ones). Used to apply an
 * externally-held row order without re-sorting.
 */
export function applyRowOrder<T>(
  rows: readonly T[],
  orderedIds: readonly RowId[] | null | undefined,
  getRowId: (row: T) => RowId,
): T[] {
  if (!orderedIds || orderedIds.length === 0) return [...rows];
  const byId = new Map<RowId, T>();
  for (const row of rows) {
    if (row === undefined) continue;
    const id = getRowId(row);
    if (!byId.has(id)) byId.set(id, row);
  }
  const out: T[] = [];
  const used = new Set<RowId>();
  for (const id of orderedIds) {
    const row = byId.get(id);
    if (row !== undefined && !used.has(id)) {
      out.push(row);
      used.add(id);
    }
  }
  for (const row of rows) {
    if (row === undefined) continue;
    const id = getRowId(row);
    if (!used.has(id)) {
      out.push(row);
      used.add(id);
    }
  }
  return out;
}

/**
 * Build the `onRowOrderChange` event for moving the block at `fromIndices` to
 * the gap `insertIndex`. Returns `null` when the move is a no-op.
 */
export function computeRowOrderChange<T>(
  rows: readonly T[],
  fromIndices: readonly number[],
  insertIndex: number,
  getRowId: (row: T) => RowId,
): IRowOrderChange<T> | null {
  const { data, toIndex, changed } = moveRows(rows, fromIndices, insertIndex);
  if (!changed) return null;
  return {
    rowIds: data.map(getRowId),
    fromIndex: Math.min(...fromIndices),
    toIndex,
    data,
  };
}

/**
 * The display index a row id sits at, or -1. Convenience for callers holding a
 * row id (e.g. the dragged handle) instead of an index.
 */
export function rowIndexById<T>(rows: readonly T[], id: RowId, getRowId: (row: T) => RowId): number {
  return indexOfId(rows, id, getRowId);
}

/**
 * True when the move represented by `fromIndices`/`insertIndex` would leave the
 * order unchanged. Lets a caller skip emitting `onRowOrderChange`.
 */
export function isRowMoveNoop(fromIndices: readonly number[], insertIndex: number): boolean {
  if (fromIndices.length === 0) return true;
  const first = Math.min(...fromIndices);
  const last = Math.max(...fromIndices);
  return insertIndex >= first && insertIndex <= last + 1;
}
