import { renderHook, act } from '@testing-library/react';
import { useKeyboardNavigation } from '../useKeyboardNavigation';

describe('useKeyboardNavigation', () => {
  const items = [{ id: '1', name: 'A' }, { id: '2', name: 'B' }];
  const visibleCols = [
    { columnId: 'name', name: 'Name' },
  ] as import('../../types').IColumnDef<{ id: string; name: string }>[];
  const wrapperRef = { current: document.createElement('div') };

  const defaultParams = {
    items,
    visibleCols,
    colOffset: 0,
    hasCheckboxCol: false,
    visibleColumnCount: 1,
    activeCell: null,
    setActiveCell: jest.fn(),
    selectionRange: null,
    setSelectionRange: jest.fn(),
    editable: false,
    onCellValueChanged: undefined,
    getRowId: (item: { id: string }) => item.id,
    editingCell: null,
    setEditingCell: jest.fn(),
    rowSelection: 'none' as const,
    selectedRowIds: new Set<string>(),
    handleRowCheckboxChange: jest.fn(),
    handleCopy: jest.fn(),
    handleCut: jest.fn(),
    handlePaste: jest.fn().mockResolvedValue(undefined),
    setContextMenu: jest.fn(),
    wrapperRef,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns handleGridKeyDown function', () => {
    const { result } = renderHook(() =>
      useKeyboardNavigation({ ...defaultParams })
    );

    expect(typeof result.current.handleGridKeyDown).toBe('function');
  });

  it('ArrowDown when activeCell is null sets active cell to (0, colOffset) and prevents default', () => {
    const setActiveCell = jest.fn();
    const { result } = renderHook(() =>
      useKeyboardNavigation({
        ...defaultParams,
        setActiveCell,
      })
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
      useKeyboardNavigation({
        ...defaultParams,
        items: [],
        setActiveCell,
      })
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
      useKeyboardNavigation({
        ...defaultParams,
        activeCell: { rowIndex: 0, columnIndex: 0 },
        handleCopy,
      })
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
      useKeyboardNavigation({
        ...defaultParams,
        activeCell: { rowIndex: 0, columnIndex: 0 },
        editingCell: { rowId: '1', columnId: 'name' },
        setEditingCell,
      })
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

  describe('Ctrl+Arrow (Excel-style jump)', () => {
    // 6 rows, 3 columns — some cells empty to test data-boundary navigation
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
      return {
        ...defaultParams,
        items: ctrlItems,
        visibleCols: ctrlCols,
        visibleColumnCount: 3,
        activeCell: { rowIndex: activeRow, columnIndex: activeCol },
        setActiveCell: jest.fn(),
        setSelectionRange: jest.fn(),
        getRowId: (item: Item) => item.id,
      };
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
      // col0: A(0), B(1), C(2), ''(3) → from row 0 should land on row 2
      const p = makeCtrlParams(0, 0);
      const { result } = renderHook(() => useKeyboardNavigation(p));
      fireKey(result.current.handleGridKeyDown, 'ArrowDown', { ctrl: true });
      expect(p.setActiveCell).toHaveBeenCalledWith({ rowIndex: 2, columnIndex: 0 });
    });

    it('Ctrl+Down from non-empty cell with empty below jumps to next non-empty', () => {
      // col0: C(2), ''(3), D(4) → from row 2, next is empty, should land on row 4
      const p = makeCtrlParams(2, 0);
      const { result } = renderHook(() => useKeyboardNavigation(p));
      fireKey(result.current.handleGridKeyDown, 'ArrowDown', { ctrl: true });
      expect(p.setActiveCell).toHaveBeenCalledWith({ rowIndex: 4, columnIndex: 0 });
    });

    it('Ctrl+Down from empty cell jumps to next non-empty', () => {
      // col0: ''(3), D(4) → from row 3, should land on row 4
      const p = makeCtrlParams(3, 0);
      const { result } = renderHook(() => useKeyboardNavigation(p));
      fireKey(result.current.handleGridKeyDown, 'ArrowDown', { ctrl: true });
      expect(p.setActiveCell).toHaveBeenCalledWith({ rowIndex: 4, columnIndex: 0 });
    });

    it('Ctrl+Down from last non-empty runs to edge', () => {
      // col0: D(4), E(5) → from row 4, should land on row 5 (edge)
      const p = makeCtrlParams(4, 0);
      const { result } = renderHook(() => useKeyboardNavigation(p));
      fireKey(result.current.handleGridKeyDown, 'ArrowDown', { ctrl: true });
      expect(p.setActiveCell).toHaveBeenCalledWith({ rowIndex: 5, columnIndex: 0 });
    });

    it('Ctrl+Down at bottom edge stays put', () => {
      const p = makeCtrlParams(5, 0);
      const { result } = renderHook(() => useKeyboardNavigation(p));
      fireKey(result.current.handleGridKeyDown, 'ArrowDown', { ctrl: true });
      expect(p.setActiveCell).toHaveBeenCalledWith({ rowIndex: 5, columnIndex: 0 });
    });

    // --- Ctrl+Up ---
    it('Ctrl+Up from non-empty cell with non-empty above jumps to last non-empty before gap', () => {
      // col0: D(4), E(5) → from row 5 should land on row 4 (then ''(3) is gap)
      const p = makeCtrlParams(5, 0);
      const { result } = renderHook(() => useKeyboardNavigation(p));
      fireKey(result.current.handleGridKeyDown, 'ArrowUp', { ctrl: true });
      expect(p.setActiveCell).toHaveBeenCalledWith({ rowIndex: 4, columnIndex: 0 });
    });

    it('Ctrl+Up from non-empty cell with empty above jumps to next non-empty', () => {
      // col0: C(2), ''(3), D(4) → from row 4, above is empty at row 3, should land on row 2
      const p = makeCtrlParams(4, 0);
      const { result } = renderHook(() => useKeyboardNavigation(p));
      fireKey(result.current.handleGridKeyDown, 'ArrowUp', { ctrl: true });
      expect(p.setActiveCell).toHaveBeenCalledWith({ rowIndex: 2, columnIndex: 0 });
    });

    it('Ctrl+Up from empty cell jumps to next non-empty above', () => {
      // col0: C(2), ''(3) → from row 3, should land on row 2
      const p = makeCtrlParams(3, 0);
      const { result } = renderHook(() => useKeyboardNavigation(p));
      fireKey(result.current.handleGridKeyDown, 'ArrowUp', { ctrl: true });
      expect(p.setActiveCell).toHaveBeenCalledWith({ rowIndex: 2, columnIndex: 0 });
    });

    it('Ctrl+Up at top edge stays put', () => {
      const p = makeCtrlParams(0, 0);
      const { result } = renderHook(() => useKeyboardNavigation(p));
      fireKey(result.current.handleGridKeyDown, 'ArrowUp', { ctrl: true });
      expect(p.setActiveCell).toHaveBeenCalledWith({ rowIndex: 0, columnIndex: 0 });
    });

    // --- Ctrl+Right ---
    it('Ctrl+Right from non-empty cell scans to last non-empty before gap', () => {
      // Row 0: A(col0), 1(col1), X(col2) — all non-empty → jumps to col2 (edge)
      const p = makeCtrlParams(0, 0);
      const { result } = renderHook(() => useKeyboardNavigation(p));
      fireKey(result.current.handleGridKeyDown, 'ArrowRight', { ctrl: true });
      expect(p.setActiveCell).toHaveBeenCalledWith({ rowIndex: 0, columnIndex: 2 });
    });

    it('Ctrl+Right from non-empty with empty next jumps to edge when all empty after', () => {
      // Row 2: C(col0), ''(col1), ''(col2) → from col0 jumps to col2 (edge, all empty)
      const p = makeCtrlParams(2, 0);
      const { result } = renderHook(() => useKeyboardNavigation(p));
      fireKey(result.current.handleGridKeyDown, 'ArrowRight', { ctrl: true });
      expect(p.setActiveCell).toHaveBeenCalledWith({ rowIndex: 2, columnIndex: 2 });
    });

    it('Ctrl+Right stops at boundary between non-empty and empty', () => {
      // Row 1: B(col0), 2(col1), ''(col2) → from col0, next is non-empty → lands on col1
      const p = makeCtrlParams(1, 0);
      const { result } = renderHook(() => useKeyboardNavigation(p));
      fireKey(result.current.handleGridKeyDown, 'ArrowRight', { ctrl: true });
      expect(p.setActiveCell).toHaveBeenCalledWith({ rowIndex: 1, columnIndex: 1 });
    });

    it('Ctrl+Right at right edge stays put', () => {
      const p = makeCtrlParams(0, 2);
      const { result } = renderHook(() => useKeyboardNavigation(p));
      fireKey(result.current.handleGridKeyDown, 'ArrowRight', { ctrl: true });
      expect(p.setActiveCell).toHaveBeenCalledWith({ rowIndex: 0, columnIndex: 2 });
    });

    // --- Ctrl+Left ---
    it('Ctrl+Left from non-empty cell scans to left edge when all non-empty', () => {
      // Row 0: A(col0), 1(col1), X(col2) — all non-empty → from col2, jumps to col0 (edge)
      const p = makeCtrlParams(0, 2);
      const { result } = renderHook(() => useKeyboardNavigation(p));
      fireKey(result.current.handleGridKeyDown, 'ArrowLeft', { ctrl: true });
      expect(p.setActiveCell).toHaveBeenCalledWith({ rowIndex: 0, columnIndex: 0 });
    });

    it('Ctrl+Left from empty cell jumps to next non-empty on the left', () => {
      // Row 1: B(col0), 2(col1), ''(col2) → from col2, should land on col1
      const p = makeCtrlParams(1, 2);
      const { result } = renderHook(() => useKeyboardNavigation(p));
      fireKey(result.current.handleGridKeyDown, 'ArrowLeft', { ctrl: true });
      expect(p.setActiveCell).toHaveBeenCalledWith({ rowIndex: 1, columnIndex: 1 });
    });

    it('Ctrl+Left at left edge stays put', () => {
      const p = makeCtrlParams(0, 0);
      const { result } = renderHook(() => useKeyboardNavigation(p));
      fireKey(result.current.handleGridKeyDown, 'ArrowLeft', { ctrl: true });
      expect(p.setActiveCell).toHaveBeenCalledWith({ rowIndex: 0, columnIndex: 0 });
    });

    // --- Ctrl+Shift+Arrow (extend selection) ---
    it('Ctrl+Shift+Down extends selection to the ctrl-target row', () => {
      // col0: A(0), B(1), C(2), ''(3) → from row 0, ctrl-target = row 2
      const p = makeCtrlParams(0, 0);
      const { result } = renderHook(() => useKeyboardNavigation(p));
      fireKey(result.current.handleGridKeyDown, 'ArrowDown', { ctrl: true, shift: true });
      expect(p.setActiveCell).toHaveBeenCalledWith({ rowIndex: 2, columnIndex: 0 });
      expect(p.setSelectionRange).toHaveBeenCalledWith(
        expect.objectContaining({ startRow: 0, endRow: 2 })
      );
    });

    it('Ctrl+Shift+Right extends selection to the ctrl-target column', () => {
      // Row 0: A, 1, X — all non-empty → from col0, ctrl-target = col2
      const p = makeCtrlParams(0, 0);
      const { result } = renderHook(() => useKeyboardNavigation(p));
      fireKey(result.current.handleGridKeyDown, 'ArrowRight', { ctrl: true, shift: true });
      expect(p.setActiveCell).toHaveBeenCalledWith({ rowIndex: 0, columnIndex: 2 });
      expect(p.setSelectionRange).toHaveBeenCalledWith(
        expect.objectContaining({ startCol: 0, endCol: 2 })
      );
    });

    // --- Column with all empties in the middle ---
    it('Ctrl+Down in column with gap skips empties to next non-empty', () => {
      // col2: X(0), ''(1), ''(2), ''(3), Y(4), Z(5) → from row 1 (empty), should land on row 4
      const p = makeCtrlParams(1, 2);
      const { result } = renderHook(() => useKeyboardNavigation(p));
      fireKey(result.current.handleGridKeyDown, 'ArrowDown', { ctrl: true });
      expect(p.setActiveCell).toHaveBeenCalledWith({ rowIndex: 4, columnIndex: 2 });
    });
  });
});
