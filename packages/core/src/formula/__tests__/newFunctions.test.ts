/**
 * Tests for all new formula functions added in the expansion pass.
 * Covers: Math (17), Text (12), Logical (5), Lookup (2), Date (9), Info (6), Stats (3) = 54 new functions.
 */
import { FormulaEvaluator } from '../evaluator';
import { FormulaError } from '../types';
import type { ASTNode, IFormulaContext } from '../types';
import { createBuiltInFunctions } from '../functions';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockContext(cells: Record<string, unknown> = {}): IFormulaContext {
  return {
    getCellValue: (addr) => cells[`${addr.col},${addr.row}`] ?? null,
    getRangeValues: (range) => {
      const result: unknown[][] = [];
      const minRow = Math.min(range.start.row, range.end.row);
      const maxRow = Math.max(range.start.row, range.end.row);
      const minCol = Math.min(range.start.col, range.end.col);
      const maxCol = Math.max(range.start.col, range.end.col);
      for (let r = minRow; r <= maxRow; r++) {
        const row: unknown[] = [];
        for (let c = minCol; c <= maxCol; c++) {
          row.push(cells[`${c},${r}`] ?? null);
        }
        result.push(row);
      }
      return result;
    },
    now: () => new Date('2025-01-15T12:00:00Z'),
  };
}

const builtIns = createBuiltInFunctions();
const evaluator = new FormulaEvaluator(builtIns);

function addr(col: number, row: number) {
  return { col, row, absCol: false, absRow: false };
}

function num(n: number): ASTNode {
  return { kind: 'number', value: n };
}

function str(s: string): ASTNode {
  return { kind: 'string', value: s };
}

function bool(b: boolean): ASTNode {
  return { kind: 'boolean', value: b };
}

function cell(col: number, row: number): ASTNode {
  return { kind: 'cellRef', address: addr(col, row), raw: '' };
}

function range(c1: number, r1: number, c2: number, r2: number): ASTNode {
  return { kind: 'range', start: addr(c1, r1), end: addr(c2, r2), raw: '' };
}

function fn(name: string, ...args: ASTNode[]): ASTNode {
  return { kind: 'functionCall', name, args };
}

function evalFn(name: string, args: ASTNode[], cells: Record<string, unknown> = {}): unknown {
  const ctx = createMockContext(cells);
  return evaluator.evaluate(fn(name, ...args), ctx);
}

// ===========================================================================
// MATH FUNCTIONS
// ===========================================================================

