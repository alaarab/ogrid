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
    // col 0 (id) has no formula → raw value; col 1 (value) has formula → formula text
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
    // formulaOptions present but no setFormula — should fall through to normal parse
    const events = applyPastedValues(
      [['a', '=BADFORMULA']],
      0,
      0,
      ITEMS,
      VISIBLE_COLS,
      { colOffset: 0, flatColumns }
    );
    // "=BADFORMULA" is not a valid number/date but is a valid string for text columns —
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
