import {
  parseValue,
  numberParser,
  currencyParser,
  dateParser,
  emailParser,
  booleanParser,
} from '../valueParsers';
import type { IColumnDef } from '../../types';

type Row = { id: string; value: unknown };
const item: Row = { id: '1', value: 'old' };
const baseCol: IColumnDef<Row> = { columnId: 'value', name: 'Value' };

describe('parseValue', () => {
  it('passes through when no valueParser and no select editor', () => {
    expect(parseValue('new', 'old', item, baseCol)).toEqual({ valid: true, value: 'new' });
  });

  it('uses custom valueParser when provided', () => {
    const col: IColumnDef<Row> = {
      ...baseCol,
      valueParser: ({ newValue }) => Number(newValue) * 2,
    };
    expect(parseValue('5', 10, item, col)).toEqual({ valid: true, value: 10 });
  });

  it('rejects when custom valueParser returns undefined', () => {
    const col: IColumnDef<Row> = {
      ...baseCol,
      valueParser: () => undefined,
    };
    expect(parseValue('bad', 'old', item, col)).toEqual({ valid: false, value: undefined });
  });

  it('allows valueParser to return null (clearing)', () => {
    const col: IColumnDef<Row> = {
      ...baseCol,
      valueParser: () => null,
    };
    expect(parseValue('', 'old', item, col)).toEqual({ valid: true, value: null });
  });

  it('allows valueParser to return false', () => {
    const col: IColumnDef<Row> = {
      ...baseCol,
      valueParser: () => false,
    };
    expect(parseValue('anything', 'old', item, col)).toEqual({ valid: true, value: false });
  });

  it('allows valueParser to return 0', () => {
    const col: IColumnDef<Row> = {
      ...baseCol,
      valueParser: () => 0,
    };
    expect(parseValue('anything', 'old', item, col)).toEqual({ valid: true, value: 0 });
  });

  describe('select auto-validation', () => {
    const selectCol: IColumnDef<Row> = {
      ...baseCol,
      cellEditor: 'select',
      cellEditorParams: { values: ['Active', 'Closed', 'Archived'] },
    };

    it('accepts exact match', () => {
      expect(parseValue('Active', 'old', item, selectCol)).toEqual({ valid: true, value: 'Active' });
    });

    it('accepts case-insensitive match and returns canonical casing', () => {
      expect(parseValue('active', 'old', item, selectCol)).toEqual({ valid: true, value: 'Active' });
      expect(parseValue('CLOSED', 'old', item, selectCol)).toEqual({ valid: true, value: 'Closed' });
    });

    it('rejects invalid value', () => {
      expect(parseValue('InvalidStatus', 'old', item, selectCol)).toEqual({ valid: false, value: undefined });
    });

    it('allows empty string (clearing)', () => {
      expect(parseValue('', 'Active', item, selectCol)).toEqual({ valid: true, value: '' });
    });

    it('custom valueParser takes priority over select auto-validation', () => {
      const col: IColumnDef<Row> = {
        ...selectCol,
        valueParser: ({ newValue }) => String(newValue).toUpperCase(),
      };
      expect(parseValue('anything', 'old', item, col)).toEqual({ valid: true, value: 'ANYTHING' });
    });

    it('skips auto-validation when cellEditorParams.values is missing', () => {
      const col: IColumnDef<Row> = {
        ...baseCol,
        cellEditor: 'select',
      };
      expect(parseValue('anything', 'old', item, col)).toEqual({ valid: true, value: 'anything' });
    });
  });

  describe('built-in column type auto-validation', () => {
    it('rejects non-date value for date column', () => {
      const col: IColumnDef<Row> = { ...baseCol, type: 'date' };
      expect(parseValue('Marketing', 'old', item, col)).toEqual({ valid: false, value: undefined });
    });

    it('accepts valid date for date column', () => {
      const col: IColumnDef<Row> = { ...baseCol, type: 'date' };
      const result = parseValue('2024-06-15', 'old', item, col);
      expect(result.valid).toBe(true);
      expect(result.value).toContain('2024-06-15');
    });

    it('allows clearing date column with empty string', () => {
      const col: IColumnDef<Row> = { ...baseCol, type: 'date' };
      expect(parseValue('', 'old', item, col)).toEqual({ valid: true, value: null });
    });

    it('rejects non-boolean value for boolean column', () => {
      const col: IColumnDef<Row> = { ...baseCol, type: 'boolean' };
      expect(parseValue('Engineering', 'old', item, col)).toEqual({ valid: false, value: undefined });
    });

    it('accepts "true"/"false" for boolean column', () => {
      const col: IColumnDef<Row> = { ...baseCol, type: 'boolean' };
      expect(parseValue('true', 'old', item, col)).toEqual({ valid: true, value: true });
      expect(parseValue('false', 'old', item, col)).toEqual({ valid: true, value: false });
    });

    it('rejects non-numeric value for numeric column', () => {
      const col: IColumnDef<Row> = { ...baseCol, type: 'numeric' };
      expect(parseValue('Sales', 'old', item, col)).toEqual({ valid: false, value: undefined });
    });

    it('accepts valid number for numeric column', () => {
      const col: IColumnDef<Row> = { ...baseCol, type: 'numeric' };
      expect(parseValue('42', 'old', item, col)).toEqual({ valid: true, value: 42 });
    });

    it('custom valueParser takes priority over built-in type validation', () => {
      const col: IColumnDef<Row> = {
        ...baseCol,
        type: 'date',
        valueParser: ({ newValue }) => `custom:${newValue}`,
      };
      expect(parseValue('anything', 'old', item, col)).toEqual({ valid: true, value: 'custom:anything' });
    });

    it('text type passes through unchanged', () => {
      const col: IColumnDef<Row> = { ...baseCol, type: 'text' };
      expect(parseValue('anything', 'old', item, col)).toEqual({ valid: true, value: 'anything' });
    });
  });
});

