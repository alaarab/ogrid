import { OGrid } from '../OGrid';
import { GridState } from '../state/GridState';
import type { IColumnDef, OGridOptions } from '../types';
import type { IDataSource, IFetchParams, IPageResult } from '@alaarab/ogrid-core';

interface TestRow {
  id: number;
  name: string;
  age: number;
  department: string;
}

const testColumns: IColumnDef<TestRow>[] = [
  { columnId: 'name', name: 'Name', sortable: true },
  { columnId: 'age', name: 'Age', type: 'numeric', sortable: true },
  { columnId: 'department', name: 'Department' },
];

function generateData(count: number): TestRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Person ${i + 1}`,
    age: 20 + (i % 50),
    department: ['Engineering', 'Marketing', 'Sales'][i % 3],
  }));
}

/** Creates a mock IDataSource that resolves with the given items. */
function createMockDataSource(allItems: TestRow[]): IDataSource<TestRow> & { fetchMock: jest.Mock } {
  const fetchMock = jest.fn((params: IFetchParams) => {
    const start = (params.page - 1) * params.pageSize;
    const end = start + params.pageSize;
    const items = allItems.slice(start, end);
    return Promise.resolve({
      items,
      totalCount: allItems.length,
    } as IPageResult<TestRow>);
  });

  return {
    fetchPage: fetchMock,
    fetchMock,
  };
}

function createServerGrid(
  dataSource: IDataSource<TestRow>,
  extra?: Partial<OGridOptions<TestRow>>
) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const grid = new OGrid<TestRow>(container, {
    columns: testColumns,
    dataSource,
    getRowId: (item: TestRow) => item.id,
    pageSize: 10,
    cellSelection: false,
    ...extra,
  });
  return { container, grid };
}

afterEach(() => {
  document.body.innerHTML = '';
});

// ============================================================
// GridState Server-Side Unit Tests
// ============================================================

describe('GridState (server-side)', () => {
  it('isServerSide is true when dataSource is provided', async () => {
    const ds = createMockDataSource(generateData(20));
    const state = new GridState<TestRow>({
      columns: testColumns,
      dataSource: ds,
      getRowId: (item) => item.id,
      pageSize: 10,
    });

    expect(state.isServerSide).toBe(true);
    expect(state.isLoading).toBe(true);

    // Wait for initial fetch
    await new Promise((r) => setTimeout(r, 50));

    expect(state.isLoading).toBe(false);
    expect(ds.fetchMock).toHaveBeenCalledTimes(1);
    expect(ds.fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 10, signal: expect.anything() })
    );

    const { items, totalCount } = state.getProcessedItems();
    expect(items.length).toBe(10);
    expect(totalCount).toBe(20);

    state.destroy();
  });

  it('isServerSide is false when data array is provided', () => {
    const state = new GridState<TestRow>({
      columns: testColumns,
      data: generateData(5),
      getRowId: (item) => item.id,
      pageSize: 10,
    });

    expect(state.isServerSide).toBe(false);
    state.destroy();
  });

  it('setPage triggers a new fetch for server-side', async () => {
    const ds = createMockDataSource(generateData(30));
    const state = new GridState<TestRow>({
      columns: testColumns,
      dataSource: ds,
      getRowId: (item) => item.id,
      pageSize: 10,
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(ds.fetchMock).toHaveBeenCalledTimes(1);

    state.setPage(2);
    await new Promise((r) => setTimeout(r, 50));

    expect(ds.fetchMock).toHaveBeenCalledTimes(2);
    expect(ds.fetchMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2, pageSize: 10, signal: expect.anything() })
    );

    const { items } = state.getProcessedItems();
    expect(items.length).toBe(10);
    expect(items[0].id).toBe(11);

    state.destroy();
  });

  it('setSort triggers fetch with sort params', async () => {
    const ds = createMockDataSource(generateData(15));
    const state = new GridState<TestRow>({
      columns: testColumns,
      dataSource: ds,
      getRowId: (item) => item.id,
      pageSize: 10,
    });

    await new Promise((r) => setTimeout(r, 50));

    state.setSort({ field: 'name', direction: 'asc' });
    await new Promise((r) => setTimeout(r, 50));

    expect(ds.fetchMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        page: 1,
        sort: { field: 'name', direction: 'asc' },
      })
    );

    state.destroy();
  });

  it('setFilter triggers fetch with filter params', async () => {
    const ds = createMockDataSource(generateData(15));
    const state = new GridState<TestRow>({
      columns: testColumns,
      dataSource: ds,
      getRowId: (item) => item.id,
      pageSize: 10,
    });

    await new Promise((r) => setTimeout(r, 50));

    state.setFilter('name', { type: 'text', value: 'Person' });
    await new Promise((r) => setTimeout(r, 50));

    expect(ds.fetchMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        page: 1,
        filters: { name: { type: 'text', value: 'Person' } },
      })
    );

    state.destroy();
  });

  it('clearFilters resets page to 1 and fetches', async () => {
    const ds = createMockDataSource(generateData(30));
    const state = new GridState<TestRow>({
      columns: testColumns,
      dataSource: ds,
      getRowId: (item) => item.id,
      pageSize: 10,
    });

    await new Promise((r) => setTimeout(r, 50));

    state.setFilter('name', { type: 'text', value: 'test' });
    state.setPage(2);
    await new Promise((r) => setTimeout(r, 50));

    state.clearFilters();
    await new Promise((r) => setTimeout(r, 50));

    expect(ds.fetchMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, filters: {} })
    );

    state.destroy();
  });

  it('stale fetch responses are discarded', async () => {
    let resolveFirst: (v: IPageResult<TestRow>) => void;
    let resolveSecond: (v: IPageResult<TestRow>) => void;

    const fetchMock = jest.fn()
      .mockImplementationOnce(() => new Promise<IPageResult<TestRow>>((r) => { resolveFirst = r; }))
      .mockImplementationOnce(() => new Promise<IPageResult<TestRow>>((r) => { resolveSecond = r; }));

    const ds: IDataSource<TestRow> = { fetchPage: fetchMock };

    const state = new GridState<TestRow>({
      columns: testColumns,
      dataSource: ds,
      getRowId: (item) => item.id,
      pageSize: 10,
    });

    // Initial fetch is pending  -  trigger another fetch
    state.setPage(2);

    // Resolve the second fetch first
    resolveSecond!({ items: generateData(5), totalCount: 5 });
    await new Promise((r) => setTimeout(r, 50));

    // Now resolve the first (stale) fetch
    resolveFirst!({ items: generateData(10), totalCount: 10 });
    await new Promise((r) => setTimeout(r, 50));

    // State should reflect the second fetch (totalCount 5), not the stale first
    const { totalCount } = state.getProcessedItems();
    expect(totalCount).toBe(5);

    state.destroy();
  });

  it('calls onError when fetchPage rejects', async () => {
    const onError = jest.fn();
    const ds: IDataSource<TestRow> = {
      fetchPage: jest.fn().mockRejectedValue(new Error('Network error')),
    };

    const state = new GridState<TestRow>({
      columns: testColumns,
      dataSource: ds,
      getRowId: (item) => item.id,
      pageSize: 10,
      onError,
    });

    await new Promise((r) => setTimeout(r, 50));

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(state.isLoading).toBe(false);

    const { items, totalCount } = state.getProcessedItems();
    expect(items.length).toBe(0);
    expect(totalCount).toBe(0);

    state.destroy();
  });

  it('calls onFirstDataRendered once', async () => {
    const onFirstDataRendered = jest.fn();
    const ds = createMockDataSource(generateData(10));
    const state = new GridState<TestRow>({
      columns: testColumns,
      dataSource: ds,
      getRowId: (item) => item.id,
      pageSize: 10,
      onFirstDataRendered,
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(onFirstDataRendered).toHaveBeenCalledTimes(1);

    // Page change should NOT call it again
    state.setPage(1);
    await new Promise((r) => setTimeout(r, 50));
    expect(onFirstDataRendered).toHaveBeenCalledTimes(1);

    state.destroy();
  });

  it('refreshData triggers a re-fetch', async () => {
    const ds = createMockDataSource(generateData(15));
    const state = new GridState<TestRow>({
      columns: testColumns,
      dataSource: ds,
      getRowId: (item) => item.id,
      pageSize: 10,
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(ds.fetchMock).toHaveBeenCalledTimes(1);

    state.refreshData();
    await new Promise((r) => setTimeout(r, 50));
    expect(ds.fetchMock).toHaveBeenCalledTimes(2);

    state.destroy();
  });

  it('setRowData is a no-op in server-side mode', async () => {
    const ds = createMockDataSource(generateData(10));
    const state = new GridState<TestRow>({
      columns: testColumns,
      dataSource: ds,
      getRowId: (item) => item.id,
      pageSize: 10,
    });

    await new Promise((r) => setTimeout(r, 50));

    const api = state.getApi();
    const initialCount = ds.fetchMock.mock.calls.length;

    api.setRowData(generateData(5));

    // Should not have triggered a new fetch  -  it's a no-op
    expect(ds.fetchMock).toHaveBeenCalledTimes(initialCount);
    // Items should still be server-side data
    const { totalCount } = state.getProcessedItems();
    expect(totalCount).toBe(10);

    state.destroy();
  });

  it('api.refreshData calls fetchServerData', async () => {
    const ds = createMockDataSource(generateData(15));
    const state = new GridState<TestRow>({
      columns: testColumns,
      dataSource: ds,
      getRowId: (item) => item.id,
      pageSize: 10,
    });

    await new Promise((r) => setTimeout(r, 50));

    const api = state.getApi();
    api.refreshData();
    await new Promise((r) => setTimeout(r, 50));

    expect(ds.fetchMock).toHaveBeenCalledTimes(2);

    state.destroy();
  });
});

// ============================================================
// OGrid Server-Side Integration Tests
// ============================================================

describe('OGrid (server-side)', () => {
  it('shows loading overlay during fetch', () => {
    const ds: IDataSource<TestRow> = {
      fetchPage: jest.fn().mockReturnValue(new Promise(() => {})), // Never resolves
    };

    const { container, grid } = createServerGrid(ds);

    const overlay = container.querySelector('.ogrid-loading-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay!.textContent).toBe('Loading...');

    grid.destroy();
  });

  it('renders server data after fetch resolves', async () => {
    const ds = createMockDataSource(generateData(25));
    const { container, grid } = createServerGrid(ds);

    await new Promise((r) => setTimeout(r, 50));

    const rows = container.querySelectorAll('.ogrid-row');
    expect(rows.length).toBe(10);

    const info = container.querySelector('.ogrid-pagination-info');
    expect(info!.textContent).toBe('1-10 of 25');

    // Loading overlay should be gone
    const overlay = container.querySelector('.ogrid-loading-overlay');
    expect(overlay).toBeNull();

    grid.destroy();
  });

  it('page navigation triggers new fetch', async () => {
    const ds = createMockDataSource(generateData(25));
    const { container, grid } = createServerGrid(ds);

    await new Promise((r) => setTimeout(r, 50));

    // Click next page
    const nextBtns = container.querySelectorAll('.ogrid-pagination-btn');
    const next = nextBtns[nextBtns.length - 1] as HTMLButtonElement;
    next.click();

    await new Promise((r) => setTimeout(r, 50));

    expect(ds.fetchMock).toHaveBeenCalledTimes(2);
    const info = container.querySelector('.ogrid-pagination-info');
    expect(info!.textContent).toBe('11-20 of 25');

    grid.destroy();
  });

  it('api.refreshData triggers re-fetch', async () => {
    const ds = createMockDataSource(generateData(15));
    const { container, grid } = createServerGrid(ds);

    await new Promise((r) => setTimeout(r, 50));
    expect(ds.fetchMock).toHaveBeenCalledTimes(1);

    grid.api.refreshData();
    await new Promise((r) => setTimeout(r, 50));

    expect(ds.fetchMock).toHaveBeenCalledTimes(2);

    grid.destroy();
  });

  it('calls onError for failed fetch', async () => {
    const onError = jest.fn();
    const ds: IDataSource<TestRow> = {
      fetchPage: jest.fn().mockRejectedValue(new Error('fetch failed')),
    };

    const { container, grid } = createServerGrid(ds, { onError });

    await new Promise((r) => setTimeout(r, 50));

    expect(onError).toHaveBeenCalledTimes(1);

    grid.destroy();
  });

  it('calls onFirstDataRendered after first successful fetch', async () => {
    const onFirstDataRendered = jest.fn();
    const ds = createMockDataSource(generateData(10));
    const { container, grid } = createServerGrid(ds, { onFirstDataRendered });

    await new Promise((r) => setTimeout(r, 50));
    expect(onFirstDataRendered).toHaveBeenCalledTimes(1);

    grid.destroy();
  });
});
