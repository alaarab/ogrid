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

    // Support both single-prop (Material/Radix: propsInput) and individual-input (PrimeNG) APIs
    if (typeof instance.propsInput?.set === 'function') {
      instance.propsInput.set(props);
    } else {
      // PrimeNG uses individual inputs — set each one
      if (instance.itemsInput?.set) instance.itemsInput.set(props.items);
      if (instance.columns?.set) instance.columns.set(props.columns);
      if (instance.getRowIdInput?.set) instance.getRowIdInput.set(props.getRowId);
      if (instance.sortBy?.set) instance.sortBy.set(props.sortBy);
      if (instance.sortDirection?.set) instance.sortDirection.set(props.sortDirection ?? 'asc');
      if (instance.onColumnSort?.set) instance.onColumnSort.set(props.onColumnSort);
      if (instance.visibleColumns?.set) instance.visibleColumns.set(props.visibleColumns);
      if (instance.filters?.set) instance.filters.set(props.filters);
      if (instance.onFilterChange?.set) instance.onFilterChange.set(props.onFilterChange);
      if (instance.filterOptions?.set) instance.filterOptions.set(props.filterOptions ?? {});
      if (instance.loadingFilterOptions?.set) instance.loadingFilterOptions.set(props.loadingFilterOptions ?? {});
      if (instance.isLoadingInput?.set) instance.isLoadingInput.set(props.isLoading ?? false);
      if (instance.suppressHorizontalScroll?.set) instance.suppressHorizontalScroll.set(props.suppressHorizontalScroll);
      if (instance.statusBar?.set) instance.statusBar.set(props.statusBar);
      if (instance.emptyStateInput?.set) instance.emptyStateInput.set(props.emptyState);
      if (instance.editable?.set) instance.editable.set(props.editable);
      if (instance.onCellValueChanged?.set) instance.onCellValueChanged.set(props.onCellValueChanged);
      if (instance.cellSelection?.set) instance.cellSelection.set(props.cellSelection);
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
