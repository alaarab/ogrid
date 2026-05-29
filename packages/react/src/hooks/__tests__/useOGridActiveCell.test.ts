import { renderHook, act } from '@testing-library/react';
import { useOGridActiveCell } from '../useOGridActiveCell';

describe('useOGridActiveCell', () => {
  it('starts with null ref and coords', () => {
    const { result } = renderHook(() => useOGridActiveCell());
    expect(result.current.activeCellRef).toBeNull();
    expect(result.current.activeCellCoords).toBeNull();
  });

  it('parses "A1" to zero-based { col: 0, row: 0 }', () => {
    const { result } = renderHook(() => useOGridActiveCell());
    act(() => result.current.onActiveCellChange('A1'));
    expect(result.current.activeCellRef).toBe('A1');
    expect(result.current.activeCellCoords).toEqual({ col: 0, row: 0 });
  });

  it('parses single-letter columns and 1-based rows', () => {
    const { result } = renderHook(() => useOGridActiveCell());
    act(() => result.current.onActiveCellChange('C5'));
    expect(result.current.activeCellCoords).toEqual({ col: 2, row: 4 });
    act(() => result.current.onActiveCellChange('Z100'));
    expect(result.current.activeCellCoords).toEqual({ col: 25, row: 99 });
  });

  it('parses multi-letter columns (AA -> 26)', () => {
    const { result } = renderHook(() => useOGridActiveCell());
    act(() => result.current.onActiveCellChange('AA1'));
    expect(result.current.activeCellCoords).toEqual({ col: 26, row: 0 });
  });

  it('clears coords when ref is null', () => {
    const { result } = renderHook(() => useOGridActiveCell());
    act(() => result.current.onActiveCellChange('B3'));
    expect(result.current.activeCellCoords).toEqual({ col: 1, row: 2 });
    act(() => result.current.onActiveCellChange(null));
    expect(result.current.activeCellRef).toBeNull();
    expect(result.current.activeCellCoords).toBeNull();
  });

  it('keeps the ref but nulls coords for unparseable references', () => {
    const { result } = renderHook(() => useOGridActiveCell());
    // lowercase, no digits, and leading-digit forms all fail the A1 pattern
    for (const bad of ['abc', 'A', '1A', 'A1B2']) {
      act(() => result.current.onActiveCellChange(bad));
      expect(result.current.activeCellRef).toBe(bad);
      expect(result.current.activeCellCoords).toBeNull();
    }
  });
});
