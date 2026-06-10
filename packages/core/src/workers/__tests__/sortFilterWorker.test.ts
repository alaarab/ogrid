/**
 * Direct unit tests for the worker body. The Worker API is unavailable in
 * the test environment (the integration path falls back to sync), so these
 * tests drive workerBody with a mocked `self` to pin the worker's own
 * filter/sort behavior — in particular that it matches the sync path's
 * date semantics.
 */
import { workerBody } from '../sortFilterWorker';
import type { SortFilterRequest, SortFilterResponse } from '../sortFilterWorker';

function runWorker(request: Omit<SortFilterRequest, 'type' | 'requestId'>): number[] {
  const g = globalThis as { self?: unknown };
  const prevSelf = g.self;
  let response: SortFilterResponse | null = null;
  const mockSelf = {
    onmessage: null as ((e: { data: SortFilterRequest }) => void) | null,
    postMessage: (msg: SortFilterResponse) => { response = msg; },
  };
  g.self = mockSelf;
  try {
    workerBody();
    mockSelf.onmessage?.({ data: { type: 'sort-filter', requestId: 1, ...request } });
  } finally {
    g.self = prevSelf;
  }
  if (!response) throw new Error('worker did not respond');
  return (response as SortFilterResponse).indices;
}

const textMeta = [{ type: 'text' as const, index: 0 }];
const dateMeta = [{ type: 'date' as const, index: 0 }];

describe('workerBody', () => {
  it('returns all indices when no filters or sort', () => {
    const indices = runWorker({
      values: [['b'], ['a'], ['c']],
      columnMeta: textMeta,
      filters: {},
    });
    expect(indices).toEqual([0, 1, 2]);
  });

  it('applies text filter and sorts strings case-insensitively', () => {
    const indices = runWorker({
      values: [['Banana'], ['apple'], ['Cherry'], ['avocado']],
      columnMeta: textMeta,
      filters: { 0: { type: 'text', value: 'a' } },
      sort: { columnIndex: 0, direction: 'asc' },
    });
    // 'Cherry' has no 'a'; remaining sorted: apple, avocado, Banana
    expect(indices).toEqual([1, 3, 0]);
  });

  it('applies date range filter using parsed boundaries', () => {
    const indices = runWorker({
      values: [['2024-01-15'], ['2024-02-20'], ['2023-12-31'], [null], ['not-a-date']],
      columnMeta: dateMeta,
      filters: { 0: { type: 'date', value: { from: '2024-01-01', to: '2024-01-31' } } },
    });
    expect(indices).toEqual([0]);
  });

  it('sorts date columns chronologically, not lexically', () => {
    // Non-ISO date strings: lexical order would be 1/10 < 1/2 < 12/1.
    const indices = runWorker({
      values: [['1/10/2024'], ['1/2/2024'], ['12/1/2023']],
      columnMeta: dateMeta,
      filters: {},
      sort: { columnIndex: 0, direction: 'asc' },
    });
    expect(indices).toEqual([2, 1, 0]);
  });

  it('groups null and invalid dates first in ascending order (matches sync path)', () => {
    const indices = runWorker({
      values: [['1960-06-01'], ['not-a-date'], ['2024-01-15'], [null]],
      columnMeta: dateMeta,
      filters: {},
      sort: { columnIndex: 0, direction: 'asc' },
    });
    expect(indices).toEqual([1, 3, 0, 2]);
  });

  it('sorts dates descending with null/invalid last', () => {
    const indices = runWorker({
      values: [['2024-01-15'], [null], ['2023-06-01']],
      columnMeta: dateMeta,
      filters: {},
      sort: { columnIndex: 0, direction: 'desc' },
    });
    expect(indices).toEqual([0, 2, 1]);
  });

  it('sorts numeric values numerically', () => {
    const indices = runWorker({
      values: [[100], [9], [25]],
      columnMeta: [{ type: 'numeric' as const, index: 0 }],
      filters: {},
      sort: { columnIndex: 0, direction: 'asc' },
    });
    expect(indices).toEqual([1, 2, 0]);
  });
});
