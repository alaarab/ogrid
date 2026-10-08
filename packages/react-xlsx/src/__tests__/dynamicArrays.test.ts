import { describe, expect, test } from 'bun:test';
import ExcelJS from 'exceljs';
import { FormulaEngine, FormulaError } from '@alaarab/ogrid-core/formula';
import { XlsxWorkbookDocument } from '../xlsxDocument';
import { sheetToGridData, workbookFromBlob } from '../sheetMapper';
import { workbookFromGridData, xlsxBlobFromWorkbook } from '../exportToXlsx';
import { normalizeFormula, toFileFormula } from '../formulaReferences';
import { act, renderHook } from '@testing-library/react';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { useFormulaEngine } from '../../../react/src/hooks/useFormulaEngine';

async function rereadFile(blob: Blob): Promise<ExcelJS.Workbook> {
  const directory = await mkdtemp(join(tmpdir(), 'ogrid-spill-'));
  try {
    const path = join(directory, 'arrays.xlsx');
    await writeFile(path, new Uint8Array(await blob.arrayBuffer()));
    return await workbookFromBlob(new Blob([await readFile(path)]));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function renderDocument(doc: XlsxWorkbookDocument, name: string) {
  const state = doc.sheet(name)!;
  return renderHook(({ rows, functions }) => useFormulaEngine({
    formulas: true, formulasFromData: true, items: rows, flatColumns: state.columns,
    sheets: doc.sheetAccessors(), formulaFunctions: functions,
    onFormulaRecalc: result => doc.recordFormulaResults(name, result),
  }), { initialProps: { rows: state.rows, functions: {} as Parameters<typeof useFormulaEngine>[0]['formulaFunctions'] } });
}

describe('dynamic arrays in real XLSX files', () => {
  test('hook adoption, edits, undo and rebuilds export current spill metadata even when only the shape changes', async () => {
    const source = new ExcelJS.Workbook();
    const ws = source.addWorksheet('Arrays');
    ws.addRows([['Count', 'Sequence', 'New'], [3], ['', 2], ['', 3]]);
    ws.getCell('B2').value = { formula: '_xlfn.SEQUENCE(A2)', shareType: 'array', ref: 'B2:B4', result: 1 };
    const doc = new XlsxWorkbookDocument(await rereadFile(await xlsxBlobFromWorkbook(source)));
    const hook = renderDocument(doc, 'Arrays');
    const refresh = () => hook.rerender({ rows: doc.sheet('Arrays')!.rows, functions: {} });
    act(() => { doc.setCellValues('Arrays', [{ rowId: 0, columnId: 'A', value: 2 }]); refresh(); });
    let sheet = (await rereadFile(await doc.toBlob())).getWorksheet('Arrays')!;
    expect(sheet.getCell('B2').value).toMatchObject({ ref: 'B2:B3', result: 1 });
    expect(sheet.getCell('B4').value).toBeNull();
    act(() => { doc.undo('Arrays'); refresh(); });
    expect((await rereadFile(await doc.toBlob())).getWorksheet('Arrays')!.getCell('B2').value).toMatchObject({ ref: 'B2:B4' });
    act(() => { doc.setCellValues('Arrays', [{ rowId: 0, columnId: 'C', value: '=SEQUENCE(1)' }]); refresh(); });
    expect((await rereadFile(await doc.toBlob())).getWorksheet('Arrays')!.getCell('C2').value).toMatchObject({ ref: 'C2:C2' });
    act(() => { doc.setCellValues('Arrays', [{ rowId: 0, columnId: 'C', value: '=1' }]); refresh(); });
    sheet = (await rereadFile(await doc.toBlob())).getWorksheet('Arrays')!;
    expect(sheet.getCell('C2').value).toEqual({ formula: '1', result: 1 });
    act(() => { doc.setCellValues('Arrays', [{ rowId: 0, columnId: 'C', value: '=CUSTOM()' }]); refresh(); });
    act(() => hook.rerender({ rows: doc.sheet('Arrays')!.rows, functions: { CUSTOM: { minArgs: 0, maxArgs: 0, evaluate: () => [[7], [8], [9]] } } }));
    expect((await rereadFile(await doc.toBlob())).getWorksheet('Arrays')!.getCell('C4').value).toBe(9);
    act(() => hook.rerender({ rows: doc.sheet('Arrays')!.rows, functions: { CUSTOM: { minArgs: 0, maxArgs: 0, evaluate: () => [[7], [8]] } } }));
    sheet = (await rereadFile(await doc.toBlob())).getWorksheet('Arrays')!;
    expect(sheet.getCell('C2').value).toMatchObject({ ref: 'C2:C3' });
    expect(sheet.getCell('C4').value).toBeNull();
    act(() => hook.rerender({ rows: doc.sheet('Arrays')!.rows, functions: { CUSTOM: { minArgs: 0, maxArgs: 0, evaluate: () => [[7]] } } }));
    expect((await rereadFile(await doc.toBlob())).getWorksheet('Arrays')!.getCell('C2').value).toMatchObject({ ref: 'C2:C2', result: 7 });
    act(() => hook.rerender({ rows: doc.sheet('Arrays')!.rows, functions: { CUSTOM: { minArgs: 0, maxArgs: 0, evaluate: () => 7 } } }));
    sheet = (await rereadFile(await doc.toBlob())).getWorksheet('Arrays')!;
    expect(sheet.getCell('C2').value).toEqual({ formula: 'CUSTOM()', result: 7 });
    expect(sheet.getCell('C3').value).toBeNull();
  });

  test('merged spill targets export SPILL errors without writing through merged masters', async () => {
    const source = new ExcelJS.Workbook();
    const ws = source.addWorksheet('Arrays');
    ws.addRows([['Anchor', 'Merged', 'Child'], [1]]);
    ws.getCell('A2').value = { formula: '_xlfn.SEQUENCE(1,3)', result: 1 };
    ws.mergeCells('B2:C2');
    const doc = new XlsxWorkbookDocument(await rereadFile(await xlsxBlobFromWorkbook(source)));
    const state = doc.sheet('Arrays')!;
    const accessor = {
      getCellValue: (col: number, row: number) => state.rows[row]?.[state.columns[col]?.columnId ?? ''],
      getRowCount: () => state.rows.length, getColumnCount: () => state.columns.length,
      isCellMerged: (col: number, row: number) => row === 0 && col >= 1,
    };
    doc.recordFormulaResults('Arrays', new FormulaEngine().loadFormulas([{ col: 0, row: 0, formula: '=SEQUENCE(1,3)' }], accessor));
    const sheet = (await rereadFile(await doc.toBlob())).getWorksheet('Arrays')!;
    expect(sheet.getCell('A2').value).toMatchObject({ result: { error: '#SPILL!' } });
    expect([sheet.getCell('B2').value, sheet.getCell('C2').value]).toEqual([null, null]);
  });

  test.each([false, true])('reads imported cross-sheet spill caches and preserves unsupported source formulas (opened=%s)', async opened => {
    const source = new ExcelJS.Workbook();
    const arrays = source.addWorksheet('Arrays');
    arrays.addRows([['Sequence'], [1], [2], [3]]);
    arrays.getCell('A2').value = { formula: '_xlfn.UNSUPPORTEDARRAY()', shareType: 'array', ref: 'A2:A4', result: 1 };
    const totals = source.addWorksheet('Totals');
    totals.addRows([['Sum', 'Edit'], [6, 0]]);
    totals.getCell('A2').value = { formula: 'SUM(_xlfn.ANCHORARRAY(Arrays!A2))', result: 6 };
    const doc = new XlsxWorkbookDocument(await rereadFile(await xlsxBlobFromWorkbook(source)));
    if (opened) doc.sheet('Arrays');
    const hook = renderDocument(doc, 'Totals');
    expect(hook.result.current.getFormulaValue(0, 0)).toBe(6);
    act(() => { doc.setCellValues('Totals', [{ rowId: 0, columnId: 'B', value: 10 }]); hook.rerender({ rows: doc.sheet('Totals')!.rows, functions: {} }); });
    const exported = await rereadFile(await doc.toBlob());
    expect(exported.getWorksheet('Totals')!.getCell('A2').value).toMatchObject({ result: 6 });
    expect(exported.getWorksheet('Arrays')!.getCell('A2').value).toMatchObject({ formula: '_xlfn.UNSUPPORTEDARRAY()', ref: 'A2:A4', result: 1 });
  });

  test('exports all spill caches beyond loaded rows and columns, then clears them on shrink', async () => {
    const source = new ExcelJS.Workbook();
    const ws = source.addWorksheet('Arrays');
    ws.addRows([['Count', 'Sequence'], [5], [''], ['']]);
    const doc = new XlsxWorkbookDocument(await rereadFile(await xlsxBlobFromWorkbook(source)));
    const hook = renderDocument(doc, 'Arrays');
    act(() => { doc.setCellValues('Arrays', [{ rowId: 0, columnId: 'B', value: '=SEQUENCE(A1,2)' }]); hook.rerender({ rows: doc.sheet('Arrays')!.rows, functions: {} }); });
    let sheet = (await rereadFile(await doc.toBlob())).getWorksheet('Arrays')!;
    expect([sheet.getCell('B5').value, sheet.getCell('B6').value, sheet.getCell('C6').value]).toEqual([7, 9, 10]);
    expect(sheet.getCell('B2').value).toMatchObject({ ref: 'B2:C6', result: 1 });
    act(() => { doc.setCellValues('Arrays', [{ rowId: 0, columnId: 'A', value: 2 }]); hook.rerender({ rows: doc.sheet('Arrays')!.rows, functions: {} }); });
    sheet = (await rereadFile(await doc.toBlob())).getWorksheet('Arrays')!;
    expect(sheet.getCell('B2').value).toMatchObject({ ref: 'B2:C3' });
    expect([sheet.getCell('B5').value, sheet.getCell('B6').value, sheet.getCell('C6').value]).toEqual([null, null, null]);
  });

  test.each([
    ['=@SEQUENCE(3)', '_xlfn.SINGLE(_xlfn.SEQUENCE(3))'],
    ['=SUM(@(SEQUENCE(3)+1),@ABS(SEQUENCE(2)))', 'SUM(_xlfn.SINGLE((_xlfn.SEQUENCE(3)+1)),_xlfn.SINGLE(ABS(_xlfn.SEQUENCE(2))))'],
    ['=@IF(TRUE,SEQUENCE(3),"@SINGLE(foo)")', '_xlfn.SINGLE(IF(TRUE,_xlfn.SEQUENCE(3),"@SINGLE(foo)"))'],
    ['=@1e+3+@#N/A', '_xlfn.SINGLE(1e+3)+_xlfn.SINGLE(#N/A)'],
  ])('round trips complete implicit-intersection operands in %s', async (formula, fileFormula) => {
    const wb = workbookFromGridData([{ a: 1 }], [{ columnId: 'a', name: 'A' }], row => row.a, { formulas: [{ col: 0, row: 0, formula }] });
    const blob = await xlsxBlobFromWorkbook(wb);
    const sheet = (await rereadFile(blob)).worksheets[0]!;
    expect(sheet.getCell('A2').value).toMatchObject({ formula: fileFormula });
    expect(sheetToGridData(sheet).initialFormulas[0]?.formula).toBe(formula);
  });

  test('imports nested SINGLE function operands as supported implicit intersections', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Intersections');
    ws.addRows([['Value'], [2]]);
    ws.getCell('A2').value = { formula: '_xlfn.SINGLE(_xlfn.SEQUENCE(3)+1)', result: 2 };
    const doc = new XlsxWorkbookDocument(await rereadFile(await xlsxBlobFromWorkbook(wb)));
    expect(doc.sheet('Intersections')!.rows[0]!.A).toBe('=@(SEQUENCE(3)+1)');
    const hook = renderDocument(doc, 'Intersections');
    expect(hook.result.current.getFormulaValue(0, 0)).toBe(2);
    expect((await rereadFile(await doc.toBlob())).getWorksheet('Intersections')!.getCell('A2').value).toMatchObject({ result: 2 });
  });

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

  test('structure redo restores shifted spill caches even after a later recalculation', async () => {
    const source = new ExcelJS.Workbook();
    const ws = source.addWorksheet('Arrays');
    ws.addRows([[10, 10], [null, 11], [null, null]]);
    ws.getCell('B1').value = { formula: '_xlfn.SEQUENCE(2,1,A1)', shareType: 'array', ref: 'B1:B2', result: 10 };
    const doc = new XlsxWorkbookDocument(await workbookFromBlob(await xlsxBlobFromWorkbook(source)), { headerRow: 'none' });
    doc.insertRows('Arrays', 0);
    doc.insertColumns('Arrays', 0);
    doc.setCellValues('Arrays', [{ rowId: 1, columnId: 'B', value: 100 }]);
    await Promise.resolve();
    const state = doc.sheet('Arrays')!;
    const result = new FormulaEngine().loadFormulas(state.source.initialFormulas, {
      getCellValue: (col, row) => state.rows[row]?.[state.columns[col]?.columnId ?? ''],
      getRowCount: () => state.rows.length, getColumnCount: () => state.columns.length,
    });
    doc.recordFormulaResults('Arrays', result);
    expect((await workbookFromBlob(await doc.toBlob())).getWorksheet('Arrays')!.getCell('C3').value).toBe(101);
    doc.undo('Arrays'); // input edit
    doc.undo('Arrays'); // column insert
    doc.redo('Arrays'); // original column insert snapshot
    const out = (await workbookFromBlob(await doc.toBlob())).getWorksheet('Arrays')!;
    expect(out.getCell('C2').value).toMatchObject({ formula: '_xlfn.SEQUENCE(2,1,B2)', ref: 'C2:C3', result: 10 });
    expect(out.getCell('C3').value).toBe(11);
    expect(doc.sheetAccessors().Arrays!.getSpillRange!(2, 1)).toEqual({ anchorCol: 2, anchorRow: 1, endCol: 2, endRow: 2 });
  });
});
