import { useLayoutEffect } from 'react';
import type { RefObject } from 'react';

/** Frozen body rows, marked by BaseGridRow. */
const FROZEN_ROW_SELECTOR = 'tbody > tr[data-frozen-row]';

/**
 * Positions frozen top rows: each frozen row's cells stick at the header's
 * height plus the frozen rows above it. The offsets are written as the
 * `--ogrid-frozen-top` custom property on each frozen `<tr>` (its cells read
 * it), straight to the DOM so rows don't re-render. Re-measured when the
 * header or a frozen row changes size.
 */
export function useFrozenRowOffsets(
  containerRef: RefObject<HTMLElement | null>,
  frozenRows: number,
  stickyHeader: boolean,
  /** Changes whenever the rendered rows may have changed (e.g. the items array). */
  rowsKey: unknown,
): void {
  // biome-ignore lint/correctness/useExhaustiveDependencies: rowsKey re-runs the measurement when the rendered rows (and so the frozen <tr> elements) change
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || frozenRows <= 0) return;
    const apply = () => {
      const thead = container.querySelector('thead');
      let top = stickyHeader && thead ? thead.getBoundingClientRect().height : 0;
      for (const tr of container.querySelectorAll<HTMLElement>(FROZEN_ROW_SELECTOR)) {
        tr.style.setProperty('--ogrid-frozen-top', `${top}px`);
        top += tr.getBoundingClientRect().height;
      }
    };
    apply();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(apply);
    const thead = container.querySelector('thead');
    if (thead) observer.observe(thead);
    for (const tr of container.querySelectorAll(FROZEN_ROW_SELECTOR)) observer.observe(tr);
    return () => observer.disconnect();
  }, [containerRef, frozenRows, stickyHeader, rowsKey]);
}
