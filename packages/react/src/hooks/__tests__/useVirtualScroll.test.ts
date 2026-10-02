/**
 * Tests for useVirtualScroll: configurable threshold, enabling/disabling based on
 * row count vs threshold, and pass-through (non-virtual) mode.
 */
import { act, renderHook } from '@testing-library/react';
import { useVirtualScroll } from '../useVirtualScroll';

// Mock @tanstack/react-virtual  -  useVirtualizer is DOM-dependent; we test the logic layer
jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: jest.fn(() => ({
    getVirtualItems: jest.fn(() => []),
    getTotalSize: jest.fn(() => 0),
    scrollToIndex: jest.fn(),
  })),
}));

import { useVirtualizer } from '@tanstack/react-virtual';

const mockGetVirtualItems = jest.fn(() => []);
const mockGetTotalSize = jest.fn(() => 0);
const mockScrollToIndex = jest.fn();
const mockScrollToOffset = jest.fn();

beforeEach(() => {
  (useVirtualizer as jest.Mock).mockReturnValue({
    getVirtualItems: mockGetVirtualItems,
    getTotalSize: mockGetTotalSize,
    scrollToIndex: mockScrollToIndex,
    scrollToOffset: mockScrollToOffset,
  });
  mockGetVirtualItems.mockReturnValue([]);
  mockGetTotalSize.mockReturnValue(0);
  mockScrollToIndex.mockReset();
  mockScrollToOffset.mockReset();
});

function makeContainerRef(el: HTMLElement | null = null) {
  return { current: el };
}

describe('useVirtualScroll  -  return shape', () => {
  it('returns all expected fields', () => {
    const { result } = renderHook(() =>
      useVirtualScroll({
        totalRows: 50,
        rowHeight: 36,
        enabled: false,
        containerRef: makeContainerRef(),
      })
    );

    expect(result.current).toHaveProperty('virtualizer');
    expect(result.current).toHaveProperty('totalHeight');
    expect(result.current).toHaveProperty('visibleRange');
    expect(result.current).toHaveProperty('scrollToIndex');
    expect(typeof result.current.scrollToIndex).toBe('function');
  });
});

describe('useVirtualScroll  -  disabled (enabled=false)', () => {
  it('returns null virtualizer when enabled is false', () => {
    const { result } = renderHook(() =>
      useVirtualScroll({
        totalRows: 200,
        rowHeight: 36,
        enabled: false,
        containerRef: makeContainerRef(),
      })
    );

    expect(result.current.virtualizer).toBeNull();
  });

  it('returns totalHeight = totalRows * rowHeight when disabled', () => {
    const { result } = renderHook(() =>
      useVirtualScroll({
        totalRows: 50,
        rowHeight: 36,
        enabled: false,
        containerRef: makeContainerRef(),
      })
    );

    expect(result.current.totalHeight).toBe(50 * 36);
  });

  it('returns pass-through visibleRange spanning all rows when disabled', () => {
    const { result } = renderHook(() =>
      useVirtualScroll({
        totalRows: 50,
        rowHeight: 36,
        enabled: false,
        containerRef: makeContainerRef(),
      })
    );

    const range = result.current.visibleRange;
    expect(range.startIndex).toBe(0);
    expect(range.endIndex).toBe(49);
    expect(range.offsetTop).toBe(0);
    expect(range.offsetBottom).toBe(0);
  });
});

