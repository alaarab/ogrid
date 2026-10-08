/**
 * Shared formula integration tests for the top-level OGrid component.
 * Each UI package calls createFormulaTests(OGrid) to run these.
 *
 * They pin down the formula coordinate model: formulas, A1 references, column
 * letters, row numbers and the name box all use sheet coordinates (flat column
 * index, row index in the full data), so formulas stay with their record and
 * column through sort, paging, hidden and reordered columns, and every edit
 * path (editor, paste, Delete, undo/redo, formula bar) goes through the engine.
 */
import * as React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react';
import type { IOGridProps, IColumnDef, ICellValueChangedEvent } from '../types';
import { useUndoRedo } from '../hooks/useUndoRedo';

interface Row {
  id: number;
  name: string;
  qty: number;
  price: number;
  total?: unknown;
}

// Sheet rows (data order): Cherry = row 1, Apple = row 2, Banana = row 3.
// The grid's default sort (first column, ascending) shows Apple, Banana, Cherry.
const rows: Row[] = [
  { id: 1, name: 'Cherry', qty: 3, price: 10 },
  { id: 2, name: 'Apple', qty: 1, price: 20 },
  { id: 3, name: 'Banana', qty: 2, price: 30 },
];

const columns: IColumnDef<Row>[] = [
  { columnId: 'name', name: 'Name', sortable: true, editable: true, cellEditor: 'text' },
  { columnId: 'qty', name: 'Qty', type: 'numeric', sortable: true, editable: true, cellEditor: 'text' },
  { columnId: 'price', name: 'Price', type: 'numeric', editable: true, cellEditor: 'text' },
  { columnId: 'total', name: 'Total', editable: true, cellEditor: 'text' },
];

// D = total, B = qty, C = price
const initialFormulas = [
  { col: 3, row: 0, formula: '=B1*C1' },
  { col: 3, row: 1, formula: '=B2*C2' },
  { col: 3, row: 2, formula: '=B3*C3' },
];

type GridOverrides = Partial<IOGridProps<Row>> & { readOnly?: boolean };

