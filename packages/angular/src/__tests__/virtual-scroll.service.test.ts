import { VirtualScrollService } from '../services/virtual-scroll.service';

describe('VirtualScrollService', () => {
  let service: VirtualScrollService;

  beforeEach(() => {
    service = new VirtualScrollService();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Default configuration', () => {
    it('has default row height of 36', () => {
      expect(service.rowHeight()).toBe(36);
    });

    it('has default overscan of 5', () => {
      expect(service.overscan()).toBe(5);
    });

    it('is enabled by default', () => {
      expect(service.enabled()).toBe(true);
    });
  });

  describe('isActive', () => {
    it('is not active when totalRows is below threshold (100)', () => {
      service.totalRows.set(50);
      expect(service.isActive()).toBe(false);
    });

    it('is active when totalRows >= 100', () => {
      service.totalRows.set(100);
      expect(service.isActive()).toBe(true);
    });

    it('is not active when disabled via config', () => {
      service.totalRows.set(200);
      service.config.set({ rowHeight: 36, enabled: false });
      expect(service.isActive()).toBe(false);
    });
  });

  describe('visibleRange (passthrough mode)', () => {
    it('returns full range when not active', () => {
      service.totalRows.set(10);
      const range = service.visibleRange();
      expect(range.startIndex).toBe(0);
      expect(range.endIndex).toBe(9);
      expect(range.offsetTop).toBe(0);
      expect(range.offsetBottom).toBe(0);
    });

    it('handles zero rows gracefully', () => {
      service.totalRows.set(0);
      const range = service.visibleRange();
      expect(range.startIndex).toBe(0);
      expect(range.endIndex).toBe(0);
    });
  });

  describe('visibleRange (active mode)', () => {
    beforeEach(() => {
      service.totalRows.set(1000);
      service.containerHeight.set(500);
      service.config.set({ rowHeight: 36 });
    });

    it('computes a visible range at scrollTop=0', () => {
      service.scrollTop.set(0);
      const range = service.visibleRange();
      expect(range.startIndex).toBe(0);
      expect(range.endIndex).toBeGreaterThan(0);
      // Should render roughly containerHeight/rowHeight + overscan rows
      const expectedVisible = Math.ceil(500 / 36) + 5;
      expect(range.endIndex).toBeLessThanOrEqual(expectedVisible + 5);
    });

    it('computes a visible range at a midpoint scroll', () => {
      service.scrollTop.set(5000);
      const range = service.visibleRange();
      expect(range.startIndex).toBeGreaterThan(0);
      expect(range.endIndex).toBeGreaterThan(range.startIndex);
      expect(range.offsetTop).toBeGreaterThan(0);
    });

    it('has non-zero offsetBottom when not scrolled to end', () => {
      service.scrollTop.set(0);
      const range = service.visibleRange();
      expect(range.offsetBottom).toBeGreaterThan(0);
    });
  });

  describe('totalHeight', () => {
    it('computes total scrollable height', () => {
      service.totalRows.set(100);
      service.config.set({ rowHeight: 36 });
      expect(service.totalHeight()).toBe(3600);
    });

    it('is 0 for 0 rows', () => {
      service.totalRows.set(0);
      expect(service.totalHeight()).toBe(0);
    });
  });

  describe('onScroll', () => {
    it('updates scrollTop from scroll event', () => {
      const mockEvent = {
        target: { scrollTop: 500 },
      } as unknown as Event;
      service.onScroll(mockEvent);
      expect(service.scrollTop()).toBe(500);
    });
  });

  describe('updateConfig', () => {
    it('updates row height', () => {
      service.updateConfig({ rowHeight: 48 });
      expect(service.rowHeight()).toBe(48);
    });

    it('updates overscan', () => {
      service.updateConfig({ overscan: 10 });
      expect(service.overscan()).toBe(10);
    });

    it('preserves existing config when partially updating', () => {
      service.config.set({ rowHeight: 36, overscan: 3, enabled: true });
      service.updateConfig({ rowHeight: 48 });
      expect(service.rowHeight()).toBe(48);
      expect(service.overscan()).toBe(3);
      expect(service.enabled()).toBe(true);
    });
  });
});
