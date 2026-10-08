/**
 * Shared drag-and-drop tests: row reorder (handle + keyboard), range move
 * (with undo) and external cell drops. Each UI package calls
 * createDragDropTests(OGrid) to run these.
 */
import * as React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import type { UseCellDragSourceParams, CellDragSourceProps } from '../hooks/useCellDragSource';
import type { ICellValueChangedEvent, IColumnDef, IOGridProps, IOGridDataGridProps, IRowOrderChange } from '../types';

interface Row {
  id: number;
  a: string;
  b: string;
}

const rows: Row[] = [
  { id: 1, a: 'a1', b: 'b1' },
  { id: 2, a: 'a2', b: 'b2' },
  { id: 3, a: 'a3', b: 'b3' },
  { id: 4, a: 'a4', b: 'b4' },
];

const columns: IColumnDef<Row>[] = [
  { columnId: 'a', name: 'A', editable: true, cellEditor: 'text' },
  { columnId: 'b', name: 'B', editable: true, cellEditor: 'text' },
];

/** A fake `DataTransfer` good enough for the grid's drop handlers. */
function makeDataTransfer(initial: Record<string, string> = {}) {
  const store: Record<string, string> = { ...initial };
  return {
    data: store,
    effectAllowed: 'none',
    dropEffect: 'none',
    setData: (type: string, value: string) => {
      store[type] = value;
    },
    getData: (type: string) => store[type] ?? '',
    files: [] as File[],
  };
}

function bodyCell(container: HTMLElement, row: number, col: number): HTMLElement {
  const tr = container.querySelectorAll('tbody tr[data-row-id]')[row];
  const td = tr?.querySelector(`td[data-column-id="${columns[col]?.columnId}"]`);
  const el = td?.querySelector<HTMLElement>('[data-row-index][data-col-index]');
  if (!el) throw new Error(`no cell at ${row},${col}`);
  return el;
}

function rowOrder(container: HTMLElement): (string | null)[] {
  return Array.from(container.querySelectorAll('tbody tr[data-row-id]')).map((tr) =>
    tr.getAttribute('data-row-id'),
  );
}

