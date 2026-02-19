/**
 * Pure clipboard helpers shared across React, Vue, Angular, and JS.
 * No framework dependencies — operates on plain values and produces strings.
 */
import type { IColumnDef } from '../types/columnTypes';
import type { ISelectionRange } from '../types/dataGridTypes';
import { getCellValue } from './cellValue';
import { normalizeSelectionRange } from '../types';

/**
 * Format a single cell value for inclusion in a TSV clipboard string.
 * Strips tabs and newlines so they don't corrupt the TSV structure.
 *
 * @param raw         Raw cell value (from getCellValue).
 * @param formatted   Formatted value (from valueFormatter, if present).
 * @returns TSV-safe string representation of the cell.
 */
export function formatCellValueForTsv(
  raw: unknown,
  formatted: unknown
): string {
  const val = formatted != null && formatted !== '' ? formatted : raw;
  if (val == null || val === '') return '';
  return String(val).replace(/[\t\n]/g, ' ');
}

/**
 * Serialize a rectangular cell range to a TSV (tab-separated values) string
 * suitable for writing to the clipboard.
 *
 * @param items       Flat array of all row data objects.
 * @param visibleCols Visible column definitions.
 * @param range       The selection range to serialize (will be normalized).
 * @returns TSV string with rows separated by \\r\\n and columns by \\t.
 */
export function formatSelectionAsTsv<T>(
  items: T[],
  visibleCols: IColumnDef<T>[],
  range: ISelectionRange
): string {
  const norm = normalizeSelectionRange(range);
  const rows: string[] = [];
  for (let r = norm.startRow; r <= norm.endRow; r++) {
    const cells: string[] = [];
    for (let c = norm.startCol; c <= norm.endCol; c++) {
      if (r >= items.length || c >= visibleCols.length) break;
      const item = items[r];
      const col = visibleCols[c];
      const raw = getCellValue(item, col);
      const clipboard = col.clipboardFormatter ? col.clipboardFormatter(raw, item) : null;
      const formatted = clipboard ?? (col.valueFormatter ? col.valueFormatter(raw, item) : raw);
      cells.push(formatCellValueForTsv(raw, formatted));
    }
    rows.push(cells.join('\t'));
  }
  return rows.join('\r\n');
}

/**
 * Parse a TSV clipboard string into a 2D array of cell strings.
 * Handles both \\r\\n and \\n line endings. Ignores trailing empty lines.
 *
 * @param text  Raw clipboard text (TSV format).
 * @returns 2D array: rows of cells. Empty if text is blank.
 */
export function parseTsvClipboard(text: string): string[][] {
  if (!text.trim()) return [];
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  return lines.map((line) => line.split('\t'));
}