export function createFormulaTests(OGrid: React.ComponentType<IOGridProps<Row>>): void {
  function Harness({ overrides, onChange }: { overrides: GridOverrides; onChange?: (e: ICellValueChangedEvent<Row>) => void }) {
    const [data, setData] = React.useState(rows);
    const { readOnly, ...rest } = overrides;
    const onCellValueChanged = React.useCallback((e: ICellValueChangedEvent<Row>) => {
      onChange?.(e);
      setData((prev) => prev.map((r) => (r.id === e.item.id ? { ...r, [e.columnId]: e.newValue } : r)));
    }, [onChange]);
    const props = {
      columns,
      data,
      getRowId: (r: Row) => r.id,
      formulas: true,
      initialFormulas,
      editable: true,
      onCellValueChanged: readOnly ? undefined : onCellValueChanged,
      defaultPageSize: 10,
      ...rest,
    } as IOGridProps<Row>;
    return <OGrid {...props} />;
  }

  function renderGrid(overrides: GridOverrides = {}, onChange?: (e: ICellValueChangedEvent<Row>) => void) {
    const utils = render(<Harness overrides={overrides} onChange={onChange} />);
    const rerender = (next: GridOverrides) => utils.rerender(<Harness overrides={next} onChange={onChange} />);
    return { ...utils, rerender };
  }

  function td(container: HTMLElement, rowId: number, columnId: string): HTMLElement {
    const el = container.querySelector(`tr[data-row-id="${rowId}"] td[data-column-id="${columnId}"]`);
    if (!el) throw new Error(`No cell for row ${rowId}, column ${columnId}`);
    return el as HTMLElement;
  }
  const text = (container: HTMLElement, rowId: number, columnId: string) => td(container, rowId, columnId).textContent;

  function activate(container: HTMLElement, rowId: number, columnId: string): HTMLElement {
    const cell = td(container, rowId, columnId).querySelector('[data-row-index]') as HTMLElement;
    fireEvent.pointerDown(cell);
    return cell;
  }

  async function editCell(container: HTMLElement, rowId: number, columnId: string, value: string) {
    const cell = activate(container, rowId, columnId);
    fireEvent.click(cell);
    fireEvent.doubleClick(cell);
    const grid = container.querySelector('[role="region"]') as HTMLElement;
    await waitFor(() => expect(grid.querySelector('tbody input')).toBeInTheDocument());
    const input = grid.querySelector('tbody input') as HTMLInputElement;
    fireEvent.change(input, { target: { value } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(grid.querySelector('tbody input')).toBeNull());
  }

  function gridKey(container: HTMLElement, init: KeyboardEventInit) {
    const grid = container.querySelector('[role="region"]') as HTMLElement;
    grid.focus();
    fireEvent.keyDown(grid, init);
  }

  // The host owns the history: its own useUndoRedo records every change the
  // grid emits and drives Ctrl+Z/Y through onUndo/onRedo.
  function HostUndoHarness({ onChange }: { onChange?: (e: ICellValueChangedEvent<Row>) => void }) {
    const [data, setData] = React.useState(rows);
    const apply = React.useCallback((e: ICellValueChangedEvent<Row>) => {
      onChange?.(e);
      setData((prev) => prev.map((r) => (r.id === e.item.id ? { ...r, [e.columnId]: e.newValue } : r)));
    }, [onChange]);
    const history = useUndoRedo<Row>({ onCellValueChanged: apply });
    const props = {
      columns,
      data,
      getRowId: (r: Row) => r.id,
      formulas: true,
      initialFormulas,
      editable: true,
      onCellValueChanged: history.onCellValueChanged,
      onUndo: history.undo,
      onRedo: history.redo,
      canUndo: history.canUndo,
      canRedo: history.canRedo,
      defaultPageSize: 10,
    } as IOGridProps<Row>;
    return <OGrid {...props} />;
  }

  const totals = (container: HTMLElement) => [1, 2, 3].map((id) => text(container, id, 'total'));
  const nameBox = (container: HTMLElement) =>
    container.querySelector('[role="toolbar"][aria-label="Formula bar"] [aria-label="Active cell reference"]')?.textContent;
  const formulaInput = (container: HTMLElement) =>
    container.querySelector('input[aria-label="Formula input"]') as HTMLInputElement;

  describe('formula coordinates', () => {
    it('keeps formulas on their records under the default sort and after re-sorting', () => {
      const { container, rerender } = renderGrid();
      // Cherry 3*10, Apple 1*20, Banana 2*30, whatever order they are shown in.
      expect(totals(container)).toEqual(['30', '20', '60']);
      // Row numbers name the sheet row, so Apple (shown first) is row 2.
      const appleRowNumber = container.querySelector('tr[data-row-id="2"] td')?.textContent;
      expect(appleRowNumber).toBe('2');

      rerender({ sort: { field: 'qty', direction: 'desc' } });
      expect(totals(container)).toEqual(['30', '20', '60']);
    });

    it('shows a page-2 record with its own formula', () => {
      const { container, getByRole } = renderGrid({ defaultPageSize: 2 });
      expect(text(container, 2, 'total')).toBe('20');
      expect(text(container, 3, 'total')).toBe('60');
      fireEvent.click(getByRole('button', { name: /next page/i }));
      // Cherry is sheet row 1, shown on page 2 as the only row.
      expect(text(container, 1, 'total')).toBe('30');
      expect(container.querySelector('tr[data-row-id="1"] td')?.textContent).toBe('1');
    });

    it('keeps column letters and formulas when a column is hidden and the rest reordered', () => {
      const { container } = renderGrid({
        visibleColumns: new Set(['name', 'qty', 'total']),
        columnOrder: ['total', 'name', 'qty', 'price'],
      });
      const letters = Array.from(container.querySelectorAll('thead tr:first-child th'))
        .map((th) => th.textContent)
        .filter((t) => t);
      expect(letters).toEqual(['D', 'A', 'B']);
      // =B*C still reads the hidden price column.
      expect(totals(container)).toEqual(['30', '20', '60']);
    });

    it('names the active cell by its sheet coordinates in the formula bar', () => {
      const { container } = renderGrid({ visibleColumns: new Set(['name', 'qty', 'total']) });
      activate(container, 2, 'total');
      expect(nameBox(container)).toBe('D2');
      expect(formulaInput(container).value).toBe('=B2*C2');
    });
  });

  describe('formula edits', () => {
    it('recalculates dependents against the new data after an edit', async () => {
      const { container } = renderGrid();
      await editCell(container, 2, 'qty', '5');
      await waitFor(() => expect(text(container, 2, 'total')).toBe('100'));
      expect(text(container, 1, 'total')).toBe('30');
    });

    it('keeps a formula typed into a sorted grid with its record', async () => {
      const { container, rerender } = renderGrid();
      await editCell(container, 2, 'total', '=C2*3');
      expect(text(container, 2, 'total')).toBe('60');
      rerender({ sort: { field: 'qty', direction: 'desc' } });
      expect(totals(container)).toEqual(['30', '60', '60']);
    });

    it('replaces a formula with a typed value, and undo restores the formula', async () => {
      const onChange = jest.fn();
      const { container } = renderGrid({}, onChange);
      await editCell(container, 2, 'total', '99');
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ columnId: 'total', newValue: '99' }));
      expect(text(container, 2, 'total')).toBe('99');

      gridKey(container, { key: 'z', ctrlKey: true });
      await waitFor(() => expect(text(container, 2, 'total')).toBe('20'));
      activate(container, 2, 'total');
      expect(formulaInput(container).value).toBe('=B2*C2');
    });

    it('undoes and redoes a formula edit', async () => {
      const { container } = renderGrid();
      await editCell(container, 2, 'total', '=1');
      expect(text(container, 2, 'total')).toBe('1');
      gridKey(container, { key: 'z', ctrlKey: true });
      await waitFor(() => expect(text(container, 2, 'total')).toBe('20'));
      gridKey(container, { key: 'y', ctrlKey: true });
      await waitFor(() => expect(text(container, 2, 'total')).toBe('1'));
    });

    it('fill down shifts references by sheet rows and undoes as one step', async () => {
      const { container } = renderGrid();
      await editCell(container, 2, 'total', '=B2*100');
      expect(text(container, 2, 'total')).toBe('100');
      // Select Apple, Banana, Cherry totals (shown in that order) and fill down.
      activate(container, 2, 'total');
      fireEvent.pointerDown(td(container, 1, 'total').querySelector('[data-row-index]') as HTMLElement, { shiftKey: true });
      gridKey(container, { key: 'd', ctrlKey: true });
      // Each filled formula reads its own record's row: Banana is row 3, Cherry row 1.
      await waitFor(() => expect(totals(container)).toEqual(['300', '100', '200']));

      gridKey(container, { key: 'z', ctrlKey: true });
      await waitFor(() => expect(totals(container)).toEqual(['30', '100', '60']));
    });

    it('recalculates dependents after a paste', async () => {
      const { container } = renderGrid();
      activate(container, 2, 'qty');
      const grid = container.querySelector('[role="region"]') as HTMLElement;
      grid.focus();
      // Ctrl+V reaches the grid as the browser's native paste event.
      const paste = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(paste, 'clipboardData', { value: { getData: () => '7' } });
      await act(async () => {
        fireEvent(grid, paste);
      });
      await waitFor(() => expect(text(container, 2, 'total')).toBe('140'));
    });

    it('pasting a formula copied in the grid shifts its relative references (Excel)', async () => {
      const { container } = renderGrid();
      await editCell(container, 1, 'total', '=B1*10');
      expect(text(container, 1, 'total')).toBe('30');
      const grid = container.querySelector('[role="region"]') as HTMLElement;
      // Copy Cherry's total (sheet row 1) ...
      activate(container, 1, 'total');
      grid.focus();
      const copied: Record<string, string> = {};
      const copy = new Event('copy', { bubbles: true, cancelable: true });
      Object.defineProperty(copy, 'clipboardData', { value: { setData: (f: string, v: string) => { copied[f] = v; } } });
      await act(async () => {
        fireEvent(grid, copy);
      });
      expect(copied['text/plain']).toBe('=B1*10');
      // The HTML flavor carries the computed value, not the formula.
      expect(copied['text/html']).toContain('<td>30</td>');
      // ... and paste it onto Apple's total (sheet row 2): B1 becomes B2.
      activate(container, 2, 'total');
      const paste = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(paste, 'clipboardData', { value: { getData: (f: string) => copied[f] ?? '' } });
      await act(async () => {
        fireEvent(grid, paste);
      });
      await waitFor(() => expect(text(container, 2, 'total')).toBe('10'));
      expect(formulaInput(container).value).toBe('=B2*10');
    });

    it('Ctrl+Shift+V pastes computed values, not formulas', async () => {
      const { container } = renderGrid();
      const grid = container.querySelector('[role="region"]') as HTMLElement;
      // Copy Banana's total (=B3*C3 = 60) ...
      activate(container, 3, 'total');
      grid.focus();
      const copied: Record<string, string> = {};
      const copy = new Event('copy', { bubbles: true, cancelable: true });
      Object.defineProperty(copy, 'clipboardData', { value: { setData: (f: string, v: string) => { copied[f] = v; } } });
      await act(async () => {
        fireEvent(grid, copy);
      });
      // ... into Apple's price: the value 60, so Apple's total becomes 1 * 60.
      activate(container, 2, 'price');
      gridKey(container, { key: 'V', ctrlKey: true, shiftKey: true });
      const paste = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(paste, 'clipboardData', { value: { getData: (f: string) => copied[f] ?? '' } });
      await act(async () => {
        fireEvent(grid, paste);
      });
      await waitFor(() => expect(text(container, 2, 'price')).toBe('60'));
      expect(text(container, 2, 'total')).toBe('60');
      activate(container, 2, 'price');
      expect(formulaInput(container).value).toBe('60');
    });

    it('Delete clears a formula cell', async () => {
      const { container } = renderGrid();
      activate(container, 2, 'total');
      gridKey(container, { key: 'Delete' });
      await waitFor(() => expect(text(container, 2, 'total')).toBe(''));
      expect(formulaInput(container).value).toBe('');
    });
  });

  describe('formula bar', () => {
    it('replaces a formula with its underlying raw value and supports undo and redo', async () => {
      const onChange = jest.fn();
      const { container } = renderGrid({ initialFormulas: [{ col: 1, row: 1, formula: '=10' }] }, onChange);
      activate(container, 2, 'qty');
      expect(text(container, 2, 'qty')).toBe('10');
      const input = formulaInput(container);
      fireEvent.click(input);
      fireEvent.change(input, { target: { value: '1' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      await waitFor(() => expect(text(container, 2, 'qty')).toBe('1'));
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ columnId: 'qty', oldValue: 1, newValue: 1 }));
      gridKey(container, { key: 'z', ctrlKey: true });
      await waitFor(() => expect(text(container, 2, 'qty')).toBe('10'));
      activate(container, 2, 'qty');
      expect(formulaInput(container).value).toBe('=10');
      gridKey(container, { key: 'y', ctrlKey: true });
      await waitFor(() => expect(text(container, 2, 'qty')).toBe('1'));
      activate(container, 2, 'qty');
      expect(formulaInput(container).value).toBe('1');
    });

    it('Enter in the read-only bar does not erase the formula', () => {
      const { container } = renderGrid();
      activate(container, 2, 'total');
      const input = formulaInput(container);
      input.focus();
      fireEvent.keyDown(input, { key: 'Escape' });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(text(container, 2, 'total')).toBe('20');
      expect(input.value).toBe('=B2*C2');
    });

    it('commits a plain value through the grid and refreshes its text', async () => {
      const onChange = jest.fn();
      const { container } = renderGrid({}, onChange);
      activate(container, 2, 'total');
      const input = formulaInput(container);
      fireEvent.click(input);
      fireEvent.change(input, { target: { value: '42' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      await waitFor(() => expect(text(container, 2, 'total')).toBe('42'));
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ columnId: 'total', newValue: '42' }));
      expect(formulaInput(container).value).toBe('42');
      // The formula is gone from the engine too: dependents of the cell see the value.
      gridKey(container, { key: 'z', ctrlKey: true });
      await waitFor(() => expect(text(container, 2, 'total')).toBe('20'));
    });

    it('sets a formula on the active record from the bar', async () => {
      const { container } = renderGrid({ sort: { field: 'qty', direction: 'desc' } });
      activate(container, 2, 'total');
      const input = formulaInput(container);
      fireEvent.click(input);
      fireEvent.change(input, { target: { value: '=C2+1' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      await waitFor(() => expect(text(container, 2, 'total')).toBe('21'));
      expect(totals(container)).toEqual(['30', '21', '60']);
    });

    it('Enter (commit) and Escape (cancel) in the bar return focus to the active cell', async () => {
      const { container } = renderGrid();
      activate(container, 2, 'qty');
      const input = formulaInput(container);
      fireEvent.click(input);
      input.focus();
      expect(document.activeElement).toBe(input);
      fireEvent.change(input, { target: { value: '5' } });
      act(() => { fireEvent.keyDown(input, { key: 'Enter' }); });
      await waitFor(() => expect(text(container, 2, 'qty')).toBe('5'));
      expect(document.activeElement).toBe(td(container, 2, 'qty'));

      fireEvent.click(input);
      input.focus();
      fireEvent.change(input, { target: { value: '9' } });
      act(() => { fireEvent.keyDown(input, { key: 'Escape' }); });
      expect(document.activeElement).toBe(td(container, 2, 'qty'));
      expect(text(container, 2, 'qty')).toBe('5');
    });

    it('focus that leaves the bar some other way stays where it went', async () => {
      const { container } = renderGrid();
      const outside = document.createElement('button');
      document.body.appendChild(outside);
      try {
        activate(container, 2, 'qty');
        const input = formulaInput(container);
        fireEvent.click(input);
        input.focus();
        fireEvent.change(input, { target: { value: '7' } });
        // Clicking elsewhere on the page: the bar loses focus without a commit key.
        act(() => outside.focus());
        await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
        expect(document.activeElement).toBe(outside);
      } finally {
        outside.remove();
      }
    });

    it('does not enter edit mode in a read-only grid', () => {
      const { container } = renderGrid({ readOnly: true });
      activate(container, 2, 'total');
      const input = formulaInput(container);
      fireEvent.click(input);
      expect(input.readOnly).toBe(true);
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(text(container, 2, 'total')).toBe('20');
    });
  });

  describe('host-controlled undo', () => {
    const renderHost = (onChange?: (e: ICellValueChangedEvent<Row>) => void) => render(<HostUndoHarness onChange={onChange} />);

    it('records a typed formula in the host history, and host undo/redo restore it', async () => {
      const onChange = jest.fn();
      const { container } = renderHost(onChange);
      await editCell(container, 2, 'total', '=1');
      expect(text(container, 2, 'total')).toBe('1');
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ columnId: 'total', oldValue: '=B2*C2', newValue: '=1' }));
      gridKey(container, { key: 'z', ctrlKey: true });
      await waitFor(() => expect(text(container, 2, 'total')).toBe('20'));
      activate(container, 2, 'total');
      expect(formulaInput(container).value).toBe('=B2*C2');
      gridKey(container, { key: 'y', ctrlKey: true });
      await waitFor(() => expect(text(container, 2, 'total')).toBe('1'));
    });

    it('host undo of a value typed over a formula restores the formula', async () => {
      const { container } = renderHost();
      await editCell(container, 2, 'total', '99');
      expect(text(container, 2, 'total')).toBe('99');
      gridKey(container, { key: 'z', ctrlKey: true });
      await waitFor(() => expect(text(container, 2, 'total')).toBe('20'));
      activate(container, 2, 'total');
      expect(formulaInput(container).value).toBe('=B2*C2');
      gridKey(container, { key: 'y', ctrlKey: true });
      await waitFor(() => expect(text(container, 2, 'total')).toBe('99'));
    });

    it('undoes value and formula edits in the order they were made', async () => {
      const { container } = renderHost();
      await editCell(container, 2, 'qty', '5');
      await waitFor(() => expect(text(container, 2, 'total')).toBe('100'));
      await editCell(container, 3, 'total', '=B2+1');
      await waitFor(() => expect(text(container, 3, 'total')).toBe('6'));
      gridKey(container, { key: 'z', ctrlKey: true });
      await waitFor(() => expect(text(container, 3, 'total')).toBe('60'));
      expect(text(container, 2, 'total')).toBe('100');
      gridKey(container, { key: 'z', ctrlKey: true });
      await waitFor(() => expect(text(container, 2, 'total')).toBe('20'));
      expect(text(container, 2, 'qty')).toBe('1');
    });

    it('a formula typed over a plain cell is undone back to the plain value', async () => {
      const { container } = renderHost();
      await editCell(container, 2, 'price', '=B2*7');
      expect(text(container, 2, 'price')).toBe('7');
      await waitFor(() => expect(text(container, 2, 'total')).toBe('7'));
      gridKey(container, { key: 'z', ctrlKey: true });
      await waitFor(() => expect(text(container, 2, 'price')).toBe('20'));
      expect(text(container, 2, 'total')).toBe('20');
      activate(container, 2, 'price');
      expect(formulaInput(container).value).toBe('20');
    });
  });
}
