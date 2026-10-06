/**
 * Tests for useOGridDataFetching: client-side sync path, async worker path,
 * server-side fetching, and onFirstDataRendered callback.
 */
import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { renderHook, act, waitFor } from '@testing-library/react';
import * as actualCore from '@alaarab/ogrid-core';
import type { UseOGridDataFetchingParams } from '../useOGridDataFetching';

mock.module('@alaarab/ogrid-core', () => ({
  ...actualCore,
  processClientSideDataAsync: mock((...args: unknown[]) =>
    Promise.resolve(actualCore.processClientSideData(...(args as Parameters<typeof actualCore.processClientSideData>))),
  ),
}));

const { useOGridDataFetching } = await import('../useOGridDataFetching');
const { processClientSideDataAsync } = await import('@alaarab/ogrid-core');

interface TestRow {
  id: number;
  name: string;
  age: number;
}

const testData: TestRow[] = [
  { id: 1, name: 'Alice', age: 30 },
  { id: 2, name: 'Bob', age: 25 },
  { id: 3, name: 'Charlie', age: 35 },
  { id: 4, name: 'Diana', age: 28 },
  { id: 5, name: 'Eve', age: 22 },
];

const testColumns = [
  { columnId: 'name', name: 'Name' },
  { columnId: 'age', name: 'Age', type: 'numeric' as const },
];

function makeParams(overrides?: Partial<UseOGridDataFetchingParams<TestRow>>): UseOGridDataFetchingParams<TestRow> {
  return {
    isServerSide: false,
    displayData: testData,
    columns: testColumns as UseOGridDataFetchingParams<TestRow>['columns'],
    stableFilters: {},
    sort: { field: '', direction: 'asc' },
    sortVersion: 0,
    page: 1,
    pageSize: 20,
    ...overrides,
  };
}

describe('useOGridDataFetching  -  client-side sync path', () => {
  it('returns all items when no filter/sort is applied', () => {
    const { result } = renderHook(() => useOGridDataFetching(makeParams()));

    expect(result.current.displayItems).toHaveLength(5);
    expect(result.current.displayTotalCount).toBe(5);
    expect(result.current.serverLoading).toBe(false);
  });

  it('paginates client-side data', () => {
    const { result } = renderHook(() =>
      useOGridDataFetching(makeParams({ pageSize: 2, page: 2 }))
    );

    expect(result.current.displayItems).toHaveLength(2);
    // Page 2 with pageSize 2 => items at indices 2,3 => Charlie, Diana
    expect(result.current.displayTotalCount).toBe(5);
  });

  it('sorts client-side data', () => {
    const { result } = renderHook(() =>
      useOGridDataFetching(makeParams({
        sort: { field: 'age', direction: 'asc' },
      }))
    );

    expect(result.current.displayItems[0].name).toBe('Eve'); // age 22
    expect(result.current.displayItems[4].name).toBe('Charlie'); // age 35
  });
});

describe('useOGridDataFetching  -  full-dataset virtualization (paginate=false)', () => {
  it('returns the entire dataset, ignoring page/pageSize', () => {
    const { result } = renderHook(() =>
      // page 2 + pageSize 2 would normally slice to 2 rows; paginate=false bypasses it.
      useOGridDataFetching(makeParams({ paginate: false, pageSize: 2, page: 2 }))
    );

    expect(result.current.displayItems).toHaveLength(5);
    expect(result.current.displayTotalCount).toBe(5);
  });

  it('still sorts the full dataset when not paginating', () => {
    const { result } = renderHook(() =>
      useOGridDataFetching(makeParams({
        paginate: false,
        pageSize: 2,
        sort: { field: 'age', direction: 'asc' },
      }))
    );

    expect(result.current.displayItems).toHaveLength(5);
    expect(result.current.displayItems[0].name).toBe('Eve'); // age 22
    expect(result.current.displayItems[4].name).toBe('Charlie'); // age 35
  });

  it('worker sort path returns the full dataset when paginate=false', async () => {
    const { result } = renderHook(() =>
      useOGridDataFetching(makeParams({
        paginate: false,
        pageSize: 2,
        page: 2,
        workerSort: true,
      }))
    );

    await waitFor(() => {
      expect(result.current.displayItems.length).toBeGreaterThan(0);
    });

    expect(result.current.displayItems).toHaveLength(5);
    expect(result.current.displayTotalCount).toBe(5);
  });
});

