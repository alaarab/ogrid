import '@testing-library/jest-dom';
import { describe, expect, spyOn, test } from 'bun:test';
import { act, render, screen, waitFor, fireEvent } from '@testing-library/react';
import ExcelJS from 'exceljs';
import { XlsxWorkbookGrid } from '../XlsxWorkbookGrid';
import { XlsxGrid } from '../XlsxGrid';
import { mount } from '../index';
import { workbookFromBlob } from '../sheetMapper';

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
  test('wide sheets render a viewport of columns', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Wide').addRows([
      Array.from({ length: 150 }, (_, i) => `Column ${i}`),
      Array.from({ length: 150 }, (_, i) => i + 1000),
    ]);
    const parsed = await workbookFromBlob(new Blob([await wb.xlsx.writeBuffer()]));
    const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 600 });
    try {
      const { container, unmount } = render(<XlsxGrid workbook={parsed} sheetName="Wide" height={400} />);
      await waitFor(() => {
        const cells = container.querySelectorAll('tbody td');
        expect(cells.length).toBeGreaterThan(0);
        expect(cells.length).toBeLessThan(150);
      });
      unmount();
    } finally {
      if (descriptor) Object.defineProperty(HTMLElement.prototype, 'clientWidth', descriptor);
      else delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
    }
  });

  test('cross-sheet refs and modern functions calculate while unsupported formulas retain caches', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Calc');
    ws.addRows([
      ['cross', 'quoted', 'modern', 'unsupported', 'missing', 'dependent'],
      [
        { formula: 'Sheet2!A1', result: 999 },
        { formula: "'My Sheet'!A1", result: 999 },
        { formula: '_xlfn.CONCAT("a","b")', result: 'old' },
        { formula: 'UNSUPPORTED(A2)', result: 123 },
        { formula: 'Missing!A1', result: 456 },
        { formula: 'D2+1', result: 999 },
      ],
    ]);
    wb.addWorksheet('Sheet2').addRow([42]);
    wb.addWorksheet('My Sheet').addRow([43]);
    const parsed = await workbookFromBlob(new Blob([await wb.xlsx.writeBuffer()]));
    render(<XlsxGrid workbook={parsed} sheetName="Calc" height={400} />);
    for (const value of ['42', '43', 'ab', '123', '456', '124']) {
      await waitFor(() => expect(screen.getByText(value)).toBeInTheDocument());
    }
    expect(screen.queryByText('#REF!')).not.toBeInTheDocument();
  });

  test('formulas over a promoted header row keep their cached results', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Calc').addRows([
      ['Name', 'Qty', 'Count'],
      ['a', 1, { formula: 'COUNTA(A1:A4)*100', result: 400 }],
      ['b', 2],
      ['c', 3],
    ]);
    const parsed = await workbookFromBlob(new Blob([await wb.xlsx.writeBuffer()]));
    render(<XlsxGrid workbook={parsed} sheetName="Calc" height={400} />);
    await waitFor(() => expect(screen.getByText('400')).toBeInTheDocument());
    expect(screen.queryByText('300')).not.toBeInTheDocument();
  });

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
  test('switching sheets replaces formulas and clears previous formula coordinates', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('One').addRow([1, { formula: 'A1*10', result: 111 }]);
    wb.addWorksheet('Two').addRows([[5], [6, { formula: 'A2*1000', result: 666 }]]);
    const parsed = await workbookFromBlob(new Blob([await wb.xlsx.writeBuffer()]));
    render(<XlsxWorkbookGrid workbook={parsed} headerRow="none" height={400} />);
    await waitFor(() => expect(screen.getByText('10')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('tab', { name: 'Two' }));
    await waitFor(() => expect(screen.getByText('6000')).toBeInTheDocument());
    expect(screen.queryByText('10')).not.toBeInTheDocument();
    expect(screen.queryByText('50')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'One' }));
    await waitFor(() => expect(screen.getByText('10')).toBeInTheDocument());
    expect(screen.queryByText('6000')).not.toBeInTheDocument();
  });

  test('a new workbook with the same sheet name loads its own formulas', async () => {
    const book = async (formula: string) => {
      const wb = new ExcelJS.Workbook();
      wb.addWorksheet('Sheet1').addRow([2, { formula, result: 999 }]);
      return workbookFromBlob(new Blob([await wb.xlsx.writeBuffer()]));
    };
    const { rerender } = render(<XlsxWorkbookGrid workbook={await book('A1*10')} headerRow="none" height={400} />);
    await waitFor(() => expect(screen.getByText('20')).toBeInTheDocument());
    rerender(<XlsxWorkbookGrid workbook={await book('A1*300')} headerRow="none" height={400} />);
    await waitFor(() => expect(screen.getByText('600')).toBeInTheDocument());
    expect(screen.queryByText('20')).not.toBeInTheDocument();
  });

  test('empty workbook and missing source render explicit states', async () => {
    const { rerender } = render(<XlsxWorkbookGrid workbook={new ExcelJS.Workbook()} />);
    await waitFor(() => expect(screen.getByText(/Workbook has no sheets/)).toBeInTheDocument());
    rerender(<XlsxWorkbookGrid blob={undefined as unknown as Blob} />);
    await waitFor(() => expect(screen.getByText(/A workbook or blob is required/)).toBeInTheDocument());
    rerender(<XlsxWorkbookGrid workbook={buildWorkbook()} />);
    await waitFor(() => expect(screen.getByText('99')).toBeInTheDocument());
  });

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

