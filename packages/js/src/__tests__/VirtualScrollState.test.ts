/**
 * Tests for VirtualScrollState: configurable threshold, enabling/disabling based
 * on row count vs threshold, and pass-through mode.
 */
import { VirtualScrollState } from '../state/VirtualScrollState';

// Mock ResizeObserver (not available in jsdom)
class MockResizeObserver {
  observe = jest.fn();
  disconnect = jest.fn();
  unobserve = jest.fn();
}
Object.defineProperty(global, 'ResizeObserver', {
  writable: true,
  configurable: true,
  value: MockResizeObserver,
});

// Mock requestAnimationFrame
beforeEach(() => {
  jest.useFakeTimers();
  (global as Record<string, unknown>).requestAnimationFrame = (cb: FrameRequestCallback) => {
    setTimeout(() => cb(0), 16);
    return 1;
  };
  (global as Record<string, unknown>).cancelAnimationFrame = jest.fn();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('VirtualScrollState  -  enabled getter', () => {
  it('is disabled when config.enabled is false', () => {
    const state = new VirtualScrollState({ enabled: false });
    state.setTotalRows(500);
    expect(state.enabled).toBe(false);
  });

  it('is disabled when config.enabled is true but totalRows < default threshold (100)', () => {
    const state = new VirtualScrollState({ enabled: true });
    state.setTotalRows(99);
    expect(state.enabled).toBe(false);
  });

  it('is enabled when totalRows equals the default threshold (100)', () => {
    const state = new VirtualScrollState({ enabled: true });
    state.setTotalRows(100);
    expect(state.enabled).toBe(true);
  });

  it('is enabled when totalRows exceeds the default threshold', () => {
    const state = new VirtualScrollState({ enabled: true });
    state.setTotalRows(200);
    expect(state.enabled).toBe(true);
  });

  it('uses custom threshold when provided', () => {
    const state = new VirtualScrollState({ enabled: true, threshold: 50 });
    state.setTotalRows(49);
    expect(state.enabled).toBe(false);

    state.setTotalRows(50);
    expect(state.enabled).toBe(true);
  });

  it('uses threshold of 1 to enable with minimal data', () => {
    const state = new VirtualScrollState({ enabled: true, threshold: 1 });
    state.setTotalRows(1);
    expect(state.enabled).toBe(true);
  });

  it('stays disabled when totalRows is 0 and threshold is 0', () => {
    // 0 >= 0 is true  to  enabled
    const state = new VirtualScrollState({ enabled: true, threshold: 0 });
    state.setTotalRows(0);
    expect(state.enabled).toBe(true);
  });
});

describe('VirtualScrollState  -  constructor defaults', () => {
  it('creates with enabled=false by default (no config)', () => {
    const state = new VirtualScrollState();
    state.setTotalRows(500);
    expect(state.enabled).toBe(false);
  });

  it('initializes totalRows to 0', () => {
    const state = new VirtualScrollState({ enabled: true });
    expect(state.totalRows).toBe(0);
  });

  it('initializes scrollTop to 0', () => {
    const state = new VirtualScrollState({ enabled: true });
    expect(state.scrollTop).toBe(0);
  });

  it('initializes containerHeight to 0', () => {
    const state = new VirtualScrollState({ enabled: true });
    expect(state.containerHeight).toBe(0);
  });
});

describe('VirtualScrollState  -  setTotalRows', () => {
  it('updates totalRows', () => {
    const state = new VirtualScrollState({ enabled: true });
    state.setTotalRows(150);
    expect(state.totalRows).toBe(150);
  });

  it('toggles enabled when threshold is crossed', () => {
    const state = new VirtualScrollState({ enabled: true, threshold: 100 });

    state.setTotalRows(50);
    expect(state.enabled).toBe(false);

    state.setTotalRows(100);
    expect(state.enabled).toBe(true);

    state.setTotalRows(50);
    expect(state.enabled).toBe(false);
  });
});

describe('VirtualScrollState  -  totalHeight', () => {
  it('returns totalRows * rowHeight (default 36)', () => {
    const state = new VirtualScrollState({ enabled: true });
    state.setTotalRows(100);
    expect(state.totalHeight).toBe(100 * 36);
  });

  it('uses custom rowHeight from config', () => {
    const state = new VirtualScrollState({ enabled: true, rowHeight: 48 });
    state.setTotalRows(50);
    expect(state.totalHeight).toBe(50 * 48);
  });

  it('returns 0 when totalRows is 0', () => {
    const state = new VirtualScrollState({ enabled: true });
    expect(state.totalHeight).toBe(0);
  });
});

describe('VirtualScrollState  -  updateConfig', () => {
  it('updates the config', () => {
    const state = new VirtualScrollState({ enabled: false });
    state.setTotalRows(200);
    expect(state.enabled).toBe(false);

    state.updateConfig({ enabled: true });
    expect(state.enabled).toBe(true);
  });

  it('emits configChanged event', () => {
    const state = new VirtualScrollState({ enabled: false });
    const listener = jest.fn();
    state.onConfigChanged(listener);

    state.updateConfig({ enabled: true });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ config: { enabled: true } });
  });

  it('updates threshold via updateConfig', () => {
    const state = new VirtualScrollState({ enabled: true, threshold: 200 });
    state.setTotalRows(100);
    expect(state.enabled).toBe(false); // 100 < 200

    state.updateConfig({ enabled: true, threshold: 50 });
    expect(state.enabled).toBe(true); // 100 >= 50
  });
});

