import * as React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { IColumnDef, IOGridProps, IOGridApi, ICellValueChangedEvent } from '../types';
import type { IDataValidationRule, IDataValidationFailure } from '@alaarab/ogrid-core';
interface Row { id: string; qty: number; status: string }
const rows: Row[] = [{ id: 'r0', qty: 2, status: 'Open' }, { id: 'r1', qty: 3, status: 'Other' }, { id: 'r2', qty: 99, status: 'Closed' }];
const columns: IColumnDef<Row>[] = [{ columnId: 'qty', name: 'Qty', type: 'numeric', editable: true }, { columnId: 'status', name: 'Status', editable: true }];
const whole = { type: 'whole', columnIds: ['qty'], operator: 'between', value: 1, value2: 10, errorAlert: { style: 'stop', title: 'Quantity', message: 'Choose 1 to 10.' } } satisfies IDataValidationRule<Row>;
function paste(target: HTMLElement, text: string) {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } });
  fireEvent(target, event);
}
export function createDataValidationTests(OGrid: React.ComponentType<IOGridProps<Row> & { ref?: React.Ref<IOGridApi<Row>> }>) {
  function setup(overrides: Partial<IOGridProps<Row>> = {}) {
    const changes = jest.fn();
    const ref = React.createRef<IOGridApi<Row>>();
    function Host() {
      const [data, setData] = React.useState(rows);
      return <OGrid ref={ref} {...({ columns, data, getRowId: (r: Row) => r.id, editable: true, defaultSortBy: '', cellReferences: true, dataValidations: [whole], onCellValueChanged: (e: ICellValueChangedEvent<Row>) => { changes(e); setData((old) => old.map((r) => r.id === e.item.id ? { ...r, [e.columnId]: e.newValue } : r)); }, ...overrides } as IOGridProps<Row>)} />;
    }
    const view = render(<Host />);
    const grid = view.container.querySelector('[role="region"]') as HTMLElement;
    const cell = (id: string, col = 'qty') => view.container.querySelector(`tr[data-row-id="${id}"] td[data-column-id="${col}"]`) as HTMLElement;
    const select = (id: string, col = 'qty') => { fireEvent.pointerDown(cell(id, col).querySelector('[data-row-index]') as HTMLElement); grid.focus(); };
    const edit = async (id: string, value: string) => {
      select(id); fireEvent.keyDown(grid, { key: 'F2' });
      const input = await waitFor(() => { const el = grid.querySelector('[data-ogrid-cell-editor] input'); expect(el).toBeInTheDocument(); return el as HTMLInputElement; });
      fireEvent.change(input, { target: { value } }); fireEvent.keyDown(input, { key: 'Enter' });
    };
    return { ...view, grid, cell, select, edit, changes, api: () => ref.current as IOGridApi<Row> };
  }
  describe('data validation', () => {
    it('stop rejects an edit before an event or undo entry is recorded', async () => {
      const g = setup(); await g.edit('r0', '11');
      expect(g.changes).not.toHaveBeenCalled(); expect(g.api().getCellValue('r0', 'qty')).toBe(2);
      expect(await screen.findByRole('dialog')).toHaveTextContent('Choose 1 to 10.');
      fireEvent.click(screen.getByRole('button', { name: 'OK' }));
      await g.edit('r0', '5'); expect(g.changes).toHaveBeenCalledTimes(1);
      fireEvent.keyDown(g.grid, { key: 'z', ctrlKey: true });
      expect(g.api().getCellValue('r0', 'qty')).toBe(2);
    });
    it('paste validates each cell and commits valid neighbors', () => {
      const g = setup(); g.select('r0'); paste(g.grid, '11\n7');
      expect(g.changes).toHaveBeenCalledTimes(1);
      expect(g.changes.mock.calls[0]?.[0]).toMatchObject({ columnId: 'qty', rowIndex: 1, newValue: 7 });
      expect(g.api().getCellValue('r0', 'qty')).toBe(2);
    });
    it('warning cancellation rejects and confirmation commits exactly once', async () => {
      const g = setup({ dataValidations: [{ ...whole, errorAlert: { style: 'warning', message: 'Keep this quantity?' } }] });
      await g.edit('r0', '11'); expect(g.changes).not.toHaveBeenCalled();
      fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
      expect(g.api().getCellValue('r0', 'qty')).toBe(2);
      await g.edit('r0', '12');
      fireEvent.click(await screen.findByRole('button', { name: 'Accept value' }));
      expect(g.changes).toHaveBeenCalledTimes(1); expect(g.api().getCellValue('r0', 'qty')).toBe(12);
    });
    it('information accepts with a notice', async () => {
      const g = setup({ dataValidations: [{ ...whole, errorAlert: { style: 'information', message: 'Outside our suggested range.' } }] });
      await g.edit('r0', '11'); expect(g.api().getCellValue('r0', 'qty')).toBe(11);
      expect(await screen.findByRole('dialog')).toHaveTextContent('Outside our suggested range.');
    });
    it('API stop rejects and API warning uses onValidationFail without opening a dialog', () => {
      const fail = jest.fn((_failure: IDataValidationFailure<Row>) => false);
      const g = setup({ onValidationFail: fail });
      act(() => g.api().setCellValue('r0', 'qty', 11)); expect(g.changes).not.toHaveBeenCalled();
      expect(fail.mock.calls[0]?.[0]).toMatchObject({ style: 'stop', source: 'api', value: 11 });
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    it('API warnings reject by default and can be accepted by the callback', () => {
      const fail = jest.fn((_failure: IDataValidationFailure<Row>) => false);
      const g = setup({ dataValidations: [{ ...whole, errorAlert: { style: 'warning' } }], onValidationFail: fail });
      act(() => g.api().setCellValue('r0', 'qty', 11)); expect(g.changes).not.toHaveBeenCalled();
      fail.mockReturnValue(true); act(() => g.api().setCellValue('r0', 'qty', 12));
      expect(g.api().getCellValue('r0', 'qty')).toBe(12); expect(screen.queryByRole('dialog')).toBeNull();
    });
    it('list dropdown applies only to rule cells and its active-cell arrow opens the options', async () => {
      const g = setup({ dataValidations: [{ type: 'list', columnIds: ['status'], rows: { start: 0, end: 0 }, values: ['Open', 'Closed'] }] });
      g.select('r1', 'status'); expect(screen.queryByRole('button', { name: 'Show validation list' })).toBeNull();
      g.select('r0', 'status'); fireEvent.click(screen.getByRole('button', { name: 'Show validation list' }));
      const option = await screen.findByRole('option', { name: 'Closed' }); fireEvent.click(option);
      expect(g.api().getCellValue('r0', 'status')).toBe('Closed');
    });
    it('input message follows the active cell and is absent outside its range', () => {
      const g = setup({ dataValidations: [{ ...whole, rows: { start: 0, end: 0 }, inputMessage: { title: 'Order quantity', text: 'Enter a whole number from 1 to 10.' } }] });
      g.select('r0'); expect(screen.getByRole('tooltip')).toHaveTextContent('Order quantity');
      expect(screen.getByRole('tooltip')).toHaveTextContent('Enter a whole number');
      g.select('r1'); expect(screen.queryByRole('tooltip')).toBeNull();
    });
    it('circle invalid data highlights existing invalid values and updates after correction', () => {
      const g = setup({ circleInvalidData: true });
      expect(g.cell('r2').querySelector('[data-validation-invalid]')).toBeInTheDocument();
      expect(g.cell('r0').querySelector('[data-validation-invalid]')).toBeNull();
      act(() => g.api().setCellValue('r2', 'qty', 8));
      expect(g.cell('r2').querySelector('[data-validation-invalid]')).toBeNull();
    });
    it('custom formulas validate candidate values and formula edits', () => {
      const g = setup({ formulas: true, dataValidations: [{ type: 'custom', columnIds: ['qty'], formula: '=A1<=10' }] });
      act(() => g.api().setCellValue('r1', 'qty', '=99')); expect(g.api().getCellValue('r1', 'qty')).toBe(3);
      act(() => g.api().setCellValue('r1', 'qty', '=2+4')); expect(g.api().getCellValue('r1', 'qty')).toBe(6);
    });
    it('fill rejects invalid destination values', () => {
      const g = setup({ dataValidations: [{ ...whole, rows: { start: 1, end: 1 }, operator: 'greaterThan', value: 5 }] });
      g.select('r0'); fireEvent.keyDown(g.grid, { key: 'ArrowDown', shiftKey: true }); fireEvent.keyDown(g.grid, { key: 'd', ctrlKey: true });
      expect(g.changes).not.toHaveBeenCalled(); expect(g.api().getCellValue('r1', 'qty')).toBe(3);
    });
    it('Find & Replace validates replacement values', async () => {
      const g = setup({ findReplace: true }); g.select('r0'); fireEvent.keyDown(g.grid, { key: 'h', ctrlKey: true });
      fireEvent.change(await screen.findByRole('textbox', { name: 'Find' }), { target: { value: '2' } });
      fireEvent.change(screen.getByRole('textbox', { name: 'Replace with' }), { target: { value: '20' } });
      fireEvent.click(screen.getByRole('button', { name: 'Replace all' }));
      expect(g.api().getCellValue('r0', 'qty')).toBe(2); expect(g.changes).not.toHaveBeenCalled();
    });
    it('editing an existing custom rule preserves its relative meaning on a different selected row', async () => {
      const changed = jest.fn();
      const g = setup({ allowValidationEditing: true, formulas: true, dataValidations: [{ type: 'custom', columnIds: ['qty'], formula: '=A1<=10' }], onDataValidationsChange: changed });
      g.select('r1'); fireEvent.contextMenu(g.cell('r1').querySelector('[data-row-index]') as HTMLElement, { clientX: 10, clientY: 10 });
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Data validation…' }));
      expect(await screen.findByLabelText('Formula')).toHaveValue('=A2<=10');
      fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
      const applied = changed.mock.calls[0]?.[0] as IDataValidationRule<Row>[];
      expect(applied[applied.length - 1]).toMatchObject({ formula: '=A2<=10', rows: { start: 1, end: 1 }, anchor: { columnId: 'qty', row: 1 } });
    });
    it('the opt-in editor applies Settings, Input message, and Error alert to the selected range', async () => {
      const changed = jest.fn();
      const g = setup({ allowValidationEditing: true, dataValidations: [], onDataValidationsChange: changed });
      g.select('r0'); fireEvent.keyDown(g.grid, { key: 'ArrowDown', shiftKey: true });
      fireEvent.contextMenu(g.cell('r0').querySelector('[data-row-index]') as HTMLElement, { clientX: 10, clientY: 10 });
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Data validation…' }));
      fireEvent.change(await screen.findByLabelText('Allow'), { target: { value: 'whole' } });
      fireEvent.change(screen.getByLabelText('Minimum'), { target: { value: '1' } });
      fireEvent.change(screen.getByLabelText('Maximum'), { target: { value: '10' } });
      fireEvent.click(screen.getByRole('tab', { name: 'Input message' }));
      fireEvent.change(screen.getByLabelText('Input message'), { target: { value: 'Choose a quantity.' } });
      fireEvent.click(screen.getByRole('tab', { name: 'Error alert' }));
      fireEvent.change(screen.getByLabelText('Style'), { target: { value: 'warning' } });
      fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
      expect(changed).toHaveBeenCalledTimes(1);
      expect(changed.mock.calls[0]?.[0]).toEqual([expect.objectContaining({ type: 'whole', value: 1, value2: 10, columnIds: ['qty'], rows: { start: 0, end: 1 }, inputMessage: expect.objectContaining({ text: 'Choose a quantity.' }), errorAlert: expect.objectContaining({ style: 'warning' }) })]);
    });
  });
}
