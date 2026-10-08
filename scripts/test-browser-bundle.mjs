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
  const requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.evaluate(async () => {
    const api = await import('/ogrid-xlsx.js');
    const workbook = api.workbookFromGridData([{ a: 7, b: 14 }], [{ columnId: 'a', name: 'Input' }, { columnId: 'b', name: 'Result' }], (row, column) => row[column], { formulas: [{ row: 0, col: 1, formula: '=A1*2' }] });
    const sheet = workbook.worksheets[0];
    for (let i = 5; i <= 300; i++) sheet.getCell(`A${i}`).value = i;
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
    window.hydration = [];
    const workerFactory = () => {
      const worker = new Worker('/xlsxWorker.js', { type: 'module' });
      worker.addEventListener('message', ({ data }) => {
        if (data.kind === 'model') window.hydration.push({ kind: data.kind, sheets: data.model.sheets, rows: data.model.worksheets.map(sheet => sheet.rows.length) });
        if (data.kind === 'documentRows' || data.kind === 'preparedRows') window.hydration.push({ kind: data.kind, sheetId: data.sheetId, sheetName: data.sheetName, count: data.rows.length });
      });
      return worker;
    };
    window.unmountGrid = api.mount(document.getElementById('grid'), { blob: window.original, streaming: true, editable: true, streamOptions: { workerFactory }, onStreamedWorkbook: value => { window.streamed = value; }, onDocument: value => { window.doc = value; } });
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
  const hydration = await page.evaluate(() => window.hydration);
  const model = hydration.find(message => message.kind === 'model');
  assert.ok(model.rows.every(count => count === 0), 'initial worksheet models must contain no cell rows');
  assert.ok(model.sheets.every(sheet => Object.keys(sheet).length === 1 && 'id' in sheet), 'sheets must carry ordering metadata only');
  const rows = hydration.filter(message => message.kind === 'documentRows' && message.sheetId === 1);
  assert.ok(rows.length > 1 && rows.every(message => message.count <= 128), 'document transport must cross the hydration boundary with bounded batches');
  assert.equal(rows.reduce((total, message) => total + message.count, 0), 299, 'all populated worksheet rows must arrive');
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
  console.log('Browser bundle passed: real-worker preview/cancel, original bytes, lazy edit/export with styles/merges/validation/CF/notes/media, structural cache invalidation, bounded hydration, mount/unmount (21 assertions).');
  await page.evaluate(async () => {
    const api = await import('/ogrid-xlsx.js');
    const workbook = api.workbookFromGridData([{ a: 7, b: 14 }], [{ columnId: 'a', name: 'Input' }, { columnId: 'b', name: 'Result' }], (row, column) => row[column], { formulas: [{ row: 0, col: 1, formula: '=A1*2' }] });
    workbook.worksheets[0].getCell('A2').dataValidation = { type: 'whole', operator: 'between', formulae: [1, 10], showErrorMessage: true, errorStyle: 'stop', error: 'Choose 1 to 10.' };
    workbook.worksheets[0].getCell('B2').dataValidation = { type: 'list', formulae: ['"20,30"'] };
    window.unmountGrid = api.mount(document.getElementById('grid'), { blob: await api.xlsxBlobFromWorkbook(workbook), editable: true, circleInvalidData: true, toolbar: false, onDocument: doc => { window.gridDocument = doc; } });
  });
  await page.locator('td[data-column-id="B"] [data-validation-invalid]').waitFor();
  assert.ok(!requests.some(url => /DataValidationDialog.*\.js$/.test(url)), 'validation dialog must stay unloaded until requested');
  const inputCell = page.locator('td[data-column-id="A"] [data-row-index]').first();
  await inputCell.click();
  await inputCell.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Data validation…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Data validation', exact: true });
  await dialog.waitFor();
  assert.ok(requests.some(url => /DataValidationDialog.*\.js$/.test(url)), 'opening the editor must load its relative chunk');
  const box = await dialog.boundingBox();
  assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 1280 && box.y + box.height <= 720, 'dialog must fit in the viewport');
  assert.equal(await page.getByLabel('Minimum', { exact: true }).inputValue(), '1');
  await page.getByLabel('Maximum', { exact: true }).fill('15');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  assert.equal(await page.evaluate(() => window.gridDocument.sheet(window.gridDocument.sheetNames[0]).dataValidations.find(rule => rule.columnIds.includes('A')).value2), 15, 'editor must save numeric bounds');
  await inputCell.dblclick();
  const editor = page.locator('[data-ogrid-cell-editor] input');
  await editor.fill('20');
  await editor.press('Enter');
  await page.getByRole('dialog', { name: 'Invalid value', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.gridDocument.sheet(window.gridDocument.sheetNames[0]).rows[0].A), 7, 'stop must reject an edit in the shipped bundle');
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await page.evaluate(() => window.unmountGrid());
  await page.waitForFunction(() => document.getElementById('grid').childElementCount === 0);
  assert.deepEqual(errors, [], 'mount/import/unmount must not raise browser errors');
  console.log('Browser bundle passed: static ESM/CSS, XLSX formula value, invalid-data circles, deferred validation editor, saved rules, rejected edit, mount and unmount.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
