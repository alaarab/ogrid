/** Scrolls a virtual grid to a row (see useVirtualScroll's `scrollToIndex`). */
export type ScrollToRowIndex = (index: number, align?: 'auto' | 'start' | 'center' | 'end') => void;

/**
 * Scrolls a body cell into view below the sticky header.
 *
 * With a virtual scroller (`scrollToIndex`), the row is scrolled by index: the
 * target row may not be rendered yet, and in scaled mode DOM pixel deltas don't
 * map onto the compressed scrollTop. Columns always scroll through the DOM,
 * once the cell is rendered. Without one, both axes use the cell's DOM rect.
 */
export function scrollCellIntoView(
  wrapper: HTMLElement,
  rowIndex: number,
  columnIndex: number,
  scrollToIndex?: ScrollToRowIndex | null
): void {
  scrollToIndex?.(rowIndex, 'auto');
  const cell = wrapper.querySelector(`[data-row-index="${rowIndex}"][data-col-index="${columnIndex}"]`);
  if (!cell || !wrapper.isConnected) return;
  const thead = wrapper.querySelector('thead');
  const headerHeight = thead ? thead.getBoundingClientRect().height : 0;
  const wrapperRect = wrapper.getBoundingClientRect();
  const cellRect = cell.getBoundingClientRect();

  // Frozen top rows cover the body below the header: a scrolling row must clear them too.
  const frozenRows = cell.closest('tr[data-frozen-row]')
    ? null
    : wrapper.querySelectorAll('tbody > tr[data-frozen-row]');
  const lastFrozen = frozenRows && frozenRows.length > 0 ? frozenRows[frozenRows.length - 1] : null;
  const visibleTop = lastFrozen
    ? Math.max(wrapperRect.top + headerHeight, lastFrozen.getBoundingClientRect().bottom)
    : wrapperRect.top + headerHeight;

  // Vertical scroll (account for sticky thead and frozen rows). A virtual
  // grid already scrolled by index; it only needs clearing the frozen rows.
  if (!scrollToIndex) {
    if (cellRect.top < visibleTop) wrapper.scrollTop -= visibleTop - cellRect.top;
    else if (cellRect.bottom > wrapperRect.bottom) wrapper.scrollTop += cellRect.bottom - wrapperRect.bottom;
  } else if (lastFrozen && cellRect.top < visibleTop) {
    wrapper.scrollTop -= visibleTop - cellRect.top;
  }

  // Horizontal scroll: only when the wrapper actually scrolls horizontally
  if (wrapper.scrollWidth > wrapper.clientWidth) {
    if (cellRect.left < wrapperRect.left) wrapper.scrollLeft -= wrapperRect.left - cellRect.left;
    else if (cellRect.right > wrapperRect.right) wrapper.scrollLeft += cellRect.right - wrapperRect.right;
  }
}