describe('numberParser', () => {
  const p = (v: unknown) => numberParser({ newValue: v, oldValue: 0, data: item, column: baseCol });

  it('parses integers', () => expect(p('42')).toBe(42));
  it('parses decimals', () => expect(p('3.14')).toBe(3.14));
  it('parses negative', () => expect(p('-7')).toBe(-7));
  it('strips commas', () => expect(p('1,234.56')).toBe(1234.56));
  it('strips whitespace', () => expect(p(' 42 ')).toBe(42));
  it('returns null for empty string', () => expect(p('')).toBeNull());
  it('returns null for null', () => expect(p(null)).toBeNull());
  it('rejects non-numeric', () => expect(p('abc')).toBeUndefined());
  it('rejects mixed text', () => expect(p('12abc')).toBeUndefined());
});

describe('currencyParser', () => {
  const p = (v: unknown) => currencyParser({ newValue: v, oldValue: 0, data: item, column: baseCol });

  it('parses plain number', () => expect(p('125000')).toBe(125000));
  it('strips $', () => expect(p('$125,000')).toBe(125000));
  it('strips €', () => expect(p('€99.99')).toBe(99.99));
  it('strips £', () => expect(p('£50')).toBe(50));
  it('strips ¥', () => expect(p('¥1000')).toBe(1000));
  it('returns null for empty', () => expect(p('')).toBeNull());
  it('rejects non-numeric after stripping', () => expect(p('$abc')).toBeUndefined());
});

describe('dateParser', () => {
  const p = (v: unknown) => dateParser({ newValue: v, oldValue: '', data: item, column: baseCol });

  it('parses ISO date', () => {
    const result = p('2024-01-15') as string;
    expect(result).toContain('2024-01-15');
  });
  it('parses date-time', () => {
    const result = p('2024-01-15T10:30:00Z') as string;
    expect(result).toBe('2024-01-15');
  });
  it('parses a US-style locale date without a timezone day-shift', () => {
    // "3/15/2020" is parsed as local midnight; the result must keep the typed
    // calendar day regardless of the runner's timezone (a UTC round-trip used to
    // shift this to 3/14 in positive-UTC-offset zones).
    expect(p('3/15/2020')).toBe('2020-03-15');
  });
  it('preserves a bare ISO date verbatim', () => {
    expect(p('2024-01-15')).toBe('2024-01-15');
  });
  it('rejects an out-of-range ISO date', () => {
    expect(p('2024-02-31')).toBeUndefined();
  });
  it('returns null for empty', () => expect(p('')).toBeNull());
  it('rejects invalid date', () => expect(p('not-a-date')).toBeUndefined());
});

describe('emailParser', () => {
  const p = (v: unknown) => emailParser({ newValue: v, oldValue: '', data: item, column: baseCol });

  it('accepts valid email', () => expect(p('user@example.com')).toBe('user@example.com'));
  it('trims whitespace', () => expect(p(' user@example.com ')).toBe('user@example.com'));
  it('returns null for empty', () => expect(p('')).toBeNull());
  it('rejects missing @', () => expect(p('userexample.com')).toBeUndefined());
  it('rejects missing domain', () => expect(p('user@')).toBeUndefined());
  it('rejects plain text', () => expect(p('Carol Williams')).toBeUndefined());
});

describe('booleanParser', () => {
  const p = (v: unknown) => booleanParser({ newValue: v, oldValue: false, data: item, column: baseCol });

  it('parses "true"', () => expect(p('true')).toBe(true));
  it('parses "True"', () => expect(p('True')).toBe(true));
  it('parses "yes"', () => expect(p('yes')).toBe(true));
  it('parses "1"', () => expect(p('1')).toBe(true));
  it('parses "false"', () => expect(p('false')).toBe(false));
  it('parses "no"', () => expect(p('no')).toBe(false));
  it('parses "0"', () => expect(p('0')).toBe(false));
  it('returns null for empty', () => expect(p('')).toBeNull());
  it('rejects unrecognized', () => expect(p('maybe')).toBeUndefined());
});
