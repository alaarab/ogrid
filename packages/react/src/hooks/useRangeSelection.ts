/**
 * useRangeSelection — headless cell-range selection for OGrid.
 *
 * Manages an Excel/Sheets-style range with anchor + focus cells. Pairs with
 * `useHeadlessGrid` to add range selection to any table chrome (shadcn,
 * plain HTML, anything). Foundation for `useFillHandle` and
 * `useCellClipboard` — both consume the range this hook produces.
 *
 * The model: a range is defined by an `anchor` (where you started) and a
 * `focus` (where you are now). Single-cell selection has anchor === focus.
 * `extendRange(row, col)` keeps the anchor and moves the focus — equivalent
 * to Shift+Click. The normalized rectangular bounds are exposed as `range`.
 *
 * Consumer wires their own mouse handlers — this hook does not touch the
 * DOM. A typical pattern:
 *
 *   <td
 *     onMouseDown={(e) => {
 *       if (e.shiftKey) range.extendRange(rowIdx, colIdx);
 *       else range.startRange(rowIdx, colIdx);
 *     }}
 *     onMouseEnter={(e) => {
 *       if (e.buttons === 1) range.extendRange(rowIdx, colIdx);
 *     }}
 *     style={{ background: range.isInRange(rowIdx, colIdx) ? '#dbeafe' : undefined }}
 *   />
 */

import { useCallback, useMemo, useState } from 'react';
import {
  normalizeSelectionRange,
  isInSelectionRange,
} from '@alaarab/ogrid-core';
import type { ISelectionRange } from '@alaarab/ogrid-core';

export interface CellCoord {
  row: number;
  col: number;
}

export interface UseRangeSelectionParams {
  /** Total visible row count — used by selectAll(). */
  rowCount: number;
  /** Total visible column count — used by selectAll(). */
  colCount: number;
}

export interface UseRangeSelectionResult {
  /** Current normalized range (rectangular bounds), or null if no selection. */
  range: ISelectionRange | null;
  /** Anchor cell (where the user started). Same as focus for single-cell selection. */
  anchor: CellCoord | null;
  /** Focus cell (where the user is now). */
  focus: CellCoord | null;
  /**
   * Begin a new selection at (row, col). Sets anchor === focus → single cell.
   * Equivalent to a fresh click.
   */
  startRange: (row: number, col: number) => void;
  /**
   * Extend the focus to (row, col), keeping the anchor in place.
   * Equivalent to Shift+Click or drag.
   */
  extendRange: (row: number, col: number) => void;
  /** Set the range explicitly (when you have anchor + focus already). */
  setRange: (range: ISelectionRange | null) => void;
  /** Clear the selection. */
  clearRange: () => void;
  /** Select every cell in the grid. */
  selectAll: () => void;
  /** True if (row, col) is inside the current range. */
  isInRange: (row: number, col: number) => boolean;
  /** Distinct row indices covered by the range, in order. */
  getRangeRows: () => number[];
  /** Every cell coord covered by the range, row-major. */
  getRangeCells: () => CellCoord[];
}

/**
 * Headless cell-range selection hook.
 *
 * Pure state — no DOM, no mouse handlers. Consumer wires events to the
 * `startRange` / `extendRange` actions on the elements they render.
 */
export function useRangeSelection(
  params: UseRangeSelectionParams,
): UseRangeSelectionResult {
  const { rowCount, colCount } = params;

  const [anchor, setAnchor] = useState<CellCoord | null>(null);
  const [focus, setFocus] = useState<CellCoord | null>(null);

  // Derive the rectangular range from anchor + focus.
  const range = useMemo<ISelectionRange | null>(() => {
    if (!anchor || !focus) return null;
    return normalizeSelectionRange({
      startRow: anchor.row,
      startCol: anchor.col,
      endRow: focus.row,
      endCol: focus.col,
    });
  }, [anchor, focus]);

  const startRange = useCallback((row: number, col: number) => {
    setAnchor({ row, col });
    setFocus({ row, col });
  }, []);

  const extendRange = useCallback((row: number, col: number) => {
    // If there's no anchor yet, treat extend like start.
    setAnchor((prev) => prev ?? { row, col });
    setFocus({ row, col });
  }, []);

  const setRange = useCallback((next: ISelectionRange | null) => {
    if (!next) {
      setAnchor(null);
      setFocus(null);
      return;
    }
    const normalized = normalizeSelectionRange(next);
    setAnchor({ row: normalized.startRow, col: normalized.startCol });
    setFocus({ row: normalized.endRow, col: normalized.endCol });
  }, []);

  const clearRange = useCallback(() => {
    setAnchor(null);
    setFocus(null);
  }, []);

  const selectAll = useCallback(() => {
    if (rowCount <= 0 || colCount <= 0) return;
    setAnchor({ row: 0, col: 0 });
    setFocus({ row: rowCount - 1, col: colCount - 1 });
  }, [rowCount, colCount]);

  const isInRange = useCallback(
    (row: number, col: number): boolean => {
      if (!range) return false;
      return isInSelectionRange(range, row, col);
    },
    [range],
  );

  const getRangeRows = useCallback((): number[] => {
    if (!range) return [];
    const rows: number[] = [];
    for (let r = range.startRow; r <= range.endRow; r += 1) rows.push(r);
    return rows;
  }, [range]);

  const getRangeCells = useCallback((): CellCoord[] => {
    if (!range) return [];
    const cells: CellCoord[] = [];
    for (let r = range.startRow; r <= range.endRow; r += 1) {
      for (let c = range.startCol; c <= range.endCol; c += 1) {
        cells.push({ row: r, col: c });
      }
    }
    return cells;
  }, [range]);

  return {
    range,
    anchor,
    focus,
    startRange,
    extendRange,
    setRange,
    clearRange,
    selectAll,
    isInRange,
    getRangeRows,
    getRangeCells,
  };
}
