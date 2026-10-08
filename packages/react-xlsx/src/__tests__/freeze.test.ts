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
    const wb = await freezeWorkbook();
    wb.getWorksheet('Sheet').views = [{ state: 'frozen', xSplit: 1, ySplit: 2, topLeftCell: 'B3' }];
    const loaded = await workbookFromBlob(new Blob([await wb.xlsx.writeBuffer()]));
    expect(loaded.getWorksheet('Sheet').views[0]?.state).toBe('frozen');
    const doc = new XlsxWorkbookDocument(loaded);
    doc.setFreeze('Sheet', 0, 0);
    const ws = await reload(await doc.toWorkbook());
    expect((ws.views ?? []).every((v) => v.state !== 'frozen')).toBe(true);
  });

  test('unfreezing a header-only pane clears it even though its grid counts are already zero', async () => {
    const wb = await freezeWorkbook();
    wb.getWorksheet('Sheet').views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
    const doc = new XlsxWorkbookDocument(await workbookFromBlob(new Blob([await wb.xlsx.writeBuffer()])));
    expect(doc.sheet('Sheet')?.frozen).toEqual({ rows: 0, columns: 0 });
    doc.setFreeze('Sheet', 0, 0);
    const ws = await reload(await doc.toWorkbook());
    expect(ws.views.every((v) => v.state !== 'frozen')).toBe(true);
  });

  test.each(['normal', 'frozen'] as const)('freeze and unfreeze retain settings and sibling views from a %s view', async (state) => {
    const wb = await freezeWorkbook();
    const sibling = { state: 'normal' as const, zoomScale: 125, showRowColHeaders: false, activeCell: 'C3' };
    const settings = { zoomScale: 75, zoomScaleNormal: 90, showGridLines: false, showRuler: false, rightToLeft: true, activeCell: 'B4' };
    // The frozen view need not be the first view in the worksheet.
    wb.getWorksheet('Sheet').views = state === 'frozen'
      ? [sibling, { ...settings, state, xSplit: 1, ySplit: 2, topLeftCell: 'B3' }]
      : [{ ...settings, state }, sibling];
    const doc = new XlsxWorkbookDocument(await workbookFromBlob(new Blob([await wb.xlsx.writeBuffer()])));
    const index = state === 'frozen' ? 1 : 0;
    doc.setFreeze('Sheet', 2, 2);
    let ws = await reload(await doc.toWorkbook());
    expect(ws.views).toHaveLength(2);
    expect(ws.views[index]).toMatchObject({ ...settings, state: 'frozen', xSplit: 2, ySplit: 3, topLeftCell: 'C4' });
    expect(ws.views[1 - index]).toMatchObject(sibling);
    doc.setFreeze('Sheet', 0, 0);
    ws = await reload(await doc.toWorkbook());
    expect(ws.views).toHaveLength(2);
    expect(ws.views[index]).toMatchObject({ ...settings, state: 'normal' });
    expect(ws.views[index]?.xSplit).toBeUndefined();
    expect(ws.views[index]?.ySplit).toBeUndefined();
    expect(ws.views[index]?.topLeftCell).toBeUndefined();
    expect(ws.views[1 - index]).toMatchObject(sibling);
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
