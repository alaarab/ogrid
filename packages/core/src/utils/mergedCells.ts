/**
 * Merged cells: resolve the public `IMergedCell` list (row id + column id +
 * spans) against the current view into index-space blocks, and the range
 * helpers that make selection treat a merge as one cell (Excel behavior).
 */
import type { IMergedCell, ISelectionRange, RowId } from '../types/dataGridTypes';
import { normalizeSelectionRange } from '../types/dataGridTypes';

/** A merge resolved against the current view: displayed rows and visible data columns, inclusive. */
export interface IResolvedMerge {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

/** Index-space lookup over the merges that are valid in the current view. */
export interface IMergeLayout {
  /** Valid merges (each spans at least two cells), in input order. */
  readonly merges: readonly IResolvedMerge[];
  /** The merge containing (displayed row, visible data column), if any. */
  mergeAt(row: number, col: number): IResolvedMerge | undefined;
}

export interface ResolveMergedCellsParams {
  mergedCells: readonly IMergedCell[] | null | undefined;
  /** Displayed row index of a row id (current sort/filter/page). */
  rowIndexOf: (rowId: RowId) => number | undefined;
  /** Number of displayed rows. */
  rowCount: number;
  /** Visible column ids in display order. */
  columnIds: readonly string[];
  /** Pin side per visible column id; a merge never crosses a change of side. */
  pinnedSideOf?: (columnId: string) => 'left' | 'right' | undefined;
  /** Frozen top rows; a merge never crosses the frozen/scrolling boundary. */
  frozenRows?: number;
}

const toSpan = (n: number | undefined): number =>
  typeof n === 'number' && Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;

/**
 * Resolve merges against the current view. Spans count displayed rows and
 * visible columns from the anchor. Degrades instead of failing:
 * - anchor row not displayed or anchor column hidden: merge ignored
 * - span past the last row/column: clipped
 * - span across the pinned/unpinned column boundary: clipped at the boundary
 * - span across the frozen-row boundary: clipped at the boundary
 * - overlaps an earlier merge: ignored
 * - clipped down to a single cell: ignored
 *
 * Returns null when no merge is valid.
 */
export function resolveMergedCells(params: ResolveMergedCellsParams): IMergeLayout | null {
  const { mergedCells, rowIndexOf, rowCount, columnIds, pinnedSideOf } = params;
  if (!mergedCells || mergedCells.length === 0 || rowCount <= 0 || columnIds.length === 0) return null;
  const frozen = Math.max(0, Math.min(Math.floor(params.frozenRows ?? 0), rowCount));
  const colCount = columnIds.length;
  const colIndexById = new Map<string, number>();
  for (let i = 0; i < colCount; i++) colIndexById.set(columnIds[i] as string, i);

  const merges: IResolvedMerge[] = [];
  const cells = new Map<number, IResolvedMerge>();
  const key = (r: number, c: number) => r * colCount + c;

  for (const m of mergedCells) {
    if (m == null) continue;
    const startRow = rowIndexOf(m.rowId);
    const startCol = colIndexById.get(m.columnId);
    if (startRow == null || startRow < 0 || startRow >= rowCount || startCol == null) continue;

    let endRow = Math.min(startRow + toSpan(m.rowSpan) - 1, rowCount - 1);
    if (startRow < frozen) endRow = Math.min(endRow, frozen - 1);

    let endCol = Math.min(startCol + toSpan(m.colSpan) - 1, colCount - 1);
    if (pinnedSideOf) {
      const side = pinnedSideOf(m.columnId);
      for (let c = startCol + 1; c <= endCol; c++) {
        if (pinnedSideOf(columnIds[c] as string) !== side) {
          endCol = c - 1;
          break;
        }
      }
    }
    if (endRow === startRow && endCol === startCol) continue;

    let overlaps = false;
    for (let r = startRow; r <= endRow && !overlaps; r++) {
      for (let c = startCol; c <= endCol; c++) {
        if (cells.has(key(r, c))) {
          overlaps = true;
          break;
        }
      }
    }
    if (overlaps) continue;

    const merge: IResolvedMerge = { startRow, endRow, startCol, endCol };
    merges.push(merge);
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) cells.set(key(r, c), merge);
    }
  }

  if (merges.length === 0) return null;
  return {
    merges,
    mergeAt: (row, col) =>
      row >= 0 && col >= 0 && col < colCount ? cells.get(key(row, col)) : undefined,
  };
}

/** True when (row, col) is covered by a merge but is not its anchor (top-left) cell. */
export function isCoveredCell(layout: IMergeLayout | null | undefined, row: number, col: number): boolean {
  const m = layout?.mergeAt(row, col);
  return m != null && (m.startRow !== row || m.startCol !== col);
}

/**
 * Grow a selection range until it contains every merge it touches (Excel:
 * a selection never holds part of a merged cell). Returns the normalized
 * range; the same object when nothing changes and the range was normalized.
 */
export function expandRangeToMerges(
  range: ISelectionRange,
  layout: IMergeLayout | null | undefined
): ISelectionRange {
  if (!layout) return range;
  const r = normalizeSelectionRange(range);
  let { startRow, endRow, startCol, endCol } = r;
  let changed = true;
  while (changed) {
    changed = false;
    for (const m of layout.merges) {
      if (m.endRow < startRow || m.startRow > endRow || m.endCol < startCol || m.startCol > endCol) continue;
      if (m.startRow < startRow) { startRow = m.startRow; changed = true; }
      if (m.endRow > endRow) { endRow = m.endRow; changed = true; }
      if (m.startCol < startCol) { startCol = m.startCol; changed = true; }
      if (m.endCol > endCol) { endCol = m.endCol; changed = true; }
    }
  }
  if (
    startRow === range.startRow && endRow === range.endRow &&
    startCol === range.startCol && endCol === range.endCol
  ) return range;
  return { startRow, endRow, startCol, endCol };
}

/** True when `range` is exactly one merge (a merged cell selected on its own). */
export function isSingleMergeRange(range: ISelectionRange, layout: IMergeLayout | null | undefined): boolean {
  if (!layout) return false;
  const r = normalizeSelectionRange(range);
  const m = layout.mergeAt(r.startRow, r.startCol);
  return m != null && m.startRow === r.startRow && m.endRow === r.endRow && m.startCol === r.startCol && m.endCol === r.endCol;
}
