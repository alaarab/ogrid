/**
 * Tests for useGridVirtualization: row + column virtualization for headless
 * consumers. Verifies pass-through mode below threshold, scroll-driven range
 * updates, column virt activation, and scrollToIndex container interaction.
 */
import { act, renderHook } from '@testing-library/react';
import { useGridVirtualization } from '../useGridVirtualization';

type Box = {
  scrollTop: number;
  scrollLeft: number;
  clientHeight: number;
  clientWidth: number;
  scrollTo: (opts: { top?: number; left?: number; behavior?: ScrollBehavior }) => void;
};

const makeContainer = (overrides: Partial<Box> = {}) => {
  const el = {
    scrollTop: 0,
    scrollLeft: 0,
    clientHeight: 200,
    clientWidth: 600,
    scrollTo: ({ top, left }: { top?: number; left?: number }) => {
      if (top != null) el.scrollTop = top;
      if (left != null) el.scrollLeft = left;
    },
    ...overrides,
  } as unknown as HTMLElement;
  return { current: el };
};

beforeAll(() => {
  // jsdom doesn't ship ResizeObserver — stub it for the dimension tracker.
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    disconnect() {}
    unobserve() {}
  };
});

// rAF fires synchronously in tests so scroll events flush within `act`.
beforeEach(() => {
  jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
    cb(0);
    return 0;
  });
  jest.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useGridVirtualization — return shape', () => {
  it('returns all expected fields', () => {
    const ref = makeContainer();
    const { result } = renderHook(() =>
      useGridVirtualization({ rowCount: 10, rowHeight: 30, containerRef: ref }),
    );

    expect(result.current).toHaveProperty('totalHeight');
    expect(result.current).toHaveProperty('rowRange');
    expect(result.current).toHaveProperty('columnRange');
    expect(result.current).toHaveProperty('scrollToIndex');
    expect(result.current).toHaveProperty('onScroll');
    expect(result.current).toHaveProperty('isActive');
  });
});

describe('useGridVirtualization — pass-through below threshold', () => {
  it('renders all rows when rowCount < threshold', () => {
    const ref = makeContainer();
    const { result } = renderHook(() =>
      useGridVirtualization({
        rowCount: 50,
        rowHeight: 30,
        containerRef: ref,
        threshold: 100,
      }),
    );

    expect(result.current.isActive).toBe(false);
    expect(result.current.rowRange.startIndex).toBe(0);
    expect(result.current.rowRange.endIndex).toBe(49);
    expect(result.current.rowRange.offsetTop).toBe(0);
    expect(result.current.rowRange.offsetBottom).toBe(0);
    expect(result.current.totalHeight).toBe(1500); // 50 * 30
  });

  it('renders all rows when enabled is false', () => {
    const ref = makeContainer();
    const { result } = renderHook(() =>
      useGridVirtualization({
        rowCount: 5000,
        rowHeight: 30,
        containerRef: ref,
        enabled: false,
      }),
    );

    expect(result.current.isActive).toBe(false);
    expect(result.current.rowRange.startIndex).toBe(0);
    expect(result.current.rowRange.endIndex).toBe(4999);
  });
});

describe('useGridVirtualization — active virtualization', () => {
  it('reports a windowed range when rowCount ≥ threshold', () => {
    const ref = makeContainer({ clientHeight: 300 });
    const { result } = renderHook(() =>
      useGridVirtualization({
        rowCount: 1000,
        rowHeight: 30,
        containerRef: ref,
        threshold: 100,
        overscan: 0,
      }),
    );

    expect(result.current.isActive).toBe(true);
    expect(result.current.totalHeight).toBe(30000);
    // At scrollTop=0, only first ~10 rows visible.
    expect(result.current.rowRange.startIndex).toBe(0);
    expect(result.current.rowRange.endIndex).toBeLessThan(20);
    expect(result.current.rowRange.offsetTop).toBe(0);
    expect(result.current.rowRange.offsetBottom).toBeGreaterThan(0);
  });

  it('updates range when scroll fires', () => {
    const el = {
      scrollTop: 0,
      scrollLeft: 0,
      clientHeight: 300,
      clientWidth: 600,
      scrollTo: () => {},
    } as unknown as HTMLElement;
    const ref = { current: el };

    const { result } = renderHook(() =>
      useGridVirtualization({
        rowCount: 1000,
        rowHeight: 30,
        containerRef: ref,
        threshold: 100,
        overscan: 0,
      }),
    );

    act(() => {
      (el as unknown as { scrollTop: number }).scrollTop = 600;
      result.current.onScroll();
    });

    // After scrollTop=600 (row 20), we should see rows ~20-29.
    expect(result.current.rowRange.startIndex).toBeGreaterThanOrEqual(19);
    expect(result.current.rowRange.startIndex).toBeLessThanOrEqual(21);
  });
});

describe('useGridVirtualization — column virtualization', () => {
  it('returns null columnRange when columnWidths omitted', () => {
    const ref = makeContainer();
    const { result } = renderHook(() =>
      useGridVirtualization({ rowCount: 10, rowHeight: 30, containerRef: ref }),
    );
    expect(result.current.columnRange).toBeNull();
  });

  it('computes a columnRange when columnWidths provided', () => {
    const ref = makeContainer({ clientWidth: 400 });
    const columnWidths = Array(20).fill(150); // 20 cols × 150px = 3000px wide
    const { result } = renderHook(() =>
      useGridVirtualization({
        rowCount: 10,
        rowHeight: 30,
        containerRef: ref,
        columnWidths,
        columnOverscan: 0,
      }),
    );

    expect(result.current.columnRange).not.toBeNull();
    expect(result.current.columnRange?.startIndex).toBe(0);
    // 400px container shows ~3 columns at 150px each.
    expect(result.current.columnRange?.endIndex).toBeLessThan(5);
  });
});

describe('useGridVirtualization — scrollToIndex', () => {
  it('scrolls the container to the row offset', () => {
    const scrollTo = jest.fn();
    const el = {
      scrollTop: 0,
      scrollLeft: 0,
      clientHeight: 300,
      clientWidth: 600,
      scrollTo,
    } as unknown as HTMLElement;
    const ref = { current: el };

    const { result } = renderHook(() =>
      useGridVirtualization({
        rowCount: 1000,
        rowHeight: 30,
        containerRef: ref,
      }),
    );

    act(() => {
      result.current.scrollToIndex(50);
    });

    expect(scrollTo).toHaveBeenCalledWith({ top: 1500, behavior: 'auto' });
  });

  it('supports center alignment', () => {
    const scrollTo = jest.fn();
    const el = {
      scrollTop: 0,
      scrollLeft: 0,
      clientHeight: 300,
      clientWidth: 600,
      scrollTo,
    } as unknown as HTMLElement;
    const ref = { current: el };

    const { result } = renderHook(() =>
      useGridVirtualization({
        rowCount: 1000,
        rowHeight: 30,
        containerRef: ref,
      }),
    );

    act(() => {
      result.current.scrollToIndex(50, 'center');
    });

    // Row 50 at top would be 1500. Center within 300px container with 30px row:
    // top = 1500 - (300 - 30) / 2 = 1500 - 135 = 1365
    expect(scrollTo).toHaveBeenCalledWith({ top: 1365, behavior: 'auto' });
  });

  it('no-ops when container ref is null', () => {
    const ref = { current: null };
    const { result } = renderHook(() =>
      useGridVirtualization({ rowCount: 1000, rowHeight: 30, containerRef: ref }),
    );

    expect(() => {
      act(() => {
        result.current.scrollToIndex(50);
      });
    }).not.toThrow();
  });
});
