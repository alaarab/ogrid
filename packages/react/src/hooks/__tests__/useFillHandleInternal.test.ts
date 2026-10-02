import { renderHook, act } from '@testing-library/react';
import { useFillHandleInternal } from '../useFillHandleInternal';
import { useUndoRedo } from '../useUndoRedo';

describe('useFillHandleInternal', () => {
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
    const { result } = renderHook(() => useFillHandleInternal(params));
    expect(result.current.fillDrag).toBeNull();
    expect(typeof result.current.setFillDrag).toBe('function');
    expect(typeof result.current.handleFillHandleMouseDown).toBe('function');
  });

  it('handleFillHandleMouseDown does nothing when selectionRange is null', () => {
    const params = createParams({ selectionRange: null });
    const { result } = renderHook(() => useFillHandleInternal(params));
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
    const { result } = renderHook(() => useFillHandleInternal(params));
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

describe('useFillHandleInternal  -  fillDown (Ctrl+D)', () => {
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
    const { result } = renderHook(() => useFillHandleInternal(params));
    expect(typeof result.current.fillDown).toBe('function');
  });

  it('fillDown calls onCellValueChanged for rows below the top row in selection', () => {
    const onCellValueChanged = jest.fn();
    const params = createFillDownParams({ onCellValueChanged });
    const { result } = renderHook(() => useFillHandleInternal(params));

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
    const { result } = renderHook(() => useFillHandleInternal(params));

    act(() => {
      result.current.fillDown();
    });

    expect(onCellValueChanged).not.toHaveBeenCalled();
  });

  it('fillDown is a no-op when selectionRange is null', () => {
    const onCellValueChanged = jest.fn();
    const params = createFillDownParams({ selectionRange: null, onCellValueChanged });
    const { result } = renderHook(() => useFillHandleInternal(params));

    act(() => {
      result.current.fillDown();
    });

    expect(onCellValueChanged).not.toHaveBeenCalled();
  });

  it('fillDown is a no-op when onCellValueChanged is not provided', () => {
    const params = createFillDownParams({ onCellValueChanged: undefined });
    const { result } = renderHook(() => useFillHandleInternal(params));

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
    const { result } = renderHook(() => useFillHandleInternal(params));

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
    const { result } = renderHook(() => useFillHandleInternal(params));

    act(() => {
      result.current.fillDown();
    });

    expect(beginBatch).toHaveBeenCalledTimes(1);
    expect(endBatch).toHaveBeenCalledTimes(1);
  });

  it('fillDown handles reversed selection (endRow < startRow) by normalizing', () => {
    const onCellValueChanged = jest.fn();
    // Selection from row 2 up to row 0 (reversed)  -  should still fill rows 1,2 with row 0's value
    const params = createFillDownParams({
      selectionRange: { startRow: 2, startCol: 0, endRow: 0, endCol: 0 },
      onCellValueChanged,
    });
    const { result } = renderHook(() => useFillHandleInternal(params));

    act(() => {
      result.current.fillDown();
    });

    // normalizeSelectionRange makes startRow=0, endRow=2  -  same as forward selection
    expect(onCellValueChanged).toHaveBeenCalledTimes(2);
  });
});

describe('useFillHandleInternal  -  multi-cell source (S01/S11)', () => {
  type Item = { id: string; a: string; b: string };
  const items: Item[] = [
    { id: '1', a: 'a1', b: 'b1' },
    { id: '2', a: 'a2', b: 'b2' },
    { id: '3', a: '', b: '' },
  ];
  const cols = [
    { columnId: 'a', name: 'A', editable: true },
    { columnId: 'b', name: 'B', editable: true },
  ] as import('../../types').IColumnDef<Item>[];

  it('Ctrl+D copies each column top cell down its own column (not the top-left cell)', () => {
    const onCellValueChanged = jest.fn();
    const { result } = renderHook(() =>
      useFillHandleInternal<Item>({
        items,
        visibleCols: cols,
        onCellValueChanged,
        selectionRange: { startRow: 0, startCol: 0, endRow: 2, endCol: 1 },
        setSelectionRange: jest.fn(),
        setActiveCell: jest.fn(),
        colOffset: 0,
        wrapperRef: { current: document.createElement('div') },
      }),
    );
    act(() => result.current.fillDown());
    const got = onCellValueChanged.mock.calls.map(([e]) => `${e.rowIndex}:${e.columnId}=${e.newValue}`);
    expect(got).toEqual(['1:a=a1', '1:b=b1', '2:a=a1', '2:b=b1']);
  });

  it('records the whole source selection and ignores a right-click start', () => {
    const { result } = renderHook(() =>
      useFillHandleInternal<Item>({
        items,
        visibleCols: cols,
        onCellValueChanged: jest.fn(),
        selectionRange: { startRow: 0, startCol: 0, endRow: 1, endCol: 1 },
        setSelectionRange: jest.fn(),
        setActiveCell: jest.fn(),
        colOffset: 0,
        wrapperRef: { current: document.createElement('div') },
      }),
    );
    const evt = (button: number) => ({ preventDefault: jest.fn(), stopPropagation: jest.fn(), button }) as unknown as React.MouseEvent;
    act(() => result.current.handleFillHandleMouseDown(evt(2)));
    expect(result.current.fillDrag).toBeNull();
    act(() => result.current.handleFillHandleMouseDown(evt(0)));
    expect(result.current.fillDrag).toEqual({ startRow: 0, startCol: 0, endRow: 1, endCol: 1 });
  });
});

