/**
 * Excel conditional formats → OGrid rules, through a real .xlsx round trip
 * (ExcelJS writes, then parses, the file), plus export pass-through.
 */
import { describe, expect, test } from 'bun:test';
import ExcelJS from 'exceljs';
import { createConditionalFormatter } from '@alaarab/ogrid-core';
import { FormulaEngine } from '@alaarab/ogrid-core/formula';
import { createGridDataAccessor } from '@alaarab/ogrid-core';
import { conditionalFormatsOf } from '../conditionalFormats';
import { sheetToGridData, workbookFromBlob } from '../sheetMapper';
import { XlsxWorkbookDocument } from '../xlsxDocument';

const RED = { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFC7CE' } }, font: { color: { argb: 'FF9C0006' }, bold: true } } as const;

function buildSource(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sales');
  ws.addRows([
    ['Region', 'Sales', 'Target'],
    ['North', 100, 150],
    ['South', 300, 200],
    ['East', 200, 250],
    ['West', 300, 100],
  ]);
  const add = (ref: string, rule: Record<string, unknown>) =>
    ws.addConditionalFormatting({ ref, rules: [rule as unknown as ExcelJS.ConditionalFormattingRule] });
  add('B2:B5', { type: 'cellIs', operator: 'greaterThan', formulae: ['250'], style: RED, priority: 1 });
  add('A2:A5', { type: 'containsText', operator: 'containsText', text: 'th', style: RED, priority: 2 });
  add('B2:B5', { type: 'top10', rank: 1, style: RED, priority: 3 });
  add('B2:B5', { type: 'aboveAverage', aboveAverage: false, style: RED, priority: 4 });
  add('A2:C5', { type: 'expression', formulae: ['$B2<$C2'], style: RED, priority: 5 });
  add('C2:C5', {
    type: 'colorScale', priority: 6,
    cfvo: [{ type: 'min' }, { type: 'max' }],
    color: [{ argb: 'FFF8696B' }, { argb: 'FF63BE7B' }],
  });
  add('B2:B5', { type: 'dataBar', priority: 7, cfvo: [{ type: 'min' }, { type: 'max' }], color: { argb: 'FF638EC6' } });
  return wb;
}

async function reload(wb: ExcelJS.Workbook): Promise<ExcelJS.Workbook> {
  return workbookFromBlob(new Blob([await wb.xlsx.writeBuffer()]));
}

describe('conditionalFormatsOf', () => {
  test('maps Excel rule kinds onto grid columns and rows', async () => {
    const wb = await reload(buildSource());
    const ws = wb.getWorksheet('Sales') as ExcelJS.Worksheet;
    const grid = sheetToGridData(ws);
    expect(grid.formatting.headerPromoted).toBe(true);
    const rules = conditionalFormatsOf(ws, { headerPromoted: true, columnCount: grid.columns.length, rowCount: grid.rows.length });
    const byPriority = Object.fromEntries(rules.map((r) => [r.priority, r]));
    expect(byPriority[1]).toMatchObject({
      type: 'cellValue', operator: 'greaterThan', value: 250, columnIds: ['B'], rows: { start: 0, end: 3 },
      style: { background: '#FFC7CE', color: '#9C0006', bold: true },
    });
    expect(byPriority[2]).toMatchObject({ type: 'text', operator: 'contains', text: 'th', columnIds: ['A'] });
    expect(byPriority[3]).toMatchObject({ type: 'topBottom', direction: 'top', rank: 1, percent: false });
    expect(byPriority[4]).toMatchObject({ type: 'average', direction: 'below' });
    // Worksheet row 2 is grid A1 row 1.
    expect(byPriority[5]).toMatchObject({ type: 'formula', formula: '=$B1<$C1', columnIds: ['A', 'B', 'C'] });
    expect(byPriority[6]).toMatchObject({ type: 'colorScale', stops: [{ type: 'min', color: '#F8696B' }, { type: 'max', color: '#63BE7B' }] });
    expect(byPriority[7]).toMatchObject({ type: 'dataBar', color: '#638EC6', columnIds: ['B'] });
  });

  test('mapped rules highlight the same cells Excel would', async () => {
    const wb = await reload(buildSource());
    const ws = wb.getWorksheet('Sales') as ExcelJS.Worksheet;
    const grid = sheetToGridData(ws);
    const rules = conditionalFormatsOf(ws, { headerPromoted: true, columnCount: grid.columns.length, rowCount: grid.rows.length })
      .filter((r) => r.priority === 1 || r.priority === 2 || r.priority === 5)
      .map((r) => ({ ...r, style: { background: `p${r.priority}` } }));
    const evaluateFormula = new FormulaEngine().createDetachedEvaluator(createGridDataAccessor(grid.rows, grid.columns));
    const f = createConditionalFormatter(rules, { items: grid.rows, columns: grid.columns, evaluateFormula });
    const bg = (row: number, col: string) => f?.getCellFormat(grid.rows[row] as (typeof grid.rows)[number], col)?.style.background;
    // > 250: South (300) and West (300); priority 1 beats the formula rule
    expect(grid.rows.map((_, i) => bg(i, 'B'))).toEqual(['p5', 'p1', 'p5', 'p1']);
    // contains "th": North, South
    expect(grid.rows.map((_, i) => bg(i, 'A'))).toEqual(['p2', 'p2', 'p5', undefined]);
    // $B<$C: North, East
    expect(grid.rows.map((_, i) => bg(i, 'C'))).toEqual(['p5', undefined, 'p5', undefined]);
  });

  test('ranges that start on the promoted header row are rebased onto data rows', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('S');
    ws.addRows([['H'], [1], [2]]);
    ws.addConditionalFormatting({ ref: 'A1:A3', rules: [{ type: 'expression', formulae: ['A1>1'], priority: 1 } as ExcelJS.ConditionalFormattingRule] });
    const loaded = (await reload(wb)).getWorksheet('S') as ExcelJS.Worksheet;
    const [rule] = conditionalFormatsOf(loaded, { headerPromoted: true, columnCount: 1, rowCount: 2 });
    expect(rule).toMatchObject({ type: 'formula', formula: '=A1>1', rows: { start: 0, end: 1 } });
  });

  test('a sheet without conditional formats maps to no rules', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('S').addRows([['a'], [1]]);
    expect(conditionalFormatsOf((await reload(wb)).getWorksheet('S'), { headerPromoted: true, columnCount: 1, rowCount: 1 })).toEqual([]);
  });

  test('export keeps the original conditional formats after edits', async () => {
    const wb = await reload(buildSource());
    const doc = new XlsxWorkbookDocument(wb);
    doc.setCellValues('Sales', [{ rowId: 0, columnId: 'B', value: 999 }]);
    const out = new ExcelJS.Workbook();
    await out.xlsx.load(await (await doc.toBlob()).arrayBuffer());
    const original = (wb.getWorksheet('Sales') as unknown as { conditionalFormattings: Array<{ ref: string; rules: Array<{ type: string }> }> }).conditionalFormattings;
    const written = (out.getWorksheet('Sales') as unknown as { conditionalFormattings: Array<{ ref: string; rules: Array<{ type: string }> }> }).conditionalFormattings;
    expect(written.map((c) => [c.ref, c.rules.map((r) => r.type)])).toEqual(original.map((c) => [c.ref, c.rules.map((r) => r.type)]));
    expect(out.getWorksheet('Sales')?.getCell('B2').value).toBe(999);
  });
});
