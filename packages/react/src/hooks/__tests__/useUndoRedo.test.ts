import { renderHook, act } from '@testing-library/react';
import { useUndoRedo } from '../useUndoRedo';

describe('useUndoRedo', () => {
  it('returns wrapped callback and undo/redo when onCellValueChanged provided', () => {
    const onCellValueChanged = jest.fn();
    const { result } = renderHook(() =>
      useUndoRedo({ onCellValueChanged, maxUndoDepth: 10 })
    );
    expect(typeof result.current.onCellValueChanged).toBe('function');
    expect(typeof result.current.undo).toBe('function');
    expect(typeof result.current.redo).toBe('function');
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('returns undefined wrapped when onCellValueChanged not provided', () => {
    const { result } = renderHook(() => useUndoRedo({ onCellValueChanged: undefined }));
    expect(result.current.onCellValueChanged).toBeUndefined();
  });

  it('wrapped callback calls onCellValueChanged and enables undo', () => {
    const onCellValueChanged = jest.fn();
    const { result } = renderHook(() =>
      useUndoRedo({ onCellValueChanged, maxUndoDepth: 10 })
    );
    const event = {
      item: { id: '1', name: 'A' },
      columnId: 'name',
      field: 'name',
      oldValue: 'A',
      newValue: 'B',
      rowIndex: 0,
    };
    act(() => {
      result.current.onCellValueChanged!(event);
    });
    expect(onCellValueChanged).toHaveBeenCalledWith(event);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('undo reverts last change and enables redo', () => {
    const onCellValueChanged = jest.fn();
    const { result } = renderHook(() =>
      useUndoRedo({ onCellValueChanged, maxUndoDepth: 10 })
    );
    const event = {
      item: { id: '1', name: 'A' },
      columnId: 'name',
      field: 'name',
      oldValue: 'A',
      newValue: 'B',
      rowIndex: 0,
    };
    act(() => {
      result.current.onCellValueChanged!(event);
    });
    act(() => {
      result.current.undo();
    });
    expect(onCellValueChanged).toHaveBeenCalledTimes(2);
    expect(onCellValueChanged).toHaveBeenLastCalledWith({
      ...event,
      oldValue: 'B',
      newValue: 'A',
    });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });

  it('redo reapplies reverted change', () => {
    const onCellValueChanged = jest.fn();
    const { result } = renderHook(() =>
      useUndoRedo({ onCellValueChanged, maxUndoDepth: 10 })
    );
    const event = {
      item: { id: '1', name: 'A' },
      columnId: 'name',
      field: 'name',
      oldValue: 'A',
      newValue: 'B',
      rowIndex: 0,
    };
    act(() => {
      result.current.onCellValueChanged!(event);
    });
    act(() => {
      result.current.undo();
    });
    act(() => {
      result.current.redo();
    });
    expect(onCellValueChanged).toHaveBeenCalledTimes(3);
    expect(onCellValueChanged).toHaveBeenLastCalledWith(event);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.canUndo).toBe(true);
  });
});

describe('useUndoRedo history reset (D23)', () => {
  const event = { item: { id: '1' }, columnId: 'name', field: 'name', oldValue: 'A', newValue: 'B', rowIndex: 0 };

  it('clear() drops undo and redo history', () => {
    const onCellValueChanged = jest.fn();
    const { result } = renderHook(() => useUndoRedo({ onCellValueChanged }));
    act(() => result.current.onCellValueChanged!(event));
    expect(result.current.canUndo).toBe(true);
    act(() => result.current.clear());
    expect(result.current.canUndo).toBe(false);
    onCellValueChanged.mockClear();
    act(() => result.current.undo());
    expect(onCellValueChanged).not.toHaveBeenCalled();
  });

  it('applies a changed maxUndoDepth after mount', () => {
    const onCellValueChanged = jest.fn();
    const { result, rerender } = renderHook(
      ({ depth }) => useUndoRedo({ onCellValueChanged, maxUndoDepth: depth }),
      { initialProps: { depth: 100 } },
    );
    act(() => result.current.onCellValueChanged!(event));
    rerender({ depth: 1 });
    for (let i = 0; i < 3; i++) act(() => result.current.onCellValueChanged!(event));
    onCellValueChanged.mockClear();
    act(() => result.current.undo());
    act(() => result.current.undo());
    // Depth 1: only a single undo step is available.
    expect(onCellValueChanged).toHaveBeenCalledTimes(1);
  });
});
