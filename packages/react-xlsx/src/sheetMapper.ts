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
import { readDataValidations, preserveDataValidationSerialization } from './dataValidation';
import type { ISpillRange, IColumnDef, IDataValidationRule } from '@alaarab/ogrid-core';
import { adjustFormulaReferences, parseCellRef, parseRange, tokenize } from '@alaarab/ogrid-core/formula';
import { normalizeFormula, rebaseFormulaRows } from './formulaReferences';
import type { XlsxCellStyle } from './cellStyles';
import type { IMergedCell } from './gridAdapter';
import { attachSourceArchive } from './sourceArchive';

/**
 * Output of sheetToGridData. Feeds straight into <OGrid> as
 * `columns={data.columns}` `data={data.rows}` `initialFormulas={data.initialFormulas}`.
 */
export interface SheetGridData {
  columns: IColumnDef<SheetRow>[];
  rows: SheetRow[];
  /** Per-cell rules; pass to OGrid alongside rows and columns. */
  dataValidations: IDataValidationRule<SheetRow>[];
  initialFormulas: Array<{ col: number; row: number; formula: string }>;
  /** Array formula refs as exposed by ExcelJS; cached children remain in rows. */
  arrayRanges?: ISpillRange[];
  /**
   * Set when the sheet's populated area exceeded `maxRows`/`maxCols`/
   * `maxCells` and was cut down. Holds the untruncated extent so callers can
   * tell the user what was left out.
   */
  truncated?: { rowCount: number; columnCount: number };
  /** CSV parsing stopped at a load limit; the original extent is unknown. */
  parseTruncated?: boolean;
  /**
   * Everything about the sheet besides values: per-cell styles, column widths,
   * row heights, merges, frozen panes and list validations, keyed the way the
   * grid addresses cells (row id = `__rowIdx`, column id = column letter).
   */
  formatting: SheetFormatting;
}

/** Key of a cell in {@link SheetFormatting.styles}. */
export function cellKey(rowId: string | number, columnId: string): string {
  return `${rowId}:${columnId}`;
}

/** Non-value sheet state read by {@link sheetToGridData}. */
export interface SheetFormatting {
  /** Row 1 was promoted to column names (data row 0 is sheet row 2). */
  headerPromoted: boolean;
  /** Styles of loaded data cells, by {@link cellKey}. Cells with the default look are absent. */
  styles: Map<string, XlsxCellStyle>;
  /** Explicit column widths in Excel character units, by column id. */
  columnWidths: Record<string, number>;
  /** The sheet's default column width in Excel character units. */
  defaultColumnWidth: number;
  /** Explicit data-row heights in points, by row id. */
  rowHeights: Map<number, number>;
  /** The sheet's default row height in points (15 unless the sheet sets one). */
  defaultRowHeight: number;
  /** Merged blocks whose top-left cell is a loaded data cell. */
  merges: IMergedCell[];
  /** Merges the grid cannot show (they touch the promoted header row), as A1 ranges. Kept for export. */
  unmappedMerges: string[];
  /** Frozen panes in grid terms: data rows below the header, and leading columns. */
  frozen: { rows: number; columns: number };
  /** @deprecated Prefer dataValidations for per-cell enforcement. Legacy column dropdown values. */
  listValidations: Record<string, string[]>;
  /** Sheet tab color as CSS hex, when set. */
  tabColor?: string;
}

/** Excel stores widths in character units of the default font's max digit width (7px for Calibri 11). */
const MAX_DIGIT_WIDTH_PX = 7;
/** Excel's default column width as stored in files (8.43 characters + padding = 64px). */
export const DEFAULT_COLUMN_WIDTH_CHARS = 9.140625;

/** Excel column width (characters, as stored in the file) → screen pixels. */
export function columnWidthToPx(chars: number): number {
  return Math.trunc(((256 * chars + Math.trunc(128 / MAX_DIGIT_WIDTH_PX)) / 256) * MAX_DIGIT_WIDTH_PX);
}

/** Screen pixels → Excel column width (characters, as stored in the file). */
export function pxToColumnWidth(px: number): number {
  return Math.trunc((Math.max(0, px) / MAX_DIGIT_WIDTH_PX) * 256) / 256;
}

/** Row shape — keyed by column letter (A, B, C, ..., AA, AB, ...).
 *  `__rowIdx` is a synthetic id (0-based) so getRowId can be `(r) => r.__rowIdx`. */
export type SheetRow = Record<string, unknown> & { __rowIdx: number };