describe('useOGridDataFetching  -  worker sort', () => {
  beforeEach(() => {
    (processClientSideDataAsync as jest.Mock).mockClear();
  });

  it('uses async path when workerSort is true', async () => {
    const { result } = renderHook(() =>
      useOGridDataFetching(makeParams({ workerSort: true }))
    );

    await waitFor(() => {
      expect(result.current.displayItems.length).toBeGreaterThan(0);
    });

    expect(processClientSideDataAsync).toHaveBeenCalled();
    expect(result.current.displayItems).toHaveLength(5);
    expect(result.current.displayTotalCount).toBe(5);
  });

  it('uses sync path when workerSort is false', () => {
    const { result } = renderHook(() =>
      useOGridDataFetching(makeParams({ workerSort: false }))
    );

    expect(processClientSideDataAsync).not.toHaveBeenCalled();
    expect(result.current.displayItems).toHaveLength(5);
  });

  it('uses sync path when workerSort is undefined', () => {
    const { result } = renderHook(() =>
      useOGridDataFetching(makeParams())
    );

    expect(processClientSideDataAsync).not.toHaveBeenCalled();
    expect(result.current.displayItems).toHaveLength(5);
  });

  it('auto mode uses sync path when data <= 5000 rows', () => {
    const { result } = renderHook(() =>
      useOGridDataFetching(makeParams({ workerSort: 'auto' }))
    );

    expect(processClientSideDataAsync).not.toHaveBeenCalled();
    expect(result.current.displayItems).toHaveLength(5);
  });

  it('worker sort paginates correctly', async () => {
    const { result } = renderHook(() =>
      useOGridDataFetching(makeParams({
        workerSort: true,
        pageSize: 2,
        page: 1,
      }))
    );

    await waitFor(() => {
      expect(result.current.displayItems.length).toBeGreaterThan(0);
    });

    expect(result.current.displayItems).toHaveLength(2);
    expect(result.current.displayTotalCount).toBe(5);
  });
});

describe('useOGridDataFetching  -  onFirstDataRendered', () => {
  it('fires onFirstDataRendered once when items first appear', async () => {
    const onFirstDataRendered = jest.fn();

    renderHook(() =>
      useOGridDataFetching(makeParams({ onFirstDataRendered }))
    );

    // Allow effect to run
    await waitFor(() => {
      expect(onFirstDataRendered).toHaveBeenCalledTimes(1);
    });
  });
});

describe('useOGridDataFetching  -  refreshData', () => {
  it('refreshData is a function', () => {
    const { result } = renderHook(() => useOGridDataFetching(makeParams()));

    expect(typeof result.current.refreshData).toBe('function');
  });
});

describe('useOGridDataFetching  -  sort snapshot (Excel-like behavior)', () => {
  it('does not re-sort rows when data changes but sortVersion stays the same', () => {
    // Use a stable filters reference so the sort snapshot is not invalidated on re-render.
    const stableFilters = {};
    // Start sorted by age ascending: Eve(22), Bob(25), Diana(28), Alice(30), Charlie(35)
    let params = makeParams({ sort: { field: 'age', direction: 'asc' }, sortVersion: 1, stableFilters });
    const { result, rerender } = renderHook(() => useOGridDataFetching(params));

    expect(result.current.displayItems[0].name).toBe('Eve');
    expect(result.current.displayItems[4].name).toBe('Charlie');

    // Simulate a cell edit: Alice's age changes from 30 to 50 (would push her to last if re-sorted)
    const editedData: TestRow[] = testData.map((r) =>
      r.id === 1 ? { ...r, age: 50 } : r
    );

    // Data changes but sortVersion stays at 1 (no explicit re-sort by user)
    act(() => {
      params = makeParams({ sort: { field: 'age', direction: 'asc' }, sortVersion: 1, displayData: editedData, stableFilters });
      rerender();
    });

    // Row order should be UNCHANGED despite Alice's age now being 50
    // (Eve still first, Charlie still last - sort was not re-applied)
    expect(result.current.displayItems[0].name).toBe('Eve');
    // Alice should still be in position 3 (index 3) - not moved to end
    const aliceIndex = result.current.displayItems.findIndex((r) => r.name === 'Alice');
    expect(aliceIndex).toBe(3); // original sorted position, not re-sorted
  });

  it('re-sorts rows when sortVersion increments (user explicitly sorts)', () => {
    // Start with no sort
    let params = makeParams({ sort: { field: '', direction: 'asc' }, sortVersion: 0 });
    const { result, rerender } = renderHook(() => useOGridDataFetching(params));

    // Unsorted - original order: Alice, Bob, Charlie, Diana, Eve
    expect(result.current.displayItems[0].name).toBe('Alice');

    // User clicks sort on age - sortVersion increments
    act(() => {
      params = makeParams({ sort: { field: 'age', direction: 'asc' }, sortVersion: 1 });
      rerender();
    });

    // Now sorted: Eve(22), Bob(25), Diana(28), Alice(30), Charlie(35)
    expect(result.current.displayItems[0].name).toBe('Eve');
    expect(result.current.displayItems[4].name).toBe('Charlie');
  });
});

