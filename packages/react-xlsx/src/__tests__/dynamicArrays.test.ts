import { describe, expect, test } from 'bun:test';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { dynamicArrayFixture } from './fixtures/dynamicArrayWorkbook';
import { children, descendants, parseXml } from '../xmlParts';
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

async function fileBytes(blob: Blob): Promise<Uint8Array> {
  const directory = await mkdtemp(join(tmpdir(), 'ogrid-spill-'));
  try {
    const path = join(directory, 'arrays.xlsx');
    await writeFile(path, new Uint8Array(await blob.arrayBuffer()));
    return new Uint8Array(await readFile(path));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function rereadFile(blob: Blob): Promise<ExcelJS.Workbook> {
  return workbookFromBlob(new Blob([await fileBytes(blob)]));
}

async function dynamicIdentity(blob: Blob, address: string, sheet = 'sheet1.xml') {
  const zip = await JSZip.loadAsync(await fileBytes(blob));
  const xml = parseXml(await zip.file(`xl/worksheets/${sheet}`)!.async('string'));
  const anchor = descendants(xml, 'c').find(c => c.attrs.r === address)!;
  const metadata = zip.file('xl/metadata.xml');
  expect(metadata).not.toBeNull();
  const meta = parseXml(await metadata!.async('string'));
  const types = children(children(meta, 'metadataTypes')[0]!, 'metadataType');
  const record = children(children(meta, 'cellMetadata')[0]!, 'bk')[Number(anchor.attrs.cm) - 1];
  expect(record).toBeDefined();
  const rc = children(record!, 'rc')[0]!;
  expect(types[Number(rc.attrs.t) - 1]?.attrs.name).toBe('XLDAPR');
  const future = children(meta, 'futureMetadata').find(f => f.attrs.name === 'XLDAPR')!;
  const block = children(future, 'bk')[Number(rc.attrs.v)]!;
  expect(descendants(block, 'dynamicArrayProperties')[0]?.attrs).toMatchObject({ fDynamic: '1', fCollapsed: '0' });
  const relationships = parseXml(await zip.file('xl/_rels/workbook.xml.rels')!.async('string'));
  expect(children(relationships).some(r => r.attrs.Type?.endsWith('/sheetMetadata') && r.attrs.Target === 'metadata.xml')).toBe(true);
  const contentTypes = parseXml(await zip.file('[Content_Types].xml')!.async('string'));
  expect(children(contentTypes).some(t => t.attrs.PartName === '/xl/metadata.xml' && t.attrs.ContentType?.endsWith('sheetMetadata+xml'))).toBe(true);
  return { anchor, meta, zip };
}

function renderDocument(doc: XlsxWorkbookDocument, name: string) {
  const state = doc.sheet(name)!;
  return renderHook(({ rows, functions }) => useFormulaEngine({
    formulas: true, formulasFromData: true, items: rows, flatColumns: state.columns,
    sheets: doc.sheetAccessors(), formulaFunctions: functions,
    formulaDataAccessor: doc.formulaDataAccessor(name),
    onFormulaRecalc: result => doc.recordFormulaResults(name, result),
  }), { initialProps: { rows: state.rows, functions: {} as Parameters<typeof useFormulaEngine>[0]['formulaFunctions'] } });
}

describe('dynamic arrays in real XLSX files', () => {
  test.each(['row', 'column'].flatMap(axis => ['text', 'formula', 'merge'].map(kind => ({ axis, kind }))))('blocks spills on unloaded %j cells without damaging the source', async ({ axis, kind }) => {
    const source = new ExcelJS.Workbook();
    const ws = source.addWorksheet('Arrays');
    ws.getCell('A1').value = 5;
    ws.getCell('B1').value = { formula: axis === 'row' ? '_xlfn.SEQUENCE(A1)' : '_xlfn.SEQUENCE(1,A1)', result: 1 };
    const obstruction = axis === 'row' ? 'B5' : 'F1';
    if (kind === 'text') ws.getCell(obstruction).value = 'secret';
    if (kind === 'formula') ws.getCell(obstruction).value = { formula: '1-1', result: 0 };
    if (kind === 'merge') ws.mergeCells(axis === 'row' ? 'B5:C5' : 'F1:G1');
    const doc = new XlsxWorkbookDocument(await rereadFile(await xlsxBlobFromWorkbook(source)), {
      headerRow: 'none', ...(axis === 'row' ? { maxRows: 2 } : { maxCols: 2 }),
    });
    const hook = renderDocument(doc, 'Arrays');
    const exported = (await rereadFile(await doc.toBlob())).getWorksheet('Arrays')!;
    expect(exported.getCell('B1').value).toMatchObject({ result: { error: '#SPILL!' } });
    if (kind === 'text') expect(exported.getCell(obstruction).value).toBe('secret');
    if (kind === 'formula') expect(exported.getCell(obstruction).value).toMatchObject({ formula: '1-1' });
    if (kind === 'merge') expect(exported.getCell(obstruction).isMerged).toBe(true);
    hook.unmount();
  });

  test.each(['scalar', 'spill'])('clearing a %s formula exports immediately and undo/redo restores caches without a hook', async kind => {
    const source = new ExcelJS.Workbook();
    const ws = source.addWorksheet('Arrays');
    ws.getCell('A1').value = kind === 'scalar' ? { formula: '1+1', result: 2 }
      : { formula: '_xlfn.SEQUENCE(3)', shareType: 'array', ref: 'A1:A3', result: 1 };
    if (kind === 'spill') { ws.getCell('A2').value = 2; ws.getCell('A3').value = 3; }
    const doc = new XlsxWorkbookDocument(await rereadFile(await xlsxBlobFromWorkbook(source)), { headerRow: 'none' });
    doc.setCellValues('Arrays', [{ rowId: 0, columnId: 'A', value: '' }]);
    const values = async () => (await rereadFile(await doc.toBlob())).getWorksheet('Arrays')!;
    let out = await values();
    expect([null, '']).toContain(out.getCell('A1').value);
    if (kind === 'spill') expect([out.getCell('A2').value, out.getCell('A3').value]).toEqual([null, null]);
    doc.undo('Arrays');
    out = await values();
    expect(out.getCell('A1').value).toMatchObject({ result: kind === 'scalar' ? 2 : 1 });
    if (kind === 'spill') expect(out.getCell('A3').value).toBe(3);
    doc.redo('Arrays');
    expect([null, '']).toContain((await values()).getCell('A1').value);
  });

  test('preserves real dynamic-array metadata without edits and updates it on resize, structure edits and deletion', async () => {
    const doc = new XlsxWorkbookDocument(await rereadFile(await dynamicArrayFixture()), { headerRow: 'none' });
    let identity = await dynamicIdentity(await doc.toBlob(), 'B1');
    expect(identity.anchor.attrs.cm).toBe('2'); // retain the original index, not a generated replacement
    expect(descendants(identity.meta, 'metadataType').some(t => t.attrs.name === 'OTHER')).toBe(true);
    const hook = renderDocument(doc, 'Arrays');
    act(() => { doc.setCellValues('Arrays', [{ rowId: 0, columnId: 'A', value: 2 }]); hook.rerender({ rows: doc.sheet('Arrays')!.rows, functions: {} }); });
    identity = await dynamicIdentity(await doc.toBlob(), 'B1');
    expect(children(identity.anchor, 'f')[0]?.attrs.ref).toBe('B1:B2');
    hook.unmount();
    doc.insertRows('Arrays', 0);
    doc.insertColumns('Arrays', 0);
    identity = await dynamicIdentity(await doc.toBlob(), 'C2');
    expect(children(identity.anchor, 'f')[0]?.attrs.ref).toBe('C2:C3');
    doc.setCellValues('Arrays', [{ rowId: 1, columnId: 'C', value: '' }]);
    const blob = await doc.toBlob();
    const zip = await JSZip.loadAsync(await fileBytes(blob));
    const sheet = parseXml(await zip.file('xl/worksheets/sheet1.xml')!.async('string'));
    expect(descendants(sheet, 'c').find(c => c.attrs.r === 'C2')?.attrs.cm).toBeUndefined();
    doc.undo('Arrays');
    await dynamicIdentity(await doc.toBlob(), 'C2');
  });

  test('new document spills and grid-export spills emit dynamic identity while legacy arrays remain legacy', async () => {
    const source = new ExcelJS.Workbook();
    const ws = source.addWorksheet('Arrays');
    ws.addRows([[3, '', ''], [null, '', ''], [null, '', '']]);
    ws.getCell('C1').value = { formula: 'A1:A3', shareType: 'array', ref: 'C1:C3', result: 3 };
    const doc = new XlsxWorkbookDocument(await rereadFile(await xlsxBlobFromWorkbook(source)), { headerRow: 'none' });
    const hook = renderDocument(doc, 'Arrays');
    act(() => { doc.setCellValues('Arrays', [{ rowId: 0, columnId: 'B', value: '=SEQUENCE(A1)' }]); hook.rerender({ rows: doc.sheet('Arrays')!.rows, functions: {} }); });
    const identity = await dynamicIdentity(await doc.toBlob(), 'B1');
    expect(descendants(parseXml(await identity.zip.file('xl/worksheets/sheet1.xml')!.async('string')), 'c').find(c => c.attrs.r === 'C1')?.attrs.cm).toBeUndefined();
    const grid = workbookFromGridData([{ n: 1 }, { n: 2 }], [{ columnId: 'n', name: 'Sequence' }], row => row.n, {
      formulas: [{ col: 0, row: 0, formula: '=SEQUENCE(2)' }],
      spillRanges: [{ anchorCol: 0, anchorRow: 0, endCol: 0, endRow: 1 }],
    });
    await dynamicIdentity(await xlsxBlobFromWorkbook(grid), 'A2');
    hook.unmount();
  });

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
