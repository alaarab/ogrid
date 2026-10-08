import { expect, test } from 'bun:test';
import ExcelJS from 'exceljs';
import { workbookFromBlob } from '../sheetMapper';
import { XlsxWorkbookDocument } from '../xlsxDocument';

test('a 100k-row × 50-column worksheet opens without truncating, including its header', async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Large');
  ws.addRow(Array.from({ length: 50 }, (_, i) => `Field ${i + 1}`));
  // Sparse file, full-sized grid rectangle: exercises parse, mapping and document initialization
  // without making every suite carry the dense benchmark's multi-GB ExcelJS allocation.
  for (let r = 1; r <= 100_000; r++) ws.addRow([r]);
  ws.getCell('AX100001').value = 5_000_000;
  const parsed = await workbookFromBlob(new Blob([await wb.xlsx.writeBuffer()]));
  const start = performance.now();
  const doc = new XlsxWorkbookDocument(parsed);
  const state = doc.sheet('Large');
  expect(state?.rows).toHaveLength(100_000);
  expect(state?.columns).toHaveLength(50);
  expect(state?.rows[99_999].AX).toBe(5_000_000);
  expect(state?.source.truncated).toBeUndefined();
  // Catch accidental quadratic mapping; leave room for slow/shared CI machines.
  expect(performance.now() - start).toBeLessThan(15_000);
}, 60_000);
