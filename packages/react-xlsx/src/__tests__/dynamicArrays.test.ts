import { describe, expect, test } from 'bun:test';
import ExcelJS from 'exceljs';
import { FormulaEngine, FormulaError } from '@alaarab/ogrid-core/formula';
import { XlsxWorkbookDocument } from '../xlsxDocument';
import { sheetToGridData, workbookFromBlob } from '../sheetMapper';
import { workbookFromGridData, xlsxBlobFromWorkbook } from '../exportToXlsx';
import { normalizeFormula, toFileFormula } from '../formulaReferences';

describe('dynamic arrays in real XLSX files', () => {
  test('imports prefixed array formulas, recalculates without cache collisions, and exports resized refs and caches', async () => {
    const source = new ExcelJS.Workbook();
    const ws = source.addWorksheet('Arrays');
    ws.addRows([['Count', 'Sequence', 'Sum'], [3], ['', 2], ['', 3]]);
    ws.getCell('B2').value = { formula: '_xlfn.SEQUENCE(A2)', shareType: 'array', ref: 'B2:B4', result: 1 };
    ws.getCell('C2').value = { formula: 'SUM(_xlfn.ANCHORARRAY(B2))', result: 6 };
    const imported = await workbookFromBlob(await xlsxBlobFromWorkbook(source));
    const doc = new XlsxWorkbookDocument(imported);
    const state = doc.sheet('Arrays')!;
    expect(state.source.arrayRanges).toEqual([{ anchorCol: 1, anchorRow: 0, endCol: 1, endRow: 2 }]);
    expect(state.rows[1]!.B).toBe('');
    expect(state.rows[2]!.B).toBe('');
    const accessor = {
      getCellValue: (col: number, row: number) => state.rows[row]?.[state.columns[col]?.columnId ?? ''],
      getRowCount: () => state.rows.length,
      getColumnCount: () => state.columns.length,
    };
    const engine = new FormulaEngine();
    doc.recordFormulaResults('Arrays', engine.loadFormulas(state.source.initialFormulas, accessor));
    expect(engine.getValue(1, 2)).toBe(3);
    expect(engine.getValue(2, 0)).toBe(6);
    doc.setCellValues('Arrays', [{ rowId: 0, columnId: 'A', value: 2 }]);
    doc.recordFormulaResults('Arrays', engine.onCellChanged(0, 0, accessor));
    const exported = await workbookFromBlob(await doc.toBlob());
    const sheet = exported.getWorksheet('Arrays')!;
    expect(sheet.getCell('B2').value).toMatchObject({ formula: '_xlfn.SEQUENCE(A2)', shareType: 'array', ref: 'B2:B3', result: 1 });
    expect(sheet.getCell('B3').value).toBe(2);
    expect(sheet.getCell('B4').value).toBeNull();
    expect(sheet.getCell('C2').value).toMatchObject({ formula: 'SUM(_xlfn.ANCHORARRAY(B2))', result: 3 });
    const mapped = sheetToGridData(sheet);
    expect(mapped.initialFormulas.map(f => f.formula)).toEqual(['=SEQUENCE(A1)', '=SUM(B1#)']);
    expect(mapped.arrayRanges?.[0]?.endRow).toBe(1);

    doc.setCellValues('Arrays', [{ rowId: 1, columnId: 'B', value: 'obstruction' }]);
    doc.recordFormulaResults('Arrays', engine.onCellChanged(1, 1, accessor));
    const blocked = (await workbookFromBlob(await doc.toBlob())).getWorksheet('Arrays')!;
    expect(blocked.getCell('B2').value).toEqual({ formula: '_xlfn.SEQUENCE(A2)', result: { error: '#SPILL!' } });
    expect(blocked.getCell('B3').value).toBe('obstruction');
    doc.setCellValues('Arrays', [{ rowId: 1, columnId: 'B', value: '' }]);
    doc.recordFormulaResults('Arrays', engine.onCellChanged(1, 1, accessor));

    doc.setCellValues('Arrays', [{ rowId: 0, columnId: 'B', value: '' }]);
    doc.recordFormulaResults('Arrays', engine.setFormula(1, 0, null, accessor));
    const deleted = (await workbookFromBlob(await doc.toBlob())).getWorksheet('Arrays')!;
    expect(deleted.getCell('B2').value).toBeNull();
    expect(deleted.getCell('B3').value).toBeNull();
  });

  test('grid export writes the array formula once and preserves every cached child value', async () => {
    const rows = [{ b: 10, c: 20 }, { b: 30, c: new FormulaError('#N/A') }];
    const wb = workbookFromGridData(rows, [{ columnId: 'b', name: 'B' }, { columnId: 'c', name: 'C' }], (r, id) => r[id as keyof typeof r], {
      formulas: [{ col: 0, row: 0, formula: '=SEQUENCE(2,2,10,10)' }],
      spillRanges: [{ anchorCol: 0, anchorRow: 0, endCol: 1, endRow: 1 }],
    });
    const sheet = (await workbookFromBlob(await xlsxBlobFromWorkbook(wb))).worksheets[0]!;
    expect(sheet.getCell('A2').value).toMatchObject({ formula: '_xlfn.SEQUENCE(2,2,10,10)', shareType: 'array', ref: 'A2:B3', result: 10 });
    expect([sheet.getCell('B2').value, sheet.getCell('A3').value, sheet.getCell('B3').value]).toEqual([20, 30, { error: '#N/A' }]);
  });

  test('normalizes worksheet prefixes and spill references without touching quoted text', () => {
    expect(normalizeFormula('_xlfn._xlws.FILTER(A1:B3,A1:A3>0)')).toBe('=FILTER(A1:B3,A1:A3>0)');
    expect(toFileFormula('=SUM(A1#)&"B2#"')).toBe('SUM(_xlfn.ANCHORARRAY(A1))&"B2#"');
    expect(normalizeFormula('_xlfn.ANCHORARRAY(\'Other sheet\'!$A$1)')).toBe("='Other sheet'!$A$1#");
    expect(toFileFormula('=@A1:A10&"@B1"')).toBe('_xlfn.SINGLE(A1:A10)&"@B1"');
    expect(normalizeFormula('_xlfn.SINGLE(A1:A10)')).toBe('=@A1:A10');
    expect(toFileFormula("='A1#'!B2+'@C3'!D4")).toBe("'A1#'!B2+'@C3'!D4");
  });
});
