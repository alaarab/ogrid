import { describe, expect, test } from 'bun:test';
import ExcelJS from 'exceljs';
import { createRequire } from 'node:module';
import { XlsxWorkbookDocument } from '../xlsxDocument';
import { workbookFromBlob } from '../sheetMapper';

async function fixture(): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sales Data');
  for (let r = 1; r <= 6; r++) ws.addRow([r * 10, r, r + 1, r + 2, r + 3]);
  ws.getCell('A2').value = { formula: 'D4+Other!D4+SUM($D$4:$D$6)+LOG10(A1)', result: 30 };
  ws.getCell('B2').value = { formula: 'SUM(Band)', result: 21 };
  ws.getCell('D4').value = { text: 'link', hyperlink: 'https://example.com' };
  ws.getCell('D4').note = 'Keep this note';
  ws.getCell('D4').font = { bold: true, color: { argb: 'FF123456' } };
  ws.getCell('D4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
  ws.getCell('D4').numFmt = '0.00';
  ws.getRow(4).height = 31;
  ws.getRow(4).hidden = true;
  ws.getColumn(4).width = 22;
  ws.getColumn(4).hidden = true;
  ws.mergeCells('B4:C5');
  for (let r = 4; r <= 6; r++) ws.getCell(`E${r}`).dataValidation = {
    type: 'custom', allowBlank: true, formulae: ['D4>0'],
  };
  ws.addConditionalFormatting({ ref: 'D4:D6 B2:B3', rules: [
    { type: 'expression', priority: 1, formulae: ['D4>0'], style: { font: { italic: true } } },
  ] });
  ws.views = [{ state: 'frozen', xSplit: 4, ySplit: 4, topLeftCell: 'E5' }];
  wb.definedNames.add("'Sales Data'!$D$4:$D$6", 'Band');
  const other = wb.addWorksheet('Other');
  other.getCell('A1').value = { formula: 'SUM(\'Sales Data\'!$D$4:$D$6)+D4+LEN("D4")', result: 30 };
  other.getCell('A2').value = { formula: "'Sales Data'!D4", result: 6 };
  other.getCell('D4').value = 99;
  // Always start from a workbook parsed from actual XML, as an uploaded file is.
  return workbookFromBlob(new Blob([await wb.xlsx.writeBuffer()]));
}

async function reread(doc: XlsxWorkbookDocument): Promise<ExcelJS.Workbook> {
  return workbookFromBlob(await doc.toBlob());
}

async function documentFrom(wb: ExcelJS.Workbook): Promise<XlsxWorkbookDocument> {
  return new XlsxWorkbookDocument(await workbookFromBlob(new Blob([await wb.xlsx.writeBuffer()])), { headerRow: 'none', maxCols: 10 });
}

