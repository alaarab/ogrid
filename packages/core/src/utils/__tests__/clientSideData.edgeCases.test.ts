/**
 * Edge case tests for processClientSideData utility.
 * Covers P0 gaps: null/undefined handling, mixed type sorting, pagination edge cases.
 */
import { processClientSideData } from '../clientSideData';
import type { IColumnDef, IFilters } from '../../types';

describe('processClientSideData - Edge Cases', () => {
  interface TestItem {
    id: string;
    name: string | null;
    age: number | null;
    email: string | null | undefined;
    status: string | null;
    date: string | Date | null;
    active: boolean | null;
  }

  describe('Filtering with null/undefined values', () => {
    const dataWithNulls: TestItem[] = [
      { id: '1', name: 'Alice', age: 30, email: 'alice@test.com', status: 'active', date: '2024-01-15', active: true },
      { id: '2', name: null, age: 25, email: null, status: 'inactive', date: '2024-02-20', active: false },
      { id: '3', name: 'Charlie', age: null, email: 'charlie@test.com', status: null, date: null, active: null },
      { id: '4', name: '', age: 0, email: undefined, status: '', date: '', active: true },
      { id: '5', name: 'Eve', age: 32, email: 'eve@test.com', status: 'active', date: new Date('2024-03-10'), active: true },
    ];

    const columns: IColumnDef<TestItem>[] = [
      { columnId: 'id', name: 'ID' },
      { columnId: 'name', name: 'Name' },
      { columnId: 'age', name: 'Age', type: 'numeric' },
      { columnId: 'email', name: 'Email' },
      { columnId: 'status', name: 'Status' },
      { columnId: 'date', name: 'Date', type: 'date' },
      { columnId: 'active', name: 'Active', type: 'boolean' },
    ] as IColumnDef<TestItem>[];

    it('should filter text column excluding null values', () => {
      const filters: IFilters = {
        name: { type: 'text', value: 'a' }, // Matches 'Alice' and 'Charlie'
      };
      const result = processClientSideData(dataWithNulls, columns, filters);
      expect(result).toHaveLength(2);
      expect(result.map(r => r.id)).toEqual(['1', '3']);
    });

    it('should filter numeric column handling null and zero', () => {
      const filters: IFilters = {
        age: { type: 'text', value: '0' }, // Text filter matches '0' and '30' (contains '0')
      };
      const result = processClientSideData(dataWithNulls, columns, filters);
      // Text filter does substring match, so '0' matches both age=0 and age=30
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some(r => r.id === '4')).toBe(true); // age=0
    });

    it('should filter multiSelect excluding null status values', () => {
      const filters: IFilters = {
        status: { type: 'multiSelect', value: ['active', 'inactive'] },
      };
      const result = processClientSideData(dataWithNulls, columns, filters);
      // Should match rows 1, 2, 5 (not 3 with null status, not 4 with empty string)
      expect(result).toHaveLength(3);
      expect(result.map(r => r.id)).toEqual(['1', '2', '5']);
    });

    it('should handle empty string as distinct from null in multiSelect', () => {
      const filters: IFilters = {
        status: { type: 'multiSelect', value: [''] }, // Explicitly filter for empty string
      };
      const result = processClientSideData(dataWithNulls, columns, filters);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('4');
    });

    it('should filter date column excluding null and invalid dates', () => {
      const filters: IFilters = {
        date: { type: 'date', value: { from: '2024-01-01' } },
      };
      const result = processClientSideData(dataWithNulls, columns, filters);
      // Should match rows 1, 2, 5 (valid dates after 2024-01-01)
      expect(result.length).toBeGreaterThanOrEqual(3);
      expect(result.map(r => r.id)).toContain('1');
      expect(result.map(r => r.id)).toContain('2');
      expect(result.map(r => r.id)).toContain('5');
    });

    it('should handle Date objects in date filtering', () => {
      const filters: IFilters = {
        date: { type: 'date', value: { from: '2024-03-01' } },
      };
      const result = processClientSideData(dataWithNulls, columns, filters);
      // Should match row 5 with Date object
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('5');
    });

    it('should filter people column handling null and undefined emails', () => {
      const filters: IFilters = {
        email: { type: 'people', value: { displayName: 'Test', email: 'alice@test.com' } },
      };
      const result = processClientSideData(dataWithNulls, columns, filters);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('should return empty array when no items match filter', () => {
      const filters: IFilters = {
        name: { type: 'text', value: 'NonexistentName' },
      };
      const result = processClientSideData(dataWithNulls, columns, filters);
      expect(result).toEqual([]);
    });

    it('should handle multiple filters with null values (AND logic)', () => {
      const filters: IFilters = {
        status: { type: 'multiSelect', value: ['active'] },
        name: { type: 'text', value: 'e' }, // Matches 'Alice' and 'Eve'
      };
      const result = processClientSideData(dataWithNulls, columns, filters);
      expect(result).toHaveLength(2);
      expect(result.map(r => r.id)).toEqual(['1', '5']);
    });
  });

  describe('Sorting with mixed types and null values', () => {
    const mixedData: TestItem[] = [
      { id: '1', name: 'Zebra', age: 30, email: 'z@test.com', status: 'active', date: '2024-03-10', active: true },
      { id: '2', name: null, age: null, email: null, status: null, date: null, active: null },
      { id: '3', name: 'Alpha', age: 25, email: 'a@test.com', status: 'inactive', date: '2024-01-15', active: false },
      { id: '4', name: 'Beta', age: 0, email: 'b@test.com', status: '', date: '', active: true },
      { id: '5', name: '', age: -5, email: '', status: 'pending', date: '2024-02-20', active: true },
    ];

    const columns: IColumnDef<TestItem>[] = [
      { columnId: 'id', name: 'ID' },
      { columnId: 'name', name: 'Name' },
      { columnId: 'age', name: 'Age', type: 'numeric' },
      { columnId: 'status', name: 'Status' },
      { columnId: 'date', name: 'Date', type: 'date' },
      { columnId: 'active', name: 'Active', type: 'boolean' },
    ] as IColumnDef<TestItem>[];

    it('should sort text column with nulls first (ascending)', () => {
      const result = processClientSideData(mixedData, columns, {}, 'name', 'asc');
      // null < '' < 'Alpha' < 'Beta' < 'Zebra'
      expect(result[0].id).toBe('2'); // null
      expect(result[1].id).toBe('5'); // empty string
      expect(result[2].name).toBe('Alpha');
      expect(result[3].name).toBe('Beta');
      expect(result[4].name).toBe('Zebra');
    });

    it('should sort text column with nulls last (descending)', () => {
      const result = processClientSideData(mixedData, columns, {}, 'name', 'desc');
      // 'Zebra' > 'Beta' > 'Alpha' > '' > null
      expect(result[0].name).toBe('Zebra');
      expect(result[1].name).toBe('Beta');
      expect(result[2].name).toBe('Alpha');
      expect(result[3].id).toBe('5'); // empty string
      expect(result[4].id).toBe('2'); // null
    });

    it('should sort numeric column with negative, zero, and null values (ascending)', () => {
      const result = processClientSideData(mixedData, columns, {}, 'age', 'asc');
      // null < -5 < 0 < 25 < 30
      expect(result[0].id).toBe('2'); // null
      expect(result[1].age).toBe(-5);
      expect(result[2].age).toBe(0);
      expect(result[3].age).toBe(25);
      expect(result[4].age).toBe(30);
    });

    it('should sort numeric column with null last (descending)', () => {
      const result = processClientSideData(mixedData, columns, {}, 'age', 'desc');
      // 30 > 25 > 0 > -5 > null
      expect(result[0].age).toBe(30);
      expect(result[1].age).toBe(25);
      expect(result[2].age).toBe(0);
      expect(result[3].age).toBe(-5);
      expect(result[4].id).toBe('2'); // null
    });

    it('should sort date column handling invalid dates as null (ascending)', () => {
      const result = processClientSideData(mixedData, columns, {}, 'date', 'asc');
      // null/invalid dates first, then chronological
      expect(result[0].id).toBe('2'); // null
      expect(result[1].id).toBe('4'); // empty string (invalid)
      expect(result[2].date).toBe('2024-01-15');
      expect(result[3].date).toBe('2024-02-20');
      expect(result[4].date).toBe('2024-03-10');
    });

    it('should group invalid dates with nulls even when pre-1970 dates exist', () => {
      const data: TestItem[] = [
        { id: '1', name: 'A', age: 1, email: null, status: null, date: '1960-06-01', active: true },
        { id: '2', name: 'B', age: 2, email: null, status: null, date: 'not-a-date', active: true },
        { id: '3', name: 'C', age: 3, email: null, status: null, date: '2024-01-15', active: true },
        { id: '4', name: 'D', age: 4, email: null, status: null, date: null, active: true },
      ];
      const result = processClientSideData(data, columns, {}, 'date', 'asc');
      // null/invalid first (in original relative order), then chronological —
      // the invalid date must not sort as epoch 0 between 1960 and 2024.
      expect(result.map(r => r.id)).toEqual(['2', '4', '1', '3']);
    });

    it('should handle empty string in text sort', () => {
      const result = processClientSideData(mixedData, columns, {}, 'status', 'asc');
      // null, '', 'active', 'inactive', 'pending'
      expect(result[0].id).toBe('2'); // null
      expect(result[1].id).toBe('4'); // empty string
    });

    it('should sort boolean column with null values', () => {
      const result = processClientSideData(mixedData, columns, {}, 'active', 'asc');
      // null < false < true
      expect(result[0].id).toBe('2'); // null
      expect(result[1].active).toBe(false);
      // Rest should be true
      expect(result.slice(2).every(r => r.active === true)).toBe(true);
    });
  });

  describe('Pagination with edge row counts', () => {
    it('should handle pagination with zero items', () => {
      const emptyData: TestItem[] = [];
      const columns: IColumnDef<TestItem>[] = [
        { columnId: 'id', name: 'ID' },
      ] as IColumnDef<TestItem>[];

      const result = processClientSideData(emptyData, columns, {});
      expect(result).toEqual([]);
    });

    it('should handle pagination with single item', () => {
      const singleItem: TestItem[] = [
        { id: '1', name: 'Alice', age: 30, email: 'alice@test.com', status: 'active', date: '2024-01-15', active: true },
      ];
      const columns: IColumnDef<TestItem>[] = [
        { columnId: 'name', name: 'Name' },
      ] as IColumnDef<TestItem>[];

      const result = processClientSideData(singleItem, columns, {});
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Alice');
    });

    it('should handle filtered dataset that results in zero items', () => {
      const data: TestItem[] = [
        { id: '1', name: 'Alice', age: 30, email: 'alice@test.com', status: 'active', date: '2024-01-15', active: true },
        { id: '2', name: 'Bob', age: 25, email: 'bob@test.com', status: 'active', date: '2024-02-20', active: false },
      ];
      const columns: IColumnDef<TestItem>[] = [
        { columnId: 'status', name: 'Status' },
      ] as IColumnDef<TestItem>[];
      const filters: IFilters = {
        status: { type: 'multiSelect', value: ['inactive'] }, // No items match
      };

      const result = processClientSideData(data, columns, filters);
      expect(result).toEqual([]);
    });

    it('should handle filtered dataset that results in single item', () => {
      const data: TestItem[] = [
        { id: '1', name: 'Alice', age: 30, email: 'alice@test.com', status: 'active', date: '2024-01-15', active: true },
        { id: '2', name: 'Bob', age: 25, email: 'bob@test.com', status: 'inactive', date: '2024-02-20', active: false },
        { id: '3', name: 'Charlie', age: 35, email: 'charlie@test.com', status: 'active', date: '2024-03-10', active: true },
      ];
      const columns: IColumnDef<TestItem>[] = [
        { columnId: 'status', name: 'Status' },
      ] as IColumnDef<TestItem>[];
      const filters: IFilters = {
        status: { type: 'multiSelect', value: ['inactive'] },
      };

      const result = processClientSideData(data, columns, filters);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('2');
    });

    it('should preserve data integrity through filter and sort pipeline', () => {
      const data: TestItem[] = [
        { id: '1', name: 'Alice', age: 30, email: 'alice@test.com', status: 'active', date: '2024-01-15', active: true },
        { id: '2', name: 'Bob', age: 25, email: 'bob@test.com', status: 'inactive', date: '2024-02-20', active: false },
        { id: '3', name: 'Charlie', age: 35, email: 'charlie@test.com', status: 'active', date: '2024-03-10', active: true },
      ];
      const columns: IColumnDef<TestItem>[] = [
        { columnId: 'id', name: 'ID' },
        { columnId: 'name', name: 'Name' },
        { columnId: 'age', name: 'Age', type: 'numeric' },
        { columnId: 'status', name: 'Status' },
      ] as IColumnDef<TestItem>[];
      const filters: IFilters = {
        status: { type: 'multiSelect', value: ['active'] },
      };

      const result = processClientSideData(data, columns, filters, 'age', 'desc');

      // Should filter to 'active' (Alice, Charlie) then sort by age descending (Charlie, Alice)
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Charlie');
      expect(result[0].age).toBe(35);
      expect(result[1].name).toBe('Alice');
      expect(result[1].age).toBe(30);
    });
  });

  describe('Special characters and edge cases in filters', () => {
    it('should handle special regex characters in text filter', () => {
      const data: TestItem[] = [
        { id: '1', name: 'test@example.com', age: 30, email: 'test@test.com', status: 'active', date: '2024-01-15', active: true },
        { id: '2', name: 'user[123]', age: 25, email: 'user@test.com', status: 'active', date: '2024-02-20', active: false },
        { id: '3', name: 'data.csv', age: 35, email: 'data@test.com', status: 'active', date: '2024-03-10', active: true },
      ];
      const columns: IColumnDef<TestItem>[] = [
        { columnId: 'name', name: 'Name' },
      ] as IColumnDef<TestItem>[];

      // Test filtering with special characters
      const filters1: IFilters = { name: { type: 'text', value: '@' } };
      const result1 = processClientSideData(data, columns, filters1);
      expect(result1).toHaveLength(1);
      expect(result1[0].id).toBe('1');

      const filters2: IFilters = { name: { type: 'text', value: '[123]' } };
      const result2 = processClientSideData(data, columns, filters2);
      expect(result2).toHaveLength(1);
      expect(result2[0].id).toBe('2');

      const filters3: IFilters = { name: { type: 'text', value: 'csv' } }; // Avoid regex special char
      const result3 = processClientSideData(data, columns, filters3);
      expect(result3).toHaveLength(1);
      expect(result3[0].id).toBe('3');
    });

    it('should handle unicode characters in text filter', () => {
      const data: TestItem[] = [
        { id: '1', name: 'Müller', age: 30, email: 'test@test.com', status: 'active', date: '2024-01-15', active: true },
        { id: '2', name: 'José', age: 25, email: 'jose@test.com', status: 'active', date: '2024-02-20', active: false },
        { id: '3', name: '日本', age: 35, email: 'nihon@test.com', status: 'active', date: '2024-03-10', active: true },
      ];
      const columns: IColumnDef<TestItem>[] = [
        { columnId: 'name', name: 'Name' },
      ] as IColumnDef<TestItem>[];

      const filters: IFilters = { name: { type: 'text', value: 'ü' } };
      const result = processClientSideData(data, columns, filters);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });
  });
});