describe('Math functions (new)', () => {
  describe('ROUNDUP', () => {
    it('rounds 2.1 up to 3', () => {
      expect(evalFn('ROUNDUP', [num(2.1), num(0)])).toBe(3);
    });
    it('rounds -2.1 up (away from zero) to -3', () => {
      expect(evalFn('ROUNDUP', [num(-2.1), num(0)])).toBe(-3);
    });
    it('rounds to 2 decimal places', () => {
      expect(evalFn('ROUNDUP', [num(3.14159), num(2)])).toBe(3.15);
    });
    it('rounds 3.1 to 0 places', () => {
      expect(evalFn('ROUNDUP', [num(3.1), num(0)])).toBe(4);
    });
  });

  describe('ROUNDDOWN', () => {
    it('rounds 2.9 down to 2', () => {
      expect(evalFn('ROUNDDOWN', [num(2.9), num(0)])).toBe(2);
    });
    it('rounds -2.9 down (toward zero) to -2', () => {
      expect(evalFn('ROUNDDOWN', [num(-2.9), num(0)])).toBe(-2);
    });
    it('rounds to 2 decimal places', () => {
      expect(evalFn('ROUNDDOWN', [num(3.14159), num(2)])).toBe(3.14);
    });
  });

  describe('INT', () => {
    it('truncates positive to floor', () => {
      expect(evalFn('INT', [num(8.9)])).toBe(8);
    });
    it('truncates negative to floor (toward -infinity)', () => {
      expect(evalFn('INT', [num(-8.1)])).toBe(-9);
    });
  });

  describe('TRUNC', () => {
    it('truncates to integer by default', () => {
      expect(evalFn('TRUNC', [num(8.9)])).toBe(8);
    });
    it('truncates negative toward zero', () => {
      expect(evalFn('TRUNC', [num(-8.9)])).toBe(-8);
    });
    it('truncates to 1 decimal place', () => {
      expect(evalFn('TRUNC', [num(8.95), num(1)])).toBeCloseTo(8.9, 10);
    });
  });

  describe('PRODUCT', () => {
    it('multiplies a range of numbers', () => {
      expect(evalFn('PRODUCT', [range(0, 0, 0, 2)], {
        '0,0': 2, '0,1': 3, '0,2': 4,
      })).toBe(24);
    });
    it('skips nulls', () => {
      expect(evalFn('PRODUCT', [range(0, 0, 0, 2)], {
        '0,0': 5, '0,1': null, '0,2': 3,
      })).toBe(15);
    });
  });

  describe('SUMPRODUCT', () => {
    it('multiplies corresponding elements and sums', () => {
      // [1,2,3] * [4,5,6] = 4+10+18 = 32
      expect(evalFn('SUMPRODUCT', [range(0, 0, 0, 2), range(1, 0, 1, 2)], {
        '0,0': 1, '0,1': 2, '0,2': 3,
        '1,0': 4, '1,1': 5, '1,2': 6,
      })).toBe(32);
    });
    it('returns #VALUE! for mismatched dimensions', () => {
      const result = evalFn('SUMPRODUCT', [range(0, 0, 0, 2), range(1, 0, 1, 1)], {
        '0,0': 1, '0,1': 2, '0,2': 3,
        '1,0': 4, '1,1': 5,
      });
      expect(result).toBeInstanceOf(FormulaError);
    });
  });

  describe('MEDIAN', () => {
    it('returns middle value for odd count', () => {
      expect(evalFn('MEDIAN', [range(0, 0, 0, 2)], {
        '0,0': 3, '0,1': 1, '0,2': 2,
      })).toBe(2);
    });
    it('returns average of two middle values for even count', () => {
      expect(evalFn('MEDIAN', [range(0, 0, 0, 3)], {
        '0,0': 1, '0,1': 2, '0,2': 3, '0,3': 4,
      })).toBe(2.5);
    });
  });

  describe('LARGE', () => {
    it('returns the 1st largest', () => {
      expect(evalFn('LARGE', [range(0, 0, 0, 3), num(1)], {
        '0,0': 10, '0,1': 30, '0,2': 20, '0,3': 40,
      })).toBe(40);
    });
    it('returns the 2nd largest', () => {
      expect(evalFn('LARGE', [range(0, 0, 0, 3), num(2)], {
        '0,0': 10, '0,1': 30, '0,2': 20, '0,3': 40,
      })).toBe(30);
    });
    it('returns #NUM! for k out of range', () => {
      const result = evalFn('LARGE', [range(0, 0, 0, 1), num(5)], {
        '0,0': 1, '0,1': 2,
      });
      expect(result).toBeInstanceOf(FormulaError);
    });
  });

  describe('SMALL', () => {
    it('returns the 1st smallest', () => {
      expect(evalFn('SMALL', [range(0, 0, 0, 3), num(1)], {
        '0,0': 10, '0,1': 30, '0,2': 20, '0,3': 40,
      })).toBe(10);
    });
    it('returns the 3rd smallest', () => {
      expect(evalFn('SMALL', [range(0, 0, 0, 3), num(3)], {
        '0,0': 10, '0,1': 30, '0,2': 20, '0,3': 40,
      })).toBe(30);
    });
  });

  describe('RANK', () => {
    it('ranks in descending order by default', () => {
      // Values: 10, 30, 20. Rank of 30 = 1 (largest)
      expect(evalFn('RANK', [num(30), range(0, 0, 0, 2)], {
        '0,0': 10, '0,1': 30, '0,2': 20,
      })).toBe(1);
    });
    it('ranks in ascending order', () => {
      // Values: 10, 30, 20. Rank of 10 ascending = 1 (smallest)
      expect(evalFn('RANK', [num(10), range(0, 0, 0, 2), num(1)], {
        '0,0': 10, '0,1': 30, '0,2': 20,
      })).toBe(1);
    });
    it('returns #N/A for value not in range', () => {
      const result = evalFn('RANK', [num(99), range(0, 0, 0, 1)], {
        '0,0': 1, '0,1': 2,
      });
      expect(result).toBeInstanceOf(FormulaError);
    });
  });

  describe('SIGN', () => {
    it('returns 1 for positive', () => expect(evalFn('SIGN', [num(5)])).toBe(1));
    it('returns -1 for negative', () => expect(evalFn('SIGN', [num(-3)])).toBe(-1));
    it('returns 0 for zero', () => expect(evalFn('SIGN', [num(0)])).toBe(0));
  });

  describe('LOG', () => {
    it('returns log base 10 by default', () => {
      expect(evalFn('LOG', [num(100)])).toBeCloseTo(2, 10);
    });
    it('returns log base 2', () => {
      expect(evalFn('LOG', [num(8), num(2)])).toBeCloseTo(3, 10);
    });
    it('returns #NUM! for negative', () => {
      expect(evalFn('LOG', [num(-1)])).toBeInstanceOf(FormulaError);
    });
  });

  describe('LN', () => {
    it('returns natural log', () => {
      expect(evalFn('LN', [num(Math.E)])).toBeCloseTo(1, 10);
    });
  });

  describe('EXP', () => {
    it('returns e^1', () => {
      expect(evalFn('EXP', [num(1)])).toBeCloseTo(Math.E, 10);
    });
    it('returns e^0 = 1', () => {
      expect(evalFn('EXP', [num(0)])).toBe(1);
    });
  });

  describe('PI', () => {
    it('returns Math.PI', () => {
      expect(evalFn('PI', [])).toBeCloseTo(Math.PI, 10);
    });
  });

  describe('RAND', () => {
    it('returns a number between 0 and 1', () => {
      const result = evalFn('RAND', []) as number;
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(1);
    });
  });

  describe('RANDBETWEEN', () => {
    it('returns an integer in [1, 10]', () => {
      const result = evalFn('RANDBETWEEN', [num(1), num(10)]) as number;
      expect(Number.isInteger(result)).toBe(true);
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(10);
    });
    it('returns #NUM! when bottom > top', () => {
      expect(evalFn('RANDBETWEEN', [num(10), num(1)])).toBeInstanceOf(FormulaError);
    });
  });
});

