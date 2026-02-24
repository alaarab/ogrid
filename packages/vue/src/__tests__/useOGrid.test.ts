import { ref } from 'vue';
import { useOGrid } from '../composables/useOGrid';
import type { IOGridProps } from '../types';

type Row = { id: string; name: string };
const columns = [
  { columnId: 'id', name: 'ID' },
  { columnId: 'name', name: 'Name' },
];
const getRowId = (r: Row) => r.id;
const data: Row[] = [
  { id: '1', name: 'Alice' },
  { id: '2', name: 'Bob' },
  { id: '3', name: 'Carol' },
];

describe('useOGrid', () => {
  it('returns dataGridProps with items and displayTotalCount (client-side)', () => {
    const props = ref<IOGridProps<Row>>({
      columns,
      getRowId,
      data,
      defaultPageSize: 10,
    });

    const { dataGridProps, pagination } = useOGrid(props);

    expect(dataGridProps.value.items).toEqual(data);
    expect(dataGridProps.value.items.length).toBe(3);
    expect(pagination.value.displayTotalCount).toBe(3);
    expect(pagination.value.page).toBe(1);
    expect(pagination.value.pageSize).toBe(10);
  });

  it('paginates items when pageSize is smaller than data length', () => {
    const props = ref<IOGridProps<Row>>({
      columns,
      getRowId,
      data,
      defaultPageSize: 2,
    });

    const { dataGridProps, pagination } = useOGrid(props);

    expect(dataGridProps.value.items.length).toBe(2);
    expect(dataGridProps.value.items.map((r) => r.name)).toEqual(['Alice', 'Bob']);
    expect(pagination.value.displayTotalCount).toBe(3);
  });

  it('setPage changes page and dataGridProps.items slice', () => {
    const props = ref<IOGridProps<Row>>({
      columns,
      getRowId,
      data,
      defaultPageSize: 2,
    });

    const { dataGridProps, pagination } = useOGrid(props);

    pagination.value.setPage(2);

    expect(pagination.value.page).toBe(2);
    expect(dataGridProps.value.items.map((r) => r.name)).toEqual(['Carol']);
  });

  it('setPageSize changes pageSize and resets to page 1', () => {
    const props = ref<IOGridProps<Row>>({
      columns,
      getRowId,
      data,
      defaultPageSize: 10,
    });

    const { pagination } = useOGrid(props);

    pagination.value.setPage(2);
    pagination.value.setPageSize(25);

    expect(pagination.value.pageSize).toBe(25);
    expect(pagination.value.page).toBe(1);
  });

  it('handleVisibilityChange hides/shows columns', () => {
    const props = ref<IOGridProps<Row>>({
      columns,
      getRowId,
      data,
      defaultPageSize: 10,
    });

    const { columnChooser } = useOGrid(props);

    expect(columnChooser.value.visibleColumns.has('name')).toBe(true);
    columnChooser.value.onVisibilityChange('name', false);
    expect(columnChooser.value.visibleColumns.has('name')).toBe(false);
    columnChooser.value.onVisibilityChange('name', true);
    expect(columnChooser.value.visibleColumns.has('name')).toBe(true);
  });

  it('columnChooserColumns has one entry per column', () => {
    const props = ref<IOGridProps<Row>>({
      columns,
      getRowId,
      data,
      defaultPageSize: 10,
    });

    const { columnChooser } = useOGrid(props);

    expect(columnChooser.value.columns).toHaveLength(2);
    expect(columnChooser.value.columns.map((c) => c.columnId)).toEqual(['id', 'name']);
  });

  describe('Column State API', () => {
    it('getColumnState returns visibleColumns array and sort', () => {
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
        defaultSortBy: 'name',
        defaultSortDirection: 'desc',
      });

      const { api } = useOGrid(props);

      const state = api.value.getColumnState();
      expect(Array.isArray(state.visibleColumns)).toBe(true);
      expect(state.sort).toEqual({ field: 'name', direction: 'desc' });
    });

    it('getColumnState includes filters when present', () => {
      const filterColumns = [
        { columnId: 'id', name: 'ID', filterable: { type: 'text' as const } },
        { columnId: 'name', name: 'Name', filterable: { type: 'text' as const } },
      ];

      const props = ref<IOGridProps<Row>>({
        columns: filterColumns,
        getRowId,
        data,
        defaultPageSize: 10,
      });

      const { api } = useOGrid(props);

      // Initially no filters
      let state = api.value.getColumnState();
      expect(state.filters).toBeUndefined();

      // Set a filter
      api.value.setFilterModel({ name: { type: 'text', value: 'Alice' } });
      state = api.value.getColumnState();
      expect(state.filters).toEqual({ name: { type: 'text', value: 'Alice' } });
    });

    it('applyColumnState restores visibility, sort, and filters', () => {
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
      });

      const { api } = useOGrid(props);

      api.value.applyColumnState({
        visibleColumns: ['id'],
        sort: { field: 'id', direction: 'desc' },
        filters: { id: { type: 'text', value: '1' } },
      });

      const state = api.value.getColumnState();
      expect(state.visibleColumns).toEqual(['id']);
      expect(state.sort).toEqual({ field: 'id', direction: 'desc' });
      expect(state.filters).toEqual({ id: { type: 'text', value: '1' } });
    });

    it('applyColumnState restores columnWidths', () => {
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
      });

      const { api } = useOGrid(props);

      api.value.applyColumnState({
        columnWidths: { id: 200, name: 300 },
      });

      const state = api.value.getColumnState();
      expect(state.columnWidths).toEqual({ id: 200, name: 300 });
    });

    it('applyColumnState with partial state only changes specified fields', () => {
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
        defaultSortBy: 'name',
        defaultSortDirection: 'desc',
      });

      const { api } = useOGrid(props);

      const before = api.value.getColumnState();
      expect(before.sort).toEqual({ field: 'name', direction: 'desc' });
      expect(before.visibleColumns).toContain('id');
      expect(before.visibleColumns).toContain('name');

      // Only change filters — visibility and sort should remain
      api.value.applyColumnState({ filters: { id: { type: 'text', value: '2' } } });

      const after = api.value.getColumnState();
      expect(after.sort).toEqual({ field: 'name', direction: 'desc' });
      expect(after.visibleColumns).toContain('id');
      expect(after.visibleColumns).toContain('name');
      expect(after.filters).toEqual({ id: { type: 'text', value: '2' } });
    });

    it('clearFilters removes all filters', () => {
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
      });

      const { api } = useOGrid(props);

      api.value.setFilterModel({ name: { type: 'text', value: 'Alice' } });
      expect(api.value.getColumnState().filters).toBeDefined();

      api.value.clearFilters();
      expect(api.value.getColumnState().filters).toBeUndefined();
    });

    it('clearSort resets to default sort', () => {
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
        defaultSortBy: 'id',
        defaultSortDirection: 'asc',
      });

      const { api } = useOGrid(props);

      api.value.applyColumnState({ sort: { field: 'name', direction: 'desc' } });
      expect(api.value.getColumnState().sort).toEqual({ field: 'name', direction: 'desc' });

      api.value.clearSort();
      expect(api.value.getColumnState().sort).toEqual({ field: 'id', direction: 'asc' });
    });

    it('resetGridState clears filters, sort, and selection', () => {
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
        defaultSortBy: 'id',
      });

      const { api } = useOGrid(props);

      api.value.setFilterModel({ name: { type: 'text', value: 'Alice' } });
      api.value.applyColumnState({ sort: { field: 'name', direction: 'desc' } });
      api.value.setSelectedRows(['1', '2']);

      api.value.resetGridState();

      const state = api.value.getColumnState();
      expect(state.filters).toBeUndefined();
      expect(state.sort).toEqual({ field: 'id', direction: 'asc' });
      expect(api.value.getSelectedRows()).toEqual([]);
    });

    it('resetGridState with keepSelection preserves selection', () => {
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
        defaultSortBy: 'id',
      });

      const { api } = useOGrid(props);

      api.value.setFilterModel({ name: { type: 'text', value: 'Alice' } });
      api.value.setSelectedRows(['1']);

      api.value.resetGridState({ keepSelection: true });

      expect(api.value.getColumnState().filters).toBeUndefined();
      expect(api.value.getSelectedRows()).toEqual(['1']);
    });
  });

  describe('Date column filtering and sorting', () => {
    type DateRow = { id: string; date: string };
    const dateColumns = [
      { columnId: 'id', name: 'ID' },
      { columnId: 'date', name: 'Date', type: 'date' as const, filterable: { type: 'date' as const } },
    ];
    const dateData: DateRow[] = [
      { id: '1', date: '2024-01-15' },
      { id: '2', date: '2024-06-20' },
      { id: '3', date: '2024-03-10' },
      { id: '4', date: '2024-12-01' },
    ];
    const getDateRowId = (r: DateRow) => r.id;

    it('filters rows by date range (from only)', () => {
      const props = ref<IOGridProps<DateRow>>({
        columns: dateColumns,
        getRowId: getDateRowId,
        data: dateData,
        defaultPageSize: 10,
        filters: { date: { type: 'date', value: { from: '2024-06-01' } } },
      });

      const { dataGridProps } = useOGrid(props);
      expect(dataGridProps.value.items.map((r) => r.id)).toEqual(['2', '4']);
    });

    it('filters rows by date range (to only)', () => {
      const props = ref<IOGridProps<DateRow>>({
        columns: dateColumns,
        getRowId: getDateRowId,
        data: dateData,
        defaultPageSize: 10,
        filters: { date: { type: 'date', value: { to: '2024-03-10' } } },
      });

      const { dataGridProps } = useOGrid(props);
      expect(dataGridProps.value.items.map((r) => r.id)).toEqual(['1', '3']);
    });

    it('filters rows by date range (from and to)', () => {
      const props = ref<IOGridProps<DateRow>>({
        columns: dateColumns,
        getRowId: getDateRowId,
        data: dateData,
        defaultPageSize: 10,
        filters: { date: { type: 'date', value: { from: '2024-02-01', to: '2024-07-01' } } },
      });

      const { dataGridProps } = useOGrid(props);
      expect(dataGridProps.value.items.map((r) => r.id)).toEqual(['2', '3']);
    });

    it('sorts date columns chronologically', () => {
      const props = ref<IOGridProps<DateRow>>({
        columns: dateColumns,
        getRowId: getDateRowId,
        data: dateData,
        defaultPageSize: 10,
        sort: { field: 'date', direction: 'asc' },
      });

      const { dataGridProps } = useOGrid(props);
      expect(dataGridProps.value.items.map((r) => r.date)).toEqual([
        '2024-01-15',
        '2024-03-10',
        '2024-06-20',
        '2024-12-01',
      ]);
    });

    it('sorts date columns descending', () => {
      const props = ref<IOGridProps<DateRow>>({
        columns: dateColumns,
        getRowId: getDateRowId,
        data: dateData,
        defaultPageSize: 10,
        sort: { field: 'date', direction: 'desc' },
      });

      const { dataGridProps } = useOGrid(props);
      expect(dataGridProps.value.items.map((r) => r.date)).toEqual([
        '2024-12-01',
        '2024-06-20',
        '2024-03-10',
        '2024-01-15',
      ]);
    });
  });

  describe('Column pinning', () => {
    it('stores pin state in getColumnState', () => {
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
      });

      const { api, dataGridProps } = useOGrid(props);

      // Initially no pinned columns
      expect(api.value.getColumnState().pinnedColumns).toBeUndefined();

      // Pin a column
      dataGridProps.value.onColumnPinned?.('id', 'left');
      expect(api.value.getColumnState().pinnedColumns).toEqual({ id: 'left' });

      // Unpin it
      dataGridProps.value.onColumnPinned?.('id', null);
      expect(api.value.getColumnState().pinnedColumns).toBeUndefined();
    });

    it('applyColumnState restores pinnedColumns', () => {
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
      });

      const { api } = useOGrid(props);

      api.value.applyColumnState({
        pinnedColumns: { id: 'left', name: 'right' },
      });

      const state = api.value.getColumnState();
      expect(state.pinnedColumns).toEqual({ id: 'left', name: 'right' });
    });
  });

  describe('Row selection', () => {
    it('setSelectedRows updates selection', () => {
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
      });

      const { api } = useOGrid(props);

      api.value.setSelectedRows(['1', '2']);
      expect(api.value.getSelectedRows()).toEqual(['1', '2']);
    });

    it('deselectAll removes all selections', () => {
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
      });

      const { api } = useOGrid(props);

      api.value.setSelectedRows(['1', '2']);
      expect(api.value.getSelectedRows()).toEqual(['1', '2']);

      api.value.deselectAll();
      expect(api.value.getSelectedRows()).toEqual([]);
    });

    it('getDisplayedRows returns current page items', () => {
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 2,
      });

      const { api } = useOGrid(props);

      const rows = api.value.getDisplayedRows();
      expect(rows).toHaveLength(2);
      expect(rows.map((r) => r.name)).toEqual(['Alice', 'Bob']);
    });
  });

  describe('Controlled mode', () => {
    it('uses controlled page when provided', () => {
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
        page: 2,
      });

      const { pagination } = useOGrid(props);
      expect(pagination.value.page).toBe(2);
    });

    it('uses controlled pageSize when provided', () => {
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
        pageSize: 50,
      });

      const { pagination } = useOGrid(props);
      expect(pagination.value.pageSize).toBe(50);
    });

    it('uses controlled sort when provided', () => {
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
        sort: { field: 'name', direction: 'desc' },
      });

      const { api } = useOGrid(props);
      const state = api.value.getColumnState();
      expect(state.sort).toEqual({ field: 'name', direction: 'desc' });
    });

    it('uses controlled filters when provided', () => {
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
        filters: { name: { type: 'text', value: 'Bob' } },
      });

      const { dataGridProps } = useOGrid(props);
      expect(dataGridProps.value.filters).toEqual({ name: { type: 'text', value: 'Bob' } });
    });
  });

  describe('Sidebar state', () => {
    it('sidebar is enabled when sideBar prop is true', () => {
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
        sideBar: true,
      });

      const { layout } = useOGrid(props);
      expect(layout.value.sideBarProps).not.toBeNull();
    });

    it('sidebar toggle changes activePanel', () => {
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
        sideBar: true,
      });

      const { layout } = useOGrid(props);
      const sideBar = layout.value.sideBarProps;

      expect(sideBar?.activePanel).toBeNull();
      sideBar?.toggle('columns');
      expect(sideBar?.activePanel).toBe('columns');
      expect(sideBar?.isOpen).toBe(true);

      sideBar?.toggle('columns');
      expect(sideBar?.activePanel).toBeNull();
      expect(sideBar?.isOpen).toBe(false);
    });

    it('sidebar close sets activePanel to null', () => {
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
        sideBar: true,
      });

      const { layout } = useOGrid(props);
      const sideBar = layout.value.sideBarProps;

      sideBar?.toggle('filters');
      expect(sideBar?.isOpen).toBe(true);

      sideBar?.close();
      expect(sideBar?.activePanel).toBeNull();
      expect(sideBar?.isOpen).toBe(false);
    });
  });

  describe('Sorting', () => {
    it('sorts data ascending by default', () => {
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
        defaultSortBy: 'name',
        defaultSortDirection: 'asc',
      });

      const { dataGridProps } = useOGrid(props);
      const names = dataGridProps.value.items.map((r) => r.name);
      expect(names).toEqual(['Alice', 'Bob', 'Carol']);
    });

    it('sorts data descending', () => {
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
        defaultSortBy: 'name',
        defaultSortDirection: 'desc',
      });

      const { dataGridProps } = useOGrid(props);
      const names = dataGridProps.value.items.map((r) => r.name);
      expect(names).toEqual(['Carol', 'Bob', 'Alice']);
    });

    it('handleSort changes sort field and direction', () => {
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
        defaultSortBy: 'name',
        defaultSortDirection: 'asc',
      });

      const { dataGridProps } = useOGrid(props);

      // Sort by name descending
      dataGridProps.value.onColumnSort('name', 'desc');

      expect(dataGridProps.value.sortBy).toBe('name');
      expect(dataGridProps.value.sortDirection).toBe('desc');
      expect(dataGridProps.value.items.map((r) => r.name)).toEqual(['Carol', 'Bob', 'Alice']);
    });

    it('sort change resets to page 1', () => {
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 2,
      });

      const { pagination, dataGridProps } = useOGrid(props);

      pagination.value.setPage(2);
      expect(pagination.value.page).toBe(2);

      dataGridProps.value.onColumnSort('name', 'desc');
      expect(pagination.value.page).toBe(1);
    });

    it('calls onSortChange callback', () => {
      const onSortChange = jest.fn();
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
        onSortChange,
      });

      const { dataGridProps } = useOGrid(props);
      dataGridProps.value.onColumnSort('name', 'desc');

      expect(onSortChange).toHaveBeenCalled();
    });
  });

  describe('Text filtering', () => {
    const filterColumns = [
      { columnId: 'id', name: 'ID', filterable: { type: 'text' as const } },
      { columnId: 'name', name: 'Name', filterable: { type: 'text' as const } },
    ];

    it('applies text filter', () => {
      const props = ref<IOGridProps<Row>>({
        columns: filterColumns,
        getRowId,
        data,
        defaultPageSize: 10,
      });

      const { dataGridProps, filters } = useOGrid(props);

      dataGridProps.value.onFilterChange!('name', { type: 'text', value: 'Ali' });

      expect(filters.value.hasActiveFilters).toBe(true);
      expect(dataGridProps.value.items.map((r) => r.name)).toEqual(['Alice']);
    });

    it('clears filter restores all items', () => {
      const props = ref<IOGridProps<Row>>({
        columns: filterColumns,
        getRowId,
        data,
        defaultPageSize: 10,
      });

      const { dataGridProps, filters } = useOGrid(props);

      dataGridProps.value.onFilterChange!('name', { type: 'text', value: 'Ali' });
      expect(dataGridProps.value.items).toHaveLength(1);

      filters.value.setFilters({});
      expect(dataGridProps.value.items).toHaveLength(3);
      expect(filters.value.hasActiveFilters).toBe(false);
    });

    it('filter change resets to page 1', () => {
      const props = ref<IOGridProps<Row>>({
        columns: filterColumns,
        getRowId,
        data,
        defaultPageSize: 2,
      });

      const { pagination, dataGridProps } = useOGrid(props);

      pagination.value.setPage(2);
      expect(pagination.value.page).toBe(2);

      dataGridProps.value.onFilterChange!('name', { type: 'text', value: 'A' });
      expect(pagination.value.page).toBe(1);
    });
  });

  describe('Row selection (via API)', () => {
    it('selectAll selects all displayed rows', () => {
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
      });

      const { api } = useOGrid(props);

      api.value.selectAll();
      const selected = api.value.getSelectedRows();
      expect(selected).toHaveLength(3);
      expect(selected).toContain('1');
      expect(selected).toContain('2');
      expect(selected).toContain('3');
    });

    it('selectAll calls onSelectionChange', () => {
      const onSelectionChange = jest.fn();
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
        onSelectionChange,
      });

      const { api } = useOGrid(props);
      api.value.selectAll();

      expect(onSelectionChange).toHaveBeenCalled();
      expect(onSelectionChange.mock.calls[0][0].selectedRowIds).toHaveLength(3);
    });

    it('deselectAll calls onSelectionChange with empty', () => {
      const onSelectionChange = jest.fn();
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
        onSelectionChange,
      });

      const { api } = useOGrid(props);
      api.value.setSelectedRows(['1', '2']);
      api.value.deselectAll();

      expect(onSelectionChange).toHaveBeenCalledWith({
        selectedRowIds: [],
        selectedItems: [],
      });
    });
  });

  describe('Status bar', () => {
    it('returns undefined when statusBar is not set', () => {
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
      });

      const { dataGridProps } = useOGrid(props);
      expect(dataGridProps.value.statusBar).toBeUndefined();
    });

    it('returns status bar config when statusBar is true', () => {
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
        statusBar: true,
      });

      const { dataGridProps } = useOGrid(props);
      expect(dataGridProps.value.statusBar).toBeDefined();
      expect(dataGridProps.value.statusBar!.totalCount).toBe(3);
      expect(dataGridProps.value.statusBar!.selectedCount).toBe(0);
    });

    it('returns custom status bar when statusBar is an object', () => {
      const customStatus = { totalCount: 100, filteredCount: 50, selectedCount: 5 };
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
        statusBar: customStatus,
      });

      const { dataGridProps } = useOGrid(props);
      expect(dataGridProps.value.statusBar).toEqual(customStatus);
    });

    it('includes filteredCount when filters are active', () => {
      const filterColumns = [
        { columnId: 'id', name: 'ID', filterable: { type: 'text' as const } },
        { columnId: 'name', name: 'Name', filterable: { type: 'text' as const } },
      ];
      const props = ref<IOGridProps<Row>>({
        columns: filterColumns,
        getRowId,
        data,
        defaultPageSize: 10,
        statusBar: true,
      });

      const { dataGridProps } = useOGrid(props);

      dataGridProps.value.onFilterChange!('name', { type: 'text', value: 'Ali' });

      expect(dataGridProps.value.statusBar).toBeDefined();
      expect(dataGridProps.value.statusBar!.filteredCount).toBeDefined();
    });
  });

  describe('Server-side data source', () => {
    it('calls fetchPage when watched deps trigger', async () => {
      const fetchPage = jest.fn().mockResolvedValue({
        items: [{ id: '1', name: 'ServerAlice' }],
        totalCount: 1,
      });
      const dataSource = { fetchPage };

      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        dataSource,
      } as IOGridProps<Row>);

      const { dataGridProps, pagination, api } = useOGrid(props);

      // onMounted doesn't fire outside component context, but
      // refreshData increments the refreshCounter which triggers the watch.
      api.value.refreshData();

      // Wait for the async fetch
      await new Promise((r) => setTimeout(r, 50));

      expect(fetchPage).toHaveBeenCalled();
      expect(fetchPage.mock.calls[0][0]).toMatchObject({
        page: 1,
      });
      expect(dataGridProps.value.items).toEqual([{ id: '1', name: 'ServerAlice' }]);
      expect(pagination.value.displayTotalCount).toBe(1);
    });

    it('onError callback fires when fetchPage rejects', async () => {
      const fetchError = new Error('Network failure');
      const fetchPage = jest.fn().mockRejectedValue(fetchError);
      const onError = jest.fn();
      const dataSource = { fetchPage };

      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        dataSource,
        onError,
      } as IOGridProps<Row>);

      const { dataGridProps, pagination, api } = useOGrid(props);

      // Trigger fetch via refreshData (works outside onMounted context)
      api.value.refreshData();

      await new Promise((r) => setTimeout(r, 50));

      expect(fetchPage).toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(fetchError);
      // Items reset to empty on error
      expect(dataGridProps.value.items).toEqual([]);
      expect(pagination.value.displayTotalCount).toBe(0);
    });

    it('onError is not called when fetchPage succeeds', async () => {
      const fetchPage = jest.fn().mockResolvedValue({
        items: [{ id: '1', name: 'Alice' }],
        totalCount: 1,
      });
      const onError = jest.fn();
      const dataSource = { fetchPage };

      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        dataSource,
        onError,
      } as IOGridProps<Row>);

      const { api } = useOGrid(props);

      api.value.refreshData();
      await new Promise((r) => setTimeout(r, 50));

      expect(onError).not.toHaveBeenCalled();
    });

    it('onError without callback does not crash when fetchPage rejects', async () => {
      const fetchPage = jest.fn().mockRejectedValue(new Error('Server error'));
      const dataSource = { fetchPage };

      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        dataSource,
        // No onError callback
      } as IOGridProps<Row>);

      const { api } = useOGrid(props);

      api.value.refreshData();

      // Should not throw even without an onError handler
      await expect(new Promise((r) => setTimeout(r, 50))).resolves.toBeUndefined();
      expect(fetchPage).toHaveBeenCalled();
    });
  });

  describe('Column chooser placement', () => {
    it('defaults to toolbar', () => {
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
      });

      const { columnChooser } = useOGrid(props);
      expect(columnChooser.value.placement).toBe('toolbar');
    });

    it('sets to none when columnChooser is false', () => {
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
        columnChooser: false,
      });

      const { columnChooser } = useOGrid(props);
      expect(columnChooser.value.placement).toBe('none');
    });

    it('sets to sidebar when columnChooser is sidebar', () => {
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
        columnChooser: 'sidebar',
      });

      const { columnChooser } = useOGrid(props);
      expect(columnChooser.value.placement).toBe('sidebar');
    });
  });

  describe('Column resize and pin', () => {
    it('stores column width overrides via onColumnResized', () => {
      const onColumnResized = jest.fn();
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
        onColumnResized,
      });

      const { dataGridProps } = useOGrid(props);
      dataGridProps.value.onColumnResized?.('name', 200);

      expect(onColumnResized).toHaveBeenCalledWith('name', 200);
      expect(dataGridProps.value.initialColumnWidths).toEqual({ name: 200 });
    });

    it('stores pinned column overrides via onColumnPinned', () => {
      const onColumnPinned = jest.fn();
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
        onColumnPinned,
      });

      const { dataGridProps } = useOGrid(props);
      dataGridProps.value.onColumnPinned?.('name', 'left');

      expect(onColumnPinned).toHaveBeenCalledWith('name', 'left');
      expect(dataGridProps.value.pinnedColumns).toEqual({ name: 'left' });
    });

    it('removes pinned column override on unpin', () => {
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
      });

      const { dataGridProps } = useOGrid(props);
      dataGridProps.value.onColumnPinned?.('name', 'left');
      expect(dataGridProps.value.pinnedColumns).toEqual({ name: 'left' });

      dataGridProps.value.onColumnPinned?.('name', null);
      expect(dataGridProps.value.pinnedColumns).toEqual({});
    });
  });

  describe('API: setRowData and setLoading', () => {
    it('setRowData updates items when no data prop is provided', () => {
      // When no `data` is passed, useOGrid falls back to internalData.
      // setRowData sets the internal data array.
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        defaultPageSize: 10,
      } as IOGridProps<Row>);

      const { api, dataGridProps } = useOGrid(props);

      expect(dataGridProps.value.items).toHaveLength(0);

      api.value.setRowData([
        { id: '10', name: 'NewPerson' },
      ] as Row[]);

      expect(dataGridProps.value.items).toHaveLength(1);
      expect(dataGridProps.value.items[0].name).toBe('NewPerson');
    });

    it('setLoading controls loading state', () => {
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
      });

      const { api, dataGridProps } = useOGrid(props);

      api.value.setLoading(true);
      expect(dataGridProps.value.isLoading).toBe(true);

      api.value.setLoading(false);
      expect(dataGridProps.value.isLoading).toBe(false);
    });
  });

  describe('Empty state', () => {
    it('passes emptyState through to dataGridProps', () => {
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
        emptyState: { message: 'No data found' },
      });

      const { dataGridProps } = useOGrid(props);
      expect(dataGridProps.value.emptyState).toBeDefined();
      expect(dataGridProps.value.emptyState!.message).toBe('No data found');
    });

    it('emptyState includes hasActiveFilters and onClearAll', () => {
      const filterColumns = [
        { columnId: 'id', name: 'ID', filterable: { type: 'text' as const } },
        { columnId: 'name', name: 'Name', filterable: { type: 'text' as const } },
      ];
      const props = ref<IOGridProps<Row>>({
        columns: filterColumns,
        getRowId,
        data,
        defaultPageSize: 10,
        emptyState: { message: 'Empty' },
      });

      const { dataGridProps } = useOGrid(props);

      dataGridProps.value.onFilterChange!('name', { type: 'text', value: 'ZZZ' });

      expect(dataGridProps.value.emptyState!.hasActiveFilters).toBe(true);
      expect(typeof dataGridProps.value.emptyState!.onClearAll).toBe('function');
    });
  });

  describe('Layout pass-through', () => {
    it('passes toolbar through', () => {
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
        toolbar: 'My Toolbar',
      });

      const { layout } = useOGrid(props);
      expect(layout.value.toolbar).toBe('My Toolbar');
    });

    it('passes className through', () => {
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
        className: 'custom-class',
      });

      const { layout } = useOGrid(props);
      expect(layout.value.className).toBe('custom-class');
    });
  });

  describe('API: getColumnOrder and setColumnOrder', () => {
    it('getColumnOrder returns column IDs when no custom order', () => {
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
      });

      const { api } = useOGrid(props);
      expect(api.value.getColumnOrder()).toEqual(['id', 'name']);
    });

    it('setColumnOrder calls onColumnOrderChange', () => {
      const onColumnOrderChange = jest.fn();
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
        onColumnOrderChange,
      });

      const { api } = useOGrid(props);
      api.value.setColumnOrder(['name', 'id']);

      expect(onColumnOrderChange).toHaveBeenCalledWith(['name', 'id']);
    });
  });

  describe('Callbacks', () => {
    it('calls onPageChange when page changes', () => {
      const onPageChange = jest.fn();
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
        onPageChange,
      });

      const { pagination } = useOGrid(props);
      pagination.value.setPage(2);

      expect(onPageChange).toHaveBeenCalledWith(2);
    });

    it('calls onPageSizeChange when page size changes', () => {
      const onPageSizeChange = jest.fn();
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
        onPageSizeChange,
      });

      const { pagination } = useOGrid(props);
      pagination.value.setPageSize(50);

      expect(onPageSizeChange).toHaveBeenCalledWith(50);
    });

    it('calls onVisibleColumnsChange when visibility changes', () => {
      const onVisibleColumnsChange = jest.fn();
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
        onVisibleColumnsChange,
      });

      const { columnChooser } = useOGrid(props);
      columnChooser.value.onVisibilityChange('name', false);

      expect(onVisibleColumnsChange).toHaveBeenCalled();
      const calledWith = onVisibleColumnsChange.mock.calls[0][0];
      expect(calledWith.has('name')).toBe(false);
      expect(calledWith.has('id')).toBe(true);
    });

    it('calls onFiltersChange when filters change', () => {
      const onFiltersChange = jest.fn();
      const filterColumns = [
        { columnId: 'id', name: 'ID', filterable: { type: 'text' as const } },
        { columnId: 'name', name: 'Name', filterable: { type: 'text' as const } },
      ];
      const props = ref<IOGridProps<Row>>({
        columns: filterColumns,
        getRowId,
        data,
        defaultPageSize: 10,
        onFiltersChange,
      });

      const { dataGridProps } = useOGrid(props);
      dataGridProps.value.onFilterChange!('name', { type: 'text', value: 'Alice' });

      expect(onFiltersChange).toHaveBeenCalled();
    });
  });

  describe('cellReferences', () => {
    it('cellReferences derives showColumnLetters and showNameBox in dataGridProps', () => {
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
        cellReferences: true,
      });

      const { dataGridProps } = useOGrid(props);

      expect(dataGridProps.value.showColumnLetters).toBe(true);
      expect(dataGridProps.value.showNameBox).toBe(true);
    });

    it('cellReferences implies showRowNumbers', () => {
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
        cellReferences: true,
      });

      const { dataGridProps } = useOGrid(props);

      expect(dataGridProps.value.showRowNumbers).toBe(true);
    });

    it('cellReferences false/undefined omits showColumnLetters/showNameBox', () => {
      const propsOff = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
        cellReferences: false,
      });

      const { dataGridProps: propsOffResult } = useOGrid(propsOff);

      expect(propsOffResult.value.showColumnLetters).toBe(false);
      expect(propsOffResult.value.showNameBox).toBe(false);

      const propsUndefined = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
      });

      const { dataGridProps: propsUndefinedResult } = useOGrid(propsUndefined);

      expect(propsUndefinedResult.value.showColumnLetters).toBe(false);
      expect(propsUndefinedResult.value.showNameBox).toBe(false);
    });

    it('onActiveCellChange callback is only provided when cellReferences is true', () => {
      const propsOn = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
        cellReferences: true,
      });

      const { dataGridProps: resultOn } = useOGrid(propsOn);
      expect(typeof resultOn.value.onActiveCellChange).toBe('function');

      const propsOff = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
        cellReferences: false,
      });

      const { dataGridProps: resultOff } = useOGrid(propsOff);
      expect(resultOff.value.onActiveCellChange).toBeUndefined();

      const propsUndefined = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
      });

      const { dataGridProps: resultUndefined } = useOGrid(propsUndefined);
      expect(resultUndefined.value.onActiveCellChange).toBeUndefined();
    });

    it('layout.toolbar includes name box VNode when cellReferences is true', () => {
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
        cellReferences: true,
      });

      const { layout } = useOGrid(props);

      // When cellReferences is true, toolbar is wrapped in an array with a name box VNode
      expect(Array.isArray(layout.value.toolbar)).toBe(true);
      const toolbarArray = layout.value.toolbar as unknown[];
      expect(toolbarArray.length).toBeGreaterThanOrEqual(1);
      // First element is the name box VNode
      const nameBox = toolbarArray[0] as { props?: Record<string, unknown> };
      expect(nameBox).toBeDefined();
      expect(nameBox.props?.['aria-label']).toBe('Active cell reference');
    });

    it('layout.toolbar is not wrapped when cellReferences is false', () => {
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
        toolbar: 'My Toolbar',
      });

      const { layout } = useOGrid(props);

      expect(layout.value.toolbar).toBe('My Toolbar');
    });

    it('cellReferences does not override explicit showRowNumbers', () => {
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
        showRowNumbers: true,
        cellReferences: false,
      });

      const { dataGridProps } = useOGrid(props);

      // showRowNumbers is true because of explicit prop, not cellReferences
      expect(dataGridProps.value.showRowNumbers).toBe(true);
      // But cellReferences-specific props are false
      expect(dataGridProps.value.showColumnLetters).toBe(false);
      expect(dataGridProps.value.showNameBox).toBe(false);
    });
  });

  describe('workerSort', () => {
    it('items are returned when workerSort is true (async fallback in jsdom)', async () => {
      const props = ref<IOGridProps<Row>>({
        columns,
        getRowId,
        data,
        defaultPageSize: 10,
        workerSort: true,
      });

      const { dataGridProps } = useOGrid(props);

      // Give async effect time to resolve (Worker not available in jsdom — falls back to sync)
      await new Promise(r => setTimeout(r, 100));

      // Either sync or async path should return data
      expect(dataGridProps.value.items.length).toBeGreaterThan(0);
    });

    it('sorted items are correct with workerSort enabled', async () => {
      const sortedData: Row[] = [
        { id: '3', name: 'Carol' },
        { id: '1', name: 'Alice' },
        { id: '2', name: 'Bob' },
      ];

      const props = ref<IOGridProps<Row>>({
        columns: [
          { columnId: 'id', name: 'ID' },
          { columnId: 'name', name: 'Name', sortable: true },
        ],
        getRowId,
        data: sortedData,
        defaultPageSize: 10,
        workerSort: true,
        defaultSortBy: 'name',
        defaultSortDirection: 'asc',
      });

      const { dataGridProps } = useOGrid(props);

      // Give async effect time to resolve
      await new Promise(r => setTimeout(r, 100));

      // Should be sorted by name ascending: Alice, Bob, Carol
      const names = dataGridProps.value.items.map(r => r.name);
      expect(names).toEqual(['Alice', 'Bob', 'Carol']);
    });
  });
});
