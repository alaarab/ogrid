/**
 * Freeze panes recorded on the document are written back as Excel worksheet
 * views (frozen xSplit/ySplit) and round-trip through a real .xlsx.
 */
import { describe, expect, test } from 'bun:test';
import ExcelJS from 'exceljs';
import { workbookFromBlob } from '../sheetMapper';
import { XlsxWorkbookDocument } from '../xlsxDocument';

async function freezeWorkbook(): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet');
  ws.addRows([
    ['A', 'B', 'C'],
    ['a1', 'b1', 'c1'],
    ['a2', 'b2', 'c2'],
    ['a3', 'b3', 'c3'],
  ]);
  return wb;
}

async function reload(wb: ExcelJS.Workbook): Promise<ExcelJS.Worksheet> {
  const parsed = await workbookFromBlob(new Blob([await wb.xlsx.writeBuffer()]));
  return parsed.getWorksheet('Sheet') as ExcelJS.Worksheet;
}

describe('react-xlsx freeze panes export', () => {
  test('setFreeze writes a frozen view with ySplit counting the promoted header', async () => {
    const doc = new XlsxWorkbookDocument(await freezeWorkbook());
    doc.setFreeze('Sheet', 2, 1);
    const ws = await reload(await doc.toWorkbook());
    expect(ws.views[0]).toMatchObject({ state: 'frozen', xSplit: 1, ySplit: 3 });
    expect(ws.views[0]?.topLeftCell).toBe('B4');
  });

  test('freeze top row only sets ySplit and leaves xSplit at the first column', async () => {
    const doc = new XlsxWorkbookDocument(await freezeWorkbook());
    doc.setFreeze('Sheet', 1, 0);
    const ws = await reload(await doc.toWorkbook());
    expect(ws.views[0]).toMatchObject({ state: 'frozen', xSplit: 0, ySplit: 2 });
    expect(ws.views[0]?.topLeftCell).toBe('A3');
  });

  test('unfreezing clears the frozen view', async () => {
    const doc = new XlsxWorkbookDocument(await freezeWorkbook());
    doc.setFreeze('Sheet', 1, 1);
    doc.setFreeze('Sheet', 0, 0);
    const ws = await reload(await doc.toWorkbook());
    expect((ws.views ?? []).every((v) => v.state !== 'frozen')).toBe(true);
  });

  test('an existing frozen view is preserved when the freeze is not changed', async () => {
    const wb = await freezeWorkbook();
    wb.getWorksheet('Sheet').views = [{ state: 'frozen', xSplit: 1, ySplit: 1, topLeftCell: 'B2' }];
    const doc = new XlsxWorkbookDocument(wb);
    const ws = await reload(await doc.toWorkbook());
    expect(ws.views[0]).toMatchObject({ state: 'frozen', xSplit: 1, ySplit: 1 });
  });

  test('the document exposes the source freeze and updates it', async () => {
    const wb = await freezeWorkbook();
    wb.getWorksheet('Sheet').views = [{ state: 'frozen', xSplit: 1, ySplit: 2, topLeftCell: 'B3' }];
    const doc = new XlsxWorkbookDocument(wb);
    // ySplit 2 counts the promoted header, so one data row is frozen.
    expect(doc.sheet('Sheet')?.frozen).toEqual({ rows: 1, columns: 1 });
    doc.setFreeze('Sheet', 0, 0);
    expect(doc.sheet('Sheet')?.frozen).toEqual({ rows: 0, columns: 0 });
  });
});
