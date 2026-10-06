import { useCallback, useLayoutEffect, useRef } from 'react';
import type * as React from 'react';
import { CELL_EDITOR_ATTR } from '../constants/domHelpers';
import type { IActiveCell } from '../types';

export interface UseGridCellFocusParams {
  wrapperRef: React.RefObject<HTMLElement | null>;
  activeCell: IActiveCell | null;
  setActiveCell: (cell: IActiveCell | null) => void;
  /** Non-null while a cell editor is open; the editor owns focus then. */
  editingCell: unknown;
  /** Leading checkbox / row-number columns; the first data column's index. */
  colOffset: number;
  /** The row-selection checkbox column (index 0) is a navigable cell. */
  checkboxColumn?: boolean;
  rowCount: number;
  /** Data column count (excluding colOffset columns). */
  colCount: number;
}

export interface UseGridCellFocusResult {
  /** The one body cell with tabIndex 0: the active cell, else the last active cell, else the first data cell. */
  tabStopCell: IActiveCell | null;
  /** Ref callback for the tab-stop cell element (GridRow attaches it to that cell only). */
  registerTabStop: (el: HTMLElement | null) => void;
  /** Wrapper focus/blur handlers (React's bubble through portals, so editors count as inside). */
  onFocus: (e: React.FocusEvent) => void;
  onBlur: () => void;
  /** Wrapper capture handlers that record whether focus moves follow a pointer or a key. */
  onPointerDownCapture: () => void;
  onKeyDownCapture: () => void;
}

/**
 * Focus options for a programmatic move. After a pointer press the move should
 * not draw a keyboard focus ring; Chrome would otherwise match :focus-visible,
 * because the grid prevents the native mousedown focus.
 */
export function cellFocusOptions(fromPointer: boolean): FocusOptions {
  return fromPointer ? ({ preventScroll: true, focusVisible: false } as FocusOptions) : { preventScroll: true };
}

/** A body cell of this grid that takes part in roving focus (data and checkbox cells render a tabindex). */
function isBodyCell(el: Element, wrapper: HTMLElement): boolean {
  return el.tagName === 'TD' && el.hasAttribute('tabindex') && el.closest('tbody') != null && wrapper.contains(el);
}

/** Coordinates of a body cell from its content element's data attributes. */
function readCellCoords(td: Element): IActiveCell | null {
  const content = td.querySelector(':scope > [data-row-index][data-col-index]');
  if (!content) return null;
  const rowIndex = Number(content.getAttribute('data-row-index'));
  const columnIndex = Number(content.getAttribute('data-col-index'));
  return Number.isInteger(rowIndex) && Number.isInteger(columnIndex) ? { rowIndex, columnIndex } : null;
}

function isFocusLost(el: Element | null): boolean {
  return el == null || el === document.body || el === document.documentElement;
}

/**
 * Roving tabindex for the grid body (WAI-ARIA grid pattern).
 *
 * - Exactly one body cell is a tab stop (`tabStopCell`); every other data cell
 *   renders tabIndex -1. GridRow sets these from a per-row column number, so a
 *   move re-renders only the rows it enters and leaves.
 * - After each grid render, DOM focus follows the active cell when the grid
 *   holds focus: on the wrapper, on another body cell, on a control in a cell
 *   (only when the active cell moved), or lost to <body> (an editor closed or
 *   the focused row unmounted).
 * - When the tab-stop cell isn't in the DOM (virtualized away, or no rows) the
 *   wrapper becomes the tab stop (tabIndex 0) and holds focus; focus returns to
 *   the cell once its row renders again.
 */
