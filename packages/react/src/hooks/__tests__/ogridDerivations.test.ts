import { describe, it, expect } from 'bun:test';
import {
  buildSheetRowIndex,
  buildStatusBarConfig,
  isFullyVirtualized,
  resolveColumnChooserPlacement,
  resolveDefaultSortField,
  resolvePageClampTarget,
  resolveSelectionKnownItems,
  resolveSheetItems,
  resolveSheetPageOffset,
  resolveSpreadsheetChrome,
  selectFormulaRowMap,
  toColumnChooserColumns,
  toFilterableColumns,
} from '../ogridDerivations';

describe('resolveColumnChooserPlacement', () => {
  it('maps explicit values and defaults everything else to the toolbar', () => {
    expect(resolveColumnChooserPlacement(false)).toBe('none');
    expect(resolveColumnChooserPlacement('sidebar')).toBe('sidebar');
    expect(resolveColumnChooserPlacement('external')).toBe('external');
    expect(resolveColumnChooserPlacement(undefined)).toBe('toolbar');
    expect(resolveColumnChooserPlacement(true)).toBe('toolbar');
    expect(resolveColumnChooserPlacement('toolbar')).toBe('toolbar');
  });
});

describe('isFullyVirtualized', () => {
  it('needs a client-side grid with virtual scroll on and paginate: false', () => {
    expect(isFullyVirtualized(false, { enabled: true, paginate: false })).toBe(true);
    expect(isFullyVirtualized(true, { enabled: true, paginate: false })).toBe(false);
    expect(isFullyVirtualized(false, { enabled: true })).toBe(false);
    expect(isFullyVirtualized(false, { paginate: false })).toBe(false);
    expect(isFullyVirtualized(false, undefined)).toBe(false);
  });
});

describe('resolveDefaultSortField', () => {
  const cols = [{ columnId: 'a', sortable: false }, { columnId: 'b' }, { columnId: 'c' }];
  it('prefers defaultSortBy', () => {
    expect(resolveDefaultSortField('c', cols)).toBe('c');
  });
  it('skips a non-sortable first column', () => {
    expect(resolveDefaultSortField(undefined, cols)).toBe('b');
  });
  it('is empty when nothing is sortable', () => {
    expect(resolveDefaultSortField(undefined, [{ columnId: 'a', sortable: false }])).toBe('');
  });
});

describe('resolvePageClampTarget', () => {
  it('snaps a page past the end back to the last page', () => {
    expect(resolvePageClampTarget(5, 10, 25, false, false)).toBe(3);
  });
  it('leaves a page in range alone', () => {
    expect(resolvePageClampTarget(3, 10, 25, false, false)).toBeNull();
  });
  it('leaves controlled pages to the host', () => {
    expect(resolvePageClampTarget(5, 10, 25, true, false)).toBeNull();
  });
  it('never clamps unpaged grids', () => {
    expect(resolvePageClampTarget(5, 10, 25, false, true)).toBeNull();
  });
  it('never clamps while there are no rows (loading or empty)', () => {
    expect(resolvePageClampTarget(5, 10, 0, false, false)).toBeNull();
  });
  it("treats pageSize 'all' as one page", () => {
    expect(resolvePageClampTarget(5, 'all', 25, false, false)).toBe(1);
  });
});

describe('resolveSelectionKnownItems', () => {
  const data = [1, 2, 3];
  const page = [2];
  const loaded = [1, 2];
  it('uses the full dataset client-side', () => {
    expect(resolveSelectionKnownItems(false, loaded, page, data)).toBe(data);
  });
  it('uses loaded rows, then the page, server-side', () => {
    expect(resolveSelectionKnownItems(true, loaded, page, data)).toBe(loaded);
    expect(resolveSelectionKnownItems(true, undefined, page, data)).toBe(page);
  });
});

describe('buildStatusBarConfig', () => {
  it('is off without statusBar', () => {
    expect(buildStatusBarConfig(undefined, false, 10, 4, true, 2)).toBeUndefined();
    expect(buildStatusBarConfig(false, false, 10, 4, true, 2)).toBeUndefined();
  });
  it('passes a host config through untouched', () => {
    const cfg = { totalCount: 99 };
    expect(buildStatusBarConfig(cfg, false, 10, 4, true, 2)).toBe(cfg);
  });
  it('counts the client dataset and reports filtered rows only while filtered', () => {
    expect(buildStatusBarConfig(true, false, 10, 4, true, 2)).toEqual({ totalCount: 10, filteredCount: 4, selectedCount: 2, suppressRowCount: true });
    expect(buildStatusBarConfig(true, false, 10, 4, false, 2)?.filteredCount).toBeUndefined();
  });
  it('uses the server total server-side', () => {
    expect(buildStatusBarConfig(true, true, 10, 4, true, 2)?.totalCount).toBe(4);
  });
});

