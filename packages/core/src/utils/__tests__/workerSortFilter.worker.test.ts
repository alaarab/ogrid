/**
 * processClientSideDataAsync against a fake Worker that runs the real Blob
 * source in-process, so the main-thread request building is exercised end to
 * end (jsdom/bun have no usable Worker, which makes the other tests take the
 * synchronous fallback).
 */
import { processClientSideDataAsync, terminateSortFilterWorker } from '../workerSortFilter';
import { processClientSideData } from '../clientSideData';
import type { SortFilterRequest } from '../../workers/sortFilterWorker';
import type { IColumnDef, IFilters, ISortModelItem } from '../../types';

type Row = { id: number; name: string; when: Date | string | null; score: number };

const columns: IColumnDef<Row>[] = [
  { columnId: 'name', name: 'Name' },
  { columnId: 'when', name: 'When', type: 'date' },
  { columnId: 'score', name: 'Score', type: 'numeric' },
];

const rows: Row[] = [
  { id: 1, name: 'b', when: new Date(2024, 0, 15, 13), score: 3 },
  { id: 2, name: 'a', when: new Date(2024, 5, 1), score: 1 },
  { id: 3, name: 'c', when: '2024-01-20', score: 2 },
  { id: 4, name: 'd', when: null, score: 4 },
];

const originalWorker = globalThis.Worker;
const originalBlob = globalThis.Blob;
const originalCreate = URL.createObjectURL;
const originalRevoke = URL.revokeObjectURL;
let posted: SortFilterRequest[] = [];

beforeEach(() => {
  posted = [];
  let source = '';
  class FakeBlob {
    constructor(parts: string[]) {
      source = parts.join('');
    }
  }
  class FakeWorker {
    onmessage: ((e: { data: unknown }) => void) | null = null;
    onerror: ((e: unknown) => void) | null = null;
    onmessageerror: (() => void) | null = null;
    private self = {
      onmessage: null as ((e: { data: SortFilterRequest }) => void) | null,
      postMessage: (msg: unknown) => queueMicrotask(() => this.onmessage?.({ data: msg })),
    };
    constructor() {
      new Function('self', source)(this.self);
    }
    postMessage(msg: SortFilterRequest) {
      posted.push(msg);
      this.self.onmessage?.({ data: msg });
    }
    terminate() {}
  }
  globalThis.Blob = FakeBlob as unknown as typeof Blob;
  globalThis.Worker = FakeWorker as unknown as typeof Worker;
  URL.createObjectURL = () => 'blob:fake';
  URL.revokeObjectURL = () => {};
});

afterEach(() => {
  terminateSortFilterWorker();
  globalThis.Worker = originalWorker;
  globalThis.Blob = originalBlob;
  URL.createObjectURL = originalCreate;
  URL.revokeObjectURL = originalRevoke;
});

async function expectParity(filters: IFilters, sortBy?: string | ISortModelItem[], dir?: 'asc' | 'desc') {
  const expected = processClientSideData(rows, columns, filters, sortBy, dir).map((r) => r.id);
  const actual = (await processClientSideDataAsync(rows, columns, filters, sortBy, dir)).map((r) => r.id);
  expect(actual).toEqual(expected);
}

describe('processClientSideDataAsync (worker path)', () => {
  it('matches the sync path for a text filter on Date values in a date column', async () => {
    await expectParity({ when: { type: 'text', value: 'jan' } });
  });

  it('matches the sync path for a multiSelect filter on Date values in a date column', async () => {
    await expectParity({ when: { type: 'multiSelect', value: [String(new Date(2024, 5, 1))] } });
  });

  it('still sorts and date-filters Date values by timestamp', async () => {
    await expectParity({ when: { type: 'date', value: { from: '2024-01-01' } } }, 'when', 'desc');
  });

  it('matches the sync path when sorting a date column that also has a text filter', async () => {
    await expectParity({ when: { type: 'text', value: '2024' } }, 'when', 'asc');
  });

  it('sends only the filtered/sorted columns to the worker', async () => {
    await processClientSideDataAsync(rows, columns, { name: { type: 'text', value: 'a' } }, 'score', 'desc');
    expect(posted).toHaveLength(1);
    const req = posted[0] as SortFilterRequest;
    expect(req.values[0]).toHaveLength(2);
    expect(req.columnMeta).toHaveLength(2);
    await expectParity({ name: { type: 'text', value: 'a' } }, 'score', 'desc');
  });

  it('skips the worker when there is nothing to filter or sort', async () => {
    const result = await processClientSideDataAsync(rows, columns, { name: { type: 'text', value: '  ' } });
    expect(posted).toHaveLength(0);
    expect(result.map((r) => r.id)).toEqual([1, 2, 3, 4]);
  });

  it('sorts by several levels in the worker, matching the sync path', async () => {
    const tied: Row[] = [
      { id: 1, name: 'b', when: null, score: 2 },
      { id: 2, name: 'a', when: '2024-01-02', score: 1 },
      { id: 3, name: 'b', when: '2024-01-01', score: 1 },
      { id: 4, name: 'a', when: '2024-01-01', score: 2 },
      { id: 5, name: 'b', when: '2024-01-01', score: 2 },
    ];
    const model: ISortModelItem[] = [{ field: 'score', direction: 'desc' }, { field: 'name', direction: 'asc' }, { field: 'when', direction: 'desc' }];
    const actual = (await processClientSideDataAsync(tied, columns, {}, model)).map((r) => r.id);
    expect((posted[0] as SortFilterRequest).sorts).toHaveLength(3);
    expect(actual).toEqual([4, 5, 1, 2, 3]);
    expect(actual).toEqual(processClientSideData(tied, columns, {}, model).map((r) => r.id));
  });

  it('runs condition filters in the worker with the same results as the sync path', async () => {
    await expectParity({ score: { type: 'condition', value: { kind: 'number', conditions: [{ operator: 'greaterThan', value: 1 }] } } }, 'score', 'asc');
    await expectParity({ score: { type: 'condition', value: { kind: 'number', conditions: [{ operator: 'top', value: 2 }] } } });
    await expectParity({ score: { type: 'condition', value: { kind: 'number', conditions: [{ operator: 'belowAverage' }] } } });
    await expectParity({ name: { type: 'condition', value: { kind: 'text', conditions: [{ operator: 'beginsWith', value: 'B' }, { operator: 'equals', value: 'd' }], join: 'or' } } });
    await expectParity({ when: { type: 'condition', value: { kind: 'date', conditions: [{ operator: 'greaterThanOrEqual', value: '2024-01-15' }] } } }, 'when', 'asc');
    await expectParity({ when: { type: 'condition', value: { kind: 'date', conditions: [{ operator: 'blank' }] } } });
    expect(posted.length).toBeGreaterThanOrEqual(6);
  });
});
