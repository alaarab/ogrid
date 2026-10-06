/**
 * useGridFocus — headless arrow-key cell navigation for OGrid.
 *
 * Manages the active cell coordinate and translates Arrow / Tab / Enter /
 * Home / End / PageUp / PageDown into cell movement scoped to the
 * currently rendered rows × columns. Pairs with `useRangeSelection` so
 * Shift+Arrow / Shift+Home / Shift+End extend the range. Tab at the first or
 * last column is left to the browser so focus can leave the grid.
 *
 * Ctrl+Arrow (Cmd on macOS) jumps like Excel and `<OGrid>`: pass
 * `isCellEmpty` and it moves to the edge of the current data region along
 * that axis (core's `findCtrlArrowTarget`); without it, to the grid edge.
 * Ctrl+Shift+Arrow extends the range to the same target.
 *
 * Consumer attaches `getKeyDownHandler()` to their grid container's
 * `onKeyDown`, makes the container focusable (`tabIndex={0}`), and renders
 * the active cell highlight from `activeCell`.
 *
 * Example:
 *
 *   const focus = useGridFocus({
 *     rowCount: grid.rows.length,
 *     colCount: grid.columns.length,
 *     pageSize: 10,
 *     rangeSelection: range,  // optional — enables Shift+Arrow range extend
 *     isCellEmpty: (row, col) => grid.getCellValue(grid.rows[row], grid.columns[col].columnId) == null,
 *   });
 *
 *   <div tabIndex={0} onKeyDown={focus.getKeyDownHandler()}>
 *     <table>
 *       {grid.rows.map((row, rowIdx) =>
 *         grid.columns.map((col, colIdx) => (
 *           <td
 *             data-active={focus.activeCell?.row === rowIdx && focus.activeCell?.col === colIdx}
 *             onMouseDown={() => focus.setActiveCell({ row: rowIdx, col: colIdx })}
 *           />
 *         ))
 *       )}
 *     </table>
 *   </div>
 */

import { useCallback, useRef, useState } from 'react';
import { findCtrlArrowTarget } from '@alaarab/ogrid-core';
import type { CellCoord, UseRangeSelectionResult } from './useRangeSelection';

export interface UseGridFocusParams {
  /** Total visible row count (current page). */
  rowCount: number;
  /** Total visible column count. */
  colCount: number;
  /**
   * Number of rows that PageUp/PageDown should move. Defaults to 10.
   */
  pageSize?: number;
  /**
   * Optional range-selection hook. When provided, Shift+Arrow extends the
   * selection range; plain Arrow keys collapse the range to a single cell.
   */
  rangeSelection?: UseRangeSelectionResult;
  /**
   * Tells Ctrl+Arrow (Cmd+Arrow on macOS) which cells are empty so it can
   * jump by data region the way Excel and `<OGrid>` do: from a non-empty cell
   * with a non-empty neighbor, to the last non-empty cell before a gap or the
   * edge; otherwise past the empty cells to the next non-empty one, or the
   * edge. `<OGrid>` treats `null`, `undefined`, and `''` as empty. When
   * omitted, Ctrl+Arrow jumps straight to the grid edge.
   */
  isCellEmpty?: (row: number, col: number) => boolean;
}