// ===========================================================================
// TEXT FUNCTIONS
// ===========================================================================

describe('Text functions (new)', () => {
  describe('FIND', () => {
    it('finds substring position (case-sensitive)', () => {
      expect(evalFn('FIND', [str('B'), str('ABC')])).toBe(2);
    });
    it('returns #VALUE! for not found', () => {
      expect(evalFn('FIND', [str('Z'), str('ABC')])).toBeInstanceOf(FormulaError);
    });
    it('starts from specified position', () => {
      expect(evalFn('FIND', [str('A'), str('ABCA'), num(2)])).toBe(4);
    });
    it('is case-sensitive', () => {
      expect(evalFn('FIND', [str('a'), str('ABC')])).toBeInstanceOf(FormulaError);
    });
  });

  describe('SEARCH', () => {
    it('finds substring position (case-insensitive)', () => {
      expect(evalFn('SEARCH', [str('b'), str('ABC')])).toBe(2);
    });
    it('returns #VALUE! for not found', () => {
      expect(evalFn('SEARCH', [str('Z'), str('ABC')])).toBeInstanceOf(FormulaError);
    });
  });

  describe('REPLACE', () => {
    it('replaces characters at position', () => {
      expect(evalFn('REPLACE', [str('abcdefg'), num(3), num(2), str('XY')])).toBe('abXYefg');
    });
    it('inserts when num_chars is 0', () => {
      expect(evalFn('REPLACE', [str('abc'), num(2), num(0), str('X')])).toBe('aXbc');
    });
  });

  describe('REPT', () => {
    it('repeats text N times', () => {
      expect(evalFn('REPT', [str('ab'), num(3)])).toBe('ababab');
    });
    it('returns empty string for 0 repeats', () => {
      expect(evalFn('REPT', [str('x'), num(0)])).toBe('');
    });
  });

  describe('EXACT', () => {
    it('returns true for matching strings', () => {
      expect(evalFn('EXACT', [str('hello'), str('hello')])).toBe(true);
    });
    it('returns false for different case', () => {
      expect(evalFn('EXACT', [str('Hello'), str('hello')])).toBe(false);
    });
  });

  describe('PROPER', () => {
    it('capitalizes first letter of each word', () => {
      expect(evalFn('PROPER', [str('hello world')])).toBe('Hello World');
    });
    it('lowercases rest of each word', () => {
      expect(evalFn('PROPER', [str('hELLO wORLD')])).toBe('Hello World');
    });
  });

  describe('CLEAN', () => {
    it('removes non-printable characters', () => {
      expect(evalFn('CLEAN', [str('A\x01B\x1FC')])).toBe('ABC');
    });
    it('leaves normal text unchanged', () => {
      expect(evalFn('CLEAN', [str('hello')])).toBe('hello');
    });
  });

  describe('CHAR', () => {
    it('returns character for code 65 (A)', () => {
      expect(evalFn('CHAR', [num(65)])).toBe('A');
    });
    it('returns character for code 97 (a)', () => {
      expect(evalFn('CHAR', [num(97)])).toBe('a');
    });
  });

  describe('CODE', () => {
    it('returns code for A (65)', () => {
      expect(evalFn('CODE', [str('A')])).toBe(65);
    });
    it('returns code for first character of multi-char string', () => {
      expect(evalFn('CODE', [str('abc')])).toBe(97);
    });
  });

  describe('TEXT', () => {
    it('formats number with 0.00', () => {
      expect(evalFn('TEXT', [num(3.1), str('0.00')])).toBe('3.10');
    });
    it('formats number with #,##0', () => {
      expect(evalFn('TEXT', [num(1234567), str('#,##0')])).toBe('1,234,567');
    });
    it('formats percentage with 0%', () => {
      expect(evalFn('TEXT', [num(0.75), str('0%')])).toBe('75%');
    });
    it('formats with 0.00%', () => {
      expect(evalFn('TEXT', [num(0.1234), str('0.00%')])).toBe('12.34%');
    });
    it('returns toString for unknown format', () => {
      expect(evalFn('TEXT', [num(42), str('???')])).toBe('42');
    });
  });

  describe('VALUE', () => {
    it('parses numeric string', () => {
      expect(evalFn('VALUE', [str('42')])).toBe(42);
    });
    it('parses string with dollar sign', () => {
      expect(evalFn('VALUE', [str('$1,234.56')])).toBe(1234.56);
    });
    it('parses percentage', () => {
      expect(evalFn('VALUE', [str('75%')])).toBe(0.75);
    });
    it('returns #VALUE! for non-numeric', () => {
      expect(evalFn('VALUE', [str('hello')])).toBeInstanceOf(FormulaError);
    });
  });

  describe('TEXTJOIN', () => {
    it('joins with delimiter', () => {
      expect(evalFn('TEXTJOIN', [str(', '), bool(false), str('A'), str('B'), str('C')])).toBe('A, B, C');
    });
    it('joins range values', () => {
      expect(evalFn('TEXTJOIN', [str('-'), bool(false), range(0, 0, 0, 2)], {
        '0,0': 'X', '0,1': 'Y', '0,2': 'Z',
      })).toBe('X-Y-Z');
    });
    it('ignores empty when told to', () => {
      expect(evalFn('TEXTJOIN', [str(','), bool(true), range(0, 0, 0, 2)], {
        '0,0': 'A', '0,1': '', '0,2': 'C',
      })).toBe('A,C');
    });
  });
});

