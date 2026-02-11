import { getFilterField, mergeFilter, deriveFilterOptionsFromData, getMultiSelectFilterFields } from '../ogridHelpers';
import type { IColumnDef, IFilters } from '../../types';

describe('ogridHelpers', () => {
  describe('getFilterField', () => {
    it('returns columnId when filterable is undefined', () => {
      const col: IColumnDef<{ name: string }> = {
        columnId: 'name',
        name: 'Name',
      };
      expect(getFilterField(col)).toBe('name');
    });

    it('returns filterField when specified', () => {
      const col: IColumnDef<{ name: string }> = {
        columnId: 'name',
        name: 'Name',
        filterable: { type: 'text', filterField: 'customField' },
      };
      expect(getFilterField(col)).toBe('customField');
    });

    it('returns columnId when filterable object has no filterField', () => {
      const col: IColumnDef<{ name: string }> = {
        columnId: 'name',
        name: 'Name',
        filterable: { type: 'text' },
      };
      expect(getFilterField(col)).toBe('name');
    });
  });

  describe('mergeFilter', () => {
    it('adds new text filter', () => {
      const prev: IFilters = {};
      const result = mergeFilter(prev, 'name', { type: 'text', value: 'test' });
      expect(result).toEqual({ name: { type: 'text', value: 'test' } });
    });

    it('adds new multiSelect filter', () => {
      const prev: IFilters = {};
      const result = mergeFilter(prev, 'status', { type: 'multiSelect', value: ['active'] });
      expect(result).toEqual({ status: { type: 'multiSelect', value: ['active'] } });
    });

    it('adds new people filter', () => {
      const prev: IFilters = {};
      const user = { displayName: 'John', email: 'john@example.com' };
      const result = mergeFilter(prev, 'owner', { type: 'people', value: user });
      expect(result).toEqual({ owner: { type: 'people', value: user } });
    });

    it('adds new date filter', () => {
      const prev: IFilters = {};
      const result = mergeFilter(prev, 'created', { type: 'date', value: { from: '2024-01-01', to: '2024-12-31' } });
      expect(result).toEqual({ created: { type: 'date', value: { from: '2024-01-01', to: '2024-12-31' } } });
    });

    it('updates existing filter', () => {
      const prev: IFilters = { name: { type: 'text', value: 'old' } };
      const result = mergeFilter(prev, 'name', { type: 'text', value: 'new' });
      expect(result).toEqual({ name: { type: 'text', value: 'new' } });
    });

    it('removes filter when value is undefined', () => {
      const prev: IFilters = { name: { type: 'text', value: 'test' } };
      const result = mergeFilter(prev, 'name', undefined);
      expect(result).toEqual({});
    });

    it('removes text filter when value is empty string', () => {
      const prev: IFilters = { name: { type: 'text', value: 'test' } };
      const result = mergeFilter(prev, 'name', { type: 'text', value: '' });
      expect(result).toEqual({});
    });

    it('removes text filter when value is whitespace', () => {
      const prev: IFilters = { name: { type: 'text', value: 'test' } };
      const result = mergeFilter(prev, 'name', { type: 'text', value: '   ' });
      expect(result).toEqual({});
    });

    it('removes multiSelect filter when value is empty array', () => {
      const prev: IFilters = { status: { type: 'multiSelect', value: ['active'] } };
      const result = mergeFilter(prev, 'status', { type: 'multiSelect', value: [] });
      expect(result).toEqual({});
    });

    it('removes date filter when both from and to are undefined', () => {
      const prev: IFilters = { created: { type: 'date', value: { from: '2024-01-01' } } };
      const result = mergeFilter(prev, 'created', { type: 'date', value: {} });
      expect(result).toEqual({});
    });

    it('keeps date filter when only from is set', () => {
      const prev: IFilters = {};
      const result = mergeFilter(prev, 'created', { type: 'date', value: { from: '2024-01-01' } });
      expect(result).toEqual({ created: { type: 'date', value: { from: '2024-01-01' } } });
    });

    it('keeps date filter when only to is set', () => {
      const prev: IFilters = {};
      const result = mergeFilter(prev, 'created', { type: 'date', value: { to: '2024-12-31' } });
      expect(result).toEqual({ created: { type: 'date', value: { to: '2024-12-31' } } });
    });

    it('preserves other filters when updating one', () => {
      const prev: IFilters = {
        name: { type: 'text', value: 'test' },
        status: { type: 'multiSelect', value: ['active'] },
      };
      const result = mergeFilter(prev, 'name', { type: 'text', value: 'updated' });
      expect(result).toEqual({
        name: { type: 'text', value: 'updated' },
        status: { type: 'multiSelect', value: ['active'] },
      });
    });

    it('preserves other filters when removing one', () => {
      const prev: IFilters = {
        name: { type: 'text', value: 'test' },
        status: { type: 'multiSelect', value: ['active'] },
      };
      const result = mergeFilter(prev, 'name', undefined);
      expect(result).toEqual({
        status: { type: 'multiSelect', value: ['active'] },
      });
    });

    it('does not mutate original filters object', () => {
      const prev: IFilters = { name: { type: 'text', value: 'test' } };
      const originalPrev = { ...prev };
      mergeFilter(prev, 'name', { type: 'text', value: 'new' });
      expect(prev).toEqual(originalPrev);
    });
  });

  describe('deriveFilterOptionsFromData', () => {
    interface TestItem {
      id: string;
      status: string;
      category: string;
      name: string;
    }

    const mockData: TestItem[] = [
      { id: '1', status: 'active', category: 'A', name: 'Alice' },
      { id: '2', status: 'inactive', category: 'B', name: 'Bob' },
      { id: '3', status: 'active', category: 'A', name: 'Charlie' },
      { id: '4', status: 'pending', category: 'C', name: 'David' },
    ];

    it('derives options for multiSelect columns', () => {
      const columns: IColumnDef<TestItem>[] = [
        { columnId: 'status', name: 'Status', filterable: { type: 'multiSelect' } } as IColumnDef<TestItem>,
      ];
      const result = deriveFilterOptionsFromData(mockData, columns);
      expect(result.status).toEqual(['active', 'inactive', 'pending']);
    });

    it('sorts options alphabetically', () => {
      const columns: IColumnDef<TestItem>[] = [
        { columnId: 'category', name: 'Category', filterable: { type: 'multiSelect' } } as IColumnDef<TestItem>,
      ];
      const result = deriveFilterOptionsFromData(mockData, columns);
      expect(result.category).toEqual(['A', 'B', 'C']);
    });

    it('deduplicates values', () => {
      const columns: IColumnDef<TestItem>[] = [
        { columnId: 'status', name: 'Status', filterable: { type: 'multiSelect' } } as IColumnDef<TestItem>,
      ];
      const result = deriveFilterOptionsFromData(mockData, columns);
      expect(result.status).toEqual(['active', 'inactive', 'pending']);
      expect(result.status.filter((v) => v === 'active')).toHaveLength(1);
    });

    it('excludes null and empty values', () => {
      const dataWithNulls = [
        ...mockData,
        { id: '5', status: null as unknown as string, category: '', name: 'Eve' },
      ];
      const columns: IColumnDef<TestItem>[] = [
        { columnId: 'status', name: 'Status', filterable: { type: 'multiSelect' } } as IColumnDef<TestItem>,
        { columnId: 'category', name: 'Category', filterable: { type: 'multiSelect' } } as IColumnDef<TestItem>,
      ];
      const result = deriveFilterOptionsFromData(dataWithNulls, columns);
      expect(result.status).toEqual(['active', 'inactive', 'pending']);
      expect(result.category).toEqual(['A', 'B', 'C']);
    });

    it('derives options for multiple columns', () => {
      const columns: IColumnDef<TestItem>[] = [
        { columnId: 'status', name: 'Status', filterable: { type: 'multiSelect' } } as IColumnDef<TestItem>,
        { columnId: 'category', name: 'Category', filterable: { type: 'multiSelect' } } as IColumnDef<TestItem>,
      ];
      const result = deriveFilterOptionsFromData(mockData, columns);
      expect(result.status).toEqual(['active', 'inactive', 'pending']);
      expect(result.category).toEqual(['A', 'B', 'C']);
    });

    it('ignores non-multiSelect columns', () => {
      const columns: IColumnDef<TestItem>[] = [
        { columnId: 'name', name: 'Name', filterable: { type: 'text' } } as IColumnDef<TestItem>,
        { columnId: 'status', name: 'Status', filterable: { type: 'multiSelect' } } as IColumnDef<TestItem>,
      ];
      const result = deriveFilterOptionsFromData(mockData, columns);
      expect(result.name).toBeUndefined();
      expect(result.status).toEqual(['active', 'inactive', 'pending']);
    });

    it('uses filterField when specified', () => {
      const columns: IColumnDef<TestItem>[] = [
        { columnId: 'status', name: 'Status', filterable: { type: 'multiSelect', filterField: 'customStatus' } } as IColumnDef<TestItem>,
      ];
      const result = deriveFilterOptionsFromData(mockData, columns);
      expect(result.customStatus).toEqual(['active', 'inactive', 'pending']);
      expect(result.status).toBeUndefined();
    });

    it('returns empty object when no multiSelect columns', () => {
      const columns: IColumnDef<TestItem>[] = [
        { columnId: 'name', name: 'Name', filterable: { type: 'text' } } as IColumnDef<TestItem>,
      ];
      const result = deriveFilterOptionsFromData(mockData, columns);
      expect(result).toEqual({});
    });

    it('handles empty data array', () => {
      const columns: IColumnDef<TestItem>[] = [
        { columnId: 'status', name: 'Status', filterable: { type: 'multiSelect' } } as IColumnDef<TestItem>,
      ];
      const result = deriveFilterOptionsFromData([], columns);
      expect(result.status).toEqual([]);
    });
  });

  describe('getMultiSelectFilterFields', () => {
    interface TestItem {
      status: string;
      category: string;
      name: string;
    }

    it('returns fields for multiSelect columns', () => {
      const columns: IColumnDef<TestItem>[] = [
        { columnId: 'status', name: 'Status', filterable: { type: 'multiSelect' } } as IColumnDef<TestItem>,
        { columnId: 'category', name: 'Category', filterable: { type: 'multiSelect' } } as IColumnDef<TestItem>,
      ];
      const result = getMultiSelectFilterFields(columns);
      expect(result).toEqual(['status', 'category']);
    });

    it('ignores non-multiSelect columns', () => {
      const columns: IColumnDef<TestItem>[] = [
        { columnId: 'name', name: 'Name', filterable: { type: 'text' } } as IColumnDef<TestItem>,
        { columnId: 'status', name: 'Status', filterable: { type: 'multiSelect' } } as IColumnDef<TestItem>,
      ];
      const result = getMultiSelectFilterFields(columns);
      expect(result).toEqual(['status']);
    });

    it('uses filterField when specified', () => {
      const columns: IColumnDef<TestItem>[] = [
        { columnId: 'status', name: 'Status', filterable: { type: 'multiSelect', filterField: 'customStatus' } } as IColumnDef<TestItem>,
      ];
      const result = getMultiSelectFilterFields(columns);
      expect(result).toEqual(['customStatus']);
    });

    it('returns empty array when no multiSelect columns', () => {
      const columns: IColumnDef<TestItem>[] = [
        { columnId: 'name', name: 'Name', filterable: { type: 'text' } } as IColumnDef<TestItem>,
      ];
      const result = getMultiSelectFilterFields(columns);
      expect(result).toEqual([]);
    });

    it('handles empty columns array', () => {
      const result = getMultiSelectFilterFields([]);
      expect(result).toEqual([]);
    });
  });
});