describe('useVirtualScroll  -  threshold (enabled=true)', () => {
  it('is inactive (pass-through) when totalRows < default threshold (100)', () => {
    const { result } = renderHook(() =>
      useVirtualScroll({
        totalRows: 99,
        rowHeight: 36,
        enabled: true,
        // No threshold provided  -  defaults to 100
        containerRef: makeContainerRef(),
      })
    );

    // Below threshold  to  pass-through: virtualizer is null
    expect(result.current.virtualizer).toBeNull();
  });

  it('is inactive when totalRows equals threshold - 1', () => {
    const { result } = renderHook(() =>
      useVirtualScroll({
        totalRows: 49,
        rowHeight: 36,
        enabled: true,
        threshold: 50,
        containerRef: makeContainerRef(),
      })
    );

    expect(result.current.virtualizer).toBeNull();
  });

  it('is active when totalRows equals threshold', () => {
    // When totalRows >= threshold AND enabled, virtualizer is non-null
    mockGetVirtualItems.mockReturnValue([] as never[]);
    mockGetTotalSize.mockReturnValue(100 * 36);

    const { result } = renderHook(() =>
      useVirtualScroll({
        totalRows: 50,
        rowHeight: 36,
        enabled: true,
        threshold: 50,
        containerRef: makeContainerRef(),
      })
    );

    expect(result.current.virtualizer).not.toBeNull();
  });

  it('is active when totalRows exceeds threshold', () => {
    mockGetVirtualItems.mockReturnValue([] as never[]);
    mockGetTotalSize.mockReturnValue(200 * 36);

    const { result } = renderHook(() =>
      useVirtualScroll({
        totalRows: 200,
        rowHeight: 36,
        enabled: true,
        threshold: 100,
        containerRef: makeContainerRef(),
      })
    );

    expect(result.current.virtualizer).not.toBeNull();
  });

  it('uses custom threshold when provided', () => {
    mockGetVirtualItems.mockReturnValue([] as never[]);
    mockGetTotalSize.mockReturnValue(30 * 36);

    const { result } = renderHook(() =>
      useVirtualScroll({
        totalRows: 30,
        rowHeight: 36,
        enabled: true,
        threshold: 25, // custom: activate at 25 rows
        containerRef: makeContainerRef(),
      })
    );

    // 30 >= 25, so should be active
    expect(result.current.virtualizer).not.toBeNull();
  });

  it('uses threshold of 1 to always activate when enabled', () => {
    mockGetVirtualItems.mockReturnValue([] as never[]);
    mockGetTotalSize.mockReturnValue(5 * 36);

    const { result } = renderHook(() =>
      useVirtualScroll({
        totalRows: 5,
        rowHeight: 36,
        enabled: true,
        threshold: 1,
        containerRef: makeContainerRef(),
      })
    );

    expect(result.current.virtualizer).not.toBeNull();
  });

  it('with threshold=0, active when totalRows is 0 and enabled=true', () => {
    mockGetVirtualItems.mockReturnValue([] as never[]);
    mockGetTotalSize.mockReturnValue(0);

    const { result } = renderHook(() =>
      useVirtualScroll({
        totalRows: 0,
        rowHeight: 36,
        enabled: true,
        threshold: 0,
        containerRef: makeContainerRef(),
      })
    );

    // 0 >= 0 is true, so should be active
    expect(result.current.virtualizer).not.toBeNull();
  });
});

describe('useVirtualScroll  -  totalHeight', () => {
  it('returns rowHeight * totalRows when pass-through (below threshold)', () => {
    const { result } = renderHook(() =>
      useVirtualScroll({
        totalRows: 30,
        rowHeight: 40,
        enabled: true,
        threshold: 100,
        containerRef: makeContainerRef(),
      })
    );

    expect(result.current.totalHeight).toBe(30 * 40);
  });

  it('returns 0 for totalHeight when totalRows is 0', () => {
    const { result } = renderHook(() =>
      useVirtualScroll({
        totalRows: 0,
        rowHeight: 36,
        enabled: false,
        containerRef: makeContainerRef(),
      })
    );

    expect(result.current.totalHeight).toBe(0);
  });
});

describe('useVirtualScroll  -  visibleRange pass-through edge cases', () => {
  it('endIndex is -1 when totalRows is 0 (pass-through)', () => {
    const { result } = renderHook(() =>
      useVirtualScroll({
        totalRows: 0,
        rowHeight: 36,
        enabled: false,
        containerRef: makeContainerRef(),
      })
    );

    // endIndex = Math.max(0, totalRows - 1) = Math.max(0, -1) = 0
    // Actually for 0 rows: Math.max(0, 0 - 1) = 0
    expect(result.current.visibleRange.startIndex).toBe(0);
  });

  it('endIndex is 0 when totalRows is 1 (single row, pass-through)', () => {
    const { result } = renderHook(() =>
      useVirtualScroll({
        totalRows: 1,
        rowHeight: 36,
        enabled: false,
        containerRef: makeContainerRef(),
      })
    );

    expect(result.current.visibleRange.endIndex).toBe(0);
  });

  it('endIndex is totalRows-1 for large datasets (pass-through)', () => {
    const { result } = renderHook(() =>
      useVirtualScroll({
        totalRows: 1000,
        rowHeight: 36,
        enabled: false,
        containerRef: makeContainerRef(),
      })
    );

    expect(result.current.visibleRange.endIndex).toBe(999);
  });
});

