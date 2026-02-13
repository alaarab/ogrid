/**
 * Shared PaginationControls tests for Vue.
 * Each Vue UI package calls createPaginationControlsTests() to run these.
 * Tests pagination state computed from useOGrid composable.
 */
import { ref } from 'vue';
import { useOGrid } from '../composables/useOGrid';
import type { IOGridProps, IOGridClientProps } from '../types';
import { fixtureRows, fixtureColumns, getRowId, type FixtureRow } from './fixtures';

export function createPaginationControlsTests(): void {
  function createPagination(overrides: Partial<IOGridClientProps<FixtureRow>> = {}) {
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

  it('returns correct pagination state for all items on one page', () => {
    const { pagination } = createPagination();
    expect(pagination.value.page).toBe(1);
    expect(pagination.value.pageSize).toBe(10);
    expect(pagination.value.displayTotalCount).toBe(3);
  });

  it('returns correct page range with small page size', () => {
    const { pagination } = createPagination({ defaultPageSize: 2 });
    expect(pagination.value.displayTotalCount).toBe(3);
    expect(pagination.value.pageSize).toBe(2);
  });

  it('setPage navigates to next page', () => {
    const { pagination, dataGridProps } = createPagination({ defaultPageSize: 2 });
    expect(dataGridProps.value.items.length).toBe(2);

    pagination.value.setPage(2);
    expect(pagination.value.page).toBe(2);
    expect(dataGridProps.value.items.length).toBe(1);
    expect(dataGridProps.value.items[0].name).toBe('Gamma');
  });

  it('first page detection: page 1 is first page', () => {
    const { pagination } = createPagination({ defaultPageSize: 2 });
    expect(pagination.value.page).toBe(1);
  });

  it('last page detection', () => {
    const { pagination } = createPagination({ defaultPageSize: 2 });
    pagination.value.setPage(2);
    expect(pagination.value.page).toBe(2);
    // Total 3 items, pageSize 2 -> 2 pages
    const totalPages = Math.ceil(pagination.value.displayTotalCount / pagination.value.pageSize);
    expect(pagination.value.page).toBe(totalPages);
  });

  it('setPageSize changes page size and resets to page 1', () => {
    const { pagination } = createPagination({ defaultPageSize: 2 });
    pagination.value.setPage(2);
    expect(pagination.value.page).toBe(2);

    pagination.value.setPageSize(25);
    expect(pagination.value.pageSize).toBe(25);
    expect(pagination.value.page).toBe(1);
  });
}
