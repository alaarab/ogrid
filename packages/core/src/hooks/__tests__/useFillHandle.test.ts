import { renderHook, act } from '@testing-library/react';
import { useFillHandle } from '../useFillHandle';

describe('useFillHandle', () => {
  const createParams = (overrides = {}) => ({
    items: [{ id: '1', name: 'A' }, { id: '2', name: 'B' }],
    visibleCols: [{ columnId: 'name', name: 'Name' }],
    onCellValueChanged: jest.fn(),
    selectionRange: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
    setSelectionRange: jest.fn(),
    setActiveCell: jest.fn(),
    colOffset: 0,
    wrapperRef: { current: document.createElement('div') },
    ...overrides,
  });

  it('returns fillDrag, setFillDrag, and handleFillHandleMouseDown', () => {
    const params = createParams();
    const { result } = renderHook(() => useFillHandle(params));
    expect(result.current.fillDrag).toBeNull();
    expect(typeof result.current.setFillDrag).toBe('function');
    expect(typeof result.current.handleFillHandleMouseDown).toBe('function');
  });

  it('handleFillHandleMouseDown does nothing when selectionRange is null', () => {
    const params = createParams({ selectionRange: null });
    const { result } = renderHook(() => useFillHandle(params));
    const e = { preventDefault: jest.fn(), stopPropagation: jest.fn() } as unknown as React.MouseEvent;
    act(() => {
      result.current.handleFillHandleMouseDown(e);
    });
    expect(e.preventDefault).toHaveBeenCalled();
    expect(e.stopPropagation).toHaveBeenCalled();
    expect(result.current.fillDrag).toBeNull();
  });

  it('handleFillHandleMouseDown sets fillDrag when selectionRange is set', () => {
    const params = createParams();
    const { result } = renderHook(() => useFillHandle(params));
    const e = { preventDefault: jest.fn(), stopPropagation: jest.fn() } as unknown as React.MouseEvent;
    act(() => {
      result.current.handleFillHandleMouseDown(e);
    });
    expect(result.current.fillDrag).toEqual({ startRow: 0, startCol: 0 });
  });
});
