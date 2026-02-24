import {
  computeVisibleRange,
  computeTotalHeight,
  getScrollTopForRow,
  computeVisibleColumnRange,
  partitionColumnsForVirtualization,
} from '../virtualScroll';
import type { IColumnDef } from '../../types';

// ─── Row Virtualization (existing) ──────────────────────────────────────────

describe('computeVisibleRange', () => {
  it('returns full range for small datasets', () => {
    const result = computeVisibleRange(0, 36, 400, 5, 5);
    expect(result.startIndex).toBe(0);
    expect(result.endIndex).toBe(4);
    expect(result.offsetTop).toBe(0);
    expect(result.offsetBottom).toBe(0);
  });

  it('handles zero rows', () => {
    const result = computeVisibleRange(0, 36, 400, 0);
    expect(result).toEqual({ startIndex: 0, endIndex: 0, offsetTop: 0, offsetBottom: 0 });
  });

  it('handles zero rowHeight', () => {
    const result = computeVisibleRange(0, 0, 400, 100);
    expect(result).toEqual({ startIndex: 0, endIndex: 0, offsetTop: 0, offsetBottom: 0 });
  });

  it('handles zero containerHeight', () => {
    const result = computeVisibleRange(0, 36, 0, 100);
    expect(result).toEqual({ startIndex: 0, endIndex: 0, offsetTop: 0, offsetBottom: 0 });
  });

  it('calculates correct range with scroll offset', () => {
    // 1000 rows at 36px, container 400px, scrolled 360px (row 10)
    const result = computeVisibleRange(360, 36, 400, 1000, 5);
    expect(result.startIndex).toBe(5); // floor(360/36) - 5 = 5
    expect(result.endIndex).toBe(27); // ceil((360+400)/36) + 5 = 27
  });

  it('clamps start to 0', () => {
    const result = computeVisibleRange(36, 36, 400, 1000, 10);
    expect(result.startIndex).toBe(0);
  });

  it('clamps end to totalRows - 1', () => {
    const result = computeVisibleRange(35640, 36, 400, 1000, 5);
    expect(result.endIndex).toBe(999);
  });
});

describe('computeTotalHeight', () => {
  it('returns rows * height', () => {
    expect(computeTotalHeight(100, 36)).toBe(3600);
  });
});

describe('getScrollTopForRow', () => {
  it('returns row offset for start alignment', () => {
    expect(getScrollTopForRow(10, 36, 400, 'start')).toBe(360);
  });

  it('returns centered offset', () => {
    expect(getScrollTopForRow(10, 36, 400, 'center')).toBe(178);
  });

  it('returns end-aligned offset', () => {
    expect(getScrollTopForRow(10, 36, 400, 'end')).toBe(0); // max(0, 360-400+36) = 0... wait
    // Actually: max(0, 360 - 400 + 36) = max(0, -4) = 0
    expect(getScrollTopForRow(10, 36, 400, 'end')).toBe(0);
  });

  it('returns end-aligned offset for later row', () => {
    // row 20: 720 - 400 + 36 = 356
    expect(getScrollTopForRow(20, 36, 400, 'end')).toBe(356);
  });
});

// ─── Column Virtualization ──────────────────────────────────────────────────

