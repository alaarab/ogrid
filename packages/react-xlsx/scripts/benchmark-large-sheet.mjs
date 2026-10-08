// Run: bun packages/react-xlsx/scripts/benchmark-large-sheet.mjs
// Dense numeric 100k × 50, plus a header; this is deliberately outside the unit suite.
import ExcelJS from 'exceljs';
import { readFileSync, writeFileSync } from 'node:fs';
import { workbookFromBlob } from '../src/sheetMapper.ts';
import { XlsxWorkbookDocument } from '../src/xlsxDocument.ts';

const report = (phase, start) => console.log(JSON.stringify({
  phase, seconds: Number(((performance.now() - start) / 1000).toFixed(2)),
  rssMiB: Math.round(process.memoryUsage().rss / 1024 ** 2),
  heapMiB: Math.round(process.memoryUsage().heapUsed / 1024 ** 2),
  peakRssMiB: Math.round(process.resourceUsage().maxRSS / 1024),
}));

// --write file.xlsx and --read file.xlsx allow measuring opening in a fresh process.
const [mode, filename] = process.argv.slice(2);
let start = performance.now();
let blob;
if (mode === '--read') {
  blob = new Blob([readFileSync(filename)]);
} else {
  let wb = new ExcelJS.Workbook();
  let ws = wb.addWorksheet('Dense');
  ws.addRow(Array.from({ length: 50 }, (_, c) => `Column ${c + 1}`));
  for (let r = 0; r < 100_000; r++) ws.addRow(Array.from({ length: 50 }, (_, c) => r * 50 + c));
  report('generate', start);
  start = performance.now();
  blob = new Blob([await wb.xlsx.writeBuffer()]);
  console.log(JSON.stringify({ fileMiB: Number((blob.size / 1024 ** 2).toFixed(2)) }));
  report('write', start);
  if (mode === '--write') {
    writeFileSync(filename, new Uint8Array(await blob.arrayBuffer()));
    process.exit(0);
  }
  wb = null;
  ws = null;
  globalThis.Bun?.gc(true);
}
start = performance.now();
const parsed = await workbookFromBlob(blob);
report('parse', start);
start = performance.now();
const doc = new XlsxWorkbookDocument(parsed);
const state = doc.sheet('Dense');
report('map-document', start);
if (state.rows.length !== 100_000 || state.columns.length !== 50 || state.source.truncated || state.rows[99_999].AX !== 4_999_999) {
  throw new Error('Dense worksheet did not load completely');
}
