/**
 * DOM utility functions for OGrid components.
 * These utilities are framework-agnostic and can be used across React, Angular, Vue, and vanilla JS implementations.
 */

import type { ISelectionRange } from '../types';

/**
 * Rectangle describing position and dimensions of a DOM element.
 */
export interface OverlayRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Measure the bounding rect of a cell range within a container.
 *
 * @param container - The grid container element with position: relative
 * @param range - The selection range to measure
 * @param colOffset - Column offset (1 when checkbox column is present, else 0)
 * @returns Rectangle describing the range position and size, or null if cells not found
 */
export function measureRange(
  container: HTMLElement,
  range: ISelectionRange,
  colOffset: number
): OverlayRect | null {
  const startGlobalCol = range.startCol + colOffset;
  const endGlobalCol = range.endCol + colOffset;

  const topLeft = container.querySelector(
    `[data-row-index="${range.startRow}"][data-col-index="${startGlobalCol}"]`
  ) as HTMLElement | null;
  const bottomRight = container.querySelector(
    `[data-row-index="${range.endRow}"][data-col-index="${endGlobalCol}"]`
  ) as HTMLElement | null;

  if (!topLeft || !bottomRight) return null;

  const cRect = container.getBoundingClientRect();
  const tlRect = topLeft.getBoundingClientRect();
  const brRect = bottomRight.getBoundingClientRect();

  return {
    top: tlRect.top - cRect.top,
    left: tlRect.left - cRect.left,
    width: brRect.right - tlRect.left,
    height: brRect.bottom - tlRect.top,
  };
}

/**
 * Inject a global CSS rule into the document head (once per page, deduplicated by ID).
 *
 * @param id - Unique ID for the style element (prevents duplicates)
 * @param css - CSS content to inject
 *
 * @example
 * ```ts
 * injectGlobalStyles(
 *   'ogrid-marching-ants-keyframes',
 *   '@keyframes ogrid-marching-ants{to{stroke-dashoffset:-8}}'
 * );
 * ```
 */
/**
 * Stride for numeric cell index keys. Must exceed the maximum column count.
 * Power-of-2 enables fast JS engine optimisation of the multiplication.
 */
export const CELL_INDEX_STRIDE = 2048;

/** Compute a numeric key for cell index lookups: `row * CELL_INDEX_STRIDE + col`. */
export function cellIndexKey(row: number, col: number): number {
  return row * CELL_INDEX_STRIDE + col;
}

/**
 * Build a Map of numeric key → HTMLElement for O(1) cell lookups during drag operations.
 * Numeric keys avoid per-lookup string allocation that template-literal keys incur.
 * Scans the container once via querySelectorAll instead of per-frame DOM queries.
 */
export function buildCellIndex(container: HTMLElement | null): Map<number, HTMLElement> {
  const index = new Map<number, HTMLElement>();
  if (!container) return index;
  const cells = container.querySelectorAll('[data-row-index][data-col-index]');
  for (let i = 0; i < cells.length; i++) {
    const el = cells[i] as HTMLElement;
    const r = parseInt(el.getAttribute('data-row-index') ?? '', 10);
    const c = parseInt(el.getAttribute('data-col-index') ?? '', 10);
    if (!Number.isNaN(r) && !Number.isNaN(c)) {
      index.set(r * CELL_INDEX_STRIDE + c, el);
    }
  }
  return index;
}

export function injectGlobalStyles(id: string, css: string): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  document.head.appendChild(style);
}
