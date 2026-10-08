/**
 * Shared tests for the freeze-panes commands (`allowFreeze`, `frozenRows` /
 * `frozenColumns` with their `default*` and `on*Change` pairs). Each UI
 * package calls createFreezeTests(OGrid).
 */
import * as React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import type { IOGridProps, IOGridApi, IColumnDef } from '../types';

interface Row {
  id: number;
  name: string;
  qty: number;
  total?: unknown;
}

const rows: Row[] = [
  { id: 1, name: 'Apple', qty: 1 },
  { id: 2, name: 'Banana', qty: 2 },
  { id: 3, name: 'Cherry', qty: 4 },
  { id: 4, name: 'Date', qty: 8 },
];

// A = name, B = qty, C = total.
const columns: IColumnDef<Row>[] = [
  { columnId: 'name', name: 'Name' },
  { columnId: 'qty', name: 'Qty', type: 'numeric' },
  { columnId: 'total', name: 'Total' },
];

type GridOverrides = Partial<IOGridProps<Row>>;
type OGridComponent = React.ForwardRefExoticComponent<IOGridProps<Row> & React.RefAttributes<IOGridApi<Row>>>;

export function createFreezeTests(OGrid: OGridComponent): void {
  function renderGrid(overrides: GridOverrides = {}) {
    const props = {
      columns,
      data: rows,
      getRowId: (r: Row) => r.id,
      defaultPageSize: 25,
      allowFreeze: true,
      ...overrides,
    } as IOGridProps<Row>;
    return render(<OGrid {...props} />);
  }

  const frozenRowIds = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('tbody tr[data-frozen-row]')).map((tr) => tr.getAttribute('data-row-id'));
  function pinnedCell(container: HTMLElement, rowId: number, columnId: string): HTMLElement | null {
    return container.querySelector<HTMLElement>(`tbody tr[data-row-id="${rowId}"] td[data-column-id="${columnId}"]`);
  }
  function activate(container: HTMLElement, rowId: number, columnId: string): HTMLElement {
    const cell = container.querySelector(`tr[data-row-id="${rowId}"] td[data-column-id="${columnId}"] [data-row-index]`);
    if (!(cell instanceof HTMLElement)) throw new Error(`No cell for row ${rowId}, column ${columnId}`);
    fireEvent.pointerDown(cell);
    fireEvent.mouseDown(cell, { button: 0 });
    fireEvent.mouseUp(cell, { button: 0 });
    return cell;
  }
  async function openContextMenu(container: HTMLElement, rowId: number, columnId: string) {
    const cell = activate(container, rowId, columnId);
    fireEvent.contextMenu(cell, { clientX: 100, clientY: 100 });
    await waitFor(() => expect(screen.getByRole('menu')).toBeInTheDocument());
  }

  describe('freeze panes', () => {
    it('the context menu has no freeze items without allowFreeze', async () => {
      const { container } = renderGrid({ allowFreeze: false });
      await openContextMenu(container, 2, 'name');
      expect(screen.queryByText('Freeze top row')).toBeNull();
      expect(screen.queryByText('Unfreeze panes')).toBeNull();
    });

    it('"Freeze top row" freezes the first row and reports onFrozenRowsChange', async () => {
      const onFrozenRowsChange = jest.fn();
      const { container } = renderGrid({ onFrozenRowsChange });
      await openContextMenu(container, 3, 'name');
      fireEvent.click(screen.getByText('Freeze top row'));
      expect(onFrozenRowsChange).toHaveBeenLastCalledWith(1);
      expect(frozenRowIds(container)).toEqual(['1']);
    });

    it('"Freeze first column" pins the first column left and reports onFrozenColumnsChange', async () => {
      const onFrozenColumnsChange = jest.fn();
      const { container } = renderGrid({ onFrozenColumnsChange });
      await openContextMenu(container, 3, 'qty');
      fireEvent.click(screen.getByText('Freeze first column'));
      expect(onFrozenColumnsChange).toHaveBeenLastCalledWith(1);
      const pinned = pinnedCell(container, 3, 'name');
      // Pinned columns get a sticky offset (inline `left`; the sticky position comes from the kit's CSS class).
      expect(pinned?.style.left).not.toBe('');
      expect(pinnedCell(container, 3, 'qty')?.style.left).toBe('');
    });

    it.each([
      { showRowNumbers: true, rowSelection: 'none' as const },
      { showRowNumbers: false, rowSelection: 'multiple' as const },
      { showRowNumbers: true, rowSelection: 'multiple' as const },
    ])('freezes A:B at C with special columns %j', async (special) => {
      const onFrozenColumnsChange = jest.fn();
      const { container } = renderGrid({ ...special, onFrozenColumnsChange });
      await openContextMenu(container, 3, 'total');
      fireEvent.click(screen.getByText('Freeze panes'));
      expect(onFrozenColumnsChange).toHaveBeenLastCalledWith(2);
      expect(pinnedCell(container, 3, 'qty')?.style.left).not.toBe('');
      expect(pinnedCell(container, 3, 'total')?.style.left).toBe('');
    });

    it('"Freeze panes" freezes rows above and columns left of the active cell', async () => {
      const onFrozenRowsChange = jest.fn();
      const onFrozenColumnsChange = jest.fn();
      const { container } = renderGrid({ onFrozenRowsChange, onFrozenColumnsChange });
      await openContextMenu(container, 3, 'qty');
      fireEvent.click(screen.getByText('Freeze panes'));
      expect(onFrozenRowsChange).toHaveBeenLastCalledWith(2);
      expect(onFrozenColumnsChange).toHaveBeenLastCalledWith(1);
      expect(frozenRowIds(container)).toEqual(['1', '2']);
    });

    it('"Unfreeze panes" clears the panes when frozen', async () => {
      const onFrozenRowsChange = jest.fn();
      const onFrozenColumnsChange = jest.fn();
      const { container } = renderGrid({ frozenRows: 1, frozenColumns: 1, onFrozenRowsChange, onFrozenColumnsChange });
      expect(frozenRowIds(container)).toEqual(['1']);
      await openContextMenu(container, 3, 'qty');
      fireEvent.click(screen.getByText('Unfreeze panes'));
      expect(onFrozenRowsChange).toHaveBeenLastCalledWith(0);
      expect(onFrozenColumnsChange).toHaveBeenLastCalledWith(0);
    });

    it('the ctx menu does not offer Freeze panes on the first cell, but offers Unfreeze when frozen', async () => {
      const { container } = renderGrid({ frozenColumns: 1 });
      await openContextMenu(container, 1, 'name');
      expect(screen.queryByText('Freeze panes')).toBeNull();
      expect(screen.getByText('Unfreeze panes')).toBeInTheDocument();
    });

    it('uncontrolled freeze state persists after choosing Freeze top row', async () => {
      const { container } = renderGrid();
      await openContextMenu(container, 4, 'name');
      fireEvent.click(screen.getByText('Freeze top row'));
      expect(frozenRowIds(container)).toEqual(['1']);
    });

    it('restores each sheet\'s uncontrolled panes without changing explicit column pins', async () => {
      const sheetColumns = columns.map((col) => col.columnId === 'total' ? { ...col, pinned: 'right' as const } : col);
      const props: IOGridProps<Row> = { columns: sheetColumns, data: rows, getRowId: (r) => r.id, allowFreeze: true,
        defaultFrozenRows: 1, defaultFrozenColumns: 1, activeSheet: 'A' };
      const { container, rerender } = render(<OGrid {...props} />);
      await openContextMenu(container, 3, 'total');
      fireEvent.click(screen.getByText('Freeze panes'));
      expect(frozenRowIds(container)).toEqual(['1', '2']);
      expect(pinnedCell(container, 3, 'qty')?.style.left).not.toBe('');
      rerender(<OGrid {...props} activeSheet="B" />);
      expect(frozenRowIds(container)).toEqual(['1']);
      expect(pinnedCell(container, 3, 'qty')?.style.left).toBe('');
      await openContextMenu(container, 3, 'qty');
      fireEvent.click(screen.getByText('Unfreeze panes'));
      expect(frozenRowIds(container)).toEqual([]);
      expect(pinnedCell(container, 3, 'name')?.style.left).toBe('');
      expect(pinnedCell(container, 3, 'total')?.style.right).not.toBe('');
      rerender(<OGrid {...props} />);
      expect(frozenRowIds(container)).toEqual(['1', '2']);
      expect(pinnedCell(container, 3, 'qty')?.style.left).not.toBe('');
      rerender(<OGrid {...props} activeSheet="B" />);
      expect(frozenRowIds(container)).toEqual([]);
      expect(pinnedCell(container, 3, 'name')?.style.left).toBe('');
    });

    it('sheet switches leave controlled freeze axes with the host and do not notify', () => {
      const onFrozenRowsChange = jest.fn();
      const onFrozenColumnsChange = jest.fn();
      const props: IOGridProps<Row> = { columns, data: rows, getRowId: (r) => r.id, activeSheet: 'A',
        frozenRows: 2, frozenColumns: 2, onFrozenRowsChange, onFrozenColumnsChange };
      const { container, rerender } = render(<OGrid {...props} />);
      rerender(<OGrid {...props} activeSheet="B" frozenRows={1} frozenColumns={1} />);
      expect(frozenRowIds(container)).toEqual(['1']);
      expect(pinnedCell(container, 3, 'qty')?.style.left).toBe('');
      rerender(<OGrid {...props} />);
      expect(frozenRowIds(container)).toEqual(['1', '2']);
      expect(pinnedCell(container, 3, 'qty')?.style.left).not.toBe('');
      expect(onFrozenRowsChange).not.toHaveBeenCalled();
      expect(onFrozenColumnsChange).not.toHaveBeenCalled();
    });
  });
}
