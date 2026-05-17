import { WindowedRowCache, createWindowedRowCache } from '../windowedRowCache';
import { isWindowedDataSource } from '../../types';
import type { IWindowedDataSource, IDataSource, IRowWindowParams } from '../../types';

interface Row {
  id: number;
  name: string;
}

/**
 * Build an in-memory windowed data source over `total` synthetic rows.
 * `getRows` resolves on a microtask so tests can observe loading placeholders.
 * `calls` records every window requested for fetch-dedup assertions.
 */
function makeSource(total: number) {
  const calls: Array<{ start: number; end: number }> = [];
  let countCalls = 0;
  const source: IWindowedDataSource<Row> = {
    async getRowCount() {
      countCalls++;
      return total;
    },
    async getRows(params: IRowWindowParams) {
      calls.push({ start: params.start, end: params.end });
      const items: Row[] = [];
      const end = Math.min(params.end, total);
      for (let i = params.start; i < end; i++) {
        items.push({ id: i, name: `Row ${i}` });
      }
      return { items, totalCount: total };
    },
  };
  return {
    source,
    calls,
    getCountCalls: () => countCalls,
  };
}

/** Resolve all pending microtasks so background fetches settle. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('isWindowedDataSource', () => {
  it('is true when both getRowCount and getRows are present', () => {
    const { source } = makeSource(10);
    expect(isWindowedDataSource(source)).toBe(true);
  });

  it('is false for a page-based data source', () => {
    const pageSource: IDataSource<Row> = {
      async fetchPage() {
        return { items: [], totalCount: 0 };
      },
    };
    expect(isWindowedDataSource(pageSource)).toBe(false);
  });

  it('is false for undefined', () => {
    expect(isWindowedDataSource(undefined)).toBe(false);
  });

  it('is false when only getRowCount is present', () => {
    const partial = { async getRowCount() { return 0; } } as IDataSource<Row>;
    expect(isWindowedDataSource(partial)).toBe(false);
  });
});

describe('WindowedRowCache', () => {
  it('createWindowedRowCache returns a WindowedRowCache instance', () => {
    const { source } = makeSource(100);
    const cache = createWindowedRowCache({ dataSource: source });
    expect(cache).toBeInstanceOf(WindowedRowCache);
  });

  it('returns loading placeholders before data arrives', () => {
    const { source } = makeSource(1000);
    const cache = new WindowedRowCache({ dataSource: source });
    cache.ensureRange(0, 50);
    expect(cache.getRow(0)).toEqual({ status: 'loading' });
    expect(cache.hasRow(0)).toBe(false);
  });

  it('loads rows for the requested window', async () => {
    const { source } = makeSource(1000);
    const cache = new WindowedRowCache({ dataSource: source, blockSize: 100 });
    cache.ensureRange(0, 50);
    await flush();
    expect(cache.getRow(0)).toEqual({ status: 'loaded', row: { id: 0, name: 'Row 0' } });
    expect(cache.getRow(49)).toEqual({ status: 'loaded', row: { id: 49, name: 'Row 49' } });
    expect(cache.hasRow(25)).toBe(true);
  });

  it('rounds requests out to block boundaries', async () => {
    const { source, calls } = makeSource(1000);
    const cache = new WindowedRowCache({ dataSource: source, blockSize: 100 });
    // Request rows 150..170 — should fetch the whole block [100, 200).
    cache.ensureRange(150, 170);
    await flush();
    expect(calls).toEqual([{ start: 100, end: 200 }]);
    expect(cache.hasRow(100)).toBe(true);
    expect(cache.hasRow(199)).toBe(true);
  });

  it('dedupes in-flight fetches for the same block', async () => {
    const { source, calls } = makeSource(1000);
    const cache = new WindowedRowCache({ dataSource: source, blockSize: 100 });
    cache.ensureRange(0, 50);
    cache.ensureRange(20, 80); // same block, still in flight
    cache.ensureRange(10, 30);
    await flush();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ start: 0, end: 100 });
  });

  it('does not re-fetch a block that is already cached', async () => {
    const { source, calls } = makeSource(1000);
    const cache = new WindowedRowCache({ dataSource: source, blockSize: 100 });
    cache.ensureRange(0, 100);
    await flush();
    cache.ensureRange(0, 100);
    await flush();
    expect(calls).toHaveLength(1);
  });

  it('fetches multiple blocks for a wide window', async () => {
    const { source, calls } = makeSource(1000);
    const cache = new WindowedRowCache({ dataSource: source, blockSize: 100 });
    cache.ensureRange(50, 350);
    await flush();
    expect(calls.map((c) => c.start).sort((a, b) => a - b)).toEqual([0, 100, 200, 300]);
  });

  it('reports row count after setContext', async () => {
    const { source } = makeSource(777);
    const cache = new WindowedRowCache({ dataSource: source });
    expect(cache.getRowCount()).toBeUndefined();
    cache.setContext({ filters: {} });
    await flush();
    expect(cache.getRowCount()).toBe(777);
  });

  it('clamps fetches to the known row count', async () => {
    const { source, calls } = makeSource(120);
    const cache = new WindowedRowCache({ dataSource: source, blockSize: 100 });
    cache.setContext({ filters: {} });
    await flush();
    // Request beyond the dataset — only blocks covering real rows should fetch.
    cache.ensureRange(50, 500);
    await flush();
    expect(calls.map((c) => c.start).sort((a, b) => a - b)).toEqual([0, 100]);
  });

  it('invalidate clears cached rows and bumps generation', async () => {
    const { source } = makeSource(1000);
    const cache = new WindowedRowCache({ dataSource: source, blockSize: 100 });
    cache.ensureRange(0, 100);
    await flush();
    expect(cache.hasRow(0)).toBe(true);
    cache.invalidate();
    expect(cache.hasRow(0)).toBe(false);
    expect(cache.getRow(0)).toEqual({ status: 'loading' });
  });

  it('drops results from a fetch superseded by setContext', async () => {
    let resolveFirst: (() => void) | undefined;
    const source: IWindowedDataSource<Row> = {
      async getRowCount() {
        return 1000;
      },
      getRows(params: IRowWindowParams) {
        return new Promise((resolve) => {
          resolveFirst = () =>
            resolve({ items: [{ id: params.start, name: 'stale' }], totalCount: 1000 });
        });
      },
    };
    const cache = new WindowedRowCache({ dataSource: source, blockSize: 100 });
    cache.ensureRange(0, 50);
    // Context changes before the first fetch resolves.
    cache.setContext({ filters: { name: { type: 'text', value: 'x' } } });
    resolveFirst?.();
    await flush();
    // Stale result must not land in the cache.
    expect(cache.hasRow(0)).toBe(false);
  });

  it('fires onChange when data arrives', async () => {
    const { source } = makeSource(1000);
    const onChange = jest.fn();
    const cache = new WindowedRowCache({ dataSource: source, blockSize: 100, onChange });
    cache.ensureRange(0, 50);
    await flush();
    expect(onChange).toHaveBeenCalled();
  });

  it('surfaces an error slot when a block fetch fails, and retry recovers', async () => {
    let shouldFail = true;
    const source: IWindowedDataSource<Row> = {
      async getRowCount() {
        return 1000;
      },
      async getRows(params: IRowWindowParams) {
        if (shouldFail) throw new Error('network down');
        return { items: [{ id: params.start, name: 'ok' }], totalCount: 1000 };
      },
    };
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const cache = new WindowedRowCache({ dataSource: source, blockSize: 100 });
    cache.ensureRange(0, 50);
    await flush();
    expect(cache.getRow(0).status).toBe('error');

    shouldFail = false;
    cache.retry(0);
    await flush();
    expect(cache.getRow(0)).toEqual({ status: 'loaded', row: { id: 0, name: 'ok' } });
    errSpy.mockRestore();
  });

  it('evicts blocks furthest from the last requested window when over the cap', async () => {
    const { source } = makeSource(10_000);
    // Cap at 200 rows = 2 blocks of 100.
    const cache = new WindowedRowCache({ dataSource: source, blockSize: 100, maxCachedRows: 200 });
    cache.ensureRange(0, 100);
    await flush();
    cache.ensureRange(100, 200);
    await flush();
    cache.ensureRange(5000, 5100); // far from block 0 — should evict block 0
    await flush();
    expect(cache.hasRow(5000)).toBe(true);
    expect(cache.hasRow(0)).toBe(false);
  });

  it('does not evict when maxCachedRows is 0 (unbounded)', async () => {
    const { source } = makeSource(10_000);
    const cache = new WindowedRowCache({ dataSource: source, blockSize: 100, maxCachedRows: 0 });
    cache.ensureRange(0, 100);
    await flush();
    cache.ensureRange(9000, 9100);
    await flush();
    expect(cache.hasRow(0)).toBe(true);
    expect(cache.hasRow(9000)).toBe(true);
  });

  it('dispose cancels in-flight fetches and drops cached rows', async () => {
    const { source } = makeSource(1000);
    const cache = new WindowedRowCache({ dataSource: source, blockSize: 100 });
    cache.ensureRange(0, 100);
    await flush();
    cache.dispose();
    expect(cache.hasRow(0)).toBe(false);
  });

  it('ignores empty or inverted ranges', () => {
    const { source, calls } = makeSource(1000);
    const cache = new WindowedRowCache({ dataSource: source });
    cache.ensureRange(100, 100);
    cache.ensureRange(200, 50);
    expect(calls).toHaveLength(0);
  });

  it('keeps the cached total when a window result omits totalCount', async () => {
    const source: IWindowedDataSource<Row> = {
      async getRowCount() {
        return 500;
      },
      async getRows(params: IRowWindowParams) {
        // No totalCount in the window result.
        return { items: [{ id: params.start, name: 'x' }] };
      },
    };
    const cache = new WindowedRowCache({ dataSource: source, blockSize: 100 });
    cache.setContext({ filters: {} });
    await flush();
    cache.ensureRange(0, 50);
    await flush();
    expect(cache.getRowCount()).toBe(500);
  });
});
