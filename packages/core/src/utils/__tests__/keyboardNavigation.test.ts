import { findCtrlArrowTarget, computeTabNavigation, computeArrowNavigation, getOppositeCorner } from '../keyboardNavigation';
import type { ArrowNavigationContext } from '../keyboardNavigation';

/** Build an isEmpty predicate from a set of non-empty indices. */
function nonEmptyAt(...indices: number[]): (i: number) => boolean {
  const filled = new Set(indices);
  return (i: number) => !filled.has(i);
}

describe('findCtrlArrowTarget', () => {
  describe('termination guards', () => {
    // Regression: both scan loops used `while (p !== edge)`, so a position on
    // the far side of the edge (a stale activeCell left over after a filter
    // shrank the row count) stepped away from `edge` forever and hung the tab.
    it('returns immediately when pos is past the edge going forward', () => {
      expect(findCtrlArrowTarget(10, 4, 1, () => false)).toBe(10);
      expect(findCtrlArrowTarget(10, 4, 1, () => true)).toBe(10);
    });

    it('returns immediately when pos is past the edge going backward', () => {
      expect(findCtrlArrowTarget(2, 8, -1, () => false)).toBe(2);
      expect(findCtrlArrowTarget(2, 8, -1, () => true)).toBe(2);
    });

    it('returns pos when already at the edge', () => {
      expect(findCtrlArrowTarget(5, 5, 1, () => false)).toBe(5);
      expect(findCtrlArrowTarget(0, 0, -1, () => false)).toBe(0);
    });

    it('does not loop forever for a zero step', () => {
      expect(findCtrlArrowTarget(3, 9, 0, () => false)).toBe(3);
    });
  });

  describe('forward navigation', () => {
    it('stops at the last non-empty before a gap', () => {
      // 0,1,2 filled; 3 empty. From 0 heading to edge 9.
      expect(findCtrlArrowTarget(0, 9, 1, nonEmptyAt(0, 1, 2))).toBe(2);
    });

    it('runs to the edge when every cell is filled', () => {
      expect(findCtrlArrowTarget(0, 4, 1, () => false)).toBe(4);
    });

    it('skips a gap and lands on the next non-empty', () => {
      // current 0 filled, next 1 empty -> skip empties, land on 4.
      expect(findCtrlArrowTarget(0, 9, 1, nonEmptyAt(0, 4, 5))).toBe(4);
    });

    it('lands on the edge when only empties remain', () => {
      expect(findCtrlArrowTarget(0, 6, 1, nonEmptyAt(0))).toBe(6);
    });
  });

  describe('backward navigation', () => {
    it('stops at the last non-empty before a gap', () => {
      expect(findCtrlArrowTarget(9, 0, -1, nonEmptyAt(9, 8, 7))).toBe(7);
    });

    it('skips a gap and lands on the next non-empty', () => {
      expect(findCtrlArrowTarget(9, 0, -1, nonEmptyAt(9, 4))).toBe(4);
    });

    it('runs to the edge when every cell is filled', () => {
      expect(findCtrlArrowTarget(5, 0, -1, () => false)).toBe(0);
    });
  });
});

describe('computeTabNavigation', () => {
  it('advances one column within a row', () => {
    expect(computeTabNavigation(2, 1, 9, 5, 1, false)).toEqual({ rowIndex: 2, columnIndex: 2 });
  });

  it('wraps to the start of the next row at the last column', () => {
    expect(computeTabNavigation(2, 5, 9, 5, 1, false)).toEqual({ rowIndex: 3, columnIndex: 1 });
  });

  it('stays put at the very last cell', () => {
    expect(computeTabNavigation(9, 5, 9, 5, 1, false)).toEqual({ rowIndex: 9, columnIndex: 5 });
  });

  it('moves back one column with shift', () => {
    expect(computeTabNavigation(2, 3, 9, 5, 1, true)).toEqual({ rowIndex: 2, columnIndex: 2 });
  });

  it('wraps to the end of the previous row with shift at the first column', () => {
    expect(computeTabNavigation(2, 1, 9, 5, 1, true)).toEqual({ rowIndex: 1, columnIndex: 5 });
  });

  it('stays put at the very first cell with shift', () => {
    expect(computeTabNavigation(0, 1, 9, 5, 1, true)).toEqual({ rowIndex: 0, columnIndex: 1 });
  });
});

describe('getOppositeCorner', () => {
  const range = { startRow: 2, startCol: 1, endRow: 5, endCol: 3 };

  it('returns the diagonally opposite corner for each corner', () => {
    expect(getOppositeCorner(range, 2, 1)).toEqual({ row: 5, col: 3 });
    expect(getOppositeCorner(range, 5, 3)).toEqual({ row: 2, col: 1 });
    expect(getOppositeCorner(range, 5, 1)).toEqual({ row: 2, col: 3 });
  });

  it('treats a reversed (un-normalized) range the same', () => {
    expect(getOppositeCorner({ startRow: 5, startCol: 3, endRow: 2, endCol: 1 }, 2, 1)).toEqual({ row: 5, col: 3 });
  });

  it('collapses to the cell itself with no range or a cell outside it', () => {
    expect(getOppositeCorner(null, 4, 4)).toEqual({ row: 4, col: 4 });
    expect(getOppositeCorner(range, 9, 0)).toEqual({ row: 9, col: 0 });
  });
});

describe('computeArrowNavigation Shift-extend anchor', () => {
  const base: ArrowNavigationContext = {
    direction: 'ArrowUp',
    rowIndex: 5, columnIndex: 2, dataColIndex: 2, colOffset: 0,
    maxRowIndex: 9, maxColIndex: 5, visibleColCount: 6,
    isCtrl: false, isShift: true,
    selectionRange: null,
    isEmptyAt: () => false,
  };

  it('repeated Shift+Up grows the range instead of sliding it (moving end passed as position)', () => {
    let ctx = { ...base };
    for (let i = 0; i < 3; i++) {
      const res = computeArrowNavigation(ctx);
      ctx = { ...ctx, rowIndex: res.newRowIndex, selectionRange: res.newRange };
    }
    expect(ctx.selectionRange).toEqual({ startRow: 2, startCol: 2, endRow: 5, endCol: 2 });
  });

  it('repeated Shift+Left grows the range leftward', () => {
    let ctx: ArrowNavigationContext = { ...base, direction: 'ArrowLeft' };
    for (let i = 0; i < 2; i++) {
      const res = computeArrowNavigation(ctx);
      ctx = { ...ctx, columnIndex: res.newColumnIndex, dataColIndex: res.newDataColIndex, selectionRange: res.newRange };
    }
    expect(ctx.selectionRange).toEqual({ startRow: 5, startCol: 0, endRow: 5, endCol: 2 });
  });

  it('uses an explicit anchor when given', () => {
    const res = computeArrowNavigation({
      ...base,
      rowIndex: 3,
      selectionRange: { startRow: 3, startCol: 2, endRow: 5, endCol: 2 },
      anchor: { rowIndex: 5, dataColIndex: 2 },
    });
    expect(res.newRange).toEqual({ startRow: 2, startCol: 2, endRow: 5, endCol: 2 });
  });
});
