import '@testing-library/jest-dom';
import { describe, expect, test } from 'bun:test';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ExcelJS from 'exceljs';
import { XlsxWorkbookGrid } from '../XlsxWorkbookGrid';
import { XlsxGrid } from '../XlsxGrid';

function buildWorkbook(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const orders = wb.addWorksheet('Orders');
  orders.addRow(['id', 'total']);
  orders.addRow([1, 99]);
  orders.addRow([2, 150]);
  const summary = wb.addWorksheet('Summary');
  summary.addRow(['metric', 'value']);
  summary.addRow(['orders', 2]);
  return wb;
}

describe('XlsxGrid', () => {
  test('renders the named sheet as a grid', async () => {
    render(<XlsxGrid workbook={buildWorkbook()} sheetName="Orders" height={400} />);
    await waitFor(() => expect(screen.getByText('99')).toBeInTheDocument());
  });

  test('shows a message for an unknown sheet name', () => {
    render(<XlsxGrid workbook={buildWorkbook()} sheetName="Nope" height={400} />);
    expect(screen.getByText(/Sheet not found/)).toBeInTheDocument();
  });
});

describe('XlsxWorkbookGrid', () => {
  test('renders a pre-parsed workbook with sheet tabs and switches sheets', async () => {
    render(<XlsxWorkbookGrid workbook={buildWorkbook()} height={400} />);
    // First sheet active by default.
    await waitFor(() => expect(screen.getByText('99')).toBeInTheDocument());
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Orders', 'Summary']);

    fireEvent.click(screen.getByRole('tab', { name: 'Summary' }));
    await waitFor(() => expect(screen.getByText('orders')).toBeInTheDocument());
    expect(screen.getByRole('tab', { name: 'Summary' })).toHaveAttribute('aria-selected', 'true');
  });

  test('parses a blob source lazily and honors initialSheet', async () => {
    const buf = await buildWorkbook().xlsx.writeBuffer();
    const blob = new Blob([buf]);
    render(<XlsxWorkbookGrid blob={blob} initialSheet="Summary" height={400} />);
    await waitFor(() => expect(screen.getByText('orders')).toBeInTheDocument());
    expect(screen.getByRole('tab', { name: 'Summary' })).toHaveAttribute('aria-selected', 'true');
  });

  test('shows an error message for an unparseable source', async () => {
    // A blob that starts with the zip magic bytes but is not a valid zip.
    const blob = new Blob([new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x01])]);
    render(<XlsxWorkbookGrid blob={blob} height={400} />);
    await waitFor(() => expect(screen.getByText(/Could not parse workbook/)).toBeInTheDocument());
  });
});
