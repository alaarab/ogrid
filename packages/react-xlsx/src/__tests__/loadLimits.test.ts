import { describe, expect, spyOn, test } from 'bun:test';
import ExcelJS from 'exceljs';
import { sheetToGridData, workbookFromBlob } from '../sheetMapper';

async function fixture(): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet('Values').addRows([['x', 'y'], [1, 2], [3, 4]]);
  return new Blob([await wb.xlsx.writeBuffer()]);
}

/** Rewrite a plain ZIP into ZIP64 form: every central directory entry moves its
 * uncompressed size into a ZIP64 extra field, and the end record points at a
 * ZIP64 end record through its locator. */
async function toZip64(blob: Blob): Promise<Blob> {
  const src = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(src.buffer);
  const end = src.byteLength - 22;
  const count = view.getUint16(end + 10, true);
  const directory = view.getUint32(end + 16, true);
  const parts: Uint8Array[] = [src.subarray(0, directory)];
  let pos = directory;
  let size = 0;
  for (let i = 0; i < count; i++) {
    const head = 46 + view.getUint16(pos + 28, true) + view.getUint16(pos + 30, true);
    const length = head + view.getUint16(pos + 32, true);
    const entry = new Uint8Array(length + 12);
    entry.set(src.subarray(pos, pos + head));
    entry.set(src.subarray(pos + head, pos + length), head + 12);
    const out = new DataView(entry.buffer);
    out.setUint32(24, 0xffffffff, true);
    out.setUint16(30, view.getUint16(pos + 30, true) + 12, true);
    out.setUint16(head, 1, true);
    out.setUint16(head + 2, 8, true);
    out.setUint32(head + 4, view.getUint32(pos + 24, true), true);
    parts.push(entry);
    pos += length;
    size += entry.byteLength;
  }
  const tail = new DataView(new ArrayBuffer(56 + 20 + 22));
  tail.setUint32(0, 0x06064b50, true);
  tail.setUint32(4, 44, true);
  tail.setUint32(24, count, true);
  tail.setUint32(32, count, true);
  tail.setUint32(40, size, true);
  tail.setUint32(48, directory, true);
  tail.setUint32(56, 0x07064b50, true);
  tail.setUint32(64, directory + size, true);
  tail.setUint32(72, 1, true);
  tail.setUint32(76, 0x06054b50, true);
  tail.setUint16(84, 0xffff, true);
  tail.setUint16(86, 0xffff, true);
  tail.setUint32(88, 0xffffffff, true);
  tail.setUint32(92, 0xffffffff, true);
  return new Blob([...parts, new Uint8Array(tail.buffer)]);
}

describe('workbookFromBlob load limits', () => {
  test('rejects input bytes before reading the blob', async () => {
    const blob = await fixture();
    const read = spyOn(blob, 'arrayBuffer');
    try {
      await expect(workbookFromBlob(blob, { maxFileBytes: blob.size - 1 })).rejects.toThrow('maxFileBytes');
      expect(read).not.toHaveBeenCalled();
    } finally { read.mockRestore(); }
  });

  test('rejects declared ZIP entry sizes before ExcelJS parsing', async () => {
    const bytes = await (await fixture()).arrayBuffer();
    const view = new DataView(bytes);
    let central = -1;
    for (let pos = 0; pos + 46 <= bytes.byteLength; pos++) {
      if (view.getUint32(pos, true) === 0x02014b50) { central = pos; break; }
    }
    expect(central).toBeGreaterThan(0);
    view.setUint32(central + 24, 100_000_000, true);
    await expect(workbookFromBlob(new Blob([bytes]), { maxUncompressedBytes: 1_000_000 }))
      .rejects.toThrow('maxUncompressedBytes');
  });

  test('checks the total uncompressed size, not just individual entries', async () => {
    await expect(workbookFromBlob(await fixture(), { maxUncompressedBytes: 100 }))
      .rejects.toThrow('maxUncompressedBytes');
  });

  test('reads ZIP64 directories and tolerates bytes after the end record', async () => {
    const zip64 = await toZip64(await fixture());
    expect((await workbookFromBlob(zip64)).worksheets[0].getCell('A2').value).toBe(1);
    await expect(workbookFromBlob(zip64, { maxUncompressedBytes: 100 })).rejects.toThrow('maxUncompressedBytes');
    const padded = new Blob([await fixture(), new Uint8Array(16)]);
    expect((await workbookFromBlob(padded)).worksheets[0].getCell('A2').value).toBe(1);
  });

  test('rejects truncated ZIP directories and tolerates non-finite options', async () => {
    const blob = await fixture();
    await expect(workbookFromBlob(blob.slice(0, blob.size - 10))).rejects.toThrow('ZIP directory');
    const wb = await workbookFromBlob(blob, { maxFileBytes: NaN, maxUncompressedBytes: Infinity });
    expect(wb.worksheets[0].getCell('A2').value).toBe(1);
  });

  test('CSV row, column and cell limits bound the synthesized workbook', async () => {
    const blob = new Blob(['a,b,c,d\n1,2,3,4\n5,6,7,8\n9,10,11,12\n']);
    const rowLimited = await workbookFromBlob(blob, { maxRows: 2 });
    expect(rowLimited.worksheets[0].rowCount).toBe(2);
    expect(sheetToGridData(rowLimited.worksheets[0]).parseTruncated).toBe(true);
    const colLimited = await workbookFromBlob(blob, { maxCols: 2 });
    expect(colLimited.worksheets[0].columnCount).toBe(2);
    expect(sheetToGridData(colLimited.worksheets[0]).parseTruncated).toBe(true);
    const cellLimited = await workbookFromBlob(blob, { maxCells: 3 });
    expect(cellLimited.worksheets[0].rowCount).toBe(1);
    expect(cellLimited.worksheets[0].columnCount).toBe(3);
    expect(sheetToGridData(cellLimited.worksheets[0]).parseTruncated).toBe(true);
  });

  test('CSV fields, quoting and trailing newlines survive a limit boundary', async () => {
    const blob = new Blob(['"a\nb",c\n"",d\n']);
    const wb = await workbookFromBlob(blob, { maxRows: 2, maxCols: 2, maxCells: 4 });
    const out = sheetToGridData(wb.worksheets[0], { headerRow: 'none' });
    expect(out.rows.map((r) => [r.A, r.B])).toEqual([['a\nb', 'c'], ['', 'd']]);
    expect(out.parseTruncated).toBeUndefined();
  });
});
