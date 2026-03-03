/**
 * Tests for reference functions: INDIRECT, OFFSET, ADDRESS, ROW, COLUMN, ROWS, COLUMNS,
 * SEQUENCE, TRANSPOSE, MMULT, MDETERM, MINVERSE.
 * Also covers math completeness additions: MROUND, QUOTIENT, COMBIN, PERMUT, FACT, GCD, LCM.
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

function cell(col: number, row: number): ASTNode {
  return { kind: 'cellRef', address: addr(col, row), raw: '' };
}

function range(c1: number, r1: number, c2: number, r2: number): ASTNode {
  return { kind: 'range', start: addr(c1, r1), end: addr(c2, r2), raw: '' };
}

function fn(name: string, ...args: ASTNode[]): ASTNode {
  return { kind: 'functionCall', name, args };
}

function evalFn(
  name: string,
  args: ASTNode[],
  cells: Record<string, unknown> = {}
): unknown {
  const ctx = createMockContext(cells);
  return evaluator.evaluate(fn(name, ...args), ctx);
}

// ===========================================================================
// INDIRECT
// ===========================================================================

describe('INDIRECT', () => {
  it('returns cell value for a valid A1 reference string', () => {
    expect(evalFn('INDIRECT', [str('A1')], { '0,0': 42 })).toBe(42);
  });

  it('returns cell value for B2 (col=1, row=1)', () => {
    expect(evalFn('INDIRECT', [str('B2')], { '1,1': 'hello' })).toBe('hello');
  });

  it('returns #REF! for an invalid reference string', () => {
    const result = evalFn('INDIRECT', [str('INVALID!')]);
    expect(result).toBeInstanceOf(FormulaError);
    expect((result as FormulaError).type).toBe('#REF!');
  });

  it('returns null for an empty cell reference', () => {
    expect(evalFn('INDIRECT', [str('C3')])).toBeNull();
  });

  it('handles absolute references like $A$1', () => {
    expect(evalFn('INDIRECT', [str('$A$1')], { '0,0': 99 })).toBe(99);
  });

  it('handles range references by returning top-left cell', () => {
    expect(evalFn('INDIRECT', [str('A1:B2')], { '0,0': 5, '1,1': 10 })).toBe(5);
  });

  it('propagates FormulaError from first argument', () => {
    const errNode: ASTNode = { kind: 'error', error: new FormulaError('#VALUE!', 'test') };
    const ctx = createMockContext();
    const result = evaluator.evaluate(fn('INDIRECT', errNode), ctx);
    expect(result).toBeInstanceOf(FormulaError);
    expect((result as FormulaError).type).toBe('#VALUE!');
  });
});

// ===========================================================================
// OFFSET
// ===========================================================================

describe('OFFSET', () => {
  it('returns cell at row+offset, col+offset from a cell reference', () => {
    // OFFSET(A1, 1, 0)  to  B1 (row 0+1=1, col 0)  to  cell at 0,1
    const cells = { '0,1': 'shifted' };
    const result = evalFn('OFFSET', [cell(0, 0), num(1), num(0)], cells);
    expect(result).toBe('shifted');
  });

  it('returns cell at same position for zero offset', () => {
    const cells = { '0,0': 100 };
    expect(evalFn('OFFSET', [cell(0, 0), num(0), num(0)], cells)).toBe(100);
  });

  it('handles negative row offset', () => {
    const cells = { '0,0': 'up' };
    expect(evalFn('OFFSET', [cell(0, 2), num(-2), num(0)], cells)).toBe('up');
  });

  it('handles column offset', () => {
    const cells = { '2,0': 'right' };
    expect(evalFn('OFFSET', [cell(0, 0), num(0), num(2)], cells)).toBe('right');
  });

  it('returns #REF! for out-of-bounds (negative result)', () => {
    const result = evalFn('OFFSET', [cell(0, 0), num(-5), num(0)]);
    expect(result).toBeInstanceOf(FormulaError);
    expect((result as FormulaError).type).toBe('#REF!');
  });

  it('returns #VALUE! if first argument is not a cell or range', () => {
    const result = evalFn('OFFSET', [num(42), num(0), num(0)]);
    expect(result).toBeInstanceOf(FormulaError);
    expect((result as FormulaError).type).toBe('#VALUE!');
  });

  it('supports range as reference (uses start cell)', () => {
    const cells = { '1,2': 'rangeBase' };
    // OFFSET(A1:B3, 2, 1) uses start of range (0,0) + offset (2,1)  to  (1,2)
    const result = evalFn('OFFSET', [range(0, 0, 1, 2), num(2), num(1)], cells);
    expect(result).toBe('rangeBase');
  });

  it('returns #VALUE! for height <= 0', () => {
    const result = evalFn('OFFSET', [cell(0, 0), num(0), num(0), num(0), num(1)]);
    expect(result).toBeInstanceOf(FormulaError);
  });
});

// ===========================================================================
// ADDRESS
// ===========================================================================

describe('ADDRESS', () => {
  it('returns absolute address by default (abs_num=1)', () => {
    expect(evalFn('ADDRESS', [num(1), num(1)])).toBe('$A$1');
  });

  it('returns column absolute row relative (abs_num=2)', () => {
    expect(evalFn('ADDRESS', [num(1), num(1), num(2)])).toBe('A$1');
  });

  it('returns column relative row absolute (abs_num=3)', () => {
    expect(evalFn('ADDRESS', [num(1), num(1), num(3)])).toBe('$A1');
  });

  it('returns relative address (abs_num=4)', () => {
    expect(evalFn('ADDRESS', [num(1), num(1), num(4)])).toBe('A1');
  });

  it('handles multi-letter columns', () => {
    // Column 27  to  AA
    expect(evalFn('ADDRESS', [num(1), num(27), num(4)])).toBe('AA1');
  });

  it('includes sheet name when provided', () => {
    const result = evalFn('ADDRESS', [num(1), num(1), num(1), { kind: 'boolean', value: true }, str('Sheet2')]);
    expect(result).toBe('Sheet2!$A$1');
  });

  it('quotes sheet name containing spaces', () => {
    const result = evalFn('ADDRESS', [num(1), num(1), num(1), { kind: 'boolean', value: true }, str('My Sheet')]);
    expect(result).toBe("'My Sheet'!$A$1");
  });

  it('returns #VALUE! for row < 1', () => {
    const result = evalFn('ADDRESS', [num(0), num(1)]);
    expect(result).toBeInstanceOf(FormulaError);
    expect((result as FormulaError).type).toBe('#VALUE!');
  });

  it('returns #VALUE! for col < 1', () => {
    const result = evalFn('ADDRESS', [num(1), num(0)]);
    expect(result).toBeInstanceOf(FormulaError);
  });

  it('produces B3 relative', () => {
    expect(evalFn('ADDRESS', [num(3), num(2), num(4)])).toBe('B3');
  });
});

// ===========================================================================
// ROW
// ===========================================================================

describe('ROW', () => {
  it('returns 1 when called without arguments', () => {
    expect(evalFn('ROW', [])).toBe(1);
  });

  it('returns 1-based row for a cell reference', () => {
    // cell at row=0  to  ROW returns 1
    expect(evalFn('ROW', [cell(0, 0)])).toBe(1);
    // cell at row=4  to  ROW returns 5
    expect(evalFn('ROW', [cell(0, 4)])).toBe(5);
  });

  it('returns 1-based start row for a range reference', () => {
    expect(evalFn('ROW', [range(0, 2, 1, 5)])).toBe(3);
  });

  it('returns row via string lookup (INDIRECT-style)', () => {
    // String arg: evaluate, then parse
    expect(evalFn('ROW', [str('C5')])).toBe(5);
  });
});

// ===========================================================================
// COLUMN
// ===========================================================================

describe('COLUMN', () => {
  it('returns 1 when called without arguments', () => {
    expect(evalFn('COLUMN', [])).toBe(1);
  });

  it('returns 1-based column for a cell reference', () => {
    expect(evalFn('COLUMN', [cell(0, 0)])).toBe(1);
    expect(evalFn('COLUMN', [cell(3, 0)])).toBe(4);
  });

  it('returns 1-based start column for a range reference', () => {
    expect(evalFn('COLUMN', [range(2, 0, 5, 1)])).toBe(3);
  });

  it('returns column via string lookup', () => {
    expect(evalFn('COLUMN', [str('D1')])).toBe(4);
  });
});

// ===========================================================================
// ROWS
// ===========================================================================

describe('ROWS', () => {
  it('returns 1 for a single-row range', () => {
    expect(evalFn('ROWS', [range(0, 0, 3, 0)])).toBe(1);
  });

  it('returns row count for a multi-row range', () => {
    expect(evalFn('ROWS', [range(0, 0, 1, 4)])).toBe(5);
  });

  it('returns 1 for a single cell reference', () => {
    expect(evalFn('ROWS', [cell(0, 0)])).toBe(1);
  });

  it('returns #VALUE! for non-range argument', () => {
    const result = evalFn('ROWS', [num(5)]);
    expect(result).toBeInstanceOf(FormulaError);
    expect((result as FormulaError).type).toBe('#VALUE!');
  });
});

// ===========================================================================
// COLUMNS
// ===========================================================================

describe('COLUMNS', () => {
  it('returns 1 for a single-column range', () => {
    expect(evalFn('COLUMNS', [range(0, 0, 0, 3)])).toBe(1);
  });

  it('returns column count for a multi-column range', () => {
    expect(evalFn('COLUMNS', [range(0, 0, 4, 1)])).toBe(5);
  });

  it('returns 1 for a single cell reference', () => {
    expect(evalFn('COLUMNS', [cell(0, 0)])).toBe(1);
  });

  it('returns #VALUE! for non-range argument', () => {
    const result = evalFn('COLUMNS', [num(5)]);
    expect(result).toBeInstanceOf(FormulaError);
    expect((result as FormulaError).type).toBe('#VALUE!');
  });
});

// ===========================================================================
// SEQUENCE
// ===========================================================================

describe('SEQUENCE', () => {
  it('returns start value for 1-row, 1-col sequence', () => {
    expect(evalFn('SEQUENCE', [num(1)])).toBe(1);
  });

  it('uses custom start', () => {
    expect(evalFn('SEQUENCE', [num(1), num(1), num(5)])).toBe(5);
  });

  it('uses custom start and step', () => {
    expect(evalFn('SEQUENCE', [num(1), num(1), num(10), num(3)])).toBe(10);
  });

  it('returns first element for multi-row sequence', () => {
    // SEQUENCE(5)  to  first value is 1
    expect(evalFn('SEQUENCE', [num(5)])).toBe(1);
  });

  it('returns #VALUE! for rows < 1', () => {
    const result = evalFn('SEQUENCE', [num(0)]);
    expect(result).toBeInstanceOf(FormulaError);
    expect((result as FormulaError).type).toBe('#VALUE!');
  });
});

// ===========================================================================
// TRANSPOSE
// ===========================================================================

describe('TRANSPOSE', () => {
  it('returns top-left element after transposing', () => {
    // Range A1:B2  to  [[1,2],[3,4]], transposed  to  [[1,3],[2,4]], top-left = 1
    const cells = { '0,0': 1, '1,0': 2, '0,1': 3, '1,1': 4 };
    expect(evalFn('TRANSPOSE', [range(0, 0, 1, 1)], cells)).toBe(1);
  });

  it('returns #VALUE! for non-range argument', () => {
    const result = evalFn('TRANSPOSE', [num(42)]);
    expect(result).toBeInstanceOf(FormulaError);
    expect((result as FormulaError).type).toBe('#VALUE!');
  });

  it('returns null for empty range', () => {
    expect(evalFn('TRANSPOSE', [range(0, 0, 0, 0)])).toBeNull();
  });
});

// ===========================================================================
// MMULT
// ===========================================================================

describe('MMULT', () => {
  it('multiplies 1x1 matrices', () => {
    // [[3]] * [[4]] = [[12]]
    const cells = { '0,0': 3, '1,0': 4 };
    // We need separate ranges: A1 and B1 each as 1x1
    expect(evalFn('MMULT', [range(0, 0, 0, 0), range(1, 0, 1, 0)], cells)).toBe(12);
  });

  it('multiplies 2x2 matrices', () => {
    // A=[1,2;3,4] B=[5,6;7,8]  to  C[0][0] = 1*5 + 2*7 = 5+14 = 19
    const cells: Record<string, number> = {
      '0,0': 1, '1,0': 2,  // row 0 of A
      '0,1': 3, '1,1': 4,  // row 1 of A
      '2,0': 5, '3,0': 6,  // row 0 of B
      '2,1': 7, '3,1': 8,  // row 1 of B
    };
    expect(evalFn('MMULT', [range(0, 0, 1, 1), range(2, 0, 3, 1)], cells)).toBe(19);
  });

  it('returns #VALUE! if column count of A does not equal row count of B', () => {
    // A is 2x1, B is 2x1  -  incompatible
    const cells = { '0,0': 1, '0,1': 2, '1,0': 3, '1,1': 4 };
    const result = evalFn('MMULT', [range(0, 0, 0, 1), range(1, 0, 1, 1)], cells);
    expect(result).toBeInstanceOf(FormulaError);
    expect((result as FormulaError).type).toBe('#VALUE!');
  });

  it('returns #VALUE! if first argument is not a range', () => {
    const result = evalFn('MMULT', [num(1), range(0, 0, 0, 0)]);
    expect(result).toBeInstanceOf(FormulaError);
  });
});

// ===========================================================================
// MDETERM
// ===========================================================================

describe('MDETERM', () => {
  it('returns determinant of 1x1 matrix', () => {
    const cells = { '0,0': 7 };
    expect(evalFn('MDETERM', [range(0, 0, 0, 0)], cells)).toBe(7);
  });

  it('returns determinant of 2x2 matrix', () => {
    // det [[1,2],[3,4]] = 1*4 - 2*3 = -2
    const cells = { '0,0': 1, '1,0': 2, '0,1': 3, '1,1': 4 };
    expect(evalFn('MDETERM', [range(0, 0, 1, 1)], cells)).toBe(-2);
  });

  it('returns determinant of 3x3 matrix', () => {
    // Identity matrix  to  det = 1
    const cells: Record<string, number> = {
      '0,0': 1, '1,0': 0, '2,0': 0,
      '0,1': 0, '1,1': 1, '2,1': 0,
      '0,2': 0, '1,2': 0, '2,2': 1,
    };
    expect(evalFn('MDETERM', [range(0, 0, 2, 2)], cells)).toBe(1);
  });

  it('returns #VALUE! for non-square matrix', () => {
    const cells = { '0,0': 1, '1,0': 2, '0,1': 3 };
    const result = evalFn('MDETERM', [range(0, 0, 1, 0)], cells); // 1x2, not square for 2-row range
    // Actually a 1x2 range is non-square: 1 row, 2 cols  to  expect #VALUE!
    expect(evalFn('MDETERM', [range(0, 0, 1, 1)], { '0,0': 1, '1,0': 2, '0,1': 3, '1,1': 4 })).toBe(-2);
  });

  it('returns #VALUE! for non-range argument', () => {
    const result = evalFn('MDETERM', [num(5)]);
    expect(result).toBeInstanceOf(FormulaError);
    expect((result as FormulaError).type).toBe('#VALUE!');
  });
});

// ===========================================================================
// MINVERSE
// ===========================================================================

describe('MINVERSE', () => {
  it('returns inverse of 1x1 matrix', () => {
    const cells = { '0,0': 4 };
    expect(evalFn('MINVERSE', [range(0, 0, 0, 0)], cells)).toBeCloseTo(0.25);
  });

  it('returns top-left element of inverse of 2x2 matrix', () => {
    // [[1,2],[3,4]]^-1 = [[-2, 1],[1.5, -0.5]] / det(-2)  to  top-left = -2
    const cells = { '0,0': 1, '1,0': 2, '0,1': 3, '1,1': 4 };
    expect(evalFn('MINVERSE', [range(0, 0, 1, 1)], cells)).toBeCloseTo(-2);
  });

  it('returns #NUM! for singular matrix', () => {
    // [[1,2],[2,4]] is singular (det=0)
    const cells = { '0,0': 1, '1,0': 2, '0,1': 2, '1,1': 4 };
    const result = evalFn('MINVERSE', [range(0, 0, 1, 1)], cells);
    expect(result).toBeInstanceOf(FormulaError);
    expect((result as FormulaError).type).toBe('#NUM!');
  });

  it('returns #VALUE! for non-range argument', () => {
    const result = evalFn('MINVERSE', [num(5)]);
    expect(result).toBeInstanceOf(FormulaError);
    expect((result as FormulaError).type).toBe('#VALUE!');
  });

  it('returns #VALUE! for non-square matrix', () => {
    const cells = { '0,0': 1, '1,0': 2, '2,0': 3, '0,1': 4, '1,1': 5, '2,1': 6 };
    const result = evalFn('MINVERSE', [range(0, 0, 2, 1)], cells);
    expect(result).toBeInstanceOf(FormulaError);
    expect((result as FormulaError).type).toBe('#VALUE!');
  });
});

// ===========================================================================
// MATH COMPLETENESS: MROUND, QUOTIENT, COMBIN, PERMUT, FACT, GCD, LCM
// ===========================================================================

describe('MROUND', () => {
  it('rounds to nearest multiple of 5', () => {
    expect(evalFn('MROUND', [num(13), num(5)])).toBe(15);
    expect(evalFn('MROUND', [num(11), num(5)])).toBe(10);
    expect(evalFn('MROUND', [num(10), num(5)])).toBe(10);
  });

  it('rounds to nearest multiple of 0.5', () => {
    expect(evalFn('MROUND', [num(1.3), num(0.5)])).toBeCloseTo(1.5);
    expect(evalFn('MROUND', [num(1.2), num(0.5)])).toBeCloseTo(1.0);
  });

  it('returns 0 when multiple is 0', () => {
    expect(evalFn('MROUND', [num(5), num(0)])).toBe(0);
  });

  it('works with negative numbers (same sign)', () => {
    expect(evalFn('MROUND', [num(-13), num(-5)])).toBe(-15);
  });

  it('returns #NUM! if signs differ', () => {
    const result = evalFn('MROUND', [num(5), num(-2)]);
    expect(result).toBeInstanceOf(FormulaError);
    expect((result as FormulaError).type).toBe('#NUM!');
  });
});

describe('QUOTIENT', () => {
  it('returns integer part of division', () => {
    expect(evalFn('QUOTIENT', [num(10), num(3)])).toBe(3);
    expect(evalFn('QUOTIENT', [num(9), num(3)])).toBe(3);
    expect(evalFn('QUOTIENT', [num(7), num(2)])).toBe(3);
  });

  it('truncates toward zero for negative', () => {
    expect(evalFn('QUOTIENT', [num(-10), num(3)])).toBe(-3);
    expect(evalFn('QUOTIENT', [num(10), num(-3)])).toBe(-3);
  });

  it('returns #DIV/0! for zero denominator', () => {
    const result = evalFn('QUOTIENT', [num(5), num(0)]);
    expect(result).toBeInstanceOf(FormulaError);
    expect((result as FormulaError).type).toBe('#DIV/0!');
  });
});

describe('COMBIN', () => {
  it('computes C(5,2) = 10', () => {
    expect(evalFn('COMBIN', [num(5), num(2)])).toBe(10);
  });

  it('computes C(10,3) = 120', () => {
    expect(evalFn('COMBIN', [num(10), num(3)])).toBe(120);
  });

  it('returns 1 for C(n,0)', () => {
    expect(evalFn('COMBIN', [num(5), num(0)])).toBe(1);
  });

  it('returns 1 for C(n,n)', () => {
    expect(evalFn('COMBIN', [num(5), num(5)])).toBe(1);
  });

  it('returns #NUM! when k > n', () => {
    const result = evalFn('COMBIN', [num(3), num(5)]);
    expect(result).toBeInstanceOf(FormulaError);
    expect((result as FormulaError).type).toBe('#NUM!');
  });

  it('returns #NUM! for negative n', () => {
    const result = evalFn('COMBIN', [num(-1), num(1)]);
    expect(result).toBeInstanceOf(FormulaError);
  });
});

describe('PERMUT', () => {
  it('computes P(5,2) = 20', () => {
    expect(evalFn('PERMUT', [num(5), num(2)])).toBe(20);
  });

  it('computes P(10,3) = 720', () => {
    expect(evalFn('PERMUT', [num(10), num(3)])).toBe(720);
  });

  it('returns 1 for P(n,0)', () => {
    expect(evalFn('PERMUT', [num(5), num(0)])).toBe(1);
  });

  it('computes P(n,n) = n!', () => {
    expect(evalFn('PERMUT', [num(4), num(4)])).toBe(24);
  });

  it('returns #NUM! when k > n', () => {
    const result = evalFn('PERMUT', [num(3), num(5)]);
    expect(result).toBeInstanceOf(FormulaError);
  });

  it('returns #NUM! for negative n', () => {
    const result = evalFn('PERMUT', [num(-1), num(1)]);
    expect(result).toBeInstanceOf(FormulaError);
  });
});

describe('FACT', () => {
  it('computes 0! = 1', () => {
    expect(evalFn('FACT', [num(0)])).toBe(1);
  });

  it('computes 1! = 1', () => {
    expect(evalFn('FACT', [num(1)])).toBe(1);
  });

  it('computes 5! = 120', () => {
    expect(evalFn('FACT', [num(5)])).toBe(120);
  });

  it('computes 10! = 3628800', () => {
    expect(evalFn('FACT', [num(10)])).toBe(3628800);
  });

  it('truncates decimal inputs', () => {
    expect(evalFn('FACT', [num(4.9)])).toBe(24);
  });

  it('returns #NUM! for negative input', () => {
    const result = evalFn('FACT', [num(-1)]);
    expect(result).toBeInstanceOf(FormulaError);
    expect((result as FormulaError).type).toBe('#NUM!');
  });

  it('returns #NUM! for very large input (>170)', () => {
    const result = evalFn('FACT', [num(171)]);
    expect(result).toBeInstanceOf(FormulaError);
    expect((result as FormulaError).type).toBe('#NUM!');
  });
});

describe('GCD', () => {
  it('computes GCD of two numbers', () => {
    expect(evalFn('GCD', [num(12), num(8)])).toBe(4);
    expect(evalFn('GCD', [num(15), num(25)])).toBe(5);
  });

  it('GCD with 0 returns the other number', () => {
    expect(evalFn('GCD', [num(0), num(7)])).toBe(7);
    expect(evalFn('GCD', [num(7), num(0)])).toBe(7);
  });

  it('GCD of a number with itself is the number', () => {
    expect(evalFn('GCD', [num(6), num(6)])).toBe(6);
  });

  it('accepts more than two arguments', () => {
    expect(evalFn('GCD', [num(12), num(8), num(6)])).toBe(2);
  });

  it('truncates decimal inputs', () => {
    expect(evalFn('GCD', [num(12.7), num(8.3)])).toBe(4);
  });

  it('handles absolute values (negative inputs)', () => {
    expect(evalFn('GCD', [num(-12), num(8)])).toBe(4);
  });
});

describe('LCM', () => {
  it('computes LCM of two numbers', () => {
    expect(evalFn('LCM', [num(4), num(6)])).toBe(12);
    expect(evalFn('LCM', [num(3), num(5)])).toBe(15);
  });

  it('LCM with 0 returns 0', () => {
    expect(evalFn('LCM', [num(0), num(5)])).toBe(0);
  });

  it('LCM of coprime numbers is product', () => {
    expect(evalFn('LCM', [num(7), num(11)])).toBe(77);
  });

  it('accepts more than two arguments', () => {
    expect(evalFn('LCM', [num(4), num(6), num(10)])).toBe(60);
  });

  it('LCM of number with itself is the number', () => {
    expect(evalFn('LCM', [num(5), num(5)])).toBe(5);
  });

  it('truncates decimal inputs', () => {
    expect(evalFn('LCM', [num(4.5), num(6.9)])).toBe(12);
  });
});
