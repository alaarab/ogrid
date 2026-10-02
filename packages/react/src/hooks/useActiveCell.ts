import { useState, useLayoutEffect, useCallback, useRef } from 'react';
import type { IActiveCell, RowId } from '../types';
import type { UseVirtualScrollResult } from './useVirtualScroll';

export interface UseActiveCellResult {
  activeCell: IActiveCell | null;
  setActiveCell: (cell: IActiveCell | null) => void;
}

/**
 * Tracks the active cell for keyboard navigation.
 * When wrapperRef and editingCell are provided, scrolls the active cell into view when it changes (and not editing).
 * An optional index scroller handles virtual rows; focus retries once the target renders.
 */
export function useActiveCell(
  wrapperRef?: React.RefObject<HTMLElement | null>,
  editingCell?: { rowId: RowId; columnId: string } | null,
  scrollToIndexRef?: React.RefObject<UseVirtualScrollResult['scrollToIndex'] | null>
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
  const pendingFocusRef = useRef(false);

  // Focus the active cell synchronously (prevents browser resetting focus
  // to <body> between arrow presses), then queue a scroll-into-view via RAF
  // so rapid keyboard navigation batches into a single scroll. Virtual rows
  // scroll by index and may appear between the focus and scroll phases.
  useLayoutEffect(() => {
    pendingFocusRef.current = false;
    if (activeCell == null || wrapperRef?.current == null || editingCell != null) return;
    const wrapper = wrapperRef.current;
    const { rowIndex, columnIndex } = activeCell;
    const selector = `[data-row-index="${rowIndex}"][data-col-index="${columnIndex}"]`;
    const cell = wrapper.querySelector(selector) as HTMLElement | null;
    scrollToIndexRef?.current?.(rowIndex, 'auto');
    pendingFocusRef.current = cell == null;

    // Synchronous focus
    if (cell && document.activeElement !== cell && typeof cell.focus === 'function') {
      cell.focus({ preventScroll: true });
    }

    // Async scroll-into-view (batched via RAF)
    cancelAnimationFrame(scrollRafRef.current);
    scrollRafRef.current = requestAnimationFrame(() => {
      const cell = wrapper.querySelector(selector) as HTMLElement | null;
      if (!cell || !wrapper.isConnected) return;
      const thead = wrapper.querySelector('thead');
      const headerHeight = thead ? thead.getBoundingClientRect().height : 0;
      const wrapperRect = wrapper.getBoundingClientRect();
      const cellRect = cell.getBoundingClientRect();

      // Vertical scroll (account for sticky thead)
      const visibleTop = wrapperRect.top + headerHeight;
      if (!scrollToIndexRef?.current && cellRect.top < visibleTop) {
        wrapper.scrollTop -= visibleTop - cellRect.top;
      } else if (!scrollToIndexRef?.current && cellRect.bottom > wrapperRect.bottom) {
        wrapper.scrollTop += cellRect.bottom - wrapperRect.bottom;
      }

      // Horizontal scroll — only when the wrapper actually scrolls horizontally
      if (wrapper.scrollWidth > wrapper.clientWidth) {
        if (cellRect.left < wrapperRect.left) {
          wrapper.scrollLeft -= wrapperRect.left - cellRect.left;
        } else if (cellRect.right > wrapperRect.right) {
          wrapper.scrollLeft += cellRect.right - wrapperRect.right;
        }
      }
    });

    return () => cancelAnimationFrame(scrollRafRef.current);
  }, [activeCell, editingCell, wrapperRef, scrollToIndexRef]);

  // A virtualizer renders the target after the index scroll above. Retry focus
  // on that render, without scrolling back when the user later moves the thumb.
  useLayoutEffect(() => {
    if (!pendingFocusRef.current || !activeCell || editingCell != null) return;
    const cell = wrapperRef?.current?.querySelector<HTMLElement>(
      `[data-row-index="${activeCell.rowIndex}"][data-col-index="${activeCell.columnIndex}"]`
    );
    if (!cell) return;
    cell.focus({ preventScroll: true });
    pendingFocusRef.current = false;
  });

  return { activeCell, setActiveCell };
}
