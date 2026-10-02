/** Runtime check of the shipped no-bundler ESM and CSS. Run after turbo build. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const dist = new URL('../packages/react-xlsx-browser/dist/', import.meta.url);
const assets = new Map(await Promise.all(['ogrid-xlsx.js', 'ogrid-xlsx.css'].map(async name => [ `/${name}`, await readFile(new URL(name, dist)) ])));
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
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.evaluate(async () => {
    const api = await import('/ogrid-xlsx.js');
    const workbook = api.workbookFromGridData([{ a: 7, b: 14 }], [{ columnId: 'a', name: 'Input' }, { columnId: 'b', name: 'Result' }], (row, column) => row[column], { formulas: [{ row: 0, col: 1, formula: '=A1*2' }] });
    window.unmountGrid = api.mount(document.getElementById('grid'), { blob: await api.xlsxBlobFromWorkbook(workbook) });
  });
  await page.locator('td[data-column-id="B"]').filter({ hasText: '14' }).waitFor({ timeout: 20_000 });
  assert.ok(await page.evaluate(() => [...document.styleSheets].some(sheet => sheet.href?.endsWith('/ogrid-xlsx.css') && sheet.cssRules.length > 0)), 'shipped stylesheet must load');
  await page.evaluate(() => window.unmountGrid());
  await page.waitForFunction(() => document.getElementById('grid').childElementCount === 0);
  assert.deepEqual(errors, [], 'mount/import/unmount must not raise browser errors');
  console.log('Browser bundle passed: static ESM/CSS, XLSX formula value, mount and unmount.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
