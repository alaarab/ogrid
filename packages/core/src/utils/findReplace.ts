/**
 * Excel-style Find & Replace over grid data: a pure matcher plus the value
 * changes a replace produces. The React layer owns the UI, navigation and the
 * edit path (valueParser, undo batching); this module never mutates rows.
 */
import type { IColumnDef, ICellValueChangedEvent } from '../types/columnTypes';
import type { RowId, ISelectionRange } from '../types/dataGridTypes';
import { getCellValue, isColumnEditable } from './cellValue';
import { formatCellValue } from './cellFormatting';
import { parseValue } from './valueParsers';

/** Which text a cell is searched by. */
export type FindLookIn =
  /** The displayed (formatted) text; a formula cell's computed result. */
  | 'values'
  /** The underlying content: the raw value as text, or a formula cell's formula. */
  | 'formulas';

/** Order matches are visited in. */
export type FindSearchOrder = 'byRows' | 'byColumns';

/** Where to search. */
export type FindScope = 'grid' | 'selection';

export interface IFindOptions {
  /** Match upper/lower case exactly. Default false. */
  matchCase?: boolean;
  /** The whole cell text must equal the query. Default false. */
  matchEntireCell?: boolean;
  /** Search displayed values or underlying content/formulas. Default 'values'. */
  lookIn?: FindLookIn;
  /** Visit matches row by row or column by column. Default 'byRows'. */
  searchOrder?: FindSearchOrder;
  /** Search the whole grid or only the selection. Default 'grid'. */
  scope?: FindScope;
}

export const DEFAULT_FIND_OPTIONS: Readonly<Required<IFindOptions>> = Object.freeze({
  matchCase: false,
  matchEntireCell: false,
  lookIn: 'values',
  searchOrder: 'byRows',
  scope: 'grid',
});

/** A matching cell. Indexes point into the searched `items` and `columns`. */
export interface IFindMatch {
  rowId: RowId;
  columnId: string;
  rowIndex: number;
  columnIndex: number;
}

/** The cells a find runs over. */
export interface IFindSource<T> {
  /** Rows in display order. Holes (unloaded rows) are skipped. */
  items: readonly (T | undefined)[];
  /** Columns in display order. */
  columns: readonly IColumnDef<T>[];
  getRowId: (item: T) => RowId;
  /** A cell's formula (e.g. `=A1*2`), or undefined for a plain cell. */
  getFormula?: (item: T, column: IColumnDef<T>, rowIndex: number) => string | undefined;
  /** A formula cell's computed value. Read only for cells with a formula. */
  getFormulaValue?: (item: T, column: IColumnDef<T>, rowIndex: number) => unknown;
  /** True for a cell hidden under a merged cell; it is never matched. */
  isCoveredCell?: (rowIndex: number, columnIndex: number) => boolean;
}

function rawText(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  return String(value);
}

/** The text a cell is searched by under `lookIn`. */
export function getFindCellText<T>(
  source: IFindSource<T>,
  item: T,
  column: IColumnDef<T>,
  rowIndex: number,
  lookIn: FindLookIn = 'values',
): string {
  const formula = source.getFormula?.(item, column, rowIndex);
  if (formula !== undefined) {
    if (lookIn === 'formulas') return formula;
    const computed = source.getFormulaValue?.(item, column, rowIndex);
    return formatCellValue(computed, item, column) ?? '';
  }
  const value = getCellValue(item, column);
  if (lookIn === 'formulas') {
    // Plain values keep their typed form; objects fall back to their display text.
    return value !== null && typeof value === 'object' && !(value instanceof Date)
      ? (formatCellValue(value, item, column) ?? '')
      : rawText(value);
  }
  return formatCellValue(value, item, column) ?? '';
}