/** Options accepted by {@link sheetToGridData}. */
export interface SheetToGridDataOptions {
  /**
   * Whether to promote row 1 of the worksheet into column names.
   *
   * - `'auto'` (default): promote when row 1 looks like a header row —
   *   every non-empty cell is a non-empty string and the sheet has at
   *   least 2 rows. Otherwise keep A/B/C as column names.
   * - `'header'`: always promote row 1, coercing values to strings.
   *   Falls back to the column letter when a cell is empty.
   * - `'none'`: legacy behaviour — column names stay as A/B/C and
   *   row 1 is returned as the first data row.
   *
   * `columnId` is always the column letter so the `cellReferences`
   * strip retains the worksheet's column coordinates. Promoted headers
   * shift local formula row references into grid data coordinates.
   */
  headerRow?: 'auto' | 'header' | 'none';
  /** Maximum worksheet rows to load (default 1,048,576, Excel's own limit). */
  maxRows?: number;
  /** Maximum worksheet columns to load (default 1,000). */
  maxCols?: number;
  /**
   * Maximum rows × columns to map (default 5,100,000). A few-KB xlsx with
   * one far-away cell has a used range of billions of cells; this keeps the
   * grid from allocating that rectangle. Rows are dropped from the bottom
   * to fit. XLSX parsing itself is bounded only by WorkbookLoadOptions byte checks.
   */
  maxCells?: number;
}

export const DEFAULT_MAX_ROWS = 1_048_576;
export const DEFAULT_MAX_COLS = 1_000;
export const DEFAULT_MAX_CELLS = 5_100_000;
export const DEFAULT_MAX_FILE_BYTES = 50 * 1024 * 1024;
export const DEFAULT_MAX_UNCOMPRESSED_BYTES = 200 * 1024 * 1024;

export interface WorkbookLoadOptions extends SheetToGridDataOptions {
  /** Maximum input bytes before reading the blob (default 50 MiB). */
  maxFileBytes?: number;
  /** Maximum ZIP-declared total uncompressed bytes (default 200 MiB). */
  maxUncompressedBytes?: number;
}

const truncatedCsvSheets = new WeakSet<ExcelJS.Worksheet>();
/** Promoted-sheet formulas that referenced the header row. Their grid result
 * can differ from Excel's (e.g. COUNTA over a shrunk range), so XlsxGrid
 * keeps the cached result instead of evaluating them. */
export const headerReferencingFormulas = new WeakSet<object>();

const SAMPLE_SIZE = 50; // rows inspected for column-type detection

/**
 * Read an xlsx Blob into an ExcelJS Workbook. Falls back to a CSV/TSV
 * parser when the bytes don't look like a zip-backed xlsx (xlsx files
 * start with `PK\x03\x04`). The fallback synthesizes a single-sheet
 * workbook so downstream code paths stay identical.
 */
export async function workbookFromBlob(blob: Blob, options: WorkbookLoadOptions = {}): Promise<ExcelJS.Workbook> {
  const maxFileBytes = sanitizeLimit(options.maxFileBytes, DEFAULT_MAX_FILE_BYTES);
  if (blob.size > maxFileBytes) throw new Error(`File exceeds maxFileBytes (${maxFileBytes})`);
  const buf = await blob.arrayBuffer();
  if (buf.byteLength > maxFileBytes) throw new Error(`File exceeds maxFileBytes (${maxFileBytes})`);
  if (looksLikeXlsx(buf)) {
    checkZipSizes(buf, sanitizeLimit(options.maxUncompressedBytes, DEFAULT_MAX_UNCOMPRESSED_BYTES));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const { readValidationXml } = await import('./ooxmlDataValidations');
    await readValidationXml(wb, buf);
    preserveDataValidationSerialization(wb);
    const { readSourceArchive } = await import('./ooxmlMedia');
    const source = await readSourceArchive(buf, wb);
    if (source) attachSourceArchive(wb, source);
    return wb;
  }
  // Fallback: assume CSV-ish text and count separators outside quotes.
  const text = new TextDecoder('utf-8').decode(buf);
  const delimiter = sniffDelimiter(text);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  const truncated = parseDelimited(text, delimiter, options, (row) => { ws.addRow(row); });
  if (truncated) truncatedCsvSheets.add(ws);
  return wb;
}

/** Inspect ZIP metadata before ExcelJS inflates any entries. This rejects
 * oversized declared payloads; it is not a streaming decompression bound. */
