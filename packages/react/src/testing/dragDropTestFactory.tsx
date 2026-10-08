/**
 * Shared drag-and-drop tests: row reorder (handle + keyboard), range move
 * (with undo) and external cell drops. Each UI package calls
 * createDragDropTests(OGrid) to run these.
 */
import * as React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import type { ICellValueChangedEvent, IColumnDef, IOGridProps, IRowOrderChange } from '../types';

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

export function createDragDropTests(OGrid: React.ComponentType<IOGridProps<Row>>): void {
  interface HarnessProps {
    overrides?: Partial<IOGridProps<Row>>;
    onOrder?: (event: IRowOrderChange<Row>) => void;
    onEdit?: (event: ICellValueChangedEvent<Row>) => void;
    /** When false, the host does not hold the order (grid applies it itself). */
    emitOrder?: boolean;
  }

  function Harness({ overrides, onOrder, onEdit, emitOrder = true }: HarnessProps) {
    const [data, setData] = React.useState<Row[]>(rows);
    const gridProps = {
      data,
      columns,
      getRowId: (r: Row) => r.id,
      editable: true,
      ...overrides,
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

  function renderGrid(
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
    const grid = utils.container.querySelector('[role="region"]') as HTMLElement;
    return { ...utils, grid, onOrder, onEdit };
  }

  describe('row dragging', () => {
    it('renders a drag handle once rowDragging is on', () => {
      const { container } = renderGrid({ rowDragging: true });
      expect(container.querySelectorAll('[data-ogrid-row-drag-handle]').length).toBe(rows.length);
    });

    it('reorders rows when the handle is dragged onto another row', async () => {
      const { container, onOrder } = renderGrid({ rowDragging: true });
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
      const { container } = renderGrid({ rowDragging: true }, { emitOrder: false });
      const handle = container.querySelector<HTMLElement>('[data-ogrid-row-drag-handle]') as HTMLElement;
      const dt = makeDataTransfer();
      fireEvent.dragStart(handle, { dataTransfer: dt });
      const target = bodyCell(container, 3, 0);
      fireEvent.dragOver(target, { dataTransfer: dt, clientY: 5 });
      fireEvent.drop(target, { dataTransfer: dt, clientY: 5 });
      await waitFor(() => expect(rowOrder(container)).toEqual(['2', '3', '4', '1']));
    });

    it('moves the active row from the keyboard with Ctrl+Shift+ArrowDown', async () => {
      const { container, grid, onOrder } = renderGrid({ rowDragging: true });
      fireEvent.pointerDown(bodyCell(container, 0, 0));
      grid.focus();
      fireEvent.keyDown(grid, { key: 'ArrowDown', ctrlKey: true, shiftKey: true });
      await waitFor(() => expect(onOrder).toHaveBeenCalledTimes(1));
      const event = onOrder.mock.calls[0][0] as IRowOrderChange<Row>;
      expect(event.rowIds).toEqual([2, 1, 3, 4]);
    });

    it('does not offer row dragging while a sort is active', () => {
      const { container } = renderGrid({
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
      const { container } = renderGrid({ cellDrop: true, onCellDrop });
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
      const { container, onEdit } = renderGrid({ cellDrop: true });
      const target = bodyCell(container, 1, 0);
      const dt = makeDataTransfer({ 'text/plain': 'typed' });
      fireEvent.dragOver(target, { dataTransfer: dt });
      fireEvent.drop(target, { dataTransfer: dt });
      await waitFor(() => expect(onEdit).toHaveBeenCalled());
      const event = onEdit.mock.calls[0][0] as ICellValueChangedEvent<Row>;
      expect(event).toMatchObject({ columnId: 'a', newValue: 'typed', rowIndex: 1 });
    });
  });

  describe('cell range move', () => {
    it('moves a selected range and undoes it', async () => {
      const { container, grid, onEdit } = renderGrid({ rangeMove: true });
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
      fireEvent.dragOver(target, { dataTransfer: dt });
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
