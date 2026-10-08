import { expect, test } from 'bun:test';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ExcelJS from 'exceljs';
import { XlsxWorkbookGrid } from '../XlsxWorkbookGrid';

test('Cancel stops the pending preview and clears its progress indicator', async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Values');
  ws.addRow(['Name', 'Amount']);
  for (let i = 0; i < 1000; i++) ws.addRow(['row-' + i, i]);
  render(<XlsxWorkbookGrid blob={new Blob([await wb.xlsx.writeBuffer()])} streaming streamOptions={{ chunkSize: 8 }} height={400} />);
  const cancel = await screen.findByRole('button', { name: 'Cancel' });
  fireEvent.click(cancel);
  expect(screen.getByText('Workbook loading cancelled.')).toBeInTheDocument();
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
});

test('a streamed file switches to the editable model only after Enable editing', async () => {
  const wb = new ExcelJS.Workbook(); wb.addWorksheet('Values').addRows([['Name', 'Amount'], ['Alice', 12]]);
  const docs: import('../xlsxDocument').XlsxWorkbookDocument[] = [];
  render(<XlsxWorkbookGrid blob={new Blob([await wb.xlsx.writeBuffer()])} streaming editable height={400} onDocument={doc => { docs.push(doc); }} />);
  await screen.findByRole('button', { name: 'Enable editing' });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Enable editing' }).hasAttribute('disabled')).toBe(false));
  expect(docs).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Enable editing' }));
  await waitFor(() => expect(docs).toHaveLength(1));
  expect(screen.getByText('Alice')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Enable editing' })).not.toBeInTheDocument();
});

test('replacing the file during editable preparation discards the old request', async () => {
  const file = async (name: string) => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Values').addRows([['Name', 'Amount'], [name, 12]]);
    return new Blob([await workbook.xlsx.writeBuffer()]);
  };
  const first = await file('Alice');
  const second = await file('Bob');
  const { rerender } = render(<XlsxWorkbookGrid blob={first} streaming editable height={400} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Enable editing' }).hasAttribute('disabled')).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: 'Enable editing' }));
  rerender(<XlsxWorkbookGrid blob={second} streaming editable height={400} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Enable editing' }).hasAttribute('disabled')).toBe(false));
  expect(screen.queryByRole('alert')?.textContent).toBeUndefined();
  fireEvent.click(screen.getByRole('button', { name: 'Enable editing' }));
  await waitFor(() => expect(screen.getByText('Bob')).toBeInTheDocument());
  expect(screen.queryByText('Alice')).not.toBeInTheDocument();
});
