// Translates a SheetJS workbook into the shape OGrid expects.
// Pure module — no React, no DOM, no side effects. Reused by tests
// directly without React Testing Library.

import * as XLSX from 'xlsx';
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
 * Read an xlsx/xls/ods/csv Blob into a SheetJS WorkBook.
 * cellDates so date cells come back as real Date objects (not Excel
 * serial numbers); cellFormula keeps the formula string on cells with
 * .f so we can hand it to the formula engine.
 */
export async function workbookFromBlob(blob: Blob): Promise<XLSX.WorkBook> {
  const buf = await blob.arrayBuffer();
  return XLSX.read(buf, { type: 'array', cellDates: true, cellFormula: true, cellNF: true });
}

/**
 * Map one sheet to OGrid columns + rows + initialFormulas.
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
 * Formulas (cell `.f`) get pulled into initialFormulas; the cached
 * value `.v` still goes into the row so the grid renders the right
 * thing on first paint, before the engine recalculates.
 */
export function sheetToGridData(sheet: XLSX.WorkSheet): SheetGridData {
  const ref = sheet['!ref'];
  if (!ref) {
    return { columns: [], rows: [], initialFormulas: [] };
  }
  const range = XLSX.utils.decode_range(ref);
  const colCount = range.e.c - range.s.c + 1;
  const rowCount = range.e.r - range.s.r + 1;

  // Build raw cell matrix (rowCount × colCount) plus formulas.
  const matrix: unknown[][] = [];
  const initialFormulas: SheetGridData['initialFormulas'] = [];
  for (let r = 0; r < rowCount; r++) {
    const out: unknown[] = new Array(colCount);
    for (let c = 0; c < colCount; c++) {
      const addr = XLSX.utils.encode_cell({ r: range.s.r + r, c: range.s.c + c });
      const cell = sheet[addr] as XLSX.CellObject | undefined;
      if (!cell) {
        out[c] = '';
        continue;
      }
      out[c] = cell.v ?? '';
      if (cell.f) {
        initialFormulas.push({ col: c, row: r, formula: cell.f });
      }
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
    const letter = XLSX.utils.encode_col(range.s.c + c);
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
      const letter = XLSX.utils.encode_col(range.s.c + c);
      obj[letter] = arr[c];
    }
    return obj;
  });

  return { columns, rows, initialFormulas };
}

/** List sheet names in display order. */
export function listSheets(workbook: XLSX.WorkBook): string[] {
  return workbook.SheetNames.slice();
}
