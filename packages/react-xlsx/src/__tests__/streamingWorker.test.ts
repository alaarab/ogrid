import { Blob } from 'node:buffer';
import { expect, test } from 'bun:test';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { parseXml } from '../xmlParts';
import { streamWorkbook } from '../streamingClient';
import { workbookFromBlob } from '../sheetMapper';
import { dynamicArrayFixture } from './fixtures/dynamicArrayWorkbook';
import { mediaWorkbookBlob, PNG } from './fixtures/mediaWorkbook';
import { diskRoundTrip } from './fixtures/xlsxFile';
import { xlsxWorkerFactory } from './fixtures/xlsxWorker';

test('lazy worker hydration transfers bounded row batches and preserves sheet order and the last row', async () => {
  const wb = new ExcelJS.Workbook();
  const removed = wb.addWorksheet('Removed');
  const sheet = wb.addWorksheet('Large');
  wb.removeWorksheet(removed.id);
  for (let i = 1; i <= 1000; i++) sheet.addRow([`row-${i}`, i]);
  wb.addWorksheet('Other').addRow(['last sheet']);
  const messages: any[] = [];
  const workerFactory = await xlsxWorkerFactory(message => { if (message.kind !== 'chunk') messages.push(message); });
  const streamed = await streamWorkbook(await diskRoundTrip(new Blob([await wb.xlsx.writeBuffer()])), { workerFactory, headerRow: 'none' });
  const doc = await streamed.loadDocument();
  const header = messages.find(message => message.kind === 'model');
  expect(header.model.sheets).toEqual([{ id: sheet.id }, { id: wb.getWorksheet('Other')!.id }]);
  expect(header.model.worksheets.every((ws: any) => ws.rows.length === 0)).toBe(true);
  for (const kind of ['documentRows', 'preparedRows']) {
    const batches = messages.filter(message => message.kind === kind && (message.sheetId === sheet.id || message.sheetName === 'Large'));
    expect(batches.length).toBeGreaterThan(1);
    expect(batches.every(message => message.rows.length <= 128)).toBe(true);
    expect(batches.reduce((sum, message) => sum + message.rows.length, 0)).toBe(1000);
  }
  expect(doc.sheetNames).toEqual(['Large', 'Other']);
  doc.setCellValues('Large', [{ rowId: 999, columnId: 'B', value: 2000 }]);
  const reread = await workbookFromBlob(await diskRoundTrip(await doc.toBlob()));
  expect(reread.getWorksheet('Large')!.getCell('A1000').value).toBe('row-1000');
  expect(reread.getWorksheet('Large')!.getCell('B1000').value).toBe(2000);
}, 20000);

test('worker-prepared dynamic arrays retain caches outside the loaded view and dynamic identity after a structure edit', async () => {
  const streamed = await streamWorkbook(await diskRoundTrip(await dynamicArrayFixture()), {
    workerFactory: await xlsxWorkerFactory(), headerRow: 'none', maxRows: 2,
  });
  const doc = await streamed.loadDocument();
  const state = doc.sheet('Arrays')!;
  expect(state.rows[0]!.B).toBe('=SEQUENCE(A1)');
  expect(state.rows[1]!.B).toBe('');
  expect(state.formulaResults.get('1:B')).toBe(2);
  const accessor = doc.formulaDataAccessor('Arrays');
  expect(accessor.getCellValue(1, 2)).toBe('');
  doc.insertColumns('Arrays', 0);
  const exported = await diskRoundTrip(await doc.toBlob());
  const reread = await workbookFromBlob(exported);
  expect(reread.getWorksheet('Arrays')!.getCell('C3').value).toBe(3);
  const zip = await JSZip.loadAsync(await exported.arrayBuffer());
  expect(zip.file('xl/metadata.xml')).not.toBeNull();
  const xml = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
  expect(xml).toMatch(/<c r="C1"[^>]*cm="2"/);
  expect(xml).toContain('ref="C1:C3"');
}, 20000);

test('worker hydration preserves images, chart and pivot archives through editing and disk export', async () => {
  const original = await diskRoundTrip(await mediaWorkbookBlob({ externalConnection: true }));
  const streamed = await streamWorkbook(original, { workerFactory: await xlsxWorkerFactory() });
  const doc = await streamed.loadDocument();
  doc.setCellValues('Sales', [{ rowId: 0, columnId: 'B', value: 99 }]);
  const exported = await diskRoundTrip(await streamed.toBlob());
  const reread = await workbookFromBlob(exported);
  const sales = reread.getWorksheet('Sales')!;
  expect(sales.getCell('B2').value).toBe(99);
  expect(sales.getImages()).toHaveLength(1);
  expect(Buffer.from(reread.getImage(Number(sales.getImages()[0]!.imageId)).buffer!).toString('base64')).toBe(PNG);
  const before = await JSZip.loadAsync(await original.arrayBuffer());
  const after = await JSZip.loadAsync(await exported.arrayBuffer());
  for (const path of ['xl/charts/chart1.xml', 'xl/pivotTables/pivotTable1.xml', 'xl/pivotCache/pivotCacheRecords1.xml', 'xl/connections.xml']) {
    expect(after.file(path)).not.toBeNull();
    expect(parseXml(await after.file(path)!.async('string'))).toEqual(parseXml(await before.file(path)!.async('string')));
  }
}, 20000);