function checkZipSizes(buf: ArrayBuffer, maxBytes: number): void {
  const view = new DataView(buf);
  const u64 = (pos: number) => view.getUint32(pos, true) + view.getUint32(pos + 4, true) * 2 ** 32;
  let end = -1;
  for (let pos = buf.byteLength - 22; pos >= Math.max(0, buf.byteLength - 65557); pos--) {
    if (view.getUint32(pos, true) === 0x06054b50 && pos + 22 + view.getUint16(pos + 20, true) <= buf.byteLength) {
      end = pos;
      break;
    }
  }
  if (end < 0) throw new Error('Invalid XLSX ZIP directory');
  let entries = view.getUint16(end + 10, true);
  let size = view.getUint32(end + 12, true);
  let offset = view.getUint32(end + 16, true);
  if (view.getUint32(end + 4, true) !== 0 || view.getUint16(end + 8, true) !== entries) {
    throw new Error('Multi-volume XLSX files are not supported');
  }
  let directoryLimit = end;
  if (entries === 0xffff || size === 0xffffffff || offset === 0xffffffff) {
    // ZIP64: the real counts live in the ZIP64 end record named by its locator.
    const locator = end - 20;
    const record = locator >= 0 && view.getUint32(locator, true) === 0x07064b50 ? u64(locator + 8) : -1;
    if (record < 0 || record + 56 > locator || view.getUint32(record, true) !== 0x06064b50) {
      throw new Error('Invalid XLSX ZIP directory');
    }
    entries = u64(record + 32);
    size = u64(record + 40);
    offset = u64(record + 48);
    directoryLimit = record;
  }
  const directoryEnd = offset + size;
  if (directoryEnd > directoryLimit) throw new Error('Invalid XLSX ZIP directory');
  let pos = offset;
  let total = 0;
  for (let i = 0; i < entries; i++) {
    if (pos + 46 > directoryEnd || view.getUint32(pos, true) !== 0x02014b50) {
      throw new Error('Invalid XLSX ZIP entry');
    }
    const nameLength = view.getUint16(pos + 28, true);
    const extraLength = view.getUint16(pos + 30, true);
    let bytes = view.getUint32(pos + 24, true);
    if (bytes === 0xffffffff) {
      // ZIP64 extra field (id 1); the uncompressed size is its first value.
      bytes = -1;
      for (let x = pos + 46 + nameLength; x + 4 <= pos + 46 + nameLength + extraLength; x += 4 + view.getUint16(x + 2, true)) {
        if (view.getUint16(x, true) === 1 && x + 12 <= directoryEnd) { bytes = u64(x + 4); break; }
      }
      if (bytes < 0) throw new Error('Invalid XLSX ZIP entry');
    }
    total += bytes;
    if (total > maxBytes) throw new Error(`XLSX exceeds maxUncompressedBytes (${maxBytes})`);
    pos += 46 + nameLength + extraLength + view.getUint16(pos + 32, true);
    if (pos > directoryEnd) throw new Error('Invalid XLSX ZIP entry');
  }
  if (pos !== directoryEnd) throw new Error('Invalid XLSX ZIP directory');
}

function looksLikeXlsx(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 4) return false;
  const head = new Uint8Array(buf, 0, 4);
  // ZIP local-file header: "PK\x03\x04". xlsx is a zip container.
  return head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
}

function sniffDelimiter(text: string): string {
  const candidates = [',', '\t', ';', '|'];
  const counts = new Map(candidates.map((delimiter) => [delimiter, 0]));
  let inQuotes = false;
  let fieldStart = true;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') i++;
        else inQuotes = false;
      }
      continue;
    }
    if (ch === '"' && fieldStart) { inQuotes = true; continue; }
    if (ch === '\r' || ch === '\n') {
      if ([...counts.values()].some((n) => n > 0)) break;
      fieldStart = true;
      continue;
    }
    if (ch && counts.has(ch)) {
      counts.set(ch, (counts.get(ch) ?? 0) + 1);
      fieldStart = true;
    } else fieldStart = false;
  }
  return candidates.reduce((best, delimiter) =>
    (counts.get(delimiter) ?? 0) > (counts.get(best) ?? 0) ? delimiter : best, ',');
}

/** RFC 4180-shaped reader. Quotes only open at the start of a field;
 * delimiters and newlines inside quoted fields are preserved. */
