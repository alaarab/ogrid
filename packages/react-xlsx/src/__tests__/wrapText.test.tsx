import '@testing-library/jest-dom';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import ExcelJS from 'exceljs';
import { XlsxWorkbookGrid } from '../XlsxWorkbookGrid';
import { cellKey, workbookFromBlob } from '../sheetMapper';
import { XlsxWorkbookDocument } from '../xlsxDocument';

async function wrapWorkbook(): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Notes');
  ws.addRows([
    ['Title', 'Notes'],
    ['First', 'line one\nline two'],
    ['Second', 'plain'],
  ]);
  ws.getCell('B2').alignment = { wrapText: true, vertical: 'top' };
  ws.getRow(2).height = 45;
  return workbookFromBlob(new Blob([await wb.xlsx.writeBuffer()]));
}

async function reload(wb: ExcelJS.Workbook): Promise<ExcelJS.Workbook> {
  return workbookFromBlob(new Blob([await wb.xlsx.writeBuffer()]));
}

// happy-dom has no layout; give elements a size so the virtualized grid renders rows.
const sizes = { clientHeight: 400, offsetHeight: 400, offsetWidth: 800 };
const originals = Object.keys(sizes).map((key) => [key, Object.getOwnPropertyDescriptor(HTMLElement.prototype, key)] as const);
beforeAll(() => {
  for (const [key, value] of Object.entries(sizes)) {
    Object.defineProperty(HTMLElement.prototype, key, { configurable: true, get: () => value });
  }
});
afterAll(() => {
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(HTMLElement.prototype, key, descriptor);
    else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[key];
  }
});

function bodyRow(container: HTMLElement, rowId: number): HTMLElement {
  const tr = container.querySelector<HTMLElement>(`tbody tr[data-row-id="${rowId}"]`);
  if (!tr) throw new Error(`no row ${rowId}`);
  return tr;
}

describe('react-xlsx wrap text and row heights', () => {
  test('sheet row heights render, scaled to the grid row height, and wrapped text keeps its line breaks', async () => {
    const { container } = render(<XlsxWorkbookGrid workbook={await wrapWorkbook()} height={400} />);
    await waitFor(() => expect(bodyRow(container, 0)).toBeInTheDocument());
    // 45pt is three times Excel's 15pt default; compact rows are 28px.
    expect(bodyRow(container, 0).style.height).toBe('84px');
    expect(bodyRow(container, 1).style.height).toBe('');
    const layer = bodyRow(container, 0).querySelector<HTMLElement>('td[data-column-id="B"] span[style]');
    expect(layer?.textContent).toBe('line one\nline two');
    expect(layer?.style.whiteSpace).toBe('pre-wrap');
    expect(layer?.style.alignItems).toBe('flex-start');
  });

  test('row resizes and line breaks are saved on export', async () => {
    const doc = new XlsxWorkbookDocument(await wrapWorkbook());
    doc.setRowHeight('Notes', 1, 30);
    doc.setCellValues('Notes', [{ rowId: 1, columnId: 'B', value: 'a\nb' }]);
    await act(async () => { await Promise.resolve(); });
    const out = await reload(await doc.toWorkbook());
    const ws = out.getWorksheet('Notes') as ExcelJS.Worksheet;
    expect(ws.getRow(3).height).toBe(30);
    expect(ws.getRow(2).height).toBe(45);
    expect(ws.getCell('B3').value).toBe('a\nb');
    expect(ws.getCell('B2').value).toBe('line one\nline two');
  });

  test('a line break typed with Alt+Enter turns on Wrap Text for the cell', async () => {
    let doc: XlsxWorkbookDocument | undefined;
    const { container } = render(
      <XlsxWorkbookGrid workbook={await wrapWorkbook()} height={400} editable onDocument={(d) => { doc = d; }} />,
    );
    await waitFor(() => expect(bodyRow(container, 1)).toBeInTheDocument());
    const cell = bodyRow(container, 1).querySelector('td[data-column-id="A"] [data-row-index]') as HTMLElement;
    fireEvent.pointerDown(cell);
    const grid = container.querySelector('[role="region"]') as HTMLElement;
    grid.focus();
    fireEvent.keyDown(grid, { key: 'F2' });
    const input = await waitFor(() => {
      const el = container.querySelector<HTMLInputElement>('[data-ogrid-cell-editor] input');
      expect(el).toBeInTheDocument();
      return el as HTMLInputElement;
    });
    input.setSelectionRange(input.value.length, input.value.length);
    fireEvent.keyDown(input, { key: 'Enter', altKey: true });
    const area = await waitFor(() => {
      const el = container.querySelector<HTMLTextAreaElement>('[data-ogrid-cell-editor] textarea');
      expect(el).toBeInTheDocument();
      return el as HTMLTextAreaElement;
    });
    fireEvent.change(area, { target: { value: 'Second\nrow' } });
    fireEvent.keyDown(area, { key: 'Enter' });
    if (!doc) throw new Error('document not reported');
    const d = doc;
    await waitFor(() => expect(d.sheet('Notes')?.rows[1]?.A).toBe('Second\nrow'));
    expect(d.sheet('Notes')?.styles.get(cellKey(1, 'A'))?.alignment?.wrapText).toBe(true);
  });
});
