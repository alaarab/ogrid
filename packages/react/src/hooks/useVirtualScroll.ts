import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Virtualizer } from '@tanstack/react-virtual';
import type { RefObject } from 'react';
import {
  validateVirtualScrollConfig,
  computeVisibleColumnRange,
  computeScaledGeometry,
  computeScaledWindow,
  scrollTopForRowScaled,
} from '@alaarab/ogrid-core';
import type { IVisibleRange, IVisibleColumnRange } from '@alaarab/ogrid-core';

// Re-export core's IVirtualScrollConfig for convenience
export type { IVirtualScrollConfig } from '@alaarab/ogrid-core';

export interface UseVirtualScrollParams {
  /** Total number of rows in the data set. */
  totalRows: number;
  /** Row height in pixels. */
  rowHeight: number;
  /** Whether virtual scrolling is enabled. */
  enabled: boolean;
  /** Number of extra rows to render outside the visible area. Default: 5. */
  overscan?: number;
  /**
   * Minimum row count before virtual scrolling activates. Default: 100.
   * When totalRows < threshold, all rows render without virtualization.
   */
  threshold?: number;
  /** Ref to the scrollable container element. */
  containerRef: RefObject<HTMLElement | null>;
  /** Enable column virtualization (only render visible columns). */
  columnVirtualization?: boolean;
  /** Column widths for horizontal virtualization (unpinned columns only). */
  columnWidths?: number[];
  /** Column overscan count. Default: 2. */
  columnOverscan?: number;
}

export interface UseVirtualScrollResult {
  /** The TanStack virtualizer instance (null when disabled or in scaled mode). */
  virtualizer: Virtualizer<HTMLElement, Element> | null;
  /** Total height of all rows in pixels (the clamped spacer height when scaled). */
  totalHeight: number;
  /** The range of visible rows with spacer offsets. */
  visibleRange: IVisibleRange;
  /**
   * True when the dataset is large enough that the row spacer would exceed the
   * browser element-height cap, so the scaled-spacer model is in use. The
   * render path does not need to branch on this — `visibleRange` already
   * carries scaled offsets — but consumers may surface it for diagnostics.
   */
  scaled: boolean;
  /** Scroll to a specific row index. */
  scrollToIndex: (index: number) => void;
  /** Visible column range for horizontal virtualization (null when column virtualization disabled). */
  columnRange: IVisibleColumnRange | null;
  /** Callback to attach to scroll container's onScroll for horizontal tracking. */
  onHorizontalScroll?: (scrollLeft: number) => void;
}

/**
 * Default minimum row count before virtual scrolling activates.
 * Grids with fewer rows than this render all rows without virtualization
 * to avoid scroll offset artifacts on small datasets.
 */
const DEFAULT_PASSTHROUGH_THRESHOLD = 100;

/**
 * Wraps TanStack Virtual for row virtualization, with optional column virtualization.
 *
 * Two row-virtualization models, picked automatically:
 *  - **Standard** — TanStack Virtual drives a real-pixel spacer. Used whenever
 *    `totalRows * rowHeight` fits under the browser element-height cap (~33.5M
 *    px, ~931k rows at rowHeight 36).
 *  - **Scaled** — past that cap a real-pixel spacer is impossible, so the spacer
 *    is clamped and the browser scrollTop is remapped through a scale factor
 *    (the AG-Grid DOM-virtualisation technique). TanStack is disabled and the
 *    visible window is computed from `scrollTop` with `computeScaledWindow`.
 *
 * When disabled or when totalRows < threshold, returns a pass-through (all rows visible).
 * @param params - Total rows, row height, enabled flag, overscan, threshold, container ref, and column virtualization params.
 * @returns Virtualizer instance, total height, visible range, scaled flag, scrollToIndex, columnRange, and onHorizontalScroll.
 */
