import * as React from 'react';
import { renderHook, act } from '@testing-library/react';
import { useOGrid } from '../useOGrid';
import type { IOGridApi } from '../../types';

type Row = { id: string; name: string; age: number };

const testColumns = [
  { columnId: 'name', name: 'Name' },
  { columnId: 'age', name: 'Age', columnType: 'numeric' as const },
];

const testData: Row[] = [
  { id: '1', name: 'Alice', age: 30 },
  { id: '2', name: 'Bob', age: 25 },
  { id: '3', name: 'Charlie', age: 35 },
  { id: '4', name: 'Diana', age: 28 },
  { id: '5', name: 'Eve', age: 22 },
];

const getRowId = (r: Row) => r.id;

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(React.Fragment, null, children);

/** Build client-side IOGridProps with overrides. Cast avoids discriminated union issue with Partial. */
function makeClientProps(overrides: Record<string, unknown> = {}) {
  return {
    columns: testColumns,
    getRowId,
    data: testData,
    ...overrides,
  } as Parameters<typeof useOGrid<Row>>[0];
}

function renderUseOGrid(overrides: Record<string, unknown> = {}) {
  const apiRef = React.createRef<IOGridApi<Row>>();
  const props = makeClientProps(overrides);
  const hookResult = renderHook(() => useOGrid(props, apiRef), { wrapper });
  return { ...hookResult, apiRef };
}

