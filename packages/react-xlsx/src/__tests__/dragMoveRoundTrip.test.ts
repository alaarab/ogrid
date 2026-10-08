import { describe, expect, test } from 'bun:test';
import ExcelJS from 'exceljs';
import { moveCellRange } from '@alaarab/ogrid-core';
import { workbookFromBlob } from '../sheetMapper';
import { XlsxWorkbookDocument } from '../xlsxDocument';

// Exercise file serialization after the grid's move path, including formula
// writes that return no value event and a destination clipped by the sheet.
describe('range move XLSX round trip', () => {
  test('a rejected move preserves source formulas and values in the exported file', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Data').addRows([
      ['Value', 'Formula'],
      [10, { formula: 'A2*2', result: 20 }],
      [30, { formula: 'A3*2', result: 60 }],
      [50, 'target'],
    ]);
    const doc = new XlsxWorkbookDocument(await workbookFromBlob(new Blob([await workbook.xlsx.writeBuffer()])));
    const sheet = doc.sheet('Data');
    if (!sheet) throw new Error('missing sheet');
    const columns = sheet.columns.map((c) => ({ ...c, editable: true }));
    const events = moveCellRange({
      items: sheet.rows, visibleCols: columns,
      source: { startRow: 0, startCol: 0, endRow: 1, endCol: 1 }, targetRow: 2, targetCol: 0,
      formulaOptions: {
        colOffset: 0, flatColumns: columns,
        hasFormula: (c, r) => String(sheet.rows[r]?.[columns[c]?.columnId ?? '']).startsWith('='),
        getFormula: (c, r) => sheet.rows[r]?.[columns[c]?.columnId ?? ''] as string | undefined,
        setFormula: (c, r, value) => doc.setCellValues('Data', [{ rowId: sheet.rows[r]!.__rowIdx, columnId: columns[c]!.columnId, value }]),
      },
    });
    doc.setCellValues('Data', events.map((e) => ({ rowId: e.item.__rowIdx, columnId: e.columnId, value: e.newValue })));
    const output = await workbookFromBlob(await doc.toBlob());
    const ws = output.getWorksheet('Data')!;
    expect(ws.getCell('A2').value).toBe(10);
    expect(ws.getCell('B2').value).toMatchObject({ formula: 'A2*2' });
    expect(ws.getCell('A3').value).toBe(30);
    expect(ws.getCell('B3').value).toMatchObject({ formula: 'A3*2' });
    expect(ws.getCell('A4').value).toBe(50);
    expect(ws.getCell('B4').value).toBe('target');
  });
});
