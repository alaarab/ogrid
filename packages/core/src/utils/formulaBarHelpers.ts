/**
 * Formula bar helper utilities.
 *
 * Extracts cell/range references from a formula string for highlighting.
 * Uses the formula tokenizer to parse CELL_REF and range tokens.
 */

import { tokenize } from '../formula/tokenizer';
import { columnLetterToIndex } from '../formula/cellAddressUtils';

/** A parsed reference from a formula — either a single cell or a range. */
export interface FormulaReference {
  type: 'cell' | 'range';
  col: number;
  row: number;
  endCol?: number;
  endRow?: number;
  /** Color palette index (cycles through 0-5). */
  colorIndex: number;
}

/** Regex matching $?LETTERS$?DIGITS — same as the tokenizer's CELL_REF pattern. */
const CELL_REF_RE = /^\$?([A-Za-z]+)\$?(\d+)$/;

function parseCellRefCoords(ref: string): { col: number; row: number } | null {
  const m = ref.match(CELL_REF_RE);
  if (!m) return null;
  return { col: columnLetterToIndex(m[1]), row: parseInt(m[2], 10) - 1 };
}

/**
 * Extract all cell and range references from a formula string.
 * Each reference gets a cycling colorIndex for UI highlighting.
 *
 * @param formula - The formula string including the leading '='.
 * @returns Array of references found in the formula.
 */
/**
 * Handle Enter/Escape key events in the formula bar input.
 * Shared across React, Angular, Vue, and JS.
 */
export function handleFormulaBarKeyDown(
  key: string,
  preventDefault: () => void,
  onCommit: () => void,
  onCancel: () => void,
): void {
  if (key === 'Enter') {
    preventDefault();
    onCommit();
  } else if (key === 'Escape') {
    preventDefault();
    onCancel();
  }
}

/**
 * Process a formula bar commit: if the text starts with '=', set as formula;
 * otherwise clear any existing formula and commit as a plain value.
 */
export function processFormulaBarCommit(
  text: string,
  col: number,
  row: number,
  setFormula: (col: number, row: number, formula: string | null) => void,
  onCellValueChanged?: (col: number, row: number, value: unknown) => void,
): void {
  const trimmed = text.trim();
  if (trimmed.startsWith('=')) {
    setFormula(col, row, trimmed);
  } else {
    setFormula(col, row, null);
    onCellValueChanged?.(col, row, trimmed);
  }
}

/**
 * Derive the display text for a formula bar from the active cell.
 * Returns the formula string (with '=' prefix) if the cell has a formula,
 * otherwise the stringified raw value.
 */
export function deriveFormulaBarText(
  col: number | null,
  row: number | null,
  getFormula?: (col: number, row: number) => string | undefined,
  getRawValue?: (col: number, row: number) => unknown,
): string {
  if (col == null || row == null) return '';
  const formula = getFormula?.(col, row);
  if (formula) return '=' + formula;
  const raw = getRawValue?.(col, row);
  return raw != null ? String(raw) : '';
}

export function extractFormulaReferences(formula: string): FormulaReference[] {
  if (!formula || formula[0] !== '=') return [];
  const refs: FormulaReference[] = [];
  let colorIdx = 0;
  try {
    const tokens = tokenize(formula.substring(1));
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if (tok.type === 'CELL_REF') {
        // Check if next tokens form a range: CELL_REF COLON CELL_REF
        if (i + 2 < tokens.length && tokens[i + 1].type === 'COLON' && tokens[i + 2].type === 'CELL_REF') {
          const start = parseCellRefCoords(tok.value);
          const end = parseCellRefCoords(tokens[i + 2].value);
          if (start && end) {
            refs.push({
              type: 'range',
              col: start.col,
              row: start.row,
              endCol: end.col,
              endRow: end.row,
              colorIndex: colorIdx++ % 6,
            });
            i += 2; // skip COLON + end CELL_REF
            continue;
          }
        }
        // Single cell ref
        const coords = parseCellRefCoords(tok.value);
        if (coords) {
          refs.push({
            type: 'cell',
            col: coords.col,
            row: coords.row,
            colorIndex: colorIdx++ % 6,
          });
        }
      }
    }
  } catch {
    // Tokenizer may fail on partial formulas — return what we have
  }
  return refs;
}
