import type { IColumnDef } from '../types';

/** The visible column range for horizontal virtualization. */
export interface IVisibleColumnRange {
  /** First visible unpinned column index (inclusive, accounting for overscan). */
  startIndex: number;
  /** Last visible unpinned column index (inclusive, accounting for overscan). */
  endIndex: number;
  /** Pixel width of the left spacer (for columns before the visible range). */
  leftOffset: number;
  /** Pixel width of the right spacer (for columns after the visible range). */
  rightOffset: number;
}

/**
 * Compute the range of columns visible in the horizontal viewport.
 * Linear scan over cumulative widths to find first/last visible column.
 *
 * @param scrollLeft - Current horizontal scroll offset (px)
 * @param columnWidths - Array of widths for each unpinned column (px)
 * @param containerWidth - Visible width of the scroll container (px)
 * @param overscan - Number of extra columns to render on each side (default: 2)
 * @returns The visible column range with start/end indices and left/right spacer widths
 */
export function computeVisibleColumnRange(
  scrollLeft: number,
  columnWidths: number[],
  containerWidth: number,
  overscan: number = 2
): IVisibleColumnRange {
  if (columnWidths.length === 0 || containerWidth <= 0) {
    return { startIndex: 0, endIndex: -1, leftOffset: 0, rightOffset: 0 };
  }

  let cumWidth = 0;
  let rawStart = columnWidths.length; // will be set when we find the first visible
  let rawEnd = -1;

  for (let i = 0; i < columnWidths.length; i++) {
    const colStart = cumWidth;
    cumWidth += columnWidths[i];

    // Column is visible if its right edge is past scrollLeft
    if (cumWidth > scrollLeft && rawStart === columnWidths.length) {
      rawStart = i;
    }
    // Column is visible if its left edge is before the right edge of the viewport
    if (colStart < scrollLeft + containerWidth) {
      rawEnd = i;
    }
  }

  if (rawStart > rawEnd) {
    return { startIndex: 0, endIndex: -1, leftOffset: 0, rightOffset: 0 };
  }

  // Apply overscan
  const startIndex = Math.max(0, rawStart - overscan);
  const endIndex = Math.min(columnWidths.length - 1, rawEnd + overscan);

  // Calculate spacer offsets
  let leftOffset = 0;
  for (let i = 0; i < startIndex; i++) {
    leftOffset += columnWidths[i];
  }

  let rightOffset = 0;
  for (let i = endIndex + 1; i < columnWidths.length; i++) {
    rightOffset += columnWidths[i];
  }

  return { startIndex, endIndex, leftOffset, rightOffset };
}

/**
 * Partition visible columns into pinned-left, virtualized-unpinned, and pinned-right.
 * Pinned columns always render. Only unpinned columns in the visible range render.
 */
export function partitionColumnsForVirtualization<T>(
  visibleCols: IColumnDef<T>[],
  columnRange: IVisibleColumnRange | null,
  pinnedColumns?: Record<string, 'left' | 'right'>
): {
  pinnedLeft: IColumnDef<T>[];
  virtualizedUnpinned: IColumnDef<T>[];
  pinnedRight: IColumnDef<T>[];
  leftSpacerWidth: number;
  rightSpacerWidth: number;
} {
  const pinnedLeft: IColumnDef<T>[] = [];
  const pinnedRight: IColumnDef<T>[] = [];
  const unpinned: IColumnDef<T>[] = [];

  for (const col of visibleCols) {
    const pin = pinnedColumns?.[col.columnId];
    if (pin === 'left') pinnedLeft.push(col);
    else if (pin === 'right') pinnedRight.push(col);
    else unpinned.push(col);
  }

  if (!columnRange || columnRange.endIndex < 0) {
    return {
      pinnedLeft,
      virtualizedUnpinned: unpinned,
      pinnedRight,
      leftSpacerWidth: 0,
      rightSpacerWidth: 0,
    };
  }

  const virtualizedUnpinned = unpinned.slice(columnRange.startIndex, columnRange.endIndex + 1);

  return {
    pinnedLeft,
    virtualizedUnpinned,
    pinnedRight,
    leftSpacerWidth: columnRange.leftOffset,
    rightSpacerWidth: columnRange.rightOffset,
  };
}

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
  if (totalRows <= 0 || rowHeight <= 0 || containerHeight <= 0) {
    return { startIndex: 0, endIndex: 0, offsetTop: 0, offsetBottom: 0 };
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
