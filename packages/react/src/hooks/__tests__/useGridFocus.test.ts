import { renderHook, act } from '@testing-library/react';
import { useGridFocus } from '../useGridFocus';
import { useRangeSelection } from '../useRangeSelection';

describe('useGridFocus', () => {
  it('starts with no active cell', () => {
    const { result } = renderHook(() =>
      useGridFocus({ rowCount: 5, colCount: 3 }),
    );
    expect(result.current.activeCell).toBeNull();
  });

  it('setActiveCell sets the coordinate', () => {
    const { result } = renderHook(() =>
      useGridFocus({ rowCount: 5, colCount: 3 }),
    );
    act(() => result.current.setActiveCell({ row: 2, col: 1 }));
    expect(result.current.activeCell).toEqual({ row: 2, col: 1 });
  });

  it('moveDown advances by 1', () => {
    const { result } = renderHook(() =>
      useGridFocus({ rowCount: 5, colCount: 3 }),
    );
    act(() => result.current.setActiveCell({ row: 0, col: 0 }));
    act(() => result.current.moveDown());
    expect(result.current.activeCell).toEqual({ row: 1, col: 0 });
  });

  it('moveDown clamps at the bottom edge', () => {
    const { result } = renderHook(() =>
      useGridFocus({ rowCount: 3, colCount: 3 }),
    );
    act(() => result.current.setActiveCell({ row: 2, col: 1 }));
    act(() => result.current.moveDown());
    expect(result.current.activeCell).toEqual({ row: 2, col: 1 });
  });

  it('moveUp / moveLeft / moveRight respect bounds', () => {
    const { result } = renderHook(() =>
      useGridFocus({ rowCount: 3, colCount: 3 }),
    );
    act(() => result.current.setActiveCell({ row: 0, col: 0 }));
    act(() => result.current.moveUp());
    expect(result.current.activeCell).toEqual({ row: 0, col: 0 });
    act(() => result.current.moveLeft());
    expect(result.current.activeCell).toEqual({ row: 0, col: 0 });
    act(() => result.current.moveRight());
    expect(result.current.activeCell).toEqual({ row: 0, col: 1 });
    act(() => result.current.moveRight());
    expect(result.current.activeCell).toEqual({ row: 0, col: 2 });
    act(() => result.current.moveRight());
    expect(result.current.activeCell).toEqual({ row: 0, col: 2 });
  });

  it('moveToRowStart and moveToRowEnd', () => {
    const { result } = renderHook(() =>
      useGridFocus({ rowCount: 5, colCount: 4 }),
    );
    act(() => result.current.setActiveCell({ row: 2, col: 2 }));
    act(() => result.current.moveToRowStart());
    expect(result.current.activeCell).toEqual({ row: 2, col: 0 });
    act(() => result.current.moveToRowEnd());
    expect(result.current.activeCell).toEqual({ row: 2, col: 3 });
  });

  it('moveToStart and moveToEnd', () => {
    const { result } = renderHook(() =>
      useGridFocus({ rowCount: 5, colCount: 4 }),
    );
    act(() => result.current.setActiveCell({ row: 2, col: 2 }));
    act(() => result.current.moveToStart());
    expect(result.current.activeCell).toEqual({ row: 0, col: 0 });
    act(() => result.current.moveToEnd());
    expect(result.current.activeCell).toEqual({ row: 4, col: 3 });
  });

  it('keyDownHandler ArrowDown moves active cell', () => {
    const { result } = renderHook(() =>
      useGridFocus({ rowCount: 5, colCount: 3 }),
    );
    act(() => result.current.setActiveCell({ row: 0, col: 0 }));
    const handler = result.current.getKeyDownHandler();

    const e = { key: 'ArrowDown' };
    act(() => handler(e));
    expect(result.current.activeCell).toEqual({ row: 1, col: 0 });
  });

  it('keyDownHandler Tab advances right; Shift+Tab goes left', () => {
    const { result } = renderHook(() =>
      useGridFocus({ rowCount: 3, colCount: 3 }),
    );
    act(() => result.current.setActiveCell({ row: 0, col: 1 }));
    const handler = result.current.getKeyDownHandler();
    act(() => handler({ key: 'Tab' }));
    expect(result.current.activeCell).toEqual({ row: 0, col: 2 });
    act(() => handler({ key: 'Tab', shiftKey: true }));
    expect(result.current.activeCell).toEqual({ row: 0, col: 1 });
  });

  it('keyDownHandler Enter moves down; Shift+Enter moves up', () => {
    const { result } = renderHook(() =>
      useGridFocus({ rowCount: 5, colCount: 3 }),
    );
    act(() => result.current.setActiveCell({ row: 1, col: 0 }));
    const handler = result.current.getKeyDownHandler();
    act(() => handler({ key: 'Enter' }));
    expect(result.current.activeCell).toEqual({ row: 2, col: 0 });
    act(() => handler({ key: 'Enter', shiftKey: true }));
    expect(result.current.activeCell).toEqual({ row: 1, col: 0 });
  });

  it('keyDownHandler Home/End scope to current row, Ctrl+Home/End jump to corners', () => {
    const { result } = renderHook(() =>
      useGridFocus({ rowCount: 5, colCount: 4 }),
    );
    act(() => result.current.setActiveCell({ row: 2, col: 2 }));
    const handler = result.current.getKeyDownHandler();

    act(() => handler({ key: 'Home' }));
    expect(result.current.activeCell).toEqual({ row: 2, col: 0 });

    act(() => handler({ key: 'End' }));
    expect(result.current.activeCell).toEqual({ row: 2, col: 3 });

    act(() => handler({ key: 'Home', ctrlKey: true }));
    expect(result.current.activeCell).toEqual({ row: 0, col: 0 });

    act(() => handler({ key: 'End', ctrlKey: true }));
    expect(result.current.activeCell).toEqual({ row: 4, col: 3 });
  });

  it('keyDownHandler PageUp/PageDown jump by pageSize', () => {
    const { result } = renderHook(() =>
      useGridFocus({ rowCount: 50, colCount: 3, pageSize: 10 }),
    );
    act(() => result.current.setActiveCell({ row: 5, col: 0 }));
    const handler = result.current.getKeyDownHandler();

    act(() => handler({ key: 'PageDown' }));
    expect(result.current.activeCell).toEqual({ row: 15, col: 0 });

    act(() => handler({ key: 'PageUp' }));
    expect(result.current.activeCell).toEqual({ row: 5, col: 0 });
  });

  it('keyDownHandler Shift+Arrow extends range when rangeSelection is provided', () => {
    const { result: rangeResult } = renderHook(() =>
      useRangeSelection({ rowCount: 5, colCount: 3 }),
    );
    const { result } = renderHook(() =>
      useGridFocus({
        rowCount: 5,
        colCount: 3,
        rangeSelection: rangeResult.current,
      }),
    );
    act(() => result.current.setActiveCell({ row: 1, col: 1 }));
    const handler = result.current.getKeyDownHandler();

    // Plain arrow → starts a fresh single-cell range at the new active cell.
    act(() => handler({ key: 'ArrowDown' }));
    expect(result.current.activeCell).toEqual({ row: 2, col: 1 });
    expect(rangeResult.current.range).toEqual({
      startRow: 2,
      startCol: 1,
      endRow: 2,
      endCol: 1,
    });

    // Shift+arrow → extends.
    act(() => handler({ key: 'ArrowDown', shiftKey: true }));
    expect(result.current.activeCell).toEqual({ row: 3, col: 1 });
    expect(rangeResult.current.range).toEqual({
      startRow: 2,
      startCol: 1,
      endRow: 3,
      endCol: 1,
    });
  });

  it('keyDownHandler ignores other keys', () => {
    const { result } = renderHook(() =>
      useGridFocus({ rowCount: 3, colCount: 3 }),
    );
    act(() => result.current.setActiveCell({ row: 0, col: 0 }));
    const handler = result.current.getKeyDownHandler();
    act(() => handler({ key: 'a' }));
    expect(result.current.activeCell).toEqual({ row: 0, col: 0 });
  });
});