describe('mount', () => {
  test('missing source is rejected before a React root is created', () => {
    const node = document.createElement('div');
    expect(() => mount(node, {})).toThrow('A workbook or blob is required');
  });

  test('immediate remount reuses the pending root and old cleanup cannot erase it', async () => {
    const node = document.createElement('div');
    document.body.appendChild(node);
    let dispose: () => void = () => {};
    const errors = spyOn(console, 'error');
    await act(async () => {
      const oldDispose = mount(node, { workbook: buildWorkbook() });
      oldDispose();
      dispose = mount(node, { workbook: buildWorkbook(), initialSheet: 'Summary' });
      oldDispose();
    });
    await waitFor(() => expect(screen.getByText('orders')).toBeInTheDocument());
    await act(async () => { dispose(); dispose(); });
    expect(node.childElementCount).toBe(0);
    expect(errors.mock.calls.some((args) => String(args[0]).includes('createRoot()'))).toBe(false);
    errors.mockRestore();
    node.remove();
  });
});

describe('XlsxWorkbookGrid sheet tabs keyboard', () => {
  test.each(['workbook', 'streamed Blob'])('arrow/Home/End keys activate %s tabs and label the panel', async (source) => {
    const changes: string[] = [];
    const workbook = buildWorkbook();
    const input = source === 'workbook' ? { workbook } : { blob: new Blob([await workbook.xlsx.writeBuffer()]), streaming: true };
    render(<XlsxWorkbookGrid {...input} height={400} onSheetChange={(n) => changes.push(n)} />);
    if (source === 'streamed Blob') await screen.findByText('2 rows loaded');
    else await screen.findByText('99');
    const orders = screen.getByRole('tab', { name: 'Orders' });
    const summary = screen.getByRole('tab', { name: 'Summary' });
    expect(orders.getAttribute('tabindex')).toBe('0');
    expect(summary.getAttribute('tabindex')).toBe('-1');
    const panel = screen.getByRole('tabpanel');
    expect(orders.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.getAttribute('aria-labelledby')).toBe(orders.id);

    orders.focus();
    fireEvent.keyDown(orders, { key: 'ArrowRight' });
    expect(changes).toEqual(['Summary']);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Summary' })));
    fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowRight' });
    expect(changes).toEqual(['Summary', 'Orders']);
    fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowLeft' });
    fireEvent.keyDown(document.activeElement as Element, { key: 'Home' });
    fireEvent.keyDown(document.activeElement as Element, { key: 'End' });
    expect(changes).toEqual(['Summary', 'Orders', 'Summary', 'Orders', 'Summary']);
    if (source === 'workbook') await screen.findByText('orders');
    expect(document.activeElement).toBe(summary);
    expect(summary).toHaveAttribute('tabindex', '0');
    expect(orders).toHaveAttribute('tabindex', '-1');
    expect(summary).toHaveAttribute('aria-selected', 'true');
    expect(panel).toHaveAttribute('aria-labelledby', summary.id);
  });
});
