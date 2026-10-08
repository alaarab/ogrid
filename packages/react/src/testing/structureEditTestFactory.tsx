/**
 * Shared tests for the cell-level API (getCellValue / setCellValue),
 * structure edits (insert/delete rows and columns, from the API and the
 * menus) and per-row resizing. Each UI package calls
 * createStructureEditTests(OGrid).
 */
import * as React from 'react';
import { render, fireEvent, act, screen, waitFor } from '@testing-library/react';
import type {
  IOGridProps,
  IOGridApi,
  IColumnDef,
  IColumnGroupDef,
  ICellValueChangedEvent,
  IRowsChangeEvent,
  IColumnsChangeEvent,
} from '../types';

interface Row {
  id: number;
  name: string;
  qty?: number;
  price?: number;
  total?: unknown;
  [key: string]: unknown;
}

const rows: Row[] = [
  { id: 1, name: 'Apple', qty: 3, price: 10 },
  { id: 2, name: 'Banana', qty: 1, price: 20 },
  { id: 3, name: 'Cherry', qty: 2, price: 30 },
];

// A = name, B = qty, C = price, D = total. No sortable columns: rows stay in data order.
const columns: IColumnDef<Row>[] = [
  { columnId: 'name', name: 'Name', editable: true },
  {
    columnId: 'qty', name: 'Qty', type: 'numeric', editable: true,
    valueParser: ({ newValue }) => {
      const n = Number(newValue);
      return Number.isFinite(n) && n >= 0 ? n : undefined;
    },
  },
  { columnId: 'price', name: 'Price', type: 'numeric', editable: true },
  { columnId: 'total', name: 'Total', editable: true },
];

type GridOverrides = Partial<IOGridProps<Row>>;
type OGridComponent = React.ForwardRefExoticComponent<IOGridProps<Row> & React.RefAttributes<IOGridApi<Row>>>;

interface Spies {
  onCellValueChanged?: (e: ICellValueChangedEvent<Row>) => void;
  onRowsChange?: (e: IRowsChangeEvent<Row>) => void;
  onColumnsChange?: (e: IColumnsChangeEvent<Row>) => void;
}

let nextId = 100;

