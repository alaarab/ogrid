import {
  computeVisibleRange,
  computeTotalHeight,
  getScrollTopForRow,
  computeVisibleColumnRange,
  partitionColumnsForVirtualization,
  MAX_SPACER_PX,
  computeScaledGeometry,
  computeScaledWindow,
  scrollTopForRowScaled,
} from '../virtualScroll';
import type { IScaledSpacerConfig } from '../virtualScroll';
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

// --- Scaled spacer (DOM height-cap workaround) ------------------------------

describe('computeScaledGeometry', () => {
  it('does not scale when content fits under the cap (100k rows)', () => {
    const geom = computeScaledGeometry({ totalRows: 100_000, rowHeight: 36, viewportHeight: 480 });
    expect(geom.scaled).toBe(false);
    expect(geom.scale).toBe(1);
    expect(geom.realHeight).toBe(3_600_000);
    expect(geom.spacerHeight).toBe(3_600_000);
  });

  it('scales when content exceeds the cap (1,048,576 rows)', () => {
    const geom = computeScaledGeometry({ totalRows: 1_048_576, rowHeight: 36, viewportHeight: 480 });
    expect(geom.scaled).toBe(true);
    expect(geom.realHeight).toBe(37_748_736);
    expect(geom.spacerHeight).toBe(MAX_SPACER_PX);
    expect(geom.spacerHeight).toBeLessThanOrEqual(MAX_SPACER_PX);
    expect(geom.scale).toBeCloseTo(37_748_736 / 32_000_000, 5);
  });

  it('does not scale just under the cap and scales just over it', () => {
    // 32M / 36 = 888,888.9 rows is the boundary.
    const under = computeScaledGeometry({ totalRows: 888_000, rowHeight: 36, viewportHeight: 480 });
    expect(under.scaled).toBe(false);
    const over = computeScaledGeometry({ totalRows: 931_000, rowHeight: 36, viewportHeight: 480 });
    expect(over.scaled).toBe(true);
  });

  it('exactly at the cap is not scaled', () => {
    // rowHeight 32, 1,000,000 rows = exactly 32,000,000 px.
    const geom = computeScaledGeometry({ totalRows: 1_000_000, rowHeight: 32, viewportHeight: 480 });
    expect(geom.realHeight).toBe(MAX_SPACER_PX);
    expect(geom.scaled).toBe(false);
    expect(geom.scale).toBe(1);
  });

  it('respects a custom maxSpacerPx override', () => {
    const geom = computeScaledGeometry({
      totalRows: 1000,
      rowHeight: 36,
      viewportHeight: 400,
      maxSpacerPx: 10_000,
    });
    expect(geom.realHeight).toBe(36_000);
    expect(geom.spacerHeight).toBe(10_000);
    expect(geom.scaled).toBe(true);
    expect(geom.scale).toBe(3.6);
  });

  it('handles zero rows', () => {
    const geom = computeScaledGeometry({ totalRows: 0, rowHeight: 36, viewportHeight: 480 });
    expect(geom.realHeight).toBe(0);
    expect(geom.spacerHeight).toBe(0);
    expect(geom.scaled).toBe(false);
  });
});

