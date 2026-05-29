export interface CsvColumn {
  columnId: string;
  name: string;
}

export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildCsvHeader(columns: CsvColumn[]): string {
  return columns.map((c) => escapeCsvValue(c.name)).join(',');
}

export interface FormulaExportOptions {
  getFormula?: (col: number, row: number) => string | undefined;
  hasFormula?: (col: number, row: number) => boolean;
  /** Map from columnId to flat column index */
  columnIdToIndex?: Map<string, number>;
  /** Export mode: 'values' (default) exports computed results, 'formulas' exports formula strings */
  exportMode?: 'values' | 'formulas';
}

export function buildCsvRows<T>(
  items: T[],
  columns: CsvColumn[],
  getValue: (item: T, columnId: string) => unknown,
  formulaOptions?: FormulaExportOptions
): string[] {
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
          if (formula) return escapeCsvValue(formula);
        }
      }
      // Default: export computed value
      return escapeCsvValue(getValue(item, col.columnId));
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
  const header = buildCsvHeader(columns);
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
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
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
        console.warn('[OGrid] CSV download link cleanup failed (already detached?)', err);
      }
    }
    URL.revokeObjectURL(url);
  }
}
