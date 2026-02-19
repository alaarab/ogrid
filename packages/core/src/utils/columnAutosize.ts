/**
 * Column autosize DOM measurement utilities shared across all frameworks.
 */

import { DEFAULT_MIN_COLUMN_WIDTH } from '../constants/layout';

/** Extra pixels added to header label width to account for filter icon + padding. */
export const AUTOSIZE_EXTRA_PX = 28;

/** Maximum column width from autosize. */
export const AUTOSIZE_MAX_PX = 520;

/**
 * Measure the ideal width for a column by scanning all DOM cells with
 * `[data-column-id="<columnId>"]` and computing the maximum scrollWidth.
 *
 * Header cells with a `[data-header-label]` child get extra padding for icons.
 *
 * @param columnId - Column to measure
 * @param minWidth - Minimum width (defaults to DEFAULT_MIN_COLUMN_WIDTH)
 * @param container - Optional container element to scope the query (defaults to `document`)
 * @returns The ideal column width in pixels, clamped between minWidth and AUTOSIZE_MAX_PX
 */
export function measureColumnContentWidth(
  columnId: string,
  minWidth?: number,
  container?: { querySelectorAll: (selector: string) => NodeListOf<Element> }
): number {
  const minW = minWidth ?? DEFAULT_MIN_COLUMN_WIDTH;
  const root = container ?? document;
  const cells = root.querySelectorAll(`[data-column-id="${columnId}"]`);

  if (cells.length === 0) return minW;

  let maxWidth = minW;

  cells.forEach((cell) => {
    const el = cell as HTMLElement;
    const label = el.querySelector?.('[data-header-label]') as HTMLElement | null;
    if (label) {
      maxWidth = Math.max(maxWidth, label.scrollWidth + AUTOSIZE_EXTRA_PX);
    } else {
      maxWidth = Math.max(maxWidth, el.scrollWidth);
    }
  });

  return Math.min(AUTOSIZE_MAX_PX, Math.max(minW, Math.ceil(maxWidth)));
}
