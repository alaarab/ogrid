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

describe('useUndoRedo with formula cells', () => {
  type Item = { id: string; total: unknown };
  function setup() {
    const formulas = new Map<string, string>([['3,1', '=B2*C2']]);
    const formulaCells = {
      cellOf: (e: { columnId: string; rowIndex: number }) => (e.columnId === 'total' ? { col: 3, row: e.rowIndex + 1 } : null),
      getFormula: (col: number, row: number) => formulas.get(`${col},${row}`),
      setFormula: jest.fn((col: number, row: number, formula: string | null) => {
        if (formula) formulas.set(`${col},${row}`, formula);
        else formulas.delete(`${col},${row}`);
      }),
      onCellChanged: jest.fn(),
    };
    const onCellValueChanged = jest.fn();
    const hook = renderHook(() => useUndoRedo<Item>({ onCellValueChanged, formulaCells }));
    const event = { item: { id: '2', total: undefined }, columnId: 'total', oldValue: undefined, newValue: 99, rowIndex: 0 };
    return { formulas, formulaCells, onCellValueChanged, hook, event };
  }

  it('a value written over a formula clears it, and one undo restores both', () => {
    const { formulas, formulaCells, onCellValueChanged, hook, event } = setup();
    act(() => {
      hook.result.current.onCellValueChanged!(event);
    });
    expect(formulas.has('3,1')).toBe(false);
    expect(formulaCells.onCellChanged).toHaveBeenCalledWith(3, 1);

    act(() => {
      hook.result.current.undo();
    });
    expect(formulas.get('3,1')).toBe('=B2*C2');
    expect(onCellValueChanged).toHaveBeenLastCalledWith(expect.objectContaining({ oldValue: 99, newValue: undefined }));
    expect(hook.result.current.canUndo).toBe(false);

    act(() => {
      hook.result.current.redo();
    });
    expect(formulas.has('3,1')).toBe(false);
    expect(onCellValueChanged).toHaveBeenLastCalledWith(event);
  });

  it('records formula edits as undoable steps', () => {
    const { formulas, hook } = setup();
    act(() => {
      hook.result.current.setFormula(3, 1, '=1');
    });
    expect(formulas.get('3,1')).toBe('=1');
    expect(hook.result.current.canUndo).toBe(true);

    act(() => {
      hook.result.current.undo();
    });
    expect(formulas.get('3,1')).toBe('=B2*C2');
    act(() => {
      hook.result.current.redo();
    });
    expect(formulas.get('3,1')).toBe('=1');
  });

  it('groups formula and value changes made in one batch', () => {
    const { formulas, hook, event } = setup();
    act(() => {
      hook.result.current.beginBatch();
      hook.result.current.setFormula(3, 2, '=A3');
      hook.result.current.onCellValueChanged!(event);
      hook.result.current.endBatch();
    });
    act(() => {
      hook.result.current.undo();
    });
    expect(formulas.get('3,1')).toBe('=B2*C2');
    expect(formulas.has('3,2')).toBe(false);
    expect(hook.result.current.canUndo).toBe(false);
  });
});