function parseDelimited(
  text: string,
  delimiter: string,
  options: WorkbookLoadOptions,
  addRow: (row: string[]) => void,
): boolean {
  const maxRows = sanitizeLimit(options.maxRows, DEFAULT_MAX_ROWS);
  const maxCells = sanitizeLimit(options.maxCells, DEFAULT_MAX_CELLS);
  const maxCols = Math.min(sanitizeLimit(options.maxCols, DEFAULT_MAX_COLS), maxCells);
  let rowCount = 0;
  let cells = 0;
  let truncated = false;
  let cur: string[] = [];
  let field = '';
  let inQuotes = false;
  let fieldStart = true;
  const pushField = () => {
    if (cur.length < maxCols && cells + cur.length < maxCells) cur.push(field);
    else truncated = true;
    field = '';
    fieldStart = true;
  };
  const pushRow = () => {
    pushField();
    addRow(cur);
    rowCount++;
    cells += cur.length;
    cur = [];
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          if (cur.length < maxCols && cells + cur.length < maxCells) field += '"';
          i++; continue;
        }
        inQuotes = false;
        continue;
      }
      if (cur.length < maxCols && cells + cur.length < maxCells) field += ch;
      continue;
    }
    if (ch === '"' && fieldStart) { inQuotes = true; fieldStart = false; continue; }
    if (ch === delimiter) { pushField(); continue; }
    if (ch === '\n' || ch === '\r') {
      pushRow();
      if (ch === '\r' && text[i + 1] === '\n') i++;
      if (rowCount >= maxRows || cells >= maxCells) return truncated || i + 1 < text.length;
      continue;
    }
    if (cur.length < maxCols && cells + cur.length < maxCells) field += ch;
    fieldStart = false;
  }
  if (field !== '' || cur.length > 0 || !fieldStart) pushRow();
  return truncated;
}