export interface UseGridFocusResult {
  /** Active cell coordinate, or null. */
  activeCell: CellCoord | null;
  /** Set the active cell directly. */
  setActiveCell: (cell: CellCoord | null) => void;
  /** Move active cell up by `n` rows (default 1). Clamps at edge. */
  moveUp: (n?: number) => void;
  /** Move active cell down by `n` rows (default 1). Clamps at edge. */
  moveDown: (n?: number) => void;
  /** Move active cell left by `n` cols (default 1). Clamps at edge. */
  moveLeft: (n?: number) => void;
  /** Move active cell right by `n` cols (default 1). Clamps at edge. */
  moveRight: (n?: number) => void;
  /** Move to first column of current row. */
  moveToRowStart: () => void;
  /** Move to last column of current row. */
  moveToRowEnd: () => void;
  /** Move to (0, 0). */
  moveToStart: () => void;
  /** Move to (lastRow, lastCol). */
  moveToEnd: () => void;
  /**
   * Returns a keydown handler to attach to the grid container. Translates
   * Arrow/Tab/Enter/Home/End/PageUp/PageDown into cell movement, with
   * Shift+Arrow extending the range when `rangeSelection` was provided and
   * Ctrl/Cmd+Arrow jumping to the data-region or grid edge (see `isCellEmpty`).
   */
  getKeyDownHandler: () => (e: {
    key: string;
    shiftKey?: boolean;
    ctrlKey?: boolean;
    metaKey?: boolean;
    preventDefault?: () => void;
  }) => void;
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

/**
 * Headless arrow-key cell navigation.
 *
 * Pure state + a keydown handler factory. Does not touch the DOM directly.
 */
export function useGridFocus(params: UseGridFocusParams): UseGridFocusResult {
  const { rowCount, colCount, pageSize = 10, rangeSelection, isCellEmpty } = params;

  const [activeCell, setActiveCellState] = useState<CellCoord | null>(null);
  // Mirror of activeCell, updated synchronously, so movement can compute the
  // next cell and call rangeSelection outside a state updater (updaters must be
  // pure: React may run them twice, and calling another hook's setter from one
  // warns about updating during render).
  const activeCellRef = useRef<CellCoord | null>(null);

  const commit = useCallback((next: CellCoord | null) => {
    activeCellRef.current = next;
    setActiveCellState(next);
  }, []);

  const setActiveCell = useCallback((cell: CellCoord | null) => {
    commit(cell);
  }, [commit]);

  const moveBy = useCallback(
    (drow: number, dcol: number, extendRange = false) => {
      if (rowCount <= 0 || colCount <= 0) return;
      const prev = activeCellRef.current;
      // With no active cell yet, the first move focuses the first cell.
      const next: CellCoord = prev
        ? {
            row: clamp(prev.row + drow, 0, rowCount - 1),
            col: clamp(prev.col + dcol, 0, colCount - 1),
          }
        : { row: 0, col: 0 };
      commit(next);
      if (rangeSelection) {
        if (extendRange) rangeSelection.extendRange(next.row, next.col);
        else rangeSelection.startRange(next.row, next.col);
      }
    },
    [rowCount, colCount, rangeSelection, commit],
  );

  // Ctrl/Cmd+Arrow: Excel data-region jump along one axis, using the same
  // core helper as <OGrid>. Without an isCellEmpty predicate every cell counts
  // as filled, which makes the jump land on the grid edge. With Shift the
  // active cell still moves (as for Shift+Arrow) and the range extends to it.
  const jumpBy = useCallback(
    (drow: -1 | 0 | 1, dcol: -1 | 0 | 1, extendRange = false) => {
      if (rowCount <= 0 || colCount <= 0) return;
      const prev = activeCellRef.current;
      let next: CellCoord;
      if (!prev) {
        next = { row: 0, col: 0 };
      } else {
        const row = clamp(prev.row, 0, rowCount - 1);
        const col = clamp(prev.col, 0, colCount - 1);
        const isEmpty = isCellEmpty ?? (() => false);
        next =
          drow !== 0
            ? { row: findCtrlArrowTarget(row, drow > 0 ? rowCount - 1 : 0, drow, (r) => isEmpty(r, col)), col }
            : { row, col: findCtrlArrowTarget(col, dcol > 0 ? colCount - 1 : 0, dcol, (c) => isEmpty(row, c)) };
      }
      commit(next);
      if (rangeSelection) {
        if (extendRange) rangeSelection.extendRange(next.row, next.col);
        else rangeSelection.startRange(next.row, next.col);
      }
    },
    [rowCount, colCount, rangeSelection, isCellEmpty, commit],
  );

  // Shift+Home/End: extend the range to a row or grid edge, keeping its anchor.
  const extendTo = useCallback(
    (row: number, col: number) => {
      if (rowCount <= 0 || colCount <= 0) return;
      const next = { row: clamp(row, 0, rowCount - 1), col: clamp(col, 0, colCount - 1) };
      commit(next);
      rangeSelection?.extendRange(next.row, next.col);
    },
    [rowCount, colCount, rangeSelection, commit],
  );

  const moveUp = useCallback((n = 1) => moveBy(-n, 0), [moveBy]);
  const moveDown = useCallback((n = 1) => moveBy(n, 0), [moveBy]);
  const moveLeft = useCallback((n = 1) => moveBy(0, -n), [moveBy]);
  const moveRight = useCallback((n = 1) => moveBy(0, n), [moveBy]);

  const moveToRowStart = useCallback(() => {
    const prev = activeCellRef.current;
    const next = { row: prev?.row ?? 0, col: 0 };
    commit(next);
    if (prev) rangeSelection?.startRange(next.row, next.col);
  }, [rangeSelection, commit]);

  const moveToRowEnd = useCallback(() => {
    const prev = activeCellRef.current;
    const next = { row: prev?.row ?? 0, col: Math.max(0, colCount - 1) };
    commit(next);
    if (prev) rangeSelection?.startRange(next.row, next.col);
  }, [colCount, rangeSelection, commit]);

  const moveToStart = useCallback(() => {
    commit({ row: 0, col: 0 });
    rangeSelection?.startRange(0, 0);
  }, [rangeSelection, commit]);

  const moveToEnd = useCallback(() => {
    const last = { row: Math.max(0, rowCount - 1), col: Math.max(0, colCount - 1) };
    commit(last);
    rangeSelection?.startRange(last.row, last.col);
  }, [rowCount, colCount, rangeSelection, commit]);

  const getKeyDownHandler = useCallback(() => {
    return (e: {
      key: string;
      shiftKey?: boolean;
      ctrlKey?: boolean;
      metaKey?: boolean;
      preventDefault?: () => void;
    }) => {
      const shift = e.shiftKey === true;
      const mod = e.ctrlKey === true || e.metaKey === true;

      switch (e.key) {
        case 'ArrowUp':
        case 'ArrowDown':
        case 'ArrowLeft':
        case 'ArrowRight': {
          e.preventDefault?.();
          const drow = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
          const dcol = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
          if (mod) jumpBy(drow, dcol, shift);
          else moveBy(drow, dcol, shift);
          break;
        }
        case 'Tab': {
          // At the row's first/last cell (or before any cell is active) let Tab
          // move focus out of the grid instead of trapping it.
          const prev = activeCellRef.current;
          if (!prev || (shift ? prev.col <= 0 : prev.col >= colCount - 1)) break;
          e.preventDefault?.();
          moveBy(0, shift ? -1 : 1, false);
          break;
        }
        case 'Enter':
          e.preventDefault?.();
          moveBy(shift ? -1 : 1, 0, false);
          break;
        case 'Home':
          e.preventDefault?.();
          if (shift) extendTo(mod ? 0 : (activeCellRef.current?.row ?? 0), 0);
          else if (mod) moveToStart();
          else moveToRowStart();
          break;
        case 'End':
          e.preventDefault?.();
          if (shift) extendTo(mod ? rowCount - 1 : (activeCellRef.current?.row ?? 0), colCount - 1);
          else if (mod) moveToEnd();
          else moveToRowEnd();
          break;
        case 'PageUp':
          e.preventDefault?.();
          moveBy(-pageSize, 0, shift);
          break;
        case 'PageDown':
          e.preventDefault?.();
          moveBy(pageSize, 0, shift);
          break;
        default:
          break;
      }
    };
  }, [moveBy, jumpBy, extendTo, moveToRowStart, moveToRowEnd, moveToStart, moveToEnd, pageSize, rowCount, colCount]);

  return {
    activeCell,
    setActiveCell,
    moveUp,
    moveDown,
    moveLeft,
    moveRight,
    moveToRowStart,
    moveToRowEnd,
    moveToStart,
    moveToEnd,
    getKeyDownHandler,
  };
}
