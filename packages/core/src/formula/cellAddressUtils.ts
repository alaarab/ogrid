/**
 * Cell address parsing and formatting utilities for the formula system.
 * Extends the existing cellReference.ts with reverse parsing and absolute reference support.
 */

import { indexToColumnLetter, columnLetterToIndex } from '../utils/cellReference';
import { tokenize } from './tokenizer';
import type { ICellAddress, ICellRange, CellKey, Token } from './types';

// Re-export columnLetterToIndex so existing formula/index.ts barrel keeps working
export { columnLetterToIndex };

/** Regex for a cell reference: optional $ before letters, optional $ before digits. */
const CELL_REF_RE = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)$/;

/** Splits a cell ref token ("A1", "$B$2") into its absolute markers and parts. */
const REF_PARTS_RE = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)$/;

/**
 * Parse a cell reference string like "A1", "$B$2", "$A1", "A$1".
 * Returns null on invalid input.
 */
export function parseCellRef(ref: string): ICellAddress | null {
  const m = ref.match(CELL_REF_RE);
  if (!m) return null;
  const absCol = m[1] === '$';
  const colLetters = m[2];
  const absRow = m[3] === '$';
  const rowDigits = m[4];
  if (colLetters === undefined || rowDigits === undefined) return null;
  const rowNum = parseInt(rowDigits, 10);
  if (rowNum < 1 || rowNum > 1048576 || columnLetterToIndex(colLetters) >= 16384) return null;
  return {
    col: columnLetterToIndex(colLetters),
    row: rowNum - 1, // 0-based internally
    absCol,
    absRow,
  };
}

/**
 * Parse a range string like "A1:B10".
 * Returns null on invalid input.
 */
export function parseRange(rangeStr: string): ICellRange | null {
  const parts = rangeStr.split(':');
  const startStr = parts[0];
  const endStr = parts[1];
  if (parts.length !== 2 || startStr === undefined || endStr === undefined) return null;
  const start = parseCellRef(startStr);
  const end = parseCellRef(endStr);
  if (!start || !end) return null;
  return { start, end };
}

/**
 * Convert a cell address back to a display string like "A1", "$A$1", or "Sheet2!A1".
 */
export function formatAddress(addr: ICellAddress): string {
  const colStr = (addr.absCol ? '$' : '') + indexToColumnLetter(addr.col);
  const rowStr = (addr.absRow ? '$' : '') + (addr.row + 1);
  const cellStr = colStr + rowStr;
  if (addr.sheet) {
    // Quote sheet name if it contains spaces
    const sheetStr = /^[A-Za-z_][A-Za-z0-9_]*$/.test(addr.sheet) ? addr.sheet : `'${addr.sheet.replace(/'/g, "''")}'`;
    return `${sheetStr}!${cellStr}`;
  }
  return cellStr;
}

/**
 * Adjusts relative cell references in a formula string by a row/column delta.
 * Absolute references ($A$1) are not adjusted. Mixed refs ($A1, A$1) adjust only the relative part.
 *
 * Driven by the tokenizer rather than a raw regex, so function names that end in
 * digits (LOG10), text inside string literals ("Total A1") and named ranges
 * (Revenue2) are never mistaken for cell references.
 *
 * @param formula   The formula string (e.g. "=A1+B1")
 * @param colDelta  Column offset to apply to relative column references
 * @param rowDelta  Row offset to apply to relative row references
 * @param strict    Throw when tokenization fails, for callers that must reject an unsafe translation.
 * @returns The adjusted formula string. Out-of-bounds references become "#REF!".
 */
