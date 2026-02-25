/**
 * Column autosize DOM measurement utilities shared across all frameworks.
 */

import { DEFAULT_MIN_COLUMN_WIDTH } from '../constants/layout';

/** Extra pixels added after body content measurement for padding. */
export const AUTOSIZE_EXTRA_PX = 16;

/** Maximum column width from autosize. */
export const AUTOSIZE_MAX_PX = 520;

/**
 * Measure the ideal width for a header cell by temporarily expanding all
 * overflow-hidden descendants to their natural width, then measuring the
 * content container. Adds resize handle width + th padding.
 */
function measureHeaderWidth(th: HTMLElement): number {
  const cs = getComputedStyle(th);
  const thPadding = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
  const thBorders = (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0);

  // Find resize handle width (sibling of the content container)
  let resizeHandleWidth = 0;
  for (let i = 0; i < th.children.length; i++) {
    const child = th.children[i] as HTMLElement;
    const cls = child.className || '';
    if (cls.includes('resizeHandle') || cls.includes('resize-handle') || cls.includes('ogrid-resize-handle')) {
      resizeHandleWidth = child.offsetWidth;
      break;
    }
  }

  // Content container is the first element child (before resize handle)
  const contentContainer = th.firstElementChild as HTMLElement;
  if (!contentContainer) return th.offsetWidth;

  // Collect modified elements for restoration
  const modified: { el: HTMLElement; overflow: string; flexShrink: string; width: string; minWidth: string; maxWidth: string }[] = [];

  const expandDescendants = (parent: HTMLElement) => {
    for (let i = 0; i < parent.children.length; i++) {
      const child = parent.children[i] as HTMLElement;
      const style = getComputedStyle(child);
      if (style.overflow === 'hidden' || style.flexShrink !== '0') {
        modified.push({
          el: child,
          overflow: child.style.overflow,
          flexShrink: child.style.flexShrink,
          width: child.style.width,
          minWidth: child.style.minWidth,
          maxWidth: child.style.maxWidth,
        });
        child.style.overflow = 'visible';
        child.style.flexShrink = '0';
        child.style.width = 'max-content';
        child.style.minWidth = 'max-content';
        child.style.maxWidth = 'none';
      }
      expandDescendants(child);
    }
  };

  // Take content container out of flow so table column width doesn't constrain it
  const origPos = contentContainer.style.position;
  const origWidth = contentContainer.style.width;
  contentContainer.style.position = 'absolute';
  contentContainer.style.width = 'max-content';
  expandDescendants(contentContainer);

  // Measure expanded content width (single reflow)
  const expandedWidth = contentContainer.offsetWidth;

  // Restore everything
  contentContainer.style.position = origPos;
  contentContainer.style.width = origWidth;
  for (const m of modified) {
    m.el.style.overflow = m.overflow;
    m.el.style.flexShrink = m.flexShrink;
    m.el.style.width = m.width;
    m.el.style.minWidth = m.minWidth;
    m.el.style.maxWidth = m.maxWidth;
  }

  return expandedWidth + resizeHandleWidth + thPadding + thBorders;
}

/**
 * Measure the ideal width for a column by scanning all DOM cells with
 * `[data-column-id="<columnId>"]` and computing the maximum content width.
 *
 * Header cells: temporarily unconstrained to measure true content width.
 * Body cells: measured via `position: absolute; width: max-content`.
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

  // Batch: collect body cell content elements to measure
  const contentEls: HTMLElement[] = [];
  const origPositions: string[] = [];
  const origWidths: string[] = [];

  cells.forEach((cell) => {
    const el = cell as HTMLElement;
    const isHeader = !!el.querySelector?.('[data-header-label]');
    if (isHeader) {
      // Header cell: expand overflow chain and measure content + padding + resize handle
      maxWidth = Math.max(maxWidth, measureHeaderWidth(el));
    } else {
      // Body cell: queue inner content element for batched measurement
      const content = (el.firstElementChild as HTMLElement) ?? el;
      contentEls.push(content);
    }
  });

  if (contentEls.length > 0) {
    // Write pass: take all content elements out of flow to measure natural width
    for (let i = 0; i < contentEls.length; i++) {
      const el = contentEls[i];
      origPositions.push(el.style.position);
      origWidths.push(el.style.width);
      el.style.position = 'absolute';
      el.style.width = 'max-content';
    }

    // Read pass: measure all content elements (single reflow)
    for (let i = 0; i < contentEls.length; i++) {
      maxWidth = Math.max(maxWidth, contentEls[i].offsetWidth + AUTOSIZE_EXTRA_PX);
    }

    // Restore pass: put everything back
    for (let i = 0; i < contentEls.length; i++) {
      contentEls[i].style.position = origPositions[i];
      contentEls[i].style.width = origWidths[i];
    }
  }

  return Math.min(AUTOSIZE_MAX_PX, Math.max(minW, Math.ceil(maxWidth)));
}
