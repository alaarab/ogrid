import { describe, it, expect } from 'bun:test';
import { ROW_NUMBER_COLUMN_ID } from '@alaarab/ogrid-core';
import type { IFormulaRowMap } from '@alaarab/ogrid-core';
import {
  collectUnpinnedColumnWidths,
  isReportableColumnResize,
  mapFormulaReferencesToView,
  parseCellCoords,
  resolveActiveCellReference,
  resolveAllowOverflowX,
  resolveRowNumberOffset,
  resolveVirtualScrollSettings,
  toggleSingleRowSelection,
  toRowNumberLabel,
} from '../dataGridDerivations';

/** Display row i shows sheet row `rows[i]` (-1 = unmapped). */
const rowMap = (rows: number[]): IFormulaRowMap => ({
  toSheetRow: (d) => rows[d] ?? -1,
  toDisplayRow: (s) => rows.indexOf(s),
});
const cols = (...ids: string[]) => ids.map((columnId) => ({ columnId }));

describe('resolveRowNumberOffset', () => {
  it('offsets paged row numbers', () => {
    expect(resolveRowNumberOffset(true, false, 3, 25)).toBe(50);
  });
  it('is 0 without a row-number column, for a windowed source, or for one page of everything', () => {
    expect(resolveRowNumberOffset(false, false, 3, 25)).toBe(0);
    expect(resolveRowNumberOffset(true, true, 3, 25)).toBe(0);
    expect(resolveRowNumberOffset(true, false, 3, 'all')).toBe(0);
  });
});

describe('resolveAllowOverflowX', () => {
  it('is off while the table fits', () => {
    expect(resolveAllowOverflowX(false, 500, 400, 450)).toBe(false);
  });
  it('turns on when either the minimum or desired width overflows', () => {
    expect(resolveAllowOverflowX(false, 500, 600, 450)).toBe(true);
    expect(resolveAllowOverflowX(false, 500, 400, 600)).toBe(true);
  });
  it('stays off before the container is measured or when suppressed', () => {
    expect(resolveAllowOverflowX(false, 0, 600, 450)).toBe(false);
    expect(resolveAllowOverflowX(true, 500, 600, 450)).toBe(false);
  });
});

describe('resolveVirtualScrollSettings', () => {
  it('follows the prop for in-memory rows', () => {
    expect(resolveVirtualScrollSettings({ enabled: true, rowHeight: 40, threshold: 50, columns: true }, null, undefined, 10)).toEqual({ enabled: true, rowHeight: 40, columnVirtualization: true, totalRows: 10, threshold: 50 });
  });
  it('forces virtualization for a windowed source, with its row count and no threshold', () => {
    expect(resolveVirtualScrollSettings({ threshold: 50 }, 10_000, undefined, 0)).toEqual({ enabled: true, rowHeight: 36, columnVirtualization: false, totalRows: 10_000, threshold: 0 });
  });
  it('prefers the rowHeight prop over the config', () => {
    expect(resolveVirtualScrollSettings({ rowHeight: 40 }, null, 28, 0).rowHeight).toBe(28);
  });
});

describe('collectUnpinnedColumnWidths', () => {
  it('lists widths of unpinned columns in order', () => {
    const width = (c: { columnId: string }) => ({ a: 10, b: 20, c: 30, d: 40 })[c.columnId] ?? 0;
    expect(collectUnpinnedColumnWidths(cols('a', 'b', 'c', 'd'), { a: 'left', d: 'right' }, width)).toEqual([20, 30]);
    expect(collectUnpinnedColumnWidths(cols('a', 'b'), undefined, width)).toEqual([10, 20]);
  });
});

describe('isReportableColumnResize', () => {
  it('does not report the row-number column', () => {
    expect(isReportableColumnResize(ROW_NUMBER_COLUMN_ID)).toBe(false);
    expect(isReportableColumnResize('name')).toBe(true);
  });
});