// ===========================================================================
// LOGICAL FUNCTIONS
// ===========================================================================

describe('Logical functions (new)', () => {
  describe('IFNA', () => {
    it('returns value when not #N/A', () => {
      expect(evalFn('IFNA', [num(42), str('fallback')])).toBe(42);
    });
    it('returns fallback for #N/A error', () => {
      // Use VLOOKUP that will return #N/A
      const ctx = createMockContext({ '0,0': 'A' });
      const vlookup: ASTNode = fn('VLOOKUP', num(999), range(0, 0, 0, 0), num(1), bool(false));
      const result = evaluator.evaluate(fn('IFNA', vlookup, str('Not found')), ctx);
      expect(result).toBe('Not found');
    });
    it('does NOT catch #VALUE! error', () => {
      // IFERROR would catch this, IFNA should not
      const ctx = createMockContext({});
      const badLookup: ASTNode = fn('VLOOKUP', num(1), num(2), num(1)); // arg 1 is not a range → #VALUE!
      const result = evaluator.evaluate(fn('IFNA', badLookup, str('caught')), ctx);
      expect(result).toBeInstanceOf(FormulaError);
    });
  });

  describe('IFS', () => {
    it('returns first true branch', () => {
      expect(evalFn('IFS', [bool(false), str('no'), bool(true), str('yes')])).toBe('yes');
    });
    it('returns #N/A when no condition is true', () => {
      expect(evalFn('IFS', [bool(false), str('a'), bool(false), str('b')])).toBeInstanceOf(FormulaError);
    });
    it('returns #VALUE! for odd number of args', () => {
      expect(evalFn('IFS', [bool(true), str('a'), bool(false)])).toBeInstanceOf(FormulaError);
    });
  });

  describe('SWITCH', () => {
    it('matches a value and returns result', () => {
      expect(evalFn('SWITCH', [num(2), num(1), str('one'), num(2), str('two')])).toBe('two');
    });
    it('returns default when no match', () => {
      expect(evalFn('SWITCH', [num(3), num(1), str('one'), num(2), str('two'), str('other')])).toBe('other');
    });
    it('returns #N/A when no match and no default', () => {
      expect(evalFn('SWITCH', [num(3), num(1), str('one'), num(2), str('two')])).toBeInstanceOf(FormulaError);
    });
  });

  describe('CHOOSE', () => {
    it('selects by 1-based index', () => {
      expect(evalFn('CHOOSE', [num(2), str('a'), str('b'), str('c')])).toBe('b');
    });
    it('returns #VALUE! for out of range index', () => {
      expect(evalFn('CHOOSE', [num(5), str('a'), str('b')])).toBeInstanceOf(FormulaError);
    });
  });

  describe('XOR', () => {
    it('returns true for odd number of trues', () => {
      expect(evalFn('XOR', [bool(true), bool(false), bool(true), bool(true)])).toBe(true);
    });
    it('returns false for even number of trues', () => {
      expect(evalFn('XOR', [bool(true), bool(true)])).toBe(false);
    });
    it('returns false for all false', () => {
      expect(evalFn('XOR', [bool(false), bool(false)])).toBe(false);
    });
  });
});

