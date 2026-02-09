import { renderHook, act } from '@testing-library/react';
import { useCellSelection } from '../useCellSelection';

describe('useCellSelection', () => {
  const setActiveCell = jest.fn();

  beforeEach(() => {
    setActiveCell.mockClear();
  });

  it('returns selectionRange null and handlers', () => {
    const { result } = renderHook(() =>
      useCellSelection({
        colOffset: 0,
        rowCount: 5,
        visibleColCount: 3,
        setActiveCell,
      })
    );

    expect(result.current.selectionRange).toBeNull();
    expect(typeof result.current.setSelectionRange).toBe('function');
    expect(typeof result.current.handleCellMouseDown).toBe('function');
    expect(typeof result.current.handleSelectAllCells).toBe('function');
  });

  it('handleCellMouseDown without shift sets single-cell range and activeCell', () => {
    const { result } = renderHook(() =>
      useCellSelection({
        colOffset: 0,
        rowCount: 5,
        visibleColCount: 3,
        setActiveCell,
      })
    );

    act(() => {
      result.current.handleCellMouseDown(
        { shiftKey: false, preventDefault: jest.fn() } as unknown as React.MouseEvent,
        2,
        1
      );
    });

    expect(result.current.selectionRange).toEqual({
      startRow: 2,
      startCol: 1,
      endRow: 2,
      endCol: 1,
    });
    expect(setActiveCell).toHaveBeenCalledWith({ rowIndex: 2, columnIndex: 1 });
  });

  it('handleCellMouseDown with globalColIndex < colOffset does nothing', () => {
    const { result } = renderHook(() =>
      useCellSelection({
        colOffset: 1,
        rowCount: 5,
        visibleColCount: 3,
        setActiveCell,
      })
    );

    act(() => {
      result.current.handleCellMouseDown(
        { shiftKey: false, preventDefault: jest.fn() } as unknown as React.MouseEvent,
        0,
        0
      );
    });

    expect(result.current.selectionRange).toBeNull();
    expect(setActiveCell).not.toHaveBeenCalled();
  });

  it('handleSelectAllCells sets full range and activeCell at (0, colOffset)', () => {
    const { result } = renderHook(() =>
      useCellSelection({
        colOffset: 1,
        rowCount: 4,
        visibleColCount: 3,
        setActiveCell,
      })
    );

    act(() => {
      result.current.handleSelectAllCells();
    });

    expect(result.current.selectionRange).toEqual({
      startRow: 0,
      startCol: 0,
      endRow: 3,
      endCol: 2,
    });
    expect(setActiveCell).toHaveBeenCalledWith({ rowIndex: 0, columnIndex: 1 });
  });

  it('handleSelectAllCells with zero rows does nothing', () => {
    const { result } = renderHook(() =>
      useCellSelection({
        colOffset: 0,
        rowCount: 0,
        visibleColCount: 3,
        setActiveCell,
      })
    );

    act(() => {
      result.current.handleSelectAllCells();
    });

    expect(result.current.selectionRange).toBeNull();
    expect(setActiveCell).not.toHaveBeenCalled();
  });
});
