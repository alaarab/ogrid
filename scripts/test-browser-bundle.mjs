/** Runtime check of the shipped no-bundler ESM and CSS. Run after turbo build. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

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
  const requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.evaluate(async () => {
    const api = await import('/ogrid-xlsx.js');
    const workbook = api.workbookFromGridData([{ a: 7, b: 14 }], [{ columnId: 'a', name: 'Input' }, { columnId: 'b', name: 'Result' }], (row, column) => row[column], { formulas: [{ row: 0, col: 1, formula: '=A1*2' }] });
    workbook.worksheets[0].getCell('A2').dataValidation = { type: 'whole', operator: 'between', formulae: [1, 10], showErrorMessage: true, errorStyle: 'stop', error: 'Choose 1 to 10.' };
    workbook.worksheets[0].getCell('B2').dataValidation = { type: 'list', formulae: ['"20,30"'] };
    window.unmountGrid = api.mount(document.getElementById('grid'), { blob: await api.xlsxBlobFromWorkbook(workbook), editable: true, circleInvalidData: true, toolbar: false, onDocument: doc => { window.gridDocument = doc; } });
  });
  await page.locator('td[data-column-id="B"]').filter({ hasText: '14' }).waitFor({ timeout: 20_000 });
  await page.locator('td[data-column-id="B"] [data-validation-invalid]').waitFor();
  assert.ok(await page.evaluate(() => [...document.styleSheets].some(sheet => sheet.href?.endsWith('/ogrid-xlsx.css') && sheet.cssRules.length > 0)), 'shipped stylesheet must load');
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
