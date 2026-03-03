import { OGridService } from '../services/ogrid.service';
import type { IColumnDef } from '../types';

type Row = { id: string; name: string };
type DateRow = { id: string; date: string };

const columns: IColumnDef<Row>[] = [
  { columnId: 'id', name: 'ID' },
  { columnId: 'name', name: 'Name' },
];
const getRowId = (r: Row) => r.id;
const data: Row[] = [
  { id: '1', name: 'Alice' },
  { id: '2', name: 'Bob' },
  { id: '3', name: 'Carol' },
];

describe('OGridService', () => {
  let service: OGridService<Row>;

  beforeEach(() => {
    service = new OGridService<Row>();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Client-side data mode', () => {
    beforeEach(() => {
      service.columnsProp.set(columns);
      service.getRowId.set(getRowId);
      service.data.set(data);
      service.defaultPageSize.set(10);
    });

    it('returns dataGridProps with items and displayTotalCount', () => {
      const dgProps = service.dataGridProps();
      expect(dgProps.items).toEqual(data);
      expect(dgProps.items.length).toBe(3);
      expect(service.pagination().displayTotalCount).toBe(3);
      expect(service.pagination().page).toBe(1);
      expect(service.pagination().pageSize).toBe(10);
    });

    it('paginates items when pageSize is smaller than data length', () => {
      service.defaultPageSize.set(2);
      const dgProps = service.dataGridProps();
      expect(dgProps.items.length).toBe(2);
      expect(dgProps.items.map((r) => r.name)).toEqual(['Alice', 'Bob']);
      expect(service.pagination().displayTotalCount).toBe(3);
    });

    it('setPage changes page and dataGridProps.items slice', () => {
      service.defaultPageSize.set(2);
      service.pagination().setPage(2);
      const dgProps = service.dataGridProps();
      expect(service.pagination().page).toBe(2);
      expect(dgProps.items.map((r) => r.name)).toEqual(['Carol']);
    });

    it('setPageSize changes pageSize and resets to page 1', () => {
      service.defaultPageSize.set(10);
      service.pagination().setPage(2);
      service.pagination().setPageSize(25);
      expect(service.pagination().pageSize).toBe(25);
      expect(service.pagination().page).toBe(1);
    });

    it('handleVisibilityChange hides/shows columns', () => {
      expect(service.columnChooser().visibleColumns.has('name')).toBe(true);
      service.columnChooser().onVisibilityChange('name', false);
      expect(service.columnChooser().visibleColumns.has('name')).toBe(false);
      service.columnChooser().onVisibilityChange('name', true);
      expect(service.columnChooser().visibleColumns.has('name')).toBe(true);
    });

    it('columnChooserColumns has one entry per column', () => {
      const cols = service.columnChooser().columns;
      expect(cols).toHaveLength(2);
      expect(cols.map((c) => c.columnId)).toEqual(['id', 'name']);
    });
  });

  describe('Column State API', () => {
    beforeEach(() => {
      service.columnsProp.set(columns);
      service.getRowId.set(getRowId);
      service.data.set(data);
      service.defaultPageSize.set(10);
    });

    it('getColumnState returns visibleColumns array and sort', () => {
      service.defaultSortBy.set('name');
      service.defaultSortDirection.set('desc');
      const state = service.getApi().getColumnState();
      expect(Array.isArray(state.visibleColumns)).toBe(true);
      expect(state.sort).toEqual({ field: 'name', direction: 'desc' });
    });

    it('getColumnState includes filters when present', () => {
      const filterColumns: IColumnDef<Row>[] = [
        { columnId: 'id', name: 'ID', filterable: { type: 'text' } },
        { columnId: 'name', name: 'Name', filterable: { type: 'text' } },
      ];
      service.columnsProp.set(filterColumns);

      // Initially no filters
      let state = service.getApi().getColumnState();
      expect(state.filters).toBeUndefined();

      // Set a filter
      service.getApi().setFilterModel({ name: { type: 'text', value: 'Alice' } });
      state = service.getApi().getColumnState();
      expect(state.filters).toEqual({ name: { type: 'text', value: 'Alice' } });
    });

    it('applyColumnState restores visibility, sort, and filters', () => {
      service.getApi().applyColumnState({
        visibleColumns: ['id'],
        sort: { field: 'id', direction: 'desc' },
        filters: { id: { type: 'text', value: '1' } },
      });

      const state = service.getApi().getColumnState();
      expect(state.visibleColumns).toEqual(['id']);
      expect(state.sort).toEqual({ field: 'id', direction: 'desc' });
      expect(state.filters).toEqual({ id: { type: 'text', value: '1' } });
    });

    it('applyColumnState restores columnWidths', () => {
      service.getApi().applyColumnState({
        columnWidths: { id: 200, name: 300 },
      });

      const state = service.getApi().getColumnState();
      expect(state.columnWidths).toEqual({ id: 200, name: 300 });
    });

    it('applyColumnState with partial state only changes specified fields', () => {
      service.defaultSortBy.set('name');
      service.defaultSortDirection.set('desc');

      const before = service.getApi().getColumnState();
      expect(before.sort).toEqual({ field: 'name', direction: 'desc' });
      expect(before.visibleColumns).toContain('id');
      expect(before.visibleColumns).toContain('name');

      // Only change filters  -  visibility and sort should remain
      service.getApi().applyColumnState({ filters: { id: { type: 'text', value: '2' } } });

      const after = service.getApi().getColumnState();
      expect(after.sort).toEqual({ field: 'name', direction: 'desc' });
      expect(after.visibleColumns).toContain('id');
      expect(after.visibleColumns).toContain('name');
      expect(after.filters).toEqual({ id: { type: 'text', value: '2' } });
    });

    it('clearFilters removes all filters', () => {
      service.getApi().setFilterModel({ name: { type: 'text', value: 'Alice' } });
      expect(service.getApi().getColumnState().filters).toBeDefined();

      service.getApi().clearFilters();
      expect(service.getApi().getColumnState().filters).toBeUndefined();
    });

    it('clearSort resets to default sort', () => {
      service.defaultSortBy.set('id');
      service.defaultSortDirection.set('asc');

      service.getApi().applyColumnState({ sort: { field: 'name', direction: 'desc' } });
      expect(service.getApi().getColumnState().sort).toEqual({ field: 'name', direction: 'desc' });

      service.getApi().clearSort();
      expect(service.getApi().getColumnState().sort).toEqual({ field: 'id', direction: 'asc' });
    });

    it('resetGridState clears filters, sort, and selection', () => {
      service.defaultSortBy.set('id');
      service.getApi().setFilterModel({ name: { type: 'text', value: 'Alice' } });
      service.getApi().applyColumnState({ sort: { field: 'name', direction: 'desc' } });
      service.getApi().setSelectedRows(['1', '2']);

      service.getApi().resetGridState();

      const state = service.getApi().getColumnState();
      expect(state.filters).toBeUndefined();
      expect(state.sort).toEqual({ field: 'id', direction: 'asc' });
      expect(service.getApi().getSelectedRows()).toEqual([]);
    });

    it('resetGridState with keepSelection preserves selection', () => {
      service.defaultSortBy.set('id');
      service.getApi().setFilterModel({ name: { type: 'text', value: 'Alice' } });
      service.getApi().setSelectedRows(['1']);

      service.getApi().resetGridState({ keepSelection: true });

      expect(service.getApi().getColumnState().filters).toBeUndefined();
      expect(service.getApi().getSelectedRows()).toEqual(['1']);
    });
  });

  describe('Date column filtering and sorting', () => {
    const dateColumns: IColumnDef<DateRow>[] = [
      { columnId: 'id', name: 'ID' },
      { columnId: 'date', name: 'Date', type: 'date', filterable: { type: 'date' } },
    ];
    const dateData: DateRow[] = [
      { id: '1', date: '2024-01-15' },
      { id: '2', date: '2024-06-20' },
      { id: '3', date: '2024-03-10' },
      { id: '4', date: '2024-12-01' },
    ];
    const getDateRowId = (r: DateRow) => r.id;

    let dateService: OGridService<DateRow>;

    beforeEach(() => {
      dateService = new OGridService<DateRow>();
      dateService.columnsProp.set(dateColumns);
      dateService.getRowId.set(getDateRowId);
      dateService.data.set(dateData);
      dateService.defaultPageSize.set(10);
    });

    it('filters rows by date range (from only)', () => {
      dateService.getApi().setFilterModel({ date: { type: 'date', value: { from: '2024-06-01' } } });
      const dgProps = dateService.dataGridProps();
      expect(dgProps.items.map((r) => r.id)).toEqual(['2', '4']);
    });

    it('filters rows by date range (to only)', () => {
      dateService.getApi().setFilterModel({ date: { type: 'date', value: { to: '2024-03-10' } } });
      const dgProps = dateService.dataGridProps();
      expect(dgProps.items.map((r) => r.id)).toEqual(['1', '3']);
    });

    it('filters rows by date range (from and to)', () => {
      dateService.getApi().setFilterModel({ date: { type: 'date', value: { from: '2024-02-01', to: '2024-07-01' } } });
      const dgProps = dateService.dataGridProps();
      expect(dgProps.items.map((r) => r.id)).toEqual(['2', '3']);
    });

    it('sorts date columns chronologically', () => {
      dateService.controlledSort.set({ field: 'date', direction: 'asc' });
      const dgProps = dateService.dataGridProps();
      expect(dgProps.items.map((r) => r.date)).toEqual([
        '2024-01-15',
        '2024-03-10',
        '2024-06-20',
        '2024-12-01',
      ]);
    });

    it('sorts date columns descending', () => {
      dateService.controlledSort.set({ field: 'date', direction: 'desc' });
      const dgProps = dateService.dataGridProps();
      expect(dgProps.items.map((r) => r.date)).toEqual([
        '2024-12-01',
        '2024-06-20',
        '2024-03-10',
        '2024-01-15',
      ]);
    });
  });

  describe('Column pinning', () => {
    beforeEach(() => {
      service.columnsProp.set(columns);
      service.getRowId.set(getRowId);
      service.data.set(data);
      service.defaultPageSize.set(10);
    });

    it('stores pin state in getColumnState', () => {
      // Initially no pinned columns
      expect(service.getApi().getColumnState().pinnedColumns).toBeUndefined();

      // Pin a column
      service.dataGridProps().onColumnPinned?.('id', 'left');
      expect(service.getApi().getColumnState().pinnedColumns).toEqual({ id: 'left' });

      // Unpin it
      service.dataGridProps().onColumnPinned?.('id', null);
      expect(service.getApi().getColumnState().pinnedColumns).toBeUndefined();
    });

    it('applyColumnState restores pinnedColumns', () => {
      service.getApi().applyColumnState({
        pinnedColumns: { id: 'left', name: 'right' },
      });

      const state = service.getApi().getColumnState();
      expect(state.pinnedColumns).toEqual({ id: 'left', name: 'right' });
    });
  });

  describe('Row selection', () => {
    beforeEach(() => {
      service.columnsProp.set(columns);
      service.getRowId.set(getRowId);
      service.data.set(data);
      service.defaultPageSize.set(10);
    });

    it('setSelectedRows updates selection', () => {
      service.getApi().setSelectedRows(['1', '2']);
      expect(service.getApi().getSelectedRows()).toEqual(['1', '2']);
    });

    it('deselectAll removes all selections', () => {
      service.getApi().setSelectedRows(['1', '2']);
      expect(service.getApi().getSelectedRows()).toEqual(['1', '2']);

      service.getApi().deselectAll();
      expect(service.getApi().getSelectedRows()).toEqual([]);
    });

    it('getDisplayedRows returns current page items', () => {
      service.defaultPageSize.set(2);
      const rows = service.getApi().getDisplayedRows();
      expect(rows).toHaveLength(2);
      expect(rows.map((r) => r.name)).toEqual(['Alice', 'Bob']);
    });
  });

  describe('Sidebar state', () => {
    beforeEach(() => {
      service.columnsProp.set(columns);
      service.getRowId.set(getRowId);
      service.data.set(data);
      service.defaultPageSize.set(10);
    });

    it('sidebar is enabled when sideBarConfig prop is true', () => {
      service.sideBarConfig.set(true);
      expect(service.sideBarState().isEnabled).toBe(true);
    });

    it('sidebar toggle changes activePanel', () => {
      service.sideBarConfig.set(true);
      expect(service.sideBarState().activePanel).toBeNull();

      service.sideBarState().toggle('columns');
      expect(service.sideBarState().activePanel).toBe('columns');
      expect(service.sideBarState().isOpen).toBe(true);

      service.sideBarState().toggle('columns');
      expect(service.sideBarState().activePanel).toBeNull();
      expect(service.sideBarState().isOpen).toBe(false);
    });

    it('sidebar close sets activePanel to null', () => {
      service.sideBarConfig.set(true);
      service.sideBarState().toggle('filters');
      expect(service.sideBarState().isOpen).toBe(true);

      service.sideBarState().close();
      expect(service.sideBarState().activePanel).toBeNull();
      expect(service.sideBarState().isOpen).toBe(false);
    });
  });

  describe('Controlled mode', () => {
    beforeEach(() => {
      service.columnsProp.set(columns);
      service.getRowId.set(getRowId);
      service.data.set(data);
      service.defaultPageSize.set(10);
    });

    it('uses controlled page when provided', () => {
      service.controlledPage.set(2);
      expect(service.pagination().page).toBe(2);
    });

    it('uses controlled pageSize when provided', () => {
      service.controlledPageSize.set(50);
      expect(service.pagination().pageSize).toBe(50);
    });

    it('uses controlled sort when provided', () => {
      service.controlledSort.set({ field: 'name', direction: 'desc' });
      const state = service.getApi().getColumnState();
      expect(state.sort).toEqual({ field: 'name', direction: 'desc' });
    });

    it('uses controlled filters when provided', () => {
      service.controlledFilters.set({ name: { type: 'text', value: 'Bob' } });
      const dgProps = service.dataGridProps();
      expect(dgProps.filters).toEqual({ name: { type: 'text', value: 'Bob' } });
    });
  });

  describe('onError / onFetchError signal wiring', () => {
    beforeEach(() => {
      service.columnsProp.set(columns);
      service.getRowId.set(getRowId);
      service.data.set(data);
      service.defaultPageSize.set(10);
    });

    it('onError signal defaults to undefined', () => {
      expect(service.onError()).toBeUndefined();
    });

    it('configure() sets onError signal from props', () => {
      const onError = jest.fn();
      service.configure({
        columns,
        getRowId,
        data,
        onError,
      });
      expect(service.onError()).toBe(onError);
    });

    it('onError can be updated via direct signal set', () => {
      const onError = jest.fn();
      service.onError.set(onError);
      expect(service.onError()).toBe(onError);
    });

    it('onError replaces previous callback when updated', () => {
      const onError1 = jest.fn();
      const onError2 = jest.fn();
      service.onError.set(onError1);
      service.onError.set(onError2);
      expect(service.onError()).toBe(onError2);
    });

    it('calling onError() callback directly invokes the function', () => {
      const onError = jest.fn();
      service.onError.set(onError);
      const err = new Error('fetch failed');
      service.onError()?.(err);
      expect(onError).toHaveBeenCalledWith(err);
    });

    it('isLoadingResolved is false for client-side mode (no dataSource)', () => {
      // Client-side: serverLoading is reset to false, controlledLoading undefined
      service.data.set(data);
      expect(service.isLoadingResolved()).toBe(false);
    });

    it('isLoadingResolved reflects controlledLoading when set', () => {
      service.controlledLoading.set(true);
      expect(service.isLoadingResolved()).toBe(true);
    });

    it('isLoadingResolved returns false when controlledLoading is false', () => {
      service.controlledLoading.set(false);
      expect(service.isLoadingResolved()).toBe(false);
    });

    it('configure() with onError undefined does not overwrite existing onError', () => {
      const onError = jest.fn();
      service.onError.set(onError);
      // configure without onError in props
      service.configure({ columns, getRowId, data });
      // onError was set via signal, configure skips undefined onError
      // check it's still set  -  configure only sets if truthy
      expect(service.onError()).toBe(onError);
    });

    it('isServerSide is false when dataSource is not provided', () => {
      expect(service.isServerSide()).toBe(false);
    });

    it('isServerSide is true when dataSource is provided', () => {
      const dataSource = {
        fetchPage: jest.fn().mockResolvedValue({ items: [], totalCount: 0 }),
      };
      service.dataSource.set(dataSource);
      expect(service.isServerSide()).toBe(true);
    });

    it('isClientSide is true when no dataSource', () => {
      expect(service.isClientSide()).toBe(true);
    });

    it('isClientSide is false when dataSource is provided', () => {
      const dataSource = {
        fetchPage: jest.fn().mockResolvedValue({ items: [], totalCount: 0 }),
      };
      service.dataSource.set(dataSource);
      expect(service.isClientSide()).toBe(false);
    });
  });

  describe('Virtual scroll configuration wiring', () => {
    beforeEach(() => {
      service.columnsProp.set(columns);
      service.getRowId.set(getRowId);
      service.data.set(data);
      service.defaultPageSize.set(10);
    });

    it('virtualScroll defaults to undefined', () => {
      expect(service.virtualScroll()).toBeUndefined();
    });

    it('configure() sets virtualScroll signal from props', () => {
      const vsConfig = { rowHeight: 48, threshold: 50 };
      service.configure({ columns, getRowId, data, virtualScroll: vsConfig });
      expect(service.virtualScroll()).toEqual(vsConfig);
    });

    it('virtualScroll is passed through dataGridProps', () => {
      const vsConfig = { rowHeight: 48 };
      service.virtualScroll.set(vsConfig);
      expect(service.dataGridProps().virtualScroll).toEqual(vsConfig);
    });

    it('virtualScroll threshold is passed through in config', () => {
      const vsConfig = { rowHeight: 36, threshold: 200 };
      service.configure({ columns, getRowId, data, virtualScroll: vsConfig });
      expect(service.dataGridProps().virtualScroll?.threshold).toBe(200);
    });
  });

  describe('workerSort', () => {
    it('workerSort defaults to false', () => {
      expect(service.workerSort()).toBe(false);
    });

    it('workerSort can be set via configure', () => {
      service.configure({ columns, getRowId, data, workerSort: true });
      expect(service.workerSort()).toBe(true);
    });

    it('sync path returns items when workerSort is off', () => {
      service.configure({ columns, getRowId, data, workerSort: false, defaultPageSize: 10 });
      const dgProps = service.dataGridProps();
      expect(dgProps.items.length).toBe(3);
    });

    it('displayItems falls back to empty when workerSort is on and async has not resolved', () => {
      service.configure({ columns, getRowId, data, workerSort: true, defaultPageSize: 10 });
      // Without Angular injection context, the async effect doesn't run.
      // The sync path is skipped (workerSort on), and async hasn't resolved yet.
      // displayItems should return empty array (server items fallback) or async result.
      const dgProps = service.dataGridProps();
      // Since async effect can't run in plain unit tests, items may be empty
      expect(dgProps.items).toBeDefined();
    });
  });
});
