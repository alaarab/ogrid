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
    const s = String(val);
    // Excel/Sheets convention: cells containing tabs or line breaks are
    // quoted (inner quotes doubled) so they survive a paste intact.
    // A leading quote is quoted too, or the parser would read it as a quoted cell.
    return /[\t\r\n]/.test(s) || s.startsWith('"') ? `"${s.replace(/"/g, '""')}"` : s;
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
      if (item === undefined || col === undefined) break;
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
      if (clipboard != null) {
        // clipboardFormatter output is final, even '' (keeps a column's data off the clipboard).
        cells.push(formatCellValueForTsv('', clipboard));
        continue;
      }
      const formatted = col.valueFormatter ? col.valueFormatter(raw, item) : raw;
      cells.push(formatCellValueForTsv(raw, formatted));
    }
    rows.push(cells.join('\t'));
  }
  return rows.join('\r\n');
}

/**
 * Parse a TSV clipboard string into a 2D array of cell strings.
 * Handles \r\n and \n line endings and Excel-style quoted cells (a cell that
 * starts with `"` may contain tabs, line breaks and `""` escaped quotes).
 * Interior blank lines are kept as empty rows; only the single trailing line
 * break that spreadsheets append is dropped.
 *
 * @param text  Raw clipboard text (TSV format).
 * @returns 2D array: rows of cells. Empty if text is blank.
 */