describe('computeVisibleColumnRange', () => {
  it('returns empty range for no columns', () => {
    const result = computeVisibleColumnRange(0, [], 500);
    expect(result).toEqual({ startIndex: 0, endIndex: -1, leftOffset: 0, rightOffset: 0 });
  });

  it('returns empty range for zero container width', () => {
    const result = computeVisibleColumnRange(0, [100, 100], 0);
    expect(result).toEqual({ startIndex: 0, endIndex: -1, leftOffset: 0, rightOffset: 0 });
  });

  it('returns all columns when they fit in viewport', () => {
    const widths = [100, 100, 100]; // total 300 < container 500
    const result = computeVisibleColumnRange(0, widths, 500, 2);
    expect(result.startIndex).toBe(0);
    expect(result.endIndex).toBe(2);
    expect(result.leftOffset).toBe(0);
    expect(result.rightOffset).toBe(0);
  });

  it('computes correct range for scrolled position', () => {
    // 10 columns x 100px = 1000px total, container 300px, scrollLeft 250
    const widths = Array(10).fill(100);
    const result = computeVisibleColumnRange(250, widths, 300, 0);
    // rawStart: first col whose cumWidth > 250 => col 2 (cumWidth=300)... wait
    // col 0: cumWidth=100, col 1: cumWidth=200, col 2: cumWidth=300 > 250 => rawStart=2
    // rawEnd: last col whose colStart < 250+300=550 => col 5 (colStart=500 < 550)
    expect(result.startIndex).toBe(2);
    expect(result.endIndex).toBe(5);
    expect(result.leftOffset).toBe(200); // cols 0+1 = 200
    expect(result.rightOffset).toBe(400); // cols 6-9 = 400
  });

  it('applies overscan correctly', () => {
    const widths = Array(10).fill(100);
    const result = computeVisibleColumnRange(250, widths, 300, 2);
    expect(result.startIndex).toBe(0); // max(0, 2-2) = 0
    expect(result.endIndex).toBe(7); // min(9, 5+2) = 7
    expect(result.leftOffset).toBe(0);
    expect(result.rightOffset).toBe(200); // cols 8+9 = 200
  });

  it('handles single column', () => {
    const result = computeVisibleColumnRange(0, [200], 300, 2);
    expect(result.startIndex).toBe(0);
    expect(result.endIndex).toBe(0);
    expect(result.leftOffset).toBe(0);
    expect(result.rightOffset).toBe(0);
  });

  it('handles scrolled to end', () => {
    const widths = Array(10).fill(100);
    const result = computeVisibleColumnRange(700, widths, 300, 0);
    // rawStart: first col whose cumWidth > 700 => col 7 (cumWidth=800)
    // rawEnd: last col whose colStart < 1000 => col 9
    expect(result.startIndex).toBe(7);
    expect(result.endIndex).toBe(9);
    expect(result.leftOffset).toBe(700);
    expect(result.rightOffset).toBe(0);
  });

  it('clamps overscan at boundaries', () => {
    const widths = Array(5).fill(100);
    const result = computeVisibleColumnRange(0, widths, 200, 10);
    expect(result.startIndex).toBe(0);
    expect(result.endIndex).toBe(4);
  });
});

describe('partitionColumnsForVirtualization', () => {
  const makeCol = (id: string): IColumnDef<unknown> => ({
    columnId: id,
    name: id,
  });

  it('returns all as unpinned when no pinning', () => {
    const cols = [makeCol('a'), makeCol('b'), makeCol('c')];
    const result = partitionColumnsForVirtualization(cols, null);
    expect(result.pinnedLeft).toEqual([]);
    expect(result.pinnedRight).toEqual([]);
    expect(result.virtualizedUnpinned).toEqual(cols);
    expect(result.leftSpacerWidth).toBe(0);
    expect(result.rightSpacerWidth).toBe(0);
  });

  it('partitions pinned columns correctly', () => {
    const cols = [makeCol('a'), makeCol('b'), makeCol('c'), makeCol('d')];
    const pinned = { a: 'left' as const, d: 'right' as const };
    const result = partitionColumnsForVirtualization(cols, null, pinned);
    expect(result.pinnedLeft.map(c => c.columnId)).toEqual(['a']);
    expect(result.pinnedRight.map(c => c.columnId)).toEqual(['d']);
    expect(result.virtualizedUnpinned.map(c => c.columnId)).toEqual(['b', 'c']);
  });

  it('slices unpinned columns with range', () => {
    const cols = [makeCol('a'), makeCol('b'), makeCol('c'), makeCol('d'), makeCol('e')];
    const range = { startIndex: 1, endIndex: 2, leftOffset: 100, rightOffset: 100 };
    const result = partitionColumnsForVirtualization(cols, range);
    expect(result.virtualizedUnpinned.map(c => c.columnId)).toEqual(['b', 'c']);
    expect(result.leftSpacerWidth).toBe(100);
    expect(result.rightSpacerWidth).toBe(100);
  });

  it('handles empty endIndex (-1) range', () => {
    const cols = [makeCol('a'), makeCol('b')];
    const range = { startIndex: 0, endIndex: -1, leftOffset: 0, rightOffset: 0 };
    const result = partitionColumnsForVirtualization(cols, range);
    // When endIndex < 0, returns all unpinned
    expect(result.virtualizedUnpinned).toEqual(cols);
  });

  it('handles mixed pinned + virtualized range', () => {
    const cols = [makeCol('p1'), makeCol('a'), makeCol('b'), makeCol('c'), makeCol('p2')];
    const pinned = { p1: 'left' as const, p2: 'right' as const };
    const range = { startIndex: 0, endIndex: 1, leftOffset: 0, rightOffset: 150 };
    const result = partitionColumnsForVirtualization(cols, range, pinned);
    expect(result.pinnedLeft.map(c => c.columnId)).toEqual(['p1']);
    expect(result.pinnedRight.map(c => c.columnId)).toEqual(['p2']);
    expect(result.virtualizedUnpinned.map(c => c.columnId)).toEqual(['a', 'b']);
    expect(result.rightSpacerWidth).toBe(150);
  });
});
