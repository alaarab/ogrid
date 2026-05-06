// Translates an ExcelJS workbook (or a parsed CSV/TSV) into the shape
// OGrid expects. Pure module — no React, no DOM, no side effects.
// Reused by tests directly without React Testing Library.
//
// Supported formats:
//   - .xlsx (read via ExcelJS — actively maintained, MIT, no known CVEs).
//   - .csv / .tsv (parsed inline, RFC 4180, no extra dep).
//
// Dropped vs. earlier SheetJS-backed builds: .xls, .xlsm, .xlsb, .ods.
// SheetJS (`xlsx` on npm) is permanently stuck at the vulnerable
// 0.18.5 (CVE-2023-30533, CVE-2024-22363) and the patched build is
// only available off cdn.sheetjs.com. ExcelJS is our maintained
// replacement; it speaks modern xlsx natively. Legacy formats are
// rare in practice; consumers can fall back to a "view source" path
// for those.

import ExcelJS from 'exceljs';
import type { IColumnDef } from '@alaarab/ogrid-core';

/**
 * Output of sheetToGridData. Feeds straight into <OGrid> as
 * `columns={data.columns}` `data={data.rows}` `initialFormulas={data.initialFormulas}`.
 */
export interface SheetGridData {
  columns: IColumnDef<SheetRow>[];
  rows: SheetRow[];
  initialFormulas: Array<{ col: number; row: number; formula: string }>;
}

/** Row shape — keyed by column letter (A, B, C, ..., AA, AB, ...).
 *  `__rowIdx` is a synthetic id (0-based) so getRowId can be `(r) => r.__rowIdx`. */
export type SheetRow = Record<string, unknown> & { __rowIdx: number };

const SAMPLE_SIZE = 50; // rows inspected for column-type detection

/**
 * Read an xlsx Blob into an ExcelJS Workbook. Falls back to a CSV/TSV
 * parser when the bytes don't look like a zip-backed xlsx (xlsx files
 * start with `PK\x03\x04`). The fallback synthesizes a single-sheet
 * workbook so downstream code paths stay identical.
 */
export async function workbookFromBlob(blob: Blob): Promise<ExcelJS.Workbook> {
  const buf = await blob.arrayBuffer();
  if (looksLikeXlsx(buf)) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    return wb;
  }
  // Fallback: assume CSV-ish text. Sniff the delimiter from the first
  // non-empty line; tab beats comma if a tab is present.
  const text = new TextDecoder('utf-8').decode(buf);
  const delimiter = sniffDelimiter(text);
  const rows = parseDelimited(text, delimiter);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  for (const row of rows) ws.addRow(row);
  return wb;
}

function looksLikeXlsx(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 4) return false;
  const head = new Uint8Array(buf, 0, 4);
  // ZIP local-file header: "PK\x03\x04". xlsx is a zip container.
  return head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
}

function sniffDelimiter(text: string): string {
  for (const line of text.split(/\r\n|\n|\r/)) {
    if (!line) continue;
    if (line.includes('\t')) return '\t';
    return ',';
  }
  return ',';
}

/** RFC 4180-shaped CSV/TSV reader. Handles quoted fields with embedded
 *  delimiters, escaped quotes (""), CRLF/LF/CR line endings, and a
 *  trailing newline. Numbers and dates stay as strings — sheetToGridData
 *  will classify them as `text` columns. Consumers wanting coercion
 *  should preprocess. */
function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; continue; }
        inQuotes = false;
        continue;
      }
      field += ch;
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === delimiter) { cur.push(field); field = ''; continue; }
    if (ch === '\r' && text[i + 1] === '\n') {
      cur.push(field); rows.push(cur); cur = []; field = ''; i++;
      continue;
    }
    if (ch === '\n' || ch === '\r') {
      cur.push(field); rows.push(cur); cur = []; field = '';
      continue;
    }
    field += ch;
  }
  if (field !== '' || cur.length > 0) { cur.push(field); rows.push(cur); }
  return rows;
}

/**
 * Map one ExcelJS worksheet to OGrid columns + rows + initialFormulas.
 *
 * Column ids are Excel letters (A, B, …, AA) so the grid's
 * `cellReferences` mode shows A1/B1 notation that matches the
 * source workbook exactly.
 *
 * Row keys are the same letters; ogrid's default valueGetter reads
 * `row[columnId]` so no per-column getter is needed.
 *
 * Type detection samples up to SAMPLE_SIZE rows per column. All-numbers
 * → 'numeric', all-Date instances → 'date', mixed/text → 'text'.
 *
 * Formulas (cell value `{formula, result}`) get pulled into
 * initialFormulas; the cached `result` still goes into the row so the
 * grid renders the right thing on first paint, before the engine
 * recalculates.
 */
