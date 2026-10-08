import '@testing-library/jest-dom';
import { describe, expect, test } from 'bun:test';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ExcelJS from 'exceljs';
import { XlsxWorkbookGrid } from '../XlsxWorkbookGrid';
import { workbookFromBlob } from '../sheetMapper';
import type { XlsxWorkbookDocument } from '../xlsxDocument';

async function styledWorkbook(): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sales');
  ws.addRows([
    ['Item', 'Price', 'Share', 'Status'],
    ['Apples', 1234.5, 0.125, 'Open'],
    ['Pears', -20, 0.5, 'Closed'],
  ]);
  ws.getCell('A2').font = { bold: true, color: { argb: 'FFC00000' } };
  ws.getCell('A3').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
  ws.getCell('B2').numFmt = '"$"#,##0.00';
  ws.getCell('B3').numFmt = '"$"#,##0.00;[Red]("$"#,##0.00)';
  ws.getCell('C2').numFmt = '0.00%';
  wb.addWorksheet('Other', { properties: { tabColor: { argb: 'FF00B050' } } }).addRow(['x']);
  return workbookFromBlob(new Blob([await wb.xlsx.writeBuffer()]));
}

function cellOf(text: string): HTMLElement {
  const cell = screen.getByText(text).closest('[data-row-index]');
  if (!(cell instanceof HTMLElement)) throw new Error(`no grid cell for ${text}`);
  return cell;
}

function pickNumberFormat(label: string): void {
  fireEvent.click(screen.getByRole('button', { name: 'Number format' }));
  fireEvent.click(screen.getByRole('menuitemradio', { name: label }));
}

describe('XlsxWorkbookGrid formatting', () => {
  test('renders number formats and cell styles from the file', async () => {
    render(<XlsxWorkbookGrid workbook={await styledWorkbook()} height={400} />);
    await waitFor(() => expect(screen.getByText('$1,234.50')).toBeInTheDocument());
    expect(screen.getByText('12.50%')).toBeInTheDocument();
    const negative = screen.getByText('($20.00)');
    expect(negative).toHaveStyle({ color: '#FF0000' });
    expect(screen.getByText('Apples')).toHaveStyle({ fontWeight: '700', color: '#C00000' });
    expect(screen.getByText('Pears')).toHaveStyle({ background: '#FFFF00' });
    // Read-only by default: no toolbar.
    expect(screen.queryByRole('toolbar', { name: 'Cell formatting' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Other' }).style.boxShadow).toContain('#00B050');
  });

  test('toolbar formats the selected range and the change is undoable and exported', async () => {
    let doc: XlsxWorkbookDocument | undefined;
    render(<XlsxWorkbookGrid workbook={await styledWorkbook()} height={400} editable onDocument={(d) => { doc = d; }} />);
    await waitFor(() => expect(screen.getByText('Pears')).toBeInTheDocument());

    fireEvent.pointerDown(cellOf('Pears'));
    await waitFor(() => expect(cellOf('Pears')).toHaveAttribute('data-active-cell', 'true'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Italic' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Italic' }));
    await waitFor(() => expect(screen.getByText('Pears')).toHaveStyle({ fontStyle: 'italic' }));

    pickNumberFormat('Currency');
    fireEvent.pointerDown(cellOf('0.5'));
    await waitFor(() => expect(cellOf('0.5')).toHaveAttribute('data-active-cell', 'true'));
    pickNumberFormat('Percent');
    await waitFor(() => expect(screen.getByText('50.00%')).toBeInTheDocument());

    if (!doc) throw new Error('document not reported');
    const out = await doc.toWorkbook();
    const ws = out.getWorksheet('Sales') as ExcelJS.Worksheet;
    expect(ws.getCell('A3').font?.italic).toBe(true);
    expect(ws.getCell('A3').fill).toMatchObject({ fgColor: { argb: 'FFFFFF00' } });
    expect(ws.getCell('C3').numFmt).toBe('0.00%');

    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(screen.getByText('0.5')).toBeInTheDocument());
  });

  test('toolbar reflects the active cell and applies palette colors', async () => {
    let doc: XlsxWorkbookDocument | undefined;
    render(<XlsxWorkbookGrid workbook={await styledWorkbook()} height={400} editable onDocument={(d) => { doc = d; }} />);
    await waitFor(() => expect(screen.getByText('Apples')).toBeInTheDocument());
    // Nothing selected yet: formatting is disabled.
    expect(screen.getByRole('button', { name: 'Bold' })).toBeDisabled();

    fireEvent.pointerDown(cellOf('Apples'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true'));
    expect(screen.getByRole('button', { name: 'Italic' })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Fill color' }));
    fireEvent.click(screen.getByRole('button', { name: 'Light green' }));
    await waitFor(() => expect(screen.getByText('Apples')).toHaveStyle({ background: '#92D050' }));
    expect(screen.queryByRole('dialog', { name: 'Fill color' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Fill color' }));
    expect(screen.getByRole('button', { name: 'Light green' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'No fill' }));

    if (!doc) throw new Error('document not reported');
    await act(async () => { await Promise.resolve(); });
    const ws = (await doc.toWorkbook()).getWorksheet('Sales') as ExcelJS.Worksheet;
    expect(ws.getCell('A2').fill?.type ?? 'none').not.toBe('pattern');
    expect(ws.getCell('A2').font?.bold).toBe(true);
  });

  test('editing a cell updates the document and the export', async () => {
    let doc: XlsxWorkbookDocument | undefined;
    render(<XlsxWorkbookGrid workbook={await styledWorkbook()} height={400} editable onDocument={(d) => { doc = d; }} />);
    await waitFor(() => expect(screen.getByText('Open')).toBeInTheDocument());
    const cell = cellOf('Open');
    const td = cell.closest('td') as HTMLElement;
    fireEvent.pointerDown(cell);
    fireEvent.doubleClick(cell);
    const input = await waitFor(() => {
      const el = td.querySelector('input');
      if (!el) throw new Error('editor not open');
      return el as HTMLInputElement;
    });
    fireEvent.change(input, { target: { value: 'Done' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(screen.getByText('Done')).toBeInTheDocument());
    if (!doc) throw new Error('document not reported');
    const ws = (await doc.toWorkbook()).getWorksheet('Sales') as ExcelJS.Worksheet;
    expect(ws.getCell('D2').value).toBe('Done');
    expect(ws.getCell('B2').numFmt).toBe('"$"#,##0.00');
  });

  test('a formula typed into a cell evaluates and exports in sheet coordinates', async () => {
    let doc: XlsxWorkbookDocument | undefined;
    render(<XlsxWorkbookGrid workbook={await styledWorkbook()} height={400} editable onDocument={(d) => { doc = d; }} />);
    await waitFor(() => expect(screen.getByText('Closed')).toBeInTheDocument());
    const cell = cellOf('Closed');
    const td = cell.closest('td') as HTMLElement;
    fireEvent.pointerDown(cell);
    fireEvent.doubleClick(cell);
    const input = await waitFor(() => {
      const el = td.querySelector('input');
      if (!el) throw new Error('editor not open');
      return el as HTMLInputElement;
    });
    // Grid references count rows under the promoted header: B1 is sheet cell B2.
    fireEvent.change(input, { target: { value: '=B1*2' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(screen.getByText('2469')).toBeInTheDocument());
    if (!doc) throw new Error('document not reported');
    const ws = (await doc.toWorkbook()).getWorksheet('Sales') as ExcelJS.Worksheet;
    expect(ws.getCell('D3').formula).toBe('B2*2');
    expect(ws.getCell('D3').result).toBe(2469);
  });
});