describe('useOGrid', () => {
  describe('initialization', () => {
    it('initializes with default props (data and columns)', () => {
      const { result } = renderUseOGrid();

      expect(result.current.dataGridProps.items).toEqual(testData);
      expect(result.current.pagination.page).toBe(1);
      expect(result.current.pagination.pageSize).toBe(25);
      expect(result.current.pagination.displayTotalCount).toBe(5);
    });

    it('uses defaultPageSize when provided', () => {
      const { result } = renderUseOGrid({ defaultPageSize: 2 });

      expect(result.current.pagination.pageSize).toBe(2);
      expect(result.current.dataGridProps.items).toHaveLength(2);
    });

    it('returns all expected result keys', () => {
      const { result } = renderUseOGrid();

      expect(result.current).toHaveProperty('dataGridProps');
      expect(result.current).toHaveProperty('pagination');
      expect(result.current).toHaveProperty('columnChooser');
      expect(result.current).toHaveProperty('layout');
      expect(result.current).toHaveProperty('filters');
    });

    it('initializes all columns as visible by default', () => {
      const { result } = renderUseOGrid();

      expect(result.current.columnChooser.visibleColumns.has('name')).toBe(true);
      expect(result.current.columnChooser.visibleColumns.has('age')).toBe(true);
    });

    it('respects defaultVisible on columns', () => {
      const columns = [
        { columnId: 'name', name: 'Name' },
        { columnId: 'age', name: 'Age', defaultVisible: false },
      ];
      const { result } = renderUseOGrid({ columns });

      expect(result.current.columnChooser.visibleColumns.has('name')).toBe(true);
      expect(result.current.columnChooser.visibleColumns.has('age')).toBe(false);
    });
  });

  describe('pagination', () => {
    it('changes page', () => {
      const { result } = renderUseOGrid({ defaultPageSize: 2 });

      expect(result.current.dataGridProps.items.map((r) => r.name)).toEqual(['Alice', 'Bob']);

      act(() => {
        result.current.pagination.setPage(2);
      });

      expect(result.current.pagination.page).toBe(2);
      expect(result.current.dataGridProps.items.map((r) => r.name)).toEqual(['Charlie', 'Diana']);
    });

    it('changes page size and resets to page 1', () => {
      const { result } = renderUseOGrid({ defaultPageSize: 2 });

      act(() => {
        result.current.pagination.setPage(2);
      });
      expect(result.current.pagination.page).toBe(2);

      act(() => {
        result.current.pagination.setPageSize(10);
      });

      expect(result.current.pagination.pageSize).toBe(10);
      expect(result.current.pagination.page).toBe(1);
    });

    it('uses entityLabelPlural', () => {
      const { result } = renderUseOGrid({ entityLabelPlural: 'records' });

      expect(result.current.pagination.entityLabelPlural).toBe('records');
    });

    it('passes pageSizeOptions through', () => {
      const { result } = renderUseOGrid({ pageSizeOptions: [10, 25, 50] });

      expect(result.current.pagination.pageSizeOptions).toEqual([10, 25, 50]);
    });
  });

  describe('sorting', () => {
    it('applies sort (sorts data)', () => {
      const { result } = renderUseOGrid({ defaultSortBy: 'name', defaultSortDirection: 'asc' });

      expect(result.current.dataGridProps.sortBy).toBe('name');
      expect(result.current.dataGridProps.sortDirection).toBe('asc');
      // Items should be sorted by name ascending
      const names = result.current.dataGridProps.items.map((r) => r.name);
      expect(names).toEqual(['Alice', 'Bob', 'Charlie', 'Diana', 'Eve']);
    });

    it('handles column sort (toggle sort via onColumnSort)', () => {
      const { result } = renderUseOGrid({ defaultSortBy: 'name', defaultSortDirection: 'asc' });

      act(() => {
        result.current.dataGridProps.onColumnSort('age', 'desc');
      });

      expect(result.current.dataGridProps.sortBy).toBe('age');
      expect(result.current.dataGridProps.sortDirection).toBe('desc');
      // Items should now be sorted by age descending
      const ages = result.current.dataGridProps.items.map((r) => r.age);
      expect(ages).toEqual([35, 30, 28, 25, 22]);
    });

    it('resets to page 1 on sort change', () => {
      const { result } = renderUseOGrid({ defaultPageSize: 2 });

      act(() => {
        result.current.pagination.setPage(2);
      });
      expect(result.current.pagination.page).toBe(2);

      act(() => {
        result.current.dataGridProps.onColumnSort('age', 'asc');
      });

      expect(result.current.pagination.page).toBe(1);
    });
  });

  describe('filtering', () => {
    it('applies text filter (client-side)', () => {
      const columns = [
        { columnId: 'name', name: 'Name', filterable: { type: 'text' as const } },
        { columnId: 'age', name: 'Age' },
      ];
      const { result } = renderUseOGrid({ columns });

      act(() => {
        result.current.dataGridProps.onFilterChange!('name', { type: 'text', value: 'Ali' });
      });

      expect(result.current.dataGridProps.items.map((r) => r.name)).toEqual(['Alice']);
      expect(result.current.filters.hasActiveFilters).toBe(true);
    });

    it('clears filter', () => {
      const columns = [
        { columnId: 'name', name: 'Name', filterable: { type: 'text' as const } },
        { columnId: 'age', name: 'Age' },
      ];
      const { result } = renderUseOGrid({ columns });

      act(() => {
        result.current.dataGridProps.onFilterChange!('name', { type: 'text', value: 'Ali' });
      });
      expect(result.current.filters.hasActiveFilters).toBe(true);

      act(() => {
        result.current.filters.setFilters({});
      });

      expect(result.current.filters.hasActiveFilters).toBe(false);
      expect(result.current.dataGridProps.items).toHaveLength(5);
    });

    it('resets to page 1 on filter change', () => {
      const columns = [
        { columnId: 'name', name: 'Name', filterable: { type: 'text' as const } },
        { columnId: 'age', name: 'Age' },
      ];
      const { result } = renderUseOGrid({ columns, defaultPageSize: 2 });

      act(() => {
        result.current.pagination.setPage(2);
      });
      expect(result.current.pagination.page).toBe(2);

      act(() => {
        result.current.dataGridProps.onFilterChange!('name', { type: 'text', value: 'A' });
      });

      expect(result.current.pagination.page).toBe(1);
    });
  });

  describe('column visibility', () => {
    it('hides a column', () => {
      const { result } = renderUseOGrid();

      act(() => {
        result.current.columnChooser.onVisibilityChange('age', false);
      });

      expect(result.current.columnChooser.visibleColumns.has('age')).toBe(false);
      expect(result.current.columnChooser.visibleColumns.has('name')).toBe(true);
    });

    it('shows a hidden column', () => {
      const { result } = renderUseOGrid();

      act(() => {
        result.current.columnChooser.onVisibilityChange('age', false);
      });
      expect(result.current.columnChooser.visibleColumns.has('age')).toBe(false);

      act(() => {
        result.current.columnChooser.onVisibilityChange('age', true);
      });
      expect(result.current.columnChooser.visibleColumns.has('age')).toBe(true);
    });

    it('onSetVisibleColumns replaces visible set', () => {
      const { result } = renderUseOGrid();

      act(() => {
        result.current.columnChooser.onSetVisibleColumns(new Set(['name']));
      });

      expect(result.current.columnChooser.visibleColumns.size).toBe(1);
      expect(result.current.columnChooser.visibleColumns.has('name')).toBe(true);
      expect(result.current.columnChooser.visibleColumns.has('age')).toBe(false);
    });
  });

  describe('column chooser placement', () => {
    it('defaults to toolbar placement', () => {
      const { result } = renderUseOGrid();

      expect(result.current.columnChooser.placement).toBe('toolbar');
    });

    it('sets placement to none when columnChooser is false', () => {
      const { result } = renderUseOGrid({ columnChooser: false });

      expect(result.current.columnChooser.placement).toBe('none');
    });

    it('sets placement to sidebar when columnChooser is sidebar', () => {
      const { result } = renderUseOGrid({ columnChooser: 'sidebar' });

      expect(result.current.columnChooser.placement).toBe('sidebar');
    });
  });

  describe('server-side data source', () => {
    it('calls fetchPage on initialization', async () => {
      const fetchPage = jest.fn().mockResolvedValue({
        items: [{ id: '1', name: 'ServerAlice', age: 30 }],
        totalCount: 1,
      });
      const dataSource = { fetchPage };

      const serverProps = {
        columns: testColumns,
        getRowId,
        dataSource,
      } as Parameters<typeof useOGrid<Row>>[0];

      const { result } = renderHook(
        () => {
          const apiRef = React.createRef<IOGridApi<Row>>();
          return useOGrid<Row>(serverProps, apiRef);
        },
        { wrapper }
      );

      // Wait for the async fetch to complete
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(fetchPage).toHaveBeenCalled();
      expect(fetchPage.mock.calls[0][0]).toMatchObject({
        page: 1,
        pageSize: 25,
      });
      expect(result.current.dataGridProps.items).toEqual([
        { id: '1', name: 'ServerAlice', age: 30 },
      ]);
    });

    it('calls onError callback when fetchPage throws', async () => {
      const fetchError = new Error('Server error');
      const fetchPage = jest.fn().mockRejectedValue(fetchError);
      const onError = jest.fn();
      const dataSource = { fetchPage };

      const serverProps = {
        columns: testColumns,
        getRowId,
        dataSource,
        onError,
      } as Parameters<typeof useOGrid<Row>>[0];

      renderHook(
        () => {
          const apiRef = React.createRef<IOGridApi<Row>>();
          return useOGrid<Row>(serverProps, apiRef);
        },
        { wrapper }
      );

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(fetchError);
    });

    it('isLoading is false after fetch error', async () => {
      const fetchPage = jest.fn().mockRejectedValue(new Error('Failed'));
      const dataSource = { fetchPage };

      const serverProps = {
        columns: testColumns,
        getRowId,
        dataSource,
      } as Parameters<typeof useOGrid<Row>>[0];

      const { result } = renderHook(
        () => {
          const apiRef = React.createRef<IOGridApi<Row>>();
          return useOGrid<Row>(serverProps, apiRef);
        },
        { wrapper }
      );

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(result.current.dataGridProps.isLoading).toBe(false);
    });

    it('grid shows empty items after fetch error (graceful degradation)', async () => {
      const fetchPage = jest.fn().mockRejectedValue(new Error('Network error'));
      const dataSource = { fetchPage };

      const serverProps = {
        columns: testColumns,
        getRowId,
        dataSource,
      } as Parameters<typeof useOGrid<Row>>[0];

      const { result } = renderHook(
        () => {
          const apiRef = React.createRef<IOGridApi<Row>>();
          return useOGrid<Row>(serverProps, apiRef);
        },
        { wrapper }
      );

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(result.current.dataGridProps.items).toEqual([]);
    });

    it('onError receives the exact thrown error object', async () => {
      const specificError = new Error('Specific network failure');
      const fetchPage = jest.fn().mockRejectedValue(specificError);
      const onError = jest.fn();
      const dataSource = { fetchPage };

      const serverProps = {
        columns: testColumns,
        getRowId,
        dataSource,
        onError,
      } as Parameters<typeof useOGrid<Row>>[0];

      renderHook(
        () => {
          const apiRef = React.createRef<IOGridApi<Row>>();
          return useOGrid<Row>(serverProps, apiRef);
        },
        { wrapper }
      );

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(onError).toHaveBeenCalledWith(specificError);
    });

    it('does not call onError on successful fetch', async () => {
      const fetchPage = jest.fn().mockResolvedValue({ items: testData, totalCount: testData.length });
      const onError = jest.fn();
      const dataSource = { fetchPage };

      const serverProps = {
        columns: testColumns,
        getRowId,
        dataSource,
        onError,
      } as Parameters<typeof useOGrid<Row>>[0];

      renderHook(
        () => {
          const apiRef = React.createRef<IOGridApi<Row>>();
          return useOGrid<Row>(serverProps, apiRef);
        },
        { wrapper }
      );

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(onError).not.toHaveBeenCalled();
    });

    it('isLoading is true while fetch is in progress', () => {
      // never resolves — fetch is perpetually in progress
      const fetchPage = jest.fn().mockReturnValue(new Promise(() => {}));
      const dataSource = { fetchPage };

      const serverProps = {
        columns: testColumns,
        getRowId,
        dataSource,
      } as Parameters<typeof useOGrid<Row>>[0];

      const { result } = renderHook(
        () => {
          const apiRef = React.createRef<IOGridApi<Row>>();
          return useOGrid<Row>(serverProps, apiRef);
        },
        { wrapper }
      );

      // Immediately after mount, before fetch resolves, isLoading should be true
      expect(result.current.dataGridProps.isLoading).toBe(true);
    });
  });

  describe('row selection', () => {
    it('selects and deselects rows via selection change handler', () => {
      const onSelectionChange = jest.fn();
      const { result } = renderUseOGrid({
        rowSelection: 'multiple',
        onSelectionChange,
      });

      act(() => {
        result.current.dataGridProps.onSelectionChange!({
          selectedRowIds: ['1', '2'],
          selectedItems: [testData[0], testData[1]],
        });
      });

      expect(result.current.dataGridProps.selectedRows!.has('1')).toBe(true);
      expect(result.current.dataGridProps.selectedRows!.has('2')).toBe(true);
      expect(onSelectionChange).toHaveBeenCalled();
    });

    it('does not update internal state when selectedRows is controlled', () => {
      const controlledSelectedRows = new Set<string>(['1']);
      const { result } = renderUseOGrid({
        rowSelection: 'multiple',
        selectedRows: controlledSelectedRows,
      });

      // Internal state should not change
      expect(result.current.dataGridProps.selectedRows).toBe(controlledSelectedRows);

      act(() => {
        result.current.dataGridProps.onSelectionChange!({
          selectedRowIds: ['1', '2', '3'],
          selectedItems: [testData[0], testData[1], testData[2]],
        });
      });

      // Should still be the controlled set
      expect(result.current.dataGridProps.selectedRows).toBe(controlledSelectedRows);
    });
  });

  describe('API ref', () => {
    it('exposes getSelectedRows', () => {
      const { apiRef } = renderUseOGrid();

      expect(apiRef.current!.getSelectedRows()).toEqual([]);
    });

    it('exposes setSelectedRows and getSelectedRows', () => {
      const { apiRef } = renderUseOGrid();

      act(() => {
        apiRef.current!.setSelectedRows(['1', '3']);
      });

      expect(apiRef.current!.getSelectedRows()).toEqual(['1', '3']);
    });

    it('exposes selectAll', () => {
      const { apiRef } = renderUseOGrid({ defaultPageSize: 2 });

      act(() => {
        apiRef.current!.selectAll();
      });

      // selectAll selects from displayItems (current page only)
      const selected = apiRef.current!.getSelectedRows();
      expect(selected.length).toBeGreaterThan(0);
    });

    it('exposes deselectAll', () => {
      const { apiRef } = renderUseOGrid();

      act(() => {
        apiRef.current!.setSelectedRows(['1', '2']);
      });
      expect(apiRef.current!.getSelectedRows()).toHaveLength(2);

      act(() => {
        apiRef.current!.deselectAll();
      });
      expect(apiRef.current!.getSelectedRows()).toEqual([]);
    });

    it('exposes getDisplayedRows', () => {
      const { apiRef } = renderUseOGrid({ defaultPageSize: 2 });

      const displayed = apiRef.current!.getDisplayedRows();
      expect(displayed).toHaveLength(2);
      expect(displayed.map((r) => r.name)).toEqual(['Alice', 'Bob']);
    });

    it('exposes getColumnState with sort and visibleColumns', () => {
      const { apiRef } = renderUseOGrid({
        defaultSortBy: 'name',
        defaultSortDirection: 'desc',
      });

      const state = apiRef.current!.getColumnState();
      expect(state.sort).toEqual({ field: 'name', direction: 'desc' });
      expect(Array.isArray(state.visibleColumns)).toBe(true);
      expect(state.visibleColumns).toContain('name');
      expect(state.visibleColumns).toContain('age');
    });

    it('exposes applyColumnState', () => {
      const { apiRef } = renderUseOGrid();

      act(() => {
        apiRef.current!.applyColumnState({
          visibleColumns: ['name'],
          sort: { field: 'age', direction: 'desc' },
        });
      });

      const state = apiRef.current!.getColumnState();
      expect(state.visibleColumns).toEqual(['name']);
      expect(state.sort).toEqual({ field: 'age', direction: 'desc' });
    });

    it('exposes clearFilters', () => {
      const columns = [
        { columnId: 'name', name: 'Name', filterable: { type: 'text' as const } },
        { columnId: 'age', name: 'Age' },
      ];
      const { apiRef, result } = renderUseOGrid({ columns });

      act(() => {
        apiRef.current!.setFilterModel({ name: { type: 'text', value: 'Alice' } });
      });
      expect(result.current.filters.hasActiveFilters).toBe(true);

      act(() => {
        apiRef.current!.clearFilters();
      });
      expect(result.current.filters.hasActiveFilters).toBe(false);
    });

    it('exposes clearSort (resets to default sort)', () => {
      const { apiRef, result } = renderUseOGrid({
        defaultSortBy: 'name',
        defaultSortDirection: 'asc',
      });

      act(() => {
        apiRef.current!.applyColumnState({ sort: { field: 'age', direction: 'desc' } });
      });
      expect(result.current.dataGridProps.sortBy).toBe('age');

      act(() => {
        apiRef.current!.clearSort();
      });
      expect(result.current.dataGridProps.sortBy).toBe('name');
      expect(result.current.dataGridProps.sortDirection).toBe('asc');
    });

    it('exposes resetGridState (clears filters, sort, and selection)', () => {
      const columns = [
        { columnId: 'name', name: 'Name', filterable: { type: 'text' as const } },
        { columnId: 'age', name: 'Age' },
      ];
      const { apiRef, result } = renderUseOGrid({
        columns,
        defaultSortBy: 'name',
        defaultSortDirection: 'asc',
      });

      act(() => {
        apiRef.current!.setFilterModel({ name: { type: 'text', value: 'Alice' } });
        apiRef.current!.applyColumnState({ sort: { field: 'age', direction: 'desc' } });
        apiRef.current!.setSelectedRows(['1', '2']);
      });

      act(() => {
        apiRef.current!.resetGridState();
      });

      expect(result.current.filters.hasActiveFilters).toBe(false);
      expect(result.current.dataGridProps.sortBy).toBe('name');
      expect(apiRef.current!.getSelectedRows()).toEqual([]);
    });

    it('resetGridState with keepSelection preserves selection', () => {
      const { apiRef } = renderUseOGrid({
        defaultSortBy: 'name',
      });

      act(() => {
        apiRef.current!.setSelectedRows(['1']);
      });

      act(() => {
        apiRef.current!.resetGridState({ keepSelection: true });
      });

      expect(apiRef.current!.getSelectedRows()).toEqual(['1']);
    });

    it('exposes setRowData for client-side data (no data prop)', () => {
      // When no `data` is passed, useOGrid falls back to internalData.
      // setRowData sets the internal data array.
      const { apiRef, result } = renderUseOGrid({ data: undefined });

      expect(result.current.dataGridProps.items).toHaveLength(0);

      act(() => {
        apiRef.current!.setRowData([
          { id: '10', name: 'NewPerson', age: 99 },
        ]);
      });

      expect(result.current.dataGridProps.items).toHaveLength(1);
      expect(result.current.dataGridProps.items[0].name).toBe('NewPerson');
    });

    it('exposes setLoading', () => {
      const { apiRef, result } = renderUseOGrid();

      act(() => {
        apiRef.current!.setLoading(true);
      });

      expect(result.current.dataGridProps.isLoading).toBe(true);

      act(() => {
        apiRef.current!.setLoading(false);
      });

      expect(result.current.dataGridProps.isLoading).toBe(false);
    });

    it('exposes getColumnOrder', () => {
      const { apiRef } = renderUseOGrid();

      const order = apiRef.current!.getColumnOrder();
      expect(order).toEqual(['name', 'age']);
    });
  });

  describe('status bar', () => {
    it('returns undefined when statusBar is not set', () => {
      const { result } = renderUseOGrid();

      expect(result.current.dataGridProps.statusBar).toBeUndefined();
    });

    it('returns status bar config when statusBar is true', () => {
      const { result } = renderUseOGrid({ statusBar: true });

      expect(result.current.dataGridProps.statusBar).toBeDefined();
      expect(result.current.dataGridProps.statusBar!.totalCount).toBe(5);
      expect(result.current.dataGridProps.statusBar!.selectedCount).toBe(0);
    });

    it('returns custom status bar when statusBar is an object', () => {
      const customStatus = { totalCount: 100, filteredCount: 50, selectedCount: 5 };
      const { result } = renderUseOGrid({ statusBar: customStatus });

      expect(result.current.dataGridProps.statusBar).toEqual(customStatus);
    });

    it('includes filteredCount when filters are active', () => {
      const columns = [
        { columnId: 'name', name: 'Name', filterable: { type: 'text' as const } },
        { columnId: 'age', name: 'Age' },
      ];
      const { result } = renderUseOGrid({ columns, statusBar: true });

      act(() => {
        result.current.dataGridProps.onFilterChange!('name', { type: 'text', value: 'Ali' });
      });

      expect(result.current.dataGridProps.statusBar).toBeDefined();
      expect(result.current.dataGridProps.statusBar!.filteredCount).toBeDefined();
    });
  });

  describe('layout', () => {
    it('passes toolbar through', () => {
      const toolbar = 'My Toolbar';
      const { result } = renderUseOGrid({ toolbar });

      expect(result.current.layout.toolbar).toBe('My Toolbar');
    });

    it('passes className through', () => {
      const { result } = renderUseOGrid({ className: 'custom-class' });

      expect(result.current.layout.className).toBe('custom-class');
    });

    it('sidebar is null when not configured', () => {
      const { result } = renderUseOGrid();

      expect(result.current.layout.sideBarProps).toBeNull();
    });

    it('sidebar is present when sideBar is true', () => {
      const { result } = renderUseOGrid({ sideBar: true });

      expect(result.current.layout.sideBarProps).not.toBeNull();
    });
  });

  describe('controlled mode', () => {
    it('uses controlled page when provided', () => {
      const { result } = renderUseOGrid({ page: 3, defaultPageSize: 2 });

      expect(result.current.pagination.page).toBe(3);
    });

    it('uses controlled pageSize when provided', () => {
      const { result } = renderUseOGrid({ pageSize: 50 });

      expect(result.current.pagination.pageSize).toBe(50);
    });

    it('uses controlled sort when provided', () => {
      const { result } = renderUseOGrid({
        sort: { field: 'age', direction: 'desc' },
      });

      expect(result.current.dataGridProps.sortBy).toBe('age');
      expect(result.current.dataGridProps.sortDirection).toBe('desc');
    });

    it('uses controlled filters when provided', () => {
      const { result } = renderUseOGrid({
        columns: [
          { columnId: 'name', name: 'Name', filterable: { type: 'text' as const } },
          { columnId: 'age', name: 'Age' },
        ],
        filters: { name: { type: 'text', value: 'Bob' } },
      });

      expect(result.current.dataGridProps.filters).toEqual({
        name: { type: 'text', value: 'Bob' },
      });
    });

    it('uses controlled visibleColumns when provided', () => {
      const controlled = new Set(['name']);
      const { result } = renderUseOGrid({ visibleColumns: controlled });

      expect(result.current.columnChooser.visibleColumns).toBe(controlled);
    });

    it('calls onPageChange when page changes', () => {
      const onPageChange = jest.fn();
      const { result } = renderUseOGrid({ onPageChange });

      act(() => {
        result.current.pagination.setPage(2);
      });

      expect(onPageChange).toHaveBeenCalledWith(2);
    });

    it('calls onSortChange when sort changes', () => {
      const onSortChange = jest.fn();
      const { result } = renderUseOGrid({ onSortChange });

      act(() => {
        result.current.dataGridProps.onColumnSort('age', 'desc');
      });

      expect(onSortChange).toHaveBeenCalled();
    });

    it('calls onVisibleColumnsChange when visibility changes', () => {
      const onVisibleColumnsChange = jest.fn();
      const { result } = renderUseOGrid({ onVisibleColumnsChange });

      act(() => {
        result.current.columnChooser.onVisibilityChange('age', false);
      });

      expect(onVisibleColumnsChange).toHaveBeenCalled();
      const calledWith = onVisibleColumnsChange.mock.calls[0][0];
      expect(calledWith.has('age')).toBe(false);
      expect(calledWith.has('name')).toBe(true);
    });
  });

  describe('column resize and pin', () => {
    it('stores column width overrides via onColumnResized', () => {
      const onColumnResized = jest.fn();
      const { result } = renderUseOGrid({ onColumnResized });

      act(() => {
        result.current.dataGridProps.onColumnResized!('name', 200);
      });

      expect(onColumnResized).toHaveBeenCalledWith('name', 200);
      expect(result.current.dataGridProps.initialColumnWidths).toEqual({ name: 200 });
    });

    it('stores pinned column overrides via onColumnPinned', () => {
      const onColumnPinned = jest.fn();
      const { result } = renderUseOGrid({ onColumnPinned });

      act(() => {
        result.current.dataGridProps.onColumnPinned!('name', 'left');
      });

      expect(onColumnPinned).toHaveBeenCalledWith('name', 'left');
      expect(result.current.dataGridProps.pinnedColumns).toEqual({ name: 'left' });
    });

    it('removes pinned column override on unpin', () => {
      const { result } = renderUseOGrid();

      act(() => {
        result.current.dataGridProps.onColumnPinned!('name', 'left');
      });
      expect(result.current.dataGridProps.pinnedColumns).toEqual({ name: 'left' });

      act(() => {
        result.current.dataGridProps.onColumnPinned!('name', null);
      });
      expect(result.current.dataGridProps.pinnedColumns).toEqual({});
    });
  });

  describe('empty state', () => {
    it('passes emptyState through to dataGridProps', () => {
      const emptyState = { message: 'No data found' };
      const { result } = renderUseOGrid({ emptyState });

      expect(result.current.dataGridProps.emptyState).toBeDefined();
      expect(result.current.dataGridProps.emptyState!.message).toBe('No data found');
    });

    it('emptyState includes hasActiveFilters and onClearAll', () => {
      const columns = [
        { columnId: 'name', name: 'Name', filterable: { type: 'text' as const } },
        { columnId: 'age', name: 'Age' },
      ];
      const { result } = renderUseOGrid({
        columns,
        emptyState: { message: 'Empty' },
      });

      act(() => {
        result.current.dataGridProps.onFilterChange!('name', { type: 'text', value: 'ZZZ' });
      });

      expect(result.current.dataGridProps.emptyState!.hasActiveFilters).toBe(true);
      expect(typeof result.current.dataGridProps.emptyState!.onClearAll).toBe('function');
    });
  });
});
