import { useState, useLayoutEffect, useEffect, useCallback, useRef } from 'react';
import type { IActiveCell, RowId } from '../types';

export interface UseActiveCellResult {
  activeCell: IActiveCell | null;
  setActiveCell: (cell: IActiveCell | null) => void;
}

/**
 * Tracks the active cell for keyboard navigation.
 * When wrapperRef and editingCell are provided, scrolls the active cell into view when it changes (and not editing).
 */
export function useActiveCell(
  wrapperRef?: React.RefObject<HTMLElement | null>,
  editingCell?: { rowId: RowId; columnId: string } | null
): UseActiveCellResult {
  const [activeCell, _setActiveCell] = useState<IActiveCell | null>(null);
  const activeCellRef = useRef(activeCell);
  activeCellRef.current = activeCell;

  // Deduplicating setter  -  skips state update (and all downstream effects) when
  // the cell coordinates haven't actually changed. This prevents re-renders when
  // rapidly clicking the same cell.
  const setActiveCell = useCallback((cell: IActiveCell | null) => {
    const prev = activeCellRef.current;
    if (prev === cell) return;
    if (prev && cell && prev.rowIndex === cell.rowIndex && prev.columnIndex === cell.columnIndex) return;
    _setActiveCell(cell);
  }, []);

  // RAF ref for batching scroll-into-view during rapid keyboard navigation
  const scrollRafRef = useRef(0);

  // Synchronously focus the cell to prevent the browser from resetting
  // focus to body between arrow presses.
  useLayoutEffect(() => {
    if (activeCell == null || wrapperRef?.current == null || editingCell != null) return;
    const { rowIndex, columnIndex } = activeCell;
    const selector = `[data-row-index="${rowIndex}"][data-col-index="${columnIndex}"]`;
    const cell = wrapperRef.current.querySelector(selector) as HTMLElement | null;
    if (cell && document.activeElement !== cell && typeof cell.focus === 'function') {
      cell.focus({ preventScroll: true });
    }
  }, [activeCell, editingCell, wrapperRef]);

  // Batch scroll-into-view via RAF so rapid keyboard navigation only scrolls once
  useEffect(() => {
    if (activeCell == null || wrapperRef?.current == null || editingCell != null) return;
    cancelAnimationFrame(scrollRafRef.current);
    scrollRafRef.current = requestAnimationFrame(() => {
      const wrapper = wrapperRef?.current;
      if (!wrapper) return;
      const { rowIndex, columnIndex } = activeCell;
      const selector = `[data-row-index="${rowIndex}"][data-col-index="${columnIndex}"]`;
      const cell = wrapper.querySelector(selector) as HTMLElement | null;
      if (cell) {
        const thead = wrapper.querySelector('thead');
        const headerHeight = thead ? thead.getBoundingClientRect().height : 0;
        const wrapperRect = wrapper.getBoundingClientRect();
        const cellRect = cell.getBoundingClientRect();

        // Vertical scroll (account for sticky thead)
        const visibleTop = wrapperRect.top + headerHeight;
        if (cellRect.top < visibleTop) {
          wrapper.scrollTop -= visibleTop - cellRect.top;
        } else if (cellRect.bottom > wrapperRect.bottom) {
          wrapper.scrollTop += cellRect.bottom - wrapperRect.bottom;
        }

        // Horizontal scroll  -  only when the wrapper actually scrolls horizontally
        if (wrapper.scrollWidth > wrapper.clientWidth) {
          if (cellRect.left < wrapperRect.left) {
            wrapper.scrollLeft -= wrapperRect.left - cellRect.left;
          } else if (cellRect.right > wrapperRect.right) {
            wrapper.scrollLeft += cellRect.right - wrapperRect.right;
          }
        }
      }
    });
  }, [activeCell, editingCell, wrapperRef]);

  // Clean up pending RAF on unmount
  useEffect(() => {
    return () => cancelAnimationFrame(scrollRafRef.current);
  }, []);

  return { activeCell, setActiveCell };
}
