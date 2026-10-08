import { describe, expect, it } from 'bun:test';
import ExcelJS from 'exceljs';
import { XlsxWorkbookDocument } from '../xlsxDocument';
import { readDataValidations, validationSourceResolver } from '../dataValidation';
import type { IDataValidationRule } from '@alaarab/ogrid-core';
import type { SheetRow } from '../sheetMapper';
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
    expect(imported.map((r) => r.type).sort()).toEqual(initial.map((r) => r.type).sort());
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