describe('useOGridDataFetching  -  windowed (lazy) data source', () => {
  /** Build an in-memory windowed data source over `total` synthetic rows. */
  function makeWindowedSource(total: number) {
    const windowCalls: Array<{ start: number; end: number }> = [];
    return {
      windowCalls,
      source: {
        async getRowCount() {
          return total;
        },
        async getRows(params: { start: number; end: number }) {
          windowCalls.push({ start: params.start, end: params.end });
          const items: TestRow[] = [];
          const end = Math.min(params.end, total);
          for (let i = params.start; i < end; i++) {
            items.push({ id: i, name: `Row ${i}`, age: i });
          }
          return { items, totalCount: total };
        },
      },
    };
  }

  it('exposes a windowed accessor for a windowed data source', async () => {
    const { source } = makeWindowedSource(100_000);
    const { result } = renderHook(() =>
      useOGridDataFetching(makeParams({ isServerSide: true, dataSource: source, displayData: [] }))
    );
    expect(result.current.windowed).not.toBeNull();
    await waitFor(() => expect(result.current.windowed?.rowCount).toBe(100_000));
    expect(result.current.displayTotalCount).toBe(100_000);
    // displayItems stays empty — the render path reads getRow() instead.
    expect(result.current.displayItems).toHaveLength(0);
  });

  it('windowed is null for a page-based data source', () => {
    const pageSource = {
      async fetchPage() {
        return { items: [], totalCount: 0 };
      },
    };
    const { result } = renderHook(() =>
      useOGridDataFetching(makeParams({ isServerSide: true, dataSource: pageSource, displayData: [] }))
    );
    expect(result.current.windowed).toBeNull();
  });

  it('requestWindow fetches rows and getRow returns loaded slots', async () => {
    const { source } = makeWindowedSource(100_000);
    const { result } = renderHook(() =>
      useOGridDataFetching(makeParams({ isServerSide: true, dataSource: source, displayData: [] }))
    );
    await waitFor(() => expect(result.current.windowed?.rowCount).toBe(100_000));

    // Before requesting, an arbitrary row is a loading placeholder.
    expect(result.current.windowed?.getRow(50).status).toBe('loading');

    act(() => {
      result.current.windowed?.requestWindow(0, 60);
    });
    await waitFor(() => {
      expect(result.current.windowed?.getRow(0).status).toBe('loaded');
    });
    const slot = result.current.windowed?.getRow(10);
    expect(slot).toEqual({ status: 'loaded', row: { id: 10, name: 'Row 10', age: 10 } });
  });

  it('refetches the row count when filters change', async () => {
    let total = 100_000;
    const source = {
      async getRowCount() {
        return total;
      },
      async getRows(params: { start: number; end: number }) {
        return { items: [] as TestRow[], totalCount: total, _s: params.start };
      },
    };
    let params = makeParams({ isServerSide: true, dataSource: source, displayData: [], stableFilters: {} });
    const { result, rerender } = renderHook(() => useOGridDataFetching(params));
    await waitFor(() => expect(result.current.windowed?.rowCount).toBe(100_000));

    total = 42;
    act(() => {
      params = makeParams({
        isServerSide: true,
        dataSource: source,
        displayData: [],
        stableFilters: { name: { type: 'text', value: 'Row 1' } },
      });
      rerender();
    });
    await waitFor(() => expect(result.current.windowed?.rowCount).toBe(42));
  });
});

