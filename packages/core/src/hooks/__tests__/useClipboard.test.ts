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

  it('returns handleCopy, handleCut, handlePaste, cutRangeRef and cutRange', () => {
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
    expect(result.current.cutRangeRef).toHaveProperty('current');
    expect(result.current.cutRangeRef.current).toBeNull();
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
    expect(result.current.cutRangeRef.current).toBeNull();
  });

  it('handleCut with onCellValueChanged sets cutRangeRef and calls handleCopy', () => {
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
    expect(result.current.cutRangeRef.current).toEqual({
      startRow: 0,
      startCol: 0,
      endRow: 0,
      endCol: 1,
    });
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
    const { result } = renderHook(() =>
      useClipboard({
        items,
        visibleCols,
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
});
