/**
 * Shared DataGridTable tests for Angular UI packages.
 * Each UI package calls createDataGridTableTests(DataGridTableComponent) to run these.
 *
 * Tests instantiate the component class directly and verify behavior through
 * the BaseDataGridTableComponent signals and DataGridStateService.
 */
import { fixtureRows, fixtureColumns, getRowId } from './fixtures';
import type { FixtureRow } from './fixtures';
import type { IOGridDataGridProps, IColumnDef } from '../types';

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDataGridTableTests(DataGridTableComponent: new (...args: any[]) => any): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function createComponent(overrides: Partial<IOGridDataGridProps<FixtureRow>> = {}): any {
    const instance = new DataGridTableComponent();
    const props = makeProps(overrides);

    // Set propsInput for Material/Radix (single-prop API)
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
    if (props.statusBar !== undefined) instance.statusBar = props.statusBar;
    if (props.emptyState !== undefined) instance.emptyStateInput = props.emptyState;
    if (props.editable !== undefined) instance.editable = props.editable;
    if (props.onCellValueChanged !== undefined) instance.onCellValueChanged = props.onCellValueChanged;
    if (props.cellSelection !== undefined) instance.cellSelection = props.cellSelection;
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const comp = createComponent({ statusBar: { totalCount: 2, suppressRowCount: false } as any });
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
}
