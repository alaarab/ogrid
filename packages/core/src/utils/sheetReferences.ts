/**
 * A1-style reference helpers for the editing chrome: parsing what the user
 * types into the name box, and Excel's F4 absolute/relative cycling of the
 * reference at the caret while a formula is edited.
 */
import { columnLetterToIndex } from './cellReference';

/**
 * A rectangle in sheet coordinates (0-based flat column, 0-based sheet row).
 * An omitted axis means "all of it": `A:C` has no rows, `2:4` no columns.
 */
export interface ISheetReferenceRange {
  startCol?: number;
  endCol?: number;
  startRow?: number;
  endRow?: number;
}

const MAX_ROWS = 1048576;
const MAX_COLS = 16384;

const CELL_RE = /^([A-Z]{1,3})(\d+)$/i;
const CELL_RANGE_RE = /^([A-Z]{1,3})(\d+):([A-Z]{1,3})(\d+)$/i;
const COLUMN_RANGE_RE = /^([A-Z]{1,3})(?::([A-Z]{1,3}))?$/i;
const ROW_RANGE_RE = /^(\d+):(\d+)$/;

function toCol(letters: string): number | null {
  const c = columnLetterToIndex(letters);
  return c >= 0 && c < MAX_COLS ? c : null;
}

function toRow(digits: string): number | null {
  const n = Number.parseInt(digits, 10);
  return n >= 1 && n <= MAX_ROWS ? n - 1 : null;
}

function span(a: number | null, b: number | null): [number, number] | null {
  if (a == null || b == null) return null;
  return a <= b ? [a, b] : [b, a];
}

/**
 * Parse a name box entry: a cell (`B3`), a range (`A1:C5`), whole columns
 * (`B:D`, or a lone column letter only when it is not a defined name), whole
 * rows (`2:4`), or a defined name from `namedRanges` (case-insensitive) whose
 * target is one of those. `$` markers are ignored. Cross-sheet targets
 * (`Sheet2!A1`) are not navigable and return null, as does anything else.
 */
export function parseSheetReference(
  input: string,
  namedRanges?: Readonly<Record<string, string>> | null
): ISheetReferenceRange | null {
  const raw = input.trim();
  if (raw === '') return null;
  if (namedRanges) {
    const lower = raw.toLowerCase();
    for (const name of Object.keys(namedRanges)) {
      if (name.toLowerCase() === lower) {
        const target = namedRanges[name];
        return typeof target === 'string' ? parseSheetReference(target) : null;
      }
    }
  }
  const text = raw.replace(/\$/g, '');
  if (text.includes('!')) return null;

  let m = text.match(CELL_RE);
  if (m) {
    const col = toCol(m[1] as string);
    const row = toRow(m[2] as string);
    return col == null || row == null ? null : { startCol: col, endCol: col, startRow: row, endRow: row };
  }
  m = text.match(CELL_RANGE_RE);
  if (m) {
    const cols = span(toCol(m[1] as string), toCol(m[3] as string));
    const rows = span(toRow(m[2] as string), toRow(m[4] as string));
    return cols && rows ? { startCol: cols[0], endCol: cols[1], startRow: rows[0], endRow: rows[1] } : null;
  }
  m = text.match(ROW_RANGE_RE);
  if (m) {
    const rows = span(toRow(m[1] as string), toRow(m[2] as string));
    return rows ? { startRow: rows[0], endRow: rows[1] } : null;
  }
  m = text.match(COLUMN_RANGE_RE);
  if (m && (m[2] != null || text.length <= 3)) {
    // A lone "B" is column B (Excel needs "B:B"; accepting "B" is friendlier and unambiguous here).
    const cols = span(toCol(m[1] as string), toCol((m[2] ?? m[1]) as string));
    return cols ? { startCol: cols[0], endCol: cols[1] } : null;
  }
  return null;
}

/** Result of an F4 press: the new text, and the span of the reference it changed. */
export interface ICycledReference {
  text: string;
  /** Start of the changed reference in `text`. */
  start: number;
  /** End (exclusive) of the changed reference in `text`; put the caret here. */
  end: number;
}

const REF_RE = /(\$?)([A-Za-z]{1,3})(\$?)(\d+)/g;
const IDENT_CHAR = /[A-Za-z0-9_.]/;

interface RefToken {
  start: number;
  end: number;
  colAbs: boolean;
  rowAbs: boolean;
  col: string;
  row: string;
}

/** Cell references in a formula, outside string literals and not part of a name or function. */
function findReferences(text: string): RefToken[] {
  const inString = new Uint8Array(text.length);
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '"') quoted = !quoted;
    else if (quoted) inString[i] = 1;
  }
  const refs: RefToken[] = [];
  REF_RE.lastIndex = 0;
  for (let m = REF_RE.exec(text); m !== null; m = REF_RE.exec(text)) {
    const start = m.index;
    const end = start + m[0].length;
    if (inString[start]) continue;
    const before = start > 0 ? text[start - 1] as string : '';
    const after = end < text.length ? text[end] as string : '';
    // LOG10( is a function, R2D2 or my_A1 a name: not references.
    if ((before && IDENT_CHAR.test(before)) || (after && (IDENT_CHAR.test(after) || after === '('))) continue;
    refs.push({ start, end, colAbs: m[1] === '$', col: m[2] as string, rowAbs: m[3] === '$', row: m[4] as string });
  }
  return refs;
}

/** A1 -> $A$1 -> A$1 -> $A1 -> A1 (Excel's F4 order). */
function nextAnchoring(colAbs: boolean, rowAbs: boolean): [boolean, boolean] {
  if (!colAbs && !rowAbs) return [true, true];
  if (colAbs && rowAbs) return [false, true];
  if (!colAbs && rowAbs) return [true, false];
  return [false, false];
}

/**
 * Excel's F4 while editing a formula: cycle the reference at the caret (or
 * the nearest one before it) through A1 -> $A$1 -> A$1 -> $A1 -> A1. Both
 * ends of a range (`A1:B2`) move together, taking the state of the first.
 * Returns null when there is no reference at or before the caret.
 */
export function cycleReferenceAtCaret(text: string, caret: number): ICycledReference | null {
  const refs = findReferences(text);
  if (refs.length === 0) return null;
  // Pair range ends: "A1:B2" is one reference for F4.
  const groups: RefToken[][] = [];
  for (let i = 0; i < refs.length; i++) {
    const a = refs[i] as RefToken;
    const b = refs[i + 1];
    if (b && text[a.end] === ':' && b.start === a.end + 1) {
      groups.push([a, b]);
      i++;
    } else {
      groups.push([a]);
    }
  }
  const startOf = (g: RefToken[]) => (g[0] as RefToken).start;
  const endOf = (g: RefToken[]) => (g[g.length - 1] as RefToken).end;
  let target = groups.find((g) => startOf(g) <= caret && caret <= endOf(g));
  if (!target) {
    for (const g of groups) if (endOf(g) <= caret) target = g;
  }
  if (!target) return null;
  const first = target[0] as RefToken;
  const [colAbs, rowAbs] = nextAnchoring(first.colAbs, first.rowAbs);
  const replaced = target
    .map((r) => `${colAbs ? '$' : ''}${r.col}${rowAbs ? '$' : ''}${r.row}`)
    .join(':');
  const start = startOf(target);
  const next = text.slice(0, start) + replaced + text.slice(endOf(target));
  return { text: next, start, end: start + replaced.length };
}