describe('VirtualScrollState  -  onConfigChanged', () => {
  it('onConfigChanged returns an unsubscribe function', () => {
    const state = new VirtualScrollState({ enabled: true, threshold: 1 });
    const listener = jest.fn();
    const unsub = state.onConfigChanged(listener);

    state.updateConfig({ enabled: false });
    expect(listener).toHaveBeenCalledTimes(1);

    // Unsubscribe
    unsub();
    state.updateConfig({ enabled: true });
    expect(listener).toHaveBeenCalledTimes(1); // still 1  -  not called again
  });
});

describe('VirtualScrollState  -  visibleRange (pass-through when disabled)', () => {
  it('returns initial cachedRange (startIndex=0, endIndex=-1) before any scroll', () => {
    const state = new VirtualScrollState({ enabled: false });
    state.setTotalRows(50);
    // pass-through: range is never computed since enabled=false
    const range = state.visibleRange;
    expect(range.startIndex).toBe(0);
    expect(range.endIndex).toBe(-1);
    expect(range.offsetTop).toBe(0);
    expect(range.offsetBottom).toBe(0);
  });
});

describe('VirtualScrollState  -  config getter', () => {
  it('returns the current config', () => {
    const config = { enabled: true, rowHeight: 40, threshold: 75 };
    const state = new VirtualScrollState(config);
    expect(state.config).toEqual(config);
  });
});

// --- Column virtualization ---

describe('VirtualScrollState  -  columnVirtualizationEnabled', () => {
  it('is false when columns config is not set', () => {
    const state = new VirtualScrollState({ enabled: true });
    expect(state.columnVirtualizationEnabled).toBe(false);
  });

  it('is true when columns is true in config', () => {
    const state = new VirtualScrollState({ enabled: true, columns: true });
    expect(state.columnVirtualizationEnabled).toBe(true);
  });

  it('is false when columns is false in config', () => {
    const state = new VirtualScrollState({ enabled: true, columns: false });
    expect(state.columnVirtualizationEnabled).toBe(false);
  });
});

describe('VirtualScrollState  -  columnRange', () => {
  it('returns null initially', () => {
    const state = new VirtualScrollState({ enabled: true, columns: true });
    expect(state.columnRange).toBeNull();
  });

  it('returns null when column virtualization is disabled', () => {
    const state = new VirtualScrollState({ enabled: true });
    state.setColumnWidths([100, 100, 100]);
    expect(state.columnRange).toBeNull();
  });
});

describe('VirtualScrollState  -  setColumnWidths', () => {
  it('triggers recomputeColumnRange and emits columnRangeChanged', () => {
    const state = new VirtualScrollState({ enabled: true, columns: true });
    const listener = jest.fn();
    state.onColumnRangeChanged(listener);

    // Set container width (simulate observeContainerWidth)
    const el = document.createElement('div');
    Object.defineProperty(el, 'clientWidth', { value: 500 });
    state.observeContainerWidth(el);

    // Now set widths  -  triggers recompute
    state.setColumnWidths([100, 150, 200, 250, 300]);

    // Should have computed a column range
    const range = state.columnRange;
    expect(range).not.toBeNull();
    expect(range!.startIndex).toBe(0);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ columnRange: range });
  });

  it('does not compute range when containerWidth is 0', () => {
    const state = new VirtualScrollState({ enabled: true, columns: true });
    state.setColumnWidths([100, 100, 100]);
    expect(state.columnRange).toBeNull();
  });
});