// ===========================================================================
// LOOKUP FUNCTIONS
// ===========================================================================

describe('Lookup functions (new)', () => {
  const lookupCells = {
    // Row 0: A B C (header-like)
    '0,0': 'Alice',  '1,0': 85, '2,0': 'A',
    '0,1': 'Bob',    '1,1': 92, '2,1': 'A+',
    '0,2': 'Carol',  '1,2': 78, '2,2': 'B+',
  };

  describe('HLOOKUP', () => {
    const hCells = {
      // col 0  col 1  col 2  col 3
      '0,0': 1, '1,0': 2, '2,0': 3, '3,0': 4,  // row 0 = lookup row
      '0,1': 'a', '1,1': 'b', '2,1': 'c', '3,1': 'd',  // row 1
    };

    it('exact match in horizontal table', () => {
      expect(evalFn('HLOOKUP', [num(3), range(0, 0, 3, 1), num(2), bool(false)], hCells)).toBe('c');
    });
    it('returns #N/A for no match', () => {
      expect(evalFn('HLOOKUP', [num(99), range(0, 0, 3, 1), num(2), bool(false)], hCells)).toBeInstanceOf(FormulaError);
    });
    it('approximate match', () => {
      expect(evalFn('HLOOKUP', [num(2.5), range(0, 0, 3, 1), num(2)], hCells)).toBe('b');
    });
  });

  describe('XLOOKUP', () => {
    it('exact match (column lookup)', () => {
      expect(evalFn('XLOOKUP', [str('Bob'), range(0, 0, 0, 2), range(1, 0, 1, 2)], lookupCells)).toBe(92);
    });
    it('returns if_not_found for no match', () => {
      expect(evalFn('XLOOKUP', [str('Dave'), range(0, 0, 0, 2), range(1, 0, 1, 2), str('N/A')], lookupCells)).toBe('N/A');
    });
    it('returns #N/A when no match and no fallback', () => {
      expect(evalFn('XLOOKUP', [str('Dave'), range(0, 0, 0, 2), range(1, 0, 1, 2)], lookupCells)).toBeInstanceOf(FormulaError);
    });
    it('exact or next smaller (match_mode = -1)', () => {
      const numCells = { '0,0': 10, '0,1': 20, '0,2': 30, '1,0': 'a', '1,1': 'b', '1,2': 'c' };
      expect(evalFn('XLOOKUP', [num(25), range(0, 0, 0, 2), range(1, 0, 1, 2), str('none'), num(-1)], numCells)).toBe('b');
    });
    it('exact or next larger (match_mode = 1)', () => {
      const numCells = { '0,0': 10, '0,1': 20, '0,2': 30, '1,0': 'a', '1,1': 'b', '1,2': 'c' };
      expect(evalFn('XLOOKUP', [num(25), range(0, 0, 0, 2), range(1, 0, 1, 2), str('none'), num(1)], numCells)).toBe('c');
    });
  });
});

// ===========================================================================
// DATE FUNCTIONS
// ===========================================================================

