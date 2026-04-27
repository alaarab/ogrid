// Override the global @angular/core mock for this file so `effect()` is reactive
// (re-runs when read signals change). Needed for server-side fetch tests that
// exercise refetch-on-state-change behavior.
jest.mock('@angular/core', () => {
  const real = jest.requireActual<Record<string, unknown>>(
    '../../jest-mocks/angular-core.cjs.js',
  );
  // Reactive signal/effect pair scoped to this mock.
  type Run = () => void;
  let currentRun: Run | null = null;
  const reactiveSignal = <T>(initial: T) => {
    let value = initial;
    const subs = new Set<Run>();
    const s = (() => {
      if (currentRun) subs.add(currentRun);
      return value;
    }) as ((() => T) & { set: (v: T) => void; update: (fn: (v: T) => T) => void });
    s.set = (v: T) => {
      if (Object.is(v, value)) return;
      value = v;
      for (const fn of [...subs]) {
        try { fn(); } catch { /* ignore */ }
      }
    };
    s.update = (fn: (v: T) => T) => s.set(fn(value));
    return s;
  };
  const reactiveEffect = (fn: (onCleanup: (cb: () => void) => void) => void) => {
    let cleanups: Array<() => void> = [];
    const run: Run = () => {
      for (const c of cleanups) { try { c(); } catch { /* ignore */ } }
      cleanups = [];
      const onCleanup = (cb: () => void) => { cleanups.push(cb); };
      const prev = currentRun;
      currentRun = run;
      try { fn(onCleanup); } finally { currentRun = prev; }
    };
    run();
    return {
      destroy: () => {
        for (const c of cleanups) { try { c(); } catch { /* ignore */ } }
        cleanups = [];
      },
    };
  };
  return { ...real, signal: reactiveSignal, effect: reactiveEffect };
});

import { signal } from '@angular/core';
import { createHeadlessGrid } from '../services/headless-grid';
import type { IColumnDef } from '@alaarab/ogrid-core';

type Row = { id: string; name: string; score: number; status: 'Active' | 'Closed' };

const data: Row[] = [
  { id: '1', name: 'Alice', score: 90, status: 'Active' },
  { id: '2', name: 'Bob', score: 75, status: 'Closed' },
  { id: '3', name: 'Charlie', score: 85, status: 'Active' },
  { id: '4', name: 'Diana', score: 60, status: 'Closed' },
  { id: '5', name: 'Eve', score: 95, status: 'Active' },
  { id: '6', name: 'Frank', score: 70, status: 'Closed' },
];

const columns: IColumnDef<Row>[] = [
  { columnId: 'name', name: 'Name', type: 'text' },
  { columnId: 'score', name: 'Score', type: 'numeric' },
  {
    columnId: 'status',
    name: 'Status',
    type: 'text',
    filterable: { type: 'multiSelect' },
  },
];

const getRowId = (r: Row) => r.id;

