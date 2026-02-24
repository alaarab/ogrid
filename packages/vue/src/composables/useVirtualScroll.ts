import { ref, computed, watch, onMounted, onUnmounted, type Ref } from 'vue';
import {
  computeVisibleRange,
  computeTotalHeight,
  getScrollTopForRow,
  validateVirtualScrollConfig,
} from '@alaarab/ogrid-core';
import type { IVisibleRange } from '@alaarab/ogrid-core';

export interface UseVirtualScrollParams {
  totalRows: Ref<number>;
  rowHeight: number;
  enabled: Ref<boolean>;
  overscan?: number;
  /**
   * Minimum row count before virtual scrolling activates. Default: 100.
   * When totalRows < threshold, all rows render without virtualization.
   */
  threshold?: number;
}

export interface UseVirtualScrollResult {
  containerRef: Ref<HTMLElement | null>;
  visibleRange: Ref<IVisibleRange>;
  totalHeight: Ref<number>;
  scrollToRow: (index: number, align?: 'start' | 'center' | 'end') => void;
}

/**
 * Default minimum row count before virtual scrolling activates.
 * Grids with fewer rows than this render all rows without virtualization
 * to avoid scroll offset artifacts on small datasets.
 */
const DEFAULT_PASSTHROUGH_THRESHOLD = 100;

/**
 * Manages virtual scrolling with RAF-throttled scroll handling and ResizeObserver
 * for container height tracking. Uses core's computeVisibleRange for range calculation.
 */
export function useVirtualScroll(params: UseVirtualScrollParams): UseVirtualScrollResult {
  const { totalRows, rowHeight, enabled, overscan = 5, threshold = DEFAULT_PASSTHROUGH_THRESHOLD } = params;

  // Dev-only validation: warn if enabled but rowHeight is missing or invalid
  onMounted(() => {
    validateVirtualScrollConfig({ enabled: enabled.value, rowHeight });
  });

  const containerRef = ref<HTMLElement | null>(null);
  const scrollTop = ref(0);
  const containerHeight = ref(0);

  let rafId = 0;
  let resizeObserver: ResizeObserver | undefined;
  let prevObservedEl: HTMLElement | null = null;

  // Virtual scrolling is only active when enabled AND row count meets the threshold.
  // Below the threshold, render all rows to avoid scroll offset artifacts.
  const isActive = computed(() => enabled.value && totalRows.value >= threshold);

  const visibleRange = computed<IVisibleRange>(() => {
    if (!isActive.value) {
      return { startIndex: 0, endIndex: Math.max(0, totalRows.value - 1), offsetTop: 0, offsetBottom: 0 };
    }
    return computeVisibleRange(
      scrollTop.value,
      rowHeight,
      containerHeight.value,
      totalRows.value,
      overscan
    );
  });

  const totalHeight = computed(() => {
    if (!enabled.value) return 0;
    return computeTotalHeight(totalRows.value, rowHeight);
  });

  const onScroll = () => {
    if (!rafId) {
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        const el = containerRef.value;
        if (el) {
          scrollTop.value = el.scrollTop;
        }
      });
    }
  };

  const measure = () => {
    const el = containerRef.value;
    if (!el) return;
    containerHeight.value = el.clientHeight;
  };

  // Watch containerRef to attach/detach scroll listener and ResizeObserver.
  // Track prevObservedEl to avoid re-observing the same element and to
  // properly disconnect old observers before creating new ones.
  watch(containerRef, (el) => {
    if (el === prevObservedEl) return; // skip if same element

    // Teardown previous element
    if (prevObservedEl) {
      prevObservedEl.removeEventListener('scroll', onScroll);
    }
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = undefined;
    }

    prevObservedEl = el;

    // Setup new element
    if (el) {
      el.addEventListener('scroll', onScroll, { passive: true });
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(measure);
        resizeObserver.observe(el);
      }
      measure();
      scrollTop.value = el.scrollTop;
    }
  });

  onUnmounted(() => {
    const el = containerRef.value;
    if (el) {
      el.removeEventListener('scroll', onScroll);
    }
    resizeObserver?.disconnect();
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  });

  const scrollToRow = (index: number, align: 'start' | 'center' | 'end' = 'start') => {
    const el = containerRef.value;
    if (!el) return;
    el.scrollTop = getScrollTopForRow(index, rowHeight, containerHeight.value, align);
  };

  return { containerRef, visibleRange, totalHeight, scrollToRow };
}
