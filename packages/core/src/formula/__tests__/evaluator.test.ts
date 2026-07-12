import { FormulaEvaluator, toNumber, toText, toBoolean, flattenArgs } from '../evaluator';
import { FormulaError } from '../types';
import type { ASTNode, IFormulaContext } from '../types';

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

const evaluator = new FormulaEvaluator(new Map());

function addr(col: number, row: number) {
  return { col, row, absCol: false, absRow: false };
}

// ---------------------------------------------------------------------------
// toNumber
// ---------------------------------------------------------------------------

describe('toNumber', () => {
  it('passes a number through unchanged', () => {
    expect(toNumber(42)).toBe(42);
  });

  it('converts a numeric string to a number', () => {
    expect(toNumber('42')).toBe(42);
  });

  it('converts a decimal string to a number', () => {
    expect(toNumber('3.14')).toBe(3.14);
  });

  it('converts boolean true to 1', () => {
    expect(toNumber(true)).toBe(1);
  });

  it('converts boolean false to 0', () => {
    expect(toNumber(false)).toBe(0);
  });

  it('converts null to 0', () => {
    expect(toNumber(null)).toBe(0);
  });

  it('converts undefined to 0', () => {
    expect(toNumber(undefined)).toBe(0);
  });

  it('converts empty string to 0', () => {
    expect(toNumber('')).toBe(0);
  });

  it('returns FormulaError for non-numeric string', () => {
    const result = toNumber('hello');
    expect(result).toBeInstanceOf(FormulaError);
    expect((result as FormulaError).type).toBe('#VALUE!');
  });

  it('converts a Date to its timestamp', () => {
    const d = new Date('2025-06-15T00:00:00Z');
    expect(toNumber(d)).toBe(d.getTime());
  });

  it('passes a FormulaError through unchanged', () => {
    const err = new FormulaError('#DIV/0!');
    expect(toNumber(err)).toBe(err);
  });

  it('converts negative numeric string', () => {
    expect(toNumber('-7')).toBe(-7);
  });
});

// ---------------------------------------------------------------------------
// toText
// ---------------------------------------------------------------------------

