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
import { useRefElement } from './useRefElement';

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
  /** Space occupied by a sticky table header. Default: false. */
  stickyHeader?: boolean;
  /** Enable column virtualization (only render visible columns). */
  columnVirtualization?: boolean;
  /** Column widths for horizontal virtualization (unpinned columns only). */
  columnWidths?: number[];
  /** Column overscan count. Default: 2. */
  columnOverscan?: number;
  /**
   * Variable row heights: a row's fixed height in pixels (manual row height),
   * or undefined for the default `rowHeight`. Standard model only; the scaled
   * model keeps every row at `rowHeight`.
   */
  getRowHeightAt?: (index: number) => number | undefined;
  /**
   * Stable key of the row at an index (its row id), so measured and explicit
   * heights follow the row through sorting and filtering.
   */
  getRowKeyAt?: (index: number) => string | number;
  /**
   * Measure rendered rows' real heights (content-sized rows such as wrapped
   * text). Rows not measured yet use their estimate. Standard model only.
   */
  measureRows?: boolean;
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
  scrollToIndex: (index: number, align?: 'auto' | 'start' | 'center' | 'end') => void;
  /** Visible column range for horizontal virtualization (null when column virtualization disabled). */
  columnRange: IVisibleColumnRange | null;
  /** Callback to attach to scroll container's onScroll for horizontal tracking. */
  onHorizontalScroll?: (scrollLeft: number) => void;
  /** Height of the row at an index as the scroll geometry sees it (measured, explicit or `rowHeight`). */
  getRowSize: (index: number) => number;
  /**
   * Ref callback that measures a rendered row (stable identity). Set only while
   * `measureRows` is on and the standard model is active; the row element
   * must carry `data-index`.
   */
  measureRowRef?: (el: HTMLElement | null) => void;
}

/**
 * Default minimum row count before virtual scrolling activates.
 * Grids with fewer rows than this render all rows without virtualization
 * to avoid scroll offset artifacts on small datasets.
 */
const DEFAULT_PASSTHROUGH_THRESHOLD = 100;

