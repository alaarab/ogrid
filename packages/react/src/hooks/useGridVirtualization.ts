/**
 * useGridVirtualization — headless row + column virtualization for OGrid.
 *
 * Pairs with `useHeadlessGrid` to render only the rows/columns currently in
 * view. Zero external dependencies — uses core's pure compute helpers and
 * tracks scroll/resize via plain DOM events. The consumer owns the scroll
 * container; the hook just reports which slice to render and the spacer
 * offsets that preserve scroll geometry.
 *
 * Example:
 *
 *   const grid = useHeadlessGrid({ columns, data, getRowId });
 *   const containerRef = useRef<HTMLDivElement>(null);
 *   const virt = useGridVirtualization({
 *     rowCount: grid.totalCount,
 *     rowHeight: 36,
 *     containerRef,
 *   });
 *
 *   return (
 *     <div ref={containerRef} onScroll={virt.onScroll} style={{ height: 400, overflow: 'auto' }}>
 *       <div style={{ height: virt.totalHeight, position: 'relative' }}>
 *         <div style={{ transform: `translateY(${virt.rowRange.offsetTop}px)` }}>
 *           {grid.rows.slice(virt.rowRange.startIndex, virt.rowRange.endIndex + 1).map(...)}
 *         </div>
 *       </div>
 *     </div>
 *   );
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import {
  computeVisibleRange,
  computeVisibleColumnRange,
  computeTotalHeight,
  getScrollTopForRow,
} from '@alaarab/ogrid-core';
import type { IVisibleRange, IVisibleColumnRange } from '@alaarab/ogrid-core';

export interface UseGridVirtualizationParams {
  /** Total number of rows in the data set. */
  rowCount: number;
  /** Uniform row height in pixels. */
  rowHeight: number;
  /** Ref to the scrollable container element. Must have `overflow: auto` and a fixed height. */
  containerRef: RefObject<HTMLElement | null>;
  /** Extra rows rendered above/below the visible window. Default: 5. */
  overscan?: number;
  /** Disable virtualization (returns pass-through range). Default: true. */
  enabled?: boolean;
  /**
   * Below this row count, virtualization is bypassed and every row renders.
   * Avoids scroll-offset artifacts on small datasets. Default: 100.
   */
  threshold?: number;
  /** Column widths (unpinned only) for horizontal virtualization. Omit to disable column virt. */
  columnWidths?: number[];
  /** Column overscan count. Default: 2. */
  columnOverscan?: number;
}

export interface UseGridVirtualizationResult {
  /** Total scrollable height in pixels (rowCount × rowHeight). */
  totalHeight: number;
  /** Visible row range with spacer offsets. */
  rowRange: IVisibleRange;
  /** Visible column range — null when `columnWidths` not provided. */
  columnRange: IVisibleColumnRange | null;
  /** Scroll the container to bring a row into view. */
  scrollToIndex: (index: number, align?: 'start' | 'center' | 'end') => void;
  /** Attach to the scroll container's `onScroll` handler. */
  onScroll: () => void;
  /** True when virtualization is active (enabled and rowCount ≥ threshold). */
  isActive: boolean;
}

const DEFAULT_THRESHOLD = 100;
const DEFAULT_OVERSCAN = 5;
const DEFAULT_COLUMN_OVERSCAN = 2;

export function useGridVirtualization(
  params: UseGridVirtualizationParams,
): UseGridVirtualizationResult {
  const {
    rowCount,
    rowHeight,
    containerRef,
    overscan = DEFAULT_OVERSCAN,
    enabled = true,
    threshold = DEFAULT_THRESHOLD,
    columnWidths,
    columnOverscan = DEFAULT_COLUMN_OVERSCAN,
  } = params;

  const isActive = enabled && rowCount >= threshold && rowHeight > 0;

  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  // RAF-coalesce scroll updates so a fast wheel doesn't thrash setState.
  const scrollRaf = useRef<number | null>(null);

  const onScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (scrollRaf.current != null) cancelAnimationFrame(scrollRaf.current);
    scrollRaf.current = requestAnimationFrame(() => {
      scrollRaf.current = null;
      setScrollTop(el.scrollTop);
      if (columnWidths) setScrollLeft(el.scrollLeft);
    });
  }, [containerRef, columnWidths]);

  useEffect(() => {
    return () => {
      if (scrollRaf.current != null) cancelAnimationFrame(scrollRaf.current);
    };
  }, []);

  // Track container dimensions via ResizeObserver. Falls back to clientHeight/Width on mount.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerHeight(el.clientHeight);
    setContainerWidth(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      // `entries` can be nullish under non-spec-compliant ResizeObserver
      // implementations in some test runtimes — guard before indexing it.
      const entry = entries?.[0];
      if (!entry) return;
      setContainerHeight(entry.contentRect.height);
      setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef]);

  const totalHeight = computeTotalHeight(rowCount, rowHeight);

  const rowRange = useMemo<IVisibleRange>(() => {
    if (!isActive) {
      return {
        startIndex: 0,
        endIndex: Math.max(0, rowCount - 1),
        offsetTop: 0,
        offsetBottom: 0,
      };
    }
    return computeVisibleRange(scrollTop, rowHeight, containerHeight, rowCount, overscan);
  }, [isActive, scrollTop, rowHeight, containerHeight, rowCount, overscan]);

  const columnRange = useMemo<IVisibleColumnRange | null>(() => {
    if (!columnWidths || columnWidths.length === 0 || containerWidth <= 0) {
      return null;
    }
    return computeVisibleColumnRange(scrollLeft, columnWidths, containerWidth, columnOverscan);
  }, [columnWidths, scrollLeft, containerWidth, columnOverscan]);

  const scrollToIndex = useCallback(
    (index: number, align: 'start' | 'center' | 'end' = 'start') => {
      const el = containerRef.current;
      if (!el) return;
      const top = getScrollTopForRow(index, rowHeight, el.clientHeight, align);
      el.scrollTo({ top, behavior: 'auto' });
    },
    [containerRef, rowHeight],
  );

  return {
    totalHeight,
    rowRange,
    columnRange,
    scrollToIndex,
    onScroll,
    isActive,
  };
}
