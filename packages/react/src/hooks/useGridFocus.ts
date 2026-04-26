/**
 * useGridFocus — headless arrow-key cell navigation for OGrid.
 *
 * Manages the active cell coordinate and translates Arrow / Tab / Enter /
 * Home / End / PageUp / PageDown into cell movement scoped to the
 * currently rendered rows × columns. Pairs with `useRangeSelection` so
 * Shift+Arrow extends the range.
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

import { useCallback, useState } from 'react';
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
   * Shift+Arrow extending the range when `rangeSelection` was provided.
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
  const { rowCount, colCount, pageSize = 10, rangeSelection } = params;

  const [activeCell, setActiveCellState] = useState<CellCoord | null>(null);

  const setActiveCell = useCallback((cell: CellCoord | null) => {
    setActiveCellState(cell);
  }, []);

  const moveBy = useCallback(
    (drow: number, dcol: number, extendRange = false) => {
      setActiveCellState((prev) => {
        if (rowCount <= 0 || colCount <= 0) return prev;
        const start = prev ?? { row: 0, col: 0 };
        const next: CellCoord = {
          row: clamp(start.row + drow, 0, rowCount - 1),
          col: clamp(start.col + dcol, 0, colCount - 1),
        };
        if (rangeSelection) {
          if (extendRange) rangeSelection.extendRange(next.row, next.col);
          else rangeSelection.startRange(next.row, next.col);
        }
        return next;
      });
    },
    [rowCount, colCount, rangeSelection],
  );

  const moveUp = useCallback((n = 1) => moveBy(-n, 0), [moveBy]);
  const moveDown = useCallback((n = 1) => moveBy(n, 0), [moveBy]);
  const moveLeft = useCallback((n = 1) => moveBy(0, -n), [moveBy]);
  const moveRight = useCallback((n = 1) => moveBy(0, n), [moveBy]);

  const moveToRowStart = useCallback(() => {
    setActiveCellState((prev) => {
      if (!prev) return { row: 0, col: 0 };
      const next = { row: prev.row, col: 0 };
      rangeSelection?.startRange(next.row, next.col);
      return next;
    });
  }, [rangeSelection]);

  const moveToRowEnd = useCallback(() => {
    setActiveCellState((prev) => {
      if (!prev) return { row: 0, col: Math.max(0, colCount - 1) };
      const next = { row: prev.row, col: Math.max(0, colCount - 1) };
      rangeSelection?.startRange(next.row, next.col);
      return next;
    });
  }, [colCount, rangeSelection]);

  const moveToStart = useCallback(() => {
    setActiveCellState({ row: 0, col: 0 });
    rangeSelection?.startRange(0, 0);
  }, [rangeSelection]);

  const moveToEnd = useCallback(() => {
    const last = { row: Math.max(0, rowCount - 1), col: Math.max(0, colCount - 1) };
    setActiveCellState(last);
    rangeSelection?.startRange(last.row, last.col);
  }, [rowCount, colCount, rangeSelection]);

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
          e.preventDefault?.();
          moveBy(-1, 0, shift);
          break;
        case 'ArrowDown':
          e.preventDefault?.();
          moveBy(1, 0, shift);
          break;
        case 'ArrowLeft':
          e.preventDefault?.();
          moveBy(0, -1, shift);
          break;
        case 'ArrowRight':
        case 'Tab':
          e.preventDefault?.();
          moveBy(0, shift && e.key === 'Tab' ? -1 : 1, false);
          break;
        case 'Enter':
          e.preventDefault?.();
          moveBy(shift ? -1 : 1, 0, false);
          break;
        case 'Home':
          e.preventDefault?.();
          if (mod) moveToStart();
          else moveToRowStart();
          break;
        case 'End':
          e.preventDefault?.();
          if (mod) moveToEnd();
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
  }, [moveBy, moveToRowStart, moveToRowEnd, moveToStart, moveToEnd, pageSize]);

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
