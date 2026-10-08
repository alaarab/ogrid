/**
 * Shared tests for hiding and unhiding rows and columns (`allowHiding`,
 * `hiddenRowIds`, `visibleColumns`). Each UI package calls
 * createHidingTests(OGrid).
 */
import * as React from 'react';
import { render, fireEvent, act, screen, waitFor } from '@testing-library/react';
import type { IOGridProps, IOGridApi, IColumnDef, RowId } from '../types';

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

export function createHidingTests(OGrid: OGridComponent): void {
  function renderGrid(overrides: GridOverrides = {}) {
    const props = {
      columns,
      data: rows,
      getRowId: (r: Row) => r.id,
      defaultPageSize: 25,
      allowHiding: true,
      ...overrides,
    } as IOGridProps<Row>;
    return render(<OGrid {...props} />);
  }

  const rowIds = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('tbody tr[data-row-id]')).map((tr) => tr.getAttribute('data-row-id'));
  const headerIds = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('thead th[data-column-id]')).map((th) => th.getAttribute('data-column-id'));
  function cellOf(container: HTMLElement, rowId: number, columnId: string): HTMLElement {
    const el = container.querySelector(`tr[data-row-id="${rowId}"] td[data-column-id="${columnId}"] [data-row-index]`);
    if (!el) throw new Error(`No cell for row ${rowId}, column ${columnId}`);
    return el as HTMLElement;
  }
  function select(container: HTMLElement, from: [number, string], to?: [number, string]) {
    const a = cellOf(container, from[0], from[1]);
    fireEvent.pointerDown(a);
    fireEvent.mouseDown(a, { button: 0 });
    fireEvent.mouseUp(a, { button: 0 });
    if (to) {
      const b = cellOf(container, to[0], to[1]);
      fireEvent.pointerDown(b, { shiftKey: true });
      fireEvent.mouseDown(b, { button: 0, shiftKey: true });
      fireEvent.mouseUp(b, { button: 0, shiftKey: true });
    }
    return to ? cellOf(container, to[0], to[1]) : a;
  }
  async function contextMenuOn(cell: HTMLElement) {
    fireEvent.contextMenu(cell, { clientX: 100, clientY: 100 });
    await waitFor(() => expect(screen.getByRole('menu')).toBeInTheDocument());
  }

  describe('hidden rows', () => {
    it('hiddenRowIds leaves rows out of the display and the row count', () => {
      const { container } = renderGrid({ hiddenRowIds: [2, 3], statusBar: true });
      expect(rowIds(container)).toEqual(['1', '4']);
    });

    it('defaultHiddenRowIds hides rows uncontrolled', () => {
      const { container } = renderGrid({ defaultHiddenRowIds: [1] });
      expect(rowIds(container)).toEqual(['2', '3', '4']);
    });

    it('hidden rows are skipped by paging', () => {
      const { container } = renderGrid({ hiddenRowIds: [1, 2], defaultPageSize: 1 });
      expect(rowIds(container)).toEqual(['3']);
    });

    it('rows are hidden without allowHiding too, but the menu items need it', async () => {
      const { container } = renderGrid({ allowHiding: false, hiddenRowIds: [2] });
      expect(rowIds(container)).toEqual(['1', '3', '4']);
      await contextMenuOn(select(container, [1, 'name']));
      expect(screen.queryByText('Hide row')).toBeNull();
    });

    it('"Hide row" hides the selected rows and reports onHiddenRowIdsChange', async () => {
      const onHiddenRowIdsChange = jest.fn();
      const { container } = renderGrid({ onHiddenRowIdsChange });
      await contextMenuOn(select(container, [2, 'name'], [3, 'name']));
      fireEvent.click(screen.getByText('Hide 2 rows'));
      expect(onHiddenRowIdsChange).toHaveBeenLastCalledWith([2, 3]);
      expect(rowIds(container)).toEqual(['1', '4']);
    });

    it('"Unhide rows" shows when the selection spans hidden rows and unhides them', async () => {
      const onHiddenRowIdsChange = jest.fn();
      const { container } = renderGrid({ defaultHiddenRowIds: [2, 3], onHiddenRowIdsChange });
      await contextMenuOn(select(container, [1, 'name']));
      expect(screen.queryByText('Unhide rows')).toBeNull();
      fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
      await contextMenuOn(select(container, [1, 'name'], [4, 'name']));
      fireEvent.click(screen.getByText('Unhide rows'));
      expect(onHiddenRowIdsChange).toHaveBeenLastCalledWith([]);
      expect(rowIds(container)).toEqual(['1', '2', '3', '4']);
    });

    it('a marker on the row numbers unhides the rows hidden there', () => {
      const { container } = renderGrid({ defaultHiddenRowIds: [2, 3], cellReferences: true });
      // Row numbers follow the data: 1, 4 (2 and 3 are hidden).
      const marker = screen.getByRole('button', { name: 'Unhide 2 hidden rows' });
      expect(marker.closest('tr')?.getAttribute('data-row-id')).toBe('4');
      fireEvent.click(marker);
      expect(rowIds(container)).toEqual(['1', '2', '3', '4']);
    });

    it('trailing hidden rows get a marker on the last row', () => {
      renderGrid({ defaultHiddenRowIds: [4], showRowNumbers: true });
      const marker = screen.getByRole('button', { name: 'Unhide hidden row' });
      expect(marker.getAttribute('data-hidden-gap')).toBe('after');
      expect(marker.closest('tr')?.getAttribute('data-row-id')).toBe('3');
    });

    it('row markers need allowHiding and row numbers', () => {
      renderGrid({ defaultHiddenRowIds: [2] });
      expect(screen.queryByRole('button', { name: /hidden row/ })).toBeNull();
    });

    it('keyboard navigation skips hidden rows', () => {
      const { container } = renderGrid({ hiddenRowIds: [2] });
      select(container, [1, 'name']);
      const grid = container.querySelector('[role="region"]') as HTMLElement;
      act(() => {
        fireEvent.keyDown(grid, { key: 'ArrowDown' });
      });
      expect(cellOf(container, 3, 'name').getAttribute('data-active-cell')).toBe('true');
    });

    it('Find skips hidden rows and hidden columns', async () => {
      const { container } = renderGrid({
        findReplace: true,
        defaultPageSize: 2,
        hiddenRowIds: [3],
        columns: [...columns, { columnId: 'alias', name: 'Alias', defaultVisible: false, valueGetter: (r: Row) => `${r.name}a` }],
      });
      const grid = container.querySelector('[role="region"]') as HTMLElement;
      select(container, [1, 'name']);
      grid.focus();
      fireEvent.keyDown(grid, { key: 'f', ctrlKey: true });
      const input = await screen.findByRole('textbox', { name: 'Find' });
      // "a" is in Apple, Banana, Date (Cherry is hidden; the hidden Alias column would match every row).
      fireEvent.change(input, { target: { value: 'a' } });
      await waitFor(() => expect(screen.getByRole('status').textContent).toBe('1 of 3'));
    });

    it('SUBTOTAL 109 leaves hidden rows out; SUBTOTAL 9 counts them', () => {
      const data = [...rows, { id: 5, name: 'Sum', qty: 0 }];
      const { container, rerender } = renderGrid({
        data,
        formulas: true,
        hiddenRowIds: [],
        initialFormulas: [
          { col: 2, row: 4, formula: '=SUBTOTAL(109,B1:B4)' },
          { col: 2, row: 3, formula: '=SUBTOTAL(9,B1:B3)' },
        ],
      });
      const total = (id: number) => container.querySelector(`tr[data-row-id="${id}"] td[data-column-id="total"]`)?.textContent;
      expect(total(5)).toBe('15');
      rerender(
        <OGrid
          {...({
            columns, data, getRowId: (r: Row) => r.id, allowHiding: true, formulas: true, hiddenRowIds: [2 as RowId],
            initialFormulas: [
              { col: 2, row: 4, formula: '=SUBTOTAL(109,B1:B4)' },
              { col: 2, row: 3, formula: '=SUBTOTAL(9,B1:B3)' },
            ],
          } as IOGridProps<Row>)}
        />,
      );
      expect(total(5)).toBe('13');
      expect(total(4)).toBe('7');
    });
  });

  describe('hidden columns', () => {
    it('"Hide column" in the header menu hides it through visibleColumns', async () => {
      const onVisibleColumnsChange = jest.fn();
      const { container } = renderGrid({ onVisibleColumnsChange });
      fireEvent.click(screen.getByRole('button', { name: 'Qty column options' }));
      fireEvent.click(await screen.findByText('Hide column'));
      expect(headerIds(container)).toEqual(['name', 'total']);
      const calls = onVisibleColumnsChange.mock.calls;
      const visible = calls[calls.length - 1]?.[0] as Set<string>;
      expect([...visible].sort()).toEqual(['name', 'total']);
    });

    it('the header menu has no hide item without allowHiding', async () => {
      renderGrid({ allowHiding: false });
      fireEvent.click(screen.getByRole('button', { name: 'Qty column options' }));
      await screen.findByText('Pin left');
      expect(screen.queryByText('Hide column')).toBeNull();
    });

    it('"Unhide columns" in a neighbor\'s header menu brings hidden columns back', async () => {
      const { container } = renderGrid({ visibleColumns: undefined, columns: columns.map((c) => c.columnId === 'qty' ? { ...c, defaultVisible: false } : c) });
      expect(headerIds(container)).toEqual(['name', 'total']);
      fireEvent.click(screen.getByRole('button', { name: 'Name column options' }));
      fireEvent.click(await screen.findByText('Unhide columns'));
      expect(headerIds(container)).toEqual(['name', 'qty', 'total']);
    });

    it('a header marker shows where columns are hidden and unhides them', () => {
      const { container } = renderGrid({ columns: columns.map((c) => c.columnId === 'qty' ? { ...c, defaultVisible: false } : c) });
      const marker = screen.getByRole('button', { name: 'Unhide hidden column: Qty' });
      expect(marker.closest('th')?.getAttribute('data-column-id')).toBe('total');
      fireEvent.click(marker);
      expect(headerIds(container)).toEqual(['name', 'qty', 'total']);
    });

    it('controlled visibleColumns: hiding reports the new set without changing the view', async () => {
      const onVisibleColumnsChange = jest.fn();
      const { container } = renderGrid({ visibleColumns: new Set(['name', 'qty', 'total']), onVisibleColumnsChange });
      fireEvent.click(screen.getByRole('button', { name: 'Total column options' }));
      fireEvent.click(await screen.findByText('Hide column'));
      expect(onVisibleColumnsChange).toHaveBeenCalledTimes(1);
      expect(headerIds(container)).toEqual(['name', 'qty', 'total']);
    });

    it('the last visible column cannot be hidden', async () => {
      renderGrid({ visibleColumns: new Set(['name']) });
      fireEvent.click(screen.getByRole('button', { name: 'Name column options' }));
      await screen.findByText('Pin left');
      expect(screen.queryByText('Hide column')).toBeNull();
    });

    it('the context menu hides a multi-column selection', async () => {
      const { container } = renderGrid();
      await contextMenuOn(select(container, [1, 'qty'], [2, 'total']));
      expect(screen.getByText('Hide 2 rows')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Hide 2 columns'));
      expect(headerIds(container)).toEqual(['name']);
    });

    it('a column-letter (whole column) selection offers "Hide column"', async () => {
      const { container } = renderGrid({ cellReferences: true });
      const letterB = container.querySelector('thead [data-col-header-index="1"]') as HTMLElement;
      fireEvent.pointerDown(letterB, { button: 0 });
      await waitFor(() => expect(container.querySelectorAll('tbody td[aria-selected="true"]').length).toBe(rows.length));
      await contextMenuOn(cellOf(container, 2, 'qty'));
      fireEvent.click(screen.getByText('Hide column'));
      expect(headerIds(container)).toEqual(['name', 'total']);
    });

    it('clicking a gap marker unhides without starting a header or row-number selection', async () => {
      const { container } = renderGrid({
        cellReferences: true,
        defaultHiddenRowIds: [2],
        columns: columns.map((c) => c.columnId === 'qty' ? { ...c, defaultVisible: false } : c),
      });
      const colMarker = screen.getByRole('button', { name: 'Unhide hidden column: Qty' });
      fireEvent.pointerDown(colMarker, { button: 0 });
      fireEvent.click(colMarker);
      const rowMarker = screen.getByRole('button', { name: 'Unhide hidden row' });
      fireEvent.pointerDown(rowMarker, { button: 0 });
      fireEvent.click(rowMarker);
      expect(headerIds(container)).toEqual(['name', 'qty', 'total']);
      expect(rowIds(container)).toEqual(['1', '2', '3', '4']);
      expect(container.querySelectorAll('tbody td[aria-selected="true"]').length).toBe(0);
    });

    it('a single cell offers no column items', async () => {
      const { container } = renderGrid();
      await contextMenuOn(select(container, [1, 'qty']));
      expect(screen.queryByText('Hide column')).toBeNull();
      expect(screen.getByText('Hide row')).toBeInTheDocument();
    });
  });
}
