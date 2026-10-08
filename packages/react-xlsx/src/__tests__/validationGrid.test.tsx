import { expect, test } from 'bun:test';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ExcelJS from 'exceljs';
import { XlsxWorkbookGrid } from '../XlsxWorkbookGrid';
import type { XlsxWorkbookDocument } from '../xlsxDocument';
import { workbookFromBlob } from '../sheetMapper';
import { diskRoundTrip } from './fixtures/xlsxFile';
import { xlsxWorkerFactory } from './fixtures/xlsxWorker';

async function mount(transport: 'worker' | 'fallback', workbook: ExcelJS.Workbook) {
  let doc: XlsxWorkbookDocument | undefined;
  const workerFactory = transport === 'worker' ? await xlsxWorkerFactory() : null;
  const blob = await diskRoundTrip(new Blob([await workbook.xlsx.writeBuffer()]));
  const view = render(<XlsxWorkbookGrid blob={blob} streaming editable toolbar={false} height={400}
    streamOptions={{ workerFactory }} onDocument={value => { doc = value; }} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Enable editing' }).hasAttribute('disabled')).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: 'Enable editing' }));
  await waitFor(() => expect(doc).toBeDefined());
  await waitFor(() => expect(view.container.querySelector('[inert]')).toBeNull());
  const cell = (row: number, col = 'A') => view.container.querySelector<HTMLElement>(`tbody tr[data-row-id="${row}"] td[data-column-id="${col}"] [data-row-index]`)!;
  const command = async (row: number, label: string, col = 'A') => {
    fireEvent.pointerDown(cell(row, col)); fireEvent.contextMenu(cell(row, col));
    fireEvent.click(await screen.findByRole('menuitem', { name: label }));
  };
  const undo = async () => { await act(async () => { fireEvent.keyDown(view.container.querySelector('[role="region"]')!, { key: 'z', ctrlKey: true }); }); };
  const saved = async () => (await workbookFromBlob(await diskRoundTrip(await doc!.toBlob()))).getWorksheet('Data')!;
  return { ...view, doc: () => doc!, cell, command, undo, saved };
}

test.each(['worker', 'fallback'] as const)('grid structure commands shift validation once and undo rows, columns and rules together after %s handover', async transport => {
  const workbook = new ExcelJS.Workbook(), sheet = workbook.addWorksheet('Data');
  sheet.addRows([['Count', 'Source'], [2, 'Open'], [3, 'Closed']]);
  sheet.getCell('A2').dataValidation = { type: 'whole', operator: 'between', formulae: [1, 10], showErrorMessage: true };
  const g = await mount(transport, workbook);
  await g.command(0, 'Insert row above');
  let out = await g.saved();
  expect(out.getCell('A3').dataValidation).toMatchObject({ type: 'whole', formulae: [1, 10] });
  expect(out.getCell('A2').dataValidation?.type).toBeUndefined();
  expect(out.getCell('A3').value).toBe(2);
  await g.undo(); out = await g.saved();
  expect(out.getCell('A2').dataValidation?.type).toBe('whole');
  expect(out.getCell('A2').value).toBe(2);
  expect(g.doc().canUndo('Data')).toBe(false);
  await g.command(0, 'Delete row'); out = await g.saved();
  expect(out.getCell('A2').value).toBe(3);
  expect(out.getCell('A2').dataValidation?.type).toBeUndefined();
  await g.undo();
  expect((await g.saved()).getCell('A2').dataValidation?.type).toBe('whole');
  expect(g.doc().canUndo('Data')).toBe(false);
  await g.command(0, 'Insert column left'); out = await g.saved();
  expect(out.getCell('B2').dataValidation?.type).toBe('whole');
  expect(out.getCell('B2').value).toBe(2);
  await g.undo();
  expect((await g.saved()).getCell('A2').dataValidation?.type).toBe('whole');
  expect(g.doc().canUndo('Data')).toBe(false);
  await g.command(0, 'Delete column');
  expect((await g.saved()).getCell('A2').dataValidation?.type).toBeUndefined();
  await g.undo();
  expect((await g.saved()).getCell('A2').dataValidation?.type).toBe('whole');
  expect(g.doc().canUndo('Data')).toBe(false);
}, 20000);

test.each(['worker', 'fallback'] as const)('named validation lists and formula names follow the live workbook and undo after %s handover', async transport => {
  const workbook = new ExcelJS.Workbook(), sheet = workbook.addWorksheet('Data');
  sheet.addRows([['Status', 'Source', 'Custom'], ['Open', 'Open', 'Open'], ['', 'Closed', '']]);
  workbook.definedNames.add("'Data'!$B$2:$B$3", 'Statuses');
  sheet.getCell('A2').dataValidation = { type: 'list', formulae: ['Statuses'], showErrorMessage: true };
  sheet.getCell('C2').dataValidation = { type: 'custom', formulae: ['COUNTIF(Statuses,C2)=1'], showErrorMessage: true };
  const g = await mount(transport, workbook);
  await g.command(0, 'Insert row above');
  fireEvent.pointerDown(g.cell(1));
  fireEvent.click(screen.getByRole('button', { name: 'Show validation list' }));
  fireEvent.click(await screen.findByRole('option', { name: 'Closed' }));
  expect(g.doc().sheet('Data')!.rows[1]!.A).toBe('Closed');
  await act(async () => {});
  fireEvent.pointerDown(g.cell(1, 'C')); fireEvent.doubleClick(g.cell(1, 'C'));
  const input = await waitFor(() => { const el = g.container.querySelector<HTMLInputElement>('[data-ogrid-cell-editor] input'); expect(!!el).toBe(true); return el!; });
  fireEvent.change(input, { target: { value: 'Closed' } }); fireEvent.keyDown(input, { key: 'Enter' });
  expect(g.doc().sheet('Data')!.rows[1]!.C).toBe('Closed');
  await act(async () => {});
  await g.undo(); await g.undo(); await g.undo();
  expect((await g.saved()).getCell('A2').dataValidation.formulae).toEqual(['Statuses']);
  fireEvent.pointerDown(g.cell(0)); fireEvent.click(screen.getByRole('button', { name: 'Show validation list' }));
  expect(await screen.findByRole('option', { name: 'Closed' })).toBeInTheDocument();
}, 20000);
