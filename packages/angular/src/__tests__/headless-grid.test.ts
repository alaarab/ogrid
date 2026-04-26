import { signal } from '@angular/core';
import { createHeadlessGrid } from '../services/headless-grid';
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

describe('createHeadlessGrid (Angular)', () => {
  it('returns rows, columns, and totals on initial setup', () => {
    const grid = createHeadlessGrid({ columns, data, getRowId });

    expect(grid.rows()).toHaveLength(6);
    expect(grid.totalCount()).toBe(6);
    expect(grid.columns()).toHaveLength(3);
    expect(grid.totalPages()).toBe(1);
  });

  it('paginates with initialPageSize', () => {
    const grid = createHeadlessGrid({ columns, data, getRowId, initialPageSize: 2 });

    expect(grid.rows()).toHaveLength(2);
    expect(grid.totalCount()).toBe(6);
    expect(grid.totalPages()).toBe(3);
    expect(grid.rows()[0].id).toBe('1');
  });

  it('moves to next page', () => {
    const grid = createHeadlessGrid({ columns, data, getRowId, initialPageSize: 2 });

    grid.setPage(2);
    expect(grid.rows()[0].id).toBe('3');
  });

  it('sorts ascending via initialSort', () => {
    const grid = createHeadlessGrid({
      columns,
      data,
      getRowId,
      initialSort: { field: 'score', direction: 'asc' },
    });

    expect(grid.rows()[0].name).toBe('Diana');
    expect(grid.rows()[5].name).toBe('Eve');
  });

  it('toggleSort cycles sort direction', () => {
    const grid = createHeadlessGrid({ columns, data, getRowId });

    grid.toggleSort('score');
    expect(grid.sort().field).toBe('score');

    grid.toggleSort('score');
    expect(grid.sort().direction).toBe('desc');
  });

  it('sortIndicator returns reactive arrow', () => {
    const grid = createHeadlessGrid({
      columns,
      data,
      getRowId,
      initialSort: { field: 'name', direction: 'asc' },
    });

    expect(grid.sortIndicator('name')()).toBe('▲');
    expect(grid.sortIndicator('score')()).toBe('');
  });

  it('filters rows via setFilter', () => {
    const grid = createHeadlessGrid({ columns, data, getRowId });

    grid.setFilter('status', { type: 'multiSelect', value: ['Active'] });

    expect(grid.totalCount()).toBe(3);
    expect(grid.hasActiveFilters()).toBe(true);
    expect(grid.rows().every((r) => r.status === 'Active')).toBe(true);
  });

  it('filter changes return to page 1', () => {
    const grid = createHeadlessGrid({ columns, data, getRowId, initialPageSize: 2 });

    grid.setPage(3);
    expect(grid.page()).toBe(3);

    grid.setFilter('status', { type: 'multiSelect', value: ['Active'] });
    expect(grid.page()).toBe(1);
  });

  it('getCellValue resolves column values', () => {
    const grid = createHeadlessGrid({ columns, data, getRowId });

    expect(grid.getCellValue(data[0], 'name')).toBe('Alice');
    expect(grid.getCellValue(data[0], 'score')).toBe(90);
    expect(grid.getCellValue(data[0], 'unknown')).toBeUndefined();
  });

  it('toggleRowSelection toggles a row in/out', () => {
    const grid = createHeadlessGrid({ columns, data, getRowId });

    expect(grid.isRowSelected(data[0])).toBe(false);
    grid.toggleRowSelection(data[0]);
    expect(grid.isRowSelected(data[0])).toBe(true);
    expect(grid.selectedRowIds().size).toBe(1);
    grid.toggleRowSelection(data[0]);
    expect(grid.isRowSelected(data[0])).toBe(false);
  });

  it('selectAllOnPage selects only visible rows', () => {
    const grid = createHeadlessGrid({ columns, data, getRowId, initialPageSize: 2 });

    grid.selectAllOnPage();
    expect(grid.selectedRowIds().size).toBe(2);
    expect(grid.isRowSelected(data[0])).toBe(true);
    expect(grid.isRowSelected(data[2])).toBe(false);
  });

  it('clearSelection empties the set', () => {
    const grid = createHeadlessGrid({ columns, data, getRowId });

    grid.toggleRowSelection(data[0]);
    grid.toggleRowSelection(data[1]);
    expect(grid.selectedRowIds().size).toBe(2);

    grid.clearSelection();
    expect(grid.selectedRowIds().size).toBe(0);
  });

  it('reactively updates when input data signal changes', () => {
    const dataSig = signal<Row[]>(data.slice(0, 3));
    const grid = createHeadlessGrid({ columns, data: dataSig, getRowId });

    expect(grid.totalCount()).toBe(3);

    dataSig.set(data);
    expect(grid.totalCount()).toBe(6);
  });
});
