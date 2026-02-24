import { extractValueMatrix, processClientSideDataAsync } from '../workerSortFilter';
import { processClientSideData } from '../clientSideData';
import type { IColumnDef, IFilters } from '../../types';

// jsdom does not provide Worker API, so processClientSideDataAsync falls back to sync

describe('extractValueMatrix', () => {
  const columns: IColumnDef<{ name: string; age: number; active: boolean }>[] = [
    { columnId: 'name', name: 'Name' },
    { columnId: 'age', name: 'Age', type: 'numeric' },
    { columnId: 'active', name: 'Active', type: 'boolean' },
  ];

  it('builds correct matrix from data and columns', () => {
    const data = [
      { name: 'Alice', age: 30, active: true },
      { name: 'Bob', age: 25, active: false },
    ];
    const matrix = extractValueMatrix(data, columns);
    expect(matrix).toEqual([
      ['Alice', 30, true],
      ['Bob', 25, false],
    ]);
  });

  it('handles null/undefined values', () => {
    const cols: IColumnDef<{ name: string | null; value: number | undefined }>[] = [
      { columnId: 'name', name: 'Name' },
      { columnId: 'value', name: 'Value' },
    ];
    const data = [
      { name: null, value: undefined },
    ];
    const matrix = extractValueMatrix(data, cols);
    expect(matrix).toEqual([[null, null]]);
  });

  it('converts objects to strings', () => {
    const cols: IColumnDef<{ obj: Record<string, unknown> }>[] = [
      { columnId: 'obj', name: 'Obj' },
    ];
    const data = [{ obj: { foo: 'bar' } }];
    const matrix = extractValueMatrix(data, cols);
    expect(matrix[0][0]).toBe('[object Object]');
  });

  it('handles empty data', () => {
    const matrix = extractValueMatrix([], columns);
    expect(matrix).toEqual([]);
  });
});

describe('processClientSideDataAsync', () => {
  // In jsdom, Worker is not available, so this falls back to sync processClientSideData
  const columns: IColumnDef<{ id: number; name: string; score: number }>[] = [
    { columnId: 'id', name: 'ID', type: 'numeric' },
    { columnId: 'name', name: 'Name' },
    { columnId: 'score', name: 'Score', type: 'numeric' },
  ];

  const data = [
    { id: 1, name: 'Alice', score: 90 },
    { id: 2, name: 'Bob', score: 85 },
    { id: 3, name: 'Charlie', score: 95 },
    { id: 4, name: 'Diana', score: 80 },
  ];

  it('returns all rows when no filters or sort', async () => {
    const result = await processClientSideDataAsync(data, columns, {});
    expect(result).toEqual(data);
  });

  it('filters by text', async () => {
    const filters: IFilters = { name: { type: 'text', value: 'ali' } };
    const result = await processClientSideDataAsync(data, columns, filters);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Alice');
  });

  it('sorts ascending', async () => {
    const result = await processClientSideDataAsync(data, columns, {}, 'score', 'asc');
    expect(result.map(r => r.score)).toEqual([80, 85, 90, 95]);
  });

  it('sorts descending', async () => {
    const result = await processClientSideDataAsync(data, columns, {}, 'score', 'desc');
    expect(result.map(r => r.score)).toEqual([95, 90, 85, 80]);
  });

  it('filters and sorts', async () => {
    const filters: IFilters = { name: { type: 'text', value: 'a' } };
    const result = await processClientSideDataAsync(data, columns, filters, 'score', 'desc');
    // 'a' matches Alice, Charlie, Diana
    expect(result.map(r => r.name)).toEqual(['Charlie', 'Alice', 'Diana']);
  });

  it('falls back to sync for custom compare', async () => {
    const customCols: IColumnDef<{ id: number; name: string; score: number }>[] = [
      ...columns.slice(0, 2),
      { ...columns[2], compare: (a, b) => a.score - b.score },
    ];
    const result = await processClientSideDataAsync(data, customCols, {}, 'score', 'asc');
    expect(result.map(r => r.score)).toEqual([80, 85, 90, 95]);
  });

  it('matches sync processClientSideData output', async () => {
    const filters: IFilters = { name: { type: 'text', value: 'b' } };
    const asyncResult = await processClientSideDataAsync(data, columns, filters, 'id', 'desc');
    const syncResult = processClientSideData(data, columns, filters, 'id', 'desc');
    expect(asyncResult).toEqual(syncResult);
  });
});
