import { SaxesParser } from 'saxes';
import { StreamingZip } from './streamingZip';
import { checkAbort, columnLetter, streamLimit, type XlsxStreamOptions } from './streamingTypes';
import type { SheetRow } from './sheetMapper';

const parser = () => new SaxesParser();
const local = (name: string) => name.slice(name.indexOf(':') + 1);
const unescapeText = (text: string) => text.replace(/_x([0-9a-f]{4})_/gi, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)));
function address(ref: string): { row: number; col: number } {
  const match = /^\$?([A-Z]+)\$?(\d+)$/i.exec(ref);
  if (!match) throw new Error(`Invalid XLSX cell address: ${ref}`);
  let col = 0;
  for (const ch of (match[1] as string).toUpperCase()) col = col * 26 + ch.charCodeAt(0) - 64;
  const row = Number(match[2]);
  if (row < 1 || row > 1_048_576 || col > 16384) throw new Error('XLSX cell address exceeds Excel limits');
  return { row, col };
}

/** Browser-compatible SAX reader. Rows carry cached formula results; originals stay in the Blob. */
export async function readXlsxStream(blob: Blob, options: XlsxStreamOptions = {}): Promise<void> {
  checkAbort(options.signal);
  const maxFile = streamLimit(options.maxFileBytes, 50 * 1024 ** 2);
  if (blob.size > maxFile) throw new Error(`File exceeds maxFileBytes (${maxFile})`);
  const zip = await StreamingZip.open(blob, options.maxUncompressedBytes, options.signal);
  const relationships = new Map<string, string>();
  const rels = parser();
  rels.on('opentag', ({ name, attributes: a }) => {
    if (local(name) !== 'Relationship' || a.TargetMode === 'External') return;
    const target = String(a.Target ?? '');
    // Resolve package-relative targets without permitting traversal outside the archive.
    const path = new URL(target, 'https://xlsx.invalid/xl/workbook.xml').pathname.slice(1);
    relationships.set(String(a.Id), path);
  });
  await zip.xml('xl/_rels/workbook.xml.rels', rels);
  const sheets: Array<{ name: string; path: string }> = [];
  let date1904 = false;
  const workbook = parser();
  workbook.on('opentag', ({ name, attributes: a }) => {
    if (local(name) === 'workbookPr') date1904 = a.date1904 === '1' || a.date1904 === 'true';
    if (local(name) === 'sheet') {
      const path = relationships.get(String(a['r:id']));
      if (path && zip.entries.has(path) && /worksheets\//.test(path)) sheets.push({ name: String(a.name), path });
    }
  });
  await zip.xml('xl/workbook.xml', workbook);
  const strings: string[] = [];
  if (zip.entries.has('xl/sharedStrings.xml')) {
    const shared = parser();
    let text = '';
    let inText = false;
    let phonetic = false;
    let stringBytes = 0;
    const maxStringBytes = streamLimit(options.maxSharedStringsBytes, 32 * 1024 ** 2);
    shared.on('opentag', ({ name }) => {
      const tag = local(name);
      if (tag === 'si') text = '';
      if (tag === 'rPh') phonetic = true;
      if (tag === 't' && !phonetic) inText = true;
    });
    shared.on('text', (value) => {
      if (!inText) return;
      stringBytes += value.length * 2;
      if (stringBytes > maxStringBytes) throw new Error(`XLSX exceeds maxSharedStringsBytes (${maxStringBytes})`);
      text += value;
    });
    shared.on('closetag', ({ name }) => {
      const tag = local(name);
      if (tag === 't') inText = false;
      if (tag === 'rPh') phonetic = false;
      if (tag === 'si') {
        stringBytes += 8;
        if (stringBytes > maxStringBytes) throw new Error(`XLSX exceeds maxSharedStringsBytes (${maxStringBytes})`);
        strings.push(unescapeText(text));
      }
    });
    await zip.xml('xl/sharedStrings.xml', shared);
  }
  const dateStyles = new Set<number>();
  if (zip.entries.has('xl/styles.xml')) {
    const styles = parser();
    const dateFormats = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);
    let inXfs = false;
    let index = 0;
    styles.on('opentag', ({ name, attributes: a }) => {
      const tag = local(name);
      if (tag === 'numFmt') {
        const format = String(a.formatCode).replace(/\[[^\]]*\]|"[^"]*"|\\./g, '');
        if (/[ymdhis]/i.test(format)) dateFormats.add(Number(a.numFmtId));
      }
      if (tag === 'cellXfs') inXfs = true;
      if (tag === 'xf' && inXfs) { if (dateFormats.has(Number(a.numFmtId))) dateStyles.add(index); index++; }
    });
    styles.on('closetag', ({ name }) => { if (local(name) === 'cellXfs') inXfs = false; });
    await zip.xml('xl/styles.xml', styles);
  }
  const chunkSize = Math.min(4096, streamLimit(options.chunkSize, 256));
  const maxRows = streamLimit(options.maxRows, 1_048_576);
  const maxCols = streamLimit(options.maxCols, 1000);
  const maxCells = streamLimit(options.maxCells, 5_100_000);
  const totalBytes = sheets.reduce((n, sheet) => n + (zip.entries.get(sheet.path)?.compressed ?? 0), 0);
  let completedBytes = 0;
  options.onProgress?.(0);
  for (const sheet of sheets) {
    let rowCount = 0;
    let columnCount = 0;
    let row: SheetRow = { __rowIdx: 0 };
    let currentRow = 0;
    let currentCol = 0;
    let type = '';
    let style = 0;
    let text = '';
    let capture = false;
    let formula = false;
    let phonetic = false;
    let cells = 0;
    let hasValue = false;
    let batch: SheetRow[] = [];
    const batches: SheetRow[][] = [];
    const merges: string[] = [];
    const sax = parser();
    sax.on('opentag', ({ name, attributes: a }) => {
      const tag = local(name);
      if (tag === 'row') {
        currentRow = Number(a.r) || currentRow + 1;
        if (!Number.isInteger(currentRow) || currentRow < 1 || currentRow > 1_048_576) throw new Error('XLSX row exceeds Excel limits');
        currentCol = 0; row = { __rowIdx: currentRow - 1 }; hasValue = false;
      }
      if (tag === 'c') {
        const at = a.r ? address(String(a.r)) : { row: currentRow, col: currentCol + 1 };
        currentCol = at.col; type = String(a.t ?? 'n'); style = Number(a.s ?? 0); text = ''; formula = false;
      }
      if (tag === 'rPh') phonetic = true;
      if (tag === 'v' || (tag === 't' && !phonetic)) capture = true;
      if (tag === 'f') formula = true;
      if (tag === 'mergeCell' && a.ref) merges.push(String(a.ref));
    });
    sax.on('text', (value) => { if (capture) text += value; });
    sax.on('closetag', ({ name }) => {
      const tag = local(name);
      if (tag === 'v' || tag === 't') capture = false;
      if (tag === 'rPh') phonetic = false;
      if (tag === 'c') {
        if (!text && !formula && type !== 'inlineStr' && type !== 'str') return;
        hasValue = true;
        columnCount = Math.max(columnCount, currentCol);
        if (currentRow > maxRows || currentCol > maxCols || cells >= maxCells) return;
        let value: unknown;
        if (formula && text === '') value = undefined;
        else if (type === 's') {
          const index = Number(text);
          if (!Number.isInteger(index) || index < 0 || index >= strings.length) throw new Error('Invalid XLSX shared string');
          value = strings[index];
        } else if (type === 'b') value = text === '1';
        else if (type === 'e' || type === 'str' || type === 'inlineStr') value = unescapeText(text);
        else if (type === 'd') value = new Date(text);
        else {
          const number = Number(text);
          value = dateStyles.has(style) ? new Date(Math.round((number - 25569 + (date1904 ? 1462 : 0)) * 86400000)) : number;
        }
        row[columnLetter(currentCol - 1)] = value;
        cells++;
      }
      if (tag === 'row' && hasValue) {
        rowCount = Math.max(rowCount, currentRow);
        if (currentRow <= maxRows && currentRow <= maxCells) {
          const columns = Math.min(columnCount, maxCols, maxCells);
          for (let c = 0; c < columns; c++) { const letter = columnLetter(c); if (!(letter in row)) row[letter] = ''; }
          batch.push(row);
        }
        if (batch.length >= chunkSize) { batches.push(batch); batch = []; }
      }
    });
    const deliver = async (rows: SheetRow[], complete: boolean) => {
      checkAbort(options.signal);
      const columns = Math.min(columnCount, maxCols, maxCells);
      const count = Math.min(rowCount, maxRows, columns ? Math.floor(maxCells / columns) : 0);
      await options.onChunk?.({ sheetName: sheet.name, rows, rowCount, columnCount, complete, truncated: columns < columnCount || count < rowCount });
      checkAbort(options.signal);
    };
    await zip.xml(sheet.path, sax, async () => {
      for (const rows of batches.splice(0)) await deliver(rows, false);
    }, (bytes) => options.onProgress?.(Math.min(99, Math.floor(100 * (completedBytes + bytes) / Math.max(1, totalBytes)))));
    // ExcelJS counts the extent of merged-away cells as the master's value.
    for (const merge of merges) {
      const [first, last] = merge.split(':');
      const at = address(last ?? first as string);
      rowCount = Math.max(rowCount, at.row); columnCount = Math.max(columnCount, at.col);
    }
    for (const rows of batches.splice(0)) await deliver(rows, false);
    await deliver(batch, true);
    completedBytes += zip.entries.get(sheet.path)?.compressed ?? 0;
  }
  options.onProgress?.(100);
}
