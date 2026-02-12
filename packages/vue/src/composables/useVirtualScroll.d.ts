import { type Ref } from 'vue';
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
export declare function useVirtualScroll(params: UseVirtualScrollParams): UseVirtualScrollResult;
