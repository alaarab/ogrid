import { spawnSync } from 'node:child_process';
import { computeAggregations } from '../aggregationUtils';
import { formatDateForDisplay } from '../dateFormatter';
import { numberParser } from '../valueParsers';
import { processClientSideData } from '../clientSideData';
import { deriveFilterOptionsFromData, getFilterOptionLabel } from '../ogridHelpers';
import { resolveCellDisplayContent } from '../dataGridViewModel';
import { measureColumnContentWidth } from '../columnAutosize';
import { escapeCsvValue } from '../exportToCsv';
import { buildWorkerSource, processClientSideDataAsync, terminateSortFilterWorker } from '../workerSortFilter';
import type { SortFilterRequest, SortFilterResponse } from '../../workers/sortFilterWorker';
import type { IColumnDef, IFilters } from '../../types';

type Row = { value: unknown };
const column: IColumnDef<Row> = { columnId: 'value', name: 'Value' };

describe('core value regressions', () => {
  it('aggregates decimal numbers and numeric strings without counting blanks or other types', () => {
    const rows = [10, null, undefined, '', '  ', true, false, new Date(0), '0x10', {}, 20, ' 30 ', Infinity].map(value => ({ value }));
    expect(computeAggregations(rows, [column], { startRow: 0, endRow: rows.length - 1, startCol: 0, endCol: 0 }))
      .toEqual({ sum: 60, avg: 20, min: 10, max: 30, count: 3 });
  });

  it('formats epoch milliseconds and every repeated date token', () => {
    expect(formatDateForDisplay(Date.UTC(2024, 0, 15), 'YYYY-MM-DD / DD.MM.YYYY')).toBe('2024-01-15 / 15.01.2024');
  });

  it('clears whitespace and rejects malformed or non-finite numeric input', () => {
    const parse = (newValue: unknown) => numberParser({ newValue, oldValue: 0, data: { value: 0 }, column });
    expect(parse(' \t ')).toBeNull();
    for (const input of ['1,5', '12,34', '1 5', 'Infinity', '-Infinity', '0x10', '1e999', true]) {
      expect(parse(input)).toBeUndefined();
    }
    for (const [input, expected] of [['1,234.56', 1234.56], [' -1.5e2 ', -150], ['.5', 0.5]] as const) {
      expect(parse(input)).toBe(expected);
    }
  });

  it('derives a labeled blank option and sorts numeric options naturally', () => {
    const rows = [10, 9, null, '', undefined, 'null', '(Blanks)'].map(value => ({ value }));
    const options = deriveFilterOptionsFromData(rows, [{ ...column, filterable: { type: 'multiSelect' } }]).value;
    expect(options).toEqual(['', '(Blanks)', '9', '10', 'null']);
    expect(getFilterOptionLabel(options[0]!)).toBe('(Blanks)');
    expect(processClientSideData(rows, [column], { value: { type: 'multiSelect', value: [''] } })).toEqual(rows.slice(2, 5));
    expect(processClientSideData(rows, [column], { value: { type: 'multiSelect', value: ['null'] } })).toEqual([rows[5]]);
  });

  it('displays boolean strings using their parsed boolean value', () => {
    for (const value of [false, 'false', 'FALSE', '0', 0, '', 'no']) {
      expect(resolveCellDisplayContent({ ...column, type: 'boolean' }, { value }, value)).toBe('False');
    }
    for (const value of [true, 'true', '1', 1, 'yes', 'Y', 2]) {
      expect(resolveCellDisplayContent({ ...column, type: 'boolean' }, { value }, value)).toBe('True');
    }
  });

  it('escapes column IDs before querying autosize cells', () => {
    const querySelectorAll = jest.fn(() => [] as unknown as NodeListOf<Element>);
    const id = 'a"\\b\n]';
    measureColumnContentWidth(id, undefined, { querySelectorAll });
    expect(querySelectorAll).toHaveBeenCalledWith(`[data-column-id="${CSS.escape(id)}"]`);
  });

  it('guards CSV formulas after stringifying non-string cell values', () => {
    expect(escapeCsvValue({ toString: () => '=1+1' })).toBe("'=1+1");
    expect(escapeCsvValue(['@SUM(1)'])).toBe("'@SUM(1)");
    expect(escapeCsvValue({ toString: () => '=1+1' }, { preventFormulaInjection: false })).toBe('=1+1');
    expect(escapeCsvValue(-5)).toBe('-5');
  });
});

