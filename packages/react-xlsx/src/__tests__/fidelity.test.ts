/**
 * Import → edit → export fidelity. Each test builds a workbook with ExcelJS,
 * serializes it, opens it as an XlsxWorkbookDocument (the path the grid
 * uses), edits through the document API, exports, and re-reads the result
 * with ExcelJS.
 */
import { describe, expect, test } from 'bun:test';
import ExcelJS from 'exceljs';
import { columnWidthToPx, pxToColumnWidth, workbookFromBlob } from '../sheetMapper';
import { XlsxWorkbookDocument } from '../xlsxDocument';

async function reload(wb: ExcelJS.Workbook): Promise<ExcelJS.Workbook> {
  return workbookFromBlob(new Blob([await wb.xlsx.writeBuffer()]));
}

async function exported(doc: XlsxWorkbookDocument): Promise<ExcelJS.Workbook> {
  const out = new ExcelJS.Workbook();
  await out.xlsx.load(await (await doc.toBlob()).arrayBuffer());
  return out;
}

function mergesOf(ws: ExcelJS.Worksheet): string[] {
  return [...((ws.model as { merges?: string[] }).merges ?? [])].sort();
}

/** A workbook exercising every feature the document models, plus a few it only passes through. */
function buildSource(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const data = wb.addWorksheet('Data', { properties: { tabColor: { argb: 'FFFF0000' } } });
  data.addRows([
    ['Item', 'Price', 'Share', 'When', 'Status', 'Total'],
    ['Apples', 1234.5, 0.125, new Date(Date.UTC(2024, 0, 15)), 'Open', { formula: 'B2*2', result: 2469 }],
    ['Pears', 10, 0.5, new Date(Date.UTC(2024, 1, 1)), 'Closed', { formula: 'SUM(B2:B3)', result: 1244.5 }],
    [{ text: 'Docs', hyperlink: 'https://ogrid.dev' }, 20, 0.25, new Date(Date.UTC(2024, 2, 1)), 'Open', { formula: 'Lookup!A1*10', result: 70 }],
    ['Note spanning three columns'],
  ]);
  data.getCell('A2').font = { bold: true, italic: true, underline: true, color: { argb: 'FFC00000' }, size: 14, name: 'Arial' };
  data.getCell('A3').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
  data.getCell('A3').border = { top: { style: 'thin' }, bottom: { style: 'double', color: { argb: 'FF0000FF' } } };
  data.getCell('B2').alignment = { horizontal: 'center', vertical: 'top', wrapText: true };
  for (const r of [2, 3, 4]) {
    data.getCell(`B${r}`).numFmt = '"$"#,##0.00';
    data.getCell(`C${r}`).numFmt = '0.00%';
    data.getCell(`D${r}`).numFmt = 'yyyy-mm-dd';
  }
  for (const r of [2, 3, 4, 5]) data.getCell(`E${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Open,Closed"'] };
  data.getCell('C2').protection = { locked: false };
  data.mergeCells('A5:C5');
  data.views = [{ state: 'frozen', xSplit: 1, ySplit: 2, topLeftCell: 'B3', activeCell: 'B3' }];
  data.getColumn(1).width = 20;
  data.getColumn(2).width = 12;
  data.getRow(3).height = 30;

  const lookup = wb.addWorksheet('Lookup', { properties: { tabColor: { argb: 'FF0070C0' } } });
  lookup.getCell('A1').value = 7;
  lookup.getCell('A2').value = { formula: 'Data!B2+1', result: 1235.5 };
  lookup.getCell('A3').value = { formula: '_xlfn.CONCAT("a","b")', result: 'ab' };

  const untouched = wb.addWorksheet('Untouched');
  untouched.getCell('B2').value = 'keep me';
  untouched.getCell('B2').note = 'a comment';
  wb.definedNames.add("'Untouched'!$B$2", 'KeepName');
  return wb;
}

describe('import maps formatting into grid terms', () => {
  test('styles, widths, heights, merges, frozen panes and list validations', async () => {
    const doc = new XlsxWorkbookDocument(await reload(buildSource()));
    const sheet = doc.sheet('Data');
    if (!sheet) throw new Error('missing sheet');
    const { formatting } = sheet.source;
    expect(formatting.headerPromoted).toBe(true);
    expect(formatting.styles.get('0:A')?.font).toMatchObject({ bold: true, italic: true, size: 14, name: 'Arial' });
    expect(formatting.styles.get('1:A')?.fill).toMatchObject({ pattern: 'solid', fgColor: { argb: 'FFFFFF00' } });
    expect(formatting.styles.get('0:B')?.numFmt).toBe('"$"#,##0.00');
    // Unstyled cells stay out of the map.
    expect(formatting.styles.has('3:F')).toBe(false);
    expect(formatting.frozen).toEqual({ rows: 1, columns: 1 });
    expect(formatting.merges).toEqual([{ rowId: 3, columnId: 'A', colSpan: 3 }]);
    expect(formatting.listValidations).toEqual({ E: ['Open', 'Closed'] });
    expect(formatting.rowHeights.get(1)).toBe(30);
    expect(formatting.tabColor).toBe('#FF0000');

    const [a, b, c] = sheet.columns;
    expect(a?.pinned).toBeUndefined();
    expect(b?.pinned).toBeUndefined();
    expect(a?.defaultWidth).toBe(columnWidthToPx(20));
    // Columns without an explicit width get Excel's default 64px, not a fixed 120.
    expect(c?.defaultWidth).toBe(64);
    expect(sheet.columns[4]).toMatchObject({ cellEditor: 'select', cellEditorParams: { values: ['Open', 'Closed'] } });
    // The merged-away cells read as empty instead of repeating the master value.
    expect(sheet.rows[3]?.B).toBe('');
  });

  test('pixel ↔ character widths round-trip', () => {
    expect(columnWidthToPx(9.140625)).toBe(64);
    expect(pxToColumnWidth(64)).toBe(9.140625);
    expect(columnWidthToPx(pxToColumnWidth(200))).toBe(200);
  });
});

describe('export after edits', () => {
  test('an untouched document exports every sheet with formatting intact', async () => {
    const out = await exported(new XlsxWorkbookDocument(await reload(buildSource())));
    expect(out.worksheets.map((w) => w.name)).toEqual(['Data', 'Lookup', 'Untouched']);
    const data = out.getWorksheet('Data') as ExcelJS.Worksheet;
    expect(data.properties.tabColor).toEqual({ argb: 'FFFF0000' });
    expect(out.getWorksheet('Lookup')?.properties.tabColor).toEqual({ argb: 'FF0070C0' });
    expect(data.getCell('A2').font).toMatchObject({ bold: true, italic: true, underline: true, size: 14, name: 'Arial', color: { argb: 'FFC00000' } });
    expect(data.getCell('A3').fill).toMatchObject({ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } });
    expect(data.getCell('A3').border).toMatchObject({ top: { style: 'thin' }, bottom: { style: 'double', color: { argb: 'FF0000FF' } } });
    expect(data.getCell('B2').alignment).toMatchObject({ horizontal: 'center', vertical: 'top', wrapText: true });
    expect(data.getCell('C2').protection).toMatchObject({ locked: false });
    expect(data.getCell('D2').numFmt).toBe('yyyy-mm-dd');
    expect(mergesOf(data)).toEqual(['A5:C5']);
    expect(data.views[0]).toMatchObject({ state: 'frozen', xSplit: 1, ySplit: 2 });
    expect(data.getColumn(1).width).toBe(20);
    expect(data.getRow(3).height).toBe(30);
    expect(data.getCell('A4').value).toMatchObject({ text: 'Docs', hyperlink: 'https://ogrid.dev' });
    expect((out.getWorksheet('Lookup') as ExcelJS.Worksheet).getCell('A3').formula).toBe('_xlfn.CONCAT("a","b")');
    expect((out.getWorksheet('Untouched') as ExcelJS.Worksheet).getCell('B2').note).toBe('a comment');
    expect(out.definedNames.getRanges('KeepName').ranges).toEqual(['Untouched!$B$2']);
  });

  test('values, formulas, styles, merges and widths edited in the grid are written back', async () => {
    const doc = new XlsxWorkbookDocument(await reload(buildSource()));
    doc.sheet('Lookup'); // opened but unedited: stays as read
    // Grid formula text uses data-row coordinates (row 1 = first row under the promoted header).
    doc.setCellValues('Data', [
      { rowId: 1, columnId: 'B', value: 99 },
      { rowId: 1, columnId: 'F', value: '=SUM(B1:B3)' },
      { rowId: 2, columnId: 'E', value: 'Closed' },
      { rowId: 0, columnId: 'D', value: '=CONCAT(A1,"!")' },
    ]);
    doc.applyStyle('Data', { rowIds: [0, 1], columnIds: ['C'] }, { kind: 'bold' });
    doc.applyStyle('Data', { rowIds: [2], columnIds: ['B'] }, { kind: 'fill', argb: 'FF00B050' });
    doc.applyStyle('Data', { rowIds: [2], columnIds: ['C'] }, { kind: 'numFmt', value: '#,##0.00' });
    doc.unmergeCells('Data', { rowIds: [3], columnIds: ['B'] });
    doc.mergeCells('Data', { rowIds: [1, 2], columnIds: ['C'] });
    doc.setColumnWidth('Data', 'B', 200);

    const out = await exported(doc);
    expect(out.worksheets.map((w) => w.name)).toEqual(['Data', 'Lookup', 'Untouched']);
    const data = out.getWorksheet('Data') as ExcelJS.Worksheet;
    expect(data.getCell('B3').value).toBe(99);
    // An edited value keeps the cell's number format.
    expect(data.getCell('B3').numFmt).toBe('"$"#,##0.00');
    expect(data.getCell('F3').formula).toBe('SUM(B2:B4)');
    expect(data.getCell('D2').formula).toBe('_xlfn.CONCAT(A2,"!")');
    expect(data.getCell('E4').value).toBe('Closed');
    // Unedited formulas, including cross-sheet ones, are untouched.
    expect(data.getCell('F2').formula).toBe('B2*2');
    expect(data.getCell('F4').formula).toBe('Lookup!A1*10');
    expect((out.getWorksheet('Lookup') as ExcelJS.Worksheet).getCell('A2').formula).toBe('Data!B2+1');
    // Style edits merge into the existing style instead of replacing it.
    expect(data.getCell('C2').font?.bold).toBe(true);
    expect(data.getCell('C2').numFmt).toBe('0.00%');
    expect(data.getCell('C2').protection).toMatchObject({ locked: false });
    expect(data.getCell('B4').fill).toMatchObject({ pattern: 'solid', fgColor: { argb: 'FF00B050' } });
    expect(data.getCell('B4').numFmt).toBe('"$"#,##0.00');
    expect(data.getCell('C4').numFmt).toBe('#,##0.00');
    expect(data.getCell('A2').font).toMatchObject({ bold: true, name: 'Arial' });
    // Merge edits: A5:C5 removed, C3:C4 added (its lower value cleared, like Excel).
    expect(mergesOf(data)).toEqual(['C3:C4']);
    expect(data.getCell('C3').value).toBe(0.5);
    expect(data.getCell('A5').value).toBe('Note spanning three columns');
    expect(data.getColumn(2).width).toBe(pxToColumnWidth(200));
    expect(data.getColumn(1).width).toBe(20);
    // What the document does not edit still round-trips.
    expect(data.views[0]).toMatchObject({ state: 'frozen', xSplit: 1, ySplit: 2 });
    expect(data.getCell('E3').dataValidation).toMatchObject({ type: 'list', formulae: ['"Open,Closed"'] });
    expect(data.getRow(3).height).toBe(30);
    expect(data.getCell('A4').value).toMatchObject({ hyperlink: 'https://ogrid.dev' });
    // Untouched formulas keep stale cached results, so Excel is told to recalculate.
    expect((await doc.toWorkbook()).calcProperties.fullCalcOnLoad).toBe(true);
  });

  test('undo and redo cover values, styles and merges', async () => {
    const doc = new XlsxWorkbookDocument(await reload(buildSource()));
    doc.setCellValues('Data', [{ rowId: 0, columnId: 'B', value: 1 }]);
    await Promise.resolve();
    doc.applyStyle('Data', { rowIds: [0], columnIds: ['B'] }, { kind: 'italic' });
    await Promise.resolve();
    doc.mergeCells('Data', { rowIds: [0], columnIds: ['B', 'C'] });
    await Promise.resolve();
    const sheet = () => doc.sheet('Data') as NonNullable<ReturnType<typeof doc.sheet>>;
    expect(sheet().rows[0]?.C).toBe('');

    doc.undo('Data');
    expect(sheet().merges).toEqual([{ rowId: 3, columnId: 'A', colSpan: 3 }]);
    expect(sheet().rows[0]?.C).toBe(0.125);
    doc.undo('Data');
    expect(sheet().styles.get('0:B')?.font?.italic).toBeUndefined();
    doc.undo('Data');
    expect(sheet().rows[0]?.B).toBe(1234.5);
    expect(doc.canUndo('Data')).toBe(false);

    doc.redo('Data');
    expect(sheet().rows[0]?.B).toBe(1);
    const out = await exported(doc);
    expect(out.getWorksheet('Data')?.getCell('B2').value).toBe(1);
    expect(out.getWorksheet('Data')?.getCell('B2').font?.italic).toBeUndefined();
  });

  test('edits in one task are a single undo step', async () => {
    const doc = new XlsxWorkbookDocument(await reload(buildSource()));
    doc.setCellValues('Data', [{ rowId: 0, columnId: 'B', value: 1 }]);
    doc.setCellValues('Data', [{ rowId: 1, columnId: 'B', value: 2 }]);
    await Promise.resolve();
    doc.undo('Data');
    const sheet = doc.sheet('Data');
    expect([sheet?.rows[0]?.B, sheet?.rows[1]?.B]).toEqual([1234.5, 10]);
  });

  test('overwriting a shared-formula master keeps its dependents', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Calc');
    ws.addRows([[1, 2], [3, 4], [5, 6]]);
    ws.getCell('C1').value = { formula: 'A1+B1', result: 3, shareType: 'shared', ref: 'C1:C3' };
    ws.getCell('C2').value = { sharedFormula: 'C1', result: 7 };
    ws.getCell('C3').value = { sharedFormula: 'C1', result: 11 };
    const doc = new XlsxWorkbookDocument(await reload(wb), { headerRow: 'none' });
    doc.setCellValues('Calc', [{ rowId: 0, columnId: 'C', value: 100 }]);
    const out = (await exported(doc)).getWorksheet('Calc') as ExcelJS.Worksheet;
    expect(out.getCell('C1').value).toBe(100);
    expect(out.getCell('C2').formula).toBe('A2+B2');
    expect(out.getCell('C3').formula).toBe('A3+B3');
  });

  test('a header-row merge and partial list validation round-trip without being mapped', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('S');
    ws.addRows([['Title', '', 'x'], ['a', 'b', 'c'], ['d', 'e', 'f']]);
    ws.mergeCells('A1:B1');
    ws.getCell('C2').dataValidation = { type: 'list', formulae: ['$A$2:$A$3'] };
    const doc = new XlsxWorkbookDocument(await reload(wb));
    const sheet = doc.sheet('S');
    expect(sheet?.source.formatting.unmappedMerges).toEqual(['A1:B1']);
    expect(sheet?.source.formatting.listValidations).toEqual({});
    doc.setCellValues('S', [{ rowId: 0, columnId: 'A', value: 'z' }]);
    const out = (await exported(doc)).getWorksheet('S') as ExcelJS.Worksheet;
    expect(mergesOf(out)).toEqual(['A1:B1']);
    expect(out.getCell('C2').dataValidation).toMatchObject({ type: 'list', formulae: ['$A$2:$A$3'] });
  });
});