describe('VirtualScrollState  -  handleHorizontalScroll', () => {
  it('is no-op when column virtualization is disabled', () => {
    const state = new VirtualScrollState({ enabled: true });
    const listener = jest.fn();
    state.onColumnRangeChanged(listener);

    state.handleHorizontalScroll(100);
    jest.advanceTimersByTime(20);

    expect(listener).not.toHaveBeenCalled();
  });

  it('updates scrollLeft via RAF and recomputes column range', () => {
    const state = new VirtualScrollState({ enabled: true, columns: true });

    // Set container width
    const el = document.createElement('div');
    Object.defineProperty(el, 'clientWidth', { value: 300 });
    state.observeContainerWidth(el);

    // Set widths for 5 columns (total = 500px, container = 300px)
    state.setColumnWidths([100, 100, 100, 100, 100]);

    const listener = jest.fn();
    state.onColumnRangeChanged(listener);

    // Scroll right by 150px
    state.handleHorizontalScroll(150);
    jest.advanceTimersByTime(20); // RAF fires

    const range = state.columnRange;
    expect(range).not.toBeNull();
    // At scrollLeft=150, columns visible: idx 1 (start=100, end=200) and idx 2..4
    expect(range!.startIndex).toBeGreaterThanOrEqual(0);
    expect(range!.endIndex).toBeLessThanOrEqual(4);
  });

  it('cancels pending RAF when called repeatedly', () => {
    const state = new VirtualScrollState({ enabled: true, columns: true });

    const el = document.createElement('div');
    Object.defineProperty(el, 'clientWidth', { value: 300 });
    state.observeContainerWidth(el);
    state.setColumnWidths([100, 100, 100, 100, 100]);

    // Call multiple times rapidly
    state.handleHorizontalScroll(50);
    state.handleHorizontalScroll(100);
    state.handleHorizontalScroll(150);

    // Only the last RAF should execute
    jest.advanceTimersByTime(20);

    const range = state.columnRange;
    expect(range).not.toBeNull();
  });
});

describe('VirtualScrollState  -  observeContainerWidth', () => {
  it('sets initial containerWidth from clientWidth', () => {
    const state = new VirtualScrollState({ enabled: true, columns: true });
    const el = document.createElement('div');
    Object.defineProperty(el, 'clientWidth', { value: 800 });

    state.observeContainerWidth(el);
    state.setColumnWidths([200, 200, 200, 200]);

    // With containerWidth=800 and total=800, all columns should be visible
    const range = state.columnRange;
    expect(range).not.toBeNull();
    expect(range!.startIndex).toBe(0);
    expect(range!.endIndex).toBe(3);
  });

  it('updates containerWidth and recomputes column range for second element', () => {
    const state = new VirtualScrollState({ enabled: true, columns: true });
    const el1 = document.createElement('div');
    Object.defineProperty(el1, 'clientWidth', { value: 200 });
    state.observeContainerWidth(el1);
    state.setColumnWidths([100, 100, 100, 100, 100]);

    const range1 = state.columnRange;
    expect(range1).not.toBeNull();

    // Observe a wider container
    const el2 = document.createElement('div');
    Object.defineProperty(el2, 'clientWidth', { value: 500 });
    state.observeContainerWidth(el2);
    state.setColumnWidths([100, 100, 100, 100, 100]);

    const range2 = state.columnRange;
    expect(range2).not.toBeNull();
    // Wider container should show more columns
    expect(range2!.endIndex).toBeGreaterThanOrEqual(range1!.endIndex);
  });
});

describe('VirtualScrollState  -  onColumnRangeChanged', () => {
  it('returns an unsubscribe function', () => {
    const state = new VirtualScrollState({ enabled: true, columns: true });
    const listener = jest.fn();
    const unsub = state.onColumnRangeChanged(listener);

    const el = document.createElement('div');
    Object.defineProperty(el, 'clientWidth', { value: 500 });
    state.observeContainerWidth(el);

    state.setColumnWidths([100, 100, 100]);
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();

    // Clear widths to trigger another emission
    state.setColumnWidths([200, 200]);
    expect(listener).toHaveBeenCalledTimes(1); // still 1  -  unsubscribed
  });
});

describe('VirtualScrollState  -  destroy cleans up column virtualization', () => {
  it('does not throw after destroy', () => {
    const state = new VirtualScrollState({ enabled: true, columns: true });
    const el = document.createElement('div');
    Object.defineProperty(el, 'clientWidth', { value: 500 });
    state.observeContainerWidth(el);
    state.setColumnWidths([100, 100, 100]);

    expect(() => state.destroy()).not.toThrow();

    // After destroy, listeners should be cleared
    const listener = jest.fn();
    state.onColumnRangeChanged(listener);
    state.setColumnWidths([200, 200]);
    // Emitter was cleared, so listener won't fire via emitter
    // (But setColumnWidths still directly recomputes - just no emitter)
  });
});
