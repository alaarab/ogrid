/**
 * Round-trip: build a workbook with ExcelJS, serialize it to a real .xlsx
 * Blob, parse it back with workbookFromBlob, and map it into grid data —
 * the exact path a user's uploaded file takes.
 */
import { describe, expect, test } from 'bun:test';
import ExcelJS from 'exceljs';
import { FormulaEngine } from '@alaarab/ogrid-core/formula';
import { listSheets, sheetToGridData, workbookFromBlob } from '../sheetMapper';

async function toBlob(wb: ExcelJS.Workbook): Promise<Blob> {
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

describe('xlsx round-trip through serialization', () => {
  test('shared formulas expand per cell before header rebasing', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Calc');
    ws.addRows([['x', 'y', 'sum', 'copy'], [1, 2], [3, 4], [5, 6]]);
    ws.getCell('C2').value = { formula: 'A2+$B2+A$2+$B$2', result: 6, shareType: 'shared', ref: 'C2:D4' };
    for (const address of ['D2', 'C3', 'D3', 'C4', 'D4']) {
      ws.getCell(address).value = { sharedFormula: 'C2', result: 10 };
    }
    const parsed = await workbookFromBlob(await toBlob(wb));
    const sheet = parsed.getWorksheet('Calc');
    const raw = sheetToGridData(sheet, { headerRow: 'none' });
    expect(raw.initialFormulas.find((f) => f.col === 3 && f.row === 2)?.formula)
      .toBe('=B3+$B3+B$2+$B$2');
    const out = sheetToGridData(sheet);
    expect(out.initialFormulas.find((f) => f.col === 2 && f.row === 1)?.formula)
      .toBe('=A2+$B2+A$1+$B$1');
    expect(out.initialFormulas.find((f) => f.col === 3 && f.row === 2)?.formula)
      .toBe('=B3+$B3+B$1+$B$1');
  });

  test('shared formulas leave string literals and quoted sheet names untouched', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Calc');
    wb.addWorksheet('FY2024 Budget');
    ws.addRows([['x', 'label', 'budget'], [1], [3]]);
    ws.getCell('B2').value = { formula: 'IF(A2>2,"A1 big","small")', result: 'small', shareType: 'shared', ref: 'B2:B3' };
    ws.getCell('B3').value = { sharedFormula: 'B2', result: 'A1 big' };
    ws.getCell('C2').value = { formula: "'FY2024 Budget'!A2*2", result: 0, shareType: 'shared', ref: 'C2:C3' };
    ws.getCell('C3').value = { sharedFormula: 'C2', result: 0 };
    const parsed = await workbookFromBlob(await toBlob(wb));
    const out = sheetToGridData(parsed.getWorksheet('Calc'), { headerRow: 'none' });
    expect(out.initialFormulas.find((f) => f.col === 1 && f.row === 2)?.formula)
      .toBe('=IF(A3>2,"A1 big","small")');
    expect(out.initialFormulas.find((f) => f.col === 2 && f.row === 2)?.formula)
      .toBe("='FY2024 Budget'!A3*2");
  });

  test('auto and explicit headers rebase relative, absolute and range references', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Calc');
    ws.addRows([['x', 'y', 'sum'], [1, 2], [3, 4]]);
    ws.getCell('C2').value = { formula: 'SUM(A2:B2)+$A$2', result: 4 };
    ws.getCell('C3').value = { formula: 'A3+B3', result: 7 };
    const parsed = await workbookFromBlob(await toBlob(wb));
    for (const headerRow of ['auto', 'header'] as const) {
      const out = sheetToGridData(parsed.getWorksheet('Calc'), { headerRow });
      expect(out.initialFormulas).toEqual([
        { col: 2, row: 0, formula: '=SUM(A1:B1)+$A$1' },
        { col: 2, row: 1, formula: '=A2+B2' },
      ]);
      const engine = new FormulaEngine();
      engine.loadFormulas(out.initialFormulas, {
        getCellValue: (col, row) => out.rows[row]?.[out.columns[col]?.columnId ?? ''],
        getRowCount: () => out.rows.length,
        getColumnCount: () => out.columns.length,
      });
      expect(engine.getValue(2, 0)).toBe(4);
      expect(engine.getValue(2, 1)).toBe(7);
    }
  });

  test('cached formula errors are primitives and missing caches stay undefined', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Calc');
    ws.addRow([
      { formula: '1/0', result: { error: '#DIV/0!' } },
      { formula: '1-1', result: 0 },
      { formula: 'FALSE()', result: false },
      { formula: '42' },
    ]);
    const parsed = await workbookFromBlob(await toBlob(wb));
    const out = sheetToGridData(parsed.worksheets[0], { headerRow: 'none' });
    expect(out.rows[0].A).toBe('#DIV/0!');
    // ExcelJS 4.4 drops falsy cached values while reading XML.
    expect(out.rows[0].B).toBeUndefined();
    expect(out.rows[0].C).toBeUndefined();
    expect(out.rows[0].D).toBeUndefined();
  });

  test('header rebasing preserves literals, function names and qualified ranges', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Calc').addRows([
      ['x', 'header ref', 'range'],
      [100, { formula: '$A$1', result: 'x' }, {
        formula: 'LOG10(A2)+LEN("A2")+SUM(Other!A1:A2)', result: 7,
      }],
    ]);
    wb.addWorksheet('Other').addRows([[1], [2]]);
    const parsed = await workbookFromBlob(await toBlob(wb));
    const out = sheetToGridData(parsed.getWorksheet('Calc'));
    expect(out.initialFormulas[0].formula).toBe('=#REF!');
    expect(out.initialFormulas[1].formula).toBe('=LOG10(A1)+LEN("A2")+SUM(Other!A1:A2)');
  });

  test('ranges starting on the promoted header shrink like an Excel row delete', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Calc').addRows([
      ['Qty', 'Sum'],
      [1, { formula: 'SUM(A1:A3)+SUM($A$1:$A$3)', result: 6 }],
      [2],
    ]);
    const parsed = await workbookFromBlob(await toBlob(wb));
    expect(sheetToGridData(parsed.getWorksheet('Calc')).initialFormulas[0].formula)
      .toBe('=SUM(A1:A2)+SUM($A$1:$A$2)');
  });

  test('prefix normalization leaves string literals and cross-sheet coordinates intact', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Calc');
    wb.addWorksheet('My Sheet').addRow([42]);
    ws.addRow(['value']);
    ws.getCell('A2').value = { formula: '_xlfn.CONCAT("_xlfn.CONCAT(A2)",\'My Sheet\'!A1)', result: '_xlfn.CONCAT(A2)42' };
    const parsed = await workbookFromBlob(await toBlob(wb));
    expect(sheetToGridData(parsed.getWorksheet('Calc')).initialFormulas[0].formula)
      .toBe('=CONCAT("_xlfn.CONCAT(A2)",\'My Sheet\'!A1)');
  });

  test('duplicate headers and column-letter fallbacks have unique names', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Headers').addRows([['Name', 'Name', null, 'C', 'Name (B)'], [1, 2, 3, 4, 5]]);
    const parsed = await workbookFromBlob(await toBlob(wb));
    const names = sheetToGridData(parsed.worksheets[0]).columns.map((c) => c.name);
    expect(new Set(names).size).toBe(5);
    expect(names[0]).toBe('Name');
    expect(names[1]).not.toBe('Name (B)');
  });

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
      { col: 2, row: 0, formula: '=A1+B1' },
      { col: 2, row: 1, formula: '=A2+B2' },
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

  test('CSV preserves stray quotes and recognizes separators outside quoted fields', async () => {
    for (const delimiter of [',', ';', '|', '\t']) {
      const blob = new Blob([`name${delimiter}"size,;|\t"\r\npipe${delimiter}5" long\r\nbolt${delimiter}"he said ""hi""\nthere"\r\nnut${delimiter}4\r\n`]);
      const wb = await workbookFromBlob(blob);
      const out = sheetToGridData(wb.worksheets[0]);
      expect(out.columns).toHaveLength(2);
      expect(out.rows.map((r) => r.B)).toEqual(['5" long', 'he said "hi"\nthere', '4']);
    }
  });
});