/** True when `text` matches `query` under the case / entire-cell options. An empty query matches nothing. */
export function cellTextMatches(text: string, query: string, options: IFindOptions = {}): boolean {
  if (query === '') return false;
  const a = options.matchCase ? text : text.toLowerCase();
  const b = options.matchCase ? query : query.toLowerCase();
  return options.matchEntireCell ? a === b : a.includes(b);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * `text` with every occurrence of `query` replaced (or the whole text, when
 * `matchEntireCell`). Returns `text` unchanged when it doesn't match. `$`
 * sequences in `replacement` are literal.
 */
export function replaceInCellText(text: string, query: string, replacement: string, options: IFindOptions = {}): string {
  if (!cellTextMatches(text, query, options)) return text;
  if (options.matchEntireCell) return replacement;
  if (options.matchCase) return text.split(query).join(replacement);
  return text.replace(new RegExp(escapeRegExp(query), 'gi'), () => replacement);
}

/**
 * Every cell matching `query`, in visit order (`searchOrder`). With
 * `scope: 'selection'` only cells inside `selection` (row/column indexes into
 * `items`/`columns`) are searched; without a selection nothing matches.
 */
export function findMatches<T>(
  source: IFindSource<T>,
  query: string,
  options: IFindOptions = {},
  selection?: ISelectionRange | null,
): IFindMatch[] {
  const matches: IFindMatch[] = [];
  const { items, columns } = source;
  if (query === '' || items.length === 0 || columns.length === 0) return matches;
  const lookIn = options.lookIn ?? 'values';
  let r0 = 0;
  let r1 = items.length - 1;
  let c0 = 0;
  let c1 = columns.length - 1;
  if ((options.scope ?? 'grid') === 'selection') {
    if (!selection) return matches;
    r0 = Math.max(r0, Math.min(selection.startRow, selection.endRow));
    r1 = Math.min(r1, Math.max(selection.startRow, selection.endRow));
    c0 = Math.max(c0, Math.min(selection.startCol, selection.endCol));
    c1 = Math.min(c1, Math.max(selection.startCol, selection.endCol));
  }
  const visit = (r: number, c: number) => {
    const item = items[r];
    const column = columns[c];
    if (item === undefined || column === undefined) return;
    if (source.isCoveredCell?.(r, c)) return;
    const text = getFindCellText(source, item, column, r, lookIn);
    if (cellTextMatches(text, query, options)) {
      matches.push({ rowId: source.getRowId(item), columnId: column.columnId, rowIndex: r, columnIndex: c });
    }
  };
  if ((options.searchOrder ?? 'byRows') === 'byColumns') {
    for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) visit(r, c);
  } else {
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) visit(r, c);
  }
  return matches;
}

/** True when cell (r1, c1) comes before (r2, c2) in visit order. */
function cellBefore(r1: number, c1: number, r2: number, c2: number, order: FindSearchOrder): boolean {
  return order === 'byColumns'
    ? c1 < c2 || (c1 === c2 && r1 < r2)
    : r1 < r2 || (r1 === r2 && c1 < c2);
}

/**
 * Index of the next (`direction` 1) or previous (-1) match from cell `from`,
 * wrapping around. With `inclusive`, a match at `from` itself counts. Without
 * `from`, the first (or last) match. -1 when there are no matches.
 */
export function findNextMatchIndex(
  matches: readonly IFindMatch[],
  from: { rowIndex: number; columnIndex: number } | null | undefined,
  direction: 1 | -1 = 1,
  order: FindSearchOrder = 'byRows',
  inclusive = false,
): number {
  const n = matches.length;
  if (n === 0) return -1;
  if (!from) return direction === 1 ? 0 : n - 1;
  const { rowIndex: r, columnIndex: c } = from;
  if (direction === 1) {
    for (let i = 0; i < n; i++) {
      const m = matches[i] as IFindMatch;
      if (inclusive && m.rowIndex === r && m.columnIndex === c) return i;
      if (cellBefore(r, c, m.rowIndex, m.columnIndex, order)) return i;
    }
    return 0;
  }
  for (let i = n - 1; i >= 0; i--) {
    const m = matches[i] as IFindMatch;
    if (inclusive && m.rowIndex === r && m.columnIndex === c) return i;
    if (cellBefore(m.rowIndex, m.columnIndex, r, c, order)) return i;
  }
  return n - 1;
}