export function createStructureEditTests(OGrid: OGridComponent): void {
  const Harness = React.forwardRef(function Harness(
    { overrides, spies }: { overrides: GridOverrides; spies: Spies },
    ref: React.Ref<IOGridApi<Row>>,
  ) {
    const [data, setData] = React.useState(rows);
    const [cols, setCols] = React.useState<(IColumnDef<Row> | IColumnGroupDef<Row>)[]>(columns);
    const props = {
      columns: cols,
      data,
      getRowId: (r: Row) => r.id,
      editable: true,
      defaultPageSize: 10,
      onCellValueChanged: (e: ICellValueChangedEvent<Row>) => {
        spies.onCellValueChanged?.(e);
        setData((prev) => prev.map((r) => (r.id === e.item.id ? { ...r, [e.columnId]: e.newValue } : r)));
      },
      onRowsChange: (e: IRowsChangeEvent<Row>) => {
        spies.onRowsChange?.(e);
        setData(e.data);
      },
      onColumnsChange: (e: IColumnsChangeEvent<Row>) => {
        spies.onColumnsChange?.(e);
        setCols(e.columns);
      },
      createRow: () => ({ id: nextId++, name: '' }),
      ...overrides,
    } as IOGridProps<Row>;
    return <OGrid {...props} ref={ref} />;
  });

  function renderGrid(overrides: GridOverrides = {}, spies: Spies = {}) {
    const ref = React.createRef<IOGridApi<Row>>();
    const utils = render(<Harness ref={ref} overrides={overrides} spies={spies} />);
    const api = () => {
      if (!ref.current) throw new Error('grid api not ready');
      return ref.current;
    };
    return { ...utils, api };
  }

  const rowIds = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('tbody tr[data-row-id]')).map((tr) => tr.getAttribute('data-row-id'));
  const headerIds = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('thead th[data-column-id]')).map((th) => th.getAttribute('data-column-id'));
  function td(container: HTMLElement, rowId: number, columnId: string): HTMLElement {
    const el = container.querySelector(`tr[data-row-id="${rowId}"] td[data-column-id="${columnId}"]`);
    if (!el) throw new Error(`No cell for row ${rowId}, column ${columnId}`);
    return el as HTMLElement;
  }
  const text = (container: HTMLElement, rowId: number, columnId: string) => td(container, rowId, columnId).textContent;

  function activate(container: HTMLElement, rowId: number, columnId: string): HTMLElement {
    const cell = td(container, rowId, columnId).querySelector('[data-row-index]') as HTMLElement;
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
  function gridKey(container: HTMLElement, init: KeyboardEventInit) {
    const grid = container.querySelector('[role="region"]') as HTMLElement;
    act(() => {
      grid.focus();
      fireEvent.keyDown(grid, init);
    });
  }
  const undo = (container: HTMLElement) => gridKey(container, { key: 'z', ctrlKey: true });
  const redo = (container: HTMLElement) => gridKey(container, { key: 'y', ctrlKey: true });

  describe('cell API', () => {
    it('getCellValue reads a field, and undefined for an unknown row or column', () => {
      const { api } = renderGrid();
      expect(api().getCellValue(2, 'name')).toBe('Banana');
      expect(api().getCellValue(3, 'qty')).toBe(2);
      expect(api().getCellValue(99, 'name')).toBeUndefined();
      expect(api().getCellValue(1, 'nope')).toBeUndefined();
    });

    it('getCellValue uses the column valueGetter', () => {
      const withGetter: IColumnDef<Row>[] = [...columns, { columnId: 'label', name: 'Label', valueGetter: (r) => `${r.name}!` }];
      const { api } = renderGrid({ columns: withGetter });
      expect(api().getCellValue(1, 'label')).toBe('Apple!');
    });

    it('setCellValue commits through onCellValueChanged and the cell re-renders', () => {
      const onCellValueChanged = jest.fn();
      const { container, api } = renderGrid({}, { onCellValueChanged });
      act(() => api().setCellValue(2, 'name', 'Blueberry'));
      expect(onCellValueChanged).toHaveBeenCalledTimes(1);
      expect(onCellValueChanged.mock.calls[0]?.[0]).toMatchObject({ columnId: 'name', oldValue: 'Banana', newValue: 'Blueberry' });
      expect(text(container, 2, 'name')).toBe('Blueberry');
      expect(api().getCellValue(2, 'name')).toBe('Blueberry');
    });

    it('setCellValue runs the valueParser and drops a rejected value', () => {
      const onCellValueChanged = jest.fn();
      const { api } = renderGrid({}, { onCellValueChanged });
      act(() => api().setCellValue(1, 'qty', 'abc'));
      expect(onCellValueChanged).not.toHaveBeenCalled();
      act(() => api().setCellValue(1, 'qty', '7'));
      expect(onCellValueChanged.mock.calls[0]?.[0]).toMatchObject({ columnId: 'qty', newValue: 7 });
      expect(api().getCellValue(1, 'qty')).toBe(7);
    });

    it('setCellValue is undoable with Ctrl+Z and redoable with Ctrl+Y', () => {
      const { container, api } = renderGrid();
      act(() => api().setCellValue(1, 'name', 'Apricot'));
      expect(text(container, 1, 'name')).toBe('Apricot');
      undo(container);
      expect(text(container, 1, 'name')).toBe('Apple');
      redo(container);
      expect(text(container, 1, 'name')).toBe('Apricot');
    });

    it('setCellValue writes rows on other pages', () => {
      const onCellValueChanged = jest.fn();
      const { container, api } = renderGrid({ defaultPageSize: 2 } as GridOverrides, { onCellValueChanged });
      expect(rowIds(container)).toEqual(['1', '2']);
      act(() => api().setCellValue(3, 'name', 'Cranberry'));
      expect(onCellValueChanged.mock.calls[0]?.[0]).toMatchObject({ newValue: 'Cranberry' });
      expect(api().getCellValue(3, 'name')).toBe('Cranberry');
    });

    it('with formulas, setCellValue("=...") sets a formula and getCellValue returns its result', () => {
      const { container, api } = renderGrid({ formulas: true });
      act(() => api().setCellValue(1, 'total', '=B1*C1'));
      expect(api().getCellValue(1, 'total')).toBe(30);
      expect(text(container, 1, 'total')).toBe('30');
      // A plain value replaces the formula.
      act(() => api().setCellValue(1, 'total', 'none'));
      expect(api().getCellValue(1, 'total')).toBe('none');
    });
  });

  describe('row structure edits', () => {
    it('insertRows inserts rows, reports onRowsChange, and undo/redo remove and restore them', () => {
      const onRowsChange = jest.fn();
      const { container, api } = renderGrid({}, { onRowsChange });
      act(() => api().insertRows(1, [{ id: 50, name: 'Avocado' }]));
      expect(onRowsChange.mock.calls[0]?.[0]).toMatchObject({ type: 'insert', indexes: [1] });
      expect(rowIds(container)).toEqual(['1', '50', '2', '3']);
      undo(container);
      expect(rowIds(container)).toEqual(['1', '2', '3']);
      expect(onRowsChange.mock.calls[1]?.[0]).toMatchObject({ type: 'delete', indexes: [1] });
      redo(container);
      expect(rowIds(container)).toEqual(['1', '50', '2', '3']);
    });

    it('insertRows without rows uses createRow', () => {
      const createRow = jest.fn((index: number) => ({ id: 60 + index, name: 'New' }));
      const { container, api } = renderGrid({ createRow });
      act(() => api().insertRows(3));
      expect(createRow).toHaveBeenCalledWith(3);
      expect(rowIds(container)).toEqual(['1', '2', '3', '63']);
    });

    it('deleteRows removes rows and undo puts them back where they were', () => {
      const { container, api } = renderGrid();
      act(() => api().deleteRows([1, 3]));
      expect(rowIds(container)).toEqual(['2']);
      undo(container);
      expect(rowIds(container)).toEqual(['1', '2', '3']);
    });

    it('several edits in one tick build on each other', () => {
      const { container, api } = renderGrid();
      act(() => {
        api().insertRows(0, [{ id: 70, name: 'First' }]);
        api().insertRows(0, [{ id: 71, name: 'Zeroth' }]);
        api().deleteRows([2]);
      });
      expect(rowIds(container)).toEqual(['71', '70', '1', '3']);
    });

    it('formulas follow their rows when a row is inserted above them', () => {
      const { container, api } = renderGrid({
        formulas: true,
        initialFormulas: [
          { col: 3, row: 0, formula: '=B1*C1' },
          { col: 3, row: 2, formula: '=B3*C3+B1' },
        ],
      });
      expect(text(container, 1, 'total')).toBe('30');
      expect(text(container, 3, 'total')).toBe('63');
      act(() => api().insertRows(0, [{ id: 80, name: 'Top', qty: 100, price: 100 }]));
      expect(text(container, 1, 'total')).toBe('30');
      expect(text(container, 3, 'total')).toBe('63');
      expect(text(container, 80, 'total')).toBe('');
      undo(container);
      expect(text(container, 1, 'total')).toBe('30');
      expect(text(container, 3, 'total')).toBe('63');
    });

    it('a formula reading a deleted row shows #REF!, and undo restores it', () => {
      const { container, api } = renderGrid({
        formulas: true,
        initialFormulas: [{ col: 3, row: 2, formula: '=B1+1' }],
      });
      expect(text(container, 3, 'total')).toBe('4');
      act(() => api().deleteRows([1]));
      expect(text(container, 3, 'total')).toContain('#REF!');
      undo(container);
      expect(text(container, 3, 'total')).toBe('4');
    });

    it('with data and no onRowsChange, insertRows leaves the rows alone', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const { container, api } = renderGrid({ onRowsChange: undefined });
      act(() => api().insertRows(0, [{ id: 90, name: 'x' }]));
      expect(rowIds(container)).toEqual(['1', '2', '3']);
      warn.mockRestore();
    });
  });

  describe('column structure edits', () => {
    it('insertColumn adds a blank editable column and undo removes it', () => {
      const onColumnsChange = jest.fn();
      const { container, api } = renderGrid({}, { onColumnsChange });
      act(() => api().insertColumn(1));
      expect(headerIds(container)).toEqual(['name', 'column1', 'qty', 'price', 'total']);
      expect(onColumnsChange.mock.calls[0]?.[0]).toMatchObject({ type: 'insert', index: 1, column: { columnId: 'column1' } });
      undo(container);
      expect(headerIds(container)).toEqual(['name', 'qty', 'price', 'total']);
    });

    it('insertColumn accepts a column definition', () => {
      const { container, api } = renderGrid();
      act(() => api().insertColumn(4, { columnId: 'notes', name: 'Notes' }));
      expect(headerIds(container)).toEqual(['name', 'qty', 'price', 'total', 'notes']);
    });

    it('deleteColumn removes a column and undo restores it in place', () => {
      const { container, api } = renderGrid();
      act(() => api().deleteColumn('qty'));
      expect(headerIds(container)).toEqual(['name', 'price', 'total']);
      undo(container);
      expect(headerIds(container)).toEqual(['name', 'qty', 'price', 'total']);
    });

    it('formula references shift when a column is inserted before them', () => {
      const { container, api } = renderGrid({ formulas: true, initialFormulas: [{ col: 3, row: 0, formula: '=B1*C1' }] });
      expect(text(container, 1, 'total')).toBe('30');
      act(() => api().insertColumn(0));
      expect(text(container, 1, 'total')).toBe('30');
    });
  });

  describe('structure menus (allowStructureEdits)', () => {
    it.each(['Insert 2 columns left', 'Insert 2 columns right', 'Delete 2 columns'])('%s delivers the complete action and undoes/redoes in one step', async (label) => {
      const onColumnsChange = jest.fn();
      const { container } = renderGrid({ allowStructureEdits: true, cellReferences: true }, { onColumnsChange });
      fireEvent.pointerDown(container.querySelector('thead [data-col-header-index="1"]') as HTMLElement, { button: 0 });
      fireEvent.pointerDown(container.querySelector('thead [data-col-header-index="2"]') as HTMLElement, { button: 0, shiftKey: true });
      fireEvent.contextMenu(td(container, 1, 'qty').querySelector('[data-row-index]') as HTMLElement);
      fireEvent.click(await screen.findByText(label));
      const changed = label.startsWith('Delete') ? ['name', 'total'] : label.endsWith('left')
        ? ['name', 'column1', 'column2', 'qty', 'price', 'total']
        : ['name', 'qty', 'price', 'column1', 'column2', 'total'];
      expect(headerIds(container)).toEqual(changed);
      expect(onColumnsChange).toHaveBeenCalledTimes(1);
      expect(onColumnsChange.mock.calls[0]?.[0].columns.map((c: IColumnDef<Row>) => c.columnId)).toEqual(changed);
      undo(container);
      expect(headerIds(container)).toEqual(['name', 'qty', 'price', 'total']);
      redo(container);
      expect(headerIds(container)).toEqual(changed);
    });

    it('the context menu has no structure items without allowStructureEdits', async () => {
      const { container } = renderGrid();
      await openContextMenu(container, 2, 'name');
      expect(screen.queryByText('Insert row above')).toBeNull();
      expect(screen.queryByText('Delete column')).toBeNull();
    });

    it('"Insert row above" / "Insert row below" insert next to the active row', async () => {
      const createRow = () => ({ id: nextId++, name: 'New' });
      const { container } = renderGrid({ allowStructureEdits: true, createRow });
      await openContextMenu(container, 2, 'name');
      fireEvent.click(screen.getByText('Insert row above'));
      expect(rowIds(container)).toHaveLength(4);
      expect(rowIds(container)[0]).toBe('1');
      expect(rowIds(container)[2]).toBe('2');
      await openContextMenu(container, 2, 'name');
      fireEvent.click(screen.getByText('Insert row below'));
      expect(rowIds(container)).toHaveLength(5);
      expect(rowIds(container)[2]).toBe('2');
      expect(rowIds(container)[4]).toBe('3');
    });

    it('"Delete row" deletes the active row; undo restores it', async () => {
      const { container } = renderGrid({ allowStructureEdits: true });
      await openContextMenu(container, 2, 'name');
      fireEvent.click(screen.getByText('Delete row'));
      expect(rowIds(container)).toEqual(['1', '3']);
      undo(container);
      expect(rowIds(container)).toEqual(['1', '2', '3']);
    });

    it('row insert items need createRow; delete still shows', async () => {
      const { container } = renderGrid({ allowStructureEdits: true, createRow: undefined });
      await openContextMenu(container, 2, 'name');
      expect(screen.queryByText('Insert row above')).toBeNull();
      expect(screen.getByText('Delete row')).toBeInTheDocument();
    });

    it('"Insert column left/right" and "Delete column" act on the active column', async () => {
      const { container } = renderGrid({ allowStructureEdits: true });
      await openContextMenu(container, 1, 'qty');
      fireEvent.click(screen.getByText('Insert column left'));
      expect(headerIds(container)).toEqual(['name', 'column1', 'qty', 'price', 'total']);
      await openContextMenu(container, 1, 'qty');
      fireEvent.click(screen.getByText('Insert column right'));
      expect(headerIds(container)).toEqual(['name', 'column1', 'qty', 'column2', 'price', 'total']);
      await openContextMenu(container, 1, 'qty');
      fireEvent.click(screen.getByText('Delete column'));
      expect(headerIds(container)).toEqual(['name', 'column1', 'column2', 'price', 'total']);
    });

    it('the column header menu inserts and deletes columns', async () => {
      const { container } = renderGrid({ allowStructureEdits: true });
      fireEvent.click(screen.getByRole('button', { name: 'Price column options' }));
      fireEvent.click(await screen.findByText('Insert column right'));
      expect(headerIds(container)).toEqual(['name', 'qty', 'price', 'column1', 'total']);
      fireEvent.click(screen.getByRole('button', { name: 'Qty column options' }));
      fireEvent.click(await screen.findByText('Delete column'));
      expect(headerIds(container)).toEqual(['name', 'price', 'column1', 'total']);
    });

    it('the column header menu has no structure items without allowStructureEdits', async () => {
      renderGrid();
      fireEvent.click(screen.getByRole('button', { name: 'Price column options' }));
      await screen.findByText('Pin left');
      expect(screen.queryByText('Insert column left')).toBeNull();
    });
  });

  describe('row resize', () => {
    function dragHandle(handle: Element, fromY: number, toY: number) {
      fireEvent.pointerDown(handle, { button: 0, clientY: fromY });
      act(() => {
        document.dispatchEvent(new MouseEvent('pointermove', { clientY: toY, bubbles: true }));
      });
      act(() => {
        document.dispatchEvent(new MouseEvent('pointerup', { clientY: toY, bubbles: true }));
      });
    }

    it('shows no resize handles unless rowResize is on and row numbers are shown', () => {
      const { container, unmount } = renderGrid({ showRowNumbers: true });
      expect(container.querySelector('[data-row-resize-handle]')).toBeNull();
      unmount();
      const second = renderGrid({ rowResize: true });
      expect(second.container.querySelector('[data-row-resize-handle]')).toBeNull();
    });

    it('dragging a row number edge resizes that row and reports onRowResized', () => {
      const onRowResized = jest.fn();
      const { container } = renderGrid({ rowResize: true, showRowNumbers: true, onRowResized });
      const handles = container.querySelectorAll('[data-row-resize-handle]');
      expect(handles).toHaveLength(3);
      dragHandle(handles[1] as Element, 0, 64);
      expect(onRowResized).toHaveBeenCalledWith(2, 64);
      const row = container.querySelector('tr[data-row-id="2"]') as HTMLElement;
      expect(row.style.height).toBe('64px');
      expect((container.querySelector('tr[data-row-id="1"]') as HTMLElement).style.height).toBe('');
    });

    it('works with frozen rows: a resized frozen row keeps its height and handle', () => {
      const onRowResized = jest.fn();
      const { container } = renderGrid({ rowResize: true, showRowNumbers: true, frozenRows: 1, onRowResized });
      const first = container.querySelector('tr[data-row-id="1"]') as HTMLElement;
      expect(first.hasAttribute('data-frozen-row')).toBe(true);
      dragHandle(first.querySelector('[data-row-resize-handle]') as Element, 0, 48);
      expect(onRowResized).toHaveBeenCalledWith(1, 48);
      expect((container.querySelector('tr[data-row-id="1"]') as HTMLElement).style.height).toBe('48px');
    });

    it('controlled rowHeights set row heights', () => {
      const { container } = renderGrid({ rowResize: true, cellReferences: true, rowHeights: { 3: 50 } });
      expect((container.querySelector('tr[data-row-id="3"]') as HTMLElement).style.height).toBe('50px');
    });
  });
}
