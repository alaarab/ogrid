/**
 * Shared DataGridTable tests for Angular UI packages.
 * Each UI package calls createDataGridTableTests(DataGridTableComponent) to run these.
 *
 * Tests instantiate the component class directly and verify behavior through
 * the BaseDataGridTableComponent signals and DataGridStateService.
 */
import { fixtureRows, fixtureColumns, getRowId } from './fixtures';
import type { FixtureRow } from './fixtures';
import type { IOGridDataGridProps, IColumnDef, IColumnGroupDef, FilterValue, IStatusBarProps, ICellValueChangedEvent } from '../types';
import type { DataGridStateService } from '../services/datagrid-state.service';
import type { Signal, SimpleChanges } from '@angular/core';

function makeProps(overrides: Partial<IOGridDataGridProps<FixtureRow>> = {}): IOGridDataGridProps<FixtureRow> {
  return {
    items: fixtureRows.slice(0, 2),
    columns: fixtureColumns as IColumnDef<FixtureRow>[],
    getRowId,
    sortBy: undefined,
    sortDirection: 'asc',
    onColumnSort: jest.fn(),
    visibleColumns: new Set(['name', 'status']),
    filters: {},
    onFilterChange: jest.fn(),
    filterOptions: { status: ['Active', 'Closed'] },
    loadingFilterOptions: {},
    ...overrides,
  } as IOGridDataGridProps<FixtureRow>;
}

interface DataGridTableInstance {
  propsInput?: IOGridDataGridProps<FixtureRow>;
  itemsInput?: FixtureRow[];
  columns?: (IColumnDef<FixtureRow> | IColumnGroupDef<FixtureRow>)[];
  getRowIdInput?: (item: FixtureRow) => string | number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  onColumnSort?: (columnKey: string) => void;
  visibleColumns?: Set<string>;
  filters?: Record<string, unknown>;
  onFilterChange?: (key: string, value: FilterValue | undefined) => void;
  filterOptions?: Record<string, string[]>;
  loadingFilterOptions?: Record<string, boolean>;
  isLoadingInput?: boolean;
  suppressHorizontalScroll?: boolean;
  stickyHeaderInput?: boolean;
  statusBar?: IStatusBarProps;
  emptyStateInput?: {
    onClearAll: () => void;
    hasActiveFilters: boolean;
    message?: string;
    render?: unknown;
  };
  editable?: boolean;
  onCellValueChanged?: (event: ICellValueChangedEvent<FixtureRow>) => void;
  cellSelection?: boolean;
  ngOnChanges?: (changes: SimpleChanges) => void;
  stateService: DataGridStateService<FixtureRow>;
  allowOverflowX: Signal<boolean>;
  stickyHeader: Signal<boolean>;
  items: Signal<FixtureRow[]>;
  getRowId: Signal<(item: FixtureRow) => string | number>;
  isLoading: Signal<boolean>;
  commitEdit: () => void;
  cancelEdit: () => void;
  onEditorKeydown: (event: KeyboardEvent) => void;
}