export function createDragDropTests(OGrid: React.ComponentType<IOGridProps<Row>>, DataGridTable: React.ComponentType<IOGridDataGridProps<Row>>): void {
  interface HarnessProps {
    overrides?: Partial<IOGridProps<Row>>;
    onOrder?: (event: IRowOrderChange<Row>) => void;
    onEdit?: (event: ICellValueChangedEvent<Row>) => void;
    /** When false, the host does not hold the order (grid applies it itself). */
    emitOrder?: boolean;
    refreshData?: Row[];
  }

  function Harness({ overrides, onOrder, onEdit, emitOrder = true, refreshData }: HarnessProps) {
    const { data: initialData, ...rest } = overrides ?? {};
    const [data, setData] = React.useState<Row[]>(initialData ?? rows);
    React.useEffect(() => { if (refreshData) setData(refreshData); }, [refreshData]);
    const gridProps = {
      data: overrides?.dataSource ? undefined : data,
      columns,
      getRowId: (r: Row) => r.id,
      editable: true,
      ...rest,
      onRowOrderChange: emitOrder
        ? (event: IRowOrderChange<Row>) => {
            onOrder?.(event);
            setData(event.data as Row[]);
          }
        : undefined,
      onCellValueChanged: (event: ICellValueChangedEvent<Row>) => {
        onEdit?.(event);
        setData((prev) =>
          prev.map((r) => (r.id === (event.item as Row).id ? { ...r, [event.columnId]: event.newValue } : r)),
        );
      },
    } as IOGridProps<Row>;
    return <OGrid {...gridProps} />;
  }

  async function renderGrid(
    overrides: Partial<IOGridProps<Row>> = {},
    opts: { emitOrder?: boolean } = {},
  ) {
    const onOrder = jest.fn();
    const onEdit = jest.fn();
    const utils = render(
      <Harness
        overrides={{ defaultSortBy: '', ...overrides }}
        onOrder={onOrder}
        onEdit={onEdit}
        emitOrder={opts.emitOrder}
      />,
    );
    const grid = await waitFor(() => {
      const el = utils.container.querySelector('[role="region"]');
      expect(el).toBeInTheDocument();
      return el as HTMLElement;
    });
    return { ...utils, grid, onOrder, onEdit, refresh: (refreshData: Row[]) => utils.rerender(
      <Harness overrides={{ defaultSortBy: '', ...overrides }} onOrder={onOrder} onEdit={onEdit}
        emitOrder={opts.emitOrder} refreshData={refreshData} />,
    ) };
  }

  async function dragRow(container: HTMLElement, from: number, to: number, gutter = false) {
    const handle = await waitFor(() => {
      const el = container.querySelectorAll<HTMLElement>('[data-ogrid-row-drag-handle]')[from];
      expect(el).toBeInTheDocument();
      return el as HTMLElement;
    });
    const dt = makeDataTransfer();
    fireEvent.dragStart(handle, { dataTransfer: dt });
    const target = gutter
      ? container.querySelectorAll<HTMLElement>('[data-row-header-index]')[to]
      : bodyCell(container, to, 0);
    const accepted = fireEvent.dragOver(target as HTMLElement, { dataTransfer: dt, clientY: 5 });
    expect(accepted).toBe(false);
    fireEvent.drop(target as HTMLElement, { dataTransfer: dt, clientY: 5 });
  }

  it('mounts global drag cleanup only while a drag feature is enabled', async () => {
    const listeners = new Set<EventListenerOrEventListenerObject>();
    const add = window.addEventListener.bind(window);
    const remove = window.removeEventListener.bind(window);
    const addSpy = jest.spyOn(window, 'addEventListener').mockImplementation((type, listener, options) => {
      if (type === 'dragend') listeners.add(listener);
      add(type, listener, options);
    });
    const removeSpy = jest.spyOn(window, 'removeEventListener').mockImplementation((type, listener, options) => {
      if (type === 'dragend') listeners.delete(listener);
      remove(type, listener, options);
    });
    try {
      const props = { data: rows, columns, getRowId: (r: Row) => r.id, defaultSortBy: '' };
      const { rerender, unmount } = render(<OGrid {...props} />);
      expect(listeners.size).toBe(0);
      rerender(<OGrid {...props} rowDragging />);
      await waitFor(() => expect(listeners.size).toBe(1));
      rerender(<OGrid {...props} />);
      expect(listeners.size).toBe(0);
      unmount();
    } finally { addSpy.mockRestore(); removeSpy.mockRestore(); }
  });

  describe('row dragging', () => {
    it('renders a drag handle once rowDragging is on', async () => {
      const { container } = await renderGrid({ rowDragging: true });
      expect(container.querySelectorAll('[data-ogrid-row-drag-handle]').length).toBe(rows.length);
    });

    it('reorders rows when the handle is dragged onto another row', async () => {
      const { container, onOrder } = await renderGrid({ rowDragging: true });
      const handle = container.querySelector<HTMLElement>('[data-ogrid-row-drag-handle]') as HTMLElement;
      const dt = makeDataTransfer();
      fireEvent.dragStart(handle, { dataTransfer: dt });
      const target = bodyCell(container, 1, 0);
      // A pointer below the row's midpoint drops after it.
      fireEvent.dragOver(target, { dataTransfer: dt, clientY: 5 });
      fireEvent.drop(target, { dataTransfer: dt, clientY: 5 });
      await waitFor(() => expect(onOrder).toHaveBeenCalledTimes(1));
      const event = onOrder.mock.calls[0][0] as IRowOrderChange<Row>;
      expect(event.rowIds).toEqual([2, 1, 3, 4]);
      expect(event.fromIndex).toBe(0);
      expect(event.toIndex).toBe(1);
    });

    it('reorders the rows itself when uncontrolled', async () => {
      const { container } = await renderGrid({ rowDragging: true }, { emitOrder: false });
      const handle = container.querySelector<HTMLElement>('[data-ogrid-row-drag-handle]') as HTMLElement;
      const dt = makeDataTransfer();
      fireEvent.dragStart(handle, { dataTransfer: dt });
      const target = bodyCell(container, 3, 0);
      fireEvent.dragOver(target, { dataTransfer: dt, clientY: 5 });
      fireEvent.drop(target, { dataTransfer: dt, clientY: 5 });
      await waitFor(() => expect(rowOrder(container)).toEqual(['2', '3', '4', '1']));
    });

    it('moves the active row from the keyboard with Ctrl+Shift+ArrowDown', async () => {
      const { container, grid, onOrder } = await renderGrid({ rowDragging: true });
      fireEvent.pointerDown(bodyCell(container, 0, 0));
      grid.focus();
      fireEvent.keyDown(grid, { key: 'ArrowDown', ctrlKey: true, shiftKey: true });
      await waitFor(() => expect(onOrder).toHaveBeenCalledTimes(1));
      const event = onOrder.mock.calls[0][0] as IRowOrderChange<Row>;
      expect(event.rowIds).toEqual([2, 1, 3, 4]);
    });

    it('preserves every client row when the callback replaces a paginated dataset', async () => {
      const data = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, a: `a${i + 1}`, b: `b${i + 1}` }));
      const { container, onOrder } = await renderGrid({ data, rowDragging: true, page: 2 });
      await dragRow(container, 0, 1);
      await waitFor(() => expect(onOrder).toHaveBeenCalledTimes(1));
      expect(onOrder.mock.calls[0][0].data.map((r: Row) => r.id)).toEqual([
        ...Array.from({ length: 25 }, (_, i) => i + 1), 27, 26, 28, 29, 30,
      ]);
      expect(rowOrder(container)).toEqual(['27', '26', '28', '29', '30']);
    });

    it('disables managed row reordering on a windowed source', async () => {
      const onOrder = jest.fn();
      const { container } = render(<DataGridTable items={[]} columns={columns} getRowId={(r) => r.id}
        visibleColumns={new Set(['a', 'b'])} sortDirection="asc" onColumnSort={() => {}}
        filters={{}} onFilterChange={() => {}} filterOptions={{}} loadingFilterOptions={{}}
        showRowNumbers rowDragging onRowOrderChange={onOrder} frozenRows={rows.length}
        windowed={{ rowCount: rows.length, loadedRows: rows,
          getRow: (i) => ({ status: 'loaded', row: rows[i]! }), requestWindow: () => {}, retryRow: () => {} }} />);
      await waitFor(() => expect(bodyCell(container, 0, 0).textContent).toBe('a1'));
      expect(container.querySelector('[data-ogrid-row-drag-handle]')).toBeNull();
      const grid = container.querySelector('[role="region"]') as HTMLElement;
      fireEvent.pointerDown(bodyCell(container, 0, 0));
      fireEvent.keyDown(grid, { key: 'ArrowDown', ctrlKey: true, shiftKey: true });
      expect(onOrder).not.toHaveBeenCalled();
    });

    it('targets the displayed record for drops, clipboard and keyboard edits after uncontrolled reorder', async () => {
      const { container, grid, onEdit } = await renderGrid({ rowDragging: true, cellDrop: true }, { emitOrder: false });
      await dragRow(container, 0, 1);
      await waitFor(() => expect(rowOrder(container)).toEqual(['2', '1', '3', '4']));
      fireEvent.pointerDown(bodyCell(container, 0, 0));
      const dt = makeDataTransfer();
      fireEvent.copy(grid, { clipboardData: dt });
      expect(dt.getData('text/plain')).toBe('a2');
      fireEvent.keyDown(grid, { key: 'Delete' });
      expect(onEdit.mock.calls[0][0].item.id).toBe(2);
      fireEvent.drop(bodyCell(container, 0, 1), { dataTransfer: makeDataTransfer({ 'text/plain': 'changed' }) });
      expect(onEdit.mock.calls[onEdit.mock.calls.length - 1][0].item.id).toBe(2);
    });

    it('keeps formula results with controlled records across host updates and undo/redo', async () => {
      const { container, grid, refresh } = await renderGrid({ rowDragging: true, formulas: true,
        initialFormulas: [{ col: 0, row: 0, formula: '=1+2' }, { col: 0, row: 1, formula: '=4+4' }] });
      await dragRow(container, 0, 1);
      await waitFor(() => expect(rowOrder(container)).toEqual(['2', '1', '3', '4']));
      expect(bodyCell(container, 0, 0).textContent).toBe('8');
      expect(bodyCell(container, 1, 0).textContent).toBe('3');
      refresh([{ ...rows[1]!, b: 'updated' }, rows[0]!, rows[2]!, rows[3]!]);
      await waitFor(() => expect(bodyCell(container, 0, 1).textContent).toBe('updated'));
      expect(bodyCell(container, 0, 0).textContent).toBe('8');
      fireEvent.keyDown(grid, { key: 'z', ctrlKey: true });
      await waitFor(() => expect(rowOrder(container)).toEqual(['1', '2', '3', '4']));
      expect(bodyCell(container, 0, 0).textContent).toBe('3');
      expect(bodyCell(container, 1, 0).textContent).toBe('8');
      fireEvent.keyDown(grid, { key: 'y', ctrlKey: true });
      await waitFor(() => expect(rowOrder(container)).toEqual(['2', '1', '3', '4']));
      expect(bodyCell(container, 0, 0).textContent).toBe('8');
      expect(bodyCell(container, 1, 0).textContent).toBe('3');
    });

    it('keeps formula coordinates on their records after uncontrolled reorder', async () => {
      const { container } = await renderGrid({ rowDragging: true, formulas: true,
        initialFormulas: [{ col: 0, row: 0, formula: '=1+2' }, { col: 0, row: 1, formula: '=4+4' }] }, { emitOrder: false });
      await dragRow(container, 0, 1);
      await waitFor(() => expect(rowOrder(container)).toEqual(['2', '1', '3', '4']));
      expect(bodyCell(container, 0, 0).textContent).toBe('8');
      expect(bodyCell(container, 1, 0).textContent).toBe('3');
    });

    it('undoes and redoes ID order using current server values', async () => {
      const { container, grid, onOrder, refresh } = await renderGrid({ rowDragging: true });
      await dragRow(container, 0, 1);
      refresh([rows[1]!, { ...rows[0]!, a: 'server' }, rows[2]!, rows[3]!]);
      await waitFor(() => expect(bodyCell(container, 1, 0).textContent).toBe('server'));
      fireEvent.keyDown(grid, { key: 'z', ctrlKey: true });
      await waitFor(() => expect(rowOrder(container)).toEqual(['1', '2', '3', '4']));
      expect(bodyCell(container, 0, 0).textContent).toBe('server');
      expect(onOrder.mock.calls[onOrder.mock.calls.length - 1][0].data[0].a).toBe('server');
      refresh([{ ...rows[0]!, a: 'newer' }, rows[1]!, rows[2]!, rows[3]!]);
      await waitFor(() => expect(bodyCell(container, 0, 0).textContent).toBe('newer'));
      fireEvent.keyDown(grid, { key: 'y', ctrlKey: true });
      await waitFor(() => expect(rowOrder(container)).toEqual(['2', '1', '3', '4']));
      expect(bodyCell(container, 1, 0).textContent).toBe('newer');
    });

    it('keeps uncontrolled ID order across edits and reconciles inserted and removed rows', async () => {
      const { container, refresh } = await renderGrid({ rowDragging: true }, { emitOrder: false });
      await dragRow(container, 0, 1);
      refresh([{ ...rows[0]!, a: 'server' }, rows[1]!, rows[3]!, { id: 5, a: 'a5', b: 'b5' }]);
      await waitFor(() => expect(bodyCell(container, 1, 0).textContent).toBe('server'));
      expect(rowOrder(container)).toEqual(['2', '1', '4', '5']);
    });

    it('moves only disjoint selected rows', async () => {
      const { grid, onOrder } = await renderGrid({ rowDragging: true, rowSelection: 'multiple', selectedRows: new Set([2, 4]) });
      fireEvent.keyDown(grid, { key: 'ArrowUp', ctrlKey: true, shiftKey: true });
      await waitFor(() => expect(onOrder).toHaveBeenCalledTimes(1));
      expect(onOrder.mock.calls[0][0].rowIds).toEqual([2, 4, 1, 3]);
    });

    it('respects consumer interception of reorder shortcuts', async () => {
      const onKeyDown = jest.fn((e: React.KeyboardEvent) => e.preventDefault());
      const onOrder = jest.fn();
      const { container } = render(<DataGridTable items={rows} columns={columns} getRowId={(r) => r.id}
        showRowNumbers visibleColumns={new Set(['a', 'b'])} sortDirection="asc" onColumnSort={() => {}} rowDragging
        filters={{}} onFilterChange={() => {}} filterOptions={{}} loadingFilterOptions={{}}
        onRowOrderChange={onOrder} onKeyDown={onKeyDown} />);
      await waitFor(() => expect(container.querySelector('[data-ogrid-row-drag-handle]')).toBeInTheDocument());
      const grid = container.querySelector('[role="region"]') as HTMLElement;
      fireEvent.pointerDown(bodyCell(container, 0, 0));
      fireEvent.keyDown(grid, { key: 'ArrowDown', ctrlKey: true, shiftKey: true });
      expect(onKeyDown).toHaveBeenCalled();
      expect(onOrder).not.toHaveBeenCalled();
    });

    it('leaves reorder shortcuts inside cell inputs and buttons with their control', async () => {
      const { container, onOrder } = await renderGrid({ rowDragging: true,
        columns: [{ ...columns[0]!, renderCell: () => <><input aria-label="custom input" /><button type="button">Action</button></> }, columns[1]!] });
      await waitFor(() => expect(container.querySelector('[data-ogrid-row-drag-handle]')).toBeInTheDocument());
      fireEvent.pointerDown(bodyCell(container, 0, 1));
      for (const target of container.querySelectorAll('tbody input, tbody button:not([data-ogrid-row-drag-handle])')) {
        fireEvent.keyDown(target, { key: 'ArrowDown', ctrlKey: true, shiftKey: true });
      }
      expect(onOrder).not.toHaveBeenCalled();
    });

    it('accepts row drops onto the row-number gutter', async () => {
      const { container, onOrder } = await renderGrid({ rowDragging: true });
      await dragRow(container, 0, 1, true);
      await waitFor(() => expect(onOrder).toHaveBeenCalledTimes(1));
      expect(onOrder.mock.calls[0][0].rowIds).toEqual([2, 1, 3, 4]);
    });

    it('does not offer row dragging while a sort is active', async () => {
      const { container } = await renderGrid({
        rowDragging: true,
        defaultSortBy: 'a',
        defaultSortDirection: 'desc',
      });
      expect(container.querySelector('[data-ogrid-row-drag-handle]')).toBeNull();
    });
  });

  describe('external cell drop', () => {
    it('calls onCellDrop with the dropped text', async () => {
      const onCellDrop = jest.fn();
      const { container } = await renderGrid({ cellDrop: true, onCellDrop });
      const target = bodyCell(container, 1, 0);
      const dt = makeDataTransfer({ 'text/plain': 'hello' });
      fireEvent.dragOver(target, { dataTransfer: dt });
      fireEvent.drop(target, { dataTransfer: dt });
      await waitFor(() => expect(onCellDrop).toHaveBeenCalledTimes(1));
      const event = onCellDrop.mock.calls[0][0];
      expect(event.text).toBe('hello');
      expect(event.columnId).toBe('a');
      expect(event.rowId).toBe(2);
      expect(event.files).toEqual([]);
    });

    it('writes dropped plain text through the edit path when there is no handler', async () => {
      const { container, onEdit } = await renderGrid({ cellDrop: true });
      const target = bodyCell(container, 1, 0);
      const dt = makeDataTransfer({ 'text/plain': 'typed' });
      fireEvent.dragOver(target, { dataTransfer: dt });
      fireEvent.drop(target, { dataTransfer: dt });
      await waitFor(() => expect(onEdit).toHaveBeenCalled());
      const event = onEdit.mock.calls[0][0] as ICellValueChangedEvent<Row>;
      expect(event).toMatchObject({ columnId: 'a', newValue: 'typed', rowIndex: 1 });
    });
  });

  it('writes explicit cell drops with cell selection disabled', async () => {
    const { container, onEdit } = await renderGrid({ cellDrop: true, cellSelection: false });
    fireEvent.drop(bodyCell(container, 1, 0), { dataTransfer: makeDataTransfer({ 'text/plain': 'changed' }) });
    await waitFor(() => expect(onEdit).toHaveBeenCalledTimes(1));
    expect(bodyCell(container, 1, 0).textContent).toBe('changed');
    expect(onEdit.mock.calls[0][0].item.id).toBe(2);
  });

  it.each(['text', 'formula', 'range'] as const)('does not edit a globally read-only grid via a %s drag', async (kind) => {
    const parse = jest.fn(({ newValue }: { newValue: unknown }) => newValue);
    const { container, onEdit } = await renderGrid({ editable: false, cellDrop: true, rangeMove: true,
      formulas: true, initialFormulas: [{ col: 0, row: 0, formula: '=1+2' }],
      columns: [{ ...columns[0]!, valueParser: parse }, columns[1]!] });
    const target = bodyCell(container, 1, 0);
    if (kind === 'range') {
      fireEvent.pointerDown(bodyCell(container, 0, 0));
      const handle = await waitFor(() => {
        const el = container.querySelector('[data-ogrid-range-move-handle]');
        expect(el).toBeInTheDocument();
        return el as HTMLElement;
      });
      const dt = makeDataTransfer();
      fireEvent.dragStart(handle, { dataTransfer: dt });
      fireEvent.drop(target, { dataTransfer: dt });
    } else {
      fireEvent.drop(target, { dataTransfer: makeDataTransfer({ 'text/plain': kind === 'formula' ? '=7+8' : 'changed' }) });
    }
    expect(bodyCell(container, 0, 0).textContent).toBe('3');
    expect(bodyCell(container, 1, 0).textContent).toBe('a2');
    expect(onEdit).not.toHaveBeenCalled();
    expect(parse).not.toHaveBeenCalled();
  });

  it.each(['move', 'drop'] as const)('undoes and redoes a formula %s in one step', async (kind) => {
    const { container, grid } = await renderGrid({ rangeMove: true, cellDrop: true, formulas: true,
      initialFormulas: [{ col: 0, row: 0, formula: '=1+2' }] });
    const target = bodyCell(container, 2, 0);
    if (kind === 'move') {
      fireEvent.pointerDown(bodyCell(container, 0, 0));
      const handle = await waitFor(() => {
        const el = container.querySelector('[data-ogrid-range-move-handle]');
        expect(el).toBeInTheDocument();
        return el as HTMLElement;
      });
      const dt = makeDataTransfer();
      fireEvent.dragStart(handle, { dataTransfer: dt });
      fireEvent.drop(target, { dataTransfer: dt });
    } else {
      fireEvent.drop(target, { dataTransfer: makeDataTransfer({ 'text/plain': '=1+2\tb1' }) });
    }
    await waitFor(() => expect(bodyCell(container, 2, 0).textContent).toBe('3'));
    fireEvent.keyDown(grid, { key: 'z', ctrlKey: true });
    await waitFor(() => expect(bodyCell(container, 2, 0).textContent).toBe('a3'));
    expect(bodyCell(container, 0, 0).textContent).toBe('3');
    if (kind === 'drop') expect(bodyCell(container, 2, 1).textContent).toBe('b3');
    fireEvent.keyDown(grid, { key: 'y', ctrlKey: true });
    await waitFor(() => expect(bodyCell(container, 2, 0).textContent).toBe('3'));
    if (kind === 'move') expect(bodyCell(container, 0, 0).textContent).toBe('');
    else expect(bodyCell(container, 2, 1).textContent).toBe('b1');
  });


  it.each(['source', 'destination', 'external drop'] as const)('protects a spill child at the %s with frozen panes', async (kind) => {
    const { container, onEdit } = await renderGrid({
      data: rows.map(row => ({ ...row, a: '', b: row.id === 3 ? 'value' : '' })),
      formulas: true, initialFormulas: [{ col: 0, row: 0, formula: '=SEQUENCE(2)' }],
      rangeMove: true, cellDrop: true, frozenRows: 1, frozenColumns: 1,
    });
    await waitFor(() => expect(bodyCell(container, 1, 0).textContent).toBe('2'));
    const child = bodyCell(container, 1, 0);
    const plain = bodyCell(container, 2, 1);
    if (kind === 'external drop') {
      fireEvent.drop(child, { dataTransfer: makeDataTransfer({ 'text/plain': 'overwrite' }) });
    } else {
      fireEvent.pointerDown(kind === 'source' ? child : plain);
      const handle = await waitFor(() => {
        const el = container.querySelector<HTMLElement>('[data-ogrid-range-move-handle]');
        expect(el).toBeInTheDocument();
        return el!;
      });
      const dt = makeDataTransfer();
      fireEvent.dragStart(handle, { dataTransfer: dt });
      fireEvent.drop(kind === 'source' ? plain : child, { dataTransfer: dt });
    }
    expect(onEdit).not.toHaveBeenCalled();
    expect(bodyCell(container, 1, 0).textContent).toBe('2');
    expect(bodyCell(container, 2, 1).textContent).toBe('value');
  });

  it('moves a spill anchor across frozen panes and restores its spill with one undo', async () => {
    const { container, grid } = await renderGrid({
      data: rows.map(row => ({ ...row, a: '', b: '' })),
      formulas: true, initialFormulas: [{ col: 0, row: 0, formula: '=SEQUENCE(2)' }],
      rangeMove: true, frozenRows: 1, frozenColumns: 1,
    });
    await waitFor(() => expect(bodyCell(container, 1, 0).textContent).toBe('2'));
    fireEvent.pointerDown(bodyCell(container, 0, 0));
    const handle = await waitFor(() => {
      const el = container.querySelector<HTMLElement>('[data-ogrid-range-move-handle]');
      expect(el).toBeInTheDocument();
      return el!;
    });
    const dt = makeDataTransfer();
    fireEvent.dragStart(handle, { dataTransfer: dt });
    fireEvent.drop(bodyCell(container, 2, 1), { dataTransfer: dt });
    await waitFor(() => expect(bodyCell(container, 3, 1).textContent).toBe('2'));
    expect(bodyCell(container, 1, 0).textContent).toBe('');
    fireEvent.keyDown(grid, { key: 'z', ctrlKey: true });
    await waitFor(() => expect(bodyCell(container, 1, 0).textContent).toBe('2'));
    expect(bodyCell(container, 3, 1).textContent).toBe('');
    fireEvent.keyDown(grid, { key: 'y', ctrlKey: true });
    await waitFor(() => expect(bodyCell(container, 3, 1).textContent).toBe('2'));
    expect(bodyCell(container, 1, 0).textContent).toBe('');
  });

  it('keeps the range handle on a frozen cell across scroll and resize, and cleans up', async () => {
    const { container, grid, unmount } = await renderGrid({ rangeMove: true, rowDragging: true, frozenRows: 1, frozenColumns: 1 });
    await waitFor(() => expect(container.querySelector('[data-ogrid-row-drag-handle]')).not.toBeNull());
    const cell = bodyCell(container, 0, 0);
    const anchor = container.querySelector('table')!.parentElement!;
    let scroll = 0;
    let cellLeft = 60;
    const rect = (left: number, top: number) => ({ left, top, right: left + 80, bottom: top + 30, width: 80, height: 30, x: left, y: top, toJSON() {} });
    const cellRect = jest.spyOn(cell, 'getBoundingClientRect').mockImplementation(() => rect(cellLeft, 50));
    const anchorRect = jest.spyOn(anchor, 'getBoundingClientRect').mockImplementation(() => rect(-scroll, -scroll));
    fireEvent.pointerDown(cell);
    const handle = await waitFor(() => {
      const el = container.querySelector<HTMLElement>('[data-ogrid-range-move-handle]');
      expect(el).toBeInTheDocument();
      return el!;
    });
    expect([handle.style.left, handle.style.top]).toEqual(['60px', '50px']);
    scroll = 100;
    fireEvent.scroll(grid);
    await waitFor(() => expect([handle.style.left, handle.style.top]).toEqual(['160px', '150px']));
    cellLeft = 90;
    fireEvent(window, new Event('resize'));
    await waitFor(() => expect(handle.style.left).toBe('190px'));
    unmount();
    const calls = cellRect.mock.calls.length;
    fireEvent.scroll(grid);
    fireEvent(window, new Event('resize'));
    expect(cellRect.mock.calls.length).toBe(calls);
    cellRect.mockRestore();
    anchorRect.mockRestore();
  });

  describe('cell range move', () => {
    it('moves a selected range and undoes it', async () => {
      const { container, grid, onEdit } = await renderGrid({ rangeMove: true });
      // Select A1:B1 (display row 0, data columns 0-1).
      fireEvent.pointerDown(bodyCell(container, 0, 0));
      fireEvent.pointerDown(bodyCell(container, 0, 1), { shiftKey: true });
      const handle = await waitFor(() => {
        const el = container.querySelector<HTMLElement>('[data-ogrid-range-move-handle]');
        expect(el).toBeInTheDocument();
        return el as HTMLElement;
      });
      const dt = makeDataTransfer();
      fireEvent.dragStart(handle, { dataTransfer: dt });
      const target = bodyCell(container, 2, 0);
      expect(fireEvent.dragOver(target, { dataTransfer: dt })).toBe(false);
      fireEvent.drop(target, { dataTransfer: dt });
      await waitFor(() => expect(onEdit.mock.calls.length).toBeGreaterThan(0));
      // The source row is cleared and the target row takes the moved values.
      await waitFor(() => {
        expect(bodyCell(container, 2, 0).textContent).toBe('a1');
        expect(bodyCell(container, 2, 1).textContent).toBe('b1');
        expect(bodyCell(container, 0, 0).textContent).toBe('');
      });
      // Ctrl+Z restores the original values.
      grid.focus();
      fireEvent.keyDown(grid, { key: 'z', ctrlKey: true });
      await waitFor(() => {
        expect(bodyCell(container, 0, 0).textContent).toBe('a1');
        expect(bodyCell(container, 0, 1).textContent).toBe('b1');
        expect(bodyCell(container, 2, 0).textContent).toBe('a3');
      });
    });
  });
}

