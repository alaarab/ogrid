/** Runtime check of the shipped no-bundler ESM and CSS. Run after turbo build. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import ExcelJS from '../packages/react-xlsx/node_modules/exceljs/excel.js';

const dist = new URL('../packages/react-xlsx-browser/dist/', import.meta.url);
const assets = new Map(await Promise.all((await readdir(dist)).filter(name => /\.(js|css)$/.test(name)).map(async name => [ `/${name}`, await readFile(new URL(name, dist)) ])));
const server = createServer((request, response) => {
  if (request.url === '/') {
    response.setHeader('content-type', 'text/html');
    response.end('<link rel="stylesheet" href="/ogrid-xlsx.css"><div id="grid" style="height:600px"></div>');
  } else if (assets.has(request.url)) {
    response.setHeader('content-type', request.url.endsWith('.js') ? 'text/javascript' : 'text/css');
    response.end(assets.get(request.url));
  } else response.writeHead(404).end();
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  let workers = 0;
  page.on('worker', () => { workers++; });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.evaluate(async () => {
    const api = await import('/ogrid-xlsx.js');
    const workbook = api.workbookFromGridData([{ a: 7, b: 14 }], [{ columnId: 'a', name: 'Input' }, { columnId: 'b', name: 'Result' }], (row, column) => row[column], { formulas: [{ row: 0, col: 1, formula: '=A1*2' }] });
    const sheet = workbook.worksheets[0];
    sheet.getCell('A2').font = { bold: true, color: { argb: 'FF217346' } };
    sheet.getCell('A2').note = 'Keep this note';
    sheet.getCell('A2').dataValidation = { type: 'whole', operator: 'between', formulae: [0, 100] };
    sheet.getCell('A4').value = 'Merged'; sheet.mergeCells('A4:B4');
    sheet.addConditionalFormatting({ ref: 'A2', rules: [{ type: 'cellIs', operator: 'greaterThan', formulae: ['0'], priority: 1, style: { font: { italic: true } } }] });
    const untouched = workbook.addWorksheet('Untouched'); untouched.getCell('A1').value = 'Unopened';
    untouched.getCell('B1').value = { formula: `${sheet.name}!A2`, result: 7 };
    const image = workbook.addImage({ base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2OZAAAAAASUVORK5CYII=', extension: 'png' });
    untouched.addImage(image, 'B2:C3');
    window.original = await api.xlsxBlobFromWorkbook(workbook);
    window.unmountGrid = api.mount(document.getElementById('grid'), { blob: window.original, streaming: true, editable: true, onStreamedWorkbook: value => { window.streamed = value; }, onDocument: value => { window.doc = value; } });
  });
  await page.locator('td[data-column-id="B"]').filter({ hasText: '14' }).waitFor({ timeout: 20_000 });
  assert.ok(await page.evaluate(() => [...document.styleSheets].some(sheet => sheet.href?.endsWith('/ogrid-xlsx.css') && sheet.cssRules.length > 0)), 'shipped stylesheet must load');
  await page.waitForFunction(() => !!window.streamed);
  assert.equal(await page.evaluate(async () => {
    const before = new Uint8Array(await window.original.arrayBuffer());
    const after = new Uint8Array(await (await window.streamed.toBlob()).arrayBuffer());
    return before.length === after.length && before.every((value, i) => value === after[i]);
  }), true, 'unedited streamed export must preserve original ZIP bytes');
  await page.getByRole('button', { name: 'Enable editing' }).click();
  await page.waitForFunction(() => !!window.doc);
  assert.ok(workers >= 2, 'preview and lazy document load must each use a real worker');
  const bytes = await page.evaluate(async () => {
    const name = window.doc.sheetNames[0];
    window.doc.setCellValues(name, [{ rowId: 0, columnId: 'A', value: 9 }]);
    return Array.from(new Uint8Array(await (await window.streamed.toBlob()).arrayBuffer()));
  });
  const exported = new ExcelJS.Workbook(); await exported.xlsx.load(Buffer.from(bytes));
  const sheet = exported.worksheets[0];
  assert.equal(sheet.getCell('A2').value, 9);
  assert.equal(sheet.getCell('A2').font.bold, true);
  assert.equal(sheet.getCell('A2').dataValidation.type, 'whole');
  assert.equal(typeof sheet.getCell('A2').note === 'string' ? sheet.getCell('A2').note : sheet.getCell('A2').note.texts[0].text, 'Keep this note');
  assert.equal(sheet.getCell('B4').master.address, 'A4');
  assert.equal(sheet.conditionalFormattings[0].ref, 'A2');
  assert.equal(exported.getWorksheet('Untouched').getCell('A1').value, 'Unopened');
  assert.equal(exported.getWorksheet('Untouched').getImages().length, 1);
  assert.equal(await page.evaluate(() => {
    const name = window.doc.sheetNames[0];
    window.doc.insertRows(name, 0);
    return window.doc.sheet('Untouched').rows[0].B;
  }), `=${sheet.name}!A3`, 'opening a worker-prepared sheet after a structural edit must read shifted formulas');
  await page.evaluate(() => window.unmountGrid());
  await page.waitForFunction(() => document.getElementById('grid').childElementCount === 0);
  assert.deepEqual(errors, [], 'mount/import/unmount must not raise browser errors');
  // Cancellation crosses the actual worker transport as well as the React UI.
  assert.equal(await page.evaluate(async () => {
    const api = await import('/ogrid-xlsx.js');
    const abort = new AbortController(); let chunks = 0;
    try {
      await api.streamWorkbook(window.original, { signal: abort.signal, chunkSize: 1, onChunk: () => { chunks++; abort.abort(); } });
      return false;
    } catch (error) { return error.name === 'AbortError' && chunks === 1; }
  }), true, 'cancel must terminate a real streaming worker after its first chunk');
  console.log('Browser bundle passed: real-worker preview/cancel, original bytes, lazy edit/export with styles/merges/validation/CF/notes/media, structural cache invalidation, mount/unmount (17 assertions).');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
