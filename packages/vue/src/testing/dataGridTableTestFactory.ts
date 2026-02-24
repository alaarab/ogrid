/**
 * Shared DataGridTable tests for Vue.
 * Each Vue UI package calls createDataGridTableTests() to run these.
 * Tests the useDataGridState composable directly via Vue reactivity.
 */
import { ref, shallowRef } from 'vue';
import { useDataGridState } from '../composables/useDataGridState';
import type { IOGridDataGridProps, IColumnDef } from '../types';
import { fixtureRows, getRowId, type FixtureRow } from './fixtures';

const twoColumnColumns: IColumnDef<FixtureRow>[] = [
  { columnId: 'name', name: 'Name', sortable: true, filterable: { type: 'text' } },
  { columnId: 'status', name: 'Status', sortable: true, filterable: { type: 'multiSelect', filterField: 'status' } },
];

function createDataGridState(overrides: Partial<IOGridDataGridProps<FixtureRow>> = {}) {
  const defaultProps: IOGridDataGridProps<FixtureRow> = {
    items: fixtureRows.slice(0, 2),
    columns: twoColumnColumns,
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
  };
  const props = ref<IOGridDataGridProps<FixtureRow>>(defaultProps);
  const wrapperRef = shallowRef<HTMLDivElement | null>(null);
  return { result: useDataGridState({ props, wrapperRef }), props };
}

export function createDataGridTableTests(): void {
  it('returns layout with flatColumns and visibleCols', () => {
    const { result } = createDataGridState();
    expect(result.layout.value.flatColumns.length).toBe(2);
    expect(result.layout.value.visibleCols.length).toBe(2);
    expect(result.layout.value.visibleCols.map((c) => c.columnId)).toEqual(['name', 'status']);
  });

  it('visibleCols filters based on visibleColumns prop', () => {
    const { result } = createDataGridState({ visibleColumns: new Set(['name']) });
    expect(result.layout.value.visibleCols.length).toBe(1);
    expect(result.layout.value.visibleCols[0].columnId).toBe('name');
  });

  it('returns editing sub-object with null editingCell initially', () => {
    const { result } = createDataGridState();
    expect(result.editing.value.editingCell).toBeNull();
    expect(result.editing.value.pendingEditorValue).toBeUndefined();
  });

  it('returns interaction sub-object with null activeCell initially', () => {
    const { result } = createDataGridState();
    expect(result.interaction.value.activeCell).toBeNull();
    expect(result.interaction.value.selectionRange).toBeNull();
    expect(result.interaction.value.hasCellSelection).toBe(false);
  });

  it('returns contextMenu sub-object with null menuPosition initially', () => {
    const { result } = createDataGridState();
    expect(result.contextMenu.value.menuPosition).toBeNull();
  });

  it('returns viewModels with headerFilterInput', () => {
    const { result } = createDataGridState();
    const hf = result.viewModels.value.headerFilterInput;
    expect(hf.filters).toEqual({});
    expect(hf.filterOptions).toEqual({ status: ['Active', 'Closed'] });
  });

  it('returns rowSelection sub-object', () => {
    const { result } = createDataGridState({ rowSelection: 'multiple' });
    expect(result.rowSelection.value.selectedRowIds.size).toBe(0);
    expect(result.rowSelection.value.allSelected).toBe(false);
    expect(result.rowSelection.value.someSelected).toBe(false);
  });

  it('hasCheckboxCol is true when rowSelection is multiple', () => {
    const { result } = createDataGridState({ rowSelection: 'multiple' });
    expect(result.layout.value.hasCheckboxCol).toBe(true);
  });

  it('hasCheckboxCol is false when rowSelection is none', () => {
    const { result } = createDataGridState({ rowSelection: 'none' });
    expect(result.layout.value.hasCheckboxCol).toBe(false);
  });

  it('shows empty state when no items and emptyState provided', () => {
    const { result } = createDataGridState({
      items: [],
      emptyState: { hasActiveFilters: true, onClearAll: jest.fn() },
    });
    expect(result.viewModels.value.showEmptyInGrid).toBe(true);
  });

  it('does not show empty state when items exist', () => {
    const { result } = createDataGridState({
      emptyState: { hasActiveFilters: false, onClearAll: jest.fn() },
    });
    expect(result.viewModels.value.showEmptyInGrid).toBe(false);
  });

  it('returns status bar config when statusBar is provided', () => {
    const { result } = createDataGridState({ statusBar: { totalCount: 2, suppressRowCount: false } });
    expect(result.viewModels.value.statusBarConfig).not.toBeNull();
    expect(result.viewModels.value.statusBarConfig?.totalCount).toBe(2);
  });

  it('returns null status bar when not configured', () => {
    const { result } = createDataGridState();
    expect(result.viewModels.value.statusBarConfig).toBeNull();
  });

  it('returns pinning sub-object', () => {
    const { result } = createDataGridState();
    expect(result.pinning.value.pinnedColumns).toEqual({});
    expect(result.pinning.value.headerMenu.isOpen).toBe(false);
  });

  it('stickyHeader defaults to true in layout', () => {
    const { result } = createDataGridState();
    expect(result.layout.value.stickyHeader).toBe(true);
  });

  it('stickyHeader=false is reflected in layout', () => {
    const { result } = createDataGridState({ stickyHeader: false });
    expect(result.layout.value.stickyHeader).toBe(false);
  });

  it('aria-sort: headerFilterInput reflects sortBy and sortDirection', () => {
    const { result } = createDataGridState({ sortBy: 'name', sortDirection: 'asc' });
    expect(result.viewModels.value.headerFilterInput.sortBy).toBe('name');
    expect(result.viewModels.value.headerFilterInput.sortDirection).toBe('asc');
  });

  it('aria-sort: headerFilterInput reflects descending sort', () => {
    const { result } = createDataGridState({ sortBy: 'status', sortDirection: 'desc' });
    expect(result.viewModels.value.headerFilterInput.sortBy).toBe('status');
    expect(result.viewModels.value.headerFilterInput.sortDirection).toBe('desc');
  });

  it('aria-sort: unsorted column has undefined sortBy', () => {
    const { result } = createDataGridState({ sortBy: undefined });
    expect(result.viewModels.value.headerFilterInput.sortBy).toBeUndefined();
  });

  it('onCellError callback is threaded through viewModels', () => {
    const onCellError = jest.fn();
    const { result } = createDataGridState({ onCellError });
    expect(result.viewModels.value.onCellError).toBe(onCellError);
  });

  it('onCellError is undefined when not provided', () => {
    const { result } = createDataGridState();
    expect(result.viewModels.value.onCellError).toBeUndefined();
  });

  it('onCellError callback is callable with error and info', () => {
    const onCellError = jest.fn();
    const { result } = createDataGridState({ onCellError });
    const err = new Error('render error');
    result.viewModels.value.onCellError?.(err, { componentStack: 'stack' });
    expect(onCellError).toHaveBeenCalledWith(err, { componentStack: 'stack' });
  });
}
