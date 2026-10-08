import { resolveMergedCells, expandRangeToMerges, isCoveredCell } from '../mergedCells';
import { formatSelectionAsTsv, applyPastedValues } from '../clipboardHelpers';
import type { IMergedCell } from '../../types/dataGridTypes';
import type { IColumnDef } from '../../types/columnTypes';

const ROW_IDS = ['a', 'b', 'c', 'd', 'e'];
const COLS = ['c0', 'c1', 'c2', 'c3'];

function layoutOf(mergedCells: IMergedCell[], opts: { rowIds?: string[]; pinned?: Record<string, 'left' | 'right'>; frozenRows?: number } = {}) {
  const rowIds = opts.rowIds ?? ROW_IDS;
  return resolveMergedCells({
    mergedCells,
    rowIndexOf: (id) => { const i = rowIds.indexOf(String(id)); return i < 0 ? undefined : i; },
    rowCount: rowIds.length,
    columnIds: COLS,
    pinnedSideOf: opts.pinned ? (id) => opts.pinned?.[id] : undefined,
    frozenRows: opts.frozenRows,
  });
}

describe('resolveMergedCells', () => {
  it('maps a merge to displayed rows and visible columns, counting spans from the anchor', () => {
    const layout = layoutOf([{ rowId: 'b', columnId: 'c1', rowSpan: 2, colSpan: 3 }]);
    expect(layout?.merges).toEqual([{ startRow: 1, endRow: 2, startCol: 1, endCol: 3 }]);
    expect(layout?.mergeAt(2, 3)).toBe(layout?.merges[0]);
    expect(layout?.mergeAt(0, 1)).toBeUndefined();
  });

  it('follows the anchor row through a sort (spans count displayed rows)', () => {
    const layout = layoutOf([{ rowId: 'b', columnId: 'c0', rowSpan: 2 }], { rowIds: ['e', 'd', 'c', 'b', 'a'] });
    expect(layout?.merges).toEqual([{ startRow: 3, endRow: 4, startCol: 0, endCol: 0 }]);
  });

  it.each<[string, IMergedCell[], Parameters<typeof layoutOf>[1], unknown]>([
    ['anchor row filtered out / on another page', [{ rowId: 'zz', columnId: 'c0', rowSpan: 2 }], {}, null],
    ['anchor column hidden', [{ rowId: 'a', columnId: 'hidden', colSpan: 2 }], {}, null],
    ['1x1 merge', [{ rowId: 'a', columnId: 'c0' }], {}, null],
    ['invalid spans fall back to 1', [{ rowId: 'a', columnId: 'c0', rowSpan: Number.NaN, colSpan: -3 }], {}, null],
    ['spans past the view are clipped', [{ rowId: 'd', columnId: 'c2', rowSpan: 10, colSpan: 10 }], {},
      [{ startRow: 3, endRow: 4, startCol: 2, endCol: 3 }]],
    ['clipped at the pinned/unpinned boundary', [{ rowId: 'a', columnId: 'c0', colSpan: 4, rowSpan: 2 }], { pinned: { c0: 'left', c1: 'left' } },
      [{ startRow: 0, endRow: 1, startCol: 0, endCol: 1 }]],
    ['clipped at the frozen-row boundary', [{ rowId: 'a', columnId: 'c0', rowSpan: 4 }], { frozenRows: 2 },
      [{ startRow: 0, endRow: 1, startCol: 0, endCol: 0 }]],
    ['a merge below the frozen rows is unaffected', [{ rowId: 'c', columnId: 'c0', rowSpan: 2 }], { frozenRows: 2 },
      [{ startRow: 2, endRow: 3, startCol: 0, endCol: 0 }]],
    ['an overlapping later merge is dropped', [
      { rowId: 'a', columnId: 'c0', rowSpan: 2, colSpan: 2 },
      { rowId: 'b', columnId: 'c1', rowSpan: 2, colSpan: 2 },
      { rowId: 'd', columnId: 'c0', colSpan: 2 },
    ], {}, [{ startRow: 0, endRow: 1, startCol: 0, endCol: 1 }, { startRow: 3, endRow: 3, startCol: 0, endCol: 1 }]],
  ])('degrades gracefully: %s', (_name, merged, opts, expected) => {
    const layout = layoutOf(merged, opts);
    expect(layout ? layout.merges : null).toEqual(expected as never);
  });

  it('reports covered cells but not the anchor', () => {
    const layout = layoutOf([{ rowId: 'a', columnId: 'c0', rowSpan: 2, colSpan: 2 }]);
    expect(isCoveredCell(layout, 0, 0)).toBe(false);
    expect(isCoveredCell(layout, 1, 1)).toBe(true);
    expect(isCoveredCell(layout, 2, 0)).toBe(false);
  });
});

describe('expandRangeToMerges', () => {
  const layout = layoutOf([
    { rowId: 'a', columnId: 'c1', rowSpan: 2, colSpan: 2 }, // rows 0-1, cols 1-2
    { rowId: 'c', columnId: 'c2', rowSpan: 2, colSpan: 2 }, // rows 2-3, cols 2-3
  ]);

  it('grows a range touching part of a merge to the whole merge', () => {
    expect(expandRangeToMerges({ startRow: 1, startCol: 0, endRow: 1, endCol: 1 }, layout))
      .toEqual({ startRow: 0, startCol: 0, endRow: 1, endCol: 2 });
  });

  it('keeps growing until merges pulled in by the first expansion are whole', () => {
    expect(expandRangeToMerges({ startRow: 1, startCol: 2, endRow: 2, endCol: 2 }, layout))
      .toEqual({ startRow: 0, startCol: 1, endRow: 3, endCol: 3 });
  });

  it('leaves ranges clear of merges unchanged', () => {
    const range = { startRow: 4, startCol: 0, endRow: 4, endCol: 3 };
    expect(expandRangeToMerges(range, layout)).toBe(range);
  });
});

describe('clipboard over merged cells', () => {
  type Row = { id: string; c0: string; c1: string };
  const cols = [
    { columnId: 'c0', name: 'c0', editable: true },
    { columnId: 'c1', name: 'c1', editable: true },
  ] as IColumnDef<Row>[];
  const items: Row[] = [{ id: 'a', c0: 'A0', c1: 'A1' }, { id: 'b', c0: 'B0', c1: 'B1' }];
  const covered = (r: number, c: number) => !(r === 0 && c === 0);

  it('copies the anchor value once and covered cells as empty', () => {
    expect(formatSelectionAsTsv(items, cols, { startRow: 0, startCol: 0, endRow: 1, endCol: 1 }, undefined, covered))
      .toBe('A0\t\r\n\t');
  });

  it('pastes only into the anchor of a merge', () => {
    const events = applyPastedValues([['x', 'y'], ['z', 'w']], 0, 0, items, cols, undefined, covered);
    expect(events.map((e) => [e.rowIndex, e.columnId, e.newValue])).toEqual([[0, 'c0', 'x']]);
  });
});