/** A replace that writes a formula (the new text starts with `=`). */
export interface IFindFormulaEdit<T> {
  item: T;
  columnId: string;
  rowIndex: number;
  columnIndex: number;
  oldFormula: string | undefined;
  newFormula: string;
}

export interface IReplacePlan<T> {
  /** Value changes, already run through each column's `valueParser`. */
  events: ICellValueChangedEvent<T>[];
  /** Formula writes (only when `allowFormulas`). */
  formulaEdits: IFindFormulaEdit<T>[];
  /** Cells that will change: `events.length + formulaEdits.length`. */
  replaced: number;
  /** Matches left alone: read-only, rejected by the parser, or a formula a value replace would destroy. */
  skipped: number;
  /** Of `skipped`: cells in non-editable columns/rows. */
  skippedReadOnly: number;
  /** Of `skipped`: replacements the column's `valueParser` (or type) rejected. */
  skippedInvalid: number;
  /** Of `skipped`: formula cells a replace would overwrite (matched by value, or formulas not writable). */
  skippedFormula: number;
}

export interface IPlanReplaceParams<T> {
  source: IFindSource<T>;
  matches: readonly IFindMatch[];
  query: string;
  replacement: string;
  options?: IFindOptions;
  /** Override editability (default: the column's `editable`). */
  isEditable?: (item: T, column: IColumnDef<T>) => boolean;
  /** New text starting with `=` becomes a formula edit. Default false (it is written as text). */
  allowFormulas?: boolean;
}

/**
 * The changes replacing `query` with `replacement` in `matches` would make.
 * The replacement is applied to the same text the match was found in
 * (`lookIn`), then parsed back through the column's `valueParser`, the way a
 * typed or pasted value is. Nothing is written: apply `events` through the
 * grid's edit path (as one undo step for replace all).
 */
export function planReplace<T>(params: IPlanReplaceParams<T>): IReplacePlan<T> {
  const { source, matches, query, replacement, options = {}, isEditable = (item, col) => isColumnEditable(col, item), allowFormulas = false } = params;
  const lookIn = options.lookIn ?? 'values';
  const plan: IReplacePlan<T> = {
    events: [], formulaEdits: [], replaced: 0, skipped: 0, skippedReadOnly: 0, skippedInvalid: 0, skippedFormula: 0,
  };
  for (const m of matches) {
    const item = source.items[m.rowIndex];
    const column = source.columns[m.columnIndex];
    if (item === undefined || column === undefined) continue;
    if (!isEditable(item, column)) {
      plan.skippedReadOnly++;
      continue;
    }
    const formula = source.getFormula?.(item, column, m.rowIndex);
    if (formula !== undefined && (lookIn === 'values' || !allowFormulas)) {
      plan.skippedFormula++;
      continue;
    }
    const text = getFindCellText(source, item, column, m.rowIndex, lookIn);
    const next = replaceInCellText(text, query, replacement, options);
    if (next === text) continue;
    if (allowFormulas && next.startsWith('=')) {
      plan.formulaEdits.push({ item, columnId: column.columnId, rowIndex: m.rowIndex, columnIndex: m.columnIndex, oldFormula: formula, newFormula: next });
      continue;
    }
    const oldValue = getCellValue(item, column);
    const parsed = parseValue(next, oldValue, item, column);
    if (!parsed.valid) {
      plan.skippedInvalid++;
      continue;
    }
    plan.events.push({ item, columnId: column.columnId, oldValue, newValue: parsed.value, rowIndex: m.rowIndex });
  }
  plan.skipped = plan.skippedReadOnly + plan.skippedInvalid + plan.skippedFormula;
  plan.replaced = plan.events.length + plan.formulaEdits.length;
  return plan;
}

/** Status text for a find: "3 of 12", "12 matches", or "No results". */
export function formatFindStatus(activeIndex: number, count: number): string {
  if (count === 0) return 'No results';
  if (activeIndex < 0) return count === 1 ? '1 match' : `${count} matches`;
  return `${activeIndex + 1} of ${count}`;
}
