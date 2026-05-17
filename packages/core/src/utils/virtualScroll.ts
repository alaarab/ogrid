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

// --- Scaled spacer (large-dataset DOM height-cap workaround) -----------------
//
// Browsers cap the rendered height of a single element. Chrome and Firefox
// clamp at 33,554,432 px (2^25). A virtual list sizes its spacer to
// totalRows * rowHeight so the native scrollbar geometry is correct, so at
// rowHeight 36 the spacer overflows the cap around 932,000 rows. Past that
// point scrollTop saturates and the bottom rows become unreachable.
//
// The fix (AG Grid's "DOM virtualisation" technique): clamp the spacer to a
// safe height below the cap. When the real content height exceeds that, the
// scrollbar still covers the whole dataset but each scrollbar pixel maps to
// more than one content pixel. computeScaledWindow converts the browser's
// (compressed) scrollTop back into a real content offset via a scale factor,
// derives the visible row range from that real offset, and reports the offset
// at which to position the rendered row block in compressed space.

/**
 * Conservative safe ceiling for a single scrollable element's height (px).
 * Sits below the 2^25 = 33,554,432 px browser cap with margin to spare.
 */
export const MAX_SPACER_PX = 32_000_000;

/** Inputs describing a virtualized dataset for scaled-spacer math. */
export interface IScaledSpacerConfig {
  /** Total number of rows in the dataset. */
  totalRows: number;
  /** Fixed row height in pixels. */
  rowHeight: number;
  /** Visible height of the scroll container (px). */
  viewportHeight: number;
  /** Override the safe ceiling. Defaults to {@link MAX_SPACER_PX}. */
  maxSpacerPx?: number;
}

/** Spacer height and scale factor derived for a dataset. */
export interface IScaledSpacerGeometry {
  /** True (uncapped) content height: totalRows * rowHeight. */
  realHeight: number;
  /** Spacer height to apply to the DOM. Never exceeds the cap. */
  spacerHeight: number;
  /** True when scaling is active (realHeight exceeded the cap). */
  scaled: boolean;
  /**
   * realHeight / spacerHeight. 1 when not scaled. When scaled, one compressed
   * (DOM) pixel represents `scale` real pixels.
   */
  scale: number;
}

/**
 * Decide the spacer height and scale factor for a dataset. O(1).
 *
 * When realHeight is within the cap, the spacer matches it exactly and scale
 * is 1 (no behavior change from a plain virtual list). When realHeight exceeds
 * the cap, the spacer is clamped and scale becomes realHeight / spacerHeight.
 *
 * @param config - Dataset dimensions and optional cap override.
 * @returns The spacer geometry.
 */
export function computeScaledGeometry(config: IScaledSpacerConfig): IScaledSpacerGeometry {
  const cap = config.maxSpacerPx ?? MAX_SPACER_PX;
  const realHeight = Math.max(0, config.totalRows) * Math.max(0, config.rowHeight);
  if (realHeight <= cap) {
    return { realHeight, spacerHeight: realHeight, scaled: false, scale: 1 };
  }
  return { realHeight, spacerHeight: cap, scaled: true, scale: realHeight / cap };
}

/** The visible row range plus the compressed-space offset for the row block. */
export interface IScaledRowWindow {
  /** First visible row index (inclusive, accounting for overscan). */
  startIndex: number;
  /** Last visible row index (inclusive, accounting for overscan). */
  endIndex: number;
  /**
   * Pixel offset in compressed (DOM) space at which to position the rendered
   * row block, i.e. the value to pass to `transform: translateY(...)`.
   */
  offsetPx: number;
  /** Real content offset the user is looking at. Useful for diagnostics. */
  realScrollTop: number;
}

/**
 * Map a browser scrollTop (compressed space) to the row window to render. O(1):
 * fixed-height arithmetic, the same complexity as {@link computeVisibleRange}.
 *
 * When scaling is active the bottom of the scrollable range must still land on
 * the last row, so the fraction scrolled (0..1) is mapped onto the real range
 * rather than scrollTop being scaled directly. This keeps the last row
 * reachable. The rendered block is positioned in compressed space at
 * (startIndex * rowHeight) / scale; because a compressed pixel spans `scale`
 * real pixels, the scale-induced distortion across the small overscan window
 * is sub-pixel and not visible.
 *
 * @param scrollTop - Current scrollTop of the container (compressed space).
 * @param geometry - Output of {@link computeScaledGeometry}.
 * @param config - The same dataset config passed to computeScaledGeometry.
 * @param overscan - Extra rows rendered above and below the viewport. Default 8.
 * @returns The visible row range and the compressed-space block offset.
 */
export function computeScaledWindow(
  scrollTop: number,
  geometry: IScaledSpacerGeometry,
  config: IScaledSpacerConfig,
  overscan: number = 8
): IScaledRowWindow {
  const { rowHeight, totalRows, viewportHeight } = config;
  if (totalRows <= 0 || rowHeight <= 0) {
    return { startIndex: 0, endIndex: -1, offsetPx: 0, realScrollTop: 0 };
  }

  // Real content offset under the thumb. When scaled, map the FRACTION
  // scrolled (0..1) onto the real range so the last row stays reachable.
  const maxCompressedScroll = Math.max(1, geometry.spacerHeight - viewportHeight);
  const fraction = Math.min(1, Math.max(0, scrollTop / maxCompressedScroll));
  const maxRealScroll = Math.max(0, geometry.realHeight - viewportHeight);
  const realScrollTop = geometry.scaled ? fraction * maxRealScroll : scrollTop;

  const firstVisible = Math.floor(realScrollTop / rowHeight);
  const visibleCount = Math.ceil(viewportHeight / rowHeight);
  const startIndex = Math.max(0, firstVisible - overscan);
  const endIndex = Math.min(totalRows - 1, firstVisible + visibleCount + overscan);

  // Position the rendered block in compressed space. The browser's scrollTop
  // already moved the viewport; the block is offset so row startIndex sits at
  // the right place. In compressed space the block's natural top is
  // (startIndex * rowHeight) / scale.
  const offsetPx = (startIndex * rowHeight) / geometry.scale;

  return { startIndex, endIndex, offsetPx, realScrollTop };
}

/**
 * Inverse of {@link computeScaledWindow}: given a target row, return the
 * compressed scrollTop to set so that row is brought to the top of the
 * viewport. Used by scrollToIndex and keyboard paging. O(1).
 *
 * @param rowIndex - The row to scroll to.
 * @param geometry - Output of {@link computeScaledGeometry}.
 * @param config - The same dataset config passed to computeScaledGeometry.
 * @returns The scrollTop value to set on the container (compressed space).
 */
export function scrollTopForRowScaled(
  rowIndex: number,
  geometry: IScaledSpacerGeometry,
  config: IScaledSpacerConfig
): number {
  const realTop = Math.max(0, rowIndex) * config.rowHeight;
  const maxCompressedScroll = Math.max(0, geometry.spacerHeight - config.viewportHeight);
  if (!geometry.scaled) return Math.min(realTop, maxCompressedScroll);
  const maxRealScroll = Math.max(1, geometry.realHeight - config.viewportHeight);
  // realTop for the final rows can exceed maxRealScroll (their top sits inside
  // the last viewport). Clamp the fraction so the result never overshoots the
  // compressed scroll range, otherwise jump-to-last lands 1px past the end.
  const fraction = Math.min(1, realTop / maxRealScroll);
  return fraction * maxCompressedScroll;
}