describe('computeScaledWindow', () => {
  const bigCfg: IScaledSpacerConfig = {
    totalRows: 1_048_576,
    rowHeight: 36,
    viewportHeight: 480,
  };
  const bigGeom = computeScaledGeometry(bigCfg);

  it('returns an empty range for zero rows', () => {
    const cfg: IScaledSpacerConfig = { totalRows: 0, rowHeight: 36, viewportHeight: 480 };
    const win = computeScaledWindow(0, computeScaledGeometry(cfg), cfg);
    expect(win).toEqual({ startIndex: 0, endIndex: -1, offsetPx: 0, realScrollTop: 0 });
  });

  it('returns an empty range for zero rowHeight', () => {
    const cfg: IScaledSpacerConfig = { totalRows: 100, rowHeight: 0, viewportHeight: 480 };
    const win = computeScaledWindow(0, computeScaledGeometry(cfg), cfg);
    expect(win.endIndex).toBe(-1);
  });

  it('non-scaled path matches plain fixed-height math', () => {
    const cfg: IScaledSpacerConfig = { totalRows: 100_000, rowHeight: 36, viewportHeight: 480 };
    const geom = computeScaledGeometry(cfg);
    expect(geom.scaled).toBe(false);
    const win = computeScaledWindow(1000, geom, cfg, 8);
    // firstVisible = floor(1000 / 36) = 27
    expect(win.realScrollTop).toBe(1000);
    expect(win.startIndex).toBe(Math.max(0, 27 - 8));
    expect(win.endIndex).toBe(27 + Math.ceil(480 / 36) + 8);
  });

  it('at scrollTop 0 shows the first rows', () => {
    const win = computeScaledWindow(0, bigGeom, bigCfg, 8);
    expect(win.startIndex).toBe(0);
    expect(win.realScrollTop).toBe(0);
    expect(win.offsetPx).toBe(0);
  });

  it('at max scrollTop the last row is within the window', () => {
    const maxCompressed = bigGeom.spacerHeight - bigCfg.viewportHeight;
    const win = computeScaledWindow(maxCompressed, bigGeom, bigCfg, 8);
    expect(win.endIndex).toBe(bigCfg.totalRows - 1);
  });

  it('keeps firstVisible monotonic across a full scroll sweep', () => {
    const maxCompressed = bigGeom.spacerHeight - bigCfg.viewportHeight;
    let prev = -1;
    for (let s = 0; s <= maxCompressed; s += maxCompressed / 500) {
      const win = computeScaledWindow(s, bigGeom, bigCfg, 8);
      const firstVisible = win.startIndex === 0 ? 0 : win.startIndex + 8;
      expect(firstVisible).toBeGreaterThanOrEqual(prev);
      prev = firstVisible;
    }
  });

  it('positions the rendered block at startIndex in compressed space', () => {
    const win = computeScaledWindow(bigGeom.spacerHeight / 2, bigGeom, bigCfg, 8);
    expect(win.offsetPx).toBeCloseTo((win.startIndex * bigCfg.rowHeight) / bigGeom.scale, 4);
  });

  it('scale-induced row skip per compressed pixel stays sub-row', () => {
    // One compressed pixel spans scale real pixels; rows skipped per px is
    // scale / rowHeight. Must stay well under 1 so scrolling is not jumpy.
    const rowsPerCompressedPx = bigGeom.scale / bigCfg.rowHeight;
    expect(rowsPerCompressedPx).toBeLessThan(0.04);
  });
});

describe('scrollTopForRowScaled', () => {
  const bigCfg: IScaledSpacerConfig = {
    totalRows: 1_048_576,
    rowHeight: 36,
    viewportHeight: 480,
  };
  const bigGeom = computeScaledGeometry(bigCfg);
  const maxCompressed = bigGeom.spacerHeight - bigCfg.viewportHeight;

  it('non-scaled path returns the real row top', () => {
    const cfg: IScaledSpacerConfig = { totalRows: 1000, rowHeight: 36, viewportHeight: 400 };
    const geom = computeScaledGeometry(cfg);
    expect(scrollTopForRowScaled(10, geom, cfg)).toBe(360);
  });

  it('non-scaled path clamps to the compressed scroll range', () => {
    const cfg: IScaledSpacerConfig = { totalRows: 1000, rowHeight: 36, viewportHeight: 400 };
    const geom = computeScaledGeometry(cfg);
    const maxScroll = geom.spacerHeight - cfg.viewportHeight;
    expect(scrollTopForRowScaled(999, geom, cfg)).toBe(maxScroll);
  });

  it('jump-to-last never overshoots the compressed scroll range', () => {
    const st = scrollTopForRowScaled(bigCfg.totalRows - 1, bigGeom, bigCfg);
    expect(st).toBeLessThanOrEqual(maxCompressed + 0.001);
  });

  it('jump-to-last lands on a window containing the last row', () => {
    const st = scrollTopForRowScaled(bigCfg.totalRows - 1, bigGeom, bigCfg);
    const win = computeScaledWindow(st, bigGeom, bigCfg, 8);
    expect(win.endIndex).toBe(bigCfg.totalRows - 1);
  });

  it('round-trips a range of target rows within the overscan window', () => {
    for (const target of [0, 1, 250_000, 500_000, 930_000, 1_000_000, 1_048_575]) {
      const st = scrollTopForRowScaled(target, bigGeom, bigCfg);
      const win = computeScaledWindow(st, bigGeom, bigCfg, 8);
      expect(win.startIndex).toBeLessThanOrEqual(target);
      expect(win.endIndex).toBeGreaterThanOrEqual(target);
    }
  });

  it('row 0 maps to scrollTop 0', () => {
    expect(scrollTopForRowScaled(0, bigGeom, bigCfg)).toBe(0);
  });
});
