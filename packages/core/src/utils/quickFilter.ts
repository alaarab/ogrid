import type { IColumnDef } from '../types';
import { getCellValue } from './cellValue';
import { formatCellValue } from './cellFormatting';

/** Lowercased search terms of a quick filter: the text split on whitespace. Empty when blank. */
export function getQuickFilterTerms(text: string | undefined): string[] {
  const trimmed = text?.trim();
  return trimmed ? trimmed.toLowerCase().split(/\s+/) : [];
}

/**
 * Row predicate for a quick filter (one search box over the whole grid). A row
 * passes when every term appears in at least one of `columns`, in the cell's
 * raw value or its displayed (formatted) text, case-insensitively. Terms may
 * match in different columns: "carol active" finds Carol's active rows.
 *
 * @returns null when the text has no terms (nothing to filter).
 */
export function createQuickFilterPredicate<T>(
  text: string | undefined,
  columns: readonly IColumnDef<T>[],
): ((row: T) => boolean) | null {
  const terms = getQuickFilterTerms(text);
  if (terms.length === 0) return null;
  return (row) => {
    let haystack = '';
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      if (col === undefined) continue;
      const value = getCellValue(row, col);
      const raw = value == null ? '' : String(value);
      const shown = formatCellValue(value, row, col) ?? '';
      // \u0000 keeps a term from matching across two cells.
      haystack += `\u0000${raw}${shown === raw ? '' : `\u0000${shown}`}`;
    }
    haystack = haystack.toLowerCase();
    for (let t = 0; t < terms.length; t++) {
      if (!haystack.includes(terms[t] as string)) return false;
    }
    return true;
  };
}