describe('useOGridDataFetching  -  windowed source through sort, filter, refresh and swap', () => {
  type Ctx = { sort?: { field: string; direction: 'asc' | 'desc' }; filters: Record<string, unknown> };
  /** Fake windowed source: 100 rows, sorted by age desc and filtered by min age on request. */
  function makeSource(label: string, { omitTotal = false } = {}) {
    const calls: Array<Ctx & { start: number; end: number }> = [];
    const query = (ctx: Ctx) => {
      let rows = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `${label} ${i}`, age: i }));
      const min = (ctx.filters.age as { value?: { min?: number } } | undefined)?.value?.min;
      if (min !== undefined) rows = rows.filter((r) => r.age >= min);
      if (ctx.sort?.direction === 'desc') rows.reverse();
      return rows;
    };
    return {
      calls,
      source: {
        async getRowCount(ctx: Ctx) {
          return query(ctx).length;
        },
        async getRows(params: Ctx & { start: number; end: number }) {
          calls.push(params);
          const rows = query(params);
          const items = rows.slice(params.start, params.end);
          return omitTotal ? { items } : { items, totalCount: rows.length };
        },
      },
    };
  }
  const asc = { field: 'age', direction: 'asc' as const };
  const desc = { field: 'age', direction: 'desc' as const };
  const ageFilter = { age: { type: 'numberRange', value: { min: 90 } } } as unknown as UseOGridDataFetchingParams<TestRow>['stableFilters'];
  const row0 = (w: ReturnType<typeof useOGridDataFetching<TestRow>>['windowed']) => {
    const slot = w?.getRow(0);
    return slot?.status === 'loaded' ? slot.row.name : slot?.status;
  };

  async function setup(initial: { ds: unknown; sort?: typeof asc; filters?: UseOGridDataFetchingParams<TestRow>['stableFilters'] }) {
    const hook = renderHook(
      ({ ds, sort, filters }) =>
        useOGridDataFetching(
          makeParams({ isServerSide: true, dataSource: ds as UseOGridDataFetchingParams<TestRow>['dataSource'], displayData: [], sort, stableFilters: filters }),
        ),
      { initialProps: { ds: initial.ds, sort: initial.sort ?? asc, filters: initial.filters ?? noFilters } },
    );
    await waitFor(() => expect(hook.result.current.windowed?.rowCount).toBe(100));
    // The grid asks for its visible window exactly once; nothing below asks again.
    act(() => hook.result.current.windowed?.requestWindow(0, 20));
    await waitFor(() => expect(row0(hook.result.current.windowed)).toBe('A 0'));
    return hook;
  }

  it('re-requests the last window with the new sort', async () => {
    const a = makeSource('A');
    const { result, rerender } = await setup({ ds: a.source });
    rerender({ ds: a.source, sort: desc, filters: noFilters });
    await waitFor(() => expect(row0(result.current.windowed)).toBe('A 99'));
    expect(a.calls.at(-1)).toMatchObject({ start: 0, sort: desc });
  });

  it('re-requests the last window with the new filter and refreshes the count', async () => {
    const a = makeSource('A');
    const { result, rerender } = await setup({ ds: a.source });
    rerender({ ds: a.source, sort: asc, filters: ageFilter });
    await waitFor(() => expect(row0(result.current.windowed)).toBe('A 90'));
    expect(result.current.windowed?.rowCount).toBe(10);
  });

  it('re-requests the last window on refreshData', async () => {
    const a = makeSource('A');
    const { result } = await setup({ ds: a.source });
    const before = a.calls.length;
    act(() => result.current.refreshData());
    await waitFor(() => expect(a.calls.length).toBeGreaterThan(before));
    await waitFor(() => expect(row0(result.current.windowed)).toBe('A 0'));
  });

  it('applies the current sort/filter to a swapped source and keeps its row count', async () => {
    const a = makeSource('A');
    // B's windows omit totalCount: the count must come from getRowCount, not reset to 0.
    const b = makeSource('B', { omitTotal: true });
    const { result, rerender } = await setup({ ds: a.source });
    rerender({ ds: a.source, sort: desc, filters: ageFilter });
    await waitFor(() => expect(row0(result.current.windowed)).toBe('A 99'));
    rerender({ ds: b.source, sort: desc, filters: ageFilter });
    await waitFor(() => expect(row0(result.current.windowed)).toBe('B 99'));
    expect(b.calls.every((c) => c.sort?.direction === 'desc' && c.filters === ageFilter)).toBe(true);
    expect(result.current.windowed?.rowCount).toBe(10);
  });

  it('exposes loaded rows by absolute index, re-read after a sort', async () => {
    const a = makeSource('A');
    const { result, rerender } = await setup({ ds: a.source });
    expect(result.current.windowed?.loadedRows).toHaveLength(100);
    expect(result.current.windowed?.loadedRows?.[5]?.name).toBe('A 5');
    rerender({ ds: a.source, sort: desc, filters: noFilters });
    await waitFor(() => expect(result.current.windowed?.loadedRows?.[5]?.name).toBe('A 94'));
  });
});

