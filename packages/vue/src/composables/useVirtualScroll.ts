import { ref, computed, watch, onMounted, onUnmounted, type Ref } from 'vue';
import {
  computeVisibleRange,
  computeTotalHeight,
  getScrollTopForRow,
} from '@alaarab/ogrid-core';
import type { IVisibleRange } from '@alaarab/ogrid-core';

export interface UseVirtualScrollParams {
  totalRows: Ref<number>;
  rowHeight: number;
  enabled: Ref<boolean>;
  overscan?: number;
}

export interface UseVirtualScrollResult {
  containerRef: Ref<HTMLElement | null>;
  visibleRange: Ref<IVisibleRange>;
  totalHeight: Ref<number>;
  scrollToRow: (index: number, align?: 'start' | 'center' | 'end') => void;
}

/**
 * Manages virtual scrolling with RAF-throttled scroll handling and ResizeObserver
 * for container height tracking. Uses core's computeVisibleRange for range calculation.
 */
export function useVirtualScroll(params: UseVirtualScrollParams): UseVirtualScrollResult {
  const { totalRows, rowHeight, enabled, overscan = 5 } = params;

  const containerRef = ref<HTMLElement | null>(null);
  const scrollTop = ref(0);
  const containerHeight = ref(0);

  let rafId = 0;
  let resizeObserver: ResizeObserver | undefined;

  const visibleRange = computed<IVisibleRange>(() => {
    if (!enabled.value) {
      return { startIndex: 0, endIndex: totalRows.value - 1, offsetTop: 0, offsetBottom: 0 };
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

  // Watch containerRef to attach/detach scroll listener and ResizeObserver
  watch(containerRef, (el, prevEl) => {
    if (prevEl) {
      prevEl.removeEventListener('scroll', onScroll);
      resizeObserver?.disconnect();
    }
    if (el) {
      el.addEventListener('scroll', onScroll, { passive: true });
      resizeObserver = new ResizeObserver(measure);
      resizeObserver.observe(el);
      measure();
      scrollTop.value = el.scrollTop;
    }
  });

  onMounted(() => {
    const el = containerRef.value;
    if (el) {
      el.addEventListener('scroll', onScroll, { passive: true });
      resizeObserver = new ResizeObserver(measure);
      resizeObserver.observe(el);
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
