import { shallowRef, watch, onUnmounted, type Ref, type ShallowRef } from 'vue';
import type { IActiveCell, RowId } from '../types';

export interface UseActiveCellResult {
  activeCell: ShallowRef<IActiveCell | null>;
  setActiveCell: (cell: IActiveCell | null) => void;
}

/**
 * Tracks the active cell for keyboard navigation.
 * When wrapperRef and editingCell are provided, scrolls the active cell into view when it changes (and not editing).
 */
export function useActiveCell(
  wrapperRef?: Ref<HTMLElement | null> | ShallowRef<HTMLElement | null>,
  editingCell?: Ref<{ rowId: RowId; columnId: string } | null>
): UseActiveCellResult {
  const activeCell = shallowRef<IActiveCell | null>(null);
  let pendingRaf = 0;

  // Deduplicating setter — skips update when the cell coordinates haven't actually changed.
  const setActiveCell = (cell: IActiveCell | null) => {
    const prev = activeCell.value;
    if (prev === cell) return;
    if (prev && cell && prev.rowIndex === cell.rowIndex && prev.columnIndex === cell.columnIndex) return;
    activeCell.value = cell;
  };

  // Scroll active cell into view when it changes (equivalent to useLayoutEffect).
  // Uses requestAnimationFrame to batch DOM reads (getBoundingClientRect) with the
  // browser's layout cycle, avoiding forced reflows when rapidly clicking cells.
  watch(
    [activeCell, () => editingCell?.value],
    () => {
      // Cancel any pending scroll from a previous cell change
      if (pendingRaf) {
        cancelAnimationFrame(pendingRaf);
        pendingRaf = 0;
      }

      if (
        activeCell.value == null ||
        !wrapperRef?.value ||
        editingCell?.value != null
      ) return;

      // Capture the target coordinates before the async boundary
      const { rowIndex, columnIndex } = activeCell.value;

      pendingRaf = requestAnimationFrame(() => {
        pendingRaf = 0;
        const wrapper = wrapperRef.value;
        if (!wrapper) return;

        // Verify the active cell hasn't changed since we scheduled
        const current = activeCell.value;
        if (!current || current.rowIndex !== rowIndex || current.columnIndex !== columnIndex) return;

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

          // Horizontal scroll
          if (cellRect.left < wrapperRect.left) {
            wrapper.scrollLeft -= wrapperRect.left - cellRect.left;
          } else if (cellRect.right > wrapperRect.right) {
            wrapper.scrollLeft += cellRect.right - wrapperRect.right;
          }

          if (document.activeElement !== cell && typeof cell.focus === 'function') {
            cell.focus({ preventScroll: true });
          }
        }
      });
    },
    { flush: 'post' }
  );

  onUnmounted(() => {
    if (pendingRaf) {
      cancelAnimationFrame(pendingRaf);
      pendingRaf = 0;
    }
  });

  return { activeCell, setActiveCell };
}
