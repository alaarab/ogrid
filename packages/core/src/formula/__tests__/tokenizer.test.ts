import { tokenize } from '../tokenizer';
import { FormulaError } from '../types';
import type { Token, TokenType } from '../types';

/** Helper: extract just (type, value) pairs, excluding EOF */
function tokenPairs(input: string): Array<[TokenType, string]> {
  return tokenize(input)
    .filter((t) => t.type !== 'EOF')
    .map((t) => [t.type, t.value]);
}

/** Helper: extract just types, excluding EOF */
function tokenTypes(input: string): TokenType[] {
  return tokenize(input)
    .filter((t) => t.type !== 'EOF')
    .map((t) => t.type);
}

describe('tokenizer', () => {
  // ── Numbers ──────────────────────────────────────────────────────────

  describe('numbers', () => {
    it('tokenizes an integer', () => {
      expect(tokenPairs('42')).toEqual([['NUMBER', '42']]);
    });

    it('tokenizes a decimal number', () => {
      expect(tokenPairs('3.14')).toEqual([['NUMBER', '3.14']]);
    });

    it('tokenizes a leading-dot decimal (.5)', () => {
      expect(tokenPairs('.5')).toEqual([['NUMBER', '.5']]);
    });

    it('tokenizes zero', () => {
      expect(tokenPairs('0')).toEqual([['NUMBER', '0']]);
    });

    it('tokenizes a large integer', () => {
      expect(tokenPairs('9999999')).toEqual([['NUMBER', '9999999']]);
    });

    it('tokenizes a number with trailing digits after decimal', () => {
      expect(tokenPairs('100.00')).toEqual([['NUMBER', '100.00']]);
    });
  });

  // ── Strings ──────────────────────────────────────────────────────────

  describe('strings', () => {
    it('tokenizes a simple string', () => {
      const tokens = tokenize('"hello"');
      expect(tokens[0].type).toBe('STRING');
      expect(tokens[0].value).toBe('hello');
    });

    it('tokenizes an empty string', () => {
      const tokens = tokenize('""');
      expect(tokens[0].type).toBe('STRING');
      expect(tokens[0].value).toBe('');
    });

    it('tokenizes a string with escaped quotes (Excel convention)', () => {
      const tokens = tokenize('"say ""hello"" world"');
      expect(tokens[0].type).toBe('STRING');
      expect(tokens[0].value).toBe('say "hello" world');
    });

    it('tokenizes a string with spaces', () => {
      const tokens = tokenize('"foo bar baz"');
      expect(tokens[0].type).toBe('STRING');
      expect(tokens[0].value).toBe('foo bar baz');
    });

    it('tokenizes a string containing digits', () => {
      const tokens = tokenize('"abc123"');
      expect(tokens[0].type).toBe('STRING');
      expect(tokens[0].value).toBe('abc123');
    });
  });

  // ── Cell references ──────────────────────────────────────────────────

  describe('cell references', () => {
    it('tokenizes a simple cell reference (A1)', () => {
      expect(tokenPairs('A1')).toEqual([['CELL_REF', 'A1']]);
    });

    it('tokenizes an absolute cell reference ($A$1)', () => {
      expect(tokenPairs('$A$1')).toEqual([['CELL_REF', '$A$1']]);
    });

    it('tokenizes a mixed reference with absolute column ($A1)', () => {
      expect(tokenPairs('$A1')).toEqual([['CELL_REF', '$A1']]);
    });

    it('tokenizes a mixed reference with absolute row (A$1)', () => {
      expect(tokenPairs('A$1')).toEqual([['CELL_REF', 'A$1']]);
    });

    it('tokenizes a double-letter column reference (AA100)', () => {
      expect(tokenPairs('AA100')).toEqual([['CELL_REF', 'AA100']]);
    });

    it('tokenizes a single-letter high-column reference (Z26)', () => {
      expect(tokenPairs('Z26')).toEqual([['CELL_REF', 'Z26']]);
    });

    it('tokenizes lowercase cell references', () => {
      expect(tokenPairs('a1')).toEqual([['CELL_REF', 'a1']]);
    });
  });

  // ── Operators ────────────────────────────────────────────────────────

  describe('operators', () => {
    it('tokenizes arithmetic operators (+, -, *, /, ^)', () => {
      expect(tokenTypes('1+2-3*4/5^6')).toEqual([
        'NUMBER', 'PLUS', 'NUMBER', 'MINUS', 'NUMBER',
        'MULTIPLY', 'NUMBER', 'DIVIDE', 'NUMBER', 'POWER', 'NUMBER',
      ]);
    });

    it('tokenizes percent operator (%)', () => {
      expect(tokenPairs('50%')).toEqual([['NUMBER', '50'], ['PERCENT', '%']]);
    });

    it('tokenizes ampersand operator (&)', () => {
      expect(tokenPairs('"a"&"b"')).toEqual([
        ['STRING', 'a'], ['AMPERSAND', '&'], ['STRING', 'b'],
      ]);
    });

    it('tokenizes equals operator (=)', () => {
      expect(tokenPairs('A1=1')).toEqual([
        ['CELL_REF', 'A1'], ['EQ', '='], ['NUMBER', '1'],
      ]);
    });

    it('tokenizes less-than operator (<)', () => {
      expect(tokenPairs('A1<10')).toEqual([
        ['CELL_REF', 'A1'], ['LT', '<'], ['NUMBER', '10'],
      ]);
    });

    it('tokenizes greater-than operator (>)', () => {
      expect(tokenPairs('A1>10')).toEqual([
        ['CELL_REF', 'A1'], ['GT', '>'], ['NUMBER', '10'],
      ]);
    });

    it('tokenizes less-than-or-equal operator (<=)', () => {
      expect(tokenPairs('A1<=10')).toEqual([
        ['CELL_REF', 'A1'], ['LTE', '<='], ['NUMBER', '10'],
      ]);
    });

    it('tokenizes greater-than-or-equal operator (>=)', () => {
      expect(tokenPairs('A1>=10')).toEqual([
        ['CELL_REF', 'A1'], ['GTE', '>='], ['NUMBER', '10'],
      ]);
    });

    it('tokenizes not-equal operator (<>)', () => {
      expect(tokenPairs('A1<>10')).toEqual([
        ['CELL_REF', 'A1'], ['NEQ', '<>'], ['NUMBER', '10'],
      ]);
    });
  });

  // ── Delimiters ───────────────────────────────────────────────────────

  describe('delimiters', () => {
    it('tokenizes parentheses', () => {
      expect(tokenPairs('(1)')).toEqual([
        ['LPAREN', '('], ['NUMBER', '1'], ['RPAREN', ')'],
      ]);
    });

    it('tokenizes comma', () => {
      expect(tokenPairs('1,2')).toEqual([
        ['NUMBER', '1'], ['COMMA', ','], ['NUMBER', '2'],
      ]);
    });

    it('tokenizes colon', () => {
      expect(tokenPairs('A1:B10')).toEqual([
        ['CELL_REF', 'A1'], ['COLON', ':'], ['CELL_REF', 'B10'],
      ]);
    });
  });

  // ── Functions ────────────────────────────────────────────────────────

  describe('functions', () => {
    it('tokenizes SUM( as a FUNCTION token', () => {
      const tokens = tokenize('SUM(A1)');
      expect(tokens[0].type).toBe('FUNCTION');
      expect(tokens[0].value).toBe('SUM');
    });

    it('tokenizes IF( as a FUNCTION token', () => {
      const tokens = tokenize('IF(A1>0,1,0)');
      expect(tokens[0].type).toBe('FUNCTION');
      expect(tokens[0].value).toBe('IF');
    });

    it('tokenizes VLOOKUP( as a FUNCTION token', () => {
      const tokens = tokenize('VLOOKUP(A1,B1:C10,2,0)');
      expect(tokens[0].type).toBe('FUNCTION');
      expect(tokens[0].value).toBe('VLOOKUP');
    });

    it('does not consume the opening paren as part of the FUNCTION token', () => {
      const tokens = tokenize('SUM(1)');
      expect(tokens[0]).toEqual(
        expect.objectContaining({ type: 'FUNCTION', value: 'SUM' })
      );
      expect(tokens[1]).toEqual(
        expect.objectContaining({ type: 'LPAREN', value: '(' })
      );
    });
  });

  // ── Booleans ─────────────────────────────────────────────────────────

  describe('booleans', () => {
    it('tokenizes TRUE (uppercase)', () => {
      expect(tokenPairs('TRUE')).toEqual([['BOOLEAN', 'TRUE']]);
    });

    it('tokenizes FALSE (uppercase)', () => {
      expect(tokenPairs('FALSE')).toEqual([['BOOLEAN', 'FALSE']]);
    });

    it('tokenizes true (lowercase) as BOOLEAN', () => {
      expect(tokenPairs('true')).toEqual([['BOOLEAN', 'TRUE']]);
    });

    it('tokenizes false (lowercase) as BOOLEAN', () => {
      expect(tokenPairs('false')).toEqual([['BOOLEAN', 'FALSE']]);
    });

    it('tokenizes mixed case (True, False) as BOOLEAN', () => {
      // "True" and "False" match the cell ref pattern (/^\$?[A-Za-z]+\$?\d+$/) only if they contain digits.
      // "True" has no digits, so it goes to toUpperCase() check  to  BOOLEAN.
      expect(tokenPairs('True')).toEqual([['BOOLEAN', 'TRUE']]);
      expect(tokenPairs('False')).toEqual([['BOOLEAN', 'FALSE']]);
    });
  });

  // ── Whitespace ───────────────────────────────────────────────────────

  describe('whitespace handling', () => {
    it('skips spaces between tokens', () => {
      expect(tokenPairs('1 + 2')).toEqual([
        ['NUMBER', '1'], ['PLUS', '+'], ['NUMBER', '2'],
      ]);
    });

    it('skips tabs', () => {
      expect(tokenPairs('1\t+\t2')).toEqual([
        ['NUMBER', '1'], ['PLUS', '+'], ['NUMBER', '2'],
      ]);
    });

    it('skips newlines and carriage returns', () => {
      expect(tokenPairs('1\n+\r\n2')).toEqual([
        ['NUMBER', '1'], ['PLUS', '+'], ['NUMBER', '2'],
      ]);
    });

    it('handles leading and trailing whitespace', () => {
      expect(tokenPairs('  42  ')).toEqual([['NUMBER', '42']]);
    });
  });

  // ── EOF token ────────────────────────────────────────────────────────

  describe('EOF token', () => {
    it('always appends an EOF token at the end', () => {
      const tokens = tokenize('1+2');
      const last = tokens[tokens.length - 1];
      expect(last.type).toBe('EOF');
      expect(last.value).toBe('');
    });

    it('produces only EOF for an empty string', () => {
      const tokens = tokenize('');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe('EOF');
    });

    it('produces only EOF for whitespace-only input', () => {
      const tokens = tokenize('   ');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe('EOF');
    });

    it('sets position to the end of input', () => {
      const tokens = tokenize('A1');
      const eof = tokens[tokens.length - 1];
      expect(eof.type).toBe('EOF');
      expect(eof.position).toBe(2);
    });
  });

  // ── Errors ───────────────────────────────────────────────────────────

  describe('errors', () => {
    it('emits IDENTIFIER token for unknown identifiers (named range support)', () => {
      const tokens = tokenize('foo');
      expect(tokens[0].type).toBe('IDENTIFIER');
      expect(tokens[0].value).toBe('foo');
    });

    it('throws FormulaError #ERROR! for unexpected characters', () => {
      expect(() => tokenize('~')).toThrow(FormulaError);
      try {
        tokenize('~');
      } catch (e) {
        expect(e).toBeInstanceOf(FormulaError);
        expect((e as FormulaError).type).toBe('#ERROR!');
      }
    });

    it('throws for @ character', () => {
      expect(() => tokenize('@')).toThrow(FormulaError);
    });

    it('throws for # character', () => {
      expect(() => tokenize('#')).toThrow(FormulaError);
    });
  });

  // ── Position tracking ────────────────────────────────────────────────

  describe('position tracking', () => {
    it('records correct positions for each token', () => {
      const tokens = tokenize('1+A1');
      expect(tokens[0].position).toBe(0); // '1' at 0
      expect(tokens[1].position).toBe(1); // '+' at 1
      expect(tokens[2].position).toBe(2); // 'A1' at 2
    });

    it('accounts for whitespace in positions', () => {
      const tokens = tokenize('1 + 2');
      expect(tokens[0].position).toBe(0); // '1' at 0
      expect(tokens[1].position).toBe(2); // '+' at 2 (after space)
      expect(tokens[2].position).toBe(4); // '2' at 4
    });

    it('tracks positions for multi-char operators', () => {
      const tokens = tokenize('A1>=B1');
      expect(tokens[1].position).toBe(2); // '>=' at 2
      expect(tokens[1].type).toBe('GTE');
    });
  });

  // ── Complex expressions ──────────────────────────────────────────────

  describe('complex expressions', () => {
    it('tokenizes SUM(A1:A10)+IF(B1>0,B1,0)', () => {
      const types = tokenTypes('SUM(A1:A10)+IF(B1>0,B1,0)');
      expect(types).toEqual([
        'FUNCTION', 'LPAREN', 'CELL_REF', 'COLON', 'CELL_REF', 'RPAREN',
        'PLUS',
        'FUNCTION', 'LPAREN', 'CELL_REF', 'GT', 'NUMBER', 'COMMA',
        'CELL_REF', 'COMMA', 'NUMBER', 'RPAREN',
      ]);
    });

    it('tokenizes nested function calls', () => {
      const types = tokenTypes('MAX(SUM(A1,A2),B1)');
      expect(types).toEqual([
        'FUNCTION', 'LPAREN',
        'FUNCTION', 'LPAREN', 'CELL_REF', 'COMMA', 'CELL_REF', 'RPAREN',
        'COMMA', 'CELL_REF', 'RPAREN',
      ]);
    });
  });
});
