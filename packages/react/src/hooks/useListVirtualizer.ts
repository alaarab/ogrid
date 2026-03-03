/**
 * Lightweight list virtualizer for fixed-height items in a scrollable container.
 * Zero external dependencies  -  uses only React state and refs.
 */

import { useRef, useState, useCallback, useMemo } from 'react';

export interface UseListVirtualizerOptions {
  /** Total number of items in the list. */
  count: number;
  /** Height of each item in pixels (uniform). */
  itemHeight: number;
  /** Container height in pixels. Defaults to 250. */
  containerHeight?: number;
  /** Extra items to render above/below the visible window. Defaults to 5. */
  overscan?: number;
}

export interface VirtualItem {
  index: number;
  offsetTop: number;
}

export interface UseListVirtualizerResult {
  /** Total scrollable height (count * itemHeight). */
  totalHeight: number;
  /** Items currently visible (plus overscan buffer). */
  visibleItems: VirtualItem[];
  /** Ref to attach to the scrollable container div. */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Scroll handler to attach to the scrollable container div. */
  onScroll: () => void;
}

export function useListVirtualizer(opts: UseListVirtualizerOptions): UseListVirtualizerResult {
  const { count, itemHeight, containerHeight = 250, overscan = 5 } = opts;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const onScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop);
    }
  }, []);

  const totalHeight = count * itemHeight;

  const visibleItems = useMemo((): VirtualItem[] => {
    if (count === 0) return [];

    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const endIndex = Math.min(count - 1, startIndex + visibleCount + overscan * 2);

    const items: VirtualItem[] = [];
    for (let i = startIndex; i <= endIndex; i++) {
      items.push({ index: i, offsetTop: i * itemHeight });
    }
    return items;
  }, [count, itemHeight, containerHeight, overscan, scrollTop]);

  return { totalHeight, visibleItems, containerRef, onScroll };
}
