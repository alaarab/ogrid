import { renderHook, act } from '@testing-library/react';
import { useActiveCell } from '../useActiveCell';

describe('useActiveCell', () => {
  it('returns activeCell null and setActiveCell', () => {
    const { result } = renderHook(() => useActiveCell());
    expect(result.current.activeCell).toBeNull();
    expect(typeof result.current.setActiveCell).toBe('function');
  });

  it('setActiveCell updates activeCell', () => {
    const { result } = renderHook(() => useActiveCell());
    act(() => {
      result.current.setActiveCell({ rowIndex: 1, columnIndex: 2 });
    });
    expect(result.current.activeCell).toEqual({ rowIndex: 1, columnIndex: 2 });
  });

  it('setActiveCell(null) clears activeCell', () => {
    const { result } = renderHook(() => useActiveCell());
    act(() => {
      result.current.setActiveCell({ rowIndex: 0, columnIndex: 0 });
    });
    act(() => {
      result.current.setActiveCell(null);
    });
    expect(result.current.activeCell).toBeNull();
  });
});