describe('useOGridDataFetching  -  replacing data of the same length', () => {
  const filters = { name: { type: 'text' as const, value: 'a' } };
  const other: TestRow[] = [
    { id: 11, name: 'Xan', age: 1 },
    { id: 12, name: 'Pete', age: 2 },
    { id: 13, name: 'Quinn', age: 3 },
    { id: 14, name: 'Rory', age: 4 },
    { id: 15, name: 'Sam', age: 5 },
  ];

  it('re-filters when a new dataset of the same length arrives (with getRowId)', () => {
    const { result, rerender } = renderHook(
      ({ data }) => useOGridDataFetching(makeParams({ displayData: data, stableFilters: filters, getRowId: (r) => r.id })),
      { initialProps: { data: testData } },
    );
    expect(result.current.displayItems.map((r) => r.name)).toEqual(['Alice', 'Charlie', 'Diana']);
    rerender({ data: other });
    expect(result.current.displayItems.map((r) => r.name)).toEqual(['Xan', 'Sam']);
  });

  it('re-filters a same-length replacement without getRowId', () => {
    const { result, rerender } = renderHook(
      ({ data }) => useOGridDataFetching(makeParams({ displayData: data, stableFilters: filters })),
      { initialProps: { data: testData } },
    );
    rerender({ data: other });
    expect(result.current.displayItems.map((r) => r.name)).toEqual(['Xan', 'Sam']);
  });

  it('re-filters when every row object is replaced but ids still match by position', () => {
    // Polling refresh: same ids, brand-new objects, one row now matches the filter differently.
    const refreshed = testData.map((r) => (r.id === 2 ? { ...r, name: 'Barbara' } : { ...r }));
    const { result, rerender } = renderHook(
      ({ data }) => useOGridDataFetching(makeParams({ displayData: data, stableFilters: filters, getRowId: (r) => r.id })),
      { initialProps: { data: testData } },
    );
    expect(result.current.displayItems.map((r) => r.name)).toEqual(['Alice', 'Charlie', 'Diana']);
    rerender({ data: refreshed });
    expect(result.current.displayItems.map((r) => r.name)).toEqual(['Alice', 'Barbara', 'Charlie', 'Diana']);
  });

  it('keeps snapshot order and filter membership after a cell edit', () => {
    const sort = { field: 'age', direction: 'asc' as const };
    const noFilters = {};
    const { result, rerender } = renderHook(
      ({ data }) => useOGridDataFetching(makeParams({ displayData: data, sort, sortVersion: 1, stableFilters: noFilters, getRowId: (r) => r.id })),
      { initialProps: { data: testData } },
    );
    expect(result.current.displayItems.map((r) => r.id)).toEqual([5, 2, 4, 1, 3]);
    const edited = testData.map((r) => (r.id === 5 ? { ...r, age: 99 } : r));
    rerender({ data: edited });
    // Edited row stays in place (Excel-like) instead of jumping to the end.
    expect(result.current.displayItems.map((r) => r.id)).toEqual([5, 2, 4, 1, 3]);
    expect(result.current.displayItems[0]?.age).toBe(99);
  });
});