export function useVirtualScroll(params: UseVirtualScrollParams): UseVirtualScrollResult {
  const {
    totalRows,
    rowHeight,
    enabled,
    overscan = 5,
    threshold = DEFAULT_PASSTHROUGH_THRESHOLD,
    containerRef,
    columnVirtualization = false,
    columnWidths,
    columnOverscan = 2,
  } = params;

  // Dev-only validation: warn if enabled but rowHeight is missing or invalid
  useEffect(() => {
    validateVirtualScrollConfig({ enabled, rowHeight });
  }, [enabled, rowHeight]);

  const isActive = enabled && totalRows >= threshold;

  // --- Container measurement ---
  // Height feeds the scaled-spacer window; width feeds column virtualization.
  // Both are tracked by one ResizeObserver while either feature is live.
  const [containerHeight, setContainerHeight] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  // Browser scrollTop (compressed space). Only tracked while scaled.
  const [scrollTop, setScrollTop] = useState(0);

  // Scaled-spacer geometry. Whether scaling engages depends only on
  // totalRows * rowHeight vs the height cap, so it is known before the
  // container is ever measured (computeScaledGeometry ignores viewportHeight
  // for that decision).
  const geometry = useMemo(
    () => computeScaledGeometry({ totalRows, rowHeight, viewportHeight: containerHeight }),
    [totalRows, rowHeight, containerHeight],
  );
  const isScaled = isActive && geometry.scaled;

  const getScrollElement = useCallback(
    () => containerRef.current,
    [containerRef]
  );

  // TanStack drives the standard path. It is disabled while scaled because the
  // dataset needs a spacer past the DOM height cap, which TanStack cannot
  // express — the scaled branch below takes over.
  const tanStackActive = isActive && !isScaled;
  const virtualizer = useVirtualizer({
    count: tanStackActive ? totalRows : 0,
    getScrollElement,
    estimateSize: () => rowHeight,
    overscan,
    enabled: tanStackActive,
  });

  // Track container size whenever row or column virtualization is live. The
  // observer fires only on real resizes, so this is cheap to keep mounted.
  useEffect(() => {
    if (!isActive && !columnVirtualization) return;
    const el = containerRef.current;
    if (!el) return;
    setContainerHeight(el.clientHeight);
    setContainerWidth(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      if (entries.length > 0) {
        setContainerHeight(entries[0].contentRect.height);
        setContainerWidth(entries[0].contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isActive, columnVirtualization, containerRef]);

  // Track scrollTop while scaled — it is the input to the scaled window. rAF
  // throttling keeps a fast scroll to one window recompute per frame.
  const scrollRaf = useRef(0);
  useEffect(() => {
    if (!isScaled) return;
    const el = containerRef.current;
    if (!el) return;
    setScrollTop(el.scrollTop);
    const onScroll = () => {
      if (scrollRaf.current) return;
      scrollRaf.current = requestAnimationFrame(() => {
        scrollRaf.current = 0;
        setScrollTop(el.scrollTop);
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (scrollRaf.current) {
        cancelAnimationFrame(scrollRaf.current);
        scrollRaf.current = 0;
      }
    };
  }, [isScaled, containerRef]);

  const passthroughRange = useMemo<IVisibleRange>(
    () => ({
      startIndex: 0,
      endIndex: Math.max(0, totalRows - 1),
      offsetTop: 0,
      offsetBottom: 0,
    }),
    [totalRows]
  );

  // The visible range is recomputed every render rather than memoized.
  //
  // The TanStack virtualizer instance has a STABLE identity for the hook's
  // lifetime, so a `useMemo` keyed on `virtualizer` would compute the range
  // exactly once and then freeze it. The virtualizer notifies React to
  // re-render whenever the scroll element is measured, scrolled, or resized;
  // on those re-renders the memo deps are unchanged, so the grid would keep
  // rendering the stale (often empty) first range — the cause of a virtualized
  // grid showing zero body rows. `getVirtualItems()` / `getTotalSize()` are
  // already memoized inside virtual-core, so calling them each render is cheap.
  let activeRange: IVisibleRange;
  if (!isActive) {
    activeRange = passthroughRange;
  } else if (isScaled) {
    // Scaled path: derive the window from scrollTop, then express it as the
    // same { offsetTop, rows, offsetBottom } spacer model the render layer
    // already uses. offsetTop is capped so the two spacers plus the rendered
    // block always sum to exactly the clamped spacer height — keeping the
    // scrollbar geometry stable as the window moves.
    const win = computeScaledWindow(
      scrollTop,
      geometry,
      { totalRows, rowHeight, viewportHeight: containerHeight },
      overscan,
    );
    const blockCount = win.endIndex >= win.startIndex ? win.endIndex - win.startIndex + 1 : 0;
    const blockHeight = blockCount * rowHeight;
    const maxOffsetTop = Math.max(0, geometry.spacerHeight - blockHeight);
    const offsetTop = Math.min(win.offsetPx, maxOffsetTop);
    const offsetBottom = Math.max(0, geometry.spacerHeight - offsetTop - blockHeight);
    activeRange = {
      startIndex: win.startIndex,
      endIndex: win.endIndex,
      offsetTop,
      offsetBottom,
    };
  } else {
    const virtualItems = virtualizer.getVirtualItems();
    if (virtualItems.length === 0) {
      activeRange = { startIndex: 0, endIndex: -1, offsetTop: 0, offsetBottom: 0 };
    } else {
      const first = virtualItems[0];
      const last = virtualItems[virtualItems.length - 1];
      const totalSize = virtualizer.getTotalSize();
      activeRange = {
        startIndex: first.index,
        endIndex: last.index,
        offsetTop: first.start,
        offsetBottom: Math.max(0, totalSize - last.end),
      };
    }
  }

  const totalHeight = isScaled
    ? geometry.spacerHeight
    : isActive
      ? virtualizer.getTotalSize()
      : totalRows * rowHeight;

  const scrollToIndexRef = useRef(virtualizer);
  scrollToIndexRef.current = virtualizer;

  const scrollToIndex = useCallback(
    (index: number) => {
      const container = containerRef.current;
      if (isScaled) {
        // Remap the target row to a compressed scrollTop.
        if (container) {
          container.scrollTo({
            top: scrollTopForRowScaled(index, geometry, {
              totalRows,
              rowHeight,
              viewportHeight: container.clientHeight,
            }),
            behavior: 'auto',
          });
        }
      } else if (tanStackActive) {
        scrollToIndexRef.current?.scrollToIndex(index, { align: 'auto' });
      } else if (container) {
        // When not virtualized, scroll the container directly.
        container.scrollTo({ top: index * rowHeight, behavior: 'auto' });
      }
    },
    [isScaled, tanStackActive, containerRef, rowHeight, totalRows, geometry]
  );

  // --- Column virtualization ---
  const [scrollLeft, setScrollLeft] = useState(0);
  const scrollLeftRaf = useRef(0);

  const onHorizontalScroll = useCallback(
    (sl: number) => {
      if (scrollLeftRaf.current) cancelAnimationFrame(scrollLeftRaf.current);
      scrollLeftRaf.current = requestAnimationFrame(() => {
        scrollLeftRaf.current = 0;
        setScrollLeft(sl);
      });
    },
    []
  );

  // Clean up RAF on unmount
  useEffect(() => {
    return () => {
      if (scrollLeftRaf.current) cancelAnimationFrame(scrollLeftRaf.current);
    };
  }, []);

  const columnRange = useMemo<IVisibleColumnRange | null>(() => {
    if (!columnVirtualization || !columnWidths || columnWidths.length === 0 || containerWidth <= 0) {
      return null;
    }
    return computeVisibleColumnRange(scrollLeft, columnWidths, containerWidth, columnOverscan);
  }, [columnVirtualization, columnWidths, containerWidth, scrollLeft, columnOverscan]);

  return {
    virtualizer: tanStackActive ? virtualizer : null,
    totalHeight,
    visibleRange: activeRange,
    scaled: isScaled,
    scrollToIndex,
    columnRange,
    onHorizontalScroll: columnVirtualization ? onHorizontalScroll : undefined,
  };
}
