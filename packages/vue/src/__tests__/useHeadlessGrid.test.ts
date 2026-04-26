import { ref } from 'vue';
import { useHeadlessGrid } from '../composables/useHeadlessGrid';
import type { IColumnDef } from '@alaarab/ogrid-core';

type Row = { id: string; name: string; score: number; status: 'Active' | 'Closed' };

const data: Row[] = [
  { id: '1', name: 'Alice', score: 90, status: 'Active' },
  { id: '2', name: 'Bob', score: 75, status: 'Closed' },
  { id: '3', name: 'Charlie', score: 85, status: 'Active' },
  { id: '4', name: 'Diana', score: 60, status: 'Closed' },
  { id: '5', name: 'Eve', score: 95, status: 'Active' },
  { id: '6', name: 'Frank', score: 70, status: 'Closed' },
];

const columns: IColumnDef<Row>[] = [
  { columnId: 'name', name: 'Name', type: 'text' },
  { columnId: 'score', name: 'Score', type: 'numeric' },
  {
    columnId: 'status',
    name: 'Status',
    type: 'text',
    filterable: { type: 'multiSelect' },
  },
];

const getRowId = (r: Row) => r.id;

describe('useHeadlessGrid (Vue)', () => {
  it('returns rows, columns, and totals on initial render', () => {
    const grid = useHeadlessGrid({ columns, data, getRowId });

    expect(grid.rows.value).toHaveLength(6);
    expect(grid.totalCount.value).toBe(6);
    expect(grid.columns.value).toHaveLength(3);
    expect(grid.totalPages.value).toBe(1);
  });

  it('paginates with initialPageSize', () => {
    const grid = useHeadlessGrid({ columns, data, getRowId, initialPageSize: 2 });

    expect(grid.rows.value).toHaveLength(2);
    expect(grid.totalCount.value).toBe(6);
    expect(grid.totalPages.value).toBe(3);
    expect(grid.rows.value[0].id).toBe('1');
  });

  it('moves to next page', () => {
    const grid = useHeadlessGrid({ columns, data, getRowId, initialPageSize: 2 });

    grid.setPage(2);
    expect(grid.rows.value[0].id).toBe('3');
  });

  it('sorts ascending via initialSort', () => {
    const grid = useHeadlessGrid({
      columns,
      data,
      getRowId,
      initialSort: { field: 'score', direction: 'asc' },
    });

    expect(grid.rows.value[0].name).toBe('Diana');
    expect(grid.rows.value[5].name).toBe('Eve');
  });

  it('toggleSort cycles sort direction', () => {
    const grid = useHeadlessGrid({ columns, data, getRowId });

    grid.toggleSort('score');
    expect(grid.sort.value.field).toBe('score');

    grid.toggleSort('score');
    expect(grid.sort.value.direction).toBe('desc');
  });

  it('sortIndicator returns reactive arrow', () => {
    const grid = useHeadlessGrid({
      columns,
      data,
      getRowId,
      initialSort: { field: 'name', direction: 'asc' },
    });

    expect(grid.sortIndicator('name').value).toBe('▲');
    expect(grid.sortIndicator('score').value).toBe('');
  });

  it('filters rows via setFilter', () => {
    const grid = useHeadlessGrid({ columns, data, getRowId });

    grid.setFilter('status', { type: 'multiSelect', value: ['Active'] });

    expect(grid.totalCount.value).toBe(3);
    expect(grid.hasActiveFilters.value).toBe(true);
    expect(grid.rows.value.every((r) => r.status === 'Active')).toBe(true);
  });

  it('filter changes return to page 1', () => {
    const grid = useHeadlessGrid({ columns, data, getRowId, initialPageSize: 2 });

    grid.setPage(3);
    expect(grid.page.value).toBe(3);

    grid.setFilter('status', { type: 'multiSelect', value: ['Active'] });
    expect(grid.page.value).toBe(1);
  });

  it('getCellValue resolves column values', () => {
    const grid = useHeadlessGrid({ columns, data, getRowId });

    expect(grid.getCellValue(data[0], 'name')).toBe('Alice');
    expect(grid.getCellValue(data[0], 'score')).toBe(90);
    expect(grid.getCellValue(data[0], 'unknown')).toBeUndefined();
  });

  it('toggleRowSelection toggles a row in/out', () => {
    const grid = useHeadlessGrid({ columns, data, getRowId });

    expect(grid.isRowSelected(data[0])).toBe(false);
    grid.toggleRowSelection(data[0]);
    expect(grid.isRowSelected(data[0])).toBe(true);
    expect(grid.selectedRowIds.value.size).toBe(1);
    grid.toggleRowSelection(data[0]);
    expect(grid.isRowSelected(data[0])).toBe(false);
  });

  it('selectAllOnPage selects only visible rows', () => {
    const grid = useHeadlessGrid({ columns, data, getRowId, initialPageSize: 2 });

    grid.selectAllOnPage();
    expect(grid.selectedRowIds.value.size).toBe(2);
    expect(grid.isRowSelected(data[0])).toBe(true);
    expect(grid.isRowSelected(data[2])).toBe(false);
  });

  it('clearSelection empties the set', () => {
    const grid = useHeadlessGrid({ columns, data, getRowId });

    grid.toggleRowSelection(data[0]);
    grid.toggleRowSelection(data[1]);
    expect(grid.selectedRowIds.value.size).toBe(2);

    grid.clearSelection();
    expect(grid.selectedRowIds.value.size).toBe(0);
  });

  it('reactively updates when input data ref changes', () => {
    const dataRef = ref<Row[]>(data.slice(0, 3));
    const grid = useHeadlessGrid({ columns, data: dataRef, getRowId });

    expect(grid.totalCount.value).toBe(3);

    dataRef.value = data;
    expect(grid.totalCount.value).toBe(6);
  });
});
