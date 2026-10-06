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
      handleCopyEvent: (overrides.handleCopyEvent !== undefined ? overrides.handleCopyEvent : jest.fn()) as jest.Mock,
      handleCutEvent: (overrides.handleCutEvent !== undefined ? overrides.handleCutEvent : jest.fn()) as jest.Mock,
      handlePaste: (overrides.handlePaste !== undefined ? overrides.handlePaste : jest.fn().mockResolvedValue(undefined)) as jest.Mock,
      handlePasteEvent: (overrides.handlePasteEvent !== undefined ? overrides.handlePasteEvent : jest.fn()) as jest.Mock,
      setContextMenu: (overrides.setContextMenu !== undefined ? overrides.setContextMenu : jest.fn()) as jest.Mock,
      onUndo: overrides.onUndo as (() => void) | undefined,
      onRedo: overrides.onRedo as (() => void) | undefined,
      clearClipboardRanges: overrides.clearClipboardRanges as (() => void) | undefined,
      beginBatch: overrides.beginBatch as (() => void) | undefined,
      endBatch: overrides.endBatch as (() => void) | undefined,
    },
    features: {
      editable: (overrides.editable !== undefined ? overrides.editable : false) as boolean,
      onCellValueChanged: overrides.onCellValueChanged as any,
      rowSelection: (overrides.rowSelection !== undefined ? overrides.rowSelection : 'none' as const) as any,
      wrapperRef: (overrides.wrapperRef !== undefined ? overrides.wrapperRef : wrapperRef) as typeof wrapperRef,
      scrollToIndexRef: overrides.scrollToIndexRef as { current: ((index: number, align?: 'auto' | 'start' | 'center' | 'end') => void) | null } | undefined,
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

  it('Ctrl/Cmd+C and Ctrl/Cmd+X are left to the browser so the native copy/cut event follows', () => {
    const handleCopyEvent = jest.fn();
    const handleCutEvent = jest.fn();
    const { result } = renderHook(() =>
      useKeyboardNavigation(makeParams({ activeCell: { rowIndex: 0, columnIndex: 0 }, handleCopyEvent, handleCutEvent }))
    );

    for (const [key, ctrlKey, metaKey] of [['c', true, false], ['C', false, true], ['x', true, false], ['x', false, true]] as const) {
      const e = { key, preventDefault: jest.fn(), ctrlKey, metaKey, shiftKey: false } as unknown as React.KeyboardEvent;
      act(() => {
        result.current.handleGridKeyDown(e);
      });
      expect(e.preventDefault).not.toHaveBeenCalled();
    }
    expect(handleCopyEvent).not.toHaveBeenCalled();
    expect(handleCutEvent).not.toHaveBeenCalled();
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
    it('ignores spacer rows and recomputes page size after resize and row-height changes', () => {
      const wrapper = document.createElement('div');
      wrapper.setAttribute('data-virtual-scroll', '');
      wrapper.innerHTML = '<table><thead></thead><tbody><tr></tr><tr data-row-id="0"></tr></tbody></table>';
      const spacer = wrapper.querySelector('tbody tr')!;
      const row = wrapper.querySelector('tr[data-row-id]')!;
      Object.defineProperty(spacer, 'offsetHeight', { value: 10_000 });
      Object.defineProperty(row, 'offsetHeight', { value: 36, configurable: true });
      Object.defineProperty(wrapper, 'clientHeight', { value: 264, configurable: true });
      wrapper.querySelector('thead')!.getBoundingClientRect = () => ({ height: 48 }) as DOMRect;
      wrapper.scrollTop = 10_000;
      const params = makeParams({
        items: Array.from({ length: 100 }, (_, i) => ({ id: String(i), name: `Row ${i}` })),
        activeCell: { rowIndex: 0, columnIndex: 0 },
        wrapperRef: { current: wrapper },
      });
      const { result } = renderHook(() => useKeyboardNavigation(params));
      firePgKey(result.current.handleGridKeyDown, 'PageDown');
      expect(params.handlers.setActiveCell).toHaveBeenLastCalledWith({ rowIndex: 6, columnIndex: 0 });
      Object.defineProperty(wrapper, 'clientHeight', { value: 408 });
      Object.defineProperty(row, 'offsetHeight', { value: 48 });
      firePgKey(result.current.handleGridKeyDown, 'PageDown');
      expect(params.handlers.setActiveCell).toHaveBeenLastCalledWith({ rowIndex: 7, columnIndex: 0 });
      expect(wrapper.scrollTop).toBe(10_000);
    });
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

    it('Shift+PageDown in a virtual grid scrolls the moving end into view by index', () => {
      // The anchor (active cell) doesn't move, so useActiveCell won't scroll;
      // the far row of a virtual grid isn't rendered, so it must scroll by index.
      const wrapper = document.createElement('div');
      wrapper.setAttribute('data-virtual-scroll', '');
      wrapper.scrollTop = 0;
      const scrollToIndex = jest.fn();
      const p = makeParams({
        items: pgItems,
        visibleCols: pgCols,
        visibleColumnCount: 1,
        activeCell: { rowIndex: 2, columnIndex: 0 },
        getRowId: (item: PgItem) => item.id,
        wrapperRef: { current: wrapper },
        scrollToIndexRef: { current: scrollToIndex },
      });
      const { result } = renderHook(() => useKeyboardNavigation(p));
      firePgKey(result.current.handleGridKeyDown, 'PageDown', { shift: true });
      expect(p.handlers.setActiveCell).not.toHaveBeenCalled();
      expect(scrollToIndex).toHaveBeenCalledWith(12, 'auto');
      // No pixel scroll on the (possibly scaled) virtual container.
      expect(wrapper.scrollTop).toBe(0);
    });

    it('Shift+ArrowDown in a virtual grid scrolls the moving end into view by index', () => {
      const scrollToIndex = jest.fn();
      const p = makeParams({
        items: pgItems,
        visibleCols: pgCols,
        visibleColumnCount: 1,
        activeCell: { rowIndex: 2, columnIndex: 0 },
        selectionRange: { startRow: 2, startCol: 0, endRow: 2, endCol: 0 },
        getRowId: (item: PgItem) => item.id,
        wrapperRef: { current: document.createElement('div') },
        scrollToIndexRef: { current: scrollToIndex },
      });
      const { result } = renderHook(() => useKeyboardNavigation(p));
      firePgKey(result.current.handleGridKeyDown, 'ArrowDown', { shift: true });
      expect(p.handlers.setActiveCell).not.toHaveBeenCalled();
      expect(scrollToIndex).toHaveBeenCalledWith(3, 'auto');
    });

    it('Shift+PageUp extends selection upward', () => {
      const p = makePgParams(14);
      const { result } = renderHook(() => useKeyboardNavigation(p));
      firePgKey(result.current.handleGridKeyDown, 'PageUp', { shift: true });
      expect(p.handlers.setSelectionRange).toHaveBeenCalledWith(
        expect.objectContaining({ startRow: 4, endRow: 14 })
      );
      // The active cell is the anchor and stays put while the range extends.
      expect(p.handlers.setActiveCell).not.toHaveBeenCalled();
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
      expect(p.handlers.setActiveCell).not.toHaveBeenCalled();
      expect(p.handlers.setSelectionRange).toHaveBeenCalledWith(
        expect.objectContaining({ startRow: 0, endRow: 2 })
      );
    });

    it('Ctrl+Shift+Right extends selection to the ctrl-target column', () => {
      // Row 0: A, 1, X  -  all non-empty  to  from col0, ctrl-target = col2
      const p = makeCtrlParams(0, 0);
      const { result } = renderHook(() => useKeyboardNavigation(p));
      fireKey(result.current.handleGridKeyDown, 'ArrowRight', { ctrl: true, shift: true });
      expect(p.handlers.setActiveCell).not.toHaveBeenCalled();
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
  describe('audit regressions', () => {
    const keyEvent = (key: string, mods: { ctrlKey?: boolean; shiftKey?: boolean } = {}) => ({
      key,
      preventDefault: jest.fn(),
      shiftKey: !!mods.shiftKey,
      ctrlKey: !!mods.ctrlKey,
      metaKey: false,
      altKey: false,
    }) as unknown as React.KeyboardEvent;

    it('Ctrl+Shift+Z (key reported as "Z") redoes', () => {
      const onRedo = jest.fn();
      const onUndo = jest.fn();
      const { result } = renderHook(() =>
        useKeyboardNavigation(makeParams({ onRedo, onUndo, activeCell: { rowIndex: 0, columnIndex: 0 } }))
      );
      act(() => { result.current.handleGridKeyDown(keyEvent('Z', { ctrlKey: true, shiftKey: true })); });
      expect(onRedo).toHaveBeenCalledTimes(1);
      expect(onUndo).not.toHaveBeenCalled();
    });

    it('Ctrl+Z with Caps Lock (key "Z", no shift) undoes', () => {
      const onUndo = jest.fn();
      const { result } = renderHook(() =>
        useKeyboardNavigation(makeParams({ onUndo, activeCell: { rowIndex: 0, columnIndex: 0 } }))
      );
      act(() => { result.current.handleGridKeyDown(keyEvent('Z', { ctrlKey: true })); });
      expect(onUndo).toHaveBeenCalledTimes(1);
    });

    it('Delete over a range is one undo batch', () => {
      const calls: string[] = [];
      const { result } = renderHook(() =>
        useKeyboardNavigation(makeParams({
          editable: true,
          visibleCols: [{ columnId: 'name', name: 'Name', editable: true }],
          activeCell: { rowIndex: 0, columnIndex: 0 },
          selectionRange: { startRow: 0, startCol: 0, endRow: 1, endCol: 0 },
          onCellValueChanged: () => calls.push('change'),
          beginBatch: () => calls.push('begin'),
          endBatch: () => calls.push('end'),
        }))
      );
      act(() => { result.current.handleGridKeyDown(keyEvent('Delete')); });
      expect(calls).toEqual(['begin', 'change', 'change', 'end']);
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
        handleCopyEvent: jest.fn(),
        handleCutEvent: jest.fn(),
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
        handleCopyEvent: jest.fn(),
        handleCutEvent: jest.fn(),
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
        handleCopyEvent: jest.fn(),
        handleCutEvent: jest.fn(),
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

describe('useKeyboardNavigation event targets, Tab and anchors', () => {
  type Row = { id: string; name: string };
  const rows: Row[] = Array.from({ length: 8 }, (_, i) => ({ id: String(i), name: `N${i}` }));
  const cols = [
    { columnId: 'name', name: 'Name', editable: true },
    { columnId: 'other', name: 'Other', editable: true },
    { columnId: 'third', name: 'Third', editable: true },
  ] as import('../../types').IColumnDef<Row>[];

  /** Live state: setters write back into `state`, which the hook reads via its params ref. */
  function setup(opts: {
    activeCell?: { rowIndex: number; columnIndex: number } | null;
    selectionRange?: import('../../types').ISelectionRange | null;
    editingCell?: { rowId: string; columnId: string } | null;
    rowSelection?: 'none' | 'single' | 'multiple';
  } = {}) {
    const wrapper = document.createElement('div');
    wrapper.tabIndex = 0;
    wrapper.innerHTML = `
      <table>
        <thead><tr><th><button type="button" data-testid="hdr-btn">Filter</button><input data-testid="hdr-input" /></th></tr></thead>
        <tbody><tr><td><div data-row-index="0" data-col-index="0" tabindex="0"><button type="button" data-testid="cell-btn">x</button></div></td>
        <td><div data-ogrid-cell-editor=""><input data-testid="editor-input" /></div></td></tr></tbody>
      </table>`;
    const portal = document.createElement('div');
    portal.innerHTML = '<input data-testid="portal-input" />';
    document.body.append(wrapper, portal);

    const state = {
      activeCell: opts.activeCell === undefined ? { rowIndex: 3, columnIndex: 1 } : opts.activeCell,
      selectionRange: opts.selectionRange ?? null,
      editingCell: opts.editingCell ?? null,
      selectedRowIds: new Set<string>(),
    };
    const handlers = {
      setActiveCell: jest.fn((c) => { state.activeCell = c; }),
      setSelectionRange: jest.fn((r) => { state.selectionRange = r; }),
      setEditingCell: jest.fn((c) => { state.editingCell = c; }),
      handleRowCheckboxChange: jest.fn(),
      handleCopyEvent: jest.fn(),
      handleCutEvent: jest.fn(),
      handlePaste: jest.fn().mockResolvedValue(undefined),
      handlePasteEvent: jest.fn(),
      setContextMenu: jest.fn(),
    };
    const onCellValueChanged = jest.fn();
    const params = {
      data: { items: rows, visibleCols: cols, colOffset: 0, hasCheckboxCol: false, visibleColumnCount: cols.length, getRowId: (r: Row) => r.id },
      state,
      handlers,
      features: { editable: true, onCellValueChanged, rowSelection: opts.rowSelection ?? 'none', wrapperRef: { current: wrapper } },
    };
    const { result } = renderHook(() => useKeyboardNavigation<Row>(params as never));
    const find = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement;
    const press = (key: string, target: Element = wrapper, mods: { shiftKey?: boolean; ctrlKey?: boolean } = {}) => {
      const e = {
        key, target, currentTarget: wrapper,
        shiftKey: !!mods.shiftKey, ctrlKey: !!mods.ctrlKey, metaKey: false,
        defaultPrevented: false,
        preventDefault: jest.fn(),
      };
      act(() => { result.current.handleGridKeyDown(e as unknown as React.KeyboardEvent); });
      return e;
    };
    const paste = (target: Element = wrapper) => {
      const e = {
        target, currentTarget: wrapper,
        clipboardData: { getData: () => 'pasted' },
        preventDefault: jest.fn(),
      };
      act(() => { result.current.handleGridPaste(e as unknown as React.ClipboardEvent); });
      return e;
    };
    const clipboardEvent = (kind: 'copy' | 'cut', target: Element = wrapper) => {
      const e = {
        target, currentTarget: wrapper,
        clipboardData: { setData: jest.fn() },
        preventDefault: jest.fn(),
      };
      act(() => {
        const handler = kind === 'copy' ? result.current.handleGridCopy : result.current.handleGridCut;
        handler(e as unknown as React.ClipboardEvent);
      });
      return e;
    };
    return { state, handlers, onCellValueChanged, press, paste, clipboardEvent, find, wrapper };
  }

  describe('paste', () => {
    it('Ctrl+V on the grid is left to the browser so the native paste event follows', () => {
      const t = setup();
      const e = t.press('v', t.wrapper, { ctrlKey: true });
      expect(e.preventDefault).not.toHaveBeenCalled();
      expect(t.handlers.handlePaste).not.toHaveBeenCalled();
      expect(t.handlers.handlePasteEvent).not.toHaveBeenCalled();
    });

    it('handleGridPaste hands a paste on the wrapper or a body cell to the clipboard handler', () => {
      const t = setup();
      const onWrapper = t.paste();
      const onCell = t.paste(t.find('cell-btn').parentElement as Element);
      expect(t.handlers.handlePasteEvent).toHaveBeenCalledTimes(2);
      expect(t.handlers.handlePasteEvent).toHaveBeenCalledWith(onWrapper);
      expect(t.handlers.handlePasteEvent).toHaveBeenCalledWith(onCell);
    });

    it('handleGridPaste leaves pastes aimed at an editor, a header input or an open editor alone', () => {
      const t = setup();
      t.paste(t.find('editor-input'));
      t.paste(t.find('hdr-input'));
      t.paste(t.find('portal-input'));
      expect(t.handlers.handlePasteEvent).not.toHaveBeenCalled();

      t.state.editingCell = { rowId: '0', columnId: 'name' };
      const e = t.paste();
      expect(t.handlers.handlePasteEvent).not.toHaveBeenCalled();
      expect(e.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('copy and cut', () => {
    it('handleGridCopy / handleGridCut hand events on the wrapper or a body cell to the clipboard handlers', () => {
      const t = setup();
      const cell = t.find('cell-btn').parentElement as Element;
      const copyOnWrapper = t.clipboardEvent('copy');
      const copyOnCell = t.clipboardEvent('copy', cell);
      const cutOnCell = t.clipboardEvent('cut', cell);
      expect(t.handlers.handleCopyEvent).toHaveBeenCalledTimes(2);
      expect(t.handlers.handleCopyEvent).toHaveBeenCalledWith(copyOnWrapper);
      expect(t.handlers.handleCopyEvent).toHaveBeenCalledWith(copyOnCell);
      expect(t.handlers.handleCutEvent).toHaveBeenCalledTimes(1);
      expect(t.handlers.handleCutEvent).toHaveBeenCalledWith(cutOnCell);
    });

    it('leaves copy/cut aimed at an editor, a header input, a portaled input or an open editor alone', () => {
      const t = setup();
      for (const id of ['editor-input', 'hdr-input', 'portal-input']) {
        t.clipboardEvent('copy', t.find(id));
        t.clipboardEvent('cut', t.find(id));
      }
      t.state.editingCell = { rowId: '0', columnId: 'name' };
      t.clipboardEvent('copy');
      t.clipboardEvent('cut');
      expect(t.handlers.handleCopyEvent).not.toHaveBeenCalled();
      expect(t.handlers.handleCutEvent).not.toHaveBeenCalled();
    });
  });

  describe('ignores keystrokes from outside the cell area', () => {
    it('Backspace typed in a portaled filter input does not clear the selected cells', () => {
      const t = setup({ selectionRange: { startRow: 0, startCol: 0, endRow: 2, endCol: 1 } });
      const e = t.press('Backspace', t.find('portal-input'));
      expect(t.onCellValueChanged).not.toHaveBeenCalled();
      expect(e.preventDefault).not.toHaveBeenCalled();
    });

    it('Delete/Ctrl+X/Ctrl+V/Ctrl+A in a header input stay with the input', () => {
      const t = setup();
      const input = t.find('hdr-input');
      for (const [key, mods] of [['Delete', {}], ['x', { ctrlKey: true }], ['v', { ctrlKey: true }], ['a', { ctrlKey: true }]] as const) {
        const e = t.press(key, input, mods);
        expect(e.preventDefault).not.toHaveBeenCalled();
      }
      expect(t.onCellValueChanged).not.toHaveBeenCalled();
      expect(t.handlers.handleCutEvent).not.toHaveBeenCalled();
      expect(t.handlers.handlePaste).not.toHaveBeenCalled();
      expect(t.handlers.setSelectionRange).not.toHaveBeenCalled();
    });

    it('Enter on a header button is not swallowed by the grid', () => {
      const t = setup();
      const e = t.press('Enter', t.find('hdr-btn'));
      expect(e.preventDefault).not.toHaveBeenCalled();
      expect(t.handlers.setEditingCell).not.toHaveBeenCalled();
    });

    it('still handles keys from the wrapper and from a focused cell', () => {
      const t = setup();
      t.press('Backspace');
      expect(t.onCellValueChanged).toHaveBeenCalledTimes(1);
      const cell = t.wrapper.querySelector('[data-row-index]') as HTMLElement;
      const e = t.press('ArrowDown', cell);
      expect(e.preventDefault).toHaveBeenCalled();
      expect(t.state.activeCell).toEqual({ rowIndex: 4, columnIndex: 1 });
    });

    it('leaves Space/Enter to an in-cell control but still navigates with arrows from it', () => {
      const t = setup({ rowSelection: 'multiple' });
      const btn = t.find('cell-btn');
      expect(t.press('Enter', btn).preventDefault).not.toHaveBeenCalled();
      expect(t.press(' ', btn, { shiftKey: true }).preventDefault).not.toHaveBeenCalled();
      expect(t.handlers.handleRowCheckboxChange).not.toHaveBeenCalled();
      t.press('ArrowRight', btn);
      expect(t.state.activeCell).toEqual({ rowIndex: 3, columnIndex: 2 });
    });
  });

  describe('Tab is not a keyboard trap', () => {
    it('does not capture Tab before a cell is active', () => {
      const t = setup({ activeCell: null });
      const e = t.press('Tab');
      expect(e.preventDefault).not.toHaveBeenCalled();
      expect(t.handlers.setActiveCell).not.toHaveBeenCalled();
    });

    it('lets Tab leave from the last cell and Shift+Tab from the first', () => {
      const last = setup({ activeCell: { rowIndex: 7, columnIndex: 2 } });
      expect(last.press('Tab').preventDefault).not.toHaveBeenCalled();
      expect(last.handlers.setActiveCell).not.toHaveBeenCalled();

      const first = setup({ activeCell: { rowIndex: 0, columnIndex: 0 } });
      expect(first.press('Tab', undefined, { shiftKey: true }).preventDefault).not.toHaveBeenCalled();
      expect(first.handlers.setActiveCell).not.toHaveBeenCalled();
    });

    it('still moves cell to cell inside the grid', () => {
      const t = setup({ activeCell: { rowIndex: 3, columnIndex: 2 } });
      expect(t.press('Tab').preventDefault).toHaveBeenCalled();
      expect(t.state.activeCell).toEqual({ rowIndex: 4, columnIndex: 0 });
    });
  });

  describe('editor key isolation', () => {
    const editing = { rowId: '3', columnId: 'other' };

    it('Home/End/PageUp/PageDown/arrows/Delete from the editor are left to the editor', () => {
      const t = setup({ editingCell: editing });
      const input = t.find('editor-input');
      for (const key of ['Home', 'End', 'PageUp', 'PageDown', 'ArrowLeft', 'Delete', 'Escape']) {
        expect(t.press(key, input).preventDefault).not.toHaveBeenCalled();
      }
      expect(t.handlers.setActiveCell).not.toHaveBeenCalled();
      expect(t.handlers.setSelectionRange).not.toHaveBeenCalled();
      expect(t.handlers.setEditingCell).not.toHaveBeenCalled();
      expect(t.onCellValueChanged).not.toHaveBeenCalled();
    });

    it('Home/End/PageDown from the wrapper do not navigate while a cell is being edited', () => {
      const t = setup({ editingCell: editing });
      for (const key of ['Home', 'End', 'PageDown']) {
        expect(t.press(key).preventDefault).not.toHaveBeenCalled();
      }
      expect(t.handlers.setActiveCell).not.toHaveBeenCalled();
    });

    it('Tab from the editor closes it and moves to the next cell; Shift+Tab moves back', () => {
      const t = setup({ editingCell: editing });
      const e = t.press('Tab', t.find('editor-input'));
      expect(e.preventDefault).toHaveBeenCalled();
      expect(t.handlers.setEditingCell).toHaveBeenCalledWith(null);
      expect(t.state.activeCell).toEqual({ rowIndex: 3, columnIndex: 2 });

      const back = setup({ editingCell: editing });
      back.press('Tab', back.find('editor-input'), { shiftKey: true });
      expect(back.state.activeCell).toEqual({ rowIndex: 3, columnIndex: 0 });
    });
  });

  describe('Shift+Arrow keeps an explicit anchor', () => {
    const single = (r: number, c: number) => ({ startRow: r, startCol: c, endRow: r, endCol: c });

    it('repeated Shift+ArrowUp grows the range upward from the anchor', () => {
      const t = setup({ activeCell: { rowIndex: 5, columnIndex: 1 }, selectionRange: single(5, 1) });
      t.press('ArrowUp', undefined, { shiftKey: true });
      t.press('ArrowUp', undefined, { shiftKey: true });
      t.press('ArrowUp', undefined, { shiftKey: true });
      expect(t.state.selectionRange).toEqual({ startRow: 2, startCol: 1, endRow: 5, endCol: 1 });
      expect(t.state.activeCell).toEqual({ rowIndex: 5, columnIndex: 1 });
    });

    it('repeated Shift+ArrowLeft grows the range leftward from the anchor', () => {
      const t = setup({ activeCell: { rowIndex: 2, columnIndex: 2 }, selectionRange: single(2, 2) });
      t.press('ArrowLeft', undefined, { shiftKey: true });
      t.press('ArrowLeft', undefined, { shiftKey: true });
      expect(t.state.selectionRange).toEqual({ startRow: 2, startCol: 0, endRow: 2, endCol: 2 });
      expect(t.state.activeCell).toEqual({ rowIndex: 2, columnIndex: 2 });
    });

    it('reversing direction shrinks back through the anchor', () => {
      const t = setup({ activeCell: { rowIndex: 5, columnIndex: 1 }, selectionRange: single(5, 1) });
      t.press('ArrowDown', undefined, { shiftKey: true });
      expect(t.state.selectionRange).toEqual({ startRow: 5, startCol: 1, endRow: 6, endCol: 1 });
      t.press('ArrowUp', undefined, { shiftKey: true });
      t.press('ArrowUp', undefined, { shiftKey: true });
      expect(t.state.selectionRange).toEqual({ startRow: 4, startCol: 1, endRow: 5, endCol: 1 });
    });

    it('Shift+PageUp after Shift+ArrowDown extends from the far edge, not the anchor', () => {
      const t = setup({ activeCell: { rowIndex: 6, columnIndex: 0 }, selectionRange: { startRow: 6, startCol: 0, endRow: 7, endCol: 1 } });
      t.press('PageUp', undefined, { shiftKey: true });
      // Fallback page size is 10 → far edge row 7 - 10 clamps to 0; anchor row 6 stays.
      expect(t.state.selectionRange).toEqual({ startRow: 0, startCol: 0, endRow: 6, endCol: 1 });
      expect(t.state.activeCell).toEqual({ rowIndex: 6, columnIndex: 0 });
    });
  });

  describe('row selection by keyboard', () => {
    it('Shift+Space toggles the active row from a data column', () => {
      const t = setup({ rowSelection: 'multiple', activeCell: { rowIndex: 4, columnIndex: 2 } });
      const e = t.press(' ', undefined, { shiftKey: true });
      expect(e.preventDefault).toHaveBeenCalled();
      expect(t.handlers.handleRowCheckboxChange).toHaveBeenCalledWith('4', true, 4, false);
    });

    it('Shift+Space does nothing without row selection', () => {
      const t = setup({ rowSelection: 'none' });
      expect(t.press(' ', undefined, { shiftKey: true }).preventDefault).not.toHaveBeenCalled();
      expect(t.handlers.handleRowCheckboxChange).not.toHaveBeenCalled();
    });
  });
});
