export interface CsvColumn {
  columnId: string;
  name: string;
}

export interface CsvEscapeOptions {
  /**
   * Prefix text that a spreadsheet would run as a formula (leading `=`, `+`,
   * `-`, `@`, tab or CR) with `'` so opening the CSV can't execute it
   * (CSV/formula injection). Plain numbers like `-5` are left alone.
   * Default: true.
   */
  preventFormulaInjection?: boolean;
}

const FORMULA_TRIGGER_RE = /^[=+\-@\t\r]/;
const NUMERIC_RE = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;

export function escapeCsvValue(value: unknown, options?: CsvEscapeOptions): string {
  if (value === null || value === undefined) {
    return '';
  }
  let s = String(value);
  if (
    options?.preventFormulaInjection !== false &&
    typeof value === 'string' &&
    FORMULA_TRIGGER_RE.test(s) &&
    !NUMERIC_RE.test(s)
  ) {
    s = `'${s}`;
  }
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildCsvHeader(columns: CsvColumn[], options?: CsvEscapeOptions): string {
  return columns.map((c) => escapeCsvValue(c.name, options)).join(',');
}

export interface FormulaExportOptions {
  getFormula?: (col: number, row: number) => string | undefined;
  hasFormula?: (col: number, row: number) => boolean;
  /** Map from columnId to flat column index */
  columnIdToIndex?: Map<string, number>;
  /** Export mode: 'values' (default) exports computed results, 'formulas' exports formula strings */
  exportMode?: 'values' | 'formulas';
  /**
   * See {@link CsvEscapeOptions.preventFormulaInjection}. Default: true.
   * Formula strings written in `exportMode: 'formulas'` are never prefixed.
   */
  preventFormulaInjection?: boolean;
}

export function buildCsvRows<T>(
  items: T[],
  columns: CsvColumn[],
  getValue: (item: T, columnId: string) => unknown,
  formulaOptions?: FormulaExportOptions
): string[] {
  const escapeOptions: CsvEscapeOptions = {
    preventFormulaInjection: formulaOptions?.preventFormulaInjection,
  };
  return items.map((item, rowIdx) =>
    columns.map((col) => {
      // If exporting formulas and cell has a formula, use formula string
      if (
        formulaOptions?.exportMode === 'formulas' &&
        formulaOptions.hasFormula &&
        formulaOptions.getFormula &&
        formulaOptions.columnIdToIndex
      ) {
        const colIdx = formulaOptions.columnIdToIndex.get(col.columnId);
        if (colIdx !== undefined && formulaOptions.hasFormula(colIdx, rowIdx)) {
          const formula = formulaOptions.getFormula(colIdx, rowIdx);
          if (formula) return escapeCsvValue(formula, { preventFormulaInjection: false });
        }
      }
      // Default: export computed value
      return escapeCsvValue(getValue(item, col.columnId), escapeOptions);
    }).join(',')
  );
}

export function exportToCsv<T>(
  items: T[],
  columns: CsvColumn[],
  getValue: (item: T, columnId: string) => unknown,
  filename?: string,
  formulaOptions?: FormulaExportOptions
): void {
  const header = buildCsvHeader(columns, {
    preventFormulaInjection: formulaOptions?.preventFormulaInjection,
  });
  const rows = buildCsvRows(items, columns, getValue, formulaOptions);
  const csv = [header, ...rows].join('\n');
  triggerCsvDownload(csv, filename ?? `export_${new Date().toISOString().slice(0, 10)}.csv`);
}

/**
 * Triggers a browser CSV file download.
 *
 * NOTE: This function uses DOM APIs (document.createElement, document.body) and therefore
 * requires a browser environment. It is intentionally kept in the core package because all
 * framework packages (React, Angular, Vue, JS) need CSV export, and duplicating it would be
 * worse than the DOM dependency. In server-side rendering (SSR) contexts, call exportToCsv
 * only from browser-side code (e.g. event handlers), not during server rendering.
 */
export function triggerCsvDownload(csvContent: string, filename: string): void {
  triggerBlobDownload(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }), filename);
}

/** Trigger a browser download for any Blob (xlsx, csv, …) via a temporary anchor. */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  try {
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
  } finally {
    try {
      document.body.removeChild(link);
    } catch (err) {
      // The link is normally still attached here; a failure means it was already
      // detached elsewhere, which is harmless. Surface it in dev, stay silent in prod.
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[OGrid] download link cleanup failed (already detached?)', err);
      }
    }
    URL.revokeObjectURL(url);
  }
}
