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

    // Single cell (row 0, col 0) → only first column value
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
});