const noFilters = {};

describe('useOGridDataFetching  -  swapping dataSource', () => {
  it('refetches when a memoized dataSource is replaced', async () => {
    const makeSource = (label: string) => ({
      fetchPage: mock(() => Promise.resolve({ items: [{ id: 1, name: label, age: 1 }], totalCount: 1 })),
    });
    const a = makeSource('from-a');
    const b = makeSource('from-b');
    const { result, rerender } = renderHook(
      ({ ds }) => useOGridDataFetching(makeParams({ isServerSide: true, dataSource: ds, stableFilters: noFilters })),
      { initialProps: { ds: a } },
    );
    await waitFor(() => expect(result.current.displayItems[0]?.name).toBe('from-a'));
    rerender({ ds: b });
    await waitFor(() => expect(result.current.displayItems[0]?.name).toBe('from-b'));
    expect(b.fetchPage).toHaveBeenCalled();
  });

  it('does not refetch in a loop for an inline dataSource', async () => {
    const fetchPage = mock(() => Promise.resolve({ items: [{ id: 1, name: 'x', age: 1 }], totalCount: 1 }));
    const { result } = renderHook(() =>
      useOGridDataFetching(makeParams({ isServerSide: true, dataSource: { fetchPage }, stableFilters: noFilters })),
    );
    await waitFor(() => expect(result.current.displayItems).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchPage.mock.calls.length).toBeLessThanOrEqual(2);
  });
});

describe('useOGridDataFetching  -  controlled sort with worker sort (D01)', () => {
  it('re-sorts when only sort.field/direction change', async () => {
    const { result, rerender } = renderHook(
      ({ sort }) => useOGridDataFetching(makeParams({ workerSort: true, sort, stableFilters: noFilters })),
      { initialProps: { sort: { field: 'age', direction: 'asc' as 'asc' | 'desc' } } },
    );
    await waitFor(() => {
      expect(result.current.displayItems[0]?.name).toBe('Eve');
    });
    rerender({ sort: { field: 'age', direction: 'desc' } });
    await waitFor(() => {
      expect(result.current.displayItems[0]?.name).toBe('Charlie');
    });
  });
});

describe('useOGridDataFetching  -  worker pending state (D02)', () => {
  it('reports workerPending until the first worker result lands', async () => {
    const { result } = renderHook(() => useOGridDataFetching(makeParams({ workerSort: true, stableFilters: noFilters })));
    expect(result.current.workerPending).toBe(true);
    await waitFor(() => {
      expect(result.current.workerPending).toBe(false);
    });
    expect(result.current.displayItems).toHaveLength(5);
  });

  it('is never pending on the sync path', () => {
    const { result } = renderHook(() => useOGridDataFetching(makeParams()));
    expect(result.current.workerPending).toBe(false);
  });
});

describe('useOGridDataFetching  -  repeated row references (S13)', () => {
  it('keeps both occurrences and picks up an edit of the first after a sort', () => {
    const dup = { id: 1, name: 'Dup', age: 10 };
    const other = { id: 2, name: 'Other', age: 5 };
    const sort = { field: 'age', direction: 'asc' as const };
    const { result, rerender } = renderHook(
      ({ data }) => useOGridDataFetching(makeParams({ displayData: data, sort, sortVersion: 1, stableFilters: noFilters })),
      { initialProps: { data: [dup, other, dup] as TestRow[] } },
    );
    expect(result.current.displayItems.map((r) => r.name)).toEqual(['Other', 'Dup', 'Dup']);
    const edited = { ...dup, name: 'Edited' };
    rerender({ data: [edited, other, dup] });
    expect(result.current.displayItems.map((r) => r.name)).toEqual(['Other', 'Edited', 'Dup']);
  });
});

