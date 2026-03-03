import { renderHook, act } from '@testing-library/react';
import { useKeyboardNavigation } from '../useKeyboardNavigation';

describe('useKeyboardNavigation', () => {
  const items = [{ id: '1', name: 'A' }, { id: '2', name: 'B' }];
  const visibleCols = [
    { columnId: 'name', name: 'Name' },
  ] as import('../../types').IColumnDef<{ id: string; name: string }>[];
  const wrapperRef = { current: document.createElement('div') };

  // Helper to create params in the new grouped structure
  const makeParams = (overrides: Record<string, any> = {}) => ({
    data: {
      items: (overrides.items !== undefined ? overrides.items : items) as typeof items,
      visibleCols: (overrides.visibleCols !== undefined ? overrides.visibleCols : visibleCols) as typeof visibleCols,
      colOffset: (overrides.colOffset !== undefined ? overrides.colOffset : 0) as number,
      hasCheckboxCol: (overrides.hasCheckboxCol !== undefined ? overrides.hasCheckboxCol : false) as boolean,
      visibleColumnCount: (overrides.visibleColumnCount !== undefined ? overrides.visibleColumnCount : 1) as number,
      getRowId: (overrides.getRowId !== undefined ? overrides.getRowId : ((item: { id: string }) => item.id)) as (item: any) => string,
    },
    state: {
      activeCell: (overrides.activeCell !== undefined ? overrides.activeCell : null) as any,
      selectionRange: (overrides.selectionRange !== undefined ? overrides.selectionRange : null) as any,
      editingCell: (overrides.editingCell !== undefined ? overrides.editingCell : null) as any,
      selectedRowIds: (overrides.selectedRowIds !== undefined ? overrides.selectedRowIds : new Set<string>()) as Set<string>,
    },
    handlers: {
      setActiveCell: (overrides.setActiveCell !== undefined ? overrides.setActiveCell : jest.fn()) as jest.Mock,
      setSelectionRange: (overrides.setSelectionRange !== undefined ? overrides.setSelectionRange : jest.fn()) as jest.Mock,
      setEditingCell: (overrides.setEditingCell !== undefined ? overrides.setEditingCell : jest.fn()) as jest.Mock,
      handleRowCheckboxChange: (overrides.handleRowCheckboxChange !== undefined ? overrides.handleRowCheckboxChange : jest.fn()) as jest.Mock,
      handleCopy: (overrides.handleCopy !== undefined ? overrides.handleCopy : jest.fn()) as jest.Mock,
      handleCut: (overrides.handleCut !== undefined ? overrides.handleCut : jest.fn()) as jest.Mock,
      handlePaste: (overrides.handlePaste !== undefined ? overrides.handlePaste : jest.fn().mockResolvedValue(undefined)) as jest.Mock,
      setContextMenu: (overrides.setContextMenu !== undefined ? overrides.setContextMenu : jest.fn()) as jest.Mock,
      onUndo: overrides.onUndo as (() => void) | undefined,
      onRedo: overrides.onRedo as (() => void) | undefined,
      clearClipboardRanges: overrides.clearClipboardRanges as (() => void) | undefined,
    },
    features: {
      editable: (overrides.editable !== undefined ? overrides.editable : false) as boolean,
      onCellValueChanged: overrides.onCellValueChanged as any,
      rowSelection: (overrides.rowSelection !== undefined ? overrides.rowSelection : 'none' as const) as any,
      wrapperRef: (overrides.wrapperRef !== undefined ? overrides.wrapperRef : wrapperRef) as typeof wrapperRef,
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns handleGridKeyDown function', () => {
    const { result } = renderHook(() =>
      useKeyboardNavigation(makeParams())
    );

    expect(typeof result.current.handleGridKeyDown).toBe('function');
  });

  it('ArrowDown when activeCell is null sets active cell to (0, colOffset) and prevents default', () => {
    const setActiveCell = jest.fn();
    const { result } = renderHook(() =>
      useKeyboardNavigation(makeParams({ setActiveCell }))
    );

    const e = {
      key: 'ArrowDown',
      preventDefault: jest.fn(),
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
    } as unknown as React.KeyboardEvent;

    act(() => {
      result.current.handleGridKeyDown(e);
    });

    expect(setActiveCell).toHaveBeenCalledWith({ rowIndex: 0, columnIndex: 0 });
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it('when items.length is 0, ArrowDown does nothing', () => {
    const setActiveCell = jest.fn();
    const { result } = renderHook(() =>
      useKeyboardNavigation(makeParams({ items: [], setActiveCell }))
    );

    const e = {
      key: 'ArrowDown',
      preventDefault: jest.fn(),
    } as unknown as React.KeyboardEvent;

    act(() => {
      result.current.handleGridKeyDown(e);
    });

    expect(setActiveCell).not.toHaveBeenCalled();
  });

  it('Ctrl+C when activeCell is set calls handleCopy and prevents default', () => {
    const handleCopy = jest.fn();
    const { result } = renderHook(() =>
      useKeyboardNavigation(makeParams({ activeCell: { rowIndex: 0, columnIndex: 0 }, handleCopy }))
    );

    const e = {
      key: 'c',
      preventDefault: jest.fn(),
      ctrlKey: true,
      metaKey: false,
    } as unknown as React.KeyboardEvent;

    act(() => {
      result.current.handleGridKeyDown(e);
    });

    expect(handleCopy).toHaveBeenCalled();
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it('Escape when editingCell is set calls setEditingCell(null)', () => {
    const setEditingCell = jest.fn();
    const { result } = renderHook(() =>
      useKeyboardNavigation(makeParams({
        activeCell: { rowIndex: 0, columnIndex: 0 },
        editingCell: { rowId: '1', columnId: 'name' },
        setEditingCell,
      }))
    );

    const e = {
      key: 'Escape',
      preventDefault: jest.fn(),
    } as unknown as React.KeyboardEvent;

    act(() => {
      result.current.handleGridKeyDown(e);
    });

    expect(setEditingCell).toHaveBeenCalledWith(null);
    expect(e.preventDefault).toHaveBeenCalled();
  });

  describe('PageDown / PageUp', () => {
    // 15 rows so PageDown (fallback pageSize=10) can move meaningfully
    type PgItem = { id: string; name: string };
    const pgItems: PgItem[] = Array.from({ length: 15 }, (_, i) => ({ id: String(i), name: `Row${i}` }));
    const pgCols = [
      { columnId: 'name', name: 'Name' },
    ] as import('../../types').IColumnDef<PgItem>[];

    function makePgParams(activeRow: number, sel?: any) {
      return makeParams({
        items: pgItems,
        visibleCols: pgCols,
        visibleColumnCount: 1,
        activeCell: { rowIndex: activeRow, columnIndex: 0 },
        setActiveCell: jest.fn(),
        setSelectionRange: jest.fn(),
        selectionRange: sel ?? null,
        getRowId: (item: PgItem) => item.id,
      });
    }

    function firePgKey(handler: (e: React.KeyboardEvent) => void, key: string, opts: { shift?: boolean } = {}) {
      const e = {
        key,
        preventDefault: jest.fn(),
        ctrlKey: false,
        metaKey: false,
        shiftKey: opts.shift ?? false,
      } as unknown as React.KeyboardEvent;
      act(() => handler(e));
      return e;
    }

    it('PageDown moves active cell down by pageSize (fallback 10)', () => {
      const p = makePgParams(0);
      const { result } = renderHook(() => useKeyboardNavigation(p));
      firePgKey(result.current.handleGridKeyDown, 'PageDown');
      expect(p.handlers.setActiveCell).toHaveBeenCalledWith({ rowIndex: 10, columnIndex: 0 });
    });

    it('PageDown clamps to last row', () => {
      const p = makePgParams(10);
      const { result } = renderHook(() => useKeyboardNavigation(p));
      firePgKey(result.current.handleGridKeyDown, 'PageDown');
      expect(p.handlers.setActiveCell).toHaveBeenCalledWith({ rowIndex: 14, columnIndex: 0 });
    });

    it('PageUp moves active cell up by pageSize', () => {
      const p = makePgParams(14);
      const { result } = renderHook(() => useKeyboardNavigation(p));
      firePgKey(result.current.handleGridKeyDown, 'PageUp');
      expect(p.handlers.setActiveCell).toHaveBeenCalledWith({ rowIndex: 4, columnIndex: 0 });
    });

    it('PageUp clamps to first row', () => {
      const p = makePgParams(3);
      const { result } = renderHook(() => useKeyboardNavigation(p));
      firePgKey(result.current.handleGridKeyDown, 'PageUp');
      expect(p.handlers.setActiveCell).toHaveBeenCalledWith({ rowIndex: 0, columnIndex: 0 });
    });

    it('Shift+PageDown extends selection downward', () => {
      const p = makePgParams(2);
      const { result } = renderHook(() => useKeyboardNavigation(p));
      firePgKey(result.current.handleGridKeyDown, 'PageDown', { shift: true });
      expect(p.handlers.setSelectionRange).toHaveBeenCalledWith(
        expect.objectContaining({ startRow: 2, endRow: 12 })
      );
    });

    it('Shift+PageUp extends selection upward', () => {
      const p = makePgParams(14);
      const { result } = renderHook(() => useKeyboardNavigation(p));
      firePgKey(result.current.handleGridKeyDown, 'PageUp', { shift: true });
      expect(p.handlers.setSelectionRange).toHaveBeenCalledWith(
        expect.objectContaining({ startRow: 14, endRow: 4 })
      );
    });

    it('PageDown prevents default', () => {
      const p = makePgParams(0);
      const { result } = renderHook(() => useKeyboardNavigation(p));
      const e = firePgKey(result.current.handleGridKeyDown, 'PageDown');
      expect(e.preventDefault).toHaveBeenCalled();
    });

    it('PageDown when no active cell sets initial cell', () => {
      const p = makeParams({ items: pgItems, visibleCols: pgCols, visibleColumnCount: 1, setActiveCell: jest.fn() });
      const { result } = renderHook(() => useKeyboardNavigation(p));
      firePgKey(result.current.handleGridKeyDown, 'PageDown');
      expect(p.handlers.setActiveCell).toHaveBeenCalledWith({ rowIndex: 0, columnIndex: 0 });
    });
  });

  describe('Ctrl+Arrow (Excel-style jump)', () => {
    // 6 rows, 3 columns  -  some cells empty to test data-boundary navigation
    // Row 0: A, 1, X
    // Row 1: B, 2, (empty)
    // Row 2: C, (empty), (empty)
    // Row 3: (empty), (empty), (empty)
    // Row 4: D, 3, Y
    // Row 5: E, 4, Z
    type Item = { id: string; col0: string; col1: string; col2: string };
    const ctrlItems: Item[] = [
      { id: '0', col0: 'A', col1: '1', col2: 'X' },
      { id: '1', col0: 'B', col1: '2', col2: '' },
      { id: '2', col0: 'C', col1: '', col2: '' },
      { id: '3', col0: '', col1: '', col2: '' },
      { id: '4', col0: 'D', col1: '3', col2: 'Y' },
      { id: '5', col0: 'E', col1: '4', col2: 'Z' },
    ];
    const ctrlCols = [
      { columnId: 'col0', name: 'Col0' },
      { columnId: 'col1', name: 'Col1' },
      { columnId: 'col2', name: 'Col2' },
    ] as import('../../types').IColumnDef<Item>[];

    function makeCtrlParams(activeRow: number, activeCol: number) {
      return makeParams({
        items: ctrlItems,
        visibleCols: ctrlCols,
        visibleColumnCount: 3,
        activeCell: { rowIndex: activeRow, columnIndex: activeCol },
        setActiveCell: jest.fn(),
        setSelectionRange: jest.fn(),
        getRowId: (item: Item) => item.id,
      });
    }

    function fireKey(handler: (e: React.KeyboardEvent) => void, key: string, opts: { ctrl?: boolean; shift?: boolean } = {}) {
      const e = {
        key,
        preventDefault: jest.fn(),
        ctrlKey: opts.ctrl ?? false,
        metaKey: false,
        shiftKey: opts.shift ?? false,
      } as unknown as React.KeyboardEvent;
      act(() => handler(e));
      return e;
    }

    // --- Ctrl+Down ---
    it('Ctrl+Down from non-empty cell with non-empty below jumps to last non-empty before gap', () => {
      // col0: A(0), B(1), C(2), ''(3)  to  from row 0 should land on row 2
      const p = makeCtrlParams(0, 0);
      const { result } = renderHook(() => useKeyboardNavigation(p));
      fireKey(result.current.handleGridKeyDown, 'ArrowDown', { ctrl: true });
      expect(p.handlers.setActiveCell).toHaveBeenCalledWith({ rowIndex: 2, columnIndex: 0 });
    });

    it('Ctrl+Down from non-empty cell with empty below jumps to next non-empty', () => {
      // col0: C(2), ''(3), D(4)  to  from row 2, next is empty, should land on row 4
      const p = makeCtrlParams(2, 0);
      const { result } = renderHook(() => useKeyboardNavigation(p));
      fireKey(result.current.handleGridKeyDown, 'ArrowDown', { ctrl: true });
      expect(p.handlers.setActiveCell).toHaveBeenCalledWith({ rowIndex: 4, columnIndex: 0 });
    });

    it('Ctrl+Down from empty cell jumps to next non-empty', () => {
      // col0: ''(3), D(4)  to  from row 3, should land on row 4
      const p = makeCtrlParams(3, 0);
      const { result } = renderHook(() => useKeyboardNavigation(p));
      fireKey(result.current.handleGridKeyDown, 'ArrowDown', { ctrl: true });
      expect(p.handlers.setActiveCell).toHaveBeenCalledWith({ rowIndex: 4, columnIndex: 0 });
    });

    it('Ctrl+Down from last non-empty runs to edge', () => {
      // col0: D(4), E(5)  to  from row 4, should land on row 5 (edge)
      const p = makeCtrlParams(4, 0);
      const { result } = renderHook(() => useKeyboardNavigation(p));
      fireKey(result.current.handleGridKeyDown, 'ArrowDown', { ctrl: true });
      expect(p.handlers.setActiveCell).toHaveBeenCalledWith({ rowIndex: 5, columnIndex: 0 });
    });

    it('Ctrl+Down at bottom edge stays put', () => {
      const p = makeCtrlParams(5, 0);
      const { result } = renderHook(() => useKeyboardNavigation(p));
      fireKey(result.current.handleGridKeyDown, 'ArrowDown', { ctrl: true });
      expect(p.handlers.setActiveCell).toHaveBeenCalledWith({ rowIndex: 5, columnIndex: 0 });
    });

    // --- Ctrl+Up ---
    it('Ctrl+Up from non-empty cell with non-empty above jumps to last non-empty before gap', () => {
      // col0: D(4), E(5)  to  from row 5 should land on row 4 (then ''(3) is gap)
      const p = makeCtrlParams(5, 0);
      const { result } = renderHook(() => useKeyboardNavigation(p));
      fireKey(result.current.handleGridKeyDown, 'ArrowUp', { ctrl: true });
      expect(p.handlers.setActiveCell).toHaveBeenCalledWith({ rowIndex: 4, columnIndex: 0 });
    });

    it('Ctrl+Up from non-empty cell with empty above jumps to next non-empty', () => {
      // col0: C(2), ''(3), D(4)  to  from row 4, above is empty at row 3, should land on row 2
      const p = makeCtrlParams(4, 0);
      const { result } = renderHook(() => useKeyboardNavigation(p));
      fireKey(result.current.handleGridKeyDown, 'ArrowUp', { ctrl: true });
      expect(p.handlers.setActiveCell).toHaveBeenCalledWith({ rowIndex: 2, columnIndex: 0 });
    });

    it('Ctrl+Up from empty cell jumps to next non-empty above', () => {
      // col0: C(2), ''(3)  to  from row 3, should land on row 2
      const p = makeCtrlParams(3, 0);
      const { result } = renderHook(() => useKeyboardNavigation(p));
      fireKey(result.current.handleGridKeyDown, 'ArrowUp', { ctrl: true });
      expect(p.handlers.setActiveCell).toHaveBeenCalledWith({ rowIndex: 2, columnIndex: 0 });
    });

    it('Ctrl+Up at top edge stays put', () => {
      const p = makeCtrlParams(0, 0);
      const { result } = renderHook(() => useKeyboardNavigation(p));
      fireKey(result.current.handleGridKeyDown, 'ArrowUp', { ctrl: true });
      expect(p.handlers.setActiveCell).toHaveBeenCalledWith({ rowIndex: 0, columnIndex: 0 });
    });

    // --- Ctrl+Right ---
    it('Ctrl+Right from non-empty cell scans to last non-empty before gap', () => {
      // Row 0: A(col0), 1(col1), X(col2)  -  all non-empty  to  jumps to col2 (edge)
      const p = makeCtrlParams(0, 0);
      const { result } = renderHook(() => useKeyboardNavigation(p));
      fireKey(result.current.handleGridKeyDown, 'ArrowRight', { ctrl: true });
      expect(p.handlers.setActiveCell).toHaveBeenCalledWith({ rowIndex: 0, columnIndex: 2 });
    });

    it('Ctrl+Right from non-empty with empty next jumps to edge when all empty after', () => {
      // Row 2: C(col0), ''(col1), ''(col2)  to  from col0 jumps to col2 (edge, all empty)
      const p = makeCtrlParams(2, 0);
      const { result } = renderHook(() => useKeyboardNavigation(p));
      fireKey(result.current.handleGridKeyDown, 'ArrowRight', { ctrl: true });
      expect(p.handlers.setActiveCell).toHaveBeenCalledWith({ rowIndex: 2, columnIndex: 2 });
    });

    it('Ctrl+Right stops at boundary between non-empty and empty', () => {
      // Row 1: B(col0), 2(col1), ''(col2)  to  from col0, next is non-empty  to  lands on col1
      const p = makeCtrlParams(1, 0);
      const { result } = renderHook(() => useKeyboardNavigation(p));
      fireKey(result.current.handleGridKeyDown, 'ArrowRight', { ctrl: true });
      expect(p.handlers.setActiveCell).toHaveBeenCalledWith({ rowIndex: 1, columnIndex: 1 });
    });

    it('Ctrl+Right at right edge stays put', () => {
      const p = makeCtrlParams(0, 2);
      const { result } = renderHook(() => useKeyboardNavigation(p));
      fireKey(result.current.handleGridKeyDown, 'ArrowRight', { ctrl: true });
      expect(p.handlers.setActiveCell).toHaveBeenCalledWith({ rowIndex: 0, columnIndex: 2 });
    });

    // --- Ctrl+Left ---
    it('Ctrl+Left from non-empty cell scans to left edge when all non-empty', () => {
      // Row 0: A(col0), 1(col1), X(col2)  -  all non-empty  to  from col2, jumps to col0 (edge)
      const p = makeCtrlParams(0, 2);
      const { result } = renderHook(() => useKeyboardNavigation(p));
      fireKey(result.current.handleGridKeyDown, 'ArrowLeft', { ctrl: true });
      expect(p.handlers.setActiveCell).toHaveBeenCalledWith({ rowIndex: 0, columnIndex: 0 });
    });

    it('Ctrl+Left from empty cell jumps to next non-empty on the left', () => {
      // Row 1: B(col0), 2(col1), ''(col2)  to  from col2, should land on col1
      const p = makeCtrlParams(1, 2);
      const { result } = renderHook(() => useKeyboardNavigation(p));
      fireKey(result.current.handleGridKeyDown, 'ArrowLeft', { ctrl: true });
      expect(p.handlers.setActiveCell).toHaveBeenCalledWith({ rowIndex: 1, columnIndex: 1 });
    });

    it('Ctrl+Left at left edge stays put', () => {
      const p = makeCtrlParams(0, 0);
      const { result } = renderHook(() => useKeyboardNavigation(p));
      fireKey(result.current.handleGridKeyDown, 'ArrowLeft', { ctrl: true });
      expect(p.handlers.setActiveCell).toHaveBeenCalledWith({ rowIndex: 0, columnIndex: 0 });
    });

    // --- Ctrl+Shift+Arrow (extend selection) ---
    it('Ctrl+Shift+Down extends selection to the ctrl-target row', () => {
      // col0: A(0), B(1), C(2), ''(3)  to  from row 0, ctrl-target = row 2
      const p = makeCtrlParams(0, 0);
      const { result } = renderHook(() => useKeyboardNavigation(p));
      fireKey(result.current.handleGridKeyDown, 'ArrowDown', { ctrl: true, shift: true });
      expect(p.handlers.setActiveCell).toHaveBeenCalledWith({ rowIndex: 2, columnIndex: 0 });
      expect(p.handlers.setSelectionRange).toHaveBeenCalledWith(
        expect.objectContaining({ startRow: 0, endRow: 2 })
      );
    });

    it('Ctrl+Shift+Right extends selection to the ctrl-target column', () => {
      // Row 0: A, 1, X  -  all non-empty  to  from col0, ctrl-target = col2
      const p = makeCtrlParams(0, 0);
      const { result } = renderHook(() => useKeyboardNavigation(p));
      fireKey(result.current.handleGridKeyDown, 'ArrowRight', { ctrl: true, shift: true });
      expect(p.handlers.setActiveCell).toHaveBeenCalledWith({ rowIndex: 0, columnIndex: 2 });
      expect(p.handlers.setSelectionRange).toHaveBeenCalledWith(
        expect.objectContaining({ startCol: 0, endCol: 2 })
      );
    });

    // --- Column with all empties in the middle ---
    it('Ctrl+Down in column with gap skips empties to next non-empty', () => {
      // col2: X(0), ''(1), ''(2), ''(3), Y(4), Z(5)  to  from row 1 (empty), should land on row 4
      const p = makeCtrlParams(1, 2);
      const { result } = renderHook(() => useKeyboardNavigation(p));
      fireKey(result.current.handleGridKeyDown, 'ArrowDown', { ctrl: true });
      expect(p.handlers.setActiveCell).toHaveBeenCalledWith({ rowIndex: 4, columnIndex: 2 });
    });
  });
});

// ---------------------------------------------------------------------------
// onKeyDown intercept
// ---------------------------------------------------------------------------

describe('useKeyboardNavigation  -  onKeyDown intercept prop', () => {
  const items = [{ id: '1', name: 'A' }, { id: '2', name: 'B' }];
  const visibleCols = [{ columnId: 'name', name: 'Name' }] as import('../../types').IColumnDef<{ id: string; name: string }>[];
  const wrapperRef = { current: document.createElement('div') };

  function makeInterceptParams(overrides: Record<string, unknown> = {}) {
    return {
      data: {
        items,
        visibleCols,
        colOffset: 0,
        hasCheckboxCol: false,
        visibleColumnCount: 1,
        getRowId: (item: { id: string }) => item.id,
      },
      state: {
        activeCell: { rowIndex: 0, columnIndex: 0 },
        selectionRange: null,
        editingCell: null,
        selectedRowIds: new Set<string>(),
      },
      handlers: {
        setActiveCell: jest.fn(),
        setSelectionRange: jest.fn(),
        setEditingCell: jest.fn(),
        handleRowCheckboxChange: jest.fn(),
        handleCopy: jest.fn(),
        handleCut: jest.fn(),
        handlePaste: jest.fn().mockResolvedValue(undefined),
        setContextMenu: jest.fn(),
      },
      features: {
        editable: false,
        onCellValueChanged: undefined,
        rowSelection: 'none' as const,
        wrapperRef,
        ...overrides,
      },
    };
  }

  function makeEvent(key: string, opts: { cancelable?: boolean; ctrlKey?: boolean } = {}): React.KeyboardEvent {
    return {
      key,
      preventDefault: jest.fn(),
      defaultPrevented: false,
      ctrlKey: opts.ctrlKey ?? false,
      metaKey: false,
      shiftKey: false,
      ...(opts.cancelable !== undefined ? { cancelable: opts.cancelable } : {}),
    } as unknown as React.KeyboardEvent;
  }

  it('calls onKeyDown prop before handling the event', () => {
    const onKeyDown = jest.fn();
    const params = makeInterceptParams({ onKeyDown });
    const { result } = renderHook(() => useKeyboardNavigation(params));

    const e = makeEvent('ArrowDown');
    act(() => { result.current.handleGridKeyDown(e); });

    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(onKeyDown).toHaveBeenCalledWith(e);
  });

  it('does NOT call grid default handler when onKeyDown calls preventDefault()', () => {
    const setActiveCell = jest.fn();
    // onKeyDown calls preventDefault which sets defaultPrevented=true on the real event object
    const onKeyDown = (e: React.KeyboardEvent) => { e.preventDefault(); };

    const params = {
      data: {
        items,
        visibleCols,
        colOffset: 0,
        hasCheckboxCol: false,
        visibleColumnCount: 1,
        getRowId: (item: { id: string }) => item.id,
      },
      state: {
        activeCell: { rowIndex: 0, columnIndex: 0 },
        selectionRange: null,
        editingCell: null,
        selectedRowIds: new Set<string>(),
      },
      handlers: {
        setActiveCell,
        setSelectionRange: jest.fn(),
        setEditingCell: jest.fn(),
        handleRowCheckboxChange: jest.fn(),
        handleCopy: jest.fn(),
        handleCut: jest.fn(),
        handlePaste: jest.fn().mockResolvedValue(undefined),
        setContextMenu: jest.fn(),
      },
      features: {
        editable: false,
        onCellValueChanged: undefined,
        rowSelection: 'none' as const,
        wrapperRef,
        onKeyDown,
      },
    };
    const { result } = renderHook(() => useKeyboardNavigation(params));

    // Use a real event-like object where preventDefault actually sets defaultPrevented
    const e: React.KeyboardEvent = Object.assign(
      Object.create({
        preventDefault() { Object.defineProperty(this, 'defaultPrevented', { value: true, configurable: true, writable: true }); },
      }),
      {
        key: 'ArrowDown',
        defaultPrevented: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
      }
    ) as unknown as React.KeyboardEvent;

    act(() => { result.current.handleGridKeyDown(e); });

    // setActiveCell should NOT have been called (grid default suppressed)
    expect(setActiveCell).not.toHaveBeenCalled();
  });

  it('grid default handler runs normally when onKeyDown does NOT call preventDefault()', () => {
    const setActiveCell = jest.fn();
    const onKeyDown = jest.fn(); // does not call preventDefault()

    const params = {
      data: {
        items,
        visibleCols,
        colOffset: 0,
        hasCheckboxCol: false,
        visibleColumnCount: 1,
        getRowId: (item: { id: string }) => item.id,
      },
      state: {
        activeCell: { rowIndex: 0, columnIndex: 0 },
        selectionRange: null,
        editingCell: null,
        selectedRowIds: new Set<string>(),
      },
      handlers: {
        setActiveCell,
        setSelectionRange: jest.fn(),
        setEditingCell: jest.fn(),
        handleRowCheckboxChange: jest.fn(),
        handleCopy: jest.fn(),
        handleCut: jest.fn(),
        handlePaste: jest.fn().mockResolvedValue(undefined),
        setContextMenu: jest.fn(),
      },
      features: {
        editable: false,
        onCellValueChanged: undefined,
        rowSelection: 'none' as const,
        wrapperRef,
        onKeyDown,
      },
    };

    const { result } = renderHook(() => useKeyboardNavigation(params));

    const e = makeEvent('ArrowDown');
    act(() => { result.current.handleGridKeyDown(e); });

    // onKeyDown was called
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    // Grid default also ran (active cell moved to row 1)
    expect(setActiveCell).toHaveBeenCalledWith({ rowIndex: 1, columnIndex: 0 });
  });

  it('passes the keyboard event to onKeyDown so the consumer can read e.key', () => {
    const capturedKeys: string[] = [];
    const onKeyDown = (e: React.KeyboardEvent) => { capturedKeys.push(e.key); };

    const params = makeInterceptParams({ onKeyDown });
    const { result } = renderHook(() => useKeyboardNavigation(params));

    act(() => { result.current.handleGridKeyDown(makeEvent('Tab')); });
    act(() => { result.current.handleGridKeyDown(makeEvent('Escape')); });

    expect(capturedKeys).toEqual(['Tab', 'Escape']);
  });

  it('fillDown is called on Ctrl+D when fillDown prop is provided and editable=true', () => {
    const fillDown = jest.fn();
    const params = makeInterceptParams({ fillDown, editable: true });
    const { result } = renderHook(() => useKeyboardNavigation(params));

    const e = makeEvent('d', { ctrlKey: true });
    act(() => { result.current.handleGridKeyDown(e); });

    expect(fillDown).toHaveBeenCalledTimes(1);
  });

  it('fillDown is NOT called on Ctrl+D when editable is false', () => {
    const fillDown = jest.fn();
    const params = makeInterceptParams({ fillDown, editable: false });
    const { result } = renderHook(() => useKeyboardNavigation(params));

    act(() => { result.current.handleGridKeyDown(makeEvent('d', { ctrlKey: true })); });

    expect(fillDown).not.toHaveBeenCalled();
  });

  it('fillDown is NOT called on Ctrl+D when fillDown prop is not provided', () => {
    const params = makeInterceptParams({ editable: true }); // no fillDown
    const { result } = renderHook(() => useKeyboardNavigation(params));

    expect(() => {
      act(() => { result.current.handleGridKeyDown(makeEvent('d', { ctrlKey: true })); });
    }).not.toThrow();
  });
});
