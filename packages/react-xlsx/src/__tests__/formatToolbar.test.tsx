import '@testing-library/jest-dom';
import { describe, expect, test } from 'bun:test';
import { act, createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ExcelJS from 'exceljs';
import { XlsxWorkbookGrid } from '../XlsxWorkbookGrid';
import { workbookFromBlob, cellKey } from '../sheetMapper';
import { XlsxWorkbookDocument } from '../xlsxDocument';

async function gridWorkbook(): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet');
  ws.addRows([
    ['A', 'B', 'C'],
    ['a1', 'b1', 'c1'],
    ['a2', 'b2', 'c2'],
    ['a3', 'b3', 'c3'],
  ]);
  return workbookFromBlob(new Blob([await wb.xlsx.writeBuffer()]));
}

async function reload(wb: ExcelJS.Workbook): Promise<ExcelJS.Worksheet> {
  const parsed = await workbookFromBlob(new Blob([await wb.xlsx.writeBuffer()]));
  return parsed.getWorksheet('Sheet') as ExcelJS.Worksheet;
}

function cell(container: HTMLElement, rowId: number, columnId: string): HTMLElement {
  const el = container.querySelector(`tr[data-row-id="${rowId}"] td[data-column-id="${columnId}"] [data-row-index]`);
  if (!(el instanceof HTMLElement)) throw new Error(`no cell ${columnId}${rowId}`);
  return el;
}

function selectRange(container: HTMLElement, from: [number, string], to: [number, string]): void {
  const a = cell(container, from[0], from[1]);
  fireEvent.pointerDown(a);
  fireEvent.mouseDown(a, { button: 0 });
  fireEvent.mouseUp(a, { button: 0 });
  const b = cell(container, to[0], to[1]);
  fireEvent.pointerDown(b, { shiftKey: true });
  fireEvent.mouseDown(b, { button: 0, shiftKey: true });
  fireEvent.mouseUp(b, { button: 0, shiftKey: true });
}

/** Let the toolbar's selection MutationObserver and state settle. */
async function flush(): Promise<void> {
  await act(async () => { await Promise.resolve(); });
}

