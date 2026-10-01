import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { useClipboard } from '../useClipboard';

describe('useClipboard', () => {
  const items = [
    { id: '1', name: 'Alice', score: 10 },
    { id: '2', name: 'Bob', score: 20 },
  ];
  const visibleCols = [
    { columnId: 'name', name: 'Name' },
    { columnId: 'score', name: 'Score' },
  ] as import('../../types').IColumnDef<{ id: string; name: string; score: number }>[];

  let writeTextMock: jest.Mock;
  let readTextMock: jest.Mock;

  beforeEach(() => {
    writeTextMock = jest.fn().mockResolvedValue(undefined);
    readTextMock = jest.fn().mockResolvedValue('');
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock, readText: readTextMock },
      writable: true,
      configurable: true,
    });
  });

  it('returns handleCopy, handleCut, handlePaste, cutRange and copyRange', () => {
    const { result } = renderHook(() =>
      useClipboard({
        items,
        visibleCols,
        colOffset: 0,
        selectionRange: null,
        activeCell: null,
        onCellValueChanged: undefined,
      })
    );

    expect(typeof result.current.handleCopy).toBe('function');
    expect(typeof result.current.handleCut).toBe('function');
    expect(typeof result.current.handlePaste).toBe('function');
    expect(result.current.cutRange).toBeNull();
  });

  it('handleCopy with no selection and no activeCell does nothing', () => {
    const { result } = renderHook(() =>
      useClipboard({
        items,
        visibleCols,
        colOffset: 0,
        selectionRange: null,
        activeCell: null,
        onCellValueChanged: undefined,
      })
    );

    act(() => {
      result.current.handleCopy();
    });

    expect(writeTextMock).not.toHaveBeenCalled();
  });

  it('handleCopy with activeCell writes single cell as TSV', () => {
    const { result } = renderHook(() =>
      useClipboard({
        items,
        visibleCols,
        colOffset: 0,
        selectionRange: null,
        activeCell: { rowIndex: 0, columnIndex: 0 },
        onCellValueChanged: undefined,
      })
    );

    act(() => {
      result.current.handleCopy();
    });

    // Single cell (row 0, col 0)  to  only first column value
    expect(writeTextMock).toHaveBeenCalledWith('Alice');
  });

  it('handleCut without onCellValueChanged does not call handleCopy', () => {
    const { result } = renderHook(() =>
      useClipboard({
        items,
        visibleCols,
        colOffset: 0,
        selectionRange: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
        activeCell: null,
        onCellValueChanged: undefined,
      })
    );

    act(() => {
      result.current.handleCut();
    });

    expect(writeTextMock).not.toHaveBeenCalled();
    expect(result.current.cutRange).toBeNull();
  });

  it('handleCut with onCellValueChanged sets cutRange and calls handleCopy', () => {
    const onCellValueChanged = jest.fn();
    const { result } = renderHook(() =>
      useClipboard({
        items,
        visibleCols,
        colOffset: 0,
        selectionRange: { startRow: 0, startCol: 0, endRow: 0, endCol: 1 },
        activeCell: null,
        onCellValueChanged,
      })
    );

    act(() => {
      result.current.handleCut();
    });

    expect(writeTextMock).toHaveBeenCalled();
    expect(result.current.cutRange).toEqual({
      startRow: 0,
      startCol: 0,
      endRow: 0,
      endCol: 1,
    });
  });

  it('handlePaste without onCellValueChanged returns early without reading clipboard', async () => {
    readTextMock.mockResolvedValue('X\t99');
    const { result } = renderHook(() =>
      useClipboard({
        items,
        visibleCols,
        colOffset: 0,
        selectionRange: null,
        activeCell: { rowIndex: 0, columnIndex: 0 },
        onCellValueChanged: undefined,
      })
    );

    await act(async () => {
      await result.current.handlePaste();
    });

    expect(readTextMock).not.toHaveBeenCalled();
  });

  it('handlePaste with text and onCellValueChanged fires for each cell', async () => {
    readTextMock.mockResolvedValue('NewName\t42');
    const onCellValueChanged = jest.fn();
    const editableCols = visibleCols.map((c) => ({ ...c, editable: true as const }));
    const { result } = renderHook(() =>
      useClipboard({
        items,
        visibleCols: editableCols,
        colOffset: 0,
        selectionRange: null,
        activeCell: { rowIndex: 0, columnIndex: 0 },
        onCellValueChanged,
      })
    );

    await act(async () => {
      await result.current.handlePaste();
    });

    expect(onCellValueChanged).toHaveBeenCalledTimes(2);
    expect(onCellValueChanged).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        columnId: 'name',
        newValue: 'NewName',
        rowIndex: 0,
      })
    );
    expect(onCellValueChanged).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        columnId: 'score',
        newValue: '42',
        rowIndex: 0,
      })
    );
  });

  describe('paste validation (valueParser)', () => {
    type Item = { id: string; name: string; score: number; status: string };
    const editableItems: Item[] = [
      { id: '1', name: 'Alice', score: 10, status: 'Active' },
      { id: '2', name: 'Bob', score: 20, status: 'Closed' },
    ];

    it('skips cells when valueParser returns undefined (rejects)', async () => {
      readTextMock.mockResolvedValue('Alice\tnotanumber');
      const onCellValueChanged = jest.fn();
      const cols = [
        { columnId: 'name', name: 'Name', editable: true },
        {
          columnId: 'score',
          name: 'Score',
          editable: true,
          valueParser: ({ newValue }: { newValue: unknown }) => {
            const n = Number(newValue);
            return Number.isNaN(n) ? undefined : n;
          },
        },
      ] as import('../../types').IColumnDef<Item>[];

      const { result } = renderHook(() =>
        useClipboard({
          items: editableItems,
          visibleCols: cols,
          colOffset: 0,
          selectionRange: null,
          activeCell: { rowIndex: 0, columnIndex: 0 },
          onCellValueChanged,
        })
      );

      await act(async () => {
        await result.current.handlePaste();
      });

      // name column passes through (no parser); score rejects 'notanumber'
      expect(onCellValueChanged).toHaveBeenCalledTimes(1);
      expect(onCellValueChanged).toHaveBeenCalledWith(
        expect.objectContaining({ columnId: 'name', newValue: 'Alice' })
      );
    });

    it('uses parsed value from valueParser', async () => {
      readTextMock.mockResolvedValue('42');
      const onCellValueChanged = jest.fn();
      const cols = [
        {
          columnId: 'score',
          name: 'Score',
          editable: true,
          valueParser: ({ newValue }: { newValue: unknown }) => Number(newValue),
        },
      ] as import('../../types').IColumnDef<Item>[];

      const { result } = renderHook(() =>
        useClipboard({
          items: editableItems,
          visibleCols: cols,
          colOffset: 0,
          selectionRange: null,
          activeCell: { rowIndex: 0, columnIndex: 0 },
          onCellValueChanged,
        })
      );

      await act(async () => {
        await result.current.handlePaste();
      });

      expect(onCellValueChanged).toHaveBeenCalledTimes(1);
      expect(onCellValueChanged).toHaveBeenCalledWith(
        expect.objectContaining({ columnId: 'score', newValue: 42 })
      );
    });

    it('auto-validates select columns and rejects invalid options', async () => {
      readTextMock.mockResolvedValue('InvalidStatus');
      const onCellValueChanged = jest.fn();
      const cols = [
        {
          columnId: 'status',
          name: 'Status',
          editable: true,
          cellEditor: 'select' as const,
          cellEditorParams: { values: ['Active', 'Closed'] },
        },
      ] as import('../../types').IColumnDef<Item>[];

      const { result } = renderHook(() =>
        useClipboard({
          items: editableItems,
          visibleCols: cols,
          colOffset: 0,
          selectionRange: null,
          activeCell: { rowIndex: 0, columnIndex: 0 },
          onCellValueChanged,
        })
      );

      await act(async () => {
        await result.current.handlePaste();
      });

      expect(onCellValueChanged).not.toHaveBeenCalled();
    });

    it('auto-validates select columns with case-insensitive match', async () => {
      readTextMock.mockResolvedValue('active');
      const onCellValueChanged = jest.fn();
      const cols = [
        {
          columnId: 'status',
          name: 'Status',
          editable: true,
          cellEditor: 'select' as const,
          cellEditorParams: { values: ['Active', 'Closed'] },
        },
      ] as import('../../types').IColumnDef<Item>[];

      const { result } = renderHook(() =>
        useClipboard({
          items: editableItems,
          visibleCols: cols,
          colOffset: 0,
          selectionRange: null,
          activeCell: { rowIndex: 0, columnIndex: 0 },
          onCellValueChanged,
        })
      );

      await act(async () => {
        await result.current.handlePaste();
      });

      expect(onCellValueChanged).toHaveBeenCalledTimes(1);
      expect(onCellValueChanged).toHaveBeenCalledWith(
        expect.objectContaining({ columnId: 'status', newValue: 'Active' })
      );
    });
  });

  it('cut then paste onto an overlapping range keeps the pasted values', async () => {
    const rows = [{ id: '1', name: 'a', score: 1 }, { id: '2', name: 'b', score: 2 }, { id: '3', name: 'c', score: 3 }, { id: '4', name: 'd', score: 4 }];
    const cols = [{ columnId: 'name', name: 'Name', editable: true }] as import('../../types').IColumnDef<typeof rows[number]>[];
    const events: { rowIndex: number; newValue: unknown }[] = [];
    let selection = { startRow: 0, startCol: 0, endRow: 2, endCol: 0 };
    const { result, rerender } = renderHook(() =>
      useClipboard({
        items: rows,
        visibleCols: cols,
        colOffset: 0,
        selectionRange: selection,
        activeCell: null,
        editable: true,
        onCellValueChanged: (e) => events.push({ rowIndex: e.rowIndex, newValue: e.newValue }),
      })
    );
    act(() => { result.current.handleCut(); });
    readTextMock.mockResolvedValue('a\r\nb\r\nc\r\n');
    selection = { startRow: 1, startCol: 0, endRow: 1, endCol: 0 };
    rerender();
    await act(async () => { await result.current.handlePaste(); });
    // Paste writes rows 1-3; the cut clears only row 0 (rows 1-2 were pasted over).
    const last = new Map(events.map((e) => [e.rowIndex, e.newValue]));
    expect(last.get(0)).toBe('');
    expect(last.get(1)).toBe('a');
    expect(last.get(2)).toBe('b');
    expect(last.get(3)).toBe('c');
  });

  it('pastes at the top-left of a selection made upward', async () => {
    const events: { rowIndex: number }[] = [];
    const { result } = renderHook(() =>
      useClipboard({
        items,
        visibleCols: [{ columnId: 'name', name: 'Name', editable: true }] as typeof visibleCols,
        colOffset: 0,
        selectionRange: { startRow: 1, startCol: 0, endRow: 0, endCol: 0 },
        activeCell: null,
        editable: true,
        onCellValueChanged: (e) => events.push({ rowIndex: e.rowIndex }),
      })
    );
    readTextMock.mockResolvedValue('x');
    await act(async () => { await result.current.handlePaste(); });
    expect(events.map((e) => e.rowIndex)).toEqual([0]);
  });

  it('copy does not throw when navigator.clipboard is unavailable (non-secure context)', () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, writable: true, configurable: true });
    const { result } = renderHook(() =>
      useClipboard({
        items,
        visibleCols,
        colOffset: 0,
        selectionRange: null,
        activeCell: { rowIndex: 0, columnIndex: 0 },
        onCellValueChanged: undefined,
      })
    );
    expect(() => act(() => { result.current.handleCopy(); })).not.toThrow();
  });

  describe('cut/paste identity and clipboard source (S02, S03, S04, S06)', () => {
    type Row = { id: string; name: string };
    const mkRows = (): Row[] => [
      { id: '1', name: 'a' },
      { id: '2', name: 'b' },
      { id: '3', name: 'c' },
    ];
    const cols = [{ columnId: 'name', name: 'Name', editable: true }] as import('../../types').IColumnDef<Row>[];

    function setup(initialRows: Row[], onClipboardError?: (error: unknown) => void) {
      const events: { rowIndex: number; newValue: unknown; item: Row }[] = [];
      const state = { rows: initialRows, selection: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 } };
      const hook = renderHook(() =>
        useClipboard<Row>({
          items: state.rows,
          visibleCols: cols,
          colOffset: 0,
          selectionRange: state.selection,
          activeCell: null,
          editable: true,
          getRowId: (r) => r.id,
          onClipboardError,
          onCellValueChanged: (e) => events.push({ rowIndex: e.rowIndex, newValue: e.newValue, item: e.item }),
        }),
      );
      return { events, state, ...hook };
    }

    it('clears the cut row by id after the rows are re-sorted before paste (S03)', async () => {
      const { events, state, result, rerender } = setup(mkRows());
      act(() => { result.current.handleCut(); }); // cuts row id 1 at index 0
      const text = writeTextMock.mock.calls[0]![0] as string;
      readTextMock.mockResolvedValue(text);
      const [r1, r2, r3] = state.rows as [Row, Row, Row];
      state.rows = [r3, r2, r1]; // sort/page change: id 1 now at index 2
      state.selection = { startRow: 1, startCol: 0, endRow: 1, endCol: 0 };
      rerender();
      await act(async () => { await result.current.handlePaste(); });
      const cleared = events.filter((e) => e.newValue === '');
      expect(cleared).toHaveLength(1);
      expect(cleared[0]!.item.id).toBe('1');
      expect(cleared[0]!.rowIndex).toBe(2);
    });

    it('a later copy cancels the pending cut (S02)', async () => {
      const { events, state, result, rerender } = setup(mkRows());
      act(() => { result.current.handleCut(); });
      expect(result.current.cutRange).not.toBeNull();
      state.selection = { startRow: 2, startCol: 0, endRow: 2, endCol: 0 };
      rerender();
      act(() => { result.current.handleCopy(); });
      expect(result.current.cutRange).toBeNull();
      readTextMock.mockResolvedValue('c');
      state.selection = { startRow: 1, startCol: 0, endRow: 1, endCol: 0 };
      rerender();
      await act(async () => { await result.current.handlePaste(); });
      expect(events.some((e) => e.newValue === '' && e.rowIndex === 0)).toBe(false);
    });

    it('does not clear the cut cells when the pasted text came from elsewhere (S02)', async () => {
      const { events, state, result, rerender } = setup(mkRows());
      act(() => { result.current.handleCut(); });
      readTextMock.mockResolvedValue('copied in another app');
      state.selection = { startRow: 1, startCol: 0, endRow: 1, endCol: 0 };
      rerender();
      await act(async () => { await result.current.handlePaste(); });
      expect(events.map((e) => e.newValue)).toEqual(['copied in another app']);
      expect(result.current.cutRange).toBeNull();
    });

    it('still clears the cut when the clipboard returns it with other line endings and a trailing newline (S02)', async () => {
      const { events, state, result, rerender } = setup(mkRows());
      state.selection = { startRow: 0, startCol: 0, endRow: 1, endCol: 0 };
      rerender();
      act(() => { result.current.handleCut(); });
      const text = writeTextMock.mock.calls[0]![0] as string;
      expect(text).toBe('a\r\nb');
      readTextMock.mockResolvedValue('a\nb\n'); // line endings rewritten by the OS clipboard
      state.selection = { startRow: 2, startCol: 0, endRow: 2, endCol: 0 };
      rerender();
      await act(async () => { await result.current.handlePaste(); });
      expect(events.filter((e) => e.newValue === '').map((e) => e.item.id)).toEqual(['1', '2']);
    });

    it('does not paste the stale internal copy when the clipboard read is rejected (S06)', async () => {
      const onClipboardError = jest.fn();
      const { events, state, result, rerender } = setup(mkRows(), onClipboardError);
      act(() => { result.current.handleCopy(); }); // internal clipboard = 'a'
      readTextMock.mockRejectedValue(new Error('NotAllowedError'));
      state.selection = { startRow: 1, startCol: 0, endRow: 1, endCol: 0 };
      rerender();
      await act(async () => { await result.current.handlePaste(); });
      expect(events).toHaveLength(0);
      expect(onClipboardError).toHaveBeenCalledTimes(1);
    });

    it('pastes under React.StrictMode (S04)', async () => {
      const events: unknown[] = [];
      const rows = mkRows();
      readTextMock.mockResolvedValue('zzz');
      const { result } = renderHook(
        () =>
          useClipboard<Row>({
            items: rows,
            visibleCols: cols,
            colOffset: 0,
            selectionRange: null,
            activeCell: { rowIndex: 0, columnIndex: 0 },
            editable: true,
            onCellValueChanged: (e) => events.push(e),
          }),
        { wrapper: React.StrictMode },
      );
      await act(async () => { await result.current.handlePaste(); });
      expect(events).toHaveLength(1);
    });
  });

  describe('cut and paste of formula cells (S02/S03 + K07)', () => {
    type Row = { id: string; name: string };
    const cols = [{ columnId: 'name', name: 'Name', editable: true }] as import('../../types').IColumnDef<Row>[];

    function setup() {
      const formulas = new Map<string, string>([['0,0', '=B1']]);
      const events: { rowIndex: number; newValue: unknown }[] = [];
      const state = { selection: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 } };
      const hook = renderHook(() =>
        useClipboard<Row>({
          items: [{ id: '1', name: '' }, { id: '2', name: '' }],
          visibleCols: cols,
          colOffset: 0,
          selectionRange: state.selection,
          activeCell: null,
          editable: true,
          getRowId: (r) => r.id,
          onCellValueChanged: (e) => events.push({ rowIndex: e.rowIndex, newValue: e.newValue }),
          formulas: true,
          flatColumns: cols,
          getFormula: (col, row) => formulas.get(`${col},${row}`),
          hasFormula: (col, row) => formulas.has(`${col},${row}`),
          setFormula: (col, row, formula) => {
            if (formula) formulas.set(`${col},${row}`, formula);
            else formulas.delete(`${col},${row}`);
          },
        }),
      );
      return { formulas, events, state, ...hook };
    }

    it('pasting a cut formula back onto its own cell keeps it (no cut-clear over the pasted formula)', async () => {
      const { formulas, events, result } = setup();
      act(() => { result.current.handleCut(); });
      const text = writeTextMock.mock.calls[0]![0] as string;
      expect(text).toBe('=B1');
      readTextMock.mockResolvedValue(text);
      await act(async () => { await result.current.handlePaste(); });
      expect(formulas.get('0,0')).toBe('=B1');
      expect(events.filter((e) => e.rowIndex === 0)).toEqual([]);
    });

    it('pasting a cut formula elsewhere clears the cut source', async () => {
      const { formulas, events, state, result, rerender } = setup();
      act(() => { result.current.handleCut(); });
      readTextMock.mockResolvedValue(writeTextMock.mock.calls[0]![0] as string);
      state.selection = { startRow: 1, startCol: 0, endRow: 1, endCol: 0 };
      rerender();
      await act(async () => { await result.current.handlePaste(); });
      expect(formulas.has('0,1')).toBe(true);
      expect(events.filter((e) => e.rowIndex === 0)).toEqual([{ rowIndex: 0, newValue: '' }]);
    });
  });
});
