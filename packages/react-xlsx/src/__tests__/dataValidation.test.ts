import { describe, expect, it } from 'bun:test';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { createDataValidator } from '@alaarab/ogrid-core';
import { XlsxWorkbookDocument } from '../xlsxDocument';
import { readDataValidations, validationSourceResolver } from '../dataValidation';
import type { IDataValidationRule } from '@alaarab/ogrid-core';
import { sheetToGridData, workbookFromBlob, type SheetRow } from '../sheetMapper';
import { diskRoundTrip } from './fixtures/xlsxFile';
async function reload(wb: ExcelJS.Workbook): Promise<ExcelJS.Workbook> {
  const out = new ExcelJS.Workbook(); await out.xlsx.load(await wb.xlsx.writeBuffer()); return out;
}
function source() {
  const wb = new ExcelJS.Workbook(), sheet = wb.addWorksheet('Data');
  sheet.addRows([['Whole', 'Decimal', 'Date', 'Time', 'Length', 'List', 'Custom', 'Source'], [2, 0.5, new Date('2026-01-01'), 0.5, 'abc', 'Open', 2, 'Open'], [3, 0.75, new Date('2026-01-02'), 0.6, 'def', 'Closed', 3, 'Closed'], [4, 0.8, new Date('2026-01-03'), 0.7, 'ghi', 'Other', 4, 'Other']]);
  const validations: Record<string, ExcelJS.DataValidation> = {
    A2: { type: 'whole', operator: 'between', formulae: [1, 10], allowBlank: true, showInputMessage: true, promptTitle: 'Count', prompt: '1 to 10', showErrorMessage: true, errorStyle: 'stop', errorTitle: 'Count', error: 'Bad count' },
    B2: { type: 'decimal', operator: 'greaterThan', formulae: [0.1] },
    C2: { type: 'date', operator: 'between', formulae: [new Date('2026-01-01'), new Date('2026-12-31')] },
    D2: { type: 'time', operator: 'lessThanOrEqual', formulae: [0.75] } as unknown as ExcelJS.DataValidation,
    E2: { type: 'textLength', operator: 'notBetween', formulae: [5, 10] },
    F2: { type: 'list', formulae: ['"Open,Closed"'], showErrorMessage: true, errorStyle: 'warning' },
    G2: { type: 'custom', formulae: ['G2<=A2'], showErrorMessage: true, errorStyle: 'information' },
  };
  for (const [cell, rule] of Object.entries(validations)) sheet.getCell(cell).dataValidation = rule;
  sheet.getCell('F3').dataValidation = { type: 'list', formulae: ['$H$2:$H$3'] };
  wb.definedNames.add("'Data'!$H$2:$H$3", 'Statuses');
  sheet.getCell('F4').dataValidation = { type: 'list', formulae: ['Statuses'] };
  return wb;
}
describe('XLSX data validation', () => {
  it('imports every ExcelJS validation type, bounds, messages and per-cell targets from a real file', async () => {
    const wb = await reload(source()), doc = new XlsxWorkbookDocument(wb), state = doc.sheet('Data');
    expect(state?.dataValidations.map((r) => r.type).sort()).toEqual(['custom', 'date', 'decimal', 'list', 'list', 'list', 'textLength', 'time', 'whole']);
    expect(state?.dataValidations.find((r) => r.type === 'whole')).toMatchObject({ columnIds: ['A'], rows: { start: 0, end: 0 }, value: 1, value2: 10, allowBlank: true, inputMessage: { title: 'Count', text: '1 to 10', show: true }, errorAlert: { style: 'stop', title: 'Count', message: 'Bad count', show: true } });
    expect(state?.dataValidations.find((r) => r.type === 'custom')).toMatchObject({ formula: '=G1<=A1' });
    expect(state?.dataValidations.find((r) => r.type === 'date')).toMatchObject({ value: 46023, value2: 46387 });
    expect(state?.columns[5]?.cellEditor).toBeUndefined();
    const resolve = validationSourceResolver(wb.getWorksheet('Data') as ExcelJS.Worksheet, doc.sheetAccessors(), 1);
    expect(resolve('$H$2:$H$3')).toEqual(['Open', 'Closed']); expect(resolve('Statuses')).toEqual(['Open', 'Closed']);
    expect(resolve('OFFSET($H$2,0,0,2,1)')).toEqual(['Open', 'Closed']);
    expect(resolve('OFFSET($H$2,0,0,ROW()-1,1)', { col: 5, row: 0 }, { col: 5, row: 1 })).toEqual(['Open', 'Closed']);
    doc.setCellValues('Data', [{ rowId: 0, columnId: 'H', value: 'New' }]);
    expect(resolve('Statuses')).toEqual(['New', 'Closed']);
    expect(resolve('INDIRECT("H2:H3")')).toEqual(['New', 'Closed']);
  });
  it('exports untouched original rules and every edited type, then imports the saved file', async () => {
    const doc = new XlsxWorkbookDocument(await reload(source()));
    const initial = doc.sheet('Data')?.dataValidations ?? [];
    const out1 = await reload(await doc.toWorkbook());
    expect(out1.getWorksheet('Data')?.getCell('A2').dataValidation).toMatchObject({ type: 'whole', prompt: '1 to 10' });
    const edited = initial.map((r) => ({ ...r, errorAlert: { style: 'stop' as const, title: 'Edited', message: 'Use an allowed value.' } }));
    doc.setDataValidations('Data', edited);
    const out = await reload(await doc.toWorkbook()), ws = out.getWorksheet('Data') as ExcelJS.Worksheet;
    expect(ws.getCell('G2').dataValidation).toMatchObject({ type: 'custom', formulae: ['G2<=A2'], errorTitle: 'Edited' });
    expect(ws.getCell('D2').dataValidation).toMatchObject({ type: 'time', formulae: ['0.75'] });
    const imported = readDataValidations(ws, { headerPromoted: true, rowCount: 3, columnCount: 8 });
    for (const [address, formulae] of Object.entries({ A2: [1, 10], B2: [0.1], C2: [new Date('2026-01-01'), new Date('2026-12-31')], D2: ['0.75'], E2: [5, 10], F2: ['"Open,Closed"'], F3: ['$H$2:$H$3'], F4: ['Statuses'], G2: ['G2<=A2'] })) {
      expect(ws.getCell(address).dataValidation.formulae).toEqual(formulae);
    }
    expect(imported.every((r) => r.errorAlert?.title === 'Edited')).toBe(true);
    expect(imported.find((r) => r.type === 'date')).toMatchObject({ value: 46023, value2: 46387 });
  });
  it('adds, edits, removes and undoes range rules while preserving header and unloaded original validations', async () => {
    const wb = source(), ws = wb.getWorksheet('Data') as ExcelJS.Worksheet;
    ws.getCell('A1').dataValidation = { type: 'whole', operator: 'equal', formulae: [42] };
    ws.getCell('A8').dataValidation = { type: 'list', formulae: ['"Keep"'] };
    const doc = new XlsxWorkbookDocument(await reload(wb), { headerRow: 'header', maxRows: 3 });
    const added: IDataValidationRule<SheetRow>[] = [{ type: 'whole', columnIds: ['A', 'B'], rows: { start: 0, end: 1 }, operator: 'greaterThanOrEqual', value: 5, allowBlank: false, errorAlert: { style: 'warning', message: 'Try five.' } }];
    doc.setDataValidations('Data', added); await Promise.resolve();
    let out = (await reload(await doc.toWorkbook())).getWorksheet('Data') as ExcelJS.Worksheet;
    expect(out.getCell('A2').dataValidation).toMatchObject({ type: 'whole', formulae: [5], errorStyle: 'warning' });
    expect(out.getCell('B3').dataValidation).toMatchObject({ type: 'whole', formulae: [5] });
    expect(out.getCell('F2').dataValidation?.type).toBeUndefined();
    expect(out.getCell('A1').dataValidation).toMatchObject({ formulae: [42] });
    expect(out.getCell('A8').dataValidation).toMatchObject({ type: 'list', formulae: ['"Keep"'] });
    doc.undo('Data'); expect(doc.sheet('Data')?.dataValidations.some((r) => r.type === 'list')).toBe(true);
    doc.redo('Data'); expect(doc.sheet('Data')?.dataValidations).toEqual(added);
    doc.setDataValidations('Data', []); await Promise.resolve();
    out = (await reload(await doc.toWorkbook())).getWorksheet('Data') as ExcelJS.Worksheet;
    expect(out.getCell('A2').dataValidation?.type).toBeUndefined();
    expect(out.getCell('A8').dataValidation?.type).toBe('list');
  });
  it('groups identical contiguous cells without extending per-cell lists to a whole column', async () => {
    const wb = source(), ws = wb.getWorksheet('Data') as ExcelJS.Worksheet;
    ws.getCell('A2').dataValidation = { type: 'whole', operator: 'greaterThan', formulae: [0] };
    ws.getCell('A3').dataValidation = { type: 'whole', operator: 'greaterThan', formulae: [0] };
    const mapped = readDataValidations((await reload(wb)).getWorksheet('Data') as ExcelJS.Worksheet, { headerPromoted: true, rowCount: 3, columnCount: 8 });
    expect(mapped.find((r) => r.type === 'whole')).toMatchObject({ rows: { start: 0, end: 1 }, columnIds: ['A'] });
    expect(mapped.filter((r) => r.type === 'list').map((r) => r.rows)).toEqual([{ start: 0, end: 0 }, { start: 1, end: 1 }, { start: 2, end: 2 }]);
  });
  it('preserves promoted-header references and relative origins when custom rules are edited and exported', async () => {
    const wb = source(), ws = wb.getWorksheet('Data') as ExcelJS.Worksheet;
    ws.getCell('G3').dataValidation = { type: 'custom', formulae: ["AND(G3<=A3,LEN($H$1)>0)"], showErrorMessage: true };
    const doc = new XlsxWorkbookDocument(await reload(wb));
    const initial = doc.sheet('Data')?.dataValidations ?? [];
    expect(initial.find((r) => r.type === 'custom' && r.rows?.start === 1)).toMatchObject({ formula: "=AND(G2<=A2,LEN('Data'!$H$1)>0)" });
    doc.setDataValidations('Data', initial.map((r) => ({ ...r, allowBlank: true })));
    const out = (await reload(await doc.toWorkbook())).getWorksheet('Data') as ExcelJS.Worksheet;
    expect(out.getCell('G3').dataValidation).toMatchObject({ type: 'custom', formulae: ["AND(G3<=A3,LEN('Data'!$H$1)>0)"], allowBlank: true });
  });
  it('exports row predicates as only the currently matching cells', async () => {
    const doc = new XlsxWorkbookDocument(await reload(source()));
    doc.setDataValidations('Data', [{ type: 'list', columnIds: ['F'], values: ['Open', 'Closed'], rowFilter: (row) => row.A === 3 }]);
    const out = (await reload(await doc.toWorkbook())).getWorksheet('Data') as ExcelJS.Worksheet;
    expect(out.getCell('F2').dataValidation?.type).toBeUndefined();
    expect(out.getCell('F3').dataValidation).toMatchObject({ type: 'list', formulae: ['"Open,Closed"'] });
    expect(out.getCell('F4').dataValidation?.type).toBeUndefined();
  });
  it('exports list references relative to the original rule anchor for each column', async () => {
    const doc = new XlsxWorkbookDocument(await reload(source()));
    doc.setDataValidations('Data', [{ type: 'list', columnIds: ['F', 'G'], rows: { start: 1, end: 2 }, source: '=H2:H3', anchor: { columnId: 'F', row: 0 } }]);
    const out = (await reload(await doc.toWorkbook())).getWorksheet('Data') as ExcelJS.Worksheet;
    expect(out.getCell('F3').dataValidation).toMatchObject({ type: 'list', formulae: ['H3:H4'] });
    expect(out.getCell('G3').dataValidation).toMatchObject({ type: 'list', formulae: ['I3:I4'] });
  });
});

