import type { Token, TokenType } from './types';
import { FormulaError } from './types';

const CELL_REF_PATTERN = /^\$?[A-Za-z]+\$?\d+$/;

/** True when c is a digit '0'-'9'. Undefined (out-of-range index) is false. */
function isDigit(c: string | undefined): c is string {
  return c !== undefined && c >= '0' && c <= '9';
}

/** True when c is an ASCII letter. Undefined (out-of-range index) is false. */
function isLetter(c: string | undefined): c is string {
  return c !== undefined && ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z'));
}

/** True when c is a letter, digit, '$' or '_'. Undefined (out-of-range index) is false. */
function isIdentChar(c: string | undefined): c is string {
  return isLetter(c) || isDigit(c) || c === '$' || c === '_';
}

/** True when c is a letter, digit or '_'. Undefined (out-of-range index) is false. */
function isWordChar(c: string | undefined): c is string {
  return isLetter(c) || isDigit(c) || c === '_';
}

const SINGLE_CHAR_OPERATORS: Record<string, TokenType> = {
  '+': 'PLUS',
  '-': 'MINUS',
  '*': 'MULTIPLY',
  '/': 'DIVIDE',
  '^': 'POWER',
  '%': 'PERCENT',
  '&': 'AMPERSAND',
  '=': 'EQ',
};

const DELIMITERS: Record<string, TokenType> = {
  '(': 'LPAREN',
  ')': 'RPAREN',
  ',': 'COMMA',
  ':': 'COLON',
};

/**
 * Tokenizes a formula string (without the leading '=') into an array of tokens.
 *
 * This is a single-pass character-at-a-time lexer for spreadsheet formulas.
 */
export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;

  while (pos < input.length) {
    const ch = input[pos];
    if (ch === undefined) break; // unreachable: pos < input.length guarantees a character

    // 1. Whitespace  -  skip
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
      pos++;
      continue;
    }

    // 2. Numbers  -  \d+(\.\d+)? including leading '.' (like .5)
    if (isDigit(ch) || (ch === '.' && isDigit(input[pos + 1]))) {
      const start = pos;
      while (isDigit(input[pos])) {
        pos++;
      }
      if (pos < input.length && input[pos] === '.') {
        pos++;
        while (isDigit(input[pos])) {
          pos++;
        }
      }
      tokens.push({ type: 'NUMBER', value: input.slice(start, pos), position: start });
      continue;
    }

    // 3. Quoted sheet reference  -  'Sheet Name'!
    if (ch === "'") {
      const start = pos;
      pos++; // skip opening quote
      const nameStart = pos;
      while (pos < input.length && input[pos] !== "'") {
        pos++;
      }
      const sheetName = input.slice(nameStart, pos);
      if (pos < input.length && input[pos] === "'") {
        pos++; // skip closing quote
        if (pos < input.length && input[pos] === '!') {
          pos++; // skip '!'
          tokens.push({ type: 'SHEET_REF', value: sheetName, position: start });
          continue;
        }
      }
      // Invalid quoted sheet ref  -  error
      throw new FormulaError('#ERROR!', `Invalid sheet reference at position ${start}`);
    }

    // 4. Strings  -  "..." with "" for escaped quotes (Excel convention)
    if (ch === '"') {
      const start = pos;
      pos++; // skip opening quote
      // Fast path: scan for closing quote without escaped quotes
      const scanStart = pos;
      let hasEscapes = false;
      while (pos < input.length) {
        if (input[pos] === '"') {
          if (pos + 1 < input.length && input[pos + 1] === '"') {
            hasEscapes = true;
            pos += 2;
          } else {
            break;
          }
        } else {
          pos++;
        }
      }
      let value: string;
      if (!hasEscapes) {
        // No escaped quotes  -  single slice
        value = input.slice(scanStart, pos);
      } else {
        // Has escaped quotes  -  replace "" with "
        value = input.slice(scanStart, pos).replace(/""/g, '"');
      }
      if (pos < input.length) pos++; // skip closing quote
      tokens.push({ type: 'STRING', value, position: start });
      continue;
    }

    // 4. Multi-char operators  -  >=, <=, <>
    if (ch === '>' && pos + 1 < input.length && input[pos + 1] === '=') {
      tokens.push({ type: 'GTE', value: '>=', position: pos });
      pos += 2;
      continue;
    }
    if (ch === '<' && pos + 1 < input.length && input[pos + 1] === '=') {
      tokens.push({ type: 'LTE', value: '<=', position: pos });
      pos += 2;
      continue;
    }
    if (ch === '<' && pos + 1 < input.length && input[pos + 1] === '>') {
      tokens.push({ type: 'NEQ', value: '<>', position: pos });
      pos += 2;
      continue;
    }

    // 5. Single-char operators (except > and < which need special handling)
    if (ch === '>' || ch === '<') {
      const type: TokenType = ch === '>' ? 'GT' : 'LT';
      tokens.push({ type, value: ch, position: pos });
      pos++;
      continue;
    }

    const operatorType = SINGLE_CHAR_OPERATORS[ch];
    if (operatorType) {
      tokens.push({ type: operatorType, value: ch, position: pos });
      pos++;
      continue;
    }

    // 6. Delimiters  -  (, ), ,, :
    const delimiterType = DELIMITERS[ch];
    if (delimiterType) {
      tokens.push({ type: delimiterType, value: ch, position: pos });
      pos++;
      continue;
    }

    // 7. Cell references / identifiers  -  start with $ or letter
    if (ch === '$' || isLetter(ch)) {
      const start = pos;
      // Consume identifier: letters, digits, $, _
      while (isIdentChar(input[pos])) {
        pos++;
      }
      // Allow a single dot in function names (e.g. STDEV.S, PERCENTILE.INC)
      // Only consume the dot if it is followed by more letters (not a decimal number)
      if (pos < input.length && input[pos] === '.' && isLetter(input[pos + 1])) {
        pos++; // consume '.'
        while (isWordChar(input[pos])) {
          pos++;
        }
      }
      const word = input.slice(start, pos);

      // If immediately followed by '!'  to  SHEET_REF token (unquoted sheet name)
      if (pos < input.length && input[pos] === '!') {
        pos++; // skip '!'
        tokens.push({ type: 'SHEET_REF', value: word, position: start });
        continue;
      }

      // If immediately followed by '('  to  FUNCTION token
      if (pos < input.length && input[pos] === '(') {
        tokens.push({ type: 'FUNCTION', value: word, position: start });
        continue;
      }

      // If TRUE or FALSE (case-insensitive)  to  BOOLEAN token
      const upper = word.toUpperCase();
      if (upper === 'TRUE' || upper === 'FALSE') {
        tokens.push({ type: 'BOOLEAN', value: upper, position: start });
        continue;
      }

      // If matches cell ref pattern  to  CELL_REF token
      if (CELL_REF_PATTERN.test(word)) {
        tokens.push({ type: 'CELL_REF', value: word, position: start });
        continue;
      }

      // Otherwise  to  IDENTIFIER token (may be a named range)
      tokens.push({ type: 'IDENTIFIER', value: word, position: start });
      continue;
    }

    // Unrecognized character
    throw new FormulaError('#ERROR!', `Unexpected character: ${ch}`);
  }

  // Append EOF token
  tokens.push({ type: 'EOF', value: '', position: pos });

  return tokens;
}
