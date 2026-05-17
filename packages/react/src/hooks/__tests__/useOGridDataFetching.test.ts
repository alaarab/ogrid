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