describe('resolveSpreadsheetChrome', () => {
  it('shows nothing for a plain grid', () => {
    expect(resolveSpreadsheetChrome({})).toEqual({
      spreadsheetMode: false, showRowNumbers: undefined, showColumnLetters: false, showNameBox: false, reportActiveCell: false,
    });
  });
  it('cellReferences shows letters, row numbers and the name box', () => {
    const c = resolveSpreadsheetChrome({ cellReferences: true });
    expect(c.spreadsheetMode && c.showColumnLetters && c.showNameBox && c.reportActiveCell).toBe(true);
    expect(c.showRowNumbers).toBe(true);
  });
  it('formulas hide the name box (the formula bar has its own)', () => {
    const c = resolveSpreadsheetChrome({ cellReferences: true, formulas: true });
    expect(c.showNameBox).toBe(false);
    expect(c.showRowNumbers).toBe(true);
  });
  it('showRowNumbers alone is not spreadsheet mode', () => {
    const c = resolveSpreadsheetChrome({ showRowNumbers: true });
    expect(c.showRowNumbers).toBe(true);
    expect(c.spreadsheetMode).toBe(false);
  });
});

describe('sheet coordinates', () => {
  type Row = { id: string };
  const rows: Row[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const getRowId = (r: Row) => r.id;

  it('offsets server pages only', () => {
    expect(resolveSheetPageOffset(true, 3, 10)).toBe(20);
    expect(resolveSheetPageOffset(true, 3, 'all')).toBe(0);
    expect(resolveSheetPageOffset(false, 3, 10)).toBe(0);
  });

  it('addresses the full dataset client-side', () => {
    expect(resolveSheetItems(null, false, rows, [rows[1] as Row], 0)).toBe(rows);
  });

  it('pads a server page with holes for the rows before it', () => {
    const page = [rows[0] as Row];
    const items = resolveSheetItems(null, true, [], page, 2);
    expect(items.length).toBe(3);
    expect(items[2]).toBe(rows[0]);
    expect(0 in items).toBe(false);
    expect(resolveSheetItems(null, true, [], page, 0)).toBe(page);
  });

  it('uses a windowed source’s loaded rows', () => {
    const loaded = [rows[0] as Row];
    expect(resolveSheetItems({ loadedRows: loaded }, true, [], [], 0)).toBe(loaded);
  });

  it('indexes rows by id, skipping holes', () => {
    const sparse = [rows[0], undefined, rows[2]] as Row[];
    const m = buildSheetRowIndex(sparse, getRowId);
    expect([...m.entries()]).toEqual([['a', 0], ['c', 2]]);
  });

  it('selects the row map for each mode', () => {
    expect(selectFormulaRowMap(false, null, null, 0, rows, getRowId)).toBeUndefined();
    expect(selectFormulaRowMap(true, 100, null, 0, rows, getRowId)?.toSheetRow(7)).toBe(7);
    expect(selectFormulaRowMap(true, null, null, 20, rows, getRowId)?.toSheetRow(1)).toBe(21);
    const byId = selectFormulaRowMap(true, null, new Map([['a', 5], ['b', 6], ['c', 7]]), 0, rows, getRowId);
    expect(byId?.toSheetRow(2)).toBe(7);
  });
});

describe('side bar entries', () => {
  const cols = [
    { columnId: 'a', name: 'A', required: true },
    { columnId: 'b', name: 'B', filterable: { type: 'text' as const, filterField: 'bField' } },
    { columnId: 'c', name: 'C', filterable: { type: 'multiSelect' as const } },
  ];
  it('keeps only the column chooser fields', () => {
    expect(toColumnChooserColumns(cols)).toEqual([
      { columnId: 'a', name: 'A', required: true },
      { columnId: 'b', name: 'B', required: false },
      { columnId: 'c', name: 'C', required: false },
    ]);
  });
  it('lists filterable columns with their filter field', () => {
    expect(toFilterableColumns(cols)).toEqual([
      { columnId: 'b', name: 'B', filterField: 'bField', filterType: 'text' },
      { columnId: 'c', name: 'C', filterField: 'c', filterType: 'multiSelect' },
    ]);
  });
});
