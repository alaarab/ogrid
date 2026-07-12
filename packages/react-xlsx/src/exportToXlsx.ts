// Grid → .xlsx export: the inverse of sheetMapper. Mirrors the call shape of
// @alaarab/ogrid-core's exportToCsv (items, columns, getValue, filename) so
// the two exporters are interchangeable at the call site.

import ExcelJS from 'exceljs';
import { triggerBlobDownload, type CsvColumn } from '@alaarab/ogrid-core';

export const XLSX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export interface XlsxExportOptions {
  /** Worksheet name. Defaults to 'Sheet1'. */
  sheetName?: string;
  /**
   * Formula cells to emit, in the same `{col, row, formula}` shape
   * `sheetToGridData` produces on import (0-based data coordinates, header
   * row excluded). Each is written as `{ formula, result }` — Excel shows the
   * cached result immediately and recalculates on open. The public grid API
   * does not expose formulas, so pass this through from the `initialFormulas`
   * you already hold (e.g. from an imported workbook).
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
  const ws = wb.addWorksheet(options?.sheetName ?? 'Sheet1');

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
      // +1 for 1-based ExcelJS coordinates, +1 more on the row for the header.
      ws.getCell(f.row + 2, f.col + 1).value = {
        formula: f.formula,
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
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') return v;
  if (v instanceof Date) return v;
  return String(v);
}
