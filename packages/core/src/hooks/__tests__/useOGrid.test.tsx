import * as React from 'react';
import { renderHook, act, render } from '@testing-library/react';
import { useOGrid } from '../useOGrid';
import type { IOGridProps, IOGridApi } from '../../types';

type Row = { id: string; name: string };
const columns = [
  { columnId: 'id', name: 'ID' },
  { columnId: 'name', name: 'Name' },
];
const getRowId = (r: Row) => r.id;
const data: Row[] = [
  { id: '1', name: 'Alice' },
  { id: '2', name: 'Bob' },
  { id: '3', name: 'Carol' },
];

describe('useOGrid', () => {
  it('returns dataGridProps with items and displayTotalCount (client-side)', () => {
    const ref = React.createRef<IOGridApi<Row>>();
    const { result } = renderHook(
      () => useOGrid<Row>({ columns, getRowId, data, defaultPageSize: 10 }, ref),
      { wrapper: ({ children }) => <>{children}</> }
    );
    expect(result.current.dataGridProps.items).toEqual(data);
    expect(result.current.dataGridProps.items).toHaveLength(3);
    expect(result.current.displayTotalCount).toBe(3);
    expect(result.current.page).toBe(1);
    expect(result.current.pageSize).toBe(10);
  });

  it('paginates items when pageSize is smaller than data length', () => {
    const ref = React.createRef<IOGridApi<Row>>();
    const { result } = renderHook(
      () => useOGrid<Row>({ columns, getRowId, data, defaultPageSize: 2 }, ref),
      { wrapper: ({ children }) => <>{children}</> }
    );
    expect(result.current.dataGridProps.items).toHaveLength(2);
    expect(result.current.dataGridProps.items.map((r) => r.name)).toEqual(['Alice', 'Bob']);
    expect(result.current.displayTotalCount).toBe(3);
  });

  it('setPage changes page and dataGridProps.items slice', () => {
    const ref = React.createRef<IOGridApi<Row>>();
    const { result } = renderHook(
      () => useOGrid<Row>({ columns, getRowId, data, defaultPageSize: 2 }, ref),
      { wrapper: ({ children }) => <>{children}</> }
    );
    act(() => {
      result.current.setPage(2);
    });
    expect(result.current.page).toBe(2);
    expect(result.current.dataGridProps.items.map((r) => r.name)).toEqual(['Carol']);
  });

  it('handleVisibilityChange hides/shows columns', () => {
    const ref = React.createRef<IOGridApi<Row>>();
    const { result } = renderHook(
      () => useOGrid<Row>({ columns, getRowId, data, defaultPageSize: 10 }, ref),
      { wrapper: ({ children }) => <>{children}</> }
    );
    expect(result.current.visibleColumns.has('name')).toBe(true);
    act(() => {
      result.current.handleVisibilityChange('name', false);
    });
    expect(result.current.visibleColumns.has('name')).toBe(false);
    act(() => {
      result.current.handleVisibilityChange('name', true);
    });
    expect(result.current.visibleColumns.has('name')).toBe(true);
  });

  it('getColumnState returns visibleColumns array and sort (via ref)', () => {
    const ref = React.createRef<IOGridApi<Row>>();
    const Wrapper = () => {
      useOGrid<Row>(
        {
          columns,
          getRowId,
          data,
          defaultPageSize: 10,
          defaultSortBy: 'name',
          defaultSortDirection: 'desc',
        },
        ref
      );
      return null;
    };
    render(<Wrapper />);
    expect(ref.current).not.toBeNull();
    const state = ref.current!.getColumnState();
    expect(Array.isArray(state.visibleColumns)).toBe(true);
    expect(state.sort).toEqual({ field: 'name', direction: 'desc' });
  });

  it('setRowData updates internal data (client-side)', () => {
    const ref = React.createRef<IOGridApi<Row>>();
    const Wrapper = () => {
      useOGrid<Row>({ columns, getRowId, data: undefined, defaultPageSize: 10 }, ref);
      return null;
    };
    render(<Wrapper />);
    expect(ref.current).not.toBeNull();
    const newData: Row[] = [{ id: 'x', name: 'X' }];
    act(() => {
      ref.current!.setRowData(newData);
    });
    const state = ref.current!.getColumnState();
    expect(state.visibleColumns).toBeDefined();
  });

  it('columnChooserColumns has one entry per column', () => {
    const ref = React.createRef<IOGridApi<Row>>();
    const { result } = renderHook(
      () => useOGrid<Row>({ columns, getRowId, data }, ref),
      { wrapper: ({ children }) => <>{children}</> }
    );
    expect(result.current.columnChooserColumns).toHaveLength(2);
    expect(result.current.columnChooserColumns.map((c) => c.columnId)).toEqual(['id', 'name']);
  });
});