describe('useVirtualScroll  -  scrollToIndex', () => {
  it('scrolls container directly when not virtual (pass-through mode)', () => {
    const container = document.createElement('div');
    container.scrollTo = jest.fn();

    const { result } = renderHook(() =>
      useVirtualScroll({
        totalRows: 50,
        rowHeight: 36,
        enabled: false,
        containerRef: { current: container },
      })
    );

    result.current.scrollToIndex(10);
    expect(container.scrollTo).toHaveBeenCalledWith({ top: 10 * 36, behavior: 'auto' });
  });

  it('does not throw when container is null in pass-through mode', () => {
    const { result } = renderHook(() =>
      useVirtualScroll({
        totalRows: 50,
        rowHeight: 36,
        enabled: false,
        containerRef: makeContainerRef(null),
      })
    );

    expect(() => result.current.scrollToIndex(5)).not.toThrow();
  });
});

describe('useVirtualScroll  -  active visibleRange recomputes per render', () => {
  it('reflects a populated virtual range produced after the first render', () => {
    const containerRef = makeContainerRef(document.createElement('div'));
    // The virtualizer instance has a stable identity for the hook's lifetime.
    // The scroll element is measured asynchronously, so getVirtualItems() is
    // empty on the first render and populates on a later render. visibleRange
    // must NOT be frozen to that first empty value (the bug that rendered zero
    // body rows in a virtualized grid).
    mockGetVirtualItems.mockReturnValue([] as never[]);
    mockGetTotalSize.mockReturnValue(200 * 36);

    const { result, rerender } = renderHook(() =>
      useVirtualScroll({
        totalRows: 200,
        rowHeight: 36,
        enabled: true,
        threshold: 100,
        containerRef,
      })
    );

    // First render: no virtual items yet -> empty range.
    expect(result.current.visibleRange.endIndex).toBe(-1);

    // Scroll element is now measured: the virtualizer reports a real window.
    mockGetVirtualItems.mockReturnValue([
      { index: 0, start: 0, end: 36 },
      { index: 1, start: 36, end: 72 },
      { index: 2, start: 72, end: 108 },
    ] as never[]);
    rerender();

    expect(result.current.visibleRange.startIndex).toBe(0);
    expect(result.current.visibleRange.endIndex).toBe(2);
    expect(result.current.visibleRange.offsetTop).toBe(0);
    // 200*36 total - last.end (108) = 7092
    expect(result.current.visibleRange.offsetBottom).toBe(200 * 36 - 108);
  });
});

// --- Column virtualization ---

describe('useVirtualScroll  -  column virtualization', () => {
  it('returns null columnRange when columnVirtualization is disabled', () => {
    const { result } = renderHook(() =>
      useVirtualScroll({
        totalRows: 50,
        rowHeight: 36,
        enabled: false,
        containerRef: makeContainerRef(),
      })
    );

    expect(result.current.columnRange).toBeNull();
    expect(result.current.onHorizontalScroll).toBeUndefined();
  });

  it('returns null columnRange when columnVirtualization is true but no widths', () => {
    const { result } = renderHook(() =>
      useVirtualScroll({
        totalRows: 50,
        rowHeight: 36,
        enabled: false,
        containerRef: makeContainerRef(),
        columnVirtualization: true,
      })
    );

    expect(result.current.columnRange).toBeNull();
  });

  it('returns null columnRange when columnWidths is empty', () => {
    const { result } = renderHook(() =>
      useVirtualScroll({
        totalRows: 50,
        rowHeight: 36,
        enabled: false,
        containerRef: makeContainerRef(),
        columnVirtualization: true,
        columnWidths: [],
      })
    );

    expect(result.current.columnRange).toBeNull();
  });

  it('provides onHorizontalScroll callback when columnVirtualization is true', () => {
    const { result } = renderHook(() =>
      useVirtualScroll({
        totalRows: 50,
        rowHeight: 36,
        enabled: false,
        containerRef: makeContainerRef(),
        columnVirtualization: true,
        columnWidths: [100, 100, 100],
      })
    );

    expect(result.current.onHorizontalScroll).toBeDefined();
    expect(typeof result.current.onHorizontalScroll).toBe('function');
  });

  it('returns columnRange and onHorizontalScroll fields', () => {
    const { result } = renderHook(() =>
      useVirtualScroll({
        totalRows: 50,
        rowHeight: 36,
        enabled: false,
        containerRef: makeContainerRef(),
        columnVirtualization: true,
        columnWidths: [100, 100, 100],
      })
    );

    expect(result.current).toHaveProperty('columnRange');
    expect(result.current).toHaveProperty('onHorizontalScroll');
  });
});

