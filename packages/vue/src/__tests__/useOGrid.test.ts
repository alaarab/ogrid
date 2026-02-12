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
});
