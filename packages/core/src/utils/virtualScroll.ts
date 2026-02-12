/** The visible row range and spacer offsets for virtual scrolling. */
export interface IVisibleRange {
  /** First visible row index (inclusive, accounting for overscan). */
  startIndex: number;
  /** Last visible row index (inclusive, accounting for overscan). */
  endIndex: number;
  /** Pixel height of the top spacer (to push visible rows into correct scroll position). */
  offsetTop: number;
  /** Pixel height of the bottom spacer (to maintain correct scroll height). */
  offsetBottom: number;
}

/**
 * Compute the range of rows that should be rendered for a given scroll position.
 *
 * @param scrollTop - Current vertical scroll offset (px)
 * @param rowHeight - Fixed height of each row (px)
 * @param containerHeight - Visible height of the scroll container (px)
 * @param totalRows - Total number of rows in the dataset
 * @param overscan - Number of extra rows to render above and below the visible area (default: 5)
 * @returns The visible range with start/end indices and top/bottom spacer offsets
 */
export function computeVisibleRange(
  scrollTop: number,
  rowHeight: number,
  containerHeight: number,
  totalRows: number,
  overscan: number = 5
): IVisibleRange {
  if (totalRows === 0 || rowHeight <= 0 || containerHeight <= 0) {
    return { startIndex: 0, endIndex: -1, offsetTop: 0, offsetBottom: 0 };
  }

  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const endIndex = Math.min(
    totalRows - 1,
    Math.ceil((scrollTop + containerHeight) / rowHeight) + overscan
  );
  const offsetTop = startIndex * rowHeight;
  const offsetBottom = Math.max(0, (totalRows - endIndex - 1) * rowHeight);

  return { startIndex, endIndex, offsetTop, offsetBottom };
}

/**
 * Compute the total scrollable height for all rows.
 */
export function computeTotalHeight(totalRows: number, rowHeight: number): number {
  return totalRows * rowHeight;
}

/**
 * Compute the scrollTop value needed to bring a specific row into view.
 *
 * @param rowIndex - The row to scroll to
 * @param rowHeight - Fixed height of each row (px)
 * @param containerHeight - Visible height of the scroll container (px)
 * @param align - Where to position the row: 'start' (top), 'center', or 'end' (bottom). Default: 'start'.
 * @returns The scrollTop value to set on the container
 */
export function getScrollTopForRow(
  rowIndex: number,
  rowHeight: number,
  containerHeight: number,
  align: 'start' | 'center' | 'end' = 'start'
): number {
  const rowTop = rowIndex * rowHeight;

  switch (align) {
    case 'start':
      return rowTop;
    case 'center':
      return Math.max(0, rowTop - (containerHeight - rowHeight) / 2);
    case 'end':
      return Math.max(0, rowTop - containerHeight + rowHeight);
  }
}
