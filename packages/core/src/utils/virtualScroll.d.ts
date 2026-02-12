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
export declare function computeVisibleRange(scrollTop: number, rowHeight: number, containerHeight: number, totalRows: number, overscan?: number): IVisibleRange;
/**
 * Compute the total scrollable height for all rows.
 */
export declare function computeTotalHeight(totalRows: number, rowHeight: number): number;
/**
 * Compute the scrollTop value needed to bring a specific row into view.
 *
 * @param rowIndex - The row to scroll to
 * @param rowHeight - Fixed height of each row (px)
 * @param containerHeight - Visible height of the scroll container (px)
 * @param align - Where to position the row: 'start' (top), 'center', or 'end' (bottom). Default: 'start'.
 * @returns The scrollTop value to set on the container
 */
export declare function getScrollTopForRow(rowIndex: number, rowHeight: number, containerHeight: number, align?: 'start' | 'center' | 'end'): number;
