import {
  findMatches,
  findNextMatchIndex,
  planReplace,
  replaceInCellText,
  cellTextMatches,
  getFindCellText,
  formatFindStatus,
} from '../findReplace';
import type { IFindSource, IFindMatch } from '../findReplace';
import type { IColumnDef } from '../../types/columnTypes';

interface Row {
  id: string;
  name: string;
  city: string;
  price: number;
  locked: string;
}

const rows: Row[] = [
  { id: 'r0', name: 'Apple', city: 'Paris', price: 1200, locked: 'apple pie' },
  { id: 'r1', name: 'banana', city: 'Apple Valley', price: 15, locked: 'x' },
  { id: 'r2', name: 'Cherry', city: 'Rome', price: 30, locked: 'APPLE' },
];

const columns: IColumnDef<Row>[] = [
  { columnId: 'name', name: 'Name', editable: true },
  { columnId: 'city', name: 'City', editable: true },
  {
    columnId: 'price',
    name: 'Price',
    type: 'numeric',
    editable: true,
    valueFormatter: (v) => `$${Number(v).toLocaleString('en-US')}`,
  },
  { columnId: 'locked', name: 'Locked' },
];

function source(overrides: Partial<IFindSource<Row>> = {}): IFindSource<Row> {
  return { items: rows, columns, getRowId: (r) => r.id, ...overrides };
}

const cells = (ms: IFindMatch[]) => ms.map((m) => `${m.rowId}.${m.columnId}`);

describe('cellTextMatches / replaceInCellText', () => {
  it('matches substrings case-insensitively by default', () => {
    expect(cellTextMatches('Apple Valley', 'apple')).toBe(true);
    expect(cellTextMatches('Apple Valley', 'apple', { matchCase: true })).toBe(false);
    expect(cellTextMatches('Apple Valley', 'Apple', { matchEntireCell: true })).toBe(false);
    expect(cellTextMatches('apple', 'APPLE', { matchEntireCell: true })).toBe(true);
    expect(cellTextMatches('anything', '')).toBe(false);
  });

  it('replaces every occurrence, honouring case, and treats $ literally', () => {
    expect(replaceInCellText('Apple apple', 'apple', 'pear')).toBe('pear pear');
    expect(replaceInCellText('Apple apple', 'apple', 'pear', { matchCase: true })).toBe('Apple pear');
    expect(replaceInCellText('a.b.c', '.', '$&')).toBe('a$&b$&c');
    expect(replaceInCellText('Apple', 'apple', 'Pear', { matchEntireCell: true })).toBe('Pear');
    expect(replaceInCellText('Apple pie', 'apple', 'Pear', { matchEntireCell: true })).toBe('Apple pie');
  });
});

describe('findMatches', () => {
  it('searches displayed values by rows by default', () => {
    expect(cells(findMatches(source(), 'apple'))).toEqual(['r0.name', 'r0.locked', 'r1.city', 'r2.locked']);
  });

  it('visits by columns when asked', () => {
    expect(cells(findMatches(source(), 'apple', { searchOrder: 'byColumns' }))).toEqual(['r0.name', 'r1.city', 'r0.locked', 'r2.locked']);
  });

  it('honours match case and entire cell', () => {
    expect(cells(findMatches(source(), 'Apple', { matchCase: true }))).toEqual(['r0.name', 'r1.city']);
    expect(cells(findMatches(source(), 'apple', { matchEntireCell: true }))).toEqual(['r0.name', 'r2.locked']);
  });

  it('searches formatted text for values and raw text for formulas', () => {
    expect(cells(findMatches(source(), '$1,200'))).toEqual(['r0.price']);
    expect(cells(findMatches(source(), '1200'))).toEqual([]);
    expect(cells(findMatches(source(), '1200', { lookIn: 'formulas' }))).toEqual(['r0.price']);
  });

  it('limits a selection scope to the range (any corner order)', () => {
    const range = { startRow: 2, startCol: 1, endRow: 0, endCol: 0 };
    expect(cells(findMatches(source(), 'apple', { scope: 'selection' }, range))).toEqual(['r0.name', 'r1.city']);
    expect(findMatches(source(), 'apple', { scope: 'selection' }, null)).toEqual([]);
  });

  it('skips holes and cells covered by a merge, and reports indexes', () => {
    const items = [rows[0], undefined, rows[2]];
    const ms = findMatches(source({ items, isCoveredCell: (r, c) => r === 2 && c === 3 }), 'apple');
    expect(cells(ms)).toEqual(['r0.name', 'r0.locked']);
    expect(ms[1]).toEqual({ rowId: 'r0', columnId: 'locked', rowIndex: 0, columnIndex: 3 });
  });

  it('reads formula cells through the formula accessors', () => {
    const src = source({
      getFormula: (item, col) => (item.id === 'r2' && col.columnId === 'price' ? '=SUM(C1:C2)' : undefined),
      getFormulaValue: () => 1215,
    });
    expect(cells(findMatches(src, 'sum', { lookIn: 'formulas' }))).toEqual(['r2.price']);
    expect(cells(findMatches(src, '1,215'))).toEqual(['r2.price']);
    expect(getFindCellText(src, rows[2] as Row, columns[2] as IColumnDef<Row>, 2, 'values')).toBe('$1,215');
  });
});