describe('Date functions (new)', () => {
  describe('DATE', () => {
    it('creates a date', () => {
      const result = evalFn('DATE', [num(2025), num(3), num(15)]) as Date;
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(2); // 0-indexed
      expect(result.getDate()).toBe(15);
    });
  });

  describe('DATEDIF', () => {
    it('calculates difference in days', () => {
      const ctx = createMockContext({ '0,0': new Date('2025-01-01'), '1,0': new Date('2025-01-31') });
      const result = evaluator.evaluate(fn('DATEDIF', cell(0, 0), cell(1, 0), str('D')), ctx);
      expect(result).toBe(30);
    });
    it('calculates difference in months', () => {
      const ctx = createMockContext({ '0,0': new Date('2025-01-15'), '1,0': new Date('2025-04-15') });
      const result = evaluator.evaluate(fn('DATEDIF', cell(0, 0), cell(1, 0), str('M')), ctx);
      expect(result).toBe(3);
    });
    it('calculates difference in years', () => {
      const ctx = createMockContext({ '0,0': new Date('2020-06-01'), '1,0': new Date('2025-06-01') });
      const result = evaluator.evaluate(fn('DATEDIF', cell(0, 0), cell(1, 0), str('Y')), ctx);
      expect(result).toBe(5);
    });
    it('returns #NUM! when start > end', () => {
      const ctx = createMockContext({ '0,0': new Date('2025-06-01'), '1,0': new Date('2020-01-01') });
      const result = evaluator.evaluate(fn('DATEDIF', cell(0, 0), cell(1, 0), str('D')), ctx);
      expect(result).toBeInstanceOf(FormulaError);
    });
  });

  describe('EDATE', () => {
    it('adds months to a date', () => {
      const ctx = createMockContext({ '0,0': new Date('2025-01-31') });
      const result = evaluator.evaluate(fn('EDATE', cell(0, 0), num(1)), ctx) as Date;
      expect(result).toBeInstanceOf(Date);
      // Jan 31 + 1 month = Feb 28 or Mar 3 depending on implementation
      expect(result.getMonth()).toBeGreaterThanOrEqual(1); // At least February
    });
    it('subtracts months with negative value', () => {
      const ctx = createMockContext({ '0,0': new Date('2025-06-15') });
      const result = evaluator.evaluate(fn('EDATE', cell(0, 0), num(-3)), ctx) as Date;
      expect(result.getMonth()).toBe(2); // March (0-indexed)
    });
  });

  describe('EOMONTH', () => {
    it('returns end of same month', () => {
      const ctx = createMockContext({ '0,0': new Date('2025-01-15') });
      const result = evaluator.evaluate(fn('EOMONTH', cell(0, 0), num(0)), ctx) as Date;
      expect(result.getDate()).toBe(31);
    });
    it('returns end of next month', () => {
      const ctx = createMockContext({ '0,0': new Date('2025-01-15') });
      const result = evaluator.evaluate(fn('EOMONTH', cell(0, 0), num(1)), ctx) as Date;
      expect(result.getMonth()).toBe(1); // February
      expect(result.getDate()).toBe(28); // 2025 is not leap year
    });
  });

  describe('WEEKDAY', () => {
    it('returns day of week (type 1: Sun=1..Sat=7)', () => {
      // Use local date constructor to avoid timezone issues
      // new Date(2025, 0, 15) = Jan 15 2025, which is Wednesday (getDay()=3)
      const ctx = createMockContext({ '0,0': new Date(2025, 0, 15) });
      const result = evaluator.evaluate(fn('WEEKDAY', cell(0, 0)), ctx);
      expect(result).toBe(4); // Wednesday: getDay()=3, type 1 = 3+1 = 4
    });
    it('returns day of week (type 2: Mon=1..Sun=7)', () => {
      const ctx = createMockContext({ '0,0': new Date(2025, 0, 15) });
      const result = evaluator.evaluate(fn('WEEKDAY', cell(0, 0), num(2)), ctx);
      expect(result).toBe(3); // Wednesday: getDay()=3, type 2 = 3
    });
  });

  describe('HOUR', () => {
    it('extracts hour from date', () => {
      const ctx = createMockContext({ '0,0': new Date('2025-01-15T14:30:45') });
      const result = evaluator.evaluate(fn('HOUR', cell(0, 0)), ctx);
      expect(result).toBe(14);
    });
  });

  describe('MINUTE', () => {
    it('extracts minute from date', () => {
      const ctx = createMockContext({ '0,0': new Date('2025-01-15T14:30:45') });
      const result = evaluator.evaluate(fn('MINUTE', cell(0, 0)), ctx);
      expect(result).toBe(30);
    });
  });

  describe('SECOND', () => {
    it('extracts second from date', () => {
      const ctx = createMockContext({ '0,0': new Date('2025-01-15T14:30:45') });
      const result = evaluator.evaluate(fn('SECOND', cell(0, 0)), ctx);
      expect(result).toBe(45);
    });
  });

  describe('NETWORKDAYS', () => {
    it('counts weekdays between dates', () => {
      // Mon Jan 6 to Fri Jan 10 = 5 weekdays (use local dates)
      const ctx = createMockContext({
        '0,0': new Date(2025, 0, 6),
        '1,0': new Date(2025, 0, 10),
      });
      const result = evaluator.evaluate(fn('NETWORKDAYS', cell(0, 0), cell(1, 0)), ctx);
      expect(result).toBe(5);
    });
    it('excludes weekends', () => {
      // Mon Jan 6 to Mon Jan 13 = 6 weekdays (Mon-Fri + Mon)
      const ctx = createMockContext({
        '0,0': new Date(2025, 0, 6),
        '1,0': new Date(2025, 0, 13),
      });
      const result = evaluator.evaluate(fn('NETWORKDAYS', cell(0, 0), cell(1, 0)), ctx);
      expect(result).toBe(6);
    });
    it('returns negative for reversed dates', () => {
      const ctx = createMockContext({
        '0,0': new Date(2025, 0, 10),
        '1,0': new Date(2025, 0, 6),
      });
      const result = evaluator.evaluate(fn('NETWORKDAYS', cell(0, 0), cell(1, 0)), ctx);
      expect(result).toBe(-5);
    });
  });
});

