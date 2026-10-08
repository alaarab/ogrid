import * as React from 'react';
import { act, renderHook } from '@testing-library/react';
import { useFindReplace } from '../useFindReplace';
import { useOGrid } from '../useOGrid';
import { useDataGridTableOrchestration } from '../useDataGridTableOrchestration';
import type { IColumnDef, IOGridApi, ICellValueChangedEvent } from '../../types';

type Row = { id: string; name: string; qty: number };
const rows: Row[] = [
  { id: 'a', name: 'Red apple', qty: 1 },
  { id: 'b', name: 'Pear', qty: 2 },
  { id: 'c', name: 'Green apple', qty: 3 },
];
const columns: IColumnDef<Row>[] = [
  { columnId: 'name', name: 'Name', editable: true },
  { columnId: 'qty', name: 'Qty', type: 'numeric' },
];
const getRowId = (r: Row) => r.id;

describe('useFindReplace (headless)', () => {
  it('finds from the active cell, walks with wrapping and reports status', () => {
    const onNavigate = jest.fn();
    const { result } = renderHook(() =>
      useFindReplace({ rows, columns, getRowId, onNavigate, activeCell: { rowIndex: 1, columnIndex: 0 } })
    );
    act(() => result.current.open('find'));
    act(() => result.current.setQuery('apple'));
    // Starts at the first match at/after the active cell (row 1): Green apple.
    expect(result.current.statusText).toBe('2 of 2');
    expect(onNavigate).toHaveBeenLastCalledWith({ rowId: 'c', columnId: 'name', rowIndex: 2, columnIndex: 0 });
    act(() => result.current.next());
    expect(result.current.activeMatch?.rowId).toBe('a');
    act(() => result.current.prev());
    expect(result.current.activeMatch?.rowId).toBe('c');
    expect(result.current.isMatch('a', 'name')).toBe(true);
    expect(result.current.isMatch('b', 'name')).toBe(false);
  });

  it('is find-only without onCellEdit or when not editable', () => {
    const { result } = renderHook(() => useFindReplace({ rows, columns, getRowId }));
    act(() => result.current.open('replace'));
    expect(result.current.mode).toBe('find');
    expect(result.current.canReplace).toBe(false);
    const { result: ro } = renderHook(() => useFindReplace({ rows, columns, getRowId, onCellEdit: jest.fn(), editable: false }));
    expect(ro.current.canReplace).toBe(false);
  });

  it('replace all hands every change to onCellEdit in one call and counts read-only skips', () => {
    const onCellEdit = jest.fn();
    const { result } = renderHook(() => useFindReplace({ rows, columns, getRowId, onCellEdit }));
    act(() => result.current.open('replace'));
    act(() => {
      result.current.setQuery('2');
      result.current.setReplacement('9');
    });
    let res: ReturnType<typeof result.current.replaceAll> | undefined;
    act(() => { res = result.current.replaceAll(); });
    // "2" only appears in the read-only qty column.
    expect(res).toMatchObject({ replaced: 0, skipped: 1, skippedReadOnly: 1 });
    expect(onCellEdit).not.toHaveBeenCalled();
    expect(result.current.statusText).toBe('Replaced 0 cells, 1 skipped');

    act(() => result.current.setQuery('apple'));
    act(() => { res = result.current.replaceAll(); });
    expect(res?.replaced).toBe(2);
    expect(onCellEdit).toHaveBeenCalledTimes(1);
    const events = onCellEdit.mock.calls[0]?.[0] as ICellValueChangedEvent<Row>[];
    expect(events.map((e) => e.newValue)).toEqual(['Red 9', 'Green 9']);
  });
});

describe('OGrid find integration with virtual scrolling', () => {
  const OriginalResizeObserver = globalThis.ResizeObserver;
  beforeEach(() => {
    (globalThis as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });
  afterEach(() => {
    (globalThis as { ResizeObserver: unknown }).ResizeObserver = OriginalResizeObserver;
  });

  it('makes a far-away match on a virtual grid the active cell (which scrolls it into view)', () => {
    const many: Row[] = Array.from({ length: 5000 }, (_, i) => ({ id: `r${i}`, name: i === 4200 ? 'Needle' : `row ${i}`, qty: i }));
    const apiRef = React.createRef<IOGridApi<Row>>();
    const { result, rerender } = renderHook(() => {
      const grid = useOGrid({
        // Unsorted, so the match keeps its data position.
        columns: columns.map((c) => ({ ...c, sortable: false })), getRowId, data: many, findReplace: true,
        virtualScroll: { enabled: true, rowHeight: 30, paginate: false },
      }, apiRef);
      return useDataGridTableOrchestration({ props: grid.dataGridProps });
    });
    const container = document.createElement('div');
    container.innerHTML = '<table><thead></thead></table>';
    Object.defineProperty(container, 'clientHeight', { value: 600 });
    container.querySelector('thead')!.getBoundingClientRect = () => ({ height: 30 }) as DOMRect;
    container.scrollTo = jest.fn((options: ScrollToOptions) => { container.scrollTop = options.top ?? 0; });
    result.current.wrapperRef.current = container;
    rerender();
    act(() => result.current.findReplace.find.open('find'));
    act(() => result.current.findReplace.find.setQuery('needle'));
    expect(result.current.findReplace.find.statusText).toBe('1 of 1');
    expect(result.current.interaction.activeCell).toEqual({ rowIndex: 4200, columnIndex: 0 });
  });
});
