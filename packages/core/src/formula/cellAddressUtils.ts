/**
 * Cell address parsing and formatting utilities for the formula system.
 * Extends the existing cellReference.ts with reverse parsing and absolute reference support.
 */

import { indexToColumnLetter, columnLetterToIndex } from '../utils/cellReference';
import type { ICellAddress, ICellRange, CellKey } from './types';

// Re-export columnLetterToIndex so existing formula/index.ts barrel keeps working
export { columnLetterToIndex };

/** Regex for a cell reference: optional $ before letters, optional $ before digits. */
const CELL_REF_RE = /^(\$?)([A-Za-z]+)(\$?)(\d+)$/;

/** Pre-compiled regex for adjustFormulaReferences (hoisted to avoid recompilation per call). */
const ADJUST_REF_RE = /(?:'[^']*'!|[A-Za-z_]\w*!)?(\$?)([A-Z]+)(\$?)(\d+)/g;

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
  const rowNum = parseInt(m[4], 10);
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
  if (parts.length !== 2) return null;
  const start = parseCellRef(parts[0]);
  const end = parseCellRef(parts[1]);
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
 * @param formula   The formula string (e.g. "=A1+B1")
 * @param colDelta  Column offset to apply to relative column references
 * @param rowDelta  Row offset to apply to relative row references
 * @returns The adjusted formula string. Out-of-bounds references become "#REF!".
 */
export function adjustFormulaReferences(formula: string, colDelta: number, rowDelta: number): string {
  // Reset lastIndex for the shared regex (it's global/stateful)
  ADJUST_REF_RE.lastIndex = 0;
  return formula.replace(ADJUST_REF_RE, (match, colAbs, colLetters, rowAbs, rowDigits) => {
    // Extract sheet prefix if present
    const cellRefStart = match.indexOf(colAbs + colLetters);
    const sheetPrefix = cellRefStart > 0 ? match.substring(0, cellRefStart) : '';
    let newCol = colLetters;
    let newRow = rowDigits;

    // Adjust column if not absolute
    if (colAbs !== '$') {
      const colIdx = columnLetterToIndex(colLetters) + colDelta;
      if (colIdx < 0) return '#REF!';
      newCol = indexToColumnLetter(colIdx);
    }

    // Adjust row if not absolute
    if (rowAbs !== '$') {
      const rowNum = parseInt(rowDigits, 10) + rowDelta;
      if (rowNum < 1) return '#REF!'; // rows are 1-based in formulas
      newRow = String(rowNum);
    }

    return `${sheetPrefix}${colAbs}${newCol}${rowAbs}${newRow}`;
  });
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
  if (colonIdx >= 0 && isNaN(parseInt(key.substring(0, colonIdx), 10))) {
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
