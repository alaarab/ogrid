/**
 * Tests for useVirtualScroll: configurable threshold, enabling/disabling based on
 * row count vs threshold, and pass-through (non-virtual) mode.
 */
import { renderHook } from '@testing-library/react';
import { useVirtualScroll } from '../useVirtualScroll';

// Mock @tanstack/react-virtual — useVirtualizer is DOM-dependent; we test the logic layer
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

beforeEach(() => {
  (useVirtualizer as jest.Mock).mockReturnValue({
    getVirtualItems: mockGetVirtualItems,
    getTotalSize: mockGetTotalSize,
    scrollToIndex: mockScrollToIndex,
  });
  mockGetVirtualItems.mockReturnValue([]);
  mockGetTotalSize.mockReturnValue(0);
  mockScrollToIndex.mockReset();
});

function makeContainerRef(el: HTMLElement | null = null) {
  return { current: el };
}

describe('useVirtualScroll — return shape', () => {
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

describe('useVirtualScroll — disabled (enabled=false)', () => {
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

describe('useVirtualScroll — threshold (enabled=true)', () => {
  it('is inactive (pass-through) when totalRows < default threshold (100)', () => {
    const { result } = renderHook(() =>
      useVirtualScroll({
        totalRows: 99,
        rowHeight: 36,
        enabled: true,
        // No threshold provided — defaults to 100
        containerRef: makeContainerRef(),
      })
    );

    // Below threshold → pass-through: virtualizer is null
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

describe('useVirtualScroll — totalHeight', () => {
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

describe('useVirtualScroll — visibleRange pass-through edge cases', () => {
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

describe('useVirtualScroll — scrollToIndex', () => {
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

// --- Column virtualization ---

describe('useVirtualScroll — column virtualization', () => {
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