async function saved(doc: XlsxWorkbookDocument) {
  const blob = await doc.toBlob();
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const xml = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
  return { xml, workbook: await workbookFromBlob(blob) };
}
describe('validation review regressions', () => {
  it('round-trips an unrestricted input prompt without a type attribute', async () => {
    const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('Data');
    ws.addRows([['Value'], [42]]);
    ws.getCell('A2').dataValidation = { type: 'any', formulae: [], showInputMessage: true, promptTitle: 'Help', prompt: 'Enter any value.' };
    const doc = new XlsxWorkbookDocument(await workbookFromBlob(await diskRoundTrip(new Blob([await wb.xlsx.writeBuffer()]))));
    const blob = await diskRoundTrip(await doc.toBlob());
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
    expect(xml.match(/<dataValidation\b[^>]*>/)?.[0]).not.toContain('type=');
    const again = await workbookFromBlob(blob);
    expect(again.getWorksheet('Data')!.getCell('A2').dataValidation).toMatchObject({ type: 'any', showInputMessage: true, promptTitle: 'Help', prompt: 'Enter any value.' });
    expect(again.getWorksheet('Data')!.getCell('A2').value).toBe(42);
  });
  it('preserves suppressed list dropdowns when other rule settings are edited', async () => {
    const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('Data');
    ws.addRows([['Status'], ['Open']]);
    ws.getCell('A2').dataValidation = { type: 'list', formulae: ['"Open,Closed"'] };
    const zip = await JSZip.loadAsync(await wb.xlsx.writeBuffer()), part = zip.file('xl/worksheets/sheet1.xml')!;
    zip.file('xl/worksheets/sheet1.xml', (await part.async('string')).replace('<dataValidation type="list"', '<dataValidation showDropDown="1" type="list"'));
    const doc = new XlsxWorkbookDocument(await workbookFromBlob(await diskRoundTrip(new Blob([new Uint8Array(await zip.generateAsync({ type: 'uint8array' }))]))));
    expect(doc.sheet('Data')!.dataValidations[0]).toMatchObject({ inCellDropdown: false });
    doc.setDataValidations('Data', doc.sheet('Data')!.dataValidations.map(rule => ({ ...rule, allowBlank: true })));
    const blob = await diskRoundTrip(await doc.toBlob()), out = await workbookFromBlob(blob);
    expect(new XlsxWorkbookDocument(out).sheet('Data')!.dataValidations[0]).toMatchObject({ inCellDropdown: false, allowBlank: true });
    expect(await (await JSZip.loadAsync(await blob.arrayBuffer())).file('xl/worksheets/sheet1.xml')!.async('string')).toContain('showDropDown="1"');
  });
  it('keeps independent relative lists anchored through edits and real XLSX export', async () => {
    const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('Data');
    ws.addRows([['Target', 'Source'], ['first', 'first'], ['', 'middle'], ['first', 'last']]);
    ws.getCell('A2').dataValidation = { type: 'list', formulae: ['B2'] };
    ws.getCell('A4').dataValidation = { type: 'list', formulae: ['B2'] };
    const input = await reload(wb), doc = new XlsxWorkbookDocument(input);
    const state = doc.sheet('Data')!;
    const validator = createDataValidator(state.dataValidations, { items: state.rows, columns: state.columns, resolveSource: validationSourceResolver(input.getWorksheet('Data')!, doc.sheetAccessors(), 1) });
    expect(validator.isValid(state.rows[2]!, 'A', 2, 'first')).toBe(true);
    expect(validator.isValid(state.rows[2]!, 'A', 2, 'last')).toBe(false);
    doc.setDataValidations('Data', state.dataValidations.map(r => ({ ...r, allowBlank: true })));
    const out = await saved(doc);
    expect(out.workbook.getWorksheet('Data')!.getCell('A4').dataValidation.formulae).toEqual(['B2']);
    expect(out.xml).toContain('<formula1>B2</formula1>');
  });
  it('rebases surviving unloaded fragments to their new top-left cell', async () => {
    const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('Data');
    ws.addRows([[1], [2], [3], [4], [5], [6]]);
    for (let row = 2; row <= 6; row++) ws.getCell(`A${row}`).dataValidation = { type: 'custom', formulae: ['A2>0'] };
    const doc = new XlsxWorkbookDocument(await reload(wb), { headerRow: 'none', maxRows: 3 });
    doc.setDataValidations('Data', []);
    const out = await saved(doc);
    expect(out.xml).toContain('<formula1>A4&gt;0</formula1>');
    expect(out.workbook.getWorksheet('Data')!.getCell('A4').dataValidation.formulae).toEqual(['A4>0']);
    expect(out.workbook.getWorksheet('Data')!.getCell('A3').dataValidation?.type).toBeUndefined();
  });
  it.each([['A2 A4', 'B2'], ['A4 A2', 'B4']])('preserves the original %s origin when serializing disjoint validation fragments', async (sqref, formula) => {
    const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('Data');
    ws.addRows([['Target', 'Source'], ['first', 'first'], ['', 'middle'], ['last', 'last']]);
    ws.getCell('A2').dataValidation = { type: 'list', formulae: ['B2'] };
    const zip = await JSZip.loadAsync(await wb.xlsx.writeBuffer());
    const part = zip.file('xl/worksheets/sheet1.xml')!;
    zip.file('xl/worksheets/sheet1.xml', (await part.async('string')).replace('sqref="A2"', `sqref="${sqref}"`).replace('<formula1>B2</formula1>', `<formula1>${formula}</formula1>`));
    const input = await workbookFromBlob(new Blob([new Uint8Array(await zip.generateAsync({ type: 'uint8array' }))]));
    const doc = new XlsxWorkbookDocument(input), state = doc.sheet('Data')!;
    const validator = createDataValidator(state.dataValidations, { items: state.rows, columns: state.columns, resolveSource: validationSourceResolver(input.getWorksheet('Data')!, doc.sheetAccessors(), 1) });
    expect(validator.isValid(state.rows[0]!, 'A', 0, 'first')).toBe(true);
    expect(validator.isValid(state.rows[2]!, 'A', 2, 'last')).toBe(true);
    const out = await saved(doc), sheet = out.workbook.getWorksheet('Data')!;
    expect(sheet.getCell('A2').dataValidation.formulae).toEqual(['B2']);
    expect(sheet.getCell('A4').dataValidation.formulae).toEqual(['B4']);
    expect(validationSourceResolver(sheet, {})('B4')).toEqual(['last']);
  });
  it('serializes formula date bounds verbatim and imports their meaning', async () => {
    const doc = new XlsxWorkbookDocument(await reload(source()));
    doc.setDataValidations('Data', [{ type: 'date', columnIds: ['C'], rows: { start: 0, end: 0 }, operator: 'between', value: '=B1', value2: '2026-12-31' }]);
    const out = await saved(doc);
    expect(out.xml).toContain('<formula1>B2</formula1><formula2>46387</formula2>');
    const rule = new XlsxWorkbookDocument(out.workbook).sheet('Data')!.dataValidations[0];
    expect(rule).toMatchObject({ type: 'date', value: '=B1', value2: 46387 });
  });
  it('exports clock strings as fractions and preserves formula time bounds', async () => {
    const doc = new XlsxWorkbookDocument(await reload(source()));
    doc.setDataValidations('Data', [
      { type: 'time', columnIds: ['D'], rows: { start: 0, end: 0 }, operator: 'between', value: '09:00', value2: '17:00' },
      { type: 'time', columnIds: ['D'], rows: { start: 1, end: 1 }, operator: 'greaterThan', value: '=B2' },
    ]);
    const out = await saved(doc), ws = out.workbook.getWorksheet('Data')!;
    expect(ws.getCell('D2').dataValidation.formulae).toEqual([0.375, 17 / 24]);
    expect(ws.getCell('D3').dataValidation.formulae).toEqual(['B3']);
    expect(out.xml).toContain('<formula1>0.375</formula1>');
  });
  it('round-trips list items containing commas, quotes and long inline lists through a hidden source', async () => {
    const doc = new XlsxWorkbookDocument(await reload(source()));
    const values = ['ACME, Inc.', 'He said "yes"', 'Other', 'x'.repeat(256)];
    doc.setDataValidations('Data', [{ type: 'list', columnIds: ['F'], values }]);
    const out = await saved(doc), ws = out.workbook.getWorksheet('Data')!;
    const sourceRef = String(ws.getCell('F2').dataValidation.formulae[0]);
    expect(sourceRef.startsWith('"')).toBe(false);
    expect(validationSourceResolver(ws, {})(sourceRef)).toEqual(values);
    expect(out.workbook.worksheets.some(sheet => sheet.state === 'veryHidden')).toBe(true);
    const again = await saved(new XlsxWorkbookDocument(out.workbook));
    expect(validationSourceResolver(again.workbook.getWorksheet('Data')!, {})(sourceRef)).toEqual(values);
  });
  it('normalizes 1904 date bounds and exports the original workbook serial', async () => {
    const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('Data'); wb.properties.date1904 = true;
    ws.addRows([['Date'], [new Date('2026-01-01T00:00:00Z')]]);
    ws.getCell('A2').dataValidation = { type: 'date', operator: 'equal', formulae: [new Date((44561 - 25569) * 86400000)] };
    const doc = new XlsxWorkbookDocument(await reload(wb)), state = doc.sheet('Data')!;
    const validator = createDataValidator(state.dataValidations, { items: state.rows, columns: state.columns });
    expect(validator.isValid(state.rows[0]!, 'A', 0, state.rows[0]!.A)).toBe(true);
    expect(state.dataValidations[0]).toMatchObject({ value: 46023 });
    doc.setDataValidations('Data', state.dataValidations.map(r => ({ ...r, allowBlank: true })));
    const out = await saved(doc);
    expect(out.xml).toContain('<formula1>44561</formula1>');
    expect(out.workbook.properties.date1904).toBe(true);
    const next = new XlsxWorkbookDocument(out.workbook).sheet('Data')!;
    expect(createDataValidator(next.dataValidations, { items: next.rows, columns: next.columns }).isValid(next.rows[0]!, 'A', 0, next.rows[0]!.A)).toBe(true);
  });
  it('shifts edited validation ranges and formulas with XLSX structure edits and undo', async () => {
    const doc = new XlsxWorkbookDocument(await reload(source()));
    doc.setDataValidations('Data', [{ type: 'custom', columnIds: ['A'], rows: { start: 0, end: 2 }, formula: '=A1>0' }]);
    await Promise.resolve();
    doc.insertColumns('Data', 0); doc.insertRows('Data', 0);
    expect(doc.sheet('Data')!.dataValidations).toEqual([expect.objectContaining({ columnIds: ['B'], rows: { start: 1, end: 3 }, formula: '=B2>0' })]);
    let out = await saved(doc);
    expect(out.workbook.getWorksheet('Data')!.getCell('B3').dataValidation.formulae).toEqual(['B3>0']);
    doc.undo('Data'); doc.undo('Data');
    out = await saved(doc);
    expect(out.workbook.getWorksheet('Data')!.getCell('A2').dataValidation.formulae).toEqual(['A2>0']);
  });
  it('keeps legacy mapper dropdowns and exposes per-cell validation rules', async () => {
    const original = source(), sheet = original.getWorksheet('Data')!;
    for (let row = 2; row <= 4; row++) {
      sheet.getCell(`F${row}`).value = null;
      sheet.getCell(`F${row}`).dataValidation = { type: 'list', formulae: ['"Open,Closed"'] };
    }
    const ws = (await reload(original)).getWorksheet('Data')!, data = sheetToGridData(ws);
    expect(data.columns[5]).toMatchObject({ cellEditor: 'select', cellEditorParams: { values: ['Open', 'Closed'] } });
    expect(data.formatting.listValidations.F).toEqual(['Open', 'Closed']);
    expect(data.dataValidations).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'list', columnIds: ['F'], rows: { start: 0, end: 2 }, values: ['Open', 'Closed'] })]));
  });
});