export function sheetToGridData(
  sheet: ExcelJS.Worksheet | null | undefined,
): SheetGridData {
  if (!sheet) return { columns: [], rows: [], initialFormulas: [] };
  const colCount = sheet.columnCount || 0;
  const rowCount = sheet.rowCount || 0;
  if (!colCount || !rowCount) return { columns: [], rows: [], initialFormulas: [] };

  // Build raw cell matrix (rowCount × colCount) plus formulas.
  // ExcelJS uses 1-based row/column indexing; our matrix and the
  // initialFormulas it emits stay 0-based to match the rest of OGrid.
  const matrix: unknown[][] = [];
  const initialFormulas: SheetGridData['initialFormulas'] = [];
  for (let r = 0; r < rowCount; r++) {
    const out: unknown[] = new Array(colCount);
    for (let c = 0; c < colCount; c++) {
      const cell = sheet.getCell(r + 1, c + 1);
      out[c] = readCellValue(cell, c, r, initialFormulas);
    }
    matrix.push(out);
  }

  // Column-type detection over a top-of-sheet sample. Empty cells
  // don't disqualify a column from being numeric/date — only conflicting
  // non-empty cells do.
  const sample = Math.min(matrix.length, SAMPLE_SIZE);
  const types: ('text' | 'numeric' | 'date' | 'boolean')[] = new Array(colCount).fill('text');
  for (let c = 0; c < colCount; c++) {
    let allNum = true;
    let allDate = true;
    let allBool = true;
    let saw = false;
    for (let r = 0; r < sample; r++) {
      const v = matrix[r][c];
      if (v === '' || v === null || v === undefined) continue;
      saw = true;
      if (typeof v !== 'number') allNum = false;
      if (!(v instanceof Date)) allDate = false;
      if (typeof v !== 'boolean') allBool = false;
      if (!allNum && !allDate && !allBool) break;
    }
    if (!saw) continue;
    if (allDate) types[c] = 'date';
    else if (allNum) types[c] = 'numeric';
    else if (allBool) types[c] = 'boolean';
  }

  // Build columns + rows keyed by letter. Explicit defaultWidth + minWidth
  // are critical: without them, ogrid sizes columns to fit the widest cell
  // content, which on a sheet with one long paragraph cell (e.g. an
  // affidavit body) blows the column out to thousands of pixels and
  // forces a giant horizontal scrollbar. 120px matches the canonical
  // SpreadsheetDemo defaults; cells that overflow truncate with ellipsis.
  const columns: IColumnDef<SheetRow>[] = [];
  for (let c = 0; c < colCount; c++) {
    const letter = indexToColumnLetter(c);
    columns.push({
      columnId: letter,
      name: letter,
      type: types[c],
      sortable: true,
      defaultWidth: 120,
      minWidth: 60,
      // valueGetter omitted — ogrid reads row[columnId] by default.
    });
  }

  const rows: SheetRow[] = matrix.map((arr, rowIdx) => {
    const obj = { __rowIdx: rowIdx } as SheetRow;
    for (let c = 0; c < colCount; c++) {
      obj[indexToColumnLetter(c)] = arr[c];
    }
    return obj;
  });

  return { columns, rows, initialFormulas };
}

/** Normalize an ExcelJS cell value to a primitive (or Date). ExcelJS
 *  represents formulas, hyperlinks, rich-text, shared formulas, and
 *  errors as discriminated objects — we unwrap them so the grid sees
 *  the same shape regardless of how the value was authored. */
function readCellValue(
  cell: ExcelJS.Cell,
  c: number,
  r: number,
  initialFormulas: SheetGridData['initialFormulas'],
): unknown {
  const v = cell?.value;
  if (v == null) return '';
  if (v instanceof Date) return v;
  if (typeof v !== 'object') return v;
  // Formula cell (regular or shared): record the formula, return the cached result.
  if ('formula' in v && typeof (v as ExcelJS.CellFormulaValue).formula === 'string') {
    const fv = v as ExcelJS.CellFormulaValue;
    initialFormulas.push({ col: c, row: r, formula: fv.formula });
    return fv.result == null ? '' : (fv.result as unknown);
  }
  if ('sharedFormula' in v) {
    const sf = v as ExcelJS.CellSharedFormulaValue;
    if (sf.sharedFormula) {
      initialFormulas.push({ col: c, row: r, formula: sf.sharedFormula });
    }
    return sf.result == null ? '' : (sf.result as unknown);
  }
  if ('richText' in v) {
    return (v as ExcelJS.CellRichTextValue).richText.map((p) => p.text).join('');
  }
  if ('hyperlink' in v && 'text' in v) {
    return (v as ExcelJS.CellHyperlinkValue).text;
  }
  if ('error' in v) {
    return (v as ExcelJS.CellErrorValue).error;
  }
  // Date-as-object (rare ExcelJS edge case) or unknown shape — coerce to string.
  return String(v);
}

/** 0-based index → Excel column letter (0 → A, 25 → Z, 26 → AA). */
function indexToColumnLetter(n: number): string {
  let s = '';
  let x = n;
  while (x >= 0) {
    s = String.fromCharCode(65 + (x % 26)) + s;
    x = Math.floor(x / 26) - 1;
  }
  return s;
}

/** List sheet names in display order. */
export function listSheets(workbook: ExcelJS.Workbook): string[] {
  return workbook.worksheets.map((w) => w.name);
}
