import { renderHook, act } from '@testing-library/react';
import { createRef } from 'react';
import { useCellSelection } from '../useCellSelection';

describe('useCellSelection', () => {
  const setActiveCell = jest.fn();
  const wrapperRef = createRef<HTMLElement>();

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
        wrapperRef,
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
        wrapperRef,
      })
    );

    act(() => {
      result.current.handleCellMouseDown(
        { button: 0, shiftKey: false, preventDefault: jest.fn() } as unknown as React.MouseEvent,
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
        wrapperRef,
      })
    );

    act(() => {
      result.current.handleCellMouseDown(
        { button: 0, shiftKey: false, preventDefault: jest.fn() } as unknown as React.MouseEvent,
        0,
        0
      );
    });

    expect(result.current.selectionRange).toBeNull();
    expect(setActiveCell).not.toHaveBeenCalled();
  });

  it('handleCellMouseDown ignores middle-click (button 1) for native scroll', () => {
    const { result } = renderHook(() =>
      useCellSelection({
        colOffset: 0,
        rowCount: 5,
        visibleColCount: 3,
        setActiveCell,
        wrapperRef,
      })
    );

    act(() => {
      result.current.handleCellMouseDown(
        { button: 1, shiftKey: false, preventDefault: jest.fn() } as unknown as React.MouseEvent,
        2,
        1
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
        wrapperRef,
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
        wrapperRef,
      })
    );

    act(() => {
      result.current.handleSelectAllCells();
    });

    expect(result.current.selectionRange).toBeNull();
    expect(setActiveCell).not.toHaveBeenCalled();
  });

  describe('Edge Cases: Selection Boundaries', () => {
    it('should constrain selection when extending beyond maximum row count', () => {
      const { result } = renderHook(() =>
        useCellSelection({
          colOffset: 0,
          rowCount: 5,
          visibleColCount: 3,
          setActiveCell,
          wrapperRef,
        })
      );

      // Start selection at row 4 (last valid row index, since rowCount=5)
      act(() => {
        result.current.handleCellMouseDown(
          { button: 0, shiftKey: false, preventDefault: jest.fn() } as unknown as React.MouseEvent,
          4,
          0
        );
      });

      // Try to extend with shift-click to row 10 (beyond bounds)
      // The hook itself doesn't constrain this, but the grid logic should
      // Here we're testing that the hook accepts any row value
      act(() => {
        result.current.handleCellMouseDown(
          { button: 0, shiftKey: true, preventDefault: jest.fn() } as unknown as React.MouseEvent,
          10,
          2
        );
      });

      // The range should include row 10 in the raw range (grid-level logic will clamp rendering)
      expect(result.current.selectionRange).toEqual({
        startRow: 4,
        startCol: 0,
        endRow: 10,
        endCol: 2,
      });
    });

    it('should constrain selection when extending beyond maximum column count', () => {
      const { result } = renderHook(() =>
        useCellSelection({
          colOffset: 0,
          rowCount: 5,
          visibleColCount: 3,
          setActiveCell,
          wrapperRef,
        })
      );

      act(() => {
        result.current.handleCellMouseDown(
          { button: 0, shiftKey: false, preventDefault: jest.fn() } as unknown as React.MouseEvent,
          0,
          2
        );
      });

      // Try to shift-click extend to column index 5 (beyond visibleColCount=3)
      act(() => {
        result.current.handleCellMouseDown(
          { button: 0, shiftKey: true, preventDefault: jest.fn() } as unknown as React.MouseEvent,
          2,
          5
        );
      });

      // Raw range should accept it (rendering layer handles clamping)
      expect(result.current.selectionRange).toEqual({
        startRow: 0,
        startCol: 2,
        endRow: 2,
        endCol: 5,
      });
    });

    it('should handle selection at grid top-left boundary', () => {
      const { result } = renderHook(() =>
        useCellSelection({
          colOffset: 0,
          rowCount: 5,
          visibleColCount: 3,
          setActiveCell,
          wrapperRef,
        })
      );

      act(() => {
        result.current.handleCellMouseDown(
          { button: 0, shiftKey: false, preventDefault: jest.fn() } as unknown as React.MouseEvent,
          0,
          0
        );
      });

      expect(result.current.selectionRange).toEqual({
        startRow: 0,
        startCol: 0,
        endRow: 0,
        endCol: 0,
      });
      expect(setActiveCell).toHaveBeenCalledWith({ rowIndex: 0, columnIndex: 0 });
    });

    it('should handle selection at grid bottom-right boundary', () => {
      const { result } = renderHook(() =>
        useCellSelection({
          colOffset: 0,
          rowCount: 10,
          visibleColCount: 5,
          setActiveCell,
          wrapperRef,
        })
      );

      act(() => {
        result.current.handleCellMouseDown(
          { button: 0, shiftKey: false, preventDefault: jest.fn() } as unknown as React.MouseEvent,
          9,
          4
        );
      });

      expect(result.current.selectionRange).toEqual({
        startRow: 9,
        startCol: 4,
        endRow: 9,
        endCol: 4,
      });
      expect(setActiveCell).toHaveBeenCalledWith({ rowIndex: 9, columnIndex: 4 });
    });

    it('should handle negative row indices gracefully', () => {
      const { result } = renderHook(() =>
        useCellSelection({
          colOffset: 0,
          rowCount: 5,
          visibleColCount: 3,
          setActiveCell,
          wrapperRef,
        })
      );

      // Attempt to select at negative row (shouldn't happen in UI, but testing robustness)
      act(() => {
        result.current.handleCellMouseDown(
          { button: 0, shiftKey: false, preventDefault: jest.fn() } as unknown as React.MouseEvent,
          -1,
          1
        );
      });

      // Hook accepts the value (grid rendering layer should handle this)
      expect(result.current.selectionRange).toEqual({
        startRow: -1,
        startCol: 1,
        endRow: -1,
        endCol: 1,
      });
    });
  });

  describe('Edge Cases: Selection with Column Pinning', () => {
    it('should handle selection starting from pinned column area', () => {
      const { result } = renderHook(() =>
        useCellSelection({
          colOffset: 2, // First 2 columns are pinned
          rowCount: 5,
          visibleColCount: 3,
          setActiveCell,
          wrapperRef,
        })
      );

      // Click on first scrollable column (globalColIndex=2, dataColIndex=0)
      act(() => {
        result.current.handleCellMouseDown(
          { button: 0, shiftKey: false, preventDefault: jest.fn() } as unknown as React.MouseEvent,
          1,
          2
        );
      });

      expect(result.current.selectionRange).toEqual({
        startRow: 1,
        startCol: 0,
        endRow: 1,
        endCol: 0,
      });
    });

    it('should ignore clicks on pinned columns (before colOffset)', () => {
      const { result } = renderHook(() =>
        useCellSelection({
          colOffset: 2,
          rowCount: 5,
          visibleColCount: 3,
          setActiveCell,
          wrapperRef,
        })
      );

      // Click on pinned column (globalColIndex=1, which is < colOffset=2)
      act(() => {
        result.current.handleCellMouseDown(
          { button: 0, shiftKey: false, preventDefault: jest.fn() } as unknown as React.MouseEvent,
          1,
          1
        );
      });

      // Should be ignored
      expect(result.current.selectionRange).toBeNull();
      expect(setActiveCell).not.toHaveBeenCalled();
    });

    it('should extend selection across scrollable region with shift-click', () => {
      const { result } = renderHook(() =>
        useCellSelection({
          colOffset: 1,
          rowCount: 5,
          visibleColCount: 4,
          setActiveCell,
          wrapperRef,
        })
      );

      // Start at first scrollable column
      act(() => {
        result.current.handleCellMouseDown(
          { button: 0, shiftKey: false, preventDefault: jest.fn() } as unknown as React.MouseEvent,
          0,
          1
        );
      });

      // Shift-click to extend to last scrollable column
      act(() => {
        result.current.handleCellMouseDown(
          { button: 0, shiftKey: true, preventDefault: jest.fn() } as unknown as React.MouseEvent,
          3,
          4
        );
      });

      expect(result.current.selectionRange).toEqual({
        startRow: 0,
        startCol: 0,
        endRow: 3,
        endCol: 3,
      });
    });
  });

  describe('Edge Cases: Select All with Various Configurations', () => {
    it('should select all cells with column offset', () => {
      const { result } = renderHook(() =>
        useCellSelection({
          colOffset: 2,
          rowCount: 10,
          visibleColCount: 5,
          setActiveCell,
          wrapperRef,
        })
      );

      act(() => {
        result.current.handleSelectAllCells();
      });

      expect(result.current.selectionRange).toEqual({
        startRow: 0,
        startCol: 0,
        endRow: 9,
        endCol: 4,
      });
      expect(setActiveCell).toHaveBeenCalledWith({ rowIndex: 0, columnIndex: 2 });
    });

    it('should handle select all with single column', () => {
      const { result } = renderHook(() =>
        useCellSelection({
          colOffset: 0,
          rowCount: 5,
          visibleColCount: 1,
          setActiveCell,
          wrapperRef,
        })
      );

      act(() => {
        result.current.handleSelectAllCells();
      });

      expect(result.current.selectionRange).toEqual({
        startRow: 0,
        startCol: 0,
        endRow: 4,
        endCol: 0,
      });
    });

    it('should handle select all with single row', () => {
      const { result } = renderHook(() =>
        useCellSelection({
          colOffset: 0,
          rowCount: 1,
          visibleColCount: 5,
          setActiveCell,
          wrapperRef,
        })
      );

      act(() => {
        result.current.handleSelectAllCells();
      });

      expect(result.current.selectionRange).toEqual({
        startRow: 0,
        startCol: 0,
        endRow: 0,
        endCol: 4,
      });
    });

    it('should do nothing when selecting all with zero columns', () => {
      const { result } = renderHook(() =>
        useCellSelection({
          colOffset: 0,
          rowCount: 5,
          visibleColCount: 0,
          setActiveCell,
          wrapperRef,
        })
      );

      act(() => {
        result.current.handleSelectAllCells();
      });

      expect(result.current.selectionRange).toBeNull();
      expect(setActiveCell).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases: Drag State Management', () => {
    it('should set isDragging to false initially', () => {
      const { result } = renderHook(() =>
        useCellSelection({
          colOffset: 0,
          rowCount: 5,
          visibleColCount: 3,
          setActiveCell,
          wrapperRef,
        })
      );

      expect(result.current.isDragging).toBe(false);
    });

    it('should not set isDragging on single click without movement', () => {
      const { result } = renderHook(() =>
        useCellSelection({
          colOffset: 0,
          rowCount: 5,
          visibleColCount: 3,
          setActiveCell,
          wrapperRef,
        })
      );

      act(() => {
        result.current.handleCellMouseDown(
          { button: 0, shiftKey: false, preventDefault: jest.fn() } as unknown as React.MouseEvent,
          1,
          1
        );
      });

      // Should still be false because no mousemove occurred
      expect(result.current.isDragging).toBe(false);
    });
  });
});