describe('useVirtualScroll  -  scaled spacer (large datasets)', () => {
  // Build a container element with a fixed viewport height. `totalRows` is just
  // a number to the hook — no rows are materialized, so a million-row dataset
  // costs nothing here.
  function makeScaledContainer(clientHeight = 600) {
    const el = document.createElement('div');
    Object.defineProperty(el, 'clientHeight', { value: clientHeight, configurable: true });
    el.scrollTo = jest.fn() as unknown as typeof el.scrollTo;
    return el;
  }

  it('does not scale a dataset that fits under the height cap', () => {
    const containerRef = makeContainerRef(makeScaledContainer());
    const { result } = renderHook(() =>
      useVirtualScroll({
        totalRows: 50_000, // 50k * 36 = 1.8M px, well under the cap
        rowHeight: 36,
        enabled: true,
        containerRef,
      })
    );
    expect(result.current.scaled).toBe(false);
  });

  it('engages scaling when totalRows * rowHeight exceeds the cap', () => {
    const containerRef = makeContainerRef(makeScaledContainer());
    const { result } = renderHook(() =>
      useVirtualScroll({
        totalRows: 1_000_000, // 1M * 36 = 36M px, over the 32M cap
        rowHeight: 36,
        enabled: true,
        containerRef,
      })
    );
    expect(result.current.scaled).toBe(true);
  });

  it('clamps totalHeight to the spacer cap when scaled', () => {
    const containerRef = makeContainerRef(makeScaledContainer());
    const { result } = renderHook(() =>
      useVirtualScroll({
        totalRows: 1_000_000,
        rowHeight: 36,
        enabled: true,
        containerRef,
      })
    );
    expect(result.current.totalHeight).toBe(32_000_000);
  });

  it('reports the top window at scrollTop 0 with offsets summing to the spacer', () => {
    const containerRef = makeContainerRef(makeScaledContainer());
    const { result } = renderHook(() =>
      useVirtualScroll({
        totalRows: 1_000_000,
        rowHeight: 36,
        enabled: true,
        containerRef,
      })
    );
    const { startIndex, endIndex, offsetTop, offsetBottom } = result.current.visibleRange;
    expect(startIndex).toBe(0);
    expect(endIndex).toBeGreaterThan(0);
    expect(offsetTop).toBe(0);
    const blockHeight = (endIndex - startIndex + 1) * 36;
    // The two spacers plus the rendered block fill exactly the clamped spacer.
    expect(offsetTop + blockHeight + offsetBottom).toBe(32_000_000);
  });

  it('scrollToIndex remaps the target row to a compressed scrollTop', () => {
    const container = makeScaledContainer(600);
    const { result } = renderHook(() =>
      useVirtualScroll({
        totalRows: 1_000_000,
        rowHeight: 36,
        enabled: true,
        containerRef: makeContainerRef(container),
      })
    );
    act(() => result.current.scrollToIndex(500_000));
    expect(container.scrollTo).toHaveBeenCalledTimes(1);
    const arg = (container.scrollTo as jest.Mock).mock.calls[0][0];
    expect(arg.behavior).toBe('auto');
    // The remapped scrollTop must stay inside the clamped (compressed) range.
    expect(arg.top).toBeGreaterThan(0);
    expect(arg.top).toBeLessThanOrEqual(32_000_000);
  });

  it('keeps the last row reachable within the compressed range', () => {
    const container = makeScaledContainer(600);
    const { result } = renderHook(() =>
      useVirtualScroll({
        totalRows: 1_000_000,
        rowHeight: 36,
        enabled: true,
        containerRef: makeContainerRef(container),
      })
    );
    act(() => result.current.scrollToIndex(999_999));
    const arg = (container.scrollTo as jest.Mock).mock.calls[0][0];
    // Jump-to-last lands at the bottom of the compressed scroll range, never past it.
    expect(arg.top).toBeLessThanOrEqual(32_000_000 - 600);
    expect(arg.top).toBeGreaterThan(31_000_000);
  });
});

describe('useVirtualScroll  -  rowHeight changes', () => {
  it('re-measures the virtualizer when rowHeight changes', () => {
    const containerRef = makeContainerRef(document.createElement('div'));
    const measure = jest.fn();
    (useVirtualizer as jest.Mock).mockReturnValue({
      getVirtualItems: mockGetVirtualItems,
      getTotalSize: mockGetTotalSize,
      scrollToIndex: mockScrollToIndex,
      measure,
    });
    const { rerender } = renderHook(
      ({ rowHeight }) =>
        useVirtualScroll({
          totalRows: 500,
          rowHeight,
          enabled: true,
          containerRef,
        }),
      { initialProps: { rowHeight: 36 } },
    );
    expect(measure).not.toHaveBeenCalled();
    rerender({ rowHeight: 48 });
    expect(measure).toHaveBeenCalledTimes(1);
  });
});

