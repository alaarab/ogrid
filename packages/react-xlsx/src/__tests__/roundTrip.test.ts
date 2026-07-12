/**
 * Round-trip: build a workbook with ExcelJS, serialize it to a real .xlsx
 * Blob, parse it back with workbookFromBlob, and map it into grid data —
 * the exact path a user's uploaded file takes.
 */
import { describe, expect, test } from 'bun:test';
import ExcelJS from 'exceljs';
import { listSheets, sheetToGridData, workbookFromBlob } from '../sheetMapper';

async function toBlob(wb: ExcelJS.Workbook): Promise<Blob> {
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

describe('xlsx round-trip through serialization', () => {
  test('values, headers, and types survive write → blob → parse → map', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('People');
    ws.addRow(['name', 'age', 'joined']);
    ws.addRow(['Ada', 30, new Date(Date.UTC(2024, 0, 15))]);
    ws.addRow(['Bob', 42, new Date(Date.UTC(2023, 5, 1))]);

    const parsed = await workbookFromBlob(await toBlob(wb));
    const out = sheetToGridData(parsed.getWorksheet('People'));

    expect(out.columns.map((c) => c.name)).toEqual(['name', 'age', 'joined']);
    expect(out.columns.map((c) => c.type)).toEqual(['text', 'numeric', 'date']);
    expect(out.rows.length).toBe(2);
    expect(out.rows[0].A).toBe('Ada');
    expect(out.rows[0].B).toBe(30);
    expect(out.rows[1].A).toBe('Bob');
  });

  test('formulas and cached results survive serialization', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Calc');
    ws.addRow([10, 20, { formula: 'A1+B1', result: 30 }]);
    ws.addRow([3, 4, { formula: 'A2+B2', result: 7 }]);

    const parsed = await workbookFromBlob(await toBlob(wb));
    const out = sheetToGridData(parsed.getWorksheet('Calc'));

    expect(out.initialFormulas).toEqual([
      { col: 2, row: 0, formula: 'A1+B1' },
      { col: 2, row: 1, formula: 'A2+B2' },
    ]);
    expect(out.rows[0].C).toBe(30);
    expect(out.rows[1].C).toBe(7);
  });

  test('multi-sheet workbooks keep every sheet through serialization', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Orders').addRow(['id', 'total']);
    wb.addWorksheet('Summary').addRow(['metric', 'value']);
    wb.getWorksheet('Orders')?.addRow([1, 99]);
    wb.getWorksheet('Summary')?.addRow(['orders', 1]);

    const parsed = await workbookFromBlob(await toBlob(wb));
    expect(listSheets(parsed)).toEqual(['Orders', 'Summary']);
    expect(sheetToGridData(parsed.getWorksheet('Orders')).rows[0].B).toBe(99);
    expect(sheetToGridData(parsed.getWorksheet('Summary')).rows[0].A).toBe('orders');
  });

  test('CSV blob falls back to delimited parsing', async () => {
    const blob = new Blob(['name,age\nAda,30\nBob,42\n'], { type: 'text/csv' });
    const parsed = await workbookFromBlob(blob);
    const out = sheetToGridData(parsed.getWorksheet('Sheet1'));
    expect(out.columns.map((c) => c.name)).toEqual(['name', 'age']);
    expect(out.rows.length).toBe(2);
    expect(out.rows[1].A).toBe('Bob');
  });

  test('TSV blob sniffs the tab delimiter', async () => {
    const blob = new Blob(['x\ty\n1\t2\n'], { type: 'text/tab-separated-values' });
    const parsed = await workbookFromBlob(blob);
    const out = sheetToGridData(parsed.getWorksheet('Sheet1'));
    expect(out.columns.length).toBe(2);
  });
});
