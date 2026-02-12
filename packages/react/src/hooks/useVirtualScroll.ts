import { useMemo, useCallback, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Virtualizer } from '@tanstack/react-virtual';
import type { RefObject } from 'react';
import type { IVirtualScrollConfig, IVisibleRange } from '@alaarab/ogrid-core';

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
  /** Ref to the scrollable container element. */
  containerRef: RefObject<HTMLElement | null>;
}

export interface UseVirtualScrollResult {
  /** The TanStack virtualizer instance (null when disabled). */
  virtualizer: Virtualizer<HTMLElement, Element> | null;
  /** Total height of all rows in pixels. */
  totalHeight: number;
  /** The range of visible rows with spacer offsets. */
  visibleRange: IVisibleRange;
  /** Scroll to a specific row index. */
  scrollToIndex: (index: number) => void;
}

/** Threshold below which virtual scrolling is a no-op (all rows rendered). */
const PASSTHROUGH_THRESHOLD = 100;

/**
 * Wraps TanStack Virtual for row virtualization.
 * When disabled or when totalRows < threshold, returns a pass-through (all rows visible).
 * @param params - Total rows, row height, enabled flag, overscan, and container ref.
 * @returns Virtualizer instance, total height, visible range, and scrollToIndex helper.
 */
export function useVirtualScroll(params: UseVirtualScrollParams): UseVirtualScrollResult {
  const {
    totalRows,
    rowHeight,
    enabled,
    overscan = 5,
    containerRef,
  } = params;

  const isActive = enabled && totalRows >= PASSTHROUGH_THRESHOLD;

  const getScrollElement = useCallback(
    () => containerRef.current,
    [containerRef]
  );

  const virtualizer = useVirtualizer({
    count: isActive ? totalRows : 0,
    getScrollElement,
    estimateSize: () => rowHeight,
    overscan,
    enabled: isActive,
  });

  const passthroughRange = useMemo<IVisibleRange>(
    () => ({
      startIndex: 0,
      endIndex: Math.max(0, totalRows - 1),
      offsetTop: 0,
      offsetBottom: 0,
    }),
    [totalRows]
  );

  const activeRange = useMemo<IVisibleRange>(() => {
    if (!isActive) return passthroughRange;

    const virtualItems = virtualizer.getVirtualItems();
    if (virtualItems.length === 0) {
      return { startIndex: 0, endIndex: -1, offsetTop: 0, offsetBottom: 0 };
    }

    const first = virtualItems[0];
    const last = virtualItems[virtualItems.length - 1];
    const totalSize = virtualizer.getTotalSize();

    return {
      startIndex: first.index,
      endIndex: last.index,
      offsetTop: first.start,
      offsetBottom: Math.max(0, totalSize - last.end),
    };
  }, [isActive, virtualizer, passthroughRange]);

  const totalHeight = isActive
    ? virtualizer.getTotalSize()
    : totalRows * rowHeight;

  const scrollToIndexRef = useRef(virtualizer);
  scrollToIndexRef.current = virtualizer;

  const scrollToIndex = useCallback(
    (index: number) => {
      if (isActive) {
        scrollToIndexRef.current?.scrollToIndex(index, { align: 'auto' });
      } else {
        // When not virtualized, scroll the container directly
        const container = containerRef.current;
        if (container) {
          const top = index * rowHeight;
          container.scrollTo({ top, behavior: 'auto' });
        }
      }
    },
    [isActive, containerRef, rowHeight]
  );

  return {
    virtualizer: isActive ? virtualizer : null,
    totalHeight,
    visibleRange: activeRange,
    scrollToIndex,
  };
}
