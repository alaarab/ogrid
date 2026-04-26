import { renderHook, act } from '@testing-library/react';
import { useRangeSelection } from '../useRangeSelection';

describe('useRangeSelection', () => {
  it('starts with no selection', () => {
    const { result } = renderHook(() =>
      useRangeSelection({ rowCount: 10, colCount: 5 }),
    );
    expect(result.current.range).toBeNull();
    expect(result.current.anchor).toBeNull();
    expect(result.current.focus).toBeNull();
  });

  it('startRange creates a single-cell selection', () => {
    const { result } = renderHook(() =>
      useRangeSelection({ rowCount: 10, colCount: 5 }),
    );
    act(() => result.current.startRange(2, 3));
    expect(result.current.anchor).toEqual({ row: 2, col: 3 });
    expect(result.current.focus).toEqual({ row: 2, col: 3 });
    expect(result.current.range).toEqual({
      startRow: 2,
      startCol: 3,
      endRow: 2,
      endCol: 3,
    });
  });

  it('extendRange keeps anchor and moves focus', () => {
    const { result } = renderHook(() =>
      useRangeSelection({ rowCount: 10, colCount: 5 }),
    );
    act(() => result.current.startRange(2, 1));
    act(() => result.current.extendRange(5, 4));

    expect(result.current.anchor).toEqual({ row: 2, col: 1 });
    expect(result.current.focus).toEqual({ row: 5, col: 4 });
    expect(result.current.range).toEqual({
      startRow: 2,
      startCol: 1,
      endRow: 5,
      endCol: 4,
    });
  });

  it('extendRange normalizes when focus is above/left of anchor', () => {
    const { result } = renderHook(() =>
      useRangeSelection({ rowCount: 10, colCount: 5 }),
    );
    act(() => result.current.startRange(5, 4));
    act(() => result.current.extendRange(2, 1));

    // anchor stays at (5,4), focus at (2,1), but normalized range is (2..5, 1..4)
    expect(result.current.anchor).toEqual({ row: 5, col: 4 });
    expect(result.current.focus).toEqual({ row: 2, col: 1 });
    expect(result.current.range).toEqual({
      startRow: 2,
      startCol: 1,
      endRow: 5,
      endCol: 4,
    });
  });

  it('extendRange without prior start creates anchor at first call', () => {
    const { result } = renderHook(() =>
      useRangeSelection({ rowCount: 10, colCount: 5 }),
    );
    act(() => result.current.extendRange(3, 2));
    expect(result.current.anchor).toEqual({ row: 3, col: 2 });
    expect(result.current.focus).toEqual({ row: 3, col: 2 });
  });

  it('isInRange returns true for cells inside the range', () => {
    const { result } = renderHook(() =>
      useRangeSelection({ rowCount: 10, colCount: 5 }),
    );
    act(() => result.current.startRange(2, 1));
    act(() => result.current.extendRange(4, 3));

    expect(result.current.isInRange(2, 1)).toBe(true);
    expect(result.current.isInRange(3, 2)).toBe(true);
    expect(result.current.isInRange(4, 3)).toBe(true);
    expect(result.current.isInRange(1, 1)).toBe(false); // row above
    expect(result.current.isInRange(2, 0)).toBe(false); // col before
    expect(result.current.isInRange(5, 3)).toBe(false); // row below
    expect(result.current.isInRange(2, 4)).toBe(false); // col after
  });

  it('isInRange returns false when no selection', () => {
    const { result } = renderHook(() =>
      useRangeSelection({ rowCount: 10, colCount: 5 }),
    );
    expect(result.current.isInRange(0, 0)).toBe(false);
  });

  it('clearRange resets state', () => {
    const { result } = renderHook(() =>
      useRangeSelection({ rowCount: 10, colCount: 5 }),
    );
    act(() => result.current.startRange(2, 1));
    act(() => result.current.extendRange(4, 3));
    act(() => result.current.clearRange());
    expect(result.current.range).toBeNull();
    expect(result.current.anchor).toBeNull();
    expect(result.current.focus).toBeNull();
  });

  it('selectAll covers every cell', () => {
    const { result } = renderHook(() =>
      useRangeSelection({ rowCount: 10, colCount: 5 }),
    );
    act(() => result.current.selectAll());
    expect(result.current.range).toEqual({
      startRow: 0,
      startCol: 0,
      endRow: 9,
      endCol: 4,
    });
    expect(result.current.isInRange(0, 0)).toBe(true);
    expect(result.current.isInRange(9, 4)).toBe(true);
  });

  it('selectAll is a no-op on empty grid', () => {
    const { result } = renderHook(() =>
      useRangeSelection({ rowCount: 0, colCount: 0 }),
    );
    act(() => result.current.selectAll());
    expect(result.current.range).toBeNull();
  });

  it('setRange normalizes the input', () => {
    const { result } = renderHook(() =>
      useRangeSelection({ rowCount: 10, colCount: 5 }),
    );
    act(() =>
      result.current.setRange({ startRow: 5, startCol: 4, endRow: 2, endCol: 1 }),
    );
    expect(result.current.range).toEqual({
      startRow: 2,
      startCol: 1,
      endRow: 5,
      endCol: 4,
    });
  });

  it('setRange null clears the selection', () => {
    const { result } = renderHook(() =>
      useRangeSelection({ rowCount: 10, colCount: 5 }),
    );
    act(() => result.current.startRange(2, 1));
    act(() => result.current.setRange(null));
    expect(result.current.range).toBeNull();
  });

  it('getRangeRows returns row indices in order', () => {
    const { result } = renderHook(() =>
      useRangeSelection({ rowCount: 10, colCount: 5 }),
    );
    act(() => result.current.startRange(2, 0));
    act(() => result.current.extendRange(5, 0));
    expect(result.current.getRangeRows()).toEqual([2, 3, 4, 5]);
  });

  it('getRangeCells returns every cell in row-major order', () => {
    const { result } = renderHook(() =>
      useRangeSelection({ rowCount: 10, colCount: 5 }),
    );
    act(() => result.current.startRange(1, 1));
    act(() => result.current.extendRange(2, 2));

    expect(result.current.getRangeCells()).toEqual([
      { row: 1, col: 1 },
      { row: 1, col: 2 },
      { row: 2, col: 1 },
      { row: 2, col: 2 },
    ]);
  });

  it('getRangeRows / getRangeCells return empty when no selection', () => {
    const { result } = renderHook(() =>
      useRangeSelection({ rowCount: 10, colCount: 5 }),
    );
    expect(result.current.getRangeRows()).toEqual([]);
    expect(result.current.getRangeCells()).toEqual([]);
  });
});