// ===========================================================================
// INFO FUNCTIONS
// ===========================================================================

describe('Info functions', () => {
  describe('ISBLANK', () => {
    it('returns true for null', () => {
      expect(evalFn('ISBLANK', [cell(0, 0)], {})).toBe(true);
    });
    it('returns true for empty string', () => {
      expect(evalFn('ISBLANK', [cell(0, 0)], { '0,0': '' })).toBe(true);
    });
    it('returns false for a number', () => {
      expect(evalFn('ISBLANK', [cell(0, 0)], { '0,0': 0 })).toBe(false);
    });
    it('returns false for a string', () => {
      expect(evalFn('ISBLANK', [cell(0, 0)], { '0,0': 'hello' })).toBe(false);
    });
  });

  describe('ISNUMBER', () => {
    it('returns true for number', () => {
      expect(evalFn('ISNUMBER', [num(42)])).toBe(true);
    });
    it('returns false for string', () => {
      expect(evalFn('ISNUMBER', [str('42')])).toBe(false);
    });
    it('returns false for boolean', () => {
      expect(evalFn('ISNUMBER', [bool(true)])).toBe(false);
    });
  });

  describe('ISTEXT', () => {
    it('returns true for string', () => {
      expect(evalFn('ISTEXT', [str('hello')])).toBe(true);
    });
    it('returns false for number', () => {
      expect(evalFn('ISTEXT', [num(42)])).toBe(false);
    });
  });

  describe('ISERROR', () => {
    it('returns true for error', () => {
      // 1/0 → #DIV/0!
      const ctx = createMockContext({});
      const divByZero: ASTNode = { kind: 'binaryOp', op: '/', left: num(1), right: num(0) };
      const result = evaluator.evaluate(fn('ISERROR', divByZero), ctx);
      expect(result).toBe(true);
    });
    it('returns false for normal value', () => {
      expect(evalFn('ISERROR', [num(42)])).toBe(false);
    });
  });

  describe('ISNA', () => {
    it('returns true for #N/A error', () => {
      const ctx = createMockContext({ '0,0': 'A' });
      const vlookup: ASTNode = fn('VLOOKUP', num(999), range(0, 0, 0, 0), num(1), bool(false));
      const result = evaluator.evaluate(fn('ISNA', vlookup), ctx);
      expect(result).toBe(true);
    });
    it('returns false for other errors', () => {
      const ctx = createMockContext({});
      const divByZero: ASTNode = { kind: 'binaryOp', op: '/', left: num(1), right: num(0) };
      const result = evaluator.evaluate(fn('ISNA', divByZero), ctx);
      expect(result).toBe(false);
    });
    it('returns false for normal value', () => {
      expect(evalFn('ISNA', [num(42)])).toBe(false);
    });
  });

  describe('TYPE', () => {
    it('returns 1 for number', () => {
      expect(evalFn('TYPE', [num(42)])).toBe(1);
    });
    it('returns 2 for text', () => {
      expect(evalFn('TYPE', [str('hello')])).toBe(2);
    });
    it('returns 4 for boolean', () => {
      expect(evalFn('TYPE', [bool(true)])).toBe(4);
    });
    it('returns 16 for error', () => {
      const ctx = createMockContext({});
      const divByZero: ASTNode = { kind: 'binaryOp', op: '/', left: num(1), right: num(0) };
      const result = evaluator.evaluate(fn('TYPE', divByZero), ctx);
      expect(result).toBe(16);
    });
  });
});

// ===========================================================================
// STATS FUNCTIONS (multi-criteria)
// ===========================================================================

