import { DataGridStateService } from '../services/datagrid-state.service';
import type { IOGridDataGridProps, IColumnDef } from '../types';

type Row = { id: string; name: string; value: number };

const columns = [
  { columnId: 'name', name: 'Name', sortable: true, editable: true, cellEditor: 'text' },
  { columnId: 'value', name: 'Value', type: 'numeric', sortable: true },
] as IColumnDef<Row>[];
const getRowId = (r: Row) => r.id;
const rows: Row[] = [
  { id: '1', name: 'Alpha', value: 100 },
  { id: '2', name: 'Beta', value: 200 },
  { id: '3', name: 'Gamma', value: 150 },
];

function makeProps(overrides: Partial<IOGridDataGridProps<Row>> = {}): IOGridDataGridProps<Row> {
  return {
    columns,
    items: rows,
    getRowId,
    sortBy: undefined,
    sortDirection: 'asc',
    onColumnSort: jest.fn(),
    visibleColumns: new Set(['name', 'value']),
    filters: {},
    onFilterChange: jest.fn(),
    filterOptions: {},
    loadingFilterOptions: {},
    ...overrides,
  } as IOGridDataGridProps<Row>;
}

describe('DataGridStateService', () => {
  let service: DataGridStateService<Row>;

  beforeEach(() => {
    service = new DataGridStateService<Row>();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Layout state', () => {
    it('computes flatColumns from props', () => {
      service.props.set(makeProps());
      const flat = service.flatColumns();
      expect(flat).toHaveLength(2);
      expect(flat.map((c) => c.columnId)).toEqual(['name', 'value']);
    });

    it('computes visibleCols based on visibleColumns set', () => {
      service.props.set(makeProps({ visibleColumns: new Set(['name']) }));
      const visible = service.visibleCols();
      expect(visible).toHaveLength(1);
      expect(visible[0].columnId).toBe('name');
    });

    it('computes totalColCount with no special columns', () => {
      service.props.set(makeProps());
      expect(service.totalColCount()).toBe(2);
    });

    it('computes totalColCount with checkbox column for multiple row selection', () => {
      service.props.set(makeProps({ rowSelection: 'multiple' }));
      expect(service.hasCheckboxCol()).toBe(true);
      expect(service.totalColCount()).toBe(3);
    });

    it('computes colOffset for special columns', () => {
      service.props.set(makeProps());
      expect(service.colOffset()).toBe(0);

      service.props.set(makeProps({ rowSelection: 'multiple' }));
      expect(service.colOffset()).toBe(1);
    });

    it('builds rowIndexByRowId map', () => {
      service.props.set(makeProps());
      const map = service.rowIndexByRowId();
      expect(map.get('1')).toBe(0);
      expect(map.get('2')).toBe(1);
      expect(map.get('3')).toBe(2);
    });

    it('respects columnOrder for visible columns', () => {
      service.props.set(makeProps({ columnOrder: ['value', 'name'] }));
      const visible = service.visibleCols();
      expect(visible.map((c) => c.columnId)).toEqual(['value', 'name']);
    });
  });

  describe('Cell selection state', () => {
    beforeEach(() => {
      service.props.set(makeProps({ editable: true, onCellValueChanged: jest.fn() }));
    });

    it('cellSelection defaults to true', () => {
      expect(service.cellSelection()).toBe(true);
    });

    it('cellSelection can be disabled', () => {
      service.props.set(makeProps({ cellSelection: false }));
      expect(service.cellSelection()).toBe(false);
    });

    it('hasCellSelection is false initially', () => {
      expect(service.hasCellSelection()).toBe(false);
    });
  });

  describe('Row selection state', () => {
    beforeEach(() => {
      service.props.set(makeProps({ rowSelection: 'multiple' }));
    });

    it('selectedRowIds is empty initially', () => {
      expect(service.selectedRowIds().size).toBe(0);
    });

    it('allSelected is false with no selections', () => {
      expect(service.allSelected()).toBe(false);
    });

    it('someSelected is false with no selections', () => {
      expect(service.someSelected()).toBe(false);
    });

    it('uses controlled selectedRows when provided', () => {
      service.props.set(makeProps({
        rowSelection: 'multiple',
        selectedRows: new Set(['1', '2']),
      }));
      expect(service.selectedRowIds().size).toBe(2);
      expect(service.selectedRowIds().has('1')).toBe(true);
    });
  });

  describe('Status bar state', () => {
    it('statusBarConfig is null when statusBar is not set', () => {
      service.props.set(makeProps());
      expect(service.statusBarConfig()).toBeNull();
    });

    it('statusBarConfig is computed when statusBar is set', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      service.props.set(makeProps({ statusBar: true as any }));
      const config = service.statusBarConfig();
      expect(config).toBeTruthy();
      expect(config!.totalCount).toBe(3);
    });
  });

  describe('Empty state', () => {
    it('showEmptyInGrid is false when items exist', () => {
      service.props.set(makeProps());
      expect(service.showEmptyInGrid()).toBe(false);
    });

    it('showEmptyInGrid is true when no items and emptyState provided', () => {
      service.props.set(makeProps({
        items: [],
        emptyState: { hasActiveFilters: false, onClearAll: jest.fn() },
      }));
      expect(service.showEmptyInGrid()).toBe(true);
    });

    it('showEmptyInGrid is false when loading', () => {
      service.props.set(makeProps({
        items: [],
        emptyState: { hasActiveFilters: false, onClearAll: jest.fn() },
        isLoading: true,
      }));
      expect(service.showEmptyInGrid()).toBe(false);
    });
  });

  describe('Undo/redo state', () => {
    it('canUndo and canRedo are false initially', () => {
      service.props.set(makeProps());
      expect(service.canUndo()).toBe(false);
      expect(service.canRedo()).toBe(false);
    });
  });

  describe('Column pinning', () => {
    it('flatColumns applies pinned overrides from props', () => {
      service.props.set(makeProps({ pinnedColumns: { name: 'left' } }));
      const flat = service.flatColumns();
      const nameCol = flat.find((c) => c.columnId === 'name');
      expect(nameCol?.pinned).toBe('left');
    });

    it('flatColumns without pinnedColumns returns original columns', () => {
      service.props.set(makeProps());
      const flat = service.flatColumns();
      expect(flat[0].pinned).toBeUndefined();
    });
  });

  describe('Table layout sizing', () => {
    it('minTableWidth is computed from visible columns', () => {
      service.props.set(makeProps());
      const minWidth = service.minTableWidth();
      expect(minWidth).toBeGreaterThan(0);
    });

    it('desiredTableWidth is computed from visible columns', () => {
      service.props.set(makeProps());
      const desiredWidth = service.desiredTableWidth();
      expect(desiredWidth).toBeGreaterThan(0);
    });

    it('desiredTableWidth includes checkbox column width for multiple selection', () => {
      const withoutCheckbox = (() => {
        service.props.set(makeProps());
        return service.desiredTableWidth();
      })();
      const withCheckbox = (() => {
        service.props.set(makeProps({ rowSelection: 'multiple' }));
        return service.desiredTableWidth();
      })();
      expect(withCheckbox).toBeGreaterThan(withoutCheckbox);
    });
  });
});