describe('toRowNumberLabel', () => {
  it('labels mapped rows by sheet row, unmapped rows by page position', () => {
    const map = rowMap([4, -1]);
    expect(toRowNumberLabel(map, 20, 0)).toBe(5);
    expect(toRowNumberLabel(map, 20, 1)).toBe(22);
  });
});

describe('resolveActiveCellReference', () => {
  const ac = { rowIndex: 1, columnIndex: 2 };
  const visible = cols('a', 'b');
  it('names the cell by visible column and page row without a mapping', () => {
    expect(resolveActiveCellReference(ac, visible, 1, undefined, undefined, 0)).toBe('B2');
    expect(resolveActiveCellReference(ac, visible, 1, undefined, undefined, 10)).toBe('B12');
  });
  it('names the cell by flat column and sheet row with a mapping', () => {
    const formulaCol = (id: string) => (id === 'b' ? 4 : 0);
    expect(resolveActiveCellReference(ac, visible, 1, formulaCol, rowMap([0, 9]), 0)).toBe('E10');
  });
  it('is null without an active data cell or outside the sheet', () => {
    expect(resolveActiveCellReference(null, visible, 1, undefined, undefined, 0)).toBeNull();
    expect(resolveActiveCellReference({ rowIndex: 0, columnIndex: 0 }, visible, 1, undefined, undefined, 0)).toBeNull();
    expect(resolveActiveCellReference(ac, visible, 1, undefined, rowMap([0]), 0)).toBeNull();
  });
});

describe('mapFormulaReferencesToView', () => {
  it('passes empty input through', () => {
    expect(mapFormulaReferencesToView(undefined, cols('a'), undefined, undefined, 0)).toBeUndefined();
    const empty: never[] = [];
    expect(mapFormulaReferencesToView(empty, cols('a'), undefined, undefined, 0)).toBe(empty);
  });

  it('maps a cell through column order and the row map', () => {
    const formulaCol = (id: string) => ({ a: 0, b: 1 })[id] ?? -1;
    const out = mapFormulaReferencesToView(
      [{ type: 'cell', col: 0, row: 5, colorIndex: 2 }], cols('b', 'a'), formulaCol, rowMap([7, 5]), 2,
    );
    expect(out).toEqual([{ type: 'cell', col: 1, row: 1, colorIndex: 2 }]);
  });

  it('outlines a range scattered by sorting with its bounding box', () => {
    const out = mapFormulaReferencesToView(
      [{ type: 'range', col: 0, row: 1, endCol: 1, endRow: 2, colorIndex: 0 }], cols('a', 'b', 'c'), undefined, rowMap([2, 9, 1]), 3,
    );
    expect(out).toEqual([{ type: 'range', col: 0, row: 0, endCol: 1, endRow: 2, colorIndex: 0 }]);
  });

  it('drops references with no visible cell', () => {
    expect(mapFormulaReferencesToView(
      [{ type: 'cell', col: 5, row: 0, colorIndex: 0 }], cols('a'), undefined, undefined, 1,
    )).toEqual([]);
  });
});

describe('parseCellCoords', () => {
  it('reads row and column from data attributes', () => {
    const el = document.createElement('div');
    el.setAttribute('data-row-index', '3');
    el.setAttribute('data-col-index', '1');
    expect(parseCellCoords(el)).toEqual({ row: 3, col: 1 });
  });
  it('is null for a missing element or attribute', () => {
    expect(parseCellCoords(null)).toBeNull();
    expect(parseCellCoords(document.createElement('div'))).toBeNull();
  });
});

describe('toggleSingleRowSelection', () => {
  it('selects only the clicked row, or clears it when already selected', () => {
    expect([...toggleSingleRowSelection(new Set(['a', 'b']), 'c')]).toEqual(['c']);
    expect(toggleSingleRowSelection(new Set(['c']), 'c').size).toBe(0);
  });
});