describe('toText', () => {
  it('converts a number to its string representation', () => {
    expect(toText(99)).toBe('99');
  });

  it('converts null to empty string', () => {
    expect(toText(null)).toBe('');
  });

  it('converts undefined to empty string', () => {
    expect(toText(undefined)).toBe('');
  });

  it('returns the error type string for a FormulaError', () => {
    const err = new FormulaError('#REF!');
    expect(toText(err)).toBe('#REF!');
  });

  it('converts a boolean to string', () => {
    expect(toText(true)).toBe('true');
    expect(toText(false)).toBe('false');
  });

  it('passes a string through unchanged', () => {
    expect(toText('hello')).toBe('hello');
  });

  it('converts a Date to a locale date string', () => {
    const d = new Date('2025-01-15T00:00:00Z');
    // Date.toLocaleDateString output varies by locale; just verify it is a string
    const result = toText(d);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// toBoolean
// ---------------------------------------------------------------------------

describe('toBoolean', () => {
  it('passes true through', () => {
    expect(toBoolean(true)).toBe(true);
  });

  it('passes false through', () => {
    expect(toBoolean(false)).toBe(false);
  });

  it('converts number 0 to false', () => {
    expect(toBoolean(0)).toBe(false);
  });

  it('converts number 1 to true', () => {
    expect(toBoolean(1)).toBe(true);
  });

  it('converts negative number to true', () => {
    expect(toBoolean(-5)).toBe(true);
  });

  it('converts string "TRUE" (case-insensitive) to true', () => {
    expect(toBoolean('TRUE')).toBe(true);
    expect(toBoolean('True')).toBe(true);
    expect(toBoolean('true')).toBe(true);
  });

  it('converts string "FALSE" (case-insensitive) to false', () => {
    expect(toBoolean('FALSE')).toBe(false);
    expect(toBoolean('False')).toBe(false);
    expect(toBoolean('false')).toBe(false);
  });

  it('converts non-empty string to true', () => {
    expect(toBoolean('hello')).toBe(true);
  });

  it('converts empty string to false', () => {
    expect(toBoolean('')).toBe(false);
  });

  it('converts null to false', () => {
    expect(toBoolean(null)).toBe(false);
  });

  it('converts undefined to false', () => {
    expect(toBoolean(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Literal evaluation
// ---------------------------------------------------------------------------

describe('evaluate  -  literals', () => {
  const ctx = createMockContext();

  it('evaluates a number literal', () => {
    const node: ASTNode = { kind: 'number', value: 7 };
    expect(evaluator.evaluate(node, ctx)).toBe(7);
  });

  it('evaluates a string literal', () => {
    const node: ASTNode = { kind: 'string', value: 'abc' };
    expect(evaluator.evaluate(node, ctx)).toBe('abc');
  });

  it('evaluates a boolean literal', () => {
    const nodeTrue: ASTNode = { kind: 'boolean', value: true };
    const nodeFalse: ASTNode = { kind: 'boolean', value: false };
    expect(evaluator.evaluate(nodeTrue, ctx)).toBe(true);
    expect(evaluator.evaluate(nodeFalse, ctx)).toBe(false);
  });

  it('evaluates an error node', () => {
    const err = new FormulaError('#REF!');
    const node: ASTNode = { kind: 'error', error: err };
    expect(evaluator.evaluate(node, ctx)).toBe(err);
  });
});

// ---------------------------------------------------------------------------
// Cell references
// ---------------------------------------------------------------------------

describe('evaluate  -  cell references', () => {
  it('resolves a cell value from context', () => {
    const ctx = createMockContext({ '2,3': 100 });
    const node: ASTNode = {
      kind: 'cellRef',
      address: addr(2, 3),
      raw: 'C4',
    };
    expect(evaluator.evaluate(node, ctx)).toBe(100);
  });

  it('returns null for a missing cell', () => {
    const ctx = createMockContext();
    const node: ASTNode = {
      kind: 'cellRef',
      address: addr(0, 0),
      raw: 'A1',
    };
    expect(evaluator.evaluate(node, ctx)).toBeNull();
  });

  it('resolves a string cell value', () => {
    const ctx = createMockContext({ '1,1': 'hello' });
    const node: ASTNode = {
      kind: 'cellRef',
      address: addr(1, 1),
      raw: 'B2',
    };
    expect(evaluator.evaluate(node, ctx)).toBe('hello');
  });
});

// ---------------------------------------------------------------------------
// Range evaluation (standalone  -  returns top-left cell)
// ---------------------------------------------------------------------------

describe('evaluate  -  standalone range', () => {
  it('returns the top-left cell value for a standalone range', () => {
    const ctx = createMockContext({ '0,0': 'top-left', '1,0': 'top-right' });
    const node: ASTNode = {
      kind: 'range',
      start: addr(0, 0),
      end: addr(1, 1),
      raw: 'A1:B2',
    };
    expect(evaluator.evaluate(node, ctx)).toBe('top-left');
  });
});

// ---------------------------------------------------------------------------
// Binary operators  -  arithmetic
// ---------------------------------------------------------------------------

describe('evaluate  -  arithmetic binary operators', () => {
  const ctx = createMockContext();

  function binOp(op: '+' | '-' | '*' | '/' | '^' | '%', left: number, right: number): ASTNode {
    return {
      kind: 'binaryOp',
      op,
      left: { kind: 'number', value: left },
      right: { kind: 'number', value: right },
    };
  }

  it('adds two numbers', () => {
    expect(evaluator.evaluate(binOp('+', 3, 4), ctx)).toBe(7);
  });

  it('subtracts two numbers', () => {
    expect(evaluator.evaluate(binOp('-', 10, 3), ctx)).toBe(7);
  });

  it('multiplies two numbers', () => {
    expect(evaluator.evaluate(binOp('*', 6, 7), ctx)).toBe(42);
  });

  it('divides two numbers', () => {
    expect(evaluator.evaluate(binOp('/', 20, 4), ctx)).toBe(5);
  });

  it('returns #DIV/0! for division by zero', () => {
    const result = evaluator.evaluate(binOp('/', 5, 0), ctx);
    expect(result).toBeInstanceOf(FormulaError);
    expect((result as FormulaError).type).toBe('#DIV/0!');
  });

  it('raises to a power', () => {
    expect(evaluator.evaluate(binOp('^', 2, 10), ctx)).toBe(1024);
  });

  it('computes percentage operator', () => {
    // '%' operator: lNum * rNum / 100
    expect(evaluator.evaluate(binOp('%', 200, 50), ctx)).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// Binary operators  -  string concatenation
// ---------------------------------------------------------------------------

describe('evaluate  -  string concatenation (&)', () => {
  const ctx = createMockContext();

  it('concatenates two strings', () => {
    const node: ASTNode = {
      kind: 'binaryOp',
      op: '&',
      left: { kind: 'string', value: 'Hello' },
      right: { kind: 'string', value: ' World' },
    };
    expect(evaluator.evaluate(node, ctx)).toBe('Hello World');
  });

  it('concatenates a number and a string', () => {
    const node: ASTNode = {
      kind: 'binaryOp',
      op: '&',
      left: { kind: 'number', value: 42 },
      right: { kind: 'string', value: '!' },
    };
    expect(evaluator.evaluate(node, ctx)).toBe('42!');
  });

  it('propagates left-side error in concatenation', () => {
    const err = new FormulaError('#REF!');
    const node: ASTNode = {
      kind: 'binaryOp',
      op: '&',
      left: { kind: 'error', error: err },
      right: { kind: 'string', value: 'x' },
    };
    expect(evaluator.evaluate(node, ctx)).toBe(err);
  });

  it('propagates right-side error in concatenation', () => {
    const err = new FormulaError('#VALUE!');
    const node: ASTNode = {
      kind: 'binaryOp',
      op: '&',
      left: { kind: 'string', value: 'x' },
      right: { kind: 'error', error: err },
    };
    expect(evaluator.evaluate(node, ctx)).toBe(err);
  });
});

// ---------------------------------------------------------------------------
// Binary operators  -  comparisons
// ---------------------------------------------------------------------------

describe('evaluate  -  comparison operators', () => {
  const ctx = createMockContext();

  function cmp(op: '>' | '<' | '>=' | '<=' | '=' | '<>', left: ASTNode, right: ASTNode): ASTNode {
    return { kind: 'binaryOp', op, left, right };
  }

  const num = (v: number): ASTNode => ({ kind: 'number', value: v });
  const str = (v: string): ASTNode => ({ kind: 'string', value: v });
  const bool = (v: boolean): ASTNode => ({ kind: 'boolean', value: v });

  it('greater than with numbers', () => {
    expect(evaluator.evaluate(cmp('>', num(5), num(3)), ctx)).toBe(true);
    expect(evaluator.evaluate(cmp('>', num(3), num(5)), ctx)).toBe(false);
  });

  it('less than with numbers', () => {
    expect(evaluator.evaluate(cmp('<', num(2), num(10)), ctx)).toBe(true);
    expect(evaluator.evaluate(cmp('<', num(10), num(2)), ctx)).toBe(false);
  });

  it('greater than or equal', () => {
    expect(evaluator.evaluate(cmp('>=', num(5), num(5)), ctx)).toBe(true);
    expect(evaluator.evaluate(cmp('>=', num(5), num(6)), ctx)).toBe(false);
  });

  it('less than or equal', () => {
    expect(evaluator.evaluate(cmp('<=', num(5), num(5)), ctx)).toBe(true);
    expect(evaluator.evaluate(cmp('<=', num(6), num(5)), ctx)).toBe(false);
  });

  it('equality with numbers', () => {
    expect(evaluator.evaluate(cmp('=', num(7), num(7)), ctx)).toBe(true);
    expect(evaluator.evaluate(cmp('=', num(7), num(8)), ctx)).toBe(false);
  });

  it('not-equal with numbers', () => {
    expect(evaluator.evaluate(cmp('<>', num(7), num(8)), ctx)).toBe(true);
    expect(evaluator.evaluate(cmp('<>', num(7), num(7)), ctx)).toBe(false);
  });

  it('string comparison is case-insensitive', () => {
    expect(evaluator.evaluate(cmp('=', str('ABC'), str('abc')), ctx)).toBe(true);
    expect(evaluator.evaluate(cmp('<>', str('ABC'), str('abc')), ctx)).toBe(false);
  });

  it('string less-than comparison', () => {
    expect(evaluator.evaluate(cmp('<', str('apple'), str('banana')), ctx)).toBe(true);
    expect(evaluator.evaluate(cmp('<', str('banana'), str('apple')), ctx)).toBe(false);
  });

  it('boolean vs boolean comparison', () => {
    expect(evaluator.evaluate(cmp('=', bool(true), bool(true)), ctx)).toBe(true);
    expect(evaluator.evaluate(cmp('>', bool(true), bool(false)), ctx)).toBe(true);
    expect(evaluator.evaluate(cmp('<', bool(true), bool(false)), ctx)).toBe(false);
  });

  it('propagates left-side error in comparison', () => {
    const err = new FormulaError('#REF!');
    const node = cmp('=', { kind: 'error', error: err }, num(1));
    expect(evaluator.evaluate(node, ctx)).toBe(err);
  });

  it('propagates right-side error in comparison', () => {
    const err = new FormulaError('#VALUE!');
    const node = cmp('>', num(1), { kind: 'error', error: err });
    expect(evaluator.evaluate(node, ctx)).toBe(err);
  });
});

// ---------------------------------------------------------------------------
// Comparison with mixed types
// ---------------------------------------------------------------------------

describe('evaluate  -  mixed-type comparisons', () => {
  const ctx = createMockContext();
  const num = (v: number): ASTNode => ({ kind: 'number', value: v });
  const str = (v: string): ASTNode => ({ kind: 'string', value: v });

  it('compares a number and a numeric string via numeric coercion', () => {
    const node: ASTNode = {
      kind: 'binaryOp',
      op: '=',
      left: num(42),
      right: str('42'),
    };
    expect(evaluator.evaluate(node, ctx)).toBe(true);
  });

  it('falls back to string comparison when number coercion fails', () => {
    const node: ASTNode = {
      kind: 'binaryOp',
      op: '<>',
      left: num(42),
      right: str('abc'),
    };
    // "42" vs "abc" string comparison; they differ, so <> is true
    expect(evaluator.evaluate(node, ctx)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Unary operators
// ---------------------------------------------------------------------------

describe('evaluate  -  unary operators', () => {
  const ctx = createMockContext();

  it('negates a number', () => {
    const node: ASTNode = {
      kind: 'unaryOp',
      op: '-',
      operand: { kind: 'number', value: 5 },
    };
    expect(evaluator.evaluate(node, ctx)).toBe(-5);
  });

  it('applies unary plus (identity)', () => {
    const node: ASTNode = {
      kind: 'unaryOp',
      op: '+',
      operand: { kind: 'number', value: 5 },
    };
    expect(evaluator.evaluate(node, ctx)).toBe(5);
  });

  it('propagates error through unary operator', () => {
    const err = new FormulaError('#VALUE!');
    const node: ASTNode = {
      kind: 'unaryOp',
      op: '-',
      operand: { kind: 'error', error: err },
    };
    expect(evaluator.evaluate(node, ctx)).toBe(err);
  });

  it('returns FormulaError when operand cannot be coerced to number', () => {
    const node: ASTNode = {
      kind: 'unaryOp',
      op: '-',
      operand: { kind: 'string', value: 'abc' },
    };
    const result = evaluator.evaluate(node, ctx);
    expect(result).toBeInstanceOf(FormulaError);
    expect((result as FormulaError).type).toBe('#VALUE!');
  });
});

// ---------------------------------------------------------------------------
// Error propagation through binary arithmetic
// ---------------------------------------------------------------------------

describe('evaluate  -  error propagation in arithmetic', () => {
  const ctx = createMockContext();

  it('propagates left-side error in addition', () => {
    const err = new FormulaError('#REF!');
    const node: ASTNode = {
      kind: 'binaryOp',
      op: '+',
      left: { kind: 'error', error: err },
      right: { kind: 'number', value: 1 },
    };
    expect(evaluator.evaluate(node, ctx)).toBe(err);
  });

  it('propagates right-side error in multiplication', () => {
    const err = new FormulaError('#NAME?');
    const node: ASTNode = {
      kind: 'binaryOp',
      op: '*',
      left: { kind: 'number', value: 2 },
      right: { kind: 'error', error: err },
    };
    expect(evaluator.evaluate(node, ctx)).toBe(err);
  });

  it('returns #VALUE! when arithmetic operand is non-numeric string', () => {
    const node: ASTNode = {
      kind: 'binaryOp',
      op: '+',
      left: { kind: 'string', value: 'abc' },
      right: { kind: 'number', value: 1 },
    };
    const result = evaluator.evaluate(node, ctx);
    expect(result).toBeInstanceOf(FormulaError);
    expect((result as FormulaError).type).toBe('#VALUE!');
  });
});

// ---------------------------------------------------------------------------
// Function calls
// ---------------------------------------------------------------------------

describe('evaluate  -  function calls', () => {
  it('returns #NAME? for unknown function', () => {
    const ctx = createMockContext();
    const node: ASTNode = {
      kind: 'functionCall',
      name: 'NONEXISTENT',
      args: [],
    };
    const result = evaluator.evaluate(node, ctx);
    expect(result).toBeInstanceOf(FormulaError);
    expect((result as FormulaError).type).toBe('#NAME?');
  });

  it('calls a registered function', () => {
    const ev = new FormulaEvaluator(new Map());
    ev.registerFunction('DOUBLE', {
      minArgs: 1,
      maxArgs: 1,
      evaluate: (args, context, evalr) => {
        const val = evalr.evaluate(args[0], context);
        const n = toNumber(val);
        if (n instanceof FormulaError) return n;
        return n * 2;
      },
    });

    const ctx = createMockContext();
    const node: ASTNode = {
      kind: 'functionCall',
      name: 'DOUBLE',
      args: [{ kind: 'number', value: 21 }],
    };
    expect(ev.evaluate(node, ctx)).toBe(42);
  });

  it('returns #ERROR! when too few arguments', () => {
    const ev = new FormulaEvaluator(new Map());
    ev.registerFunction('NEEDSTWO', {
      minArgs: 2,
      maxArgs: 2,
      evaluate: () => 0,
    });

    const ctx = createMockContext();
    const node: ASTNode = {
      kind: 'functionCall',
      name: 'NEEDSTWO',
      args: [{ kind: 'number', value: 1 }],
    };
    const result = ev.evaluate(node, ctx);
    expect(result).toBeInstanceOf(FormulaError);
    expect((result as FormulaError).type).toBe('#ERROR!');
  });

  it('returns #ERROR! when too many arguments', () => {
    const ev = new FormulaEvaluator(new Map());
    ev.registerFunction('ONETWO', {
      minArgs: 1,
      maxArgs: 2,
      evaluate: () => 0,
    });

    const ctx = createMockContext();
    const node: ASTNode = {
      kind: 'functionCall',
      name: 'ONETWO',
      args: [
        { kind: 'number', value: 1 },
        { kind: 'number', value: 2 },
        { kind: 'number', value: 3 },
      ],
    };
    const result = ev.evaluate(node, ctx);
    expect(result).toBeInstanceOf(FormulaError);
    expect((result as FormulaError).type).toBe('#ERROR!');
  });

  it('function name lookup is case-insensitive', () => {
    const ev = new FormulaEvaluator(new Map());
    ev.registerFunction('MyFunc', {
      minArgs: 0,
      maxArgs: 0,
      evaluate: () => 'works',
    });

    const ctx = createMockContext();
    const node: ASTNode = {
      kind: 'functionCall',
      name: 'MYFUNC',
      args: [],
    };
    expect(ev.evaluate(node, ctx)).toBe('works');
  });
});

// ---------------------------------------------------------------------------
// flattenArgs
// ---------------------------------------------------------------------------

describe('flattenArgs', () => {
  it('evaluates simple argument nodes', () => {
    const ctx = createMockContext();
    const args: ASTNode[] = [
      { kind: 'number', value: 1 },
      { kind: 'string', value: 'x' },
    ];
    expect(flattenArgs(args, ctx, evaluator)).toEqual([1, 'x']);
  });

  it('flattens a range into individual values', () => {
    const ctx = createMockContext({
      '0,0': 10,
      '1,0': 20,
      '0,1': 30,
      '1,1': 40,
    });
    const args: ASTNode[] = [
      {
        kind: 'range',
        start: addr(0, 0),
        end: addr(1, 1),
        raw: 'A1:B2',
      },
    ];
    expect(flattenArgs(args, ctx, evaluator)).toEqual([10, 20, 30, 40]);
  });

  it('mixes range and non-range arguments', () => {
    const ctx = createMockContext({
      '0,0': 5,
      '1,0': 6,
    });
    const args: ASTNode[] = [
      { kind: 'number', value: 1 },
      {
        kind: 'range',
        start: addr(0, 0),
        end: addr(1, 0),
        raw: 'A1:B1',
      },
      { kind: 'number', value: 99 },
    ];
    expect(flattenArgs(args, ctx, evaluator)).toEqual([1, 5, 6, 99]);
  });

  it('returns null for empty cells in a range', () => {
    const ctx = createMockContext({ '0,0': 10 });
    const args: ASTNode[] = [
      {
        kind: 'range',
        start: addr(0, 0),
        end: addr(1, 0),
        raw: 'A1:B1',
      },
    ];
    expect(flattenArgs(args, ctx, evaluator)).toEqual([10, null]);
  });
});

// ---------------------------------------------------------------------------
// Arithmetic with cell references
// ---------------------------------------------------------------------------

describe('evaluate  -  arithmetic with cell references', () => {
  it('adds two cell values', () => {
    const ctx = createMockContext({ '0,0': 10, '1,0': 20 });
    const node: ASTNode = {
      kind: 'binaryOp',
      op: '+',
      left: { kind: 'cellRef', address: addr(0, 0), raw: 'A1' },
      right: { kind: 'cellRef', address: addr(1, 0), raw: 'B1' },
    };
    expect(evaluator.evaluate(node, ctx)).toBe(30);
  });

  it('treats null cell as 0 in arithmetic', () => {
    const ctx = createMockContext({ '0,0': 5 });
    const node: ASTNode = {
      kind: 'binaryOp',
      op: '+',
      left: { kind: 'cellRef', address: addr(0, 0), raw: 'A1' },
      right: { kind: 'cellRef', address: addr(1, 0), raw: 'B1' },
    };
    expect(evaluator.evaluate(node, ctx)).toBe(5);
  });
});