// Use unknown for the constructor since DataGridTableComponent is a generic class
// The instance will be cast to DataGridTableInstance after instantiation
export function createDataGridTableTests(DataGridTableComponent: new () => unknown): void {
  function createComponent(overrides: Partial<IOGridDataGridProps<FixtureRow>> = {}): DataGridTableInstance {
    const instance = new DataGridTableComponent() as DataGridTableInstance;
    const props = makeProps(overrides);

    // Set propsInput for Material/Radix (single-prop API via @Input setter)
    instance.propsInput = props;
    // Also set individual inputs for PrimeNG (individual-input API)
    instance.itemsInput = props.items;
    instance.columns = props.columns;
    instance.getRowIdInput = props.getRowId;
    instance.sortBy = props.sortBy;
    instance.sortDirection = props.sortDirection ?? 'asc';
    instance.onColumnSort = props.onColumnSort;
    instance.visibleColumns = props.visibleColumns;
    instance.filters = props.filters;
    instance.onFilterChange = props.onFilterChange;
    instance.filterOptions = props.filterOptions ?? {};
    instance.loadingFilterOptions = props.loadingFilterOptions ?? {};
    if (props.isLoading !== undefined) instance.isLoadingInput = props.isLoading;
    if (props.suppressHorizontalScroll !== undefined) instance.suppressHorizontalScroll = props.suppressHorizontalScroll;
    if (props.stickyHeader !== undefined) instance.stickyHeaderInput = props.stickyHeader;
    if (props.statusBar !== undefined) instance.statusBar = props.statusBar;
    if (props.emptyState !== undefined) instance.emptyStateInput = props.emptyState;
    if (props.editable !== undefined) instance.editable = props.editable;
    if (props.onCellValueChanged !== undefined) instance.onCellValueChanged = props.onCellValueChanged;
    if (props.cellSelection !== undefined) instance.cellSelection = props.cellSelection;
    // Trigger ngOnChanges for PrimeNG (rebuilds propsSignal from individual inputs)
    if (typeof instance.ngOnChanges === 'function') {
      instance.ngOnChanges({});
    }
    // Feed props into the state service
    instance.stateService.props.set(props);
    return instance;
  }

  it('instantiates correctly', () => {
    const comp = createComponent();
    expect(comp).toBeTruthy();
    expect(comp.stateService).toBeDefined();
  });

  it('has base class methods (commitEdit, cancelEdit, onEditorKeydown)', () => {
    const comp = createComponent();
    expect(typeof comp.commitEdit).toBe('function');
    expect(typeof comp.cancelEdit).toBe('function');
    expect(typeof comp.onEditorKeydown).toBe('function');
  });

  it('items computed returns correct items from props', () => {
    const comp = createComponent();
    expect(comp.items()).toEqual(fixtureRows.slice(0, 2));
  });

  it('getRowId computed returns the getRowId function', () => {
    const comp = createComponent();
    const fn = comp.getRowId();
    expect(fn(fixtureRows[0])).toBe('1');
  });

  it('isLoading defaults to false', () => {
    const comp = createComponent();
    expect(comp.isLoading()).toBe(false);
  });

  it('isLoading reflects props.isLoading', () => {
    const comp = createComponent({ isLoading: true });
    expect(comp.isLoading()).toBe(true);
  });

  it('state service computes visibleCols from props', () => {
    const comp = createComponent();
    const state = comp.stateService.getState();
    const visColIds = state.layout.visibleCols.map((c: IColumnDef<FixtureRow>) => c.columnId);
    expect(visColIds).toEqual(['name', 'status']);
  });

  it('visibleCols filters out hidden columns', () => {
    const comp = createComponent({ visibleColumns: new Set(['name']) });
    const state = comp.stateService.getState();
    const visColIds = state.layout.visibleCols.map((c: IColumnDef<FixtureRow>) => c.columnId);
    expect(visColIds).toEqual(['name']);
  });

  it('suppressHorizontalScroll is reflected', () => {
    const comp = createComponent({ suppressHorizontalScroll: true });
    expect(comp.allowOverflowX()).toBe(false);
  });

  it('statusBar computed returns config when statusBar is provided', () => {
    const comp = createComponent({ statusBar: { totalCount: 2, suppressRowCount: false } });
    const state = comp.stateService.getState();
    expect(state.viewModels.statusBarConfig).toBeTruthy();
  });

  it('statusBar is null when statusBar prop is not set', () => {
    const comp = createComponent();
    const state = comp.stateService.getState();
    expect(state.viewModels.statusBarConfig).toBeNull();
  });

  it('emptyState shows when items empty and emptyState provided', () => {
    const comp = createComponent({ items: [], emptyState: { hasActiveFilters: true, onClearAll: jest.fn() } });
    const state = comp.stateService.getState();
    expect(state.viewModels.showEmptyInGrid).toBe(true);
  });

  it('editable mode: state has onCellValueChanged when provided', () => {
    const onCellValueChanged = jest.fn();
    const comp = createComponent({ editable: true, onCellValueChanged });
    const state = comp.stateService.getState();
    expect(state.viewModels.cellDescriptorInput.editable).toBe(true);
    expect(state.viewModels.cellDescriptorInput.onCellValueChanged).toBeDefined();
  });

  it('headerFilterInput has correct structure', () => {
    const comp = createComponent();
    const state = comp.stateService.getState();
    const hfi = state.viewModels.headerFilterInput;
    expect(hfi.sortDirection).toBe('asc');
    expect(typeof hfi.onColumnSort).toBe('function');
    expect(hfi.filters).toEqual({});
    expect(typeof hfi.onFilterChange).toBe('function');
  });

  it('stickyHeader defaults to true', () => {
    const comp = createComponent();
    expect(comp.stickyHeader()).toBe(true);
  });

  it('stickyHeader=false is reflected in computed signal', () => {
    const comp = createComponent({ stickyHeader: false });
    expect(comp.stickyHeader()).toBe(false);
  });

  describe('onKeyDown intercept', () => {
    it('onKeyDown callback receives keyboard events from handleGridKeyDown', () => {
      const onKeyDown = jest.fn();
      const comp = createComponent({ onKeyDown, cellSelection: true });
      // Set active cell so key handling proceeds
      comp.stateService.setActiveCell({ rowIndex: 0, columnIndex: 0 });
      comp.stateService.setSelectionRange({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 });
      const e = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
      comp.stateService.handleGridKeyDown(e);
      expect(onKeyDown).toHaveBeenCalledWith(e);
    });

    it('preventDefault in onKeyDown suppresses grid default handling', () => {
      const onKeyDown = jest.fn((e: KeyboardEvent) => e.preventDefault());
      const comp = createComponent({ onKeyDown, cellSelection: true });
      comp.stateService.setActiveCell({ rowIndex: 0, columnIndex: 0 });
      comp.stateService.setSelectionRange({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 });
      const initialActive = comp.stateService.getState().interaction.activeCell;
      const e = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
      comp.stateService.handleGridKeyDown(e);
      // Active cell should not have changed since preventDefault was called
      expect(comp.stateService.getState().interaction.activeCell).toEqual(initialActive);
      expect(onKeyDown).toHaveBeenCalledWith(e);
    });
  });

  describe('aria-sort on sorted columns', () => {
    it('headerFilterInput reflects ascending sort direction', () => {
      const comp = createComponent({ sortBy: 'name', sortDirection: 'asc' });
      const state = comp.stateService.getState();
      expect(state.viewModels.headerFilterInput.sortBy).toBe('name');
      expect(state.viewModels.headerFilterInput.sortDirection).toBe('asc');
    });

    it('headerFilterInput reflects descending sort direction', () => {
      const comp = createComponent({ sortBy: 'status', sortDirection: 'desc' });
      const state = comp.stateService.getState();
      expect(state.viewModels.headerFilterInput.sortBy).toBe('status');
      expect(state.viewModels.headerFilterInput.sortDirection).toBe('desc');
    });

    it('headerFilterInput has undefined sortBy when no sort is active', () => {
      const comp = createComponent({ sortBy: undefined });
      const state = comp.stateService.getState();
      expect(state.viewModels.headerFilterInput.sortBy).toBeUndefined();
    });
  });

  describe('error handling in cell rendering', () => {
    it('onCellError callback is threaded through viewModels', () => {
      const onCellError = jest.fn();
      const comp = createComponent({ onCellError });
      const state = comp.stateService.getState();
      expect(state.viewModels.onCellError).toBe(onCellError);
    });

    it('onCellError is undefined when not provided', () => {
      const comp = createComponent();
      const state = comp.stateService.getState();
      expect(state.viewModels.onCellError).toBeUndefined();
    });
  });
}
