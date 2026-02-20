/**
 * Shared OGrid (top-level composable) tests for Vue.
 * Each Vue UI package calls createOGridTests() to run these.
 * Tests the useOGrid composable directly via Vue reactivity.
 */
import { ref } from 'vue';
import { useOGrid } from '../composables/useOGrid';
import type { IOGridProps, IOGridClientProps } from '../types';
import { fixtureRows, fixtureColumns, getRowId, type FixtureRow } from './fixtures';

export function createOGridTests(): void {
  function createOGrid(overrides: Partial<IOGridClientProps<FixtureRow>> = {}) {
    const defaultProps: IOGridClientProps<FixtureRow> = {
      columns: fixtureColumns,
      getRowId,
      data: fixtureRows,
      defaultPageSize: 10,
      ...overrides,
    };
    const props = ref<IOGridProps<FixtureRow>>(defaultProps);
    return useOGrid(props);
  }

  it('returns dataGridProps with items', () => {
    const { dataGridProps } = createOGrid();
    expect(dataGridProps.value.items).toEqual(fixtureRows);
    expect(dataGridProps.value.items.length).toBe(3);
  });

  it('uses defaultSortBy and defaultSortDirection', () => {
    const { dataGridProps } = createOGrid({ defaultSortBy: 'name', defaultSortDirection: 'desc' });
    expect(dataGridProps.value.items.map((r) => r.name)).toEqual(['Gamma', 'Beta', 'Alpha']);
  });

  it('filtering reduces visible rows', () => {
    const { dataGridProps } = createOGrid({
      filters: { status: { type: 'multiSelect', value: ['Closed'] } },
    });
    expect(dataGridProps.value.items.map((r) => r.name)).toEqual(['Beta']);
  });

  it('sort change updates order', () => {
    const { dataGridProps } = createOGrid();
    // Trigger sort via onColumnSort
    dataGridProps.value.onColumnSort?.('name');
    // First click -> desc (since default is asc on first column)
    expect(dataGridProps.value.sortDirection).toBe('desc');
    expect(dataGridProps.value.items.map((r) => r.name)).toEqual(['Gamma', 'Beta', 'Alpha']);
    // Click again -> asc
    dataGridProps.value.onColumnSort?.('name');
    expect(dataGridProps.value.sortDirection).toBe('asc');
  });

  it('pagination shows correct slice', () => {
    const { dataGridProps, pagination } = createOGrid({ defaultPageSize: 2 });
    expect(dataGridProps.value.items.length).toBe(2);
    expect(dataGridProps.value.items.map((r) => r.name)).toEqual(['Alpha', 'Beta']);
    expect(pagination.value.displayTotalCount).toBe(3);
    // Navigate to page 2
    pagination.value.setPage(2);
    expect(dataGridProps.value.items.map((r) => r.name)).toEqual(['Gamma']);
  });

  it('column visibility toggles columns', () => {
    const { columnChooser, dataGridProps } = createOGrid();
    expect(columnChooser.value.visibleColumns.has('status')).toBe(true);
    // Hide status column
    columnChooser.value.onVisibilityChange('status', false);
    expect(columnChooser.value.visibleColumns.has('status')).toBe(false);
    expect(dataGridProps.value.visibleColumns.has('status')).toBe(false);
    // Re-show status
    columnChooser.value.onVisibilityChange('status', true);
    expect(columnChooser.value.visibleColumns.has('status')).toBe(true);
  });

  it('hides column chooser when columnChooser=false', () => {
    const { columnChooser } = createOGrid({ columnChooser: false });
    expect(columnChooser.value.placement).toBe('none');
  });

  it('moves column chooser to sidebar when columnChooser="sidebar"', () => {
    const { columnChooser } = createOGrid({ columnChooser: 'sidebar' });
    expect(columnChooser.value.placement).toBe('sidebar');
  });

  it('shows column chooser in toolbar by default', () => {
    const { columnChooser } = createOGrid();
    expect(columnChooser.value.placement).toBe('toolbar');
  });

  it('integration: filter+sort+paginate+visibility all work together', () => {
    const { dataGridProps, pagination, columnChooser } = createOGrid({ defaultPageSize: 10 });

    // Filter to only Active rows
    dataGridProps.value.onFilterChange?.('status', { type: 'multiSelect', value: ['Active'] });
    expect(dataGridProps.value.items.map((r) => r.name)).toEqual(['Alpha', 'Gamma']);

    // Sort by name desc
    dataGridProps.value.onColumnSort?.('name');
    expect(dataGridProps.value.items.map((r) => r.name)).toEqual(['Gamma', 'Alpha']);

    // Verify pagination total reflects filtered count
    expect(pagination.value.displayTotalCount).toBe(2);

    // Hide name column
    columnChooser.value.onVisibilityChange('name', false);
    expect(dataGridProps.value.visibleColumns.has('name')).toBe(false);

    // Items still there (visibility only affects display, not data)
    expect(dataGridProps.value.items.length).toBe(2);
  });

  it('fullScreen=true threads to layout', () => {
    const { layout } = createOGrid({ fullScreen: true });
    expect(layout.value.fullScreen).toBe(true);
  });

  it('fullScreen defaults to undefined/false in layout', () => {
    const { layout } = createOGrid();
    expect(layout.value.fullScreen).toBeFalsy();
  });

  it('stickyHeader=true threads to dataGridProps', () => {
    const { dataGridProps } = createOGrid({ stickyHeader: true });
    expect(dataGridProps.value.stickyHeader).toBe(true);
  });

  it('stickyHeader defaults to true in dataGridProps', () => {
    const { dataGridProps } = createOGrid();
    expect(dataGridProps.value.stickyHeader).toBe(true);
  });

  it('stickyHeader=false threads to dataGridProps', () => {
    const { dataGridProps } = createOGrid({ stickyHeader: false });
    expect(dataGridProps.value.stickyHeader).toBe(false);
  });

  it('fullScreen and stickyHeader can both be set', () => {
    const { layout, dataGridProps } = createOGrid({ fullScreen: true, stickyHeader: false });
    expect(layout.value.fullScreen).toBe(true);
    expect(dataGridProps.value.stickyHeader).toBe(false);
  });
}