describe('XLSX structural round trips', () => {
  test('prefixed shared-formula dependents retain their own relative references when appending a row', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Data');
    ws.addRows([[1], [2]]);
    ws.getCell('B1').value = { formula: '_xlfn.XLOOKUP(A1,$A$1:$A$2,$A$1:$A$2)', shareType: 'shared', ref: 'B1:B2', result: 1 };
    ws.getCell('B2').value = { sharedFormula: 'B1', result: 2 };
    const doc = await documentFrom(wb);
    doc.insertRows('Data', 2);
    const out = (await reread(doc)).getWorksheet('Data');
    expect(out?.getCell('B1').formula).toBe('_xlfn.XLOOKUP(A1,$A$1:$A$2,$A$1:$A$2)');
    expect(out?.getCell('B2').formula).toBe('_xlfn.XLOOKUP(A2,$A$1:$A$2,$A$1:$A$2)');
  });

  test('an untranslatable shared formula rejects the edit without changing the file or history', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Data');
    ws.addRows([[1], [2]]);
    ws.getCell('B1').value = { formula: 'SUM(Table1[Amount])+A1', shareType: 'shared', ref: 'B1:B2', result: 1 };
    ws.getCell('B2').value = { sharedFormula: 'B1', result: 2 };
    const doc = await documentFrom(wb);
    expect(() => doc.insertRows('Data', 2)).toThrow(/shared formula/i);
    expect(doc.canUndo('Data')).toBe(false);
    expect((await reread(doc)).getWorksheet('Data')?.getCell('B2').value).toEqual({ sharedFormula: 'B1', result: 2 });
  });

  test('array metadata survives edits on another sheet and follows edits on its own sheet', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Data').addRows([[1], [2]]);
    const ws = wb.addWorksheet('Arrays');
    ws.addRows([[10, 20], [null, null, 10], [null, null, 20]]);
    ws.getCell('C2').value = { formula: 'TRANSPOSE(A1:B1)', shareType: 'array', ref: 'C2:C3', result: 10 };
    const doc = await documentFrom(wb);
    doc.insertRows('Data', 0);
    expect((await reread(doc)).getWorksheet('Arrays')?.getCell('C2').value).toEqual({ formula: 'TRANSPOSE(A1:B1)', shareType: 'array', ref: 'C2:C3', result: 10 });
    doc.insertRows('Arrays', 0);
    doc.insertColumns('Arrays', 0);
    expect((await reread(doc)).getWorksheet('Arrays')?.getCell('D3').value).toEqual({ formula: 'TRANSPOSE(B2:C2)', shareType: 'array', ref: 'D3:D4', result: 10 });
    doc.undo('Arrays');
    expect((await reread(doc)).getWorksheet('Arrays')?.getCell('C3').value).toMatchObject({ shareType: 'array', ref: 'C3:C4' });
  });

  for (const axis of ['rows', 'columns'] as const) {
    test(`deleting a ${axis} rule anchor rebases relative references but deletes absolute targets`, async () => {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Data');
      ws.addRows([[1, 2, 3], [2, 3, 4], [3, 4, 5]]);
      const ref = axis === 'rows' ? 'A1:A3' : 'A1:C1';
      const formula = 'AND(A1>0,$A1>0,A$1>0,$A$1>0)';
      (ws as unknown as { dataValidations: { add: (ref: string, rule: ExcelJS.DataValidation) => void } }).dataValidations.add(ref, { type: 'custom', formulae: [formula] });
      ws.addConditionalFormatting({ ref, rules: [{ type: 'expression', priority: 1, formulae: [formula], style: { font: { bold: true } } }] });
      const doc = await documentFrom(wb);
      if (axis === 'rows') doc.deleteRows('Data', 0);
      else doc.deleteColumns('Data', 0);
      const out = (await reread(doc)).getWorksheet('Data') as ExcelJS.Worksheet;
      const expected = axis === 'rows' ? 'AND(A1>0,$A1>0,#REF!>0,#REF!>0)' : 'AND(A1>0,#REF!>0,A$1>0,#REF!>0)';
      for (const address of axis === 'rows' ? ['A1', 'A2'] : ['A1', 'B1']) expect(out.getCell(address).dataValidation.formulae).toEqual([expected]);
      expect(out.conditionalFormattings[0]).toMatchObject({ ref: axis === 'rows' ? 'A1:A2' : 'A1:B1', rules: [{ formulae: [expected] }] });
    });
  }

  test.each([
    ['LOG10 (A1)', 'LOG10 (A2)', 'insert'],
    ['SUM(A1 : A5)', 'SUM(A1:A4)', 'delete'],
  ])('whitespace in %s survives a serialized structure edit', async (formula, expected, operation) => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Data').addRows([[1], [2], [3], [4], [5]]);
    // Put the formula on the edited sheet in a surviving cell.
    wb.getWorksheet('Data')!.getCell('B5').value = { formula, result: 1 };
    const doc = await documentFrom(wb);
    if (operation === 'insert') doc.insertRows('Data', 0);
    else doc.deleteRows('Data', 0);
    expect((await reread(doc)).getWorksheet('Data')?.getCell(operation === 'insert' ? 'B6' : 'B4').formula).toBe(expected);
  });

  test('conditional-format formulas rebase when their first area is deleted', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Data');
    ws.addRows([[1, 2, 3], [2, 3, 4], [3, 4, 5]]);
    ws.addConditionalFormatting({ ref: 'A1:A2 C2:C3', rules: [
      { type: 'expression', priority: 1, formulae: ['A1>0'], style: { font: { bold: true } } },
    ] });
    const doc = await documentFrom(wb);
    doc.deleteColumns('Data', 0);
    const cf = (await reread(doc)).getWorksheet('Data')?.conditionalFormattings[0];
    expect(cf?.ref).toBe('B2:B3');
    expect(cf?.rules[0]).toMatchObject({ formulae: ['B2>0'] });
  });

  test('column properties at XFD prevent insertion from exporting out-of-bounds column XML', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Data');
    ws.getCell('A1').value = 1;
    ws.getColumn('XFD').width = 23;
    const doc = await documentFrom(wb);
    expect(() => doc.insertColumns('Data', 0)).toThrow(/worksheet limits/);
    const blob = await doc.toBlob();
    const require = createRequire(import.meta.url);
    const JSZip = createRequire(require.resolve('exceljs'))('jszip');
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml: string = await zip.file('xl/worksheets/sheet1.xml').async('string');
    const columns = [...xml.matchAll(/<col\b[^>]*\bmax="(\d+)"/g)];
    expect(columns.map((m) => Number(m[1]))).toEqual([16384]);
    expect((await workbookFromBlob(blob)).getWorksheet('Data')?.getColumn('XFD').width).toBe(23);
    expect(doc.canUndo('Data')).toBe(false);
  });
  for (const axis of ['rows', 'columns'] as const) {
    test(`inserting ${axis} shifts values, references and Excel metadata, with undo and redo`, async () => {
      const input = await fixture();
      const doc = new XlsxWorkbookDocument(input, { headerRow: 'none' });
      doc.sheet('Other'); // Opened cross-sheet formulas must refresh too.
      doc.setCellValues('Sales Data', [{ rowId: 0, columnId: 'A', value: 123 }]);
      await Promise.resolve();
      if (axis === 'rows') doc.insertRows('Sales Data', 2, 2);
      else doc.insertColumns('Sales Data', 2, 2);
      const out = await reread(doc);
      const ws = out.getWorksheet('Sales Data') as ExcelJS.Worksheet;
      const address = axis === 'rows' ? 'D6' : 'F4';
      expect(ws.getCell(address).value).toEqual({ text: 'link', hyperlink: 'https://example.com' });
      expect(ws.getCell(address).note).toBe('Keep this note');
      expect(ws.getCell(address).font).toMatchObject({ bold: true, color: { argb: 'FF123456' } });
      expect(ws.getCell(address).fill).toMatchObject({ fgColor: { argb: 'FFFF0000' } });
      expect(ws.getCell(address).numFmt).toBe('0.00');
      expect(ws.getRow(axis === 'rows' ? 6 : 4).height).toBe(31);
      expect(ws.getRow(axis === 'rows' ? 6 : 4).hidden).toBe(true);
      expect(ws.getColumn(axis === 'columns' ? 6 : 4).width).toBe(22);
      expect(ws.getColumn(axis === 'columns' ? 6 : 4).hidden).toBe(true);
      expect(ws.model.merges).toEqual([axis === 'rows' ? 'B6:C7' : 'B4:E5']);
      expect(ws.getCell(axis === 'rows' ? 'E6' : 'G4').dataValidation).toMatchObject({
        type: 'custom', formulae: [axis === 'rows' ? 'D6>0' : 'F4>0'],
      });
      expect(ws.conditionalFormattings[0].ref).toBe(axis === 'rows' ? 'D6:D8 B2:B5' : 'F4:F6 B2:B3');
      expect(ws.conditionalFormattings[0].rules[0]).toMatchObject({ formulae: [axis === 'rows' ? 'D6>0' : 'F4>0'] });
      expect(ws.views[0]).toMatchObject(axis === 'rows'
        ? { state: 'frozen', xSplit: 4, ySplit: 6, topLeftCell: 'E7' }
        : { state: 'frozen', xSplit: 6, ySplit: 4, topLeftCell: 'G5' });
      const ref = axis === 'rows' ? '$D$6:$D$8' : '$F$4:$F$6';
      expect(out.definedNames.getRanges('Band').ranges).toEqual([`'Sales Data'!${ref}`]);
      expect(out.getWorksheet('Other')?.getCell('A1').formula).toBe(`SUM('Sales Data'!${ref})+D4+LEN("D4")`);
      expect(ws.getCell('A2').formula).toBe(axis === 'rows'
        ? 'D6+Other!D4+SUM($D$6:$D$8)+LOG10(A1)'
        : 'F4+Other!D4+SUM($F$4:$F$6)+LOG10(A1)');
      expect(ws.getCell('B2').formula).toBe('SUM(Band)');
      expect(ws.getCell('A1').value).toBe(123);
      expect(input.getWorksheet('Sales Data')?.getCell('D4').note).toBe('Keep this note');
      doc.setCellValues('Other', [{ rowId: 3, columnId: 'D', value: 77 }]);
      await Promise.resolve();
      doc.undo('Sales Data');
      expect((await reread(doc)).getWorksheet('Other')?.getCell('D4').value).toBe(99);
      doc.undo('Other'); // One chronological workbook history, including edits on other sheets.
      expect((await reread(doc)).getWorksheet('Sales Data')?.getCell('D4').note).toBe('Keep this note');
      doc.undo('Sales Data');
      expect((await reread(doc)).getWorksheet('Sales Data')?.getCell('A1').value).toBe(10);
      doc.redo('Other');
      doc.redo('Sales Data');
      doc.redo('Other');
      expect((await reread(doc)).getWorksheet('Sales Data')?.getCell(address).note).toBe('Keep this note');
    });

    test(`deleting ${axis} shrinks ranges, removes deleted references and shifts metadata`, async () => {
      const doc = new XlsxWorkbookDocument(await fixture(), { headerRow: 'none' });
      if (axis === 'rows') doc.deleteRows('Sales Data', 3, 1);
      else doc.deleteColumns('Sales Data', 3, 1);
      const out = await reread(doc);
      const ws = out.getWorksheet('Sales Data') as ExcelJS.Worksheet;
      expect(out.getWorksheet('Other')?.getCell('A2').formula).toBe("'Sales Data'!#REF!");
      expect(out.definedNames.getRanges('Band').ranges).toEqual(axis === 'rows' ? ["'Sales Data'!$D$4:$D$5"] : []);
      expect(ws.model.merges).toEqual(axis === 'rows' ? ['B4:C4'] : ['B4:C5']);
      expect(ws.getCell(axis === 'rows' ? 'E4' : 'D4').dataValidation).toMatchObject({ type: 'custom', formulae: [axis === 'rows' ? 'D4>0' : '#REF!>0'] });
      expect(ws.conditionalFormattings.map((cf) => cf.ref)).toEqual(axis === 'rows' ? ['D4:D5 B2:B3'] : ['B2:B3']);
      expect(ws.views[0]).toMatchObject(axis === 'rows'
        ? { xSplit: 4, ySplit: 3 } : { xSplit: 3, ySplit: 4 });
      expect(ws.getCell('D4').note).toBeUndefined();
      doc.undo('Sales Data');
      const restored = (await reread(doc)).getWorksheet('Sales Data') as ExcelJS.Worksheet;
      expect(restored.getCell('D4').note).toBe('Keep this note');
      expect(restored.model.merges).toEqual(['B4:C5']);
    });
  }

  test('shared formulas, whole-column ranges and quoted sheets move while strings and foreign references remain', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("O'Brien");
    wb.addWorksheet('Other').getCell('A1').value = { formula: "SUM('O''Brien'!A:A)+SUM('O''Brien'!1:3)", result: 1 };
    ws.addRows([[1, 2], [3, 4], [5, 6]]);
    ws.getCell('C1').value = { formula: 'SUM(A1:B1)+LEN("A1")', shareType: 'shared', ref: 'C1:C3', result: 5 };
    ws.getCell('C2').value = { sharedFormula: 'C1', result: 9 };
    ws.getCell('C3').value = { sharedFormula: 'C1', result: 13 };
    const doc = new XlsxWorkbookDocument(await workbookFromBlob(new Blob([await wb.xlsx.writeBuffer()])), { headerRow: 'none' });
    doc.insertRows("O'Brien", 1);
    doc.insertColumns("O'Brien", 0);
    const out = await reread(doc);
    expect(out.getWorksheet("O'Brien")?.getCell('D3').formula).toBe('SUM(B3:C3)+LEN("A1")');
    expect(out.getWorksheet('Other')?.getCell('A1').formula).toBe("SUM('O''Brien'!B:B)+SUM('O''Brien'!1:4)");
  });

  test('promoted headers stay fixed, appended blanks remain editable, and a noncontiguous delete is one undo step', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Data').addRows([['Name', 'Total'], ['one', 1], ['two', 2], ['three', 3]]);
    const doc = new XlsxWorkbookDocument(wb);
    doc.insertRows('Data', 3, 2);
    doc.insertColumns('Data', 2);
    expect(doc.sheet('Data')?.rows).toHaveLength(5);
    expect(doc.sheet('Data')?.columns).toHaveLength(3);
    doc.setCellValues('Data', [{ rowId: 4, columnId: 'C', value: 42 }]);
    await Promise.resolve();
    doc.deleteRows('Data', [0, 2]);
    expect(doc.sheet('Data')?.rows.map((r) => r.A)).toEqual(['two', '', '']);
    doc.undo('Data');
    const out = await reread(doc);
    expect(out.getWorksheet('Data')?.getCell('A1').value).toBe('Name');
    expect(out.getWorksheet('Data')?.getCell('C6').value).toBe(42);
    expect(doc.sheet('Data')?.rows).toHaveLength(5);
  });

  test('inserting inside a validation range extends its coverage and a partially deleted merge shrinks', async () => {
    const doc = new XlsxWorkbookDocument(await fixture(), { headerRow: 'none' });
    doc.insertRows('Sales Data', 4, 2);
    let out = await reread(doc);
    const ws = out.getWorksheet('Sales Data') as ExcelJS.Worksheet;
    expect(ws.model.merges).toEqual(['B4:C7']);
    for (let r = 4; r <= 8; r++) expect(ws.getCell(`E${r}`).dataValidation).toMatchObject({ type: 'custom', formulae: ['D4>0'] });
    doc.deleteColumns('Sales Data', 1);
    out = await reread(doc);
    expect(out.getWorksheet('Sales Data')?.model.merges).toEqual(['B4:B7']);
  });

  test('edits in a truncated grid also shift unloaded cells and references to them', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Data');
    ws.addRows([[1, 2], [3, 4]]);
    ws.getCell('E100').value = 123;
    ws.getCell('E100').note = 'Outside the loaded area';
    wb.addWorksheet('Other').getCell('A1').value = { formula: 'Data!E100', result: 123 };
    wb.definedNames.add('Data!$E$100', 'FarAway');
    const input = await workbookFromBlob(new Blob([await wb.xlsx.writeBuffer()]));
    const doc = new XlsxWorkbookDocument(input, { headerRow: 'none', maxRows: 2, maxCols: 2 });
    doc.insertRows('Data', 1);
    doc.insertColumns('Data', 1);
    expect(doc.sheet('Data')?.source.truncated).toEqual({ rowCount: 101, columnCount: 6 });
    const out = await reread(doc);
    expect(out.getWorksheet('Data')?.getCell('F101').value).toBe(123);
    expect(out.getWorksheet('Data')?.getCell('F101').note).toBe('Outside the loaded area');
    expect(out.getWorksheet('Other')?.getCell('A1').formula).toBe('Data!F101');
    expect(out.definedNames.getRanges('FarAway').ranges).toEqual(['Data!$F$101']);
  });
});
