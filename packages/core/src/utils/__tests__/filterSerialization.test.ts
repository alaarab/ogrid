import { parseFilters, serializeFilters, validateFilters } from '../filterSerialization';
import type { IColumnDef, IFilters } from '../../types';

interface Row {
  name: string;
  status: string;
  signOffs: number;
  due: string;
  owner: string;
}

const columns: IColumnDef<Row>[] = [
  { columnId: 'name', name: 'Name', filterable: { type: 'text' } },
  { columnId: 'status', name: 'Status', filterable: { type: 'multiSelect' } },
  { columnId: 'signOffs', name: 'Sign-offs', type: 'numeric', filterable: { type: 'number' } },
  { columnId: 'due', name: 'Due', type: 'date', filterable: { type: 'date' } },
  { columnId: 'owner', name: 'Owner', filterable: { type: 'people' } },
];

const all: IFilters = {
  status: { type: 'multiSelect', value: ['open', 'signed'], mode: 'none' },
  name: { type: 'text', value: 'q3' },
  signOffs: { type: 'condition', value: { kind: 'number', conditions: [{ operator: 'lessThan', value: 2 }] } },
  due: { type: 'date', value: { from: '2026-01-01' } },
  owner: { type: 'people', value: { email: 'a@x.com', displayName: 'A' } },
};

describe('filter serialization', () => {
  it('round-trips through a URL parameter', () => {
    const text = serializeFilters(all);
    const url = new URLSearchParams({ filters: text }).toString();
    const back = parseFilters(new URLSearchParams(url).get('filters'), columns);
    expect(back).toEqual({ filters: all, invalid: [] });
  });

  it('is stable (sorted keys) and empty for no filters', () => {
    expect(serializeFilters({ name: all.name, due: all.due })).toBe(serializeFilters({ due: all.due, name: all.name }));
    expect(serializeFilters({})).toBe('');
    expect(serializeFilters(undefined)).toBe('');
    expect(serializeFilters({ name: { type: 'text', value: '  ' } })).toBe('');
  });

  it('never throws on bad input', () => {
    expect(parseFilters('{not json')).toEqual({ filters: {}, invalid: [{ field: '', reason: 'not valid JSON' }] });
    expect(parseFilters(null)).toEqual({ filters: {}, invalid: [] });
    expect(validateFilters('nope').filters).toEqual({});
    expect(validateFilters([1, 2]).invalid).toHaveLength(1);
  });

  it('drops malformed entries and strips unknown fields', () => {
    const { filters, invalid } = validateFilters({
      name: { type: 'text', value: 'ok', extra: '<script>' },
      status: { type: 'multiSelect', value: ['a', 3] },
      mode: { type: 'multiSelect', value: ['a'], mode: 'some' },
      due: { type: 'date', value: { from: 'yesterday' } },
      signOffs: { type: 'condition', value: { kind: 'number', conditions: [{ operator: 'lessThan' }] } },
      bogus: { type: 'regex', value: '.*' },
    });
    expect(filters).toEqual({ name: { type: 'text', value: 'ok' } });
    expect(invalid.map((i) => i.field).sort()).toEqual(['bogus', 'due', 'mode', 'signOffs', 'status']);
  });

  it('with columns, checks the field and the filter type', () => {
    const { filters, invalid } = validateFilters(
      {
        name: { type: 'multiSelect', value: ['x'] },
        missing: { type: 'text', value: 'x' },
        signOffs: { type: 'condition', value: { kind: 'text', conditions: [{ operator: 'contains', value: '1' }] } },
        status: { type: 'multiSelect', value: ['open'] },
      },
      columns,
    );
    expect(filters).toEqual({ status: { type: 'multiSelect', value: ['open'] } });
    expect(invalid).toEqual([
      { field: 'name', reason: 'column expects a text filter' },
      { field: 'missing', reason: 'no filterable column for this field' },
      { field: 'signOffs', reason: 'column expects a number condition filter' },
    ]);
  });
});

describe('hostile and malformed input', () => {
  it('never throws on inherited names or objects where strings belong', () => {
    const hostile = [
      '{"a":{"type":"condition","value":{"kind":"constructor","conditions":[{"operator":"equals","value":1}]}}}',
      '{"a":{"type":"condition","value":{"kind":"toString","conditions":[]}}}',
      '{"a":{"type":"multiSelect","value":["x"],"mode":{"toString":null}}}',
      '{"a":{"type":"condition","value":{"kind":"number","conditions":[{"operator":{"toString":null}}]}}}',
    ];
    for (const text of hostile) {
      expect(() => parseFilters(text)).not.toThrow();
      expect(() => parseFilters(text, columns)).not.toThrow();
      expect(Object.keys(parseFilters(text).filters)).toEqual([]);
    }
    expect(parseFilters(hostile[0]).invalid[0]?.reason).toBe('unknown condition kind "constructor"');
    expect(parseFilters(hostile[2]).invalid[0]?.reason).toBe('multiSelect mode must be a string');
  });

  it('drops an entry whose fields throw when read', () => {
    const entry = {};
    Object.defineProperty(entry, 'type', { enumerable: true, get() { throw new Error('boom'); } });
    const result = validateFilters({ a: entry });
    expect(result.filters).toEqual({});
    expect(result.invalid).toEqual([{ field: 'a', reason: 'unreadable filter value' }]);
  });

  it('rejects date bounds that are not real days instead of widening the range', () => {
    expect(validateFilters({ d: { type: 'date', value: { from: '2026-99-99' } } }).invalid[0]?.reason).toBe('date from must be a real day (YYYY-MM-DD)');
    expect(validateFilters({ d: { type: 'date', value: { from: '2026-02-30' } } }).filters).toEqual({});
    const mixed = validateFilters({ d: { type: 'date', value: { from: '2026-01-01', to: 'soon' } } });
    expect(mixed.filters).toEqual({});
    expect(mixed.invalid[0]?.reason).toBe('date to must be a real day (YYYY-MM-DD)');
    expect(validateFilters({ d: { type: 'date', value: { from: '2024-02-29' } } }).filters).toEqual({ d: { type: 'date', value: { from: '2024-02-29' } } });
  });

  it('keeps a "__proto__" field as an own entry and round-trips it', () => {
    const { filters, invalid } = parseFilters('{"__proto__":{"type":"text","value":"x"}}');
    expect(invalid).toEqual([]);
    expect(Object.keys(filters)).toEqual(['__proto__']);
    expect(Object.getPrototypeOf(filters)).toBe(Object.prototype);
    expect(serializeFilters(filters)).toBe('{"__proto__":{"type":"text","value":"x"}}');
  });
});
