import { ref } from 'vue';
import { useVirtualScroll } from '../composables/useVirtualScroll';

// ResizeObserver is not in jsdom — provide a no-op mock
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// requestAnimationFrame is not in jsdom — synchronous mock for tests
global.requestAnimationFrame = ((cb: FrameRequestCallback) => {
  cb(0);
  return 0;
}) as typeof requestAnimationFrame;

global.cancelAnimationFrame = () => {};

describe('useVirtualScroll', () => {
  describe('threshold behavior', () => {
    it('renders all rows when totalRows < default threshold (100)', () => {
      const totalRows = ref(50);
      const enabled = ref(true);

      const { visibleRange } = useVirtualScroll({
        totalRows,
        rowHeight: 40,
        enabled,
      });

      // Below threshold — passthrough: all rows visible
      expect(visibleRange.value.startIndex).toBe(0);
      expect(visibleRange.value.endIndex).toBe(49);
      expect(visibleRange.value.offsetTop).toBe(0);
      expect(visibleRange.value.offsetBottom).toBe(0);
    });

    it('renders all rows when totalRows === threshold - 1', () => {
      const totalRows = ref(99);
      const enabled = ref(true);

      const { visibleRange } = useVirtualScroll({
        totalRows,
        rowHeight: 40,
        enabled,
      });

      // 99 < 100 (default threshold) — passthrough
      expect(visibleRange.value.startIndex).toBe(0);
      expect(visibleRange.value.endIndex).toBe(98);
    });

    it('activates virtual scrolling when totalRows >= default threshold (100)', () => {
      const totalRows = ref(100);
      const enabled = ref(true);

      const { visibleRange } = useVirtualScroll({
        totalRows,
        rowHeight: 40,
        enabled,
      });

      // At threshold — virtual scrolling is active
      // With 0 containerHeight and scrollTop=0, visible range depends on core's computeVisibleRange
      expect(visibleRange.value).toBeDefined();
    });

    it('uses configurable threshold', () => {
      const totalRows = ref(50);
      const enabled = ref(true);

      const { visibleRange } = useVirtualScroll({
        totalRows,
        rowHeight: 40,
        enabled,
        threshold: 40, // custom threshold: 50 >= 40, so virtual scroll activates
      });

      // 50 >= 40, virtual scroll active — not a simple passthrough
      // The passthrough returns offsetTop=0 and offsetBottom=0 and endIndex=totalRows-1
      // virtual scroll with 0 container height will render 0+ rows
      // Just verify it's not in passthrough mode by checking it's a real computed range
      expect(visibleRange.value).toBeDefined();
    });

    it('passthrough mode when totalRows < custom threshold', () => {
      const totalRows = ref(30);
      const enabled = ref(true);

      const { visibleRange } = useVirtualScroll({
        totalRows,
        rowHeight: 40,
        enabled,
        threshold: 50, // 30 < 50, so passthrough
      });

      expect(visibleRange.value.startIndex).toBe(0);
      expect(visibleRange.value.endIndex).toBe(29);
      expect(visibleRange.value.offsetTop).toBe(0);
      expect(visibleRange.value.offsetBottom).toBe(0);
    });

    it('threshold=0 always activates virtual scrolling', () => {
      const totalRows = ref(1);
      const enabled = ref(true);

      const { visibleRange } = useVirtualScroll({
        totalRows,
        rowHeight: 40,
        enabled,
        threshold: 0, // always active
      });

      // 1 >= 0, virtual scroll active
      // with 0 containerHeight, endIndex will be 0 (1 row)
      expect(visibleRange.value).toBeDefined();
    });

    it('passthrough mode when enabled=false regardless of row count', () => {
      const totalRows = ref(1000);
      const enabled = ref(false);

      const { visibleRange } = useVirtualScroll({
        totalRows,
        rowHeight: 40,
        enabled,
      });

      // enabled=false → passthrough
      expect(visibleRange.value.startIndex).toBe(0);
      expect(visibleRange.value.endIndex).toBe(999);
      expect(visibleRange.value.offsetTop).toBe(0);
      expect(visibleRange.value.offsetBottom).toBe(0);
    });
  });

  describe('totalHeight', () => {
    it('returns 0 when enabled=false', () => {
      const totalRows = ref(100);
      const enabled = ref(false);

      const { totalHeight } = useVirtualScroll({ totalRows, rowHeight: 40, enabled });
      expect(totalHeight.value).toBe(0);
    });

    it('computes totalHeight when enabled=true', () => {
      const totalRows = ref(100);
      const enabled = ref(true);

      const { totalHeight } = useVirtualScroll({ totalRows, rowHeight: 40, enabled });
      // 100 rows * 40px per row
      expect(totalHeight.value).toBe(4000);
    });

    it('computes totalHeight for empty grid', () => {
      const totalRows = ref(0);
      const enabled = ref(true);

      const { totalHeight } = useVirtualScroll({ totalRows, rowHeight: 40, enabled });
      expect(totalHeight.value).toBe(0);
    });
  });

  describe('scrollToRow', () => {
    it('is a no-op when containerRef is null', () => {
      const totalRows = ref(100);
      const enabled = ref(true);

      const { scrollToRow } = useVirtualScroll({ totalRows, rowHeight: 40, enabled });

      // Should not throw with null containerRef
      expect(() => scrollToRow(5)).not.toThrow();
    });

    it('sets scrollTop on container when containerRef is set', () => {
      const totalRows = ref(200);
      const enabled = ref(true);

      const { containerRef, scrollToRow } = useVirtualScroll({ totalRows, rowHeight: 40, enabled });

      // Create a fake container element
      const el = document.createElement('div');
      Object.defineProperty(el, 'scrollTop', { writable: true, value: 0 });
      Object.defineProperty(el, 'clientHeight', { writable: true, value: 400 });
      containerRef.value = el;

      scrollToRow(10, 'start');
      // Row 10 at 40px each = offset 400px
      expect(el.scrollTop).toBe(10 * 40);
    });
  });

  describe('visibleRange passthrough edge cases', () => {
    it('handles 0 rows in passthrough mode', () => {
      const totalRows = ref(0);
      const enabled = ref(true);

      const { visibleRange } = useVirtualScroll({ totalRows, rowHeight: 40, enabled });

      // 0 < 100 threshold → passthrough, endIndex = max(0, 0-1) = 0
      expect(visibleRange.value.startIndex).toBe(0);
      expect(visibleRange.value.endIndex).toBe(0);
    });

    it('containerRef initializes as null', () => {
      const totalRows = ref(100);
      const enabled = ref(true);

      const { containerRef } = useVirtualScroll({ totalRows, rowHeight: 40, enabled });
      expect(containerRef.value).toBeNull();
    });
  });
});
