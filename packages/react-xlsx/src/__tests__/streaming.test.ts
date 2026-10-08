import { describe, expect, test } from 'bun:test';
import ExcelJS from 'exceljs';
import { streamWorkbook } from '../streamingClient';
import { sheetToGridData, workbookFromBlob } from '../sheetMapper';
import { noteText } from '../cellNotes';

async function fixture() {
  const wb = new ExcelJS.Workbook();
  wb.properties.date1904 = true;
  const ws = wb.addWorksheet('Values');
  ws.addRows([
    ['name', 'value', 'date', 'bool', 'result'],
    [{ richText: [{ text: 'A & ' }, { text: '<B>' }] }, 12.5, new Date('2026-01-02T00:00:00Z'), true, { formula: 'B2*2', result: 25 }],
    ['second', 4, null, false, { error: '#N/A' }],
  ]);
  ws.getCell('C2').numFmt = 'yyyy-mm-dd';
  ws.getCell('B2').font = { bold: true, color: { argb: 'FF217346' } };
  ws.getCell('B2').dataValidation = { type: 'whole', operator: 'between', formulae: [0, 100] };
  ws.getCell('A2').note = 'Preserved note';
  ws.getCell('A5').value = 'merged'; ws.mergeCells('A5:B5');
  ws.addConditionalFormatting({ ref: 'B2:B3', rules: [{ type: 'cellIs', operator: 'greaterThan', formulae: ['0'], priority: 1, style: { font: { italic: true } } }] });
  wb.addWorksheet('Unopened').getCell('D4').value = 'keep me';
  return new Blob([await wb.xlsx.writeBuffer()]);
}

describe('streaming XLSX import', () => {
  test('Worker-unavailable chunks match the full loader for shared strings, dates, caches, blanks and merges', async () => {
    expect(typeof Worker).toBe('undefined');
    const blob = await fixture();
    const progress: number[] = [];
    const deliveries: number[] = [];
    const streamed = await streamWorkbook(blob, { chunkSize: 1, headerRow: 'none', onProgress: value => { progress.push(value); }, onChunk: chunk => { deliveries.push(chunk.rows.length); } });
    const full = await workbookFromBlob(blob);
    for (const [name, sheet] of streamed.sheets) expect(sheet.rows).toEqual(sheetToGridData(full.getWorksheet(name), { headerRow: 'none' }).rows);
    expect(deliveries.filter(count => count > 0).length).toBeGreaterThan(3);
    expect(Math.max(...deliveries)).toBe(1);
    expect(progress[0]).toBe(0); expect(progress.at(-1)).toBe(100);
    expect(progress.every((value, i) => i === 0 || value >= progress[i - 1]!)).toBe(true);
  });

  test('cancel during an awaited chunk stops further delivery and progress completion', async () => {
    const controller = new AbortController();
    let deliveries = 0;
    const progress: number[] = [];
    await expect(streamWorkbook(await fixture(), {
      signal: controller.signal, chunkSize: 1, onProgress: value => { progress.push(value); },
      onChunk: async () => { deliveries++; await Promise.resolve(); controller.abort(); },
    })).rejects.toMatchObject({ name: 'AbortError' });
    expect(deliveries).toBe(1); expect(progress).not.toContain(100);
  });

  test('an already-cancelled load does not read the source', async () => {
    const controller = new AbortController(); controller.abort();
    await expect(streamWorkbook(new Blob(['not a workbook']), { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  });

  test('mapping limits clip the final rectangle while retaining the original for export', async () => {
    const blob = await fixture();
    const streamed = await streamWorkbook(blob, { maxRows: 3, maxCols: 2, maxCells: 4 });
    const sheet = streamed.sheets.get('Values')!;
    expect(sheet.rows).toEqual([{ __rowIdx: 0, A: 'name', B: 'value' }, { __rowIdx: 1, A: 'A & <B>', B: 12.5 }]);
    expect(sheet.truncated).toBe(true); expect(sheet.rowCount).toBe(5); expect(sheet.columnCount).toBe(5);
    expect(await (await streamed.toBlob()).arrayBuffer()).toEqual(await blob.arrayBuffer());
  });

  test('edit then export keeps styles, merges, validations, CF, notes and unopened sheets', async () => {
    const streamed = await streamWorkbook(await fixture(), { headerRow: 'none' });
    const doc = await streamed.loadDocument();
    doc.setCellValues('Values', [{ rowId: 1, columnId: 'B', value: 42 }]);
    const exported = await workbookFromBlob(await streamed.toBlob());
    const ws = exported.getWorksheet('Values')!;
    expect(ws.getCell('B2').value).toBe(42);
    expect(ws.getCell('B2').font).toMatchObject({ bold: true, color: { argb: 'FF217346' } });
    expect(ws.getCell('C2').numFmt).toBe('yyyy-mm-dd');
    expect(ws.getCell('B2').dataValidation).toMatchObject({ type: 'whole', formulae: [0, 100] });
    expect(ws.getCell('B5').master.address).toBe('A5');
    expect(noteText(ws.getCell('A2').note)).toBe('Preserved note');
    expect(ws.conditionalFormattings[0]?.ref).toBe('B2:B3');
    expect(exported.getWorksheet('Unopened')?.getCell('D4').value).toBe('keep me');
    expect(await streamed.loadDocument()).toBe(doc);
  });

  test('rejects byte and decoded shared-string budgets before delivering rows', async () => {
    const blob = await fixture();
    await expect(streamWorkbook(blob, { maxFileBytes: 1 })).rejects.toThrow('maxFileBytes');
    await expect(streamWorkbook(blob, { maxUncompressedBytes: 100 })).rejects.toThrow('maxUncompressedBytes');
    await expect(streamWorkbook(blob, { maxSharedStringsBytes: 1 })).rejects.toThrow('maxSharedStringsBytes');
  });

  test('a failing chunk consumer rejects the load', async () => {
    await expect(streamWorkbook(await fixture(), { onChunk: () => { throw new Error('consumer failed'); } })).rejects.toThrow('consumer failed');
  });

  test('a blocked Worker constructor uses the cooperative fallback', async () => {
    const streamed = await streamWorkbook(await fixture(), { workerFactory: () => { throw new Error('CSP'); } });
    expect(streamed.sheets.get('Values')?.rows[1]?.B).toBe(12.5);
  });
});