export function parseTsvClipboard(text: string): string[][] {
  if (!text.trim()) return [];
  const rows: string[][] = [];
  let row: string[] = [];
  const len = text.length;
  let i = 0;
  while (i <= len) {
    let cell = '';
    let quotedEnd = -1;
    if (text[i] === '"') {
      // Find the closing quote that is followed by a delimiter or end of text.
      let j = i + 1;
      let buf = '';
      while (j < len) {
        const ch = text[j];
        if (ch === '"') {
          if (text[j + 1] === '"') {
            buf += '"';
            j += 2;
            continue;
          }
          const next = text[j + 1];
          if (next === undefined || next === '\t' || next === '\n' || next === '\r') {
            quotedEnd = j + 1;
            cell = buf;
          }
          break;
        }
        buf += ch;
        j++;
      }
    }
    if (quotedEnd !== -1) {
      i = quotedEnd;
    } else {
      // Unquoted (or unterminated quote): read up to the next delimiter literally.
      let j = i;
      while (j < len && text[j] !== '\t' && text[j] !== '\n' && text[j] !== '\r') j++;
      cell = text.slice(i, j);
      i = j;
    }
    row.push(cell);
    const ch = text[i];
    if (ch === '\t') {
      i++;
    } else if (ch === '\r' || ch === '\n') {
      i += ch === '\r' && text[i + 1] === '\n' ? 2 : 1;
      rows.push(row);
      row = [];
      if (i >= len) break; // trailing line break: no extra empty row
    } else {
      rows.push(row);
      break;
    }
  }
  return rows;
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
    if (cells === undefined) continue;
    for (let c = 0; c < cells.length; c++) {
      const targetRow = anchorRow + r;
      const targetCol = anchorCol + c;
      if (targetRow >= items.length || targetCol >= visibleCols.length) continue;
      const item = items[targetRow];
      const col = visibleCols[targetCol];
      if (item === undefined || col === undefined) continue;
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
      if (item === undefined || col === undefined) continue;
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

/**
 * A pending cut, captured by identity (row keys and column ids) rather than
 * position, so a sort, filter, page or column change before the paste cannot
 * make it clear the wrong cells.
 */
export interface ICutSource {
  /** Key of each cut row, top to bottom: its row id, or the row object itself. */
  rowKeys: unknown[];
  /** Column id of each cut column, left to right. */
  columnIds: string[];
  /** The TSV the cut put on the clipboard. */
  text: string;
}

/**
 * Capture the cells of `range` as a pending cut (see `ICutSource`).
 *
 * @param range        The cut range (any corner order).
 * @param items        Array of all row data objects.
 * @param visibleCols  Visible column definitions.
 * @param rowKeyOf     Row identity: the row id, or the row object itself.
 * @param text         The TSV the cut put on the clipboard.
 */
export function captureCutSource<T>(
  range: ISelectionRange,
  items: T[],
  visibleCols: IColumnDef<T>[],
  rowKeyOf: (item: T) => unknown,
  text: string
): ICutSource {
  const norm = normalizeSelectionRange(range);
  const rowKeys: unknown[] = [];
  for (let r = norm.startRow; r <= norm.endRow; r++) {
    const item = items[r];
    rowKeys.push(item === undefined ? undefined : rowKeyOf(item));
  }
  const columnIds: string[] = [];
  for (let c = norm.startCol; c <= norm.endCol; c++) columnIds.push(visibleCols[c]?.columnId ?? '');
  return { rowKeys, columnIds, text };
}

const normalizeClipboardText = (s: string): string => s.replace(/\r\n?/g, '\n').replace(/\n+$/, '');

/** Inputs for `resolveCutClear`. */
export interface ResolveCutClearParams<T> {
  /** The pending cut. */
  cut: ICutSource;
  /** The pasted text. The cut completes only when it is the text the cut put on the clipboard. */
  text: string;
  /** Value events the paste produced. */
  pasteEvents: ICellValueChangedEvent<T>[];
  /** `${rowIndex}|${columnId}` of cells the paste wrote a formula to (they produce no value event). */
  pastedFormulaCells?: string[];
  /** Paste anchor (top-left target cell). */
  anchorRow: number;
  anchorCol: number;
  items: T[];
  visibleCols: IColumnDef<T>[];
  /** Row identity used when the cut was captured. */
  rowKeyOf: (item: T) => unknown;
}

/**
 * The events that empty the source cells of a cut once it has been pasted.
 *
 * Returns nothing when the pasted text is not what the cut put on the
 * clipboard (something was copied elsewhere in the meantime). Source cells
 * are found by identity, so they are cleared where they are now. A source cell
 * stays intact when its destination did not accept the paste (read-only,
 * invalid, or clipped at the grid edge), and a cell the paste itself wrote is
 * never cleared (cut and paste overlapping: the paste wins).
 */
export function resolveCutClear<T>(params: ResolveCutClearParams<T>): ICellValueChangedEvent<T>[] {
  const { cut, text, pasteEvents, pastedFormulaCells, anchorRow, anchorCol, items, visibleCols, rowKeyOf } = params;
  if (normalizeClipboardText(text) !== normalizeClipboardText(cut.text)) return [];
  const pasted = new Set(pasteEvents.map((e) => `${e.rowIndex}|${e.columnId}`));
  for (const key of pastedFormulaCells ?? []) pasted.add(key);
  const rowIndexByKey = new Map<unknown, number>();
  items.forEach((item, i) => { rowIndexByKey.set(rowKeyOf(item), i); });
  const events: ICellValueChangedEvent<T>[] = [];
  for (const [sourceRow, key] of cut.rowKeys.entries()) {
    const r = rowIndexByKey.get(key);
    if (r === undefined) continue;
    for (const [sourceCol, columnId] of cut.columnIds.entries()) {
      const targetColumn = visibleCols[anchorCol + sourceCol];
      if (!targetColumn || !pasted.has(`${anchorRow + sourceRow}|${targetColumn.columnId}`)) continue;
      const c = visibleCols.findIndex((col) => col.columnId === columnId);
      if (c < 0) continue;
      for (const e of applyCutClear({ startRow: r, endRow: r, startCol: c, endCol: c }, items, visibleCols)) {
        if (!pasted.has(`${e.rowIndex}|${e.columnId}`)) events.push(e);
      }
    }
  }
  return events;
}