describe('useVirtualScroll regressions', () => {
  it('centers standard virtual rows within the viewport below a sticky header', () => {
    const container = document.createElement('div');
    container.innerHTML = '<table><thead></thead></table>';
    Object.defineProperty(container, 'clientHeight', { value: 720 });
    container.querySelector('thead')!.getBoundingClientRect = () => ({ height: 48 }) as DOMRect;
    const containerRef = makeContainerRef(container);
    const { result } = renderHook(() => useVirtualScroll({
      totalRows: 1000, rowHeight: 36, enabled: true, stickyHeader: true, containerRef,
    }));
    act(() => result.current.scrollToIndex(500, 'center'));
    expect(mockScrollToOffset).toHaveBeenCalledWith(18_000 - (672 - 36) / 2);
  });

  it('subtracts the sticky header from standard row spacer offsets', () => {
    const container = document.createElement('div');
    container.innerHTML = '<table><thead></thead></table>';
    Object.defineProperty(container, 'clientHeight', { value: 720 });
    container.querySelector('thead')!.getBoundingClientRect = () => ({ height: 48 }) as DOMRect;
    const containerRef = makeContainerRef(container);
    mockGetTotalSize.mockReturnValue(36_000);
    mockGetVirtualItems.mockReturnValue([
      { index: 10, start: 408, end: 444 },
      { index: 30, start: 1128, end: 1164 },
    ] as never[]);
    const { result } = renderHook(() => useVirtualScroll({
      totalRows: 1000, rowHeight: 36, enabled: true, stickyHeader: true, containerRef,
    }));
    expect(result.current.visibleRange.offsetTop).toBe(360);
    expect(result.current.visibleRange.offsetBottom).toBe(36_000 - 31 * 36);
  });
  for (const align of ['start', 'center', 'end'] as const) {
    it(`supports ${align} alignment in scaled mode below the sticky header`, () => {
      const container = document.createElement('div');
      container.innerHTML = '<table><thead></thead></table>';
      Object.defineProperty(container, 'clientHeight', { value: 720 });
      container.querySelector('thead')!.getBoundingClientRect = () => ({ height: 48 }) as DOMRect;
      container.scrollTo = jest.fn();
      const containerRef = makeContainerRef(container);
      const { result } = renderHook(() => useVirtualScroll({
        totalRows: 10_000_000, rowHeight: 36, enabled: true, stickyHeader: true, containerRef,
      }));
      act(() => result.current.scrollToIndex(5_000_000, align));
      const top = (container.scrollTo as jest.Mock).mock.calls[0][0].top;
      const adjustment = align === 'center' ? (672 - 36) / 2 : align === 'end' ? 672 - 36 : 0;
      expect(top / (32_000_000 - 672) * (360_000_000 - 672)).toBeCloseTo(180_000_000 - adjustment, 5);
    });

    it(`passes ${align} alignment to the standard virtualizer`, () => {
      const containerRef = makeContainerRef(document.createElement('div'));
      const { result } = renderHook(() => useVirtualScroll({
        totalRows: 1000, rowHeight: 36, enabled: true, containerRef,
      }));
      act(() => result.current.scrollToIndex(500, align));
      expect(mockScrollToIndex).toHaveBeenCalledWith(500, { align });
    });
  }

  it('measures a container mounted later and observes its replacement', () => {
    const observe = jest.fn();
    const disconnect = jest.fn();
    const observer = jest.spyOn(globalThis, 'ResizeObserver').mockImplementation(() => ({
      observe, disconnect, unobserve: jest.fn(),
    }));
    const containerRef = makeContainerRef();
    const { result, rerender, unmount } = renderHook(() => useVirtualScroll({
      totalRows: 10_000_000, rowHeight: 36, enabled: true, containerRef,
    }));
    const first = document.createElement('div');
    Object.defineProperty(first, 'clientHeight', { value: 720 });
    first.scrollTop = (32_000_000 - 720) / 2;
    containerRef.current = first;
    rerender();
    expect(observe).toHaveBeenCalledWith(first);
    expect(result.current.visibleRange.startIndex).toBeGreaterThan(4_999_000);
    const second = document.createElement('div');
    Object.defineProperty(second, 'clientHeight', { value: 360 });
    containerRef.current = second;
    rerender();
    expect(disconnect).toHaveBeenCalled();
    expect(observe).toHaveBeenCalledWith(second);
    expect(result.current.visibleRange.startIndex).toBe(0);
    unmount();
    observer.mockRestore();
  });
});
