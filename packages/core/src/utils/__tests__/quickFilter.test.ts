import { createQuickFilterPredicate, getQuickFilterTerms } from '../quickFilter';
import { processClientSideData } from '../clientSideData';
import type { IColumnDef } from '../../types';

interface Row {
  name: string;
  amount: number | null;
  status: string;
}

const rows: Row[] = [
  { name: 'Alpha report', amount: 1200, status: 'open' },
  { name: 'Beta', amount: null, status: 'signed' },
  { name: 'Gamma', amount: 45, status: 'open' },
];

const columns: IColumnDef<Row>[] = [
  { columnId: 'name', name: 'Name' },
  { columnId: 'amount', name: 'Amount', type: 'numeric', valueFormatter: (v) => (v == null ? '' : `$${Number(v).toLocaleString('en-US')}`) },
  { columnId: 'status', name: 'Status' },
];

const search = (text: string, cols = columns) => {
  const matches = createQuickFilterPredicate(text, cols);
  return matches ? rows.filter(matches).map((r) => r.name) : null;
};

describe('quick filter', () => {
  it('splits on whitespace, lowercased; blank text has no predicate', () => {
    expect(getQuickFilterTerms('  Foo   BAR ')).toEqual(['foo', 'bar']);
    expect(search('   ')).toBeNull();
    expect(search('')).toBeNull();
  });

  it('needs every term, in any column', () => {
    expect(search('open')).toEqual(['Alpha report', 'Gamma']);
    expect(search('OPEN alpha')).toEqual(['Alpha report']);
    expect(search('open beta')).toEqual([]);
  });

  it('matches raw values and displayed text', () => {
    expect(search('1200')).toEqual(['Alpha report']);
    expect(search('$1,200')).toEqual(['Alpha report']);
  });

  it('does not match across two cells', () => {
    expect(search('gammaopen')).toEqual([]);
  });

  it('only searches the given columns', () => {
    expect(search('open', columns.slice(0, 2))).toEqual([]);
  });

  it('processClientSideData applies it with the column filters', () => {
    const out = processClientSideData(rows, columns, { status: { type: 'multiSelect', value: ['open'] } }, 'name', 'desc', { quickFilter: 'a' });
    expect(out.map((r) => r.name)).toEqual(['Gamma', 'Alpha report']);
  });

  it('searches extra per-row text, which can supply a term on its own', () => {
    const notes: Record<string, string> = { Beta: 'needs legal review' };
    const matches = createQuickFilterPredicate('legal signed', columns, (r) => notes[r.name]);
    expect(rows.filter(matches!).map((r) => r.name)).toEqual(['Beta']);
    const out = processClientSideData(rows, columns, {}, undefined, undefined, { quickFilter: 'legal', getQuickFilterText: (r) => notes[r.name] });
    expect(out.map((r) => r.name)).toEqual(['Beta']);
  });
});