/** Vertical scroll that also works where `Element.scrollTo` is missing (jsdom). */
function scrollContainerTo(container: HTMLElement, top: number): void {
  if (container.scrollTop === top) return;
  if (typeof container.scrollTo === 'function') container.scrollTo({ top, behavior: 'auto' });
  else container.scrollTop = top;
}

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
    stickyHeader = false,
    columnVirtualization = false,
    columnWidths,
    columnOverscan = 2,
    getRowHeightAt,
    getRowKeyAt,
    measureRows = false,
  } = params;

  // Dev-only validation: warn if enabled but rowHeight is missing or invalid
  useEffect(() => {
    validateVirtualScrollConfig({ enabled, rowHeight });
  }, [enabled, rowHeight]);

  const isActive = enabled && totalRows >= threshold;
  const containerElement = useRefElement(containerRef);

  // --- Container measurement ---
  // Height feeds the scaled-spacer window; width feeds column virtualization.
  // Both are tracked by one ResizeObserver while either feature is live.
  const [containerHeight, setContainerHeight] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);
  const viewportHeight = Math.max(0, containerHeight - headerHeight);
  // Browser scrollTop (compressed space). Only tracked while scaled.
  const [scrollTop, setScrollTop] = useState(0);

  // Scaled-spacer geometry. Whether scaling engages depends only on
  // totalRows * rowHeight vs the height cap, so it is known before the
  // container is ever measured (computeScaledGeometry ignores viewportHeight
  // for that decision).
  const geometry = useMemo(
    () => computeScaledGeometry({ totalRows, rowHeight, viewportHeight }),
    [totalRows, rowHeight, viewportHeight],
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
  // Explicit heights are read through a ref: their identity changes on every
  // row-resize drag frame, and estimateSize is read lazily by TanStack anyway.
  const getRowHeightAtRef = useRef(getRowHeightAt);
  getRowHeightAtRef.current = getRowHeightAt;
  const estimateSize = useCallback(
    (index: number) => getRowHeightAtRef.current?.(index) ?? rowHeight,
    [rowHeight],
  );
  const getItemKey = useCallback(
    (index: number) => (getRowKeyAt ? getRowKeyAt(index) : index),
    [getRowKeyAt],
  );
  const virtualizer = useVirtualizer({
    count: tanStackActive ? totalRows : 0,
    getScrollElement,
    estimateSize,
    getItemKey,
    overscan,
    enabled: tanStackActive,
    scrollMargin: headerHeight,
    scrollPaddingStart: headerHeight,
    // Rows without layout (zero height, e.g. detached or under jsdom) keep their estimate.
    measureElement: (el, entry, instance) => {
      const box = entry?.borderBoxSize?.[0];
      const height = box ? box.blockSize : el.getBoundingClientRect().height;
      return height > 0 ? Math.round(height) : instance.options.estimateSize(instance.indexFromElement(el));
    },
  });

  // TanStack memoizes row measurements and does not watch estimateSize, so a
  // rowHeight/density change would keep the old heights (wrong total size and
  // offsets) until something else invalidated them. Re-measure explicitly.
  // Explicit row heights changing (a row resize) re-measure too, unless rows
  // are measured live: then the resized row's observer reports its new height,
  // and clearing the cache would drop every off-screen row's measured height.
  const measuredRowHeightRef = useRef(rowHeight);
  useEffect(() => {
    if (measuredRowHeightRef.current === rowHeight) return;
    measuredRowHeightRef.current = rowHeight;
    virtualizer.measure?.();
  }, [rowHeight, virtualizer]);
  const explicitHeightsRef = useRef(getRowHeightAt);
  useEffect(() => {
    if (explicitHeightsRef.current === getRowHeightAt) return;
    explicitHeightsRef.current = getRowHeightAt;
    if (!measureRows) virtualizer.measure?.();
  }, [getRowHeightAt, measureRows, virtualizer]);

  // Track container size whenever row or column virtualization is live. The
  // observer fires only on real resizes, so this is cheap to keep mounted.
  useEffect(() => {
    if (!isActive && !columnVirtualization) return;
    const el = containerElement;
    if (!el) return;
    const header = stickyHeader ? el.querySelector('thead') : null;
    const measure = () => {
      setContainerHeight(el.clientHeight);
      setContainerWidth(el.clientWidth);
      setHeaderHeight(header?.getBoundingClientRect().height ?? 0);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      // `entries` can be nullish under non-spec-compliant ResizeObserver
      // implementations in some test runtimes — guard before reading it.
      const entry = entries?.[0];
      if (entry) {
        measure();
      }
    });
    ro.observe(el);
    if (header) ro.observe(header);
    return () => ro.disconnect();
  }, [isActive, columnVirtualization, containerElement, stickyHeader]);

  // Track scrollTop while scaled — it is the input to the scaled window. rAF
  // throttling keeps a fast scroll to one window recompute per frame.
  const scrollRaf = useRef(0);
  useEffect(() => {
    if (!isScaled) return;
    const el = containerElement;
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
  }, [isScaled, containerElement]);

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
      { totalRows, rowHeight, viewportHeight },
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
      if (first !== undefined && last !== undefined) {
        activeRange = {
          startIndex: first.index,
          endIndex: last.index,
          offsetTop: Math.max(0, first.start - headerHeight),
          offsetBottom: Math.max(0, totalSize - (last.end - headerHeight)),
        };
      } else {
        activeRange = { startIndex: 0, endIndex: -1, offsetTop: 0, offsetBottom: 0 };
      }
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
    (index: number, align: 'auto' | 'start' | 'center' | 'end' = tanStackActive ? 'auto' : 'start') => {
      const container = containerRef.current;
      if (!container || totalRows <= 0 || !Number.isFinite(index)) return;
      index = Math.max(0, Math.min(Math.floor(index), totalRows - 1));
      const stickyHeight = stickyHeader ? container.querySelector('thead')?.getBoundingClientRect().height ?? 0 : 0;
      const height = Math.max(0, container.clientHeight - stickyHeight);
      if (isScaled) {
        const config = { totalRows, rowHeight, viewportHeight: height };
        if (align === 'auto') {
          const current = computeScaledWindow(container.scrollTop, geometry, config).realScrollTop;
          if (index * rowHeight >= current && (index + 1) * rowHeight <= current + height) return;
          align = index * rowHeight < current ? 'start' : 'end';
        }
        const top = scrollTopForRowScaled(index, geometry, config, align);
        scrollContainerTo(container, top);
        setScrollTop(top);
      } else if (tanStackActive) {
        if (align === 'center' && stickyHeight > 0) {
          // measurementsCache starts include the header (scrollMargin).
          const item = scrollToIndexRef.current?.measurementsCache?.[index];
          const top = item ? item.start - stickyHeight : index * rowHeight;
          const size = item ? item.size : rowHeight;
          scrollToIndexRef.current?.scrollToOffset(Math.max(0, top - (height - size) / 2));
        } else {
          scrollToIndexRef.current?.scrollToIndex(index, { align });
        }
      } else {
        const row = container.querySelector(`[data-row-index="${index}"]`)?.closest('tr');
        const rect = row?.getBoundingClientRect();
        const rowTop = rect ? container.scrollTop + rect.top - container.getBoundingClientRect().top - stickyHeight : index * rowHeight;
        const actualHeight = rect?.height || rowHeight;
        if (align === 'auto') {
          if (rowTop >= container.scrollTop && rowTop + actualHeight <= container.scrollTop + height) return;
          align = height <= 0 || rowTop < container.scrollTop ? 'start' : 'end';
        }
        const adjustment = align === 'center' ? (height - actualHeight) / 2 : align === 'end' ? height - actualHeight : 0;
        scrollContainerTo(container, Math.max(0, rowTop - adjustment));
      }
    },
    [isScaled, tanStackActive, containerRef, rowHeight, totalRows, geometry, stickyHeader]
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

  const getRowSize = useCallback(
    (index: number) => (tanStackActive ? virtualizer.measurementsCache?.[index]?.size ?? rowHeight : rowHeight),
    [tanStackActive, virtualizer, rowHeight],
  );

  return {
    virtualizer: tanStackActive ? virtualizer : null,
    totalHeight,
    visibleRange: activeRange,
    scaled: isScaled,
    scrollToIndex,
    columnRange,
    onHorizontalScroll: columnVirtualization ? onHorizontalScroll : undefined,
    getRowSize,
    measureRowRef: tanStackActive && measureRows ? virtualizer.measureElement : undefined,
  };
}
