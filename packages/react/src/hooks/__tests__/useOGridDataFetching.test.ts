/**
 * Tests for useOGridDataFetching: client-side sync path, async worker path,
 * server-side fetching, and onFirstDataRendered callback.
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { useOGridDataFetching } from '../useOGridDataFetching';
import type { UseOGridDataFetchingParams } from '../useOGridDataFetching';

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