/** Exercises the documented kit import as an actual native source. */
export function createCellDragSourceTests(useCellDragSource: (params?: UseCellDragSourceParams) => CellDragSourceProps): void {
  function Source({ handleSelector }: { handleSelector?: string }) {
    const drag = useCellDragSource({ rowId: 2, columnId: 'a', payload: { label: 'chip' }, handleSelector });
    return <div {...drag} data-testid="source"><span data-grip><i>Grip</i></span><span>Body</span></div>;
  }
  it('uses the documented kit import to deliver a cell payload', () => {
    const { getByTestId } = render(<Source />);
    const dt = makeDataTransfer();
    expect(fireEvent.dragStart(getByTestId('source'), { dataTransfer: dt })).toBe(true);
    expect(JSON.parse(dt.getData('application/json'))).toEqual({ rowId: 2, columnId: 'a', label: 'chip' });
  });
  it.each(['pointerDown', 'mouseDown'] as const)('authorizes a parent dragstart from its child handle via %s', (press) => {
    const { getByTestId, getByText } = render(<Source handleSelector="[data-grip]" />);
    const dt = makeDataTransfer();
    fireEvent[press](getByText('Grip'));
    expect(fireEvent.dragStart(getByTestId('source'), { dataTransfer: dt })).toBe(true);
    expect(JSON.parse(dt.getData('application/json'))).toMatchObject({ rowId: 2 });
    fireEvent[press](getByText('Body'));
    const rejected = makeDataTransfer();
    expect(fireEvent.dragStart(getByTestId('source'), { dataTransfer: rejected })).toBe(false);
    expect(rejected.getData('application/json')).toBe('');
  });
}