/**
 * Map one ExcelJS worksheet to OGrid columns + rows + initialFormulas.
 *
 * Column ids are Excel letters (A, B, …, AA) so the grid's
 * `cellReferences` mode shows A1/B1 notation that matches the
 * source workbook's column coordinates. Header promotion shifts data rows.
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
  options: SheetToGridDataOptions = {},
  /** Minimum extent used by the document to retain newly inserted blank rows/columns. */
  extent?: { rowCount: number; columnCount: number },
): SheetGridData {
  if (!sheet) return { columns: [], rows: [], initialFormulas: [], dataValidations: [], formatting: emptyFormatting() };

  // Find the populated extent by visiting only cells that exist. The
  // declared dimensions (rowCount/columnCount) come from the file and can be
  // huge for a single far-away cell, and sheet.getCell() creates cells as a
  // side effect, so never walk the declared rectangle.
  let usedRows = 0;
  let usedCols = 0;
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    let rowHasValue = false;
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      if (cell.value == null) return;
      rowHasValue = true;
      if (colNumber > usedCols) usedCols = colNumber;
    });
    if (rowHasValue && rowNumber > usedRows) usedRows = rowNumber;
  });
  usedRows = Math.max(usedRows, extent?.rowCount ?? 0);
  usedCols = Math.max(usedCols, extent?.columnCount ?? 0);
  if (!usedCols) return { columns: [], rows: [], initialFormulas: [], dataValidations: [], formatting: emptyFormatting(sheet) };

  const maxCols = sanitizeLimit(options.maxCols, DEFAULT_MAX_COLS);
  const maxRows = sanitizeLimit(options.maxRows, DEFAULT_MAX_ROWS);
  const maxCells = sanitizeLimit(options.maxCells, DEFAULT_MAX_CELLS);
  const colCount = Math.min(usedCols, maxCols, maxCells);
  const rowCount = Math.min(usedRows, maxRows, Math.floor(maxCells / colCount));
  const truncated = colCount < usedCols || rowCount < usedRows
    ? { rowCount: usedRows, columnCount: usedCols }
    : undefined;

  // Map directly into grid rows, avoiding a second 5-million-cell matrix.
  const letters = Array.from({ length: colCount }, (_, c) => indexToColumnLetter(c));
  const mappedRows: SheetRow[] = new Array(rowCount);
  for (let r = 0; r < rowCount; r++) {
    const row: SheetRow = { __rowIdx: r };
    for (const letter of letters) row[letter] = '';
    mappedRows[r] = row;
  }
  const initialFormulas: SheetGridData['initialFormulas'] = [];
  const arrayRanges: ISpillRange[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber > rowCount) return;
    const out = mappedRows[rowNumber - 1] as SheetRow;
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      if (colNumber > colCount) return;
      // Merged-away cells report their master's value; the merge model shows it once.
      if (cell.type === ExcelJS.ValueType.Merge) return;
      const value = cell.value;
      if (value && typeof value === 'object' && 'formula' in value && 'shareType' in value && value.shareType === 'array' && 'ref' in value && typeof value.ref === 'string') {
        const range = parseRange(value.ref);
        if (range) arrayRanges.push({ anchorCol: colNumber - 1, anchorRow: rowNumber - 1, endCol: range.end.col, endRow: range.end.row });
      }
      out[letters[colNumber - 1] as string] = readCellValue(cell, colNumber - 1, rowNumber - 1, initialFormulas);
    });
  });

  // Decide whether row 1 is a header row. Defaults to 'auto' — the right
  // choice for almost every xlsx in the wild, where row 1 is the column
  // titles. 'none' restores legacy behaviour for callers that want to
  // see all rows as data (e.g. when they strip headers themselves).
  const mode = options.headerRow ?? 'auto';
  const headerRow = letters.map((letter) => mappedRows[0]?.[letter] ?? '');
  const promote =
    mode === 'header' ||
    (mode === 'auto' && mappedRows.length > 1 && looksLikeHeaderRow(headerRow));
  const rows = promote ? mappedRows.slice(1) : mappedRows;
  rows.forEach((row, index) => { row.__rowIdx = index; });
  const headerNames = promote
    ? uniqueHeaderNames(headerRow)
    : null;

  // Column-type detection over a top-of-sheet sample. Empty cells
  // don't disqualify a column from being numeric/date — only conflicting
  // non-empty cells do. Sample the *data* rows so a string header row
  // doesn't pin every column to 'text'.
  const sample = Math.min(rows.length, SAMPLE_SIZE);
  const types: ('text' | 'numeric' | 'date' | 'boolean')[] = new Array(colCount).fill('text');
  for (let c = 0; c < colCount; c++) {
    let allNum = true;
    let allDate = true;
    let allBool = true;
    let saw = false;
    for (let r = 0; r < sample; r++) {
      const v = rows[r]?.[letters[c] as string];
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

  const formatting = readFormatting(sheet, promote, rows.length, colCount);

  // Build columns + rows keyed by letter. An explicit defaultWidth is
  // critical: without it, ogrid sizes columns to fit the widest cell
  // content, which on a sheet with one long paragraph cell (e.g. an
  // affidavit body) blows the column out to thousands of pixels and
  // forces a giant horizontal scrollbar. Widths come from the sheet (or its
  // default column width, 64px in a stock workbook); overflow truncates.
  const columns: IColumnDef<SheetRow>[] = [];
  for (let c = 0; c < colCount; c++) {
    const letter = indexToColumnLetter(c);
    const width = columnWidthToPx(formatting.columnWidths[letter] ?? formatting.defaultColumnWidth);
    const hidden = sheet.columns?.[c]?.hidden === true;
    columns.push({
      columnId: letter,
      name: headerNames ? (headerNames[c] ?? letter) : letter,
      type: types[c],
      sortable: true,
      defaultWidth: Math.max(width, 24),
      minWidth: 24,
      ...(hidden ? { defaultVisible: false } : {}),
      ...(formatting.listValidations[letter] ? { cellEditor: 'select' as const, cellEditorParams: { values: formatting.listValidations[letter] } } : {}),
      // valueGetter omitted — ogrid reads row[columnId] by default.
    });
  }

  // Re-index initialFormulas onto the post-strip data. Anything that was
  // on the header row itself is dropped (it no longer exists in `rows`);
  // everything below and its local references shift up by one. The cached `result` already
  // travelled with the cell value, so the visible grid renders correctly
  // even before the formula engine recalculates.
  const adjustedFormulas = promote
    ? initialFormulas
        .filter((f) => f.row >= 1)
        .map((f) => {
          let removedRow = false;
          const formula = rebaseFormulaRows(f.formula, -1, () => { removedRow = true; });
          const entry = { ...f, row: f.row - 1, formula };
          if (removedRow) headerReferencingFormulas.add(entry);
          return entry;
        })
    : initialFormulas;

  return {
    columns, rows, initialFormulas: adjustedFormulas, formatting,
    dataValidations: readDataValidations(sheet, { headerPromoted: promote, rowCount: rows.length, columnCount: columns.length }),
    ...(arrayRanges.length ? { arrayRanges: arrayRanges.filter(r => !promote || r.anchorRow > 0).map(r => ({ ...r, anchorRow: r.anchorRow - (promote ? 1 : 0), endRow: r.endRow - (promote ? 1 : 0) })) } : {}),
    ...(truncated ? { truncated } : {}),
    ...(truncatedCsvSheets.has(sheet) ? { parseTruncated: true } : {}),
  };
}

function sanitizeLimit(value: number | undefined, fallback: number): number {
  // NaN falls back to the default; Infinity lifts the limit.
  return value === undefined || Number.isNaN(value) ? fallback : Math.max(1, Math.floor(value));
}

function uniqueHeaderNames(row: unknown[]): string[] {
  const names = row.map((v, i) => coerceHeader(v) ?? indexToColumnLetter(i));
  const reserved = new Set(names);
  const used = new Set<string>();
  return names.map((name, i) => {
    let candidate = name;
    let suffix = 1;
    if (used.has(candidate)) {
      do {
        candidate = `${name} (${indexToColumnLetter(i)}${suffix === 1 ? '' : ` ${suffix}`})`;
        suffix++;
      } while (used.has(candidate) || reserved.has(candidate));
    }
    used.add(candidate);
    return candidate;
  });
}

/** Heuristic: row 1 is a header row when every non-empty cell is a
 *  non-empty string and at least one cell is non-empty. Numbers, dates,
 *  and booleans in row 1 disqualify the heuristic — those are data. */
function looksLikeHeaderRow(row: unknown[] | undefined): boolean {
  if (!row || row.length === 0) return false;
  let hasContent = false;
  for (const v of row) {
    if (v === '' || v === null || v === undefined) continue;
    if (typeof v !== 'string') return false;
    if (v.trim() === '') continue;
    hasContent = true;
  }
  return hasContent;
}

/** Coerce a raw row-1 cell to a column-name string. Returns null for
 *  empty/whitespace-only values so the caller can fall back to A/B/C. */
function coerceHeader(v: unknown): string | null {
  if (v === '' || v === null || v === undefined) return null;
  const s = typeof v === 'string' ? v : String(v);
  const trimmed = s.trim();
  return trimmed === '' ? null : trimmed;
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
  const v = cell.value;
  // Formula cell (regular or shared): record the formula, return the cached result.
  if (v && typeof v === 'object' && ('formula' in v || 'sharedFormula' in v)) {
    const formula = readFormula(cell);
    if (formula) initialFormulas.push({ col: c, row: r, formula });
    return v.result == null ? undefined : normalizeCellValue(v.result);
  }
  return normalizeCellValue(v);
}

/** Shared-formula dependents get the master's formula moved by their own
 *  offset. ExcelJS's `cell.formula` does this with a regex that also rewrites
 *  string literals and quoted sheet names, so it is only the fallback. */
function readFormula(cell: ExcelJS.Cell): string | undefined {
  const v = cell.value as ExcelJS.CellSharedFormulaValue;
  const at = typeof v.sharedFormula === 'string' ? parseCellRef(v.sharedFormula) : null;
  const master = at ? cell.worksheet.findCell(at.row + 1, at.col + 1) : undefined;
  if (at && master?.formula) {
    const formula = normalizeFormula(master.formula);
    try {
      tokenize(formula.slice(1));
      return adjustFormulaReferences(formula, Number(cell.col) - 1 - at.col, Number(cell.row) - 1 - at.row);
    } catch {
      // Syntax the tokenizer doesn't know: fall back to ExcelJS's translation.
    }
  }
  return cell.formula ? normalizeFormula(cell.formula) : undefined;
}

export function normalizeCellValue(v: ExcelJS.CellValue | undefined): unknown {
  if (v == null) return '';
  if (v instanceof Date) return v;
  if (typeof v !== 'object') return v;
  if ('formula' in v || 'sharedFormula' in v) {
    return v.result == null ? undefined : normalizeCellValue(v.result);
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
  return workbook.worksheets.filter(w => !(w.state === 'veryHidden' && /^_OGridValidation\d*$/.test(w.name))).map((w) => w.name);
}

// ---- Formatting -------------------------------------------------------------

function emptyFormatting(sheet?: ExcelJS.Worksheet): SheetFormatting {
  const tabColor = sheet ? tabColorOf(sheet) : undefined;
  return {
    headerPromoted: false,
    styles: new Map(),
    columnWidths: {},
    defaultColumnWidth: sheet ? defaultColumnWidthOf(sheet) : DEFAULT_COLUMN_WIDTH_CHARS,
    rowHeights: new Map(),
    defaultRowHeight: sheet ? defaultRowHeightOf(sheet) : DEFAULT_ROW_HEIGHT_PT,
    merges: [],
    unmappedMerges: [],
    frozen: { rows: 0, columns: 0 },
    listValidations: {},
    ...(tabColor ? { tabColor } : {}),
  };
}

/** Excel's default row height in points (Calibri 11). */
export const DEFAULT_ROW_HEIGHT_PT = 15;

function defaultRowHeightOf(sheet: ExcelJS.Worksheet): number {
  const h = sheet.properties?.defaultRowHeight;
  return typeof h === 'number' && h > 0 ? h : DEFAULT_ROW_HEIGHT_PT;
}

function defaultColumnWidthOf(sheet: ExcelJS.Worksheet): number {
  const w = sheet.properties?.defaultColWidth;
  return typeof w === 'number' && w > 0 ? w : DEFAULT_COLUMN_WIDTH_CHARS;
}

/** A sheet's tab color as CSS hex, when set. */
export function tabColorOf(sheet: ExcelJS.Worksheet): string | undefined {
  const argb = (sheet.properties?.tabColor as { argb?: string } | undefined)?.argb;
  return typeof argb === 'string' && /^[0-9A-Fa-f]{6,8}$/.test(argb) ? `#${argb.slice(-6).toUpperCase()}` : undefined;
}

/**
 * True when a style looks like the workbook default: no fill, border,
 * alignment, protection or number format, and a plain default font. Those
 * cells are left out of the style map; export never rewrites them.
 */
export function isDefaultStyle(style: XlsxCellStyle | undefined): boolean {
  if (!style) return true;
  for (const [key, value] of Object.entries(style)) {
    if (value === undefined || value === null) continue;
    if (key === 'numFmt') {
      if (value !== 'General' && value !== '') return false;
      continue;
    }
    if (key === 'fill') {
      if ((value as ExcelJS.Fill).type !== 'pattern' || (value as ExcelJS.FillPattern).pattern !== 'none') return false;
      continue;
    }
    if (key === 'border' || key === 'alignment' || key === 'protection') {
      if (Object.values(value as object).some((v) => v !== undefined && v !== null && v !== false)) return false;
      continue;
    }
    if (key === 'font') {
      const font = value as Partial<ExcelJS.Font>;
      if (font.bold || font.italic || font.underline || font.strike || font.outline || font.vertAlign) return false;
      if (font.size !== undefined && font.size !== 11) return false;
      if (font.name && !/^(calibri|aptos( narrow)?)$/i.test(font.name)) return false;
      const color = font.color as (Partial<ExcelJS.Color> & { tint?: number }) | undefined;
      if (color && !(color.theme === 1 && !color.tint) && color.argb !== 'FF000000') return false;
      continue;
    }
    return false;
  }
  return true;
}

interface MergeRange { top: number; left: number; bottom: number; right: number; range?: string }

function readFormatting(sheet: ExcelJS.Worksheet, promoted: boolean, dataRows: number, colCount: number): SheetFormatting {
  const formatting = emptyFormatting(sheet);
  formatting.headerPromoted = promoted;
  const headerOffset = promoted ? 1 : 0;
  const lastSheetRow = dataRows + headerOffset;

  // Cell styles, including styled cells that hold no value (fills, borders).
  for (let r = headerOffset + 1; r <= lastSheetRow; r++) {
    const row = sheet.findRow(r);
    if (!row) continue;
    const rowId = r - 1 - headerOffset;
    if (typeof row.height === 'number' && row.height > 0) formatting.rowHeights.set(rowId, row.height);
    const last = Math.min(row.cellCount, colCount);
    for (let c = 1; c <= last; c++) {
      const cell = row.findCell(c);
      if (!cell) continue;
      const style = cell.style as XlsxCellStyle | undefined;
      if (!isDefaultStyle(style)) formatting.styles.set(cellKey(rowId, indexToColumnLetter(c - 1)), style as XlsxCellStyle);
    }
  }

  for (const [i, column] of (sheet.columns ?? []).entries()) {
    if (i >= colCount) break;
    if (typeof column?.width === 'number' && column.width > 0) formatting.columnWidths[indexToColumnLetter(i)] = column.width;
  }

  // Merges. ExcelJS keeps them as Range objects keyed by master address.
  const merges = Object.values((sheet as unknown as { _merges?: Record<string, MergeRange | undefined> })._merges ?? {});
  for (const m of merges) {
    if (!m) continue;
    if (m.top <= headerOffset || m.top > lastSheetRow || m.left > colCount) {
      formatting.unmappedMerges.push(`${indexToColumnLetter(m.left - 1)}${m.top}:${indexToColumnLetter(m.right - 1)}${m.bottom}`);
      continue;
    }
    const rowSpan = Math.min(m.bottom, lastSheetRow) - m.top + 1;
    const colSpan = Math.min(m.right, colCount) - m.left + 1;
    formatting.merges.push({
      rowId: m.top - 1 - headerOffset,
      columnId: indexToColumnLetter(m.left - 1),
      ...(rowSpan > 1 ? { rowSpan } : {}),
      ...(colSpan > 1 ? { colSpan } : {}),
    });
  }

  // Frozen panes: ySplit counts sheet rows, so the promoted header is one of them.
  const view = sheet.views?.find((v) => v.state === 'frozen') as ExcelJS.WorksheetViewFrozen | undefined;
  if (view) {
    formatting.frozen = {
      rows: Math.max(0, Math.min((view.ySplit ?? 0) - headerOffset, dataRows)),
      // Excel counts physical columns; the grid freezes visible columns only.
      columns: Array.from({ length: Math.max(0, Math.min(view.xSplit ?? 0, colCount)) }, (_, c) => c)
        .filter((c) => sheet.columns?.[c]?.hidden !== true).length,
    };
  }

  // List validations, approximated per column: a column gets a dropdown
  // editor only when one list rule covers every loaded data row in it.
  if (dataRows > 0) {
    for (let c = 1; c <= colCount; c++) {
      const letter = indexToColumnLetter(c - 1);
      const first = validationAt(sheet, `${letter}${headerOffset + 1}`);
      const formula = first?.type === 'list' && !(first as { showDropDown?: boolean }).showDropDown ? first.formulae?.[0] : undefined;
      if (formula === undefined) continue;
      let covered = true;
      for (let r = headerOffset + 2; r <= lastSheetRow && covered; r++) {
        const dv = validationAt(sheet, `${letter}${r}`);
        covered = dv?.type === 'list' && !(dv as { showDropDown?: boolean }).showDropDown && dv.formulae?.[0] === formula;
      }
      if (!covered) continue;
      const values = listValues(sheet, String(formula));
      if (values.length) formatting.listValidations[letter] = values;
    }
  }
  return formatting;
}

/** ExcelJS keeps validation metadata even when a cell has no stored value. */
function validationAt(sheet: ExcelJS.Worksheet, address: string): ExcelJS.DataValidation | undefined {
  return (sheet as unknown as { dataValidations: { find(address: string): ExcelJS.DataValidation | undefined } }).dataValidations.find(address);
}

/** Values of a list validation: an inline "a,b,c" list, a range (optionally on another sheet), or a defined name. */
export function listValues(sheet: ExcelJS.Worksheet, formula: string): string[] {
  const f = formula.trim().replace(/^=/, '');
  if (f.startsWith('"')) {
    return f.slice(1, f.endsWith('"') ? -1 : undefined).replace(/""/g, '"').split(',').map((v) => v.trim()).filter((v) => v !== '');
  }
  const wb = sheet.workbook;
  let ref = f;
  if (/^[A-Za-z_\\][\w.]*$/.test(f) && !/^\$?[A-Za-z]{1,3}\$?\d+$/.test(f)) {
    ref = wb.definedNames?.getRanges(f)?.ranges?.[0] ?? '';
    if (!ref) return [];
  }
  const bang = ref.lastIndexOf('!');
  const sheetName = bang >= 0 ? ref.slice(0, bang).replace(/^'|'$/g, '').replace(/''/g, "'") : undefined;
  const target = sheetName ? wb.getWorksheet(sheetName) : sheet;
  const area = (bang >= 0 ? ref.slice(bang + 1) : ref).replace(/\$/g, '');
  const m = /^([A-Z]{1,3})(\d+)(?::([A-Z]{1,3})(\d+))?$/i.exec(area);
  if (!target || !m) return [];
  const c1 = columnLetterToNumber(m[1] as string);
  const r1 = Number(m[2]);
  const c2 = m[3] ? columnLetterToNumber(m[3]) : c1;
  const r2 = m[4] ? Number(m[4]) : r1;
  const out: string[] = [];
  for (let r = Math.min(r1, r2); r <= Math.max(r1, r2) && out.length < 1000; r++) {
    for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
      const v = normalizeCellValue(target.findRow(r)?.findCell(c)?.value);
      if (v !== '' && v != null) out.push(v instanceof Date ? v.toISOString().slice(0, 10) : String(v));
    }
  }
  return out;
}

function columnLetterToNumber(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

export { indexToColumnLetter };
