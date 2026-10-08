import '@testing-library/jest-dom';
import { expect, test } from 'bun:test';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ExcelJS from 'exceljs';
import { XlsxWorkbookGrid } from '../XlsxWorkbookGrid';
import { XlsxWorkbookDocument } from '../xlsxDocument';
import { workbookFromBlob } from '../sheetMapper';

test('editable XLSX menus persist structure changes, and Undo restores the worksheet', async () => {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet('Data').addRows([['Name', 'Qty'], ['one', 1], ['two', 2]]);
  let doc: XlsxWorkbookDocument | undefined;
  render(<XlsxWorkbookGrid workbook={wb} height={400} editable onDocument={(d) => { doc = d; }} />);
  const menu = async (text: string) => {
    const cell = screen.getByText(text).closest('[data-row-index]');
    if (!cell) throw new Error('Missing data cell');
    fireEvent.pointerDown(cell);
    fireEvent.contextMenu(cell);
    await screen.findByText('Insert row above');
  };
  await screen.findByText('two');
  await menu('two');
  fireEvent.click(screen.getByText('Insert row above'));
  await waitFor(() => expect(doc?.sheet('Data')?.rows).toHaveLength(3));
  await menu('two');
  fireEvent.click(screen.getByText('Insert column left'));
  await waitFor(() => expect(doc?.sheet('Data')?.columns).toHaveLength(3));
  if (!doc) throw new Error('Missing document');
  const out = await workbookFromBlob(await doc.toBlob());
  expect(out.getWorksheet('Data')?.getCell('B4').value).toBe('two');
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
  await waitFor(() => expect(doc?.sheet('Data')?.columns).toHaveLength(2));
  await menu('two');
  fireEvent.click(screen.getByText('Delete row'));
  await waitFor(() => expect(screen.queryByText('two')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
  await screen.findByText('two');
});

test('limits notify the host and show a notice, while read-only XLSX menus omit structural actions', async () => {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet('Data').addRows([['Name', 'Qty'], ['one', 1], ['two', 2]]);
  const notices: unknown[] = [];
  render(<XlsxWorkbookGrid workbook={wb} height={400} limits={{ maxRows: 2 }} onTruncated={(notice) => { notices.push(notice); }} />);
  await screen.findByText('one');
  expect(screen.getByText(/Showing 1 of 3 rows/)).toBeInTheDocument();
  expect(notices).toEqual([{ sheetName: 'Data', loadedRows: 1, loadedColumns: 2, rowCount: 3, columnCount: 2, parseTruncated: false }]);
  const cell = screen.getByText('one').closest('[data-row-index]');
  if (!cell) throw new Error('Missing data cell');
  fireEvent.pointerDown(cell);
  fireEvent.contextMenu(cell);
  await screen.findByText('Copy');
  expect(screen.queryByText('Insert row above')).not.toBeInTheDocument();
  expect(screen.queryByText('Delete column')).not.toBeInTheDocument();
});
