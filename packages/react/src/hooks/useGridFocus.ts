/**
 * useGridFocus — headless arrow-key cell navigation for OGrid.
 *
 * Manages the active cell coordinate and translates Arrow / Tab / Enter /
 * Home / End / PageUp / PageDown into cell movement scoped to the
 * currently rendered rows × columns. Pairs with `useRangeSelection` so
 * Shift+Arrow / Shift+Home / Shift+End extend the range. Tab at the first or
 * last column is left to the browser so focus can leave the grid.
 *
 * Arrow keys move through core's `computeArrowNavigation`, the same function
 * `<OGrid>` uses. Ctrl+Arrow (Cmd on macOS) jumps like Excel: pass
 * `isCellEmpty` and it moves to the edge of the current data region along
 * that axis; without it, to the grid edge.
 * Ctrl+Shift+Arrow extends the range to the same target.
 *
 * Consumer attaches `getKeyDownHandler()` to their grid container's
 * `onKeyDown` and renders the active cell highlight from `activeCell`. For
 * focus there are two options:
 *
 * - Container focus: make the container focusable (`tabIndex={0}`); the active
 *   cell is visual only.
 * - Roving tabindex (WAI-ARIA grid pattern, what `<OGrid>` does): spread
 *   `getCellProps(row, col)` on each cell. The active cell (or the first cell
 *   before any is active) gets `tabIndex` 0 and every other cell -1, focusing
 *   a cell makes it active, and DOM focus follows the active cell while a
 *   cell has focus. Key events from the focused cell bubble to the
 *   container's `onKeyDown`. Rows that are virtualized out of the DOM can't
 *   hold focus: keep the container focusable (`tabIndex={-1}`) and focus it
 *   when the active row unmounts, or don't unmount the active row.
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
 *
 * Roving tabindex instead (no tabIndex on the container):
 *
 *   <table role="grid" onKeyDown={focus.getKeyDownHandler()}>
 *     ...
 *       <td role="gridcell" {...focus.getCellProps(rowIdx, colIdx)} />
 *   </table>
 */

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type * as React from 'react';
import { computeArrowNavigation } from '@alaarab/ogrid-core';
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

/** Props `getCellProps` returns for one cell (roving tabindex). */
export interface GridFocusCellProps {
  /** 0 for the grid's one tab stop (the active cell, else the first cell), -1 otherwise. */
  tabIndex: 0 | -1;
  /** Set on the tab-stop cell only, so the hook can move focus to it. Stable identity. */
  ref: ((el: HTMLElement | null) => void) | undefined;
  /** Makes a cell active when it receives focus (Tab, click, assistive technology). */
  onFocus: (e: React.FocusEvent) => void;
  /** Tracks that focus left the cell. */
  onBlur: (e: React.FocusEvent) => void;
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
  /**
   * Optional roving tabindex. Spread on each cell element:
   * `<td {...getCellProps(row, col)} />`. Exactly one cell is a tab stop;
   * while a cell has focus, focus follows the active cell (keyboard moves,
   * `setActiveCell`, `moveTo*`). Additive: not calling it keeps the
   * container-focus model.
   */
  getCellProps: (row: number, col: number) => GridFocusCellProps;
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

type ArrowKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

const NEVER_EMPTY = (): boolean => false;

/**
 * Headless arrow-key cell navigation.
 *
 * State + a keydown handler factory. Touches the DOM only when a consumer
 * opts into roving tabindex through `getCellProps` (it then focuses the
 * tab-stop cell as the active cell moves).
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

  /** Make `next` active; plain moves collapse the range to it, extending ones move its focus. */
  const moveTo = useCallback(
    (next: CellCoord, extendRange: boolean) => {
      commit(next);
      if (rangeSelection) {
        if (extendRange) rangeSelection.extendRange(next.row, next.col);
        else rangeSelection.startRange(next.row, next.col);
      }
    },
    [rangeSelection, commit],
  );

