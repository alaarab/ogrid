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

    it('uses default threshold of 100', () => {
      expect(service.threshold()).toBe(100);
    });

    it('respects custom threshold: active when totalRows >= custom threshold', () => {
      service.totalRows.set(50);
      service.config.set({ rowHeight: 36, threshold: 20 });
      expect(service.isActive()).toBe(true);
    });

    it('respects custom threshold: not active when totalRows < custom threshold', () => {
      service.totalRows.set(50);
      service.config.set({ rowHeight: 36, threshold: 200 });
      expect(service.isActive()).toBe(false);
    });

    it('activates exactly at custom threshold boundary', () => {
      service.config.set({ rowHeight: 36, threshold: 50 });
      service.totalRows.set(49);
      expect(service.isActive()).toBe(false);
      service.totalRows.set(50);
      expect(service.isActive()).toBe(true);
    });

    it('threshold=1 makes virtual scroll active for any non-empty grid', () => {
      service.config.set({ rowHeight: 36, threshold: 1 });
      service.totalRows.set(1);
      expect(service.isActive()).toBe(true);
    });

    it('threshold=0 means virtual scroll always active (even for 0 rows)', () => {
      service.config.set({ rowHeight: 36, threshold: 0 });
      service.totalRows.set(0);
      expect(service.isActive()).toBe(true);
    });
  });

  describe('threshold configuration', () => {
    it('updateConfig can change threshold', () => {
      service.updateConfig({ threshold: 50 });
      expect(service.threshold()).toBe(50);
    });

    it('custom threshold is preserved when updating other fields', () => {
      service.config.set({ rowHeight: 36, threshold: 25 });
      service.updateConfig({ rowHeight: 48 });
      expect(service.threshold()).toBe(25);
    });

    it('threshold affects whether passthrough range is returned', () => {
      // Low threshold: 10 rows makes virtual scroll active
      service.config.set({ rowHeight: 36, threshold: 10, overscan: 0 });
      service.totalRows.set(10);
      service.containerHeight.set(200);
      service.scrollTop.set(0);
      const activeRange = service.visibleRange();
      // Active mode should not return a full range (offsetBottom > 0)
      expect(service.isActive()).toBe(true);

      // High threshold: 10 rows stays in passthrough
      service.config.set({ rowHeight: 36, threshold: 1000 });
      service.totalRows.set(10);
      const passthroughRange = service.visibleRange();
      expect(passthroughRange.startIndex).toBe(0);
      expect(passthroughRange.endIndex).toBe(9);
      expect(passthroughRange.offsetTop).toBe(0);
      expect(passthroughRange.offsetBottom).toBe(0);
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

  describe('Column virtualization', () => {
    it('columnsEnabled is false by default', () => {
      expect(service.columnsEnabled()).toBe(false);
    });

    it('columnsEnabled is true when config.columns is true', () => {
      service.updateConfig({ columns: true });
      expect(service.columnsEnabled()).toBe(true);
    });

    it('columnRange is null when columnsEnabled is false', () => {
      service.columnWidths.set([100, 100, 100]);
      service.containerWidth.set(200);
      expect(service.columnRange()).toBeNull();
    });

    it('columnRange computes a range when columnsEnabled is true', () => {
      service.updateConfig({ columns: true, columnOverscan: 1 });
      service.columnWidths.set([100, 100, 100, 100, 100]);
      service.containerWidth.set(250);
      service.scrollLeft.set(0);
      const range = service.columnRange();
      expect(range).not.toBeNull();
      expect(range!.startIndex).toBe(0);
      expect(range!.endIndex).toBeGreaterThanOrEqual(2);
    });

    it('columnRange shifts when scrollLeft changes', () => {
      service.updateConfig({ columns: true, columnOverscan: 0 });
      service.columnWidths.set([100, 100, 100, 100, 100]);
      service.containerWidth.set(200);
      service.scrollLeft.set(0);
      const range1 = service.columnRange();
      expect(range1!.startIndex).toBe(0);

      service.scrollLeft.set(250);
      const range2 = service.columnRange();
      expect(range2!.startIndex).toBeGreaterThan(0);
    });

    it('columnRange is null when columnWidths is empty', () => {
      service.updateConfig({ columns: true });
      service.columnWidths.set([]);
      expect(service.columnRange()).toBeNull();
    });

    it('columnOverscan defaults to 2', () => {
      expect(service.columnOverscan()).toBe(2);
    });

    it('columnOverscan can be configured', () => {
      service.updateConfig({ columnOverscan: 5 });
      expect(service.columnOverscan()).toBe(5);
    });

    it('onScroll updates scrollLeft', () => {
      const mockEvent = {
        target: { scrollTop: 100, scrollLeft: 200 },
      } as unknown as Event;
      service.onScroll(mockEvent);
      expect(service.scrollLeft()).toBe(200);
    });
  });
});