describe('useFillHandleInternal  -  tiled formula fill with undo (S01 + K05)', () => {
  // Composes the fill handle with useUndoRedo the way useDataGridInteraction
  // does: formula accessors take (flat column, display row) and map the row to
  // the sheet row; formula writes go through the undo wrapper.
  type Item = { id: string; total: unknown };
  const items: Item[] = [1, 2, 3, 4, 5].map((n) => ({ id: String(n), total: undefined }));
  const cols = [{ columnId: 'total', name: 'Total', editable: true }] as import('../../types').IColumnDef<Item>[];
  // Sorted view: display rows 0..4 show sheet rows 10, 11, 3, 7, 20.
  const sheetRows = [10, 11, 3, 7, 20];
  const toSheet = (row: number) => sheetRows[row] ?? row;

  function useHarness(store: Map<string, string>, wrapper: HTMLElement) {
    const formulaCells = {
      cellOf: () => null,
      getFormula: (col: number, row: number) => store.get(`${col},${row}`),
      setFormula: (col: number, row: number, formula: string | null) => {
        if (formula) store.set(`${col},${row}`, formula);
        else store.delete(`${col},${row}`);
      },
    };
    const undoRedo = useUndoRedo<Item>({ onCellValueChanged: () => {}, formulaCells });
    const fill = useFillHandleInternal<Item>({
      items,
      visibleCols: cols,
      onCellValueChanged: undoRedo.onCellValueChanged,
      selectionRange: { startRow: 0, startCol: 0, endRow: 1, endCol: 0 },
      setSelectionRange: () => {},
      setActiveCell: () => {},
      colOffset: 0,
      wrapperRef: { current: wrapper },
      beginBatch: undoRedo.beginBatch,
      endBatch: undoRedo.endBatch,
      formulaOptions: {
        flatColumns: cols,
        hasFormula: (col, row) => store.has(`${col},${toSheet(row)}`),
        getFormula: (col, row) => store.get(`${col},${toSheet(row)}`),
        setFormula: (col, row, formula) => undoRedo.setFormula(col, toSheet(row), formula),
        formulaRow: toSheet,
      },
    });
    return { undoRedo, fill };
  }

  it('drag-fills a two-row formula block, shifting each copy to its own record, and undoes in one step', () => {
    const store = new Map<string, string>([
      ['0,10', '=B11*2'],
      ['0,11', '=B12+1'],
    ]);
    const wrapper = document.createElement('div');
    const target = document.createElement('div');
    target.setAttribute('data-row-index', '4');
    target.setAttribute('data-col-index', '0');
    wrapper.appendChild(target);
    document.body.appendChild(wrapper);
    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => target;
    try {
      const { result } = renderHook(() => useHarness(store, wrapper));
      const down = { preventDefault: () => {}, stopPropagation: () => {}, button: 0 } as unknown as React.MouseEvent;
      act(() => result.current.fill.handleFillHandleMouseDown(down));
      act(() => {
        window.dispatchEvent(new MouseEvent('pointermove', { clientX: 1, clientY: 1 }));
        window.dispatchEvent(new MouseEvent('pointerup', { clientX: 1, clientY: 1 }));
      });

      // Display rows 2, 3, 4 (sheet rows 3, 7, 20) take the tiled sources 0, 1, 0.
      expect(store.get('0,3')).toBe('=B4*2');
      expect(store.get('0,7')).toBe('=B8+1');
      expect(store.get('0,20')).toBe('=B21*2');

      act(() => result.current.undoRedo.undo());
      expect(Array.from(store.keys()).sort()).toEqual(['0,10', '0,11']);
      expect(result.current.undoRedo.canUndo).toBe(false);
    } finally {
      document.elementFromPoint = originalElementFromPoint;
      wrapper.remove();
    }
  });
});
