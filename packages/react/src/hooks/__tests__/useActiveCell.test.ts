import { renderHook, act } from '@testing-library/react';
import { useActiveCell } from '../useActiveCell';

describe('useActiveCell', () => {
  it('scrolls an unrendered active row by index and focuses it after rendering', () => {
    const wrapper = document.createElement('div');
    document.body.appendChild(wrapper);
    const scrollToIndex = jest.fn();
    const wrapperRef = { current: wrapper };
    const scrollRef = { current: scrollToIndex };
    const { result, rerender } = renderHook(() => useActiveCell(wrapperRef, null, scrollRef));
    act(() => result.current.setActiveCell({ rowIndex: 999, columnIndex: 2 }));
    expect(scrollToIndex).toHaveBeenCalledWith(999, 'auto');
    const cell = document.createElement('div');
    cell.tabIndex = -1;
    cell.dataset.rowIndex = '999';
    cell.dataset.colIndex = '2';
    wrapper.appendChild(cell);
    rerender();
    expect(document.activeElement).toBe(cell);
    rerender();
    expect(scrollToIndex).toHaveBeenCalledTimes(1);
  });

  it('does not scroll while editing', () => {
    const scrollToIndex = jest.fn();
    const { result } = renderHook(() => useActiveCell(
      { current: document.createElement('div') },
      { rowId: '1', columnId: 'name' },
      { current: scrollToIndex },
    ));
    act(() => result.current.setActiveCell({ rowIndex: 999, columnIndex: 0 }));
    expect(scrollToIndex).not.toHaveBeenCalled();
  });
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