  const moveBy = useCallback(
    (drow: number, dcol: number, extendRange = false) => {
      if (rowCount <= 0 || colCount <= 0) return;
      const prev = activeCellRef.current;
      // With no active cell yet, the first move focuses the first cell.
      moveTo(
        prev
          ? { row: clamp(prev.row + drow, 0, rowCount - 1), col: clamp(prev.col + dcol, 0, colCount - 1) }
          : { row: 0, col: 0 },
        extendRange,
      );
    },
    [rowCount, colCount, moveTo],
  );

  // Arrow keys go through core's computeArrowNavigation, the function <OGrid>
  // uses, so steps and Ctrl/Cmd+Arrow data-region jumps match it. Without an
  // isCellEmpty predicate every cell counts as filled, which makes a jump land
  // on the grid edge. With Shift the active cell still moves and the range
  // extends to it.
  const arrow = useCallback(
    (direction: ArrowKey, jump: boolean, extendRange: boolean) => {
      if (rowCount <= 0 || colCount <= 0) return;
      const prev = activeCellRef.current;
      if (!prev) {
        moveTo({ row: 0, col: 0 }, extendRange);
        return;
      }
      const maxRow = rowCount - 1;
      const maxCol = colCount - 1;
      // A cell left past the edge after the grid shrank: a jump starts from it
      // clamped into the grid; a step is clamped after moving, landing on the edge.
      const row = jump ? clamp(prev.row, 0, maxRow) : prev.row;
      const col = jump ? clamp(prev.col, 0, maxCol) : prev.col;
      const { newRowIndex, newColumnIndex } = computeArrowNavigation({
        direction,
        rowIndex: row,
        columnIndex: col,
        dataColIndex: col,
        colOffset: 0,
        maxRowIndex: maxRow,
        maxColIndex: maxCol,
        visibleColCount: colCount,
        isCtrl: jump,
        isShift: false,
        selectionRange: null,
        isEmptyAt: isCellEmpty ?? NEVER_EMPTY,
      });
      moveTo({ row: clamp(newRowIndex, 0, maxRow), col: clamp(newColumnIndex, 0, maxCol) }, extendRange);
    },
    [rowCount, colCount, isCellEmpty, moveTo],
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
        case 'ArrowRight':
          e.preventDefault?.();
          arrow(e.key, mod, shift);
          break;
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
  }, [moveBy, arrow, extendTo, moveToRowStart, moveToRowEnd, moveToStart, moveToEnd, pageSize, rowCount, colCount]);

  // --- Roving tabindex (opt-in through getCellProps) ---
  const tabStopElRef = useRef<HTMLElement | null>(null);
  const cellHasFocusRef = useRef(false);
  const tabStopRef = useCallback((el: HTMLElement | null) => {
    tabStopElRef.current = el;
  }, []);
  const onCellBlur = useCallback(() => {
    cellHasFocusRef.current = false;
  }, []);

  // Focus follows the active cell, but only while a cell already has focus:
  // moving the active cell from outside the grid must not steal focus.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the active cell moves; the tab-stop element is read from a ref the ref callback set during that commit
  useLayoutEffect(() => {
    const el = tabStopElRef.current;
    if (!el || !cellHasFocusRef.current || !el.isConnected) return;
    if (document.activeElement !== el) el.focus({ preventScroll: true });
  }, [activeCell]);

  const getCellProps = useCallback(
    (row: number, col: number): GridFocusCellProps => {
      // An active cell left outside the grid (it shrank) falls back to the first cell.
      const active = activeCell && activeCell.row < rowCount && activeCell.col < colCount ? activeCell : null;
      const isStop = active
        ? active.row === row && active.col === col
        : row === 0 && col === 0;
      return {
        tabIndex: isStop ? 0 : -1,
        ref: isStop ? tabStopRef : undefined,
        onFocus: (e: React.FocusEvent) => {
          // Only the cell itself, not a control inside it.
          if (e.target !== e.currentTarget) return;
          cellHasFocusRef.current = true;
          const prev = activeCellRef.current;
          if (!prev || prev.row !== row || prev.col !== col) commit({ row, col });
        },
        onBlur: onCellBlur,
      };
    },
    [activeCell, rowCount, colCount, tabStopRef, onCellBlur, commit],
  );

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
    getCellProps,
    getKeyDownHandler,
  };
}