export function adjustFormulaReferences(formula: string, colDelta: number, rowDelta: number, strict = false): string {
  if (colDelta === 0 && rowDelta === 0) return formula;

  let tokens: Token[];
  try {
    tokens = tokenize(formula.startsWith('=') ? formula.slice(1) : formula);
  } catch (error) {
    if (strict) throw error;
    // Malformed formula  -  leave it untouched rather than corrupt it.
    return formula;
  }

  // The tokenizer runs on the '='-stripped expression, so token positions are
  // shifted by that many characters relative to the original string.
  const offset = formula.startsWith('=') ? 1 : 0;

  // Splice back-to-front so earlier positions stay valid as we rewrite.
  let result = formula;
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i];
    if (token === undefined || token.type !== 'CELL_REF') continue;

    const parts = REF_PARTS_RE.exec(token.value);
    if (parts === null) continue;
    const [, colAbs = '', colLetters = '', rowAbs = '', rowDigits = ''] = parts;

    let replacement: string;
    const colIdx = columnLetterToIndex(colLetters) + (colAbs === '$' ? 0 : colDelta);
    const rowNum = parseInt(rowDigits, 10) + (rowAbs === '$' ? 0 : rowDelta);
    if (colIdx < 0 || colIdx >= 16384 || rowNum < 1 || rowNum > 1048576) {
      // Rows are 1-based in formulas; either axis going out of bounds is #REF!.
      replacement = '#REF!';
    } else {
      replacement = `${colAbs}${indexToColumnLetter(colIdx)}${rowAbs}${rowNum}`;
    }

    const start = token.position + offset;
    result = result.slice(0, start) + replacement + result.slice(start + token.value.length);
  }

  return result;
}

/**
 * Convert (col, row) to a CellKey for Map storage.
 * When sheet is specified: "sheetName:col,row". Otherwise: "col,row".
 */
export function toCellKey(col: number, row: number, sheet?: string): CellKey {
  if (sheet) return `${sheet}:${col},${row}`;
  return `${col},${row}`;
}

/**
 * Parse a CellKey back to (col, row) and optional sheet.
 */
export function fromCellKey(key: CellKey): { col: number; row: number; sheet?: string } {
  // The "col,row" tail never contains ':', so the LAST colon splits off the
  // sheet  -  sheet names may themselves contain digits, ':' or ','.
  const colonIdx = key.lastIndexOf(':');
  if (colonIdx >= 0) {
    // Has sheet prefix: "sheetName:col,row"
    const sheet = key.substring(0, colonIdx);
    const rest = key.substring(colonIdx + 1);
    const commaIdx = rest.indexOf(',');
    return {
      col: parseInt(rest.substring(0, commaIdx), 10),
      row: parseInt(rest.substring(commaIdx + 1), 10),
      sheet,
    };
  }
  const i = key.indexOf(',');
  return {
    col: parseInt(key.substring(0, i), 10),
    row: parseInt(key.substring(i + 1), 10),
  };
}

/** Row or column axis of a structural change (insert/delete rows or columns). */
export type StructureAxis = 'row' | 'col';

const MAX_SHEET_ROWS = 1048576;
const MAX_SHEET_COLS = 16384;

interface RefParts {
  colAbs: string;
  col: number;
  rowAbs: string;
  row: number;
}

function splitRef(value: string): RefParts | null {
  const parts = REF_PARTS_RE.exec(value);
  if (parts === null) return null;
  const [, colAbs = '', colLetters = '', rowAbs = '', rowDigits = ''] = parts;
  return { colAbs, col: columnLetterToIndex(colLetters), rowAbs, row: parseInt(rowDigits, 10) - 1 };
}

function formatRef(ref: RefParts): string | null {
  if (ref.col < 0 || ref.col >= MAX_SHEET_COLS || ref.row < 0 || ref.row >= MAX_SHEET_ROWS) return null;
  return `${ref.colAbs}${indexToColumnLetter(ref.col)}${ref.rowAbs}${ref.row + 1}`;
}

/**
 * New position of a coordinate after `count` rows/columns are inserted
 * (count > 0) or deleted (count < 0) at `at`. Null for a deleted coordinate.
 */
function shiftCoord(coord: number, at: number, count: number): number | null {
  if (count > 0) return coord >= at ? coord + count : coord;
  const lastDeleted = at - count - 1;
  if (coord < at) return coord;
  if (coord <= lastDeleted) return null;
  return coord + count;
}

