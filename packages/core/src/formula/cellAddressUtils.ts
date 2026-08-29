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
const CELL_REF_RE = /^(\$?)([A-Za-z]+)(\$?)(\d+)$/;

/** Splits a cell ref token ("A1", "$B$2") into its absolute markers and parts. */
const REF_PARTS_RE = /^(\$?)([A-Za-z]+)(\$?)(\d+)$/;

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
  if (rowNum < 1) return null;
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
    const sheetStr = addr.sheet.includes(' ') ? `'${addr.sheet}'` : addr.sheet;
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
 * @returns The adjusted formula string. Out-of-bounds references become "#REF!".
 */
export function adjustFormulaReferences(formula: string, colDelta: number, rowDelta: number): string {
  if (colDelta === 0 && rowDelta === 0) return formula;

  let tokens: Token[];
  try {
    tokens = tokenize(formula.startsWith('=') ? formula.slice(1) : formula);
  } catch {
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
    if (colIdx < 0 || rowNum < 1) {
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
  const colonIdx = key.indexOf(':');
  if (colonIdx >= 0 && Number.isNaN(parseInt(key.substring(0, colonIdx), 10))) {
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