describe('Stats functions (multi-criteria)', () => {
  // Data layout:
  // Col 0 (Category): A, B, A, B, A
  // Col 1 (Region):   N, N, S, S, N
  // Col 2 (Value):    10, 20, 30, 40, 50
  const multiCells = {
    '0,0': 'A', '1,0': 'N', '2,0': 10,
    '0,1': 'B', '1,1': 'N', '2,1': 20,
    '0,2': 'A', '1,2': 'S', '2,2': 30,
    '0,3': 'B', '1,3': 'S', '2,3': 40,
    '0,4': 'A', '1,4': 'N', '2,4': 50,
  };

  describe('SUMIFS', () => {
    it('sums with single criteria', () => {
      // Sum values where category = A → 10 + 30 + 50 = 90
      expect(evalFn('SUMIFS', [range(2, 0, 2, 4), range(0, 0, 0, 4), str('A')], multiCells)).toBe(90);
    });
    it('sums with multiple criteria', () => {
      // Sum values where category = A AND region = N → 10 + 50 = 60
      expect(evalFn('SUMIFS', [
        range(2, 0, 2, 4),
        range(0, 0, 0, 4), str('A'),
        range(1, 0, 1, 4), str('N'),
      ], multiCells)).toBe(60);
    });
    it('returns 0 when no matches', () => {
      expect(evalFn('SUMIFS', [range(2, 0, 2, 4), range(0, 0, 0, 4), str('C')], multiCells)).toBe(0);
    });
  });

  describe('COUNTIFS', () => {
    it('counts with single criteria', () => {
      // Count where category = B → 2
      expect(evalFn('COUNTIFS', [range(0, 0, 0, 4), str('B')], multiCells)).toBe(2);
    });
    it('counts with multiple criteria', () => {
      // Count where category = A AND region = N → 2
      expect(evalFn('COUNTIFS', [
        range(0, 0, 0, 4), str('A'),
        range(1, 0, 1, 4), str('N'),
      ], multiCells)).toBe(2);
    });
  });

  describe('AVERAGEIFS', () => {
    it('averages with single criteria', () => {
      // Average values where category = A → (10+30+50)/3 = 30
      expect(evalFn('AVERAGEIFS', [range(2, 0, 2, 4), range(0, 0, 0, 4), str('A')], multiCells)).toBe(30);
    });
    it('averages with multiple criteria', () => {
      // Average values where category = A AND region = N → (10+50)/2 = 30
      expect(evalFn('AVERAGEIFS', [
        range(2, 0, 2, 4),
        range(0, 0, 0, 4), str('A'),
        range(1, 0, 1, 4), str('N'),
      ], multiCells)).toBe(30);
    });
    it('returns #DIV/0! when no matches', () => {
      expect(evalFn('AVERAGEIFS', [range(2, 0, 2, 4), range(0, 0, 0, 4), str('C')], multiCells)).toBeInstanceOf(FormulaError);
    });
  });
});

// ===========================================================================
// Verify original functions still work
// ===========================================================================

describe('Original functions still work', () => {
  it('SUM', () => {
    expect(evalFn('SUM', [range(0, 0, 0, 2)], { '0,0': 1, '0,1': 2, '0,2': 3 })).toBe(6);
  });
  it('AVERAGE', () => {
    expect(evalFn('AVERAGE', [range(0, 0, 0, 2)], { '0,0': 10, '0,1': 20, '0,2': 30 })).toBe(20);
  });
  it('COUNT', () => {
    expect(evalFn('COUNT', [range(0, 0, 0, 2)], { '0,0': 1, '0,1': 'a', '0,2': 3 })).toBe(2);
  });
  it('COUNTA', () => {
    expect(evalFn('COUNTA', [range(0, 0, 0, 2)], { '0,0': 1, '0,1': 'a', '0,2': null })).toBe(2);
  });
  it('IF', () => {
    expect(evalFn('IF', [bool(true), str('yes'), str('no')])).toBe('yes');
  });
  it('VLOOKUP', () => {
    expect(evalFn('VLOOKUP', [str('B'), range(0, 0, 1, 2), num(2), bool(false)], {
      '0,0': 'A', '1,0': 1,
      '0,1': 'B', '1,1': 2,
      '0,2': 'C', '1,2': 3,
    })).toBe(2);
  });
  it('CONCATENATE', () => {
    expect(evalFn('CONCATENATE', [str('Hello'), str(' '), str('World')])).toBe('Hello World');
  });
  it('TODAY', () => {
    const result = evalFn('TODAY', []) as Date;
    expect(result).toBeInstanceOf(Date);
    expect(result.getFullYear()).toBe(2025);
  });
  it('ROUND', () => {
    expect(evalFn('ROUND', [num(3.14159), num(2)])).toBe(3.14);
  });
  it('ABS', () => {
    expect(evalFn('ABS', [num(-5)])).toBe(5);
  });
  it('SUMIF', () => {
    expect(evalFn('SUMIF', [range(0, 0, 0, 2), str('>1'), range(1, 0, 1, 2)], {
      '0,0': 1, '0,1': 2, '0,2': 3, '1,0': 10, '1,1': 20, '1,2': 30,
    })).toBe(50);
  });
  it('COUNTIF', () => {
    expect(evalFn('COUNTIF', [range(0, 0, 0, 4), str('A')], {
      '0,0': 'A', '0,1': 'B', '0,2': 'A', '0,3': 'C', '0,4': 'A',
    })).toBe(3);
  });
});