describe('findNextMatchIndex', () => {
  const ms = findMatches(source(), 'apple');

  it('walks forward and backward from a cell, wrapping', () => {
    expect(findNextMatchIndex(ms, { rowIndex: 0, columnIndex: 0 }, 1)).toBe(1);
    expect(findNextMatchIndex(ms, { rowIndex: 0, columnIndex: 0 }, 1, 'byRows', true)).toBe(0);
    expect(findNextMatchIndex(ms, { rowIndex: 2, columnIndex: 3 }, 1)).toBe(0);
    expect(findNextMatchIndex(ms, { rowIndex: 0, columnIndex: 0 }, -1)).toBe(3);
    expect(findNextMatchIndex(ms, { rowIndex: 1, columnIndex: 2 }, -1)).toBe(2);
  });

  it('starts at the ends without a cell and returns -1 with no matches', () => {
    expect(findNextMatchIndex(ms, null, 1)).toBe(0);
    expect(findNextMatchIndex(ms, null, -1)).toBe(3);
    expect(findNextMatchIndex([], null, 1)).toBe(-1);
  });
});

describe('planReplace', () => {
  it('produces parsed value changes and skips read-only cells', () => {
    const ms = findMatches(source(), 'apple');
    const plan = planReplace({ source: source(), matches: ms, query: 'apple', replacement: 'Pear' });
    expect(plan.events.map((e) => [e.item.id, e.columnId, e.oldValue, e.newValue, e.rowIndex])).toEqual([
      ['r0', 'name', 'Apple', 'Pear', 0],
      ['r1', 'city', 'Apple Valley', 'Pear Valley', 1],
    ]);
    expect(plan.replaced).toBe(2);
    expect(plan.skipped).toBe(2);
    expect(plan.skippedReadOnly).toBe(2);
  });

  it('runs the replacement through valueParser / column type and counts rejections', () => {
    const ms = findMatches(source(), '0', { lookIn: 'formulas' });
    expect(cells(ms)).toEqual(['r0.price', 'r2.price']);
    const ok = planReplace({ source: source(), matches: ms, query: '0', replacement: '5', options: { lookIn: 'formulas' } });
    expect(ok.events.map((e) => e.newValue)).toEqual([1255, 35]);
    const bad = planReplace({ source: source(), matches: ms, query: '0', replacement: 'x', options: { lookIn: 'formulas' } });
    expect(bad.events).toEqual([]);
    expect(bad.skippedInvalid).toBe(2);
  });

  it('uses a custom valueParser (undefined rejects)', () => {
    const cols: IColumnDef<Row>[] = [
      { columnId: 'name', name: 'Name', editable: true, valueParser: ({ newValue }) => (String(newValue).length > 4 ? undefined : String(newValue).toUpperCase()) },
    ];
    const src = source({ columns: cols });
    const plan = planReplace({ source: src, matches: findMatches(src, 'a'), query: 'a', replacement: '' });
    // "Apple" -> "pple" (accepted, upper-cased), "banana" -> "bnn" (accepted), "Cherry" has no "a".
    expect(plan.events.map((e) => e.newValue)).toEqual(['PPLE', 'BNN']);
  });

  it('leaves formula cells alone unless replacing formulas with formula writes allowed', () => {
    const src = source({
      getFormula: (item, col) => (item.id === 'r2' && col.columnId === 'price' ? '=C1*2' : undefined),
      getFormulaValue: () => 2400,
    });
    const byValue = planReplace({ source: src, matches: findMatches(src, '2,400'), query: '2,400', replacement: '1' });
    expect(byValue.replaced).toBe(0);
    expect(byValue.skippedFormula).toBe(1);

    const opts = { lookIn: 'formulas' as const };
    const ms = findMatches(src, 'C1', opts);
    const noWrite = planReplace({ source: src, matches: ms, query: 'C1', replacement: 'C2', options: opts });
    expect(noWrite.skippedFormula).toBe(1);
    const write = planReplace({ source: src, matches: ms, query: 'C1', replacement: 'C2', options: opts, allowFormulas: true });
    expect(write.formulaEdits).toEqual([
      { item: rows[2], columnId: 'price', rowIndex: 2, columnIndex: 2, oldFormula: '=C1*2', newFormula: '=C2*2' },
    ]);
    expect(write.replaced).toBe(1);
  });

  it('honours an isEditable override', () => {
    const ms = findMatches(source(), 'apple');
    const plan = planReplace({ source: source(), matches: ms, query: 'apple', replacement: 'x', isEditable: () => true });
    expect(plan.replaced).toBe(4);
  });
});

describe('formatFindStatus', () => {
  it('formats the count', () => {
    expect(formatFindStatus(2, 12)).toBe('3 of 12');
    expect(formatFindStatus(-1, 12)).toBe('12 matches');
    expect(formatFindStatus(-1, 1)).toBe('1 match');
    expect(formatFindStatus(-1, 0)).toBe('No results');
  });
});
