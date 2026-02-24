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

// ---------------------------------------------------------------------------
// fillDown (Ctrl+D) tests
// ---------------------------------------------------------------------------

describe('useFillHandle — fillDown (Ctrl+D)', () => {
  type Item = { id: string; name: string };
  const items: Item[] = [
    { id: '1', name: 'Alice' },
    { id: '2', name: 'Bob' },
    { id: '3', name: 'Charlie' },
  ];
  const visibleCols = [{ columnId: 'name', name: 'Name', editable: true }] as import('../../types').IColumnDef<Item>[];

  const createFillDownParams = (overrides: Record<string, unknown> = {}) => ({
    items,
    visibleCols,
    editable: true,
    onCellValueChanged: jest.fn(),
    selectionRange: { startRow: 0, startCol: 0, endRow: 2, endCol: 0 },
    setSelectionRange: jest.fn(),
    setActiveCell: jest.fn(),
    colOffset: 0,
    wrapperRef: { current: document.createElement('div') },
    ...overrides,
  });

  it('returns a fillDown function', () => {
    const params = createFillDownParams();
    const { result } = renderHook(() => useFillHandle(params));
    expect(typeof result.current.fillDown).toBe('function');
  });

  it('fillDown calls onCellValueChanged for rows below the top row in selection', () => {
    const onCellValueChanged = jest.fn();
    const params = createFillDownParams({ onCellValueChanged });
    const { result } = renderHook(() => useFillHandle(params));

    act(() => {
      result.current.fillDown();
    });

    // Rows 1 and 2 should be filled with "Alice" (value from row 0)
    expect(onCellValueChanged).toHaveBeenCalledWith(
      expect.objectContaining({ columnId: 'name', newValue: 'Alice' })
    );
    // Should be called for rows 1 and 2 only (row 0 is the source)
    expect(onCellValueChanged).toHaveBeenCalledTimes(2);
  });

  it('fillDown is a no-op when editable is false', () => {
    const onCellValueChanged = jest.fn();
    const params = createFillDownParams({ editable: false, onCellValueChanged });
    const { result } = renderHook(() => useFillHandle(params));

    act(() => {
      result.current.fillDown();
    });

    expect(onCellValueChanged).not.toHaveBeenCalled();
  });

  it('fillDown is a no-op when selectionRange is null', () => {
    const onCellValueChanged = jest.fn();
    const params = createFillDownParams({ selectionRange: null, onCellValueChanged });
    const { result } = renderHook(() => useFillHandle(params));

    act(() => {
      result.current.fillDown();
    });

    expect(onCellValueChanged).not.toHaveBeenCalled();
  });

  it('fillDown is a no-op when onCellValueChanged is not provided', () => {
    const params = createFillDownParams({ onCellValueChanged: undefined });
    const { result } = renderHook(() => useFillHandle(params));

    // Should not throw
    expect(() => {
      act(() => {
        result.current.fillDown();
      });
    }).not.toThrow();
  });

  it('fillDown is a no-op for single-row selection (nothing to fill)', () => {
    const onCellValueChanged = jest.fn();
    const params = createFillDownParams({
      selectionRange: { startRow: 1, startCol: 0, endRow: 1, endCol: 0 },
      onCellValueChanged,
    });
    const { result } = renderHook(() => useFillHandle(params));

    act(() => {
      result.current.fillDown();
    });

    expect(onCellValueChanged).not.toHaveBeenCalled();
  });

  it('fillDown calls beginBatch and endBatch when batch functions are provided', () => {
    const onCellValueChanged = jest.fn();
    const beginBatch = jest.fn();
    const endBatch = jest.fn();
    const params = createFillDownParams({ onCellValueChanged, beginBatch, endBatch });
    const { result } = renderHook(() => useFillHandle(params));

    act(() => {
      result.current.fillDown();
    });

    expect(beginBatch).toHaveBeenCalledTimes(1);
    expect(endBatch).toHaveBeenCalledTimes(1);
  });

  it('fillDown handles reversed selection (endRow < startRow) by normalizing', () => {
    const onCellValueChanged = jest.fn();
    // Selection from row 2 up to row 0 (reversed) — should still fill rows 1,2 with row 0's value
    const params = createFillDownParams({
      selectionRange: { startRow: 2, startCol: 0, endRow: 0, endCol: 0 },
      onCellValueChanged,
    });
    const { result } = renderHook(() => useFillHandle(params));

    act(() => {
      result.current.fillDown();
    });

    // normalizeSelectionRange makes startRow=0, endRow=2 — same as forward selection
    expect(onCellValueChanged).toHaveBeenCalledTimes(2);
  });
});