describe('createHeadlessGrid (Angular)', () => {
  it('returns rows, columns, and totals on initial setup', () => {
    const grid = createHeadlessGrid({ columns, data, getRowId });

    expect(grid.rows()).toHaveLength(6);
    expect(grid.totalCount()).toBe(6);
    expect(grid.columns()).toHaveLength(3);
    expect(grid.totalPages()).toBe(1);
  });

  it('paginates with initialPageSize', () => {
    const grid = createHeadlessGrid({ columns, data, getRowId, initialPageSize: 2 });

    expect(grid.rows()).toHaveLength(2);
    expect(grid.totalCount()).toBe(6);
    expect(grid.totalPages()).toBe(3);
    expect(grid.rows()[0].id).toBe('1');
  });

  it('moves to next page', () => {
    const grid = createHeadlessGrid({ columns, data, getRowId, initialPageSize: 2 });

    grid.setPage(2);
    expect(grid.rows()[0].id).toBe('3');
  });

  it('sorts ascending via initialSort', () => {
    const grid = createHeadlessGrid({
      columns,
      data,
      getRowId,
      initialSort: { field: 'score', direction: 'asc' },
    });

    expect(grid.rows()[0].name).toBe('Diana');
    expect(grid.rows()[5].name).toBe('Eve');
  });

  it('toggleSort cycles sort direction', () => {
    const grid = createHeadlessGrid({ columns, data, getRowId });

    grid.toggleSort('score');
    expect(grid.sort().field).toBe('score');

    grid.toggleSort('score');
    expect(grid.sort().direction).toBe('desc');
  });

  it('sortIndicator returns reactive arrow', () => {
    const grid = createHeadlessGrid({
      columns,
      data,
      getRowId,
      initialSort: { field: 'name', direction: 'asc' },
    });

    expect(grid.sortIndicator('name')()).toBe('▲');
    expect(grid.sortIndicator('score')()).toBe('');
  });

  it('filters rows via setFilter', () => {
    const grid = createHeadlessGrid({ columns, data, getRowId });

    grid.setFilter('status', { type: 'multiSelect', value: ['Active'] });

    expect(grid.totalCount()).toBe(3);
    expect(grid.hasActiveFilters()).toBe(true);
    expect(grid.rows().every((r) => r.status === 'Active')).toBe(true);
  });

  it('filter changes return to page 1', () => {
    const grid = createHeadlessGrid({ columns, data, getRowId, initialPageSize: 2 });

    grid.setPage(3);
    expect(grid.page()).toBe(3);

    grid.setFilter('status', { type: 'multiSelect', value: ['Active'] });
    expect(grid.page()).toBe(1);
  });

  it('getCellValue resolves column values', () => {
    const grid = createHeadlessGrid({ columns, data, getRowId });

    expect(grid.getCellValue(data[0], 'name')).toBe('Alice');
    expect(grid.getCellValue(data[0], 'score')).toBe(90);
    expect(grid.getCellValue(data[0], 'unknown')).toBeUndefined();
  });

  it('toggleRowSelection toggles a row in/out', () => {
    const grid = createHeadlessGrid({ columns, data, getRowId });

    expect(grid.isRowSelected(data[0])).toBe(false);
    grid.toggleRowSelection(data[0]);
    expect(grid.isRowSelected(data[0])).toBe(true);
    expect(grid.selectedRowIds().size).toBe(1);
    grid.toggleRowSelection(data[0]);
    expect(grid.isRowSelected(data[0])).toBe(false);
  });

  it('selectAllOnPage selects only visible rows', () => {
    const grid = createHeadlessGrid({ columns, data, getRowId, initialPageSize: 2 });

    grid.selectAllOnPage();
    expect(grid.selectedRowIds().size).toBe(2);
    expect(grid.isRowSelected(data[0])).toBe(true);
    expect(grid.isRowSelected(data[2])).toBe(false);
  });

  it('clearSelection empties the set', () => {
    const grid = createHeadlessGrid({ columns, data, getRowId });

    grid.toggleRowSelection(data[0]);
    grid.toggleRowSelection(data[1]);
    expect(grid.selectedRowIds().size).toBe(2);

    grid.clearSelection();
    expect(grid.selectedRowIds().size).toBe(0);
  });

  it('reactively updates when input data signal changes', () => {
    const dataSig = signal<Row[]>(data.slice(0, 3));
    const grid = createHeadlessGrid({ columns, data: dataSig, getRowId });

    expect(grid.totalCount()).toBe(3);

    dataSig.set(data);
    expect(grid.totalCount()).toBe(6);
  });

  describe('server-side mode', () => {
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

    it('fetches initial page on creation', async () => {
      const fetchPage = jest.fn().mockResolvedValue({
        items: data.slice(0, 2),
        totalCount: 6,
      });
      const grid = createHeadlessGrid({
        columns,
        data: [],
        getRowId,
        dataSource: { fetchPage },
        initialPageSize: 2,
      });

      await flush();
      expect(fetchPage).toHaveBeenCalledTimes(1);
      expect(grid.rows()).toHaveLength(2);
      expect(grid.totalCount()).toBe(6);
      expect(grid.serverLoading()).toBe(false);
    });

    it('passes page/pageSize/sort/filters to fetchPage', async () => {
      const fetchPage = jest.fn().mockResolvedValue({ items: [], totalCount: 0 });
      const grid = createHeadlessGrid({
        columns,
        data: [],
        getRowId,
        dataSource: { fetchPage },
        initialSort: { field: 'score', direction: 'desc' },
        initialPageSize: 25,
      });

      await flush();
      expect(fetchPage).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          pageSize: 25,
          sort: { field: 'score', direction: 'desc' },
          filters: {},
        }),
      );

      grid.setPage(2);
      await flush();
      expect(fetchPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2, pageSize: 25 }),
      );
    });

    it('refetches on filter change', async () => {
      const fetchPage = jest.fn().mockResolvedValue({ items: [], totalCount: 0 });
      const grid = createHeadlessGrid({
        columns,
        data: [],
        getRowId,
        dataSource: { fetchPage },
      });

      await flush();
      const initialCalls = fetchPage.mock.calls.length;

      grid.setFilter('status', { type: 'multiSelect', value: ['Active'] });
      await flush();

      expect(fetchPage.mock.calls.length).toBeGreaterThan(initialCalls);
      expect(fetchPage).toHaveBeenLastCalledWith(
        expect.objectContaining({
          filters: { status: { type: 'multiSelect', value: ['Active'] } },
        }),
      );
    });

    it('serverLoading toggles around the fetch', async () => {
      let resolveFetch!: (val: { items: Row[]; totalCount: number }) => void;
      const fetchPage = jest.fn().mockImplementation(
        () => new Promise<{ items: Row[]; totalCount: number }>((r) => { resolveFetch = r; }),
      );
      const grid = createHeadlessGrid({
        columns,
        data: [],
        getRowId,
        dataSource: { fetchPage },
      });

      // While the promise is unresolved, loading is true.
      await flush();
      expect(grid.serverLoading()).toBe(true);

      resolveFetch({ items: data.slice(0, 1), totalCount: 1 });
      await flush();
      expect(grid.serverLoading()).toBe(false);
    });

    it('refreshData triggers a fresh fetch', async () => {
      const fetchPage = jest.fn().mockResolvedValue({ items: [], totalCount: 0 });
      const grid = createHeadlessGrid({
        columns,
        data: [],
        getRowId,
        dataSource: { fetchPage },
      });

      await flush();
      const initialCalls = fetchPage.mock.calls.length;

      grid.refreshData();
      await flush();

      expect(fetchPage.mock.calls.length).toBe(initialCalls + 1);
    });

    it('onError fires when fetchPage rejects', async () => {
      const onError = jest.fn();
      const error = new Error('boom');
      const fetchPage = jest.fn().mockRejectedValue(error);

      const grid = createHeadlessGrid({
        columns,
        data: [],
        getRowId,
        dataSource: { fetchPage },
        onError,
      });

      await flush();
      expect(onError).toHaveBeenCalledWith(error);
      expect(grid.rows()).toEqual([]);
      expect(grid.totalCount()).toBe(0);
    });

    it('stale fetches are discarded (race-condition guard)', async () => {
      // First fetch hangs; second fetch resolves immediately.
      const responses = [
        new Promise<{ items: Row[]; totalCount: number }>(() => { /* never */ }),
        Promise.resolve({ items: data.slice(0, 3), totalCount: 3 }),
      ];
      const fetchPage = jest.fn().mockImplementation(() => responses.shift());

      const grid = createHeadlessGrid({
        columns,
        data: [],
        getRowId,
        dataSource: { fetchPage },
      });

      await flush();
      grid.setPage(2); // triggers the second fetch
      await flush();

      // The second fetch's result wins.
      expect(grid.rows()).toHaveLength(3);
      expect(grid.totalCount()).toBe(3);
    });

    it('client-side mode unchanged when no dataSource', () => {
      const grid = createHeadlessGrid({ columns, data, getRowId });
      expect(grid.serverLoading()).toBe(false);
      expect(grid.rows()).toHaveLength(6);
    });
  });
});
