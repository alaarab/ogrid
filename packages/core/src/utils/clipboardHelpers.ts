/**
 * Pure clipboard helpers shared across React, Vue, Angular, and JS.
 * No framework dependencies  -  operates on plain values and produces strings.
 */
import type { IColumnDef, ICellValueChangedEvent } from '../types/columnTypes';
import type { ISelectionRange } from '../types/dataGridTypes';
import { getCellValue, isColumnEditable } from './cellValue';
import { parseValue } from './valueParsers';
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
  try {
    return String(val).replace(/[\t\n]/g, ' ');
  } catch {
    return '[Object]';
  }
}

/**
 * Serialize a rectangular cell range to a TSV (tab-separated values) string
 * suitable for writing to the clipboard.
 *
 * @param items       Flat array of all row data objects.
 * @param visibleCols Visible column definitions.
 * @param range       The selection range to serialize (will be normalized).
 * @param formulaOptions  Optional formula-aware options. When provided, cells with
 *                        formulas will have their formula string copied instead of
 *                        the computed value.
 * @returns TSV string with rows separated by \\r\\n and columns by \\t.
 */
export function formatSelectionAsTsv<T>(
  items: T[],
  visibleCols: IColumnDef<T>[],
  range: ISelectionRange,
  formulaOptions?: {
    colOffset: number;
    flatColumns: IColumnDef<T>[];
    getFormula?: (col: number, row: number) => string | undefined;
    hasFormula?: (col: number, row: number) => boolean;
  }
): string {
  const norm = normalizeSelectionRange(range);
  // Precompute columnId -> flat index once instead of findIndex per copied cell.
  const flatColIndexById = formulaOptions
    ? new Map(formulaOptions.flatColumns.map((fc, i) => [fc.columnId, i] as const))
    : null;
  const rows: string[] = [];
  for (let r = norm.startRow; r <= norm.endRow; r++) {
    const cells: string[] = [];
    for (let c = norm.startCol; c <= norm.endCol; c++) {
      if (r >= items.length || c >= visibleCols.length) break;
      const item = items[r];
      const col = visibleCols[c];
      // Check formula first  -  copy formula text instead of computed value
      if (formulaOptions?.hasFormula && formulaOptions?.getFormula) {
        const flatColIndex = flatColIndexById?.get(col.columnId) ?? -1;
        if (flatColIndex >= 0 && formulaOptions.hasFormula(flatColIndex, r)) {
          const formulaStr = formulaOptions.getFormula(flatColIndex, r);
          if (formulaStr) {
            cells.push(formulaStr);
            continue;
          }
        }
      }
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

/**
 * Apply parsed clipboard rows to the grid starting at anchor position.
 * For each cell in the parsed rows, validates editability, parses the value,
 * and produces a cell value changed event.
 *
 * When `formulaOptions` is provided, cells whose pasted text starts with "="
 * are routed through `setFormula` instead of the normal value parse path.
 *
 * @param parsedRows   2D array of string values (from parseTsvClipboard).
 * @param anchorRow    Target starting row index.
 * @param anchorCol    Target starting column index (data column, not absolute).
 * @param items        Array of all row data objects.
 * @param visibleCols  Visible column definitions.
 * @param formulaOptions  Optional formula-aware options.
 * @returns Array of cell value changed events to apply.
 */
export function applyPastedValues<T>(
  parsedRows: string[][],
  anchorRow: number,
  anchorCol: number,
  items: T[],
  visibleCols: IColumnDef<T>[],
  formulaOptions?: {
    colOffset: number;
    flatColumns: IColumnDef<T>[];
    setFormula?: (col: number, row: number, formula: string | null) => void;
  }
): ICellValueChangedEvent<T>[] {
  const events: ICellValueChangedEvent<T>[] = [];
  // Precompute columnId -> flat index once instead of findIndex per pasted cell.
  const flatColIndexById = formulaOptions
    ? new Map(formulaOptions.flatColumns.map((fc, i) => [fc.columnId, i] as const))
    : null;
  for (let r = 0; r < parsedRows.length; r++) {
    const cells = parsedRows[r];
    for (let c = 0; c < cells.length; c++) {
      const targetRow = anchorRow + r;
      const targetCol = anchorCol + c;
      if (targetRow >= items.length || targetCol >= visibleCols.length) continue;
      const item = items[targetRow];
      const col = visibleCols[targetCol];
      if (!isColumnEditable(col, item)) continue;
      const cellText = cells[c] ?? '';
      // Detect formula paste  -  route through setFormula instead of normal value path
      if (cellText.startsWith('=') && formulaOptions?.setFormula) {
        const flatColIndex = flatColIndexById?.get(col.columnId) ?? -1;
        if (flatColIndex >= 0) {
          formulaOptions.setFormula(flatColIndex, targetRow, cellText);
          continue;
        }
      }
      const oldValue = getCellValue(item, col);
      const result = parseValue(cellText, oldValue, item, col);
      if (!result.valid) continue;
      events.push({
        item,
        columnId: col.columnId,
        oldValue,
        newValue: result.value,
        rowIndex: targetRow,
      });
    }
  }
  return events;
}

/**
 * Clear cells in a cut range by setting each editable cell to an empty-string-parsed value.
 * Used after pasting cut content to clear the original cells.
 *
 * @param cutRange     The normalized range of cells to clear.
 * @param items        Array of all row data objects.
 * @param visibleCols  Visible column definitions.
 * @returns Array of cell value changed events to apply.
 */
export function applyCutClear<T>(
  cutRange: ISelectionRange,
  items: T[],
  visibleCols: IColumnDef<T>[]
): ICellValueChangedEvent<T>[] {
  const events: ICellValueChangedEvent<T>[] = [];
  for (let r = cutRange.startRow; r <= cutRange.endRow; r++) {
    for (let c = cutRange.startCol; c <= cutRange.endCol; c++) {
      if (r >= items.length || c >= visibleCols.length) continue;
      const item = items[r];
      const col = visibleCols[c];
      if (!isColumnEditable(col, item)) continue;
      const oldValue = getCellValue(item, col);
      const result = parseValue('', oldValue, item, col);
      if (!result.valid) continue;
      events.push({
        item,
        columnId: col.columnId,
        oldValue,
        newValue: result.value,
        rowIndex: r,
      });
    }
  }
  return events;
}
