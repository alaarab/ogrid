// Grid → .xlsx export: the inverse of sheetMapper. Mirrors the call shape of
// @alaarab/ogrid-core's exportToCsv (items, columns, getValue, filename) so
// the two exporters are interchangeable at the call site.

import ExcelJS from 'exceljs';
import { triggerBlobDownload, type CsvColumn, type ISpillRange } from '@alaarab/ogrid-core';
import { rebaseFormulaRows, toFileFormula } from './formulaReferences';

export const XLSX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export interface XlsxExportOptions {
  /** Worksheet name. Defaults to 'Sheet1'. */
  sheetName?: string;
  /** Current spill extents, with cached child values supplied by getValue. */
  spillRanges?: ISpillRange[];
  /**
   * Formula cells to emit, in the same `{col, row, formula}` shape
   * `sheetToGridData` produces on import (0-based data coordinates, header
   * row excluded). Each is written as `{ formula, result }` — Excel shows the
   * cached result immediately and recalculates on open. The public grid API
   * does not expose formulas, so pass this through from the `initialFormulas`
   * you already hold (e.g. from an imported workbook).
   * References use grid data coordinates; export adds one row for headers.
   * Items and columns must retain the order used to key these formulas.
   */
  formulas?: Array<{ col: number; row: number; formula: string }>;
}

/**
 * Build an ExcelJS workbook from grid data: a header row from column names,
 * then one row per item. Values are written as native JS types (number, Date,
 * boolean, string) so ExcelJS assigns the matching cell type — symmetric with
 * how `sheetToGridData` detects column types on import.
 */
export function workbookFromGridData<T>(
  items: T[],
  columns: CsvColumn[],
  getValue: (item: T, columnId: string) => unknown,
  options?: XlsxExportOptions,
): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sanitizeSheetName(options?.sheetName));

  ws.addRow(columns.map((c) => c.name));
  for (const item of items) {
    ws.addRow(columns.map((c) => toCellValue(getValue(item, c.columnId))));
  }

  if (options?.formulas) {
    for (const f of options.formulas) {
      const column = columns[f.col];
      const item = items[f.row];
      if (column === undefined || item === undefined) continue;
      const result = toCellValue(getValue(item, column.columnId));
      const spill = options.spillRanges?.find(r => r.anchorCol === f.col && r.anchorRow === f.row);
      const array = spill ? { shareType: 'array' as const, ref: `${ws.getCell(f.row + 2, f.col + 1).address}:${ws.getCell(spill.endRow + 2, spill.endCol + 1).address}` } : {};

      // +1 for 1-based ExcelJS coordinates, +1 more on the row for the header.
      ws.getCell(f.row + 2, f.col + 1).value = {
        ...array,
        formula: toFileFormula(rebaseFormulaRows(f.formula, 1)),
        result,
      } as ExcelJS.CellFormulaValue;
    }
  }

  return wb;
}

/** Serialize a workbook to a Blob with the .xlsx MIME type. */
export async function xlsxBlobFromWorkbook(wb: ExcelJS.Workbook): Promise<Blob> {
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: XLSX_MIME_TYPE });
}

/**
 * Export grid data as a downloaded .xlsx file (browser-only). Mirrors
 * `exportToCsv(items, columns, getValue, filename)` from @alaarab/ogrid-core.
 */
export async function exportToXlsx<T>(
  items: T[],
  columns: CsvColumn[],
  getValue: (item: T, columnId: string) => unknown,
  filename?: string,
  options?: XlsxExportOptions,
): Promise<void> {
  const wb = workbookFromGridData(items, columns, getValue, options);
  const blob = await xlsxBlobFromWorkbook(wb);
  triggerBlobDownload(blob, filename ?? `export_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Map a grid value to an ExcelJS cell value. Numbers, Dates, booleans, and
 * strings pass through natively; null/undefined become empty cells; anything
 * else is stringified.
 */
function toCellValue(v: unknown): ExcelJS.CellValue {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'boolean' || typeof v === 'string') return v;
  if (v instanceof Date) return v;
  if (typeof v === 'object' && 'type' in v && typeof v.type === 'string' && v.type.startsWith('#')) return { error: v.type } as ExcelJS.CellErrorValue;
  return String(v);
}

function sanitizeSheetName(name: string | undefined): string {
  const sanitized = (name ?? 'Sheet1').replace(/[\\/*?:[\]]/g, '_').trim().slice(0, 31).replace(/^'+|'+$/g, '');
  return !sanitized || sanitized.toLowerCase() === 'history' ? 'Sheet1' : sanitized;
}
