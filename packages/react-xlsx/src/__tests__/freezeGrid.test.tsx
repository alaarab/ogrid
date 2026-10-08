import { describe, expect, test } from 'bun:test';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ExcelJS from 'exceljs';
import { XlsxGrid } from '../XlsxGrid';
import { workbookFromBlob } from '../sheetMapper';
import { XlsxWorkbookDocument } from '../xlsxDocument';

async function load(workbook: ExcelJS.Workbook): Promise<ExcelJS.Workbook> {
  return workbookFromBlob(new Blob([await workbook.xlsx.writeBuffer()]));
}

async function renderSheet(xSplit: number, hiddenColumn?: number) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sheet');
  sheet.addRows([['A', 'B', 'C'], ['a1', 'b1', 'c1'], ['a2', 'b2', 'c2']]);
  if (xSplit > 0) sheet.views = [{ state: 'frozen', xSplit, ySplit: 1 }];
  if (hiddenColumn) sheet.getColumn(hiddenColumn).hidden = true;
  const loaded = await load(workbook);
  const document = new XlsxWorkbookDocument(loaded);
  const result = render(<XlsxGrid workbook={loaded} sheetName="Sheet" document={document} height={400} editable />);
  await waitFor(() => expect(screen.getByText('c1')).toBeInTheDocument());
  const cell = (id: string) => result.container.querySelector<HTMLElement>(`tbody td[data-column-id="${id}"]`)!;
  const command = async (label: string) => {
    const target = cell('C').querySelector<HTMLElement>('[data-row-index]')!;
    fireEvent.pointerDown(target);
    fireEvent.mouseDown(target, { button: 0 });
    fireEvent.mouseUp(target, { button: 0 });
    fireEvent.contextMenu(target, { clientX: 100, clientY: 100 });
    await waitFor(() => expect(screen.getByText(label)).toBeInTheDocument());
    fireEvent.click(screen.getByText(label));
  };
  return { ...result, document, cell, command };
}

describe('react-xlsx frozen columns in the grid', () => {
  test.each([
    [1, 'Unfreeze panes', 0],
    [2, 'Freeze first column', 1],
  ])('imported boundary %i can be changed with %s', async (boundary, label, remaining) => {
    const { document, cell, command } = await renderSheet(boundary);
    expect(cell('A').style.left).not.toBe('');
    if (boundary === 2) expect(cell('B').style.left).not.toBe('');
    await command(label);
    expect(document.sheet('Sheet')?.frozen.columns).toBe(remaining);
    expect(cell('A').style.left === '').toBe(remaining === 0);
    expect(cell('B').style.left).toBe('');
    const output = (await load(await document.toWorkbook())).getWorksheet('Sheet')!;
    if (remaining === 0) expect(output.views.every((view) => view.state !== 'frozen')).toBe(true);
    else expect(output.views[0]?.xSplit).toBe(remaining);
  });

  test('freezing the first visible column with A hidden exports a boundary after B', async () => {
    const { document, cell, command } = await renderSheet(0, 1);
    expect(cell('A')).toBeNull();
    await command('Freeze first column');
    expect(document.sheet('Sheet')?.frozen.columns).toBe(1);
    expect(cell('B').style.left).not.toBe('');
    expect(cell('C').style.left).toBe('');
    const output = (await load(await document.toWorkbook())).getWorksheet('Sheet')!;
    expect(output.getColumn(1).hidden).toBe(true);
    expect(output.views[0]).toMatchObject({ state: 'frozen', xSplit: 2, topLeftCell: 'C2' });
    const reopened = new XlsxWorkbookDocument(output.workbook);
    expect(reopened.sheet('Sheet')?.frozen.columns).toBe(1);
  });

  test('importing a physical boundary at hidden B freezes A without freezing visible C', async () => {
    const { document, cell, command } = await renderSheet(2, 2);
    expect(document.sheet('Sheet')?.frozen.columns).toBe(1);
    expect(cell('A').style.left).not.toBe('');
    expect(cell('B')).toBeNull();
    expect(cell('C').style.left).toBe('');
    const unchanged = (await load(await document.toWorkbook())).getWorksheet('Sheet')!;
    expect(unchanged.views[0]?.xSplit).toBe(2);
    await command('Unfreeze panes');
    expect(cell('A').style.left).toBe('');
    const output = (await load(await document.toWorkbook())).getWorksheet('Sheet')!;
    expect(output.views.every((view) => view.state !== 'frozen')).toBe(true);
  });
});
