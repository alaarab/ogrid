import * as React from 'react';
import { renderHook, act } from '@testing-library/react';
import { useOGrid } from '../useOGrid';
import type { IColumnVisibilityState, IOGridApi } from '../../types';

type Row = { id: string };

const v1 = [
  { columnId: 'name', name: 'Name', required: true },
  { columnId: 'status', name: 'Status' },
  { columnId: 'views', name: 'Views', responsivePriority: 2 },
  { columnId: 'notes', name: 'Notes', defaultVisible: false },
];
const v2 = [...v1, { columnId: 'signOff', name: 'Sign-off' }, { columnId: 'archive', name: 'Archive', defaultVisible: false }];
const responsiveColumns = { breakpoints: [{ minWidth: 0, maxPriority: 1 }, { minWidth: 1200, maxPriority: Infinity }] };

function renderGrid(overrides: Record<string, unknown>) {
  const apiRef = React.createRef<IOGridApi<Row>>();
  let props = { columns: v1, getRowId: (r: Row) => r.id, data: [{ id: '1' }], ...overrides } as Parameters<typeof useOGrid<Row>>[0];
  const hook = renderHook(() => useOGrid(props, apiRef));
  const rerender = (next: Record<string, unknown>) => {
    props = { ...props, ...next } as typeof props;
    hook.rerender();
  };
  return { ...hook, apiRef, rerender };
}

const shown = (set: Set<string>) => [...set].sort();

describe('useOGrid column visibility model', () => {
  it('reports user changes as a diff from the column defaults', () => {
    const onColumnVisibilityChange = jest.fn();
    const onVisibleColumnsChange = jest.fn();
    const { result } = renderGrid({ onColumnVisibilityChange, onVisibleColumnsChange });
    expect(shown(result.current.columnChooser.visibleColumns)).toEqual(['name', 'status', 'views']);

    act(() => result.current.columnChooser.onVisibilityChange('status', false));
    act(() => result.current.columnChooser.onVisibilityChange('notes', true));

    expect(onColumnVisibilityChange).toHaveBeenLastCalledWith({ hidden: ['status'], shown: ['notes'] });
    expect(shown(onVisibleColumnsChange.mock.lastCall[0])).toEqual(['name', 'notes', 'views']);
    expect(shown(result.current.columnChooser.visibleColumns)).toEqual(['name', 'notes', 'views']);
  });

  it('shows columns added since the choices were saved, and keeps the saved choices', () => {
    const saved: IColumnVisibilityState = { hidden: ['status'], shown: ['notes'] };
    const { result } = renderGrid({ columns: v2, defaultColumnVisibility: saved });
    expect(shown(result.current.columnChooser.visibleColumns)).toEqual(['name', 'notes', 'signOff', 'views']);
  });

  it('applies saved choices to columns that load after the first render', () => {
    const { result, rerender } = renderGrid({ columns: [], defaultColumnVisibility: { hidden: ['views'], shown: [] } });
    rerender({ columns: v2 });
    expect(shown(result.current.columnChooser.visibleColumns)).toEqual(['name', 'signOff', 'status']);
  });

  it('only changes what is shown when the controlled state changes', () => {
    const onColumnVisibilityChange = jest.fn();
    const { result, rerender } = renderGrid({ columnVisibility: { hidden: [], shown: [] }, onColumnVisibilityChange });
    act(() => result.current.columnChooser.onVisibilityChange('status', false));
    expect(onColumnVisibilityChange).toHaveBeenCalledWith({ hidden: ['status'], shown: [] });
    expect(result.current.columnChooser.visibleColumns.has('status')).toBe(true);
    rerender({ columnVisibility: onColumnVisibilityChange.mock.lastCall[0] });
    expect(result.current.columnChooser.visibleColumns.has('status')).toBe(false);
  });

  it('hides lower-priority columns to fit, and keeps a column the user shows on screen', () => {
    const onColumnVisibilityChange = jest.fn();
    const { result, apiRef } = renderGrid({ defaultColumnVisibility: { hidden: [], shown: [] }, responsiveColumns, onColumnVisibilityChange });
    const report = result.current.dataGridProps.onFitHiddenColumnsChange;
    expect(report).toBeDefined();

    act(() => report?.(new Set(['views'])));
    expect(shown(result.current.columnChooser.visibleColumns)).toEqual(['name', 'status']);
    expect(shown(result.current.dataGridProps.visibleColumns)).toEqual(['name', 'status']);
    expect(apiRef.current?.getColumnState().visibleColumns.sort()).toEqual(['name', 'status', 'views']);

    act(() => result.current.columnChooser.onVisibilityChange('views', true));
    expect(onColumnVisibilityChange).toHaveBeenLastCalledWith({ hidden: [], shown: ['views'] });
    expect(shown(result.current.columnChooser.visibleColumns)).toEqual(['name', 'status', 'views']);
  });

  it('unhides a column hidden to fit from the header gap marker', () => {
    const { result } = renderGrid({ defaultColumnVisibility: { hidden: [], shown: [] }, responsiveColumns, allowHiding: true });
    act(() => result.current.dataGridProps.onFitHiddenColumnsChange?.(new Set(['views'])));
    act(() => result.current.dataGridProps.hidingActions?.unhideColumns(['views']));
    expect(result.current.dataGridProps.visibleColumns.has('views')).toBe(true);
    act(() => result.current.dataGridProps.hidingActions?.hideColumns(['views']));
    expect(result.current.dataGridProps.visibleColumns.has('views')).toBe(false);
    expect(result.current.dataGridProps.visibleColumns.has('status')).toBe(true);
  });

  it('saves and restores visibility through getColumnState and applyColumnState', () => {
    const onColumnVisibilityChange = jest.fn();
    const { result, apiRef } = renderGrid({ onColumnVisibilityChange });
    act(() => apiRef.current?.applyColumnState({ columnVisibility: { hidden: ['status'], shown: ['notes'] } }));
    expect(apiRef.current?.getColumnState().columnVisibility).toEqual({ hidden: ['status'], shown: ['notes'] });
    expect(shown(result.current.columnChooser.visibleColumns)).toEqual(['name', 'notes', 'views']);

    act(() => apiRef.current?.applyColumnState({ visibleColumns: ['name', 'status'] }));
    expect(onColumnVisibilityChange).toHaveBeenLastCalledWith({ hidden: ['views'], shown: [] });
  });

  it('includes a visibility diff in getColumnState and accepts one without the model props', () => {
    const { result, apiRef } = renderGrid({});
    act(() => result.current.columnChooser.onVisibilityChange('status', false));
    expect(apiRef.current?.getColumnState().columnVisibility).toEqual({ hidden: ['status'], shown: [] });
    act(() => apiRef.current?.applyColumnState({ columnVisibility: { hidden: [], shown: ['notes'] } }));
    expect(shown(result.current.columnChooser.visibleColumns)).toEqual(['name', 'notes', 'status', 'views']);
    expect(result.current.dataGridProps.onFitHiddenColumnsChange).toBeUndefined();
  });
});
