// Run from the repo root after build. Fixtures live outside the checkout.
// bun .../benchmark-streaming.mjs --generate /tmp/ogrid-stream-fixtures
// node .../benchmark-streaming.mjs --browser stream /tmp/.../10k20.xlsx
// node .../benchmark-streaming.mjs --browser full /tmp/.../10k20.xlsx
import { createServer } from 'node:http';
import { mkdir, readFile, readdir, copyFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import ExcelJS from '../node_modules/exceljs/excel.js';

const [command, mode, filename] = process.argv.slice(2);
if (command === '--generate') {
  await mkdir(mode, { recursive: true });
  for (const [name, rows, cols, styled] of [['10k20', 10000, 20, false], ['100k50', 100000, 50, false], ['styled20k30', 20000, 30, true]]) {
    const path = join(mode, name + '.xlsx');
    // Reuse the structure branch's dense fixture when supplied on this machine.
    if (name === '100k50') {
      try { await copyFile('/tmp/ogrid-xlsx-structure-100k50.xlsx', path); continue; } catch { /* Generate if absent. */ }
    }
    const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ filename: path, useStyles: styled, useSharedStrings: true });
    const ws = wb.addWorksheet('Dense');
    ws.addRow(Array.from({ length: cols }, (_, c) => `Column ${c + 1}`)).commit();
    for (let r = 0; r < rows; r++) {
      const row = ws.addRow(Array.from({ length: cols }, (_, c) => r * cols + c));
      if (styled) row.eachCell(cell => { cell.numFmt = '#,##0.00'; cell.font = { bold: r % 2 === 0, color: { argb: 'FF217346' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: r % 2 ? 'FFFFF2CC' : 'FFE2EFDA' } }; });
      row.commit();
    }
    ws.commit(); await wb.commit();
    console.log('Generated ' + path);
  }
} else if (command === '--browser') {
  const dist = new URL('../../react-xlsx-browser/dist/', import.meta.url);
  const assets = new Map(await Promise.all((await readdir(dist)).filter(name => /\.(js|css)$/.test(name)).map(async name => ['/' + name, await readFile(new URL(name, dist))])));
  const input = await readFile(filename);
  const server = createServer((request, response) => {
    if (request.url === '/') { response.setHeader('content-type', 'text/html'); response.end('<link rel="stylesheet" href="/ogrid-xlsx.css"><div id="grid" style="height:600px"></div>'); }
    else if (request.url === '/fixture.xlsx') response.end(input);
    else if (assets.has(request.url)) { response.setHeader('content-type', request.url.endsWith('.js') ? 'text/javascript' : 'text/css'); response.end(assets.get(request.url)); }
    else response.writeHead(404).end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browserServer = await chromium.launchServer({ headless: true });
  const browser = await chromium.connect(browserServer.wsEndpoint());
  let peak = 0;
  // Aggregate browser process-tree RSS, sampled every 100ms; includes worker heaps.
  const rss = (pid) => {
    try {
      const status = readFileSync(`/proc/${pid}/status`, 'utf8');
      const children = readFileSync(`/proc/${pid}/task/${pid}/children`, 'utf8').trim().split(/\s+/).filter(Boolean);
      return Number(/VmRSS:\s+(\d+)/.exec(status)?.[1] ?? 0) + children.reduce((sum, child) => sum + rss(Number(child)), 0);
    } catch { return 0; }
  };
  const interval = setInterval(() => { peak = Math.max(peak, rss(browserServer.process().pid)); }, 100);
  try {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.evaluate(async (streaming) => {
      const api = await import('/ogrid-xlsx.js');
      const blob = await (await fetch('/fixture.xlsx')).blob();
      const timing = window.timing = { start: performance.now(), first: null, total: null, maxTaskMs: 0 };
      const observer = new MutationObserver(() => {
        if (timing.first === null && document.querySelector('tbody td[data-column-id]')) requestAnimationFrame(() => { timing.first ??= performance.now() - timing.start; });
      });
      observer.observe(document.getElementById('grid'), { childList: true, subtree: true });
      new PerformanceObserver(list => { for (const entry of list.getEntries()) timing.maxTaskMs = Math.max(timing.maxTaskMs, entry.duration); }).observe({ type: 'longtask', buffered: true });
      const complete = () => { timing.total = performance.now() - timing.start; };
      api.mount(document.getElementById('grid'), { blob, streaming, height: 600, onDocument: streaming ? undefined : complete, onStreamedWorkbook: streaming ? complete : undefined });
    }, mode === 'stream');
    await page.waitForFunction(() => window.timing?.total !== null && window.timing?.first !== null, null, { timeout: 180000 });
    const timing = await page.evaluate(() => window.timing);
    if (errors.length) throw new Error(errors.join('\n'));
    console.log(JSON.stringify({ file: filename, mode, firstRowsSeconds: Number((timing.first / 1000).toFixed(3)), totalSeconds: Number((Math.max(timing.first, timing.total) / 1000).toFixed(3)), peakBrowserRssMiB: Math.round(peak / 1024), maxMainThreadTaskMs: Math.round(timing.maxTaskMs), fileMiB: Number((input.length / 1024 ** 2).toFixed(2)) }));
  } finally { clearInterval(interval); await browser.close(); await browserServer.close(); await new Promise(resolve => server.close(resolve)); }
} else throw new Error('Use --generate DIRECTORY or --browser full|stream FILE');
