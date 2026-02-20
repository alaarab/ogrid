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

export function buildCsvRows<T>(
  items: T[],
  columns: CsvColumn[],
  getValue: (item: T, columnId: string) => string
): string[] {
  return items.map((item) =>
    columns.map((c) => escapeCsvValue(getValue(item, c.columnId))).join(',')
  );
}

export function exportToCsv<T>(
  items: T[],
  columns: CsvColumn[],
  getValue: (item: T, columnId: string) => string,
  filename?: string
): void {
  const header = buildCsvHeader(columns);
  const rows = buildCsvRows(items, columns, getValue);
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
    try { document.body.removeChild(link); } catch { /* noop */ }
    URL.revokeObjectURL(url);
  }
}
