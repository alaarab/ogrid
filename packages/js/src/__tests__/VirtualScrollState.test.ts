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

describe('VirtualScrollState — enabled getter', () => {
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
    // 0 >= 0 is true → enabled
    const state = new VirtualScrollState({ enabled: true, threshold: 0 });
    state.setTotalRows(0);
    expect(state.enabled).toBe(true);
  });
});

describe('VirtualScrollState — constructor defaults', () => {
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

describe('VirtualScrollState — setTotalRows', () => {
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

describe('VirtualScrollState — totalHeight', () => {
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

describe('VirtualScrollState — updateConfig', () => {
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

describe('VirtualScrollState — onConfigChanged', () => {
  it('onConfigChanged returns an unsubscribe function', () => {
    const state = new VirtualScrollState({ enabled: true, threshold: 1 });
    const listener = jest.fn();
    const unsub = state.onConfigChanged(listener);

    state.updateConfig({ enabled: false });
    expect(listener).toHaveBeenCalledTimes(1);

    // Unsubscribe
    unsub();
    state.updateConfig({ enabled: true });
    expect(listener).toHaveBeenCalledTimes(1); // still 1 — not called again
  });
});

describe('VirtualScrollState — visibleRange (pass-through when disabled)', () => {
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

describe('VirtualScrollState — config getter', () => {
  it('returns the current config', () => {
    const config = { enabled: true, rowHeight: 40, threshold: 75 };
    const state = new VirtualScrollState(config);
    expect(state.config).toEqual(config);
  });
});
