import { processClientSideData } from '../clientSideData';
import type { IColumnDef, IFilters } from '../../types';

describe('processClientSideData', () => {
  interface TestItem {
    id: string;
    name: string;
    age: number;
    email: string;
    status: string;
    date: string;
  }

  const mockData: TestItem[] = [
    { id: '1', name: 'Alice', age: 30, email: 'alice@example.com', status: 'active', date: '2024-01-15' },
    { id: '2', name: 'Bob', age: 25, email: 'bob@example.com', status: 'inactive', date: '2024-02-20' },
    { id: '3', name: 'Charlie', age: 35, email: 'charlie@example.com', status: 'active', date: '2024-03-10' },
    { id: '4', name: 'David', age: 28, email: 'david@example.com', status: 'pending', date: '2024-01-05' },
  ];

  const mockColumns: IColumnDef<TestItem>[] = [
    { columnId: 'id', name: 'ID' } as IColumnDef<TestItem>,
    { columnId: 'name', name: 'Name' } as IColumnDef<TestItem>,
    { columnId: 'age', name: 'Age', type: 'numeric' } as IColumnDef<TestItem>,
    { columnId: 'email', name: 'Email' } as IColumnDef<TestItem>,
    { columnId: 'status', name: 'Status' } as IColumnDef<TestItem>,
    { columnId: 'date', name: 'Date', type: 'date' } as IColumnDef<TestItem>,
  ];

  it('returns unmodified data when no filters or sorting', () => {
    const result = processClientSideData(mockData, mockColumns, {});
    expect(result).toEqual(mockData);
  });

  it('filters by text (case-insensitive)', () => {
    const filters: IFilters = {
      name: { type: 'text', value: 'alice' },
    };
    const result = processClientSideData(mockData, mockColumns, filters);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Alice');
  });

  it('filters by text with partial match', () => {
    const filters: IFilters = {
      name: { type: 'text', value: 'ar' },
    };
    const result = processClientSideData(mockData, mockColumns, filters);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Charlie');
  });

  it('ignores empty text filter', () => {
    const filters: IFilters = {
      name: { type: 'text', value: '' },
    };
    const result = processClientSideData(mockData, mockColumns, filters);
    expect(result).toEqual(mockData);
  });

  it('ignores whitespace-only text filter', () => {
    const filters: IFilters = {
      name: { type: 'text', value: '   ' },
    };
    const result = processClientSideData(mockData, mockColumns, filters);
    expect(result).toEqual(mockData);
  });

  it('filters by multiSelect with single value', () => {
    const filters: IFilters = {
      status: { type: 'multiSelect', value: ['active'] },
    };
    const result = processClientSideData(mockData, mockColumns, filters);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.name)).toEqual(['Alice', 'Charlie']);
  });

  it('filters by multiSelect with multiple values', () => {
    const filters: IFilters = {
      status: { type: 'multiSelect', value: ['active', 'pending'] },
    };
    const result = processClientSideData(mockData, mockColumns, filters);
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.name)).toEqual(['Alice', 'Charlie', 'David']);
  });

  it('ignores empty multiSelect filter', () => {
    const filters: IFilters = {
      status: { type: 'multiSelect', value: [] },
    };
    const result = processClientSideData(mockData, mockColumns, filters);
    expect(result).toEqual(mockData);
  });

  it('filters by people (email match)', () => {
    const filters: IFilters = {
      email: { type: 'people', value: { displayName: 'Bob', email: 'bob@example.com' } },
    };
    const result = processClientSideData(mockData, mockColumns, filters);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Bob');
  });

  it('filters by people case-insensitive', () => {
    const filters: IFilters = {
      email: { type: 'people', value: { displayName: 'Bob', email: 'BOB@EXAMPLE.COM' } },
    };
    const result = processClientSideData(mockData, mockColumns, filters);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Bob');
  });

  it('filters by date with from only', () => {
    const filters: IFilters = {
      date: { type: 'date', value: { from: '2024-02-01' } },
    };
    const result = processClientSideData(mockData, mockColumns, filters);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.name)).toEqual(['Bob', 'Charlie']);
  });

  it('filters by date with to only', () => {
    const filters: IFilters = {
      date: { type: 'date', value: { to: '2024-01-31' } },
    };
    const result = processClientSideData(mockData, mockColumns, filters);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.name)).toEqual(['Alice', 'David']);
  });

  it('filters by date with from and to range', () => {
    const filters: IFilters = {
      date: { type: 'date', value: { from: '2024-01-10', to: '2024-02-28' } },
    };
    const result = processClientSideData(mockData, mockColumns, filters);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.name)).toEqual(['Alice', 'Bob']);
  });

  it('filters out invalid dates', () => {
    const dataWithInvalidDate: TestItem[] = [
      ...mockData,
      { id: '5', name: 'Eve', age: 32, email: 'eve@example.com', status: 'active', date: 'invalid-date' },
    ];
    const filters: IFilters = {
      date: { type: 'date', value: { from: '2024-01-01' } },
    };
    const result = processClientSideData(dataWithInvalidDate, mockColumns, filters);
    expect(result).toHaveLength(4);
    expect(result.map((r) => r.name)).not.toContain('Eve');
  });

  it('combines multiple filters with AND logic', () => {
    const filters: IFilters = {
      status: { type: 'multiSelect', value: ['active'] },
      age: { type: 'text', value: '30' },
    };
    const result = processClientSideData(mockData, mockColumns, filters);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Alice');
  });

  it('sorts by text column ascending', () => {
    const result = processClientSideData(mockData, mockColumns, {}, 'name', 'asc');
    expect(result.map((r) => r.name)).toEqual(['Alice', 'Bob', 'Charlie', 'David']);
  });

  it('sorts by text column descending', () => {
    const result = processClientSideData(mockData, mockColumns, {}, 'name', 'desc');
    expect(result.map((r) => r.name)).toEqual(['David', 'Charlie', 'Bob', 'Alice']);
  });

  it('sorts by numeric column ascending', () => {
    const result = processClientSideData(mockData, mockColumns, {}, 'age', 'asc');
    expect(result.map((r) => r.age)).toEqual([25, 28, 30, 35]);
  });

  it('sorts by numeric column descending', () => {
    const result = processClientSideData(mockData, mockColumns, {}, 'age', 'desc');
    expect(result.map((r) => r.age)).toEqual([35, 30, 28, 25]);
  });

  it('sorts by date column ascending', () => {
    const result = processClientSideData(mockData, mockColumns, {}, 'date', 'asc');
    expect(result.map((r) => r.date)).toEqual(['2024-01-05', '2024-01-15', '2024-02-20', '2024-03-10']);
  });

  it('sorts by date column descending', () => {
    const result = processClientSideData(mockData, mockColumns, {}, 'date', 'desc');
    expect(result.map((r) => r.date)).toEqual(['2024-03-10', '2024-02-20', '2024-01-15', '2024-01-05']);
  });

  it('uses custom compare function when provided', () => {
    const columnsWithCompare: IColumnDef<TestItem>[] = [
      {
        columnId: 'name',
        name: 'Name',
        compare: (a, b) => a.age - b.age, // Sort by age instead of name
      } as IColumnDef<TestItem>,
      ...mockColumns.filter(c => c.columnId !== 'name'),
    ];
    const result = processClientSideData(mockData, columnsWithCompare, {}, 'name', 'asc');
    // Sorted by age ascending: Bob(25), David(28), Alice(30), Charlie(35)
    expect(result.map((r) => r.name)).toEqual(['Bob', 'David', 'Alice', 'Charlie']);
  });

  it('handles null values in sorting', () => {
    const dataWithNulls = [
      { id: '1', name: 'Alice', age: 30, email: 'alice@example.com', status: 'active', date: '2024-01-15' },
      { id: '2', name: null as unknown as string, age: 25, email: 'bob@example.com', status: 'inactive', date: '2024-02-20' },
      { id: '3', name: 'Charlie', age: 35, email: 'charlie@example.com', status: 'active', date: '2024-03-10' },
    ];
    const result = processClientSideData(dataWithNulls, mockColumns, {}, 'name', 'asc');
    expect(result[0].id).toBe('2'); // null sorts first
    expect(result[1].name).toBe('Alice');
    expect(result[2].name).toBe('Charlie');
  });

  it('handles null values in descending sort', () => {
    const dataWithNulls = [
      { id: '1', name: 'Alice', age: 30, email: 'alice@example.com', status: 'active', date: '2024-01-15' },
      { id: '2', name: null as unknown as string, age: 25, email: 'bob@example.com', status: 'inactive', date: '2024-02-20' },
      { id: '3', name: 'Charlie', age: 35, email: 'charlie@example.com', status: 'active', date: '2024-03-10' },
    ];
    const result = processClientSideData(dataWithNulls, mockColumns, {}, 'name', 'desc');
    expect(result[0].name).toBe('Charlie');
    expect(result[1].name).toBe('Alice');
    expect(result[2].id).toBe('2'); // null sorts last in desc
  });

  it('applies filters then sorting', () => {
    const filters: IFilters = {
      status: { type: 'multiSelect', value: ['active', 'pending'] },
    };
    const result = processClientSideData(mockData, mockColumns, filters, 'age', 'asc');
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.age)).toEqual([28, 30, 35]);
  });

  it('does not mutate original data array', () => {
    const originalLength = mockData.length;
    const filters: IFilters = {
      status: { type: 'multiSelect', value: ['active'] },
    };
    processClientSideData(mockData, mockColumns, filters, 'name', 'desc');
    expect(mockData).toHaveLength(originalLength);
    expect(mockData[0].name).toBe('Alice'); // Original order unchanged
  });

  it('handles empty data array', () => {
    const result = processClientSideData([], mockColumns, {}, 'name', 'asc');
    expect(result).toEqual([]);
  });

  it('handles columnId not in column definitions (direct object access)', () => {
    const result = processClientSideData(mockData, mockColumns, {}, 'id', 'asc');
    expect(result.map((r) => r.id)).toEqual(['1', '2', '3', '4']);
  });
});