export function useGridCellFocus(params: UseGridCellFocusParams): UseGridCellFocusResult {
  const { wrapperRef, activeCell, setActiveCell, editingCell, colOffset, checkboxColumn = false, rowCount, colCount } = params;

  // Remembered stop after the active cell clears (Escape), so Tab returns to it.
  const lastStopRef = useRef<IActiveCell | null>(null);
  const inBounds = (c: IActiveCell | null): c is IActiveCell =>
    c != null && c.rowIndex >= 0 && c.rowIndex < rowCount && colCount > 0 &&
    ((c.columnIndex >= colOffset && c.columnIndex < colOffset + colCount) || (checkboxColumn && c.columnIndex === 0));
  const tabStopCell: IActiveCell | null = inBounds(activeCell)
    ? activeCell
    : inBounds(lastStopRef.current)
      ? lastStopRef.current
      : rowCount > 0 && colCount > 0
        ? { rowIndex: 0, columnIndex: colOffset }
        : null;

  const stopElRef = useRef<HTMLElement | null>(null);
  const registerTabStop = useCallback((el: HTMLElement | null) => {
    stopElRef.current = el;
  }, []);

  /** The last interaction in the grid was a pointer press (not a key). */
  const pointerRef = useRef(false);
  const onPointerDownCapture = useCallback(() => { pointerRef.current = true; }, []);
  const onKeyDownCapture = useCallback(() => { pointerRef.current = false; }, []);

  /** Focus was inside the grid (React tree, so portaled editors count) and has not left. */
  const focusWithinRef = useRef(false);
  const prevActiveRef = useRef<IActiveCell | null>(null);
  const latest = useRef({ activeCell, tabStopCell, setActiveCell });
  latest.current = { activeCell, tabStopCell, setActiveCell };

  const onFocus = useCallback((e: React.FocusEvent) => {
    focusWithinRef.current = true;
    const wrapper = wrapperRef.current;
    const target = e.target as Element;
    if (!wrapper || !isBodyCell(target, wrapper)) return;
    const { activeCell: active, tabStopCell: stop, setActiveCell: setActive } = latest.current;
    const stopEl = stopElRef.current;
    if (active == null) {
      // Tabbing into the grid (or assistive technology focusing a cell) makes
      // the focused cell active.
      const cell = target === stopEl ? stop : readCellCoords(target);
      if (cell) setActive(cell);
    } else if (stopEl && target !== stopEl && stopEl.isConnected) {
      // A stray focus on another cell (e.g. a library restoring focus after a
      // popover closed) goes back to the active cell.
      stopEl.focus(cellFocusOptions(pointerRef.current));
    }
  }, [wrapperRef]);

  const onBlur = useCallback(() => {
    // focusout precedes focusin, so a move within the grid sets this back.
    focusWithinRef.current = false;
  }, []);

  // Runs after every grid render (rows mount/unmount with scrolling and data).
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    const activeMoved = prevActiveRef.current !== activeCell;
    prevActiveRef.current = activeCell;
    if (activeCell) lastStopRef.current = activeCell;
    if (!wrapper) return;

    const stopEl = stopElRef.current?.isConnected ? stopElRef.current : null;
    // The wrapper is a tab stop only while no cell is.
    const wrapperTabIndex = stopEl ? -1 : 0;
    if (wrapper.tabIndex !== wrapperTabIndex) wrapper.tabIndex = wrapperTabIndex;

    if (editingCell != null) return;
    const focused = document.activeElement;
    if (focused === stopEl) return;
    const options = cellFocusOptions(pointerRef.current);

    if (isFocusLost(focused)) {
      // The focused cell or editor left the DOM while the grid had focus.
      if (!focusWithinRef.current) return;
      (activeCell && stopEl ? stopEl : wrapper).focus(options);
      return;
    }
    if (!activeCell || !stopEl || !focused) return;
    if (focused === wrapper) {
      stopEl.focus(options);
      return;
    }
    if (!wrapper.contains(focused) || focused.closest(`[${CELL_EDITOR_ATTR}]`) || !focused.closest('tbody')) return;
    // Another cell, or a control inside a cell after the active cell moved.
    if (isBodyCell(focused, wrapper) || activeMoved) stopEl.focus(options);
  });

  return { tabStopCell, registerTabStop, onFocus, onBlur, onPointerDownCapture, onKeyDownCapture };
}
