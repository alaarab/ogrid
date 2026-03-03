/**
 * Tests for GridState worker sort: useWorkerSort getter, getProcessedItemsAsync method.
 */
import { GridState } from '../state/GridState';
import type { IColumnDef, OGridOptions } from '../types';

// Mock processClientSideDataAsync from core
jest.mock('@alaarab/ogrid-core', () => {
  const actual = jest.requireActual('@alaarab/ogrid-core');
  return {
    ...actual,
    processClientSideDataAsync: jest.fn((...args: unknown[]) =>
      Promise.resolve(actual.processClientSideData(...args))
    ),
  };
});

import { processClientSideDataAsync } from '@alaarab/ogrid-core';

interface TestRow {
  id: number;
  name: string;
  age: number;
}

const testColumns: IColumnDef<TestRow>[] = [
  { columnId: 'name', name: 'Name', sortable: true },
  { columnId: 'age', name: 'Age', type: 'numeric', sortable: true },
];

const testData: TestRow[] = [
  { id: 1, name: 'Alice', age: 30 },
  { id: 2, name: 'Bob', age: 25 },
  { id: 3, name: 'Charlie', age: 35 },
  { id: 4, name: 'Diana', age: 28 },
  { id: 5, name: 'Eve', age: 22 },
];

function makeOptions(overrides?: Partial<OGridOptions<TestRow>>): OGridOptions<TestRow> {
  return {
    columns: testColumns,
    data: testData,
    getRowId: (item: TestRow) => item.id,
    pageSize: 20,
    ...overrides,
  };
}

beforeEach(() => {
  (processClientSideDataAsync as jest.Mock).mockClear();
});

describe('GridState  -  useWorkerSort getter', () => {
  it('is false by default (workerSort not set)', () => {
    const state = new GridState(makeOptions());
    expect(state.useWorkerSort).toBe(false);
  });

  it('is false when workerSort is explicitly false', () => {
    const state = new GridState(makeOptions({ workerSort: false }));
    expect(state.useWorkerSort).toBe(false);
  });

  it('is true when workerSort is true', () => {
    const state = new GridState(makeOptions({ workerSort: true }));
    expect(state.useWorkerSort).toBe(true);
  });

  it('is false when workerSort is auto and data <= 5000 rows', () => {
    const state = new GridState(makeOptions({ workerSort: 'auto' }));
    expect(state.useWorkerSort).toBe(false); // 5 rows < 5000
  });

  it('is true when workerSort is auto and data > 5000 rows', () => {
    const bigData: TestRow[] = [];
    for (let i = 0; i < 5001; i++) {
      bigData.push({ id: i, name: `Name${i}`, age: i % 100 });
    }
    const state = new GridState(makeOptions({ data: bigData, workerSort: 'auto' }));
    expect(state.useWorkerSort).toBe(true);
  });
});

describe('GridState  -  getProcessedItemsAsync', () => {
  it('falls back to sync when workerSort is false', async () => {
    const state = new GridState(makeOptions({ workerSort: false }));
    const result = await state.getProcessedItemsAsync();

    expect(processClientSideDataAsync).not.toHaveBeenCalled();
    expect(result.items).toHaveLength(5);
    expect(result.totalCount).toBe(5);
  });

  it('uses async path when workerSort is true', async () => {
    const state = new GridState(makeOptions({ workerSort: true }));
    const result = await state.getProcessedItemsAsync();

    expect(processClientSideDataAsync).toHaveBeenCalled();
    expect(result.items).toHaveLength(5);
    expect(result.totalCount).toBe(5);
  });

  it('returns sorted data via async path', async () => {
    const state = new GridState(makeOptions({
      workerSort: true,
      sort: { field: 'age', direction: 'asc' },
    }));
    const result = await state.getProcessedItemsAsync();

    expect(result.items[0].name).toBe('Eve'); // age 22
    expect(result.items[4].name).toBe('Charlie'); // age 35
  });

  it('paginates async results correctly', async () => {
    const state = new GridState(makeOptions({
      workerSort: true,
      pageSize: 2,
    }));
    const result = await state.getProcessedItemsAsync();

    expect(result.items).toHaveLength(2);
    expect(result.totalCount).toBe(5);
  });

  it('falls back to sync for server-side data', async () => {
    const state = new GridState(makeOptions({
      workerSort: true,
      data: undefined,
      dataSource: {
        fetchPage: jest.fn().mockResolvedValue({ items: [], totalCount: 0 }),
      },
    }));

    const result = await state.getProcessedItemsAsync();

    // Server-side uses the server items, not worker sort
    expect(processClientSideDataAsync).not.toHaveBeenCalled();
    expect(result.totalCount).toBe(0);
  });
});

describe('GridState  -  getProcessedItems (sync)', () => {
  it('returns all items with default config', () => {
    const state = new GridState(makeOptions());
    const result = state.getProcessedItems();

    expect(result.items).toHaveLength(5);
    expect(result.totalCount).toBe(5);
  });

  it('sorts items', () => {
    const state = new GridState(makeOptions({
      sort: { field: 'age', direction: 'desc' },
    }));
    const result = state.getProcessedItems();

    expect(result.items[0].name).toBe('Charlie'); // age 35
    expect(result.items[4].name).toBe('Eve'); // age 22
  });

  it('paginates correctly', () => {
    const state = new GridState(makeOptions({ pageSize: 2 }));
    const result = state.getProcessedItems();

    expect(result.items).toHaveLength(2);
    expect(result.totalCount).toBe(5);
  });
});