describe('sync and serialized worker value regressions', () => {
  const previousWorker = globalThis.Worker;
  const previousCreateURL = URL.createObjectURL;
  const previousRevokeURL = URL.revokeObjectURL;

  beforeEach(() => {
    class InlineWorker {
      onmessage: ((e: { data: SortFilterResponse }) => void) | null = null;
      onerror = null;
      onmessageerror = null;
      private workerSelf = {
        onmessage: null as ((e: { data: SortFilterRequest }) => void) | null,
        postMessage: (data: SortFilterResponse) => this.onmessage?.({ data }),
      };
      constructor() { new Function('self', buildWorkerSource())(this.workerSelf); }
      postMessage(data: SortFilterRequest) { this.workerSelf.onmessage?.({ data }); }
      terminate() {}
    }
    globalThis.Worker = InlineWorker as unknown as typeof Worker;
    URL.createObjectURL = jest.fn(() => 'blob:test');
    URL.revokeObjectURL = jest.fn();
  });

  afterEach(() => {
    terminateSortFilterWorker();
    globalThis.Worker = previousWorker;
    URL.createObjectURL = previousCreateURL;
    URL.revokeObjectURL = previousRevokeURL;
  });

  async function check(rows: Row[], col: IColumnDef<Row>, filters: IFilters, expected: Row[]) {
    expect(processClientSideData(rows, [col], filters, 'value', 'asc')).toEqual(expected);
    expect(await processClientSideDataAsync(rows, [col], filters, 'value', 'asc')).toEqual(expected);
  }

  it('matches formatted currency text while keeping raw numeric sort values', async () => {
    const rows = [1200, 120, 12, 5].map(value => ({ value }));
    await check(rows, { ...column, type: 'numeric', valueFormatter: v => '$' + Number(v).toLocaleString('en-US') },
      { value: { type: 'text', value: '1,200' } }, [rows[0]!]);
    // Raw-value queries keep matching after formatting is applied.
    await check(rows, { ...column, type: 'numeric', valueFormatter: v => '$' + Number(v).toLocaleString('en-US') },
      { value: { type: 'text', value: '1200' } }, [rows[0]!]);
    await check(rows, { ...column, type: 'numeric', valueFormatter: v => '$' + v },
      { value: { type: 'text', value: '$12' } }, [rows[2]!, rows[1]!, rows[0]!]);
  });

  it('matches date-formatted display text', async () => {
    const rows = ['2024-01-15T03:00:00Z', '2024-01-16T03:00:00Z'].map(value => ({ value }));
    await check(rows, { ...column, type: 'date', dateFormat: 'MM/DD/YYYY' },
      { value: { type: 'text', value: '01/15/2024' } }, [rows[0]!]);
    await check(rows, { ...column, type: 'date', dateFormat: 'MM/DD/YYYY' },
      { value: { type: 'text', value: '2024-01-16' } }, [rows[1]!]);
  });

  it('matches blanks across null, undefined, and empty strings', async () => {
    const rows = [null, undefined, '', 'null', '(Blanks)'].map(value => ({ value }));
    await check(rows, column, { value: { type: 'multiSelect', value: [''] } }, rows.slice(0, 3));
  });

  it('sorts accented text and numeric strings naturally in both paths', async () => {
    const rows = ['z', 'é', '10', '9', 'E'].map(value => ({ value }));
    await check(rows, column, {}, [rows[3]!, rows[2]!, rows[1]!, rows[4]!, rows[0]!]);
  });
});

for (const timeZone of ['America/Los_Angeles', 'Asia/Tokyo']) {
  it(`date display, parsing, filtering and sorting agree under TZ=${timeZone}`, () => {
    const utils = new URL('../', import.meta.url).pathname;
    const script = `
      import assert from 'node:assert/strict';
      import { formatDateForDisplay, parseUserInputDate } from ${JSON.stringify(utils + 'dateFormatter.ts')};
      import { processClientSideData, toDateTimestamp } from ${JSON.stringify(utils + 'clientSideData.ts')};
      import { dateParser } from ${JSON.stringify(utils + 'valueParsers.ts')};
      import { buildWorkerSource, extractValueMatrix } from ${JSON.stringify(utils + 'workerSortFilter.ts')};
      assert.notEqual(new Date(2024, 0, 15).getTimezoneOffset(), 0);
      const column = { columnId: 'value', name: 'Date', type: 'date' };
      const values = ['2024-01-15', '2024-01-15T03:00:00Z', new Date(2024, 0, 15), Date.UTC(2024, 0, 15, 23, 59, 59, 999)];
      for (const value of values) {
        const day = formatDateForDisplay(value, 'YYYY-MM-DD');
        const rows = [{ value }];
        assert.deepEqual(processClientSideData(rows, [column], { value: { type: 'date', value: { from: day, to: day } } }), rows);
        assert.equal(parseUserInputDate(day, 'YYYY-MM-DD').toISOString().slice(0, 10), day);
        if (value instanceof Date || typeof value === 'number') {
          assert.equal(dateParser({ newValue: value, oldValue: '', data: rows[0], column }), day);
        }
        let response;
        const self = { postMessage: msg => { response = msg; } };
        new Function('self', buildWorkerSource())(self);
        self.onmessage({ data: { type: 'sort-filter', requestId: 1, values: extractValueMatrix(rows, [column]), columnMeta: [{ type: 'date', index: 0 }], filters: { 0: { type: 'date', value: { from: day, to: day } } } } });
        assert.deepEqual(response.indices, [0]);
      }
      assert.equal(toDateTimestamp('2024-01-15'), Date.UTC(2024, 0, 15));
      const rows = [{ value: '2024-01-15T03:00:00Z' }, { value: '2024-01-15' }];
      assert.deepEqual(processClientSideData(rows, [column], {}, 'value', 'asc'), [rows[1], rows[0]]);
    `;
    const result = spawnSync(process.execPath, ['-e', script], { env: { ...process.env, TZ: timeZone }, encoding: 'utf8' });
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });
}
