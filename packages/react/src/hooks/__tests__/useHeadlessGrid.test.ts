import { renderHook, act } from '@testing-library/react';
import { useHeadlessGrid } from '../useHeadlessGrid';
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
  { columnId: 'status', name: 'Status', type: 'text', filterable: { type: 'multiSelect' } },
];

const getRowId = (r: Row) => r.id;

describe('useHeadlessGrid', () => {
  it('returns rows, columns, and totals on initial render', () => {
    const { result } = renderHook(() =>
      useHeadlessGrid({ columns, data, getRowId }),
    );

    expect(result.current.rows).toHaveLength(6);
    expect(result.current.totalCount).toBe(6);
    expect(result.current.columns).toHaveLength(3);
    expect(result.current.totalPages).toBe(1);
  });

  it('paginates correctly with initialPageSize', () => {
    const { result } = renderHook(() =>
      useHeadlessGrid({ columns, data, getRowId, initialPageSize: 2 }),
    );

    expect(result.current.rows).toHaveLength(2);
    expect(result.current.totalCount).toBe(6);
    expect(result.current.totalPages).toBe(3);
    expect(result.current.rows[0].id).toBe('1');
  });

  it('moves to next page', () => {
    const { result } = renderHook(() =>
      useHeadlessGrid({ columns, data, getRowId, initialPageSize: 2 }),
    );

    act(() => result.current.setPage(2));
    expect(result.current.rows[0].id).toBe('3');
    expect(result.current.rows[1].id).toBe('4');
  });

  it('sorts by column ascending', () => {
    const { result } = renderHook(() =>
      useHeadlessGrid({
        columns,
        data,
        getRowId,
        initialSort: { field: 'score', direction: 'asc' },
      }),
    );

    expect(result.current.rows[0].name).toBe('Diana'); // score 60
    expect(result.current.rows[5].name).toBe('Eve'); // score 95
  });

  it('toggles sort direction via toggleSort', () => {
    const { result } = renderHook(() =>
      useHeadlessGrid({ columns, data, getRowId }),
    );

    act(() => result.current.toggleSort('score'));
    expect(result.current.sort.field).toBe('score');
    // initial sort direction depends on computeNextSortState; first toggle = asc by default

    act(() => result.current.toggleSort('score'));
    expect(result.current.sort.direction).toBe('desc');
  });

  it('exposes a header sort indicator', () => {
    const { result } = renderHook(() =>
      useHeadlessGrid({
        columns,
        data,
        getRowId,
        initialSort: { field: 'name', direction: 'asc' },
      }),
    );

    expect(result.current.sortIndicator('name')).toBe('▲');
    expect(result.current.sortIndicator('score')).toBe('');
  });

  it('filters rows via setFilter', () => {
    const { result } = renderHook(() =>
      useHeadlessGrid({ columns, data, getRowId }),
    );

    act(() =>
      result.current.setFilter('status', { type: 'multiSelect', value: ['Active'] }),
    );

    expect(result.current.totalCount).toBe(3);
    expect(result.current.hasActiveFilters).toBe(true);
    expect(result.current.rows.every((r) => r.status === 'Active')).toBe(true);
  });

  it('returns to page 1 when filters change', () => {
    const { result } = renderHook(() =>
      useHeadlessGrid({ columns, data, getRowId, initialPageSize: 2 }),
    );

    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);

    act(() =>
      result.current.setFilter('status', { type: 'multiSelect', value: ['Active'] }),
    );
    expect(result.current.page).toBe(1);
  });

  it('resolves cell values via getCellValue', () => {
    const { result } = renderHook(() =>
      useHeadlessGrid({ columns, data, getRowId }),
    );

    expect(result.current.getCellValue(data[0], 'name')).toBe('Alice');
    expect(result.current.getCellValue(data[0], 'score')).toBe(90);
    expect(result.current.getCellValue(data[0], 'unknown')).toBeUndefined();
  });

  it('toggles row selection', () => {
    const { result } = renderHook(() =>
      useHeadlessGrid({ columns, data, getRowId }),
    );

    expect(result.current.isRowSelected(data[0])).toBe(false);
    act(() => result.current.toggleRowSelection(data[0]));
    expect(result.current.isRowSelected(data[0])).toBe(true);
    expect(result.current.selectedRowIds.size).toBe(1);
    act(() => result.current.toggleRowSelection(data[0]));
    expect(result.current.isRowSelected(data[0])).toBe(false);
  });

  it('selectAllOnPage selects only visible rows', () => {
    const { result } = renderHook(() =>
      useHeadlessGrid({ columns, data, getRowId, initialPageSize: 2 }),
    );

    act(() => result.current.selectAllOnPage());
    expect(result.current.selectedRowIds.size).toBe(2);
    expect(result.current.isRowSelected(data[0])).toBe(true);
    expect(result.current.isRowSelected(data[2])).toBe(false);
  });

  it('clearSelection empties the set', () => {
    const { result } = renderHook(() =>
      useHeadlessGrid({ columns, data, getRowId }),
    );

    act(() => result.current.toggleRowSelection(data[0]));
    act(() => result.current.toggleRowSelection(data[1]));
    expect(result.current.selectedRowIds.size).toBe(2);

    act(() => result.current.clearSelection());
    expect(result.current.selectedRowIds.size).toBe(0);
  });

  it('supports a dataSource for server-side mode', async () => {
    const fetchPage = jest.fn().mockResolvedValue({
      items: data.slice(0, 2),
      totalCount: 6,
    });

    const dataSource = { fetchPage };

    const { result } = renderHook(() =>
      useHeadlessGrid({
        columns,
        data: [], // server-side: client data is empty, server is the source of truth
        getRowId,
        dataSource,
        initialPageSize: 2,
      }),
    );

    // Wait for the server fetch to settle.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(fetchPage).toHaveBeenCalled();
    expect(result.current.totalCount).toBe(6);
    expect(result.current.rows).toHaveLength(2);
  });

  it('controlled sort change re-sorts rows (regression — controlled prop without setSort)', () => {
    type SortS = { field: string; direction: 'asc' | 'desc' };
    const { result, rerender } = renderHook(
      ({ sort }: { sort: SortS }) =>
        useHeadlessGrid({ columns, data, getRowId, sort }),
      { initialProps: { sort: { field: 'name', direction: 'asc' } as SortS } },
    );

    expect(result.current.rows[0].name).toBe('Alice');

    rerender({ sort: { field: 'score', direction: 'desc' } });
    expect(result.current.rows[0].name).toBe('Eve'); // score 95
  });

  it('supports controlled sort', () => {
    const onSortChange = jest.fn();
    type SortS = { field: string; direction: 'asc' | 'desc' };
    const { result, rerender } = renderHook(
      ({ sort }: { sort: SortS }) =>
        useHeadlessGrid({
          columns,
          data,
          getRowId,
          sort,
          onSortChange,
        }),
      { initialProps: { sort: { field: 'name', direction: 'asc' } as SortS } },
    );

    expect(result.current.sort.field).toBe('name');
    expect(result.current.rows[0].name).toBe('Alice');

    act(() =>
      result.current.setSort({ field: 'score', direction: 'desc' }),
    );
    expect(onSortChange).toHaveBeenCalledWith({ field: 'score', direction: 'desc' });

    rerender({ sort: { field: 'score', direction: 'desc' } });
    expect(result.current.rows[0].name).toBe('Eve'); // score 95
  });
});