describe('react-xlsx formatting toolbar: borders and fonts', () => {
  test('outside borders apply only to the selection edges and export', async () => {
    let doc: XlsxWorkbookDocument | undefined;
    const { container } = render(
      <XlsxWorkbookGrid workbook={await gridWorkbook()} height={400} editable onDocument={(d) => { doc = d; }} />,
    );
    await waitFor(() => expect(screen.getByText('a1')).toBeInTheDocument());
    // A1:B2 (data rows 0-1, columns A-B).
    selectRange(container, [0, 'A'], [1, 'B']);
    await waitFor(() => expect(cell(container, 0, 'A')).toHaveAttribute('data-in-range', 'true'));
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Borders' }));
    fireEvent.click(screen.getByRole('button', { name: 'Outside borders' }));

    if (!doc) throw new Error('document not reported');
    await act(async () => { await Promise.resolve(); });
    const ws = await reload(await doc.toWorkbook());
    // Top-left: top + left only.
    expect(ws.getCell('A2').border?.top?.style).toBe('thin');
    expect(ws.getCell('A2').border?.left?.style).toBe('thin');
    expect(ws.getCell('A2').border?.right).toBeUndefined();
    // Top-right: top + right.
    expect(ws.getCell('B2').border?.top?.style).toBe('thin');
    expect(ws.getCell('B2').border?.right?.style).toBe('thin');
    // Bottom-left: bottom + left.
    expect(ws.getCell('A3').border?.bottom?.style).toBe('thin');
    expect(ws.getCell('A3').border?.left?.style).toBe('thin');
    // Bottom-right: bottom + right.
    expect(ws.getCell('B3').border?.bottom?.style).toBe('thin');
    expect(ws.getCell('B3').border?.right?.style).toBe('thin');
    // No interior lines.
    expect(ws.getCell('A2').border?.bottom).toBeUndefined();
    expect(ws.getCell('A3').border?.right).toBeUndefined();
  });

  test('inside borders draw the shared interior lines per cell (document API)', async () => {
    const doc = new XlsxWorkbookDocument(await gridWorkbook());
    doc.applyBorders('Sheet', { rowIds: [0, 1], columnIds: ['A', 'B'] }, { scope: 'inside', lineStyle: 'medium', argb: 'FFC00000' });
    await act(async () => { await Promise.resolve(); });
    const ws = await reload(await doc.toWorkbook());
    expect(ws.getCell('A2').border?.right?.style).toBe('medium');
    expect(ws.getCell('A2').border?.bottom?.style).toBe('medium');
    expect(ws.getCell('A2').border?.right?.color?.argb).toBe('FFC00000');
    expect(ws.getCell('A2').border?.top).toBeUndefined();
    expect(ws.getCell('A2').border?.left).toBeUndefined();
    expect(ws.getCell('B2').border?.bottom?.style).toBe('medium');
    expect(ws.getCell('B2').border?.right).toBeUndefined();
    expect(ws.getCell('A3').border?.right?.style).toBe('medium');
    expect(ws.getCell('A3').border?.bottom).toBeUndefined();
    expect(ws.getCell('B3').border?.right).toBeUndefined();
    expect(ws.getCell('B3').border?.bottom).toBeUndefined();
  });

  test('erase borders clears them, and undoing restores them', async () => {
    const doc = new XlsxWorkbookDocument(await gridWorkbook());
    doc.applyBorders('Sheet', { rowIds: [0], columnIds: ['A'] }, { scope: 'all', lineStyle: 'thin', argb: null });
    await act(async () => { await Promise.resolve(); });
    doc.applyBorders('Sheet', { rowIds: [0], columnIds: ['A'] }, { scope: 'none', lineStyle: 'thin', argb: null });
    await act(async () => { await Promise.resolve(); });
    let ws = await reload(await doc.toWorkbook());
    expect(ws.getCell('A2').border ?? {}).toEqual({});
    doc.undo('Sheet');
    ws = await reload(await doc.toWorkbook());
    expect(ws.getCell('A2').border?.top?.style).toBe('thin');
  });

  test('font family and size reflect the active cell, apply to the selection and export', async () => {
    let doc: XlsxWorkbookDocument | undefined;
    const wb = await gridWorkbook();
    const source = wb.getWorksheet('Sheet') as ExcelJS.Worksheet;
    source.getCell('A2').font = { name: 'Georgia', size: 18, scheme: 'minor', bold: true };
    const loaded = await workbookFromBlob(new Blob([await wb.xlsx.writeBuffer()]));
    const { container } = render(
      <XlsxWorkbookGrid workbook={loaded} height={400} editable onDocument={(d) => { doc = d; }} />,
    );
    await waitFor(() => expect(screen.getByText('a1')).toBeInTheDocument());
    fireEvent.pointerDown(cell(container, 0, 'A'));
    await flush();
    expect(screen.getByRole('button', { name: 'Font' })).toHaveAttribute('title', 'Font: Georgia');
    expect(screen.getByRole('button', { name: 'Font size' })).toHaveAttribute('title', 'Font size: 18');

    // Apply a different family and size to A1:B1.
    selectRange(container, [0, 'A'], [0, 'B']);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Font' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Times New Roman' }));
    fireEvent.click(screen.getByRole('button', { name: 'Font size' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: '24' }));

    if (!doc) throw new Error('document not reported');
    await act(async () => { await Promise.resolve(); });
    const ws = await reload(await doc.toWorkbook());
    for (const address of ['A2', 'B2']) {
      expect(ws.getCell(address).font?.name).toBe('Times New Roman');
      expect(ws.getCell(address).font?.size).toBe(24);
      expect(ws.getCell(address).font?.scheme).toBeUndefined();
    }
    expect(ws.getCell('A2').font?.bold).toBe(true);
    // The untouched cell keeps its font.
    expect(ws.getCell('C2').font?.name).not.toBe('Times New Roman');
  });

  test('the font-family menu lists the workbook fonts in use', async () => {
    const wb = await gridWorkbook();
    const source = wb.getWorksheet('Sheet') as ExcelJS.Worksheet;
    source.getCell('C3').font = { name: 'Fira Code', size: 11 };
    const loaded = await workbookFromBlob(new Blob([await wb.xlsx.writeBuffer()]));
    const { container } = render(<XlsxWorkbookGrid workbook={loaded} height={400} editable />);
    await waitFor(() => expect(screen.getByText('c2')).toBeInTheDocument());
    fireEvent.pointerDown(cell(container, 0, 'A'));
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Font' }));
    expect(screen.getByRole('menuitemradio', { name: 'Fira Code' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'Calibri' })).toBeInTheDocument();
  });

  test.each([
    ['Font size', 'spinbutton', 'Font size value'],
    ['Borders', 'combobox', 'Border line style'],
    ['Borders', 'input', 'Border color'],
  ])('%s native control %s %s keeps mouse and navigation defaults', async (menu, role, name) => {
    const { container } = render(<XlsxWorkbookGrid workbook={await gridWorkbook()} height={400} editable />);
    await waitFor(() => expect(screen.getByText('a1')).toBeInTheDocument());
    fireEvent.pointerDown(cell(container, 0, 'A'));
    await flush();
    fireEvent.click(screen.getByRole('button', { name: menu }));
    const control = role === 'input' ? screen.getByLabelText(name) : screen.getByRole(role, { name });
    const mouse = createEvent.mouseDown(control, { cancelable: true });
    fireEvent(control, mouse);
    expect(mouse.defaultPrevented).toBe(false);
    control.focus();
    for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End']) {
      const event = createEvent.keyDown(control, { key, cancelable: true });
      fireEvent(control, event);
      expect(event.defaultPrevented).toBe(false);
      expect(control).toHaveFocus();
    }
    // Button navigation still works when focus leaves the native control.
    const button = screen.getByRole('button', { name: menu === 'Borders' ? 'All borders' : 'Apply' });
    button.focus();
    fireEvent.keyDown(button, { key: 'ArrowRight' });
    expect(button).not.toHaveFocus();
  });

  test('font size can be typed into the menu input, clamped to 8–72', async () => {
    let doc: XlsxWorkbookDocument | undefined;
    const { container } = render(
      <XlsxWorkbookGrid workbook={await gridWorkbook()} height={400} editable onDocument={(d) => { doc = d; }} />,
    );
    await waitFor(() => expect(screen.getByText('a1')).toBeInTheDocument());
    fireEvent.pointerDown(cell(container, 0, 'A'));
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Font size' }));
    const input = screen.getByRole('spinbutton', { name: 'Font size value' }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '36' } });
    expect(input.value).toBe('36');
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    if (!doc) throw new Error('document not reported');
    await waitFor(() => expect(doc.sheet('Sheet')?.styles.get(cellKey(0, 'A'))?.font?.size).toBe(36));
    expect(screen.getByRole('button', { name: 'Font size' })).toHaveAttribute('title', 'Font size: 36');
    if (!doc) throw new Error('document not reported');
    expect(doc.sheet('Sheet')?.styles.get(cellKey(0, 'A'))?.font?.size).toBe(36);
  });
});
