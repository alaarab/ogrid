import { getGridCellSurfaceState } from '../gridCellSurfaceState';

describe('getGridCellSurfaceState', () => {
  it('marks non-anchor cells in a multi-cell selection as range cells', () => {
    expect(
      getGridCellSurfaceState({
        rowIndex: 1,
        columnIndex: 2,
        selectionRange: { startRow: 0, endRow: 2, startCol: 1, endCol: 3 },
        activeCell: { rowIndex: 0, columnIndex: 1 },
        cutRange: null,
      })
    ).toEqual({
      isActiveRangeCell: false,
      isRangeCell: true,
      isCutCell: false,
    });
  });

  it('keeps the anchor cell white inside a multi-cell selection', () => {
    expect(
      getGridCellSurfaceState({
        rowIndex: 0,
        columnIndex: 1,
        selectionRange: { startRow: 0, endRow: 2, startCol: 1, endCol: 3 },
        activeCell: { rowIndex: 0, columnIndex: 1 },
        cutRange: null,
      })
    ).toEqual({
      isActiveRangeCell: true,
      isRangeCell: false,
      isCutCell: false,
    });
  });

  it('does not treat a single-cell selection as a range surface', () => {
    expect(
      getGridCellSurfaceState({
        rowIndex: 3,
        columnIndex: 4,
        selectionRange: { startRow: 3, endRow: 3, startCol: 4, endCol: 4 },
        activeCell: { rowIndex: 3, columnIndex: 4 },
        cutRange: null,
      })
    ).toEqual({
      isActiveRangeCell: false,
      isRangeCell: false,
      isCutCell: false,
    });
  });

  it('marks cut cells separately from the selection surface', () => {
    expect(
      getGridCellSurfaceState({
        rowIndex: 2,
        columnIndex: 0,
        selectionRange: null,
        activeCell: null,
        cutRange: { startRow: 1, endRow: 3, startCol: 0, endCol: 1 },
      })
    ).toEqual({
      isActiveRangeCell: false,
      isRangeCell: false,
      isCutCell: true,
    });
  });
});

describe('getGridCellSurfaceState with leading columns', () => {
  const range = { startRow: 0, startCol: 0, endRow: 2, endCol: 2 };
  // activeCell.columnIndex includes the checkbox column (colOffset 1); data column 0 is global column 1.
  const activeCell = { rowIndex: 0, columnIndex: 1 };

  it('marks the anchor cell, not the cell to its right, when colOffset > 0', () => {
    const at = (columnIndex: number) =>
      getGridCellSurfaceState({ rowIndex: 0, columnIndex, selectionRange: range, activeCell, cutRange: null, colOffset: 1 });
    expect(at(0).isActiveRangeCell).toBe(true);
    expect(at(0).isRangeCell).toBe(false);
    expect(at(1).isActiveRangeCell).toBe(false);
    expect(at(1).isRangeCell).toBe(true);
  });
});
