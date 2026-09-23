/**
 * The main-thread path (processClientSideData) and the Web Worker body must
 * filter and sort identically. Drives both with random mixed-type data.
 */
import { processClientSideData } from '../../utils/clientSideData';
import { buildWorkerSource, extractValueMatrix } from '../../utils/workerSortFilter';
import type { SortFilterRequest, SortFilterResponse } from '../sortFilterWorker';
import type { IColumnDef, IFilters } from '../../types';

type Row = { id: number; mixed: unknown; when: unknown; tag: unknown };

const columns: IColumnDef<Row>[] = [
  { columnId: 'mixed', name: 'Mixed' },
  { columnId: 'when', name: 'When', type: 'date' },
  { columnId: 'tag', name: 'Tag' },
];

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function randomRows(rand: () => number, n: number): Row[] {
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)] as T;
  const rows: Row[] = [];
  for (let i = 0; i < n; i++) {
    rows.push({
      id: i,
      mixed: pick<unknown>([null, undefined, '', 0, -3, 7.5, 42, '10', '3', 'apple', 'Banana', true, false]),
      when: pick<unknown>([null, 'nope', '2024-01-14', '2024-01-15', '2024-01-16', '2023-12-31', new Date(2024, 0, 15, 13), new Date(2024, 5, 1).getTime()]),
      tag: pick<unknown>(['a', 'b', 'c', null]),
    });
  }
  return rows;
}

/** Evaluate the real Blob source against a fake `self`, like a browser Worker would. */
function runWorkerSource(request: SortFilterRequest): number[] {
  let response: SortFilterResponse | null = null;
  const fakeSelf = {
    onmessage: null as ((e: { data: SortFilterRequest }) => void) | null,
    postMessage: (msg: SortFilterResponse) => { response = msg; },
  };
  new Function('self', buildWorkerSource())(fakeSelf);
  fakeSelf.onmessage?.({ data: request });
  if (!response) throw new Error('worker did not respond');
  return (response as SortFilterResponse).indices;
}

function toWorkerRequest(rows: Row[], filters: IFilters, sortBy?: string, dir?: 'asc' | 'desc'): SortFilterRequest {
  const workerFilters: SortFilterRequest['filters'] = {};
  columns.forEach((col, idx) => {
    const f = filters[col.columnId];
    if (!f) return;
    if (f.type === 'text' || f.type === 'multiSelect' || f.type === 'date') {
      workerFilters[idx] = f as never;
    }
  });
  const sortIdx = sortBy ? columns.findIndex((c) => c.columnId === sortBy) : -1;
  return {
    type: 'sort-filter',
    requestId: 1,
    values: extractValueMatrix(rows, columns),
    columnMeta: columns.map((c, index) => ({ type: c.type ?? 'text', index })),
    filters: workerFilters,
    sort: sortIdx >= 0 ? { columnIndex: sortIdx, direction: dir ?? 'asc' } : undefined,
  };
}

const FILTERS: IFilters[] = [
  {},
  { tag: { type: 'multiSelect', value: ['a', 'null'] } },
  { mixed: { type: 'text', value: 'a' } },
  { when: { type: 'date', value: { from: '2024-01-15', to: '2024-01-15' } } },
  { when: { type: 'date', value: { from: '2024-01-01' } } },
];

describe('sort/filter parity: main thread vs worker', () => {
  for (let seed = 1; seed <= 25; seed++) {
    it(`matches for random dataset #${seed}`, () => {
      const rand = rng(seed);
      const rows = randomRows(rand, 60);
      for (const filters of FILTERS) {
        for (const sortBy of [undefined, 'mixed', 'when', 'tag']) {
          for (const dir of ['asc', 'desc'] as const) {
            const expected = processClientSideData(rows, columns, filters, sortBy, dir).map((r) => r.id);
            const actual = runWorkerSource(toWorkerRequest(rows, filters, sortBy, dir)).map((i) => rows[i]?.id);
            expect(actual).toEqual(expected);
          }
        }
      }
    });
  }
});