/** New [low, high] span of a range after the change, or null when all of it is deleted. */
function shiftSpan(low: number, high: number, at: number, count: number): [number, number] | null {
  if (count > 0) return [low >= at ? low + count : low, high >= at ? high + count : high];
  const lastDeleted = at - count - 1;
  const newLow = low < at ? low : low > lastDeleted ? low + count : at;
  const newHigh = high < at ? high : high > lastDeleted ? high + count : at - 1;
  return newHigh < newLow ? null : [newLow, newHigh];
}

/**
 * Rewrites the cell references in a formula for rows or columns inserted or
 * deleted at `at` (0-based), the way a spreadsheet does: references at or past
 * the change move with their cells, relative and absolute alike. A reference
 * to a deleted cell becomes `#REF!`; a range loses its deleted part and becomes
 * `#REF!` only when all of it is deleted.
 *
 * References qualified with a sheet name (`Sheet2!A1`) point at other sheets
 * and are left alone, as are named ranges.
 *
 * @param formula The formula string (with or without the leading '=').
 * @param axis    'row' for row inserts/deletes, 'col' for columns.
 * @param at      First inserted/deleted row or column (0-based).
 * @param count   Positive to insert that many, negative to delete that many.
 */
export function shiftFormulaReferences(formula: string, axis: StructureAxis, at: number, count: number): string {
  if (count === 0) return formula;
  let tokens: Token[];
  try {
    tokens = tokenize(formula.startsWith('=') ? formula.slice(1) : formula);
  } catch {
    // Malformed formula  -  leave it untouched rather than corrupt it.
    return formula;
  }
  const offset = formula.startsWith('=') ? 1 : 0;
  const key = axis === 'row' ? 'row' : 'col';

  const edits: Array<{ start: number; end: number; text: string }> = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === undefined || token.type !== 'CELL_REF') continue;
    const qualified = tokens[i - 1]?.type === 'SHEET_REF';
    const endToken = tokens[i + 1]?.type === 'COLON' && tokens[i + 2]?.type === 'CELL_REF' ? tokens[i + 2] : undefined;
    const lastToken = endToken ?? token;
    if (endToken) i += 2;
    if (qualified) continue;

    const start = splitRef(token.value);
    const end = endToken ? splitRef(endToken.value) : null;
    if (!start || (endToken && !end)) continue;

    let text: string | null = null;
    if (!end) {
      const moved = shiftCoord(start[key], at, count);
      if (moved !== null) text = formatRef({ ...start, [key]: moved });
    } else {
      const lowIsStart = start[key] <= end[key];
      const low = lowIsStart ? start : end;
      const high = lowIsStart ? end : start;
      const span = shiftSpan(low[key], high[key], at, count);
      if (span) {
        const a = formatRef({ ...low, [key]: span[0] });
        const b = formatRef({ ...high, [key]: span[1] });
        if (a && b) text = lowIsStart ? `${a}:${b}` : `${b}:${a}`;
      }
    }
    const from = token.position + offset;
    const to = lastToken.position + offset + lastToken.value.length;
    const replacement = text ?? '#REF!';
    if (replacement !== formula.slice(from, to)) edits.push({ start: from, end: to, text: replacement });
  }

  // Splice back-to-front so earlier positions stay valid.
  let result = formula;
  for (let i = edits.length - 1; i >= 0; i--) {
    const edit = edits[i];
    if (edit !== undefined) result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
  }
  return result;
}

/**
 * Moves formula cells for rows or columns inserted or deleted at `at`: cells
 * past the change move with it, cells in deleted rows/columns are dropped, and
 * every formula's references are rewritten with `shiftFormulaReferences`.
 */
export function shiftFormulaCells(
  formulas: ReadonlyArray<{ col: number; row: number; formula: string }>,
  axis: StructureAxis,
  at: number,
  count: number,
): Array<{ col: number; row: number; formula: string }> {
  const result: Array<{ col: number; row: number; formula: string }> = [];
  for (const f of formulas) {
    const moved = shiftCoord(axis === 'row' ? f.row : f.col, at, count);
    if (moved === null) continue;
    result.push({
      col: axis === 'col' ? moved : f.col,
      row: axis === 'row' ? moved : f.row,
      formula: shiftFormulaReferences(f.formula, axis, at, count),
    });
  }
  return result;
}
