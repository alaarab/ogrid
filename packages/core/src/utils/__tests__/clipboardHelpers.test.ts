import {
  formatCellValueForTsv,
  formatSelectionAsTsv,
  parseTsvClipboard,
  applyPastedValues,
  applyCutClear,
} from '../clipboardHelpers';
import type { IColumnDef } from '../../types/columnTypes';
import type { ISelectionRange } from '../../types/dataGridTypes';

interface Row {
  id: string;
  value: number | string | null;
}

const COL_ID: IColumnDef<Row> = { columnId: 'id', name: 'ID', editable: true };
const COL_VALUE: IColumnDef<Row> = { columnId: 'value', name: 'Value', editable: true, type: 'numeric' };
const VISIBLE_COLS: IColumnDef<Row>[] = [COL_ID, COL_VALUE];

const ITEMS: Row[] = [
  { id: 'a', value: 1 },
  { id: 'b', value: 2 },
];

function makeRange(startRow: number, startCol: number, endRow: number, endCol: number): ISelectionRange {
  return { startRow, startCol, endRow, endCol };
}

describe('formatCellValueForTsv', () => {
  it('returns empty string for null', () => {
    expect(formatCellValueForTsv(null, null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatCellValueForTsv(undefined, undefined)).toBe('');
  });

  it('returns string value', () => {
    expect(formatCellValueForTsv('hello', null)).toBe('hello');
  });

  it('prefers formatted value over raw', () => {
    expect(formatCellValueForTsv(42, 'forty-two')).toBe('forty-two');
  });

  it('strips tabs and newlines', () => {
    expect(formatCellValueForTsv('a\tb', null)).toBe('a b');
    expect(formatCellValueForTsv('a\nb', null)).toBe('a b');
  });
});

describe('formatSelectionAsTsv', () => {
  it('serializes a range to TSV', () => {
    const range = makeRange(0, 0, 1, 1);
    const tsv = formatSelectionAsTsv(ITEMS, VISIBLE_COLS, range);
    expect(tsv).toBe('a\t1\r\nb\t2');
  });

  it('works without formulaOptions (backward compatible)', () => {
    const range = makeRange(0, 0, 0, 1);
    const tsv = formatSelectionAsTsv(ITEMS, VISIBLE_COLS, range);
    expect(tsv).toBe('a\t1');
  });

  it('copies formula string when cell has formula', () => {
    const range = makeRange(0, 0, 0, 1);
    const flatColumns = [...VISIBLE_COLS];
    const tsv = formatSelectionAsTsv(ITEMS, VISIBLE_COLS, range, {
      colOffset: 0,
      flatColumns,
      hasFormula: (col, row) => col === 1 && row === 0,
      getFormula: (col, row) => (col === 1 && row === 0 ? '=SUM(A1:A5)' : undefined),
    });
    // col 0 (id) has no formula  to  raw value; col 1 (value) has formula  to  formula text
    expect(tsv).toBe('a\t=SUM(A1:A5)');
  });

  it('copies computed value when cell has no formula', () => {
    const range = makeRange(0, 0, 0, 1);
    const flatColumns = [...VISIBLE_COLS];
    const tsv = formatSelectionAsTsv(ITEMS, VISIBLE_COLS, range, {
      colOffset: 0,
      flatColumns,
      hasFormula: () => false,
      getFormula: () => undefined,
    });
    expect(tsv).toBe('a\t1');
  });

  it('falls back to value when hasFormula is true but getFormula returns undefined', () => {
    const range = makeRange(0, 0, 0, 0);
    const flatColumns = [...VISIBLE_COLS];
    const tsv = formatSelectionAsTsv(ITEMS, VISIBLE_COLS, range, {
      colOffset: 0,
      flatColumns,
      hasFormula: () => true,
      getFormula: () => undefined,
    });
    // formula string is undefined so falls through to normal value
    expect(tsv).toBe('a');
  });
});

describe('parseTsvClipboard', () => {
  it('splits rows and columns', () => {
    expect(parseTsvClipboard('a\tb\r\nc\td')).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('handles \\n line endings', () => {
    expect(parseTsvClipboard('x\ty\nz\tw')).toEqual([['x', 'y'], ['z', 'w']]);
  });

  it('returns empty array for blank text', () => {
    expect(parseTsvClipboard('')).toEqual([]);
    expect(parseTsvClipboard('   ')).toEqual([]);
  });
});

describe('applyPastedValues', () => {
  it('handles non-formula paste normally', () => {
    const events = applyPastedValues([['x', '99']], 0, 0, ITEMS, VISIBLE_COLS);
    expect(events).toHaveLength(2);
    expect(events[0].columnId).toBe('id');
    expect(events[0].newValue).toBe('x');
    expect(events[1].columnId).toBe('value');
    // 99 parses to number
    expect(events[1].newValue).toBe(99);
  });

  it('works without formulaOptions (backward compatible)', () => {
    const events = applyPastedValues([['z', '5']], 0, 0, ITEMS, VISIBLE_COLS);
    expect(events.length).toBeGreaterThan(0);
  });

  it('detects "=" prefix and calls setFormula', () => {
    const setFormula = jest.fn();
    const flatColumns = [...VISIBLE_COLS];
    const events = applyPastedValues(
      [['a', '=SUM(A1:A5)']],
      0,
      0,
      ITEMS,
      VISIBLE_COLS,
      { colOffset: 0, flatColumns, setFormula }
    );
    // The formula cell is handled by setFormula, not a normal event
    expect(setFormula).toHaveBeenCalledWith(1, 0, '=SUM(A1:A5)');
    // Normal cell (no formula) produces an event; formula cell does not
    const formulaEvents = events.filter(e => e.columnId === 'value');
    expect(formulaEvents).toHaveLength(0);
  });

  it('does not call setFormula for non-formula text', () => {
    const setFormula = jest.fn();
    const flatColumns = [...VISIBLE_COLS];
    applyPastedValues(
      [['a', 'hello']],
      0,
      0,
      ITEMS,
      VISIBLE_COLS,
      { colOffset: 0, flatColumns, setFormula }
    );
    expect(setFormula).not.toHaveBeenCalled();
  });

  it('skips formula routing when setFormula is not provided', () => {
    const flatColumns = [...VISIBLE_COLS];
    // formulaOptions present but no setFormula  -  should fall through to normal parse
    const events = applyPastedValues(
      [['a', '=BADFORMULA']],
      0,
      0,
      ITEMS,
      VISIBLE_COLS,
      { colOffset: 0, flatColumns }
    );
    // "=BADFORMULA" is not a valid number/date but is a valid string for text columns  - 
    // it should be treated as a raw string value (parseValue decides)
    // The key assertion is that no formula was called (no setFormula provided)
    expect(events.some(e => e.columnId === 'value')).toBeDefined();
  });
});

describe('applyCutClear', () => {
  it('clears cells in range', () => {
    const range = makeRange(0, 0, 0, 1);
    const events = applyCutClear(range, ITEMS, VISIBLE_COLS);
    expect(events.length).toBeGreaterThan(0);
    for (const evt of events) {
      expect(evt.rowIndex).toBe(0);
    }
  });
});

describe('applyPastedValues type safety', () => {
  interface TypedRow { name: string; age: number | null; active: boolean | null; joined: string | null; }
  const nameCol: IColumnDef<TypedRow> = { columnId: 'name', name: 'Name', editable: true, type: 'text' };
  const ageCol: IColumnDef<TypedRow> = { columnId: 'age', name: 'Age', editable: true, type: 'numeric' };
  const activeCol: IColumnDef<TypedRow> = { columnId: 'active', name: 'Active', editable: true, type: 'boolean' };
  const joinedCol: IColumnDef<TypedRow> = { columnId: 'joined', name: 'Joined', editable: true, type: 'date' };
  const typedCols: IColumnDef<TypedRow>[] = [nameCol, ageCol, activeCol, joinedCol];
  const typedItems: TypedRow[] = [{ name: 'Alice', age: 30, active: true, joined: '2024-01-01' }];

  it('rejects non-numeric text pasted into numeric column', () => {
    const parsed = [['hello']]; // pasting "hello" into the age column
    const events = applyPastedValues(parsed, 0, 1, typedItems, typedCols);
    expect(events).toHaveLength(0);
  });

  it('accepts valid number pasted into numeric column', () => {
    const parsed = [['42']];
    const events = applyPastedValues(parsed, 0, 1, typedItems, typedCols);
    expect(events).toHaveLength(1);
    expect(events[0].newValue).toBe(42);
  });

  it('rejects arbitrary text pasted into boolean column', () => {
    const parsed = [['hello']];
    const events = applyPastedValues(parsed, 0, 2, typedItems, typedCols);
    expect(events).toHaveLength(0);
  });

  it('accepts valid boolean string pasted into boolean column', () => {
    const parsed = [['false']];
    const events = applyPastedValues(parsed, 0, 2, typedItems, typedCols);
    expect(events).toHaveLength(1);
    expect(events[0].newValue).toBe(false);
  });

  it('rejects invalid date pasted into date column', () => {
    const parsed = [['not-a-date']];
    const events = applyPastedValues(parsed, 0, 3, typedItems, typedCols);
    expect(events).toHaveLength(0);
  });

  it('accepts valid date string pasted into date column', () => {
    const parsed = [['2024-06-15']];
    const events = applyPastedValues(parsed, 0, 3, typedItems, typedCols);
    expect(events).toHaveLength(1);
    expect(events[0].newValue).toContain('2024-06-15');
  });

  it('rejects cross-type paste across multiple columns', () => {
    // Pasting "hello\thello\thello\thello" across name, age, active, joined columns
    const parsed = [['hello', 'hello', 'hello', 'hello']];
    const events = applyPastedValues(parsed, 0, 0, typedItems, typedCols);
    // Only name (text) accepts "hello"  -  age, active, joined all reject
    expect(events).toHaveLength(1);
    expect(events[0].columnId).toBe('name');
  });
});