describe('useOGridDataFetching  -  inserts and deletes keep the sort snapshot by row id', () => {
  const ageAsc = { field: 'age', direction: 'asc' as const };
  const rowId = (r: TestRow) => r.id;
  const frank: TestRow = { id: 6, name: 'Frank', age: 1 }; // would sort first
  const otto: TestRow = { id: 6, name: 'Otto', age: 1 }; // would sort first; no "a" in the name
  const ids = (rows: readonly TestRow[]) => rows.map((r) => r.id);
  type Props = { data: TestRow[]; sortVersion?: number; sort?: typeof ageAsc; filters?: UseOGridDataFetchingParams<TestRow>['stableFilters']; page?: number; noRowId?: boolean; workerSort?: boolean };

  function renderSorted(initial: Props, editVersionRef?: { current: number }) {
    return renderHook(
      ({ data, sortVersion = 1, sort = ageAsc, filters = noFilters, page = 1, noRowId, workerSort }: Props) =>
        useOGridDataFetching(makeParams({ displayData: data, sort, sortVersion, stableFilters: filters, getRowId: noRowId ? undefined : rowId, page, pageSize: 3, workerSort, editVersionRef })),
      { initialProps: initial },
    );
  }

  it('appends an inserted row last, on the last page, without re-sorting', () => {
    const { result, rerender } = renderSorted({ data: testData });
    expect(ids(result.current.displayItems)).toEqual([5, 2, 4]);
    rerender({ data: [...testData, frank] });
    expect(ids(result.current.allFilteredItems)).toEqual([5, 2, 4, 1, 3, 6]);
    expect(result.current.displayTotalCount).toBe(6);
    rerender({ data: [...testData, frank], page: 2 });
    expect(ids(result.current.displayItems)).toEqual([1, 3, 6]);
  });

  it('inserting at the front still appends to the visual order', () => {
    const { result, rerender } = renderSorted({ data: testData });
    rerender({ data: [frank, ...testData] });
    expect(ids(result.current.allFilteredItems)).toEqual([5, 2, 4, 1, 3, 6]);
  });

  it('drops a deleted row and keeps the others in place', () => {
    const { result, rerender } = renderSorted({ data: testData });
    rerender({ data: testData.filter((r) => r.id !== 2) });
    expect(ids(result.current.allFilteredItems)).toEqual([5, 4, 1, 3]);
    expect(result.current.displayTotalCount).toBe(4);
  });

  it('an explicit sort after an insert places the new row where it sorts', () => {
    const { result, rerender } = renderSorted({ data: testData });
    const inserted = [...testData, frank];
    rerender({ data: inserted });
    expect(ids(result.current.allFilteredItems)).toEqual([5, 2, 4, 1, 3, 6]);
    rerender({ data: inserted, sortVersion: 2 });
    expect(ids(result.current.allFilteredItems)).toEqual([6, 5, 2, 4, 1, 3]);
  });

  it('with an active filter, a non-matching insert stays hidden and a matching one is appended', () => {
    // Names containing "a": Diana(28), Alice(30), Charlie(35).
    const filters = { name: { type: 'text' as const, value: 'a' } };
    const { result, rerender } = renderSorted({ data: testData, filters });
    expect(ids(result.current.allFilteredItems)).toEqual([4, 1, 3]);
    const withOtto = [...testData, otto];
    rerender({ data: withOtto, filters });
    expect(ids(result.current.allFilteredItems)).toEqual([4, 1, 3]);
    const hanna: TestRow = { id: 7, name: 'Hanna', age: 2 };
    rerender({ data: [...withOtto, hanna], filters });
    expect(ids(result.current.allFilteredItems)).toEqual([4, 1, 3, 7]);
    // Re-sorting puts the appended row where it belongs; Otto stays filtered out.
    rerender({ data: [...withOtto, hanna], filters, sortVersion: 2 });
    expect(ids(result.current.allFilteredItems)).toEqual([7, 4, 1, 3]);
  });

  it('a hidden row edited to match the filter stays hidden until the user re-filters', () => {
    const filters = { name: { type: 'text' as const, value: 'a' } };
    const { result, rerender } = renderSorted({ data: testData, filters });
    rerender({ data: testData.map((r) => (r.id === 5 ? { ...r, name: 'Eva' } : r)), filters });
    expect(ids(result.current.allFilteredItems)).toEqual([4, 1, 3]);
  });

  it('without getRowId an insert re-sorts (positional snapshot, old behavior)', () => {
    const { result, rerender } = renderSorted({ data: testData, noRowId: true });
    rerender({ data: [...testData, frank], noRowId: true });
    expect(ids(result.current.allFilteredItems)).toEqual([6, 5, 2, 4, 1, 3]);
  });

  it('duplicate ids fall back to a full re-sort', () => {
    const dupA: TestRow = { id: 1, name: 'A', age: 30 };
    const dupB: TestRow = { id: 1, name: 'B', age: 25 };
    const data = [dupA, dupB, testData[2]!];
    const { result, rerender } = renderSorted({ data });
    expect(result.current.allFilteredItems.map((r) => r.name)).toEqual(['B', 'A', 'Charlie']);
    rerender({ data: [...data, frank] });
    expect(result.current.allFilteredItems.map((r) => r.name)).toEqual(['Frank', 'B', 'A', 'Charlie']);
  });

  it('a host that rebuilds every row while adding one (no grid edit) gets a full re-sort', () => {
    const { result, rerender } = renderSorted({ data: testData });
    rerender({ data: [...testData.map((r) => ({ ...r })), frank] });
    expect(ids(result.current.allFilteredItems)).toEqual([6, 5, 2, 4, 1, 3]);
  });

  it('a host that rebuilds every row while applying a grid edit keeps the order and appends', () => {
    const editVersionRef = { current: 0 };
    const { result, rerender } = renderSorted({ data: testData }, editVersionRef);
    editVersionRef.current++;
    rerender({ data: [...testData.map((r) => ({ ...r })), frank] });
    expect(ids(result.current.allFilteredItems)).toEqual([5, 2, 4, 1, 3, 6]);
  });

  describe('worker path', () => {
    beforeEach(() => {
      (processClientSideDataAsync as jest.Mock).mockClear();
    });

    it('keeps the order on insert and delete without another worker round trip', async () => {
      const { result, rerender } = renderSorted({ data: testData, workerSort: true });
      await waitFor(() => expect(ids(result.current.allFilteredItems)).toEqual([5, 2, 4, 1, 3]));
      expect(processClientSideDataAsync).toHaveBeenCalledTimes(1);

      rerender({ data: [...testData, frank], workerSort: true });
      await waitFor(() => expect(ids(result.current.allFilteredItems)).toEqual([5, 2, 4, 1, 3, 6]));
      expect(result.current.displayTotalCount).toBe(6);

      rerender({ data: [...testData, frank].filter((r) => r.id !== 2), workerSort: true });
      await waitFor(() => expect(ids(result.current.allFilteredItems)).toEqual([5, 4, 1, 3, 6]));
      expect(processClientSideDataAsync).toHaveBeenCalledTimes(1);

      rerender({ data: [...testData, frank].filter((r) => r.id !== 2), workerSort: true, sortVersion: 2 });
      await waitFor(() => expect(ids(result.current.allFilteredItems)).toEqual([6, 5, 4, 1, 3]));
      expect(processClientSideDataAsync).toHaveBeenCalledTimes(2);
    });

    it('hides a non-matching insert under an active filter', async () => {
      const filters = { name: { type: 'text' as const, value: 'a' } };
      const { result, rerender } = renderSorted({ data: testData, filters, workerSort: true });
      await waitFor(() => expect(ids(result.current.allFilteredItems)).toEqual([4, 1, 3]));
      rerender({ data: [...testData, otto], filters, workerSort: true });
      await waitFor(() => expect(result.current.allFilteredItems.length).toBeGreaterThan(0));
      expect(ids(result.current.allFilteredItems)).toEqual([4, 1, 3]);
    });

    it('without getRowId an insert re-sorts through the worker', async () => {
      const { result, rerender } = renderSorted({ data: testData, workerSort: true, noRowId: true });
      await waitFor(() => expect(ids(result.current.allFilteredItems)).toEqual([5, 2, 4, 1, 3]));
      rerender({ data: [...testData, frank], workerSort: true, noRowId: true });
      await waitFor(() => expect(ids(result.current.allFilteredItems)).toEqual([6, 5, 2, 4, 1, 3]));
      expect(processClientSideDataAsync).toHaveBeenCalledTimes(2);
    });
  });
});
