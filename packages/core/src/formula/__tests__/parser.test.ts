import { tokenize } from '../tokenizer';
import { parse } from '../parser';
import { FormulaError } from '../types';
import type {
  ASTNode,
  BinaryOpNode,
  UnaryOpNode,
  FunctionCallNode,
  CellRefNode,
  RangeNode,
  NumberLiteral,
  StringLiteral,
  BooleanLiteral,
  ErrorNode,
} from '../types';

/** Helper: tokenize then parse in one step */
function parseFormula(input: string): ASTNode {
  return parse(tokenize(input));
}

describe('parser', () => {
  // ── Number literals ──────────────────────────────────────────────────

  describe('number literals', () => {
    it('parses an integer', () => {
      const ast = parseFormula('42');
      expect(ast.kind).toBe('number');
      expect((ast as NumberLiteral).value).toBe(42);
    });

    it('parses a decimal number', () => {
      const ast = parseFormula('3.14');
      expect(ast.kind).toBe('number');
      expect((ast as NumberLiteral).value).toBeCloseTo(3.14);
    });

    it('parses a leading-dot decimal (.5)', () => {
      const ast = parseFormula('.5');
      expect(ast.kind).toBe('number');
      expect((ast as NumberLiteral).value).toBe(0.5);
    });

    it('parses zero', () => {
      const ast = parseFormula('0');
      expect(ast.kind).toBe('number');
      expect((ast as NumberLiteral).value).toBe(0);
    });
  });

  // ── String literals ──────────────────────────────────────────────────

  describe('string literals', () => {
    it('parses a simple string', () => {
      const ast = parseFormula('"hello"');
      expect(ast.kind).toBe('string');
      expect((ast as StringLiteral).value).toBe('hello');
    });

    it('parses an empty string', () => {
      const ast = parseFormula('""');
      expect(ast.kind).toBe('string');
      expect((ast as StringLiteral).value).toBe('');
    });

    it('parses a string with escaped quotes', () => {
      const ast = parseFormula('"say ""hi"""');
      expect(ast.kind).toBe('string');
      expect((ast as StringLiteral).value).toBe('say "hi"');
    });
  });

  // ── Boolean literals ─────────────────────────────────────────────────

  describe('boolean literals', () => {
    it('parses TRUE as boolean true', () => {
      const ast = parseFormula('TRUE');
      expect(ast.kind).toBe('boolean');
      expect((ast as BooleanLiteral).value).toBe(true);
    });

    it('parses FALSE as boolean false', () => {
      const ast = parseFormula('FALSE');
      expect(ast.kind).toBe('boolean');
      expect((ast as BooleanLiteral).value).toBe(false);
    });

    it('parses lowercase true as boolean true', () => {
      const ast = parseFormula('true');
      expect(ast.kind).toBe('boolean');
      expect((ast as BooleanLiteral).value).toBe(true);
    });

    it('parses lowercase false as boolean false', () => {
      const ast = parseFormula('false');
      expect(ast.kind).toBe('boolean');
      expect((ast as BooleanLiteral).value).toBe(false);
    });
  });

  // ── Cell references ──────────────────────────────────────────────────

  describe('cell references', () => {
    it('parses a simple cell reference (A1) to CellRefNode', () => {
      const ast = parseFormula('A1');
      expect(ast.kind).toBe('cellRef');
      const ref = ast as CellRefNode;
      expect(ref.address.col).toBe(0); // A = 0
      expect(ref.address.row).toBe(0); // 1  to  0 (0-based)
      expect(ref.address.absCol).toBe(false);
      expect(ref.address.absRow).toBe(false);
      expect(ref.raw).toBe('A1');
    });

    it('parses an absolute cell reference ($A$1)', () => {
      const ast = parseFormula('$A$1');
      expect(ast.kind).toBe('cellRef');
      const ref = ast as CellRefNode;
      expect(ref.address.absCol).toBe(true);
      expect(ref.address.absRow).toBe(true);
      expect(ref.address.col).toBe(0);
      expect(ref.address.row).toBe(0);
    });

    it('parses a mixed reference ($A1) with absolute column', () => {
      const ast = parseFormula('$A1');
      expect(ast.kind).toBe('cellRef');
      const ref = ast as CellRefNode;
      expect(ref.address.absCol).toBe(true);
      expect(ref.address.absRow).toBe(false);
    });

    it('parses a mixed reference (A$1) with absolute row', () => {
      const ast = parseFormula('A$1');
      expect(ast.kind).toBe('cellRef');
      const ref = ast as CellRefNode;
      expect(ref.address.absCol).toBe(false);
      expect(ref.address.absRow).toBe(true);
    });

    it('parses a double-letter column reference (B10)', () => {
      const ast = parseFormula('B10');
      expect(ast.kind).toBe('cellRef');
      const ref = ast as CellRefNode;
      expect(ref.address.col).toBe(1); // B = 1
      expect(ref.address.row).toBe(9); // 10  to  9 (0-based)
    });

    it('parses Z26 correctly', () => {
      const ast = parseFormula('Z26');
      expect(ast.kind).toBe('cellRef');
      const ref = ast as CellRefNode;
      expect(ref.address.col).toBe(25); // Z = 25
      expect(ref.address.row).toBe(25); // 26  to  25 (0-based)
    });
  });

  // ── Ranges ───────────────────────────────────────────────────────────

  describe('ranges', () => {
    it('parses a range (A1:B10) to RangeNode', () => {
      const ast = parseFormula('A1:B10');
      expect(ast.kind).toBe('range');
      const range = ast as RangeNode;
      expect(range.start.col).toBe(0);
      expect(range.start.row).toBe(0);
      expect(range.end.col).toBe(1);
      expect(range.end.row).toBe(9);
      expect(range.raw).toBe('A1:B10');
    });

    it('parses a single-column range (A1:A100)', () => {
      const ast = parseFormula('A1:A100');
      expect(ast.kind).toBe('range');
      const range = ast as RangeNode;
      expect(range.start.col).toBe(0);
      expect(range.start.row).toBe(0);
      expect(range.end.col).toBe(0);
      expect(range.end.row).toBe(99);
    });

    it('parses a range with absolute references ($A$1:$B$10)', () => {
      const ast = parseFormula('$A$1:$B$10');
      expect(ast.kind).toBe('range');
      const range = ast as RangeNode;
      expect(range.start.absCol).toBe(true);
      expect(range.start.absRow).toBe(true);
      expect(range.end.absCol).toBe(true);
      expect(range.end.absRow).toBe(true);
    });
  });

  // ── Function calls ───────────────────────────────────────────────────

  describe('function calls', () => {
    it('parses a function with no arguments', () => {
      const ast = parseFormula('NOW()');
      expect(ast.kind).toBe('functionCall');
      const fn = ast as FunctionCallNode;
      expect(fn.name).toBe('NOW');
      expect(fn.args).toHaveLength(0);
    });

    it('parses a function with a single argument', () => {
      const ast = parseFormula('ABS(5)');
      expect(ast.kind).toBe('functionCall');
      const fn = ast as FunctionCallNode;
      expect(fn.name).toBe('ABS');
      expect(fn.args).toHaveLength(1);
      expect(fn.args[0].kind).toBe('number');
    });

    it('parses a function with multiple arguments', () => {
      const ast = parseFormula('IF(A1>0,1,0)');
      expect(ast.kind).toBe('functionCall');
      const fn = ast as FunctionCallNode;
      expect(fn.name).toBe('IF');
      expect(fn.args).toHaveLength(3);
    });

    it('parses nested function calls', () => {
      const ast = parseFormula('MAX(SUM(1,2),3)');
      expect(ast.kind).toBe('functionCall');
      const fn = ast as FunctionCallNode;
      expect(fn.name).toBe('MAX');
      expect(fn.args).toHaveLength(2);
      expect(fn.args[0].kind).toBe('functionCall');
      expect((fn.args[0] as FunctionCallNode).name).toBe('SUM');
    });

    it('parses a function with a range argument', () => {
      const ast = parseFormula('SUM(A1:B10)');
      expect(ast.kind).toBe('functionCall');
      const fn = ast as FunctionCallNode;
      expect(fn.name).toBe('SUM');
      expect(fn.args).toHaveLength(1);
      expect(fn.args[0].kind).toBe('range');
    });

    it('parses deeply nested functions', () => {
      const ast = parseFormula('IF(AND(A1>0,B1>0),SUM(A1,B1),0)');
      expect(ast.kind).toBe('functionCall');
      const fn = ast as FunctionCallNode;
      expect(fn.name).toBe('IF');
      expect(fn.args).toHaveLength(3);
      expect(fn.args[0].kind).toBe('functionCall');
      expect((fn.args[0] as FunctionCallNode).name).toBe('AND');
    });
  });

  // ── Binary operators: arithmetic ─────────────────────────────────────

  describe('binary operators: arithmetic', () => {
    it('parses addition (1+2)', () => {
      const ast = parseFormula('1+2');
      expect(ast.kind).toBe('binaryOp');
      const bin = ast as BinaryOpNode;
      expect(bin.op).toBe('+');
      expect(bin.left.kind).toBe('number');
      expect(bin.right.kind).toBe('number');
      expect((bin.left as NumberLiteral).value).toBe(1);
      expect((bin.right as NumberLiteral).value).toBe(2);
    });

    it('parses subtraction (10-3)', () => {
      const ast = parseFormula('10-3');
      expect(ast.kind).toBe('binaryOp');
      expect((ast as BinaryOpNode).op).toBe('-');
    });

    it('parses multiplication (4*5)', () => {
      const ast = parseFormula('4*5');
      expect(ast.kind).toBe('binaryOp');
      expect((ast as BinaryOpNode).op).toBe('*');
    });

    it('parses division (10/2)', () => {
      const ast = parseFormula('10/2');
      expect(ast.kind).toBe('binaryOp');
      expect((ast as BinaryOpNode).op).toBe('/');
    });
  });

  // ── Binary operators: power ──────────────────────────────────────────

  describe('binary operators: power', () => {
    it('parses power (2^3)', () => {
      const ast = parseFormula('2^3');
      expect(ast.kind).toBe('binaryOp');
      const bin = ast as BinaryOpNode;
      expect(bin.op).toBe('^');
      expect((bin.left as NumberLiteral).value).toBe(2);
      expect((bin.right as NumberLiteral).value).toBe(3);
    });
  });

  // ── Binary operators: comparison ─────────────────────────────────────

  describe('binary operators: comparison', () => {
    it('parses greater-than (A1>0)', () => {
      const ast = parseFormula('A1>0');
      expect(ast.kind).toBe('binaryOp');
      expect((ast as BinaryOpNode).op).toBe('>');
    });

    it('parses less-than (A1<10)', () => {
      const ast = parseFormula('A1<10');
      expect(ast.kind).toBe('binaryOp');
      expect((ast as BinaryOpNode).op).toBe('<');
    });

    it('parses greater-than-or-equal (A1>=5)', () => {
      const ast = parseFormula('A1>=5');
      expect(ast.kind).toBe('binaryOp');
      expect((ast as BinaryOpNode).op).toBe('>=');
    });

    it('parses less-than-or-equal (A1<=5)', () => {
      const ast = parseFormula('A1<=5');
      expect(ast.kind).toBe('binaryOp');
      expect((ast as BinaryOpNode).op).toBe('<=');
    });

    it('parses equals (A1=B1)', () => {
      const ast = parseFormula('A1=B1');
      expect(ast.kind).toBe('binaryOp');
      expect((ast as BinaryOpNode).op).toBe('=');
    });

    it('parses not-equal (A1<>B1)', () => {
      const ast = parseFormula('A1<>B1');
      expect(ast.kind).toBe('binaryOp');
      expect((ast as BinaryOpNode).op).toBe('<>');
    });
  });

  // ── Binary operators: string concatenation ───────────────────────────

  describe('binary operators: string concatenation', () => {
    it('parses string concatenation ("a"&"b")', () => {
      const ast = parseFormula('"a"&"b"');
      expect(ast.kind).toBe('binaryOp');
      const bin = ast as BinaryOpNode;
      expect(bin.op).toBe('&');
      expect(bin.left.kind).toBe('string');
      expect(bin.right.kind).toBe('string');
    });
  });

  // ── Unary operators ──────────────────────────────────────────────────

  describe('unary operators', () => {
    it('parses unary minus (-5)', () => {
      const ast = parseFormula('-5');
      expect(ast.kind).toBe('unaryOp');
      const un = ast as UnaryOpNode;
      expect(un.op).toBe('-');
      expect(un.operand.kind).toBe('number');
      expect((un.operand as NumberLiteral).value).toBe(5);
    });

    it('parses unary plus (+5)', () => {
      const ast = parseFormula('+5');
      expect(ast.kind).toBe('unaryOp');
      const un = ast as UnaryOpNode;
      expect(un.op).toBe('+');
      expect(un.operand.kind).toBe('number');
    });

    it('parses double unary minus (--5)', () => {
      const ast = parseFormula('--5');
      expect(ast.kind).toBe('unaryOp');
      const outer = ast as UnaryOpNode;
      expect(outer.op).toBe('-');
      expect(outer.operand.kind).toBe('unaryOp');
      const inner = outer.operand as UnaryOpNode;
      expect(inner.op).toBe('-');
      expect(inner.operand.kind).toBe('number');
    });
  });

  // ── Postfix percent ──────────────────────────────────────────────────

  describe('postfix percent', () => {
    it('parses 50% as binaryOp with % operator', () => {
      const ast = parseFormula('50%');
      expect(ast.kind).toBe('binaryOp');
      const bin = ast as BinaryOpNode;
      expect(bin.op).toBe('%');
      expect(bin.left.kind).toBe('number');
      expect((bin.left as NumberLiteral).value).toBe(50);
      expect(bin.right.kind).toBe('number');
      expect((bin.right as NumberLiteral).value).toBe(100);
    });
  });

  // ── Parenthesized expressions ────────────────────────────────────────

  describe('parenthesized expressions', () => {
    it('parses a parenthesized number', () => {
      const ast = parseFormula('(42)');
      expect(ast.kind).toBe('number');
      expect((ast as NumberLiteral).value).toBe(42);
    });

    it('parses a parenthesized addition', () => {
      const ast = parseFormula('(1+2)');
      expect(ast.kind).toBe('binaryOp');
      const bin = ast as BinaryOpNode;
      expect(bin.op).toBe('+');
    });

    it('parses nested parentheses', () => {
      const ast = parseFormula('((3))');
      expect(ast.kind).toBe('number');
      expect((ast as NumberLiteral).value).toBe(3);
    });
  });

  // ── Operator precedence ──────────────────────────────────────────────

  describe('operator precedence', () => {
    it('multiplication binds tighter than addition: 1+2*3', () => {
      // Should parse as: 1 + (2 * 3), not (1 + 2) * 3
      const ast = parseFormula('1+2*3');
      expect(ast.kind).toBe('binaryOp');
      const add = ast as BinaryOpNode;
      expect(add.op).toBe('+');
      expect((add.left as NumberLiteral).value).toBe(1);
      expect(add.right.kind).toBe('binaryOp');
      const mul = add.right as BinaryOpNode;
      expect(mul.op).toBe('*');
      expect((mul.left as NumberLiteral).value).toBe(2);
      expect((mul.right as NumberLiteral).value).toBe(3);
    });

    it('power binds tighter than multiplication: 2*3^4', () => {
      // Should parse as: 2 * (3 ^ 4)
      const ast = parseFormula('2*3^4');
      expect(ast.kind).toBe('binaryOp');
      const mul = ast as BinaryOpNode;
      expect(mul.op).toBe('*');
      expect(mul.right.kind).toBe('binaryOp');
      expect((mul.right as BinaryOpNode).op).toBe('^');
    });

    it('parentheses override precedence: (1+2)*3', () => {
      const ast = parseFormula('(1+2)*3');
      expect(ast.kind).toBe('binaryOp');
      const mul = ast as BinaryOpNode;
      expect(mul.op).toBe('*');
      expect(mul.left.kind).toBe('binaryOp');
      expect((mul.left as BinaryOpNode).op).toBe('+');
    });

    it('comparison has lowest precedence: 1+2>3-1', () => {
      // Should parse as: (1+2) > (3-1)
      const ast = parseFormula('1+2>3-1');
      expect(ast.kind).toBe('binaryOp');
      const cmp = ast as BinaryOpNode;
      expect(cmp.op).toBe('>');
      expect(cmp.left.kind).toBe('binaryOp');
      expect((cmp.left as BinaryOpNode).op).toBe('+');
      expect(cmp.right.kind).toBe('binaryOp');
      expect((cmp.right as BinaryOpNode).op).toBe('-');
    });

    it('concatenation sits between addition and comparison: "a"&"b"="ab"', () => {
      // Should parse as: ("a" & "b") = "ab"
      const ast = parseFormula('"a"&"b"="ab"');
      expect(ast.kind).toBe('binaryOp');
      const eq = ast as BinaryOpNode;
      expect(eq.op).toBe('=');
      expect(eq.left.kind).toBe('binaryOp');
      expect((eq.left as BinaryOpNode).op).toBe('&');
    });

    it('unary minus binds tighter than addition: -1+2', () => {
      // Should parse as: (-1) + 2
      const ast = parseFormula('-1+2');
      expect(ast.kind).toBe('binaryOp');
      const add = ast as BinaryOpNode;
      expect(add.op).toBe('+');
      expect(add.left.kind).toBe('unaryOp');
      expect((add.left as UnaryOpNode).op).toBe('-');
    });
  });

  // ── Nested expressions ───────────────────────────────────────────────

  describe('nested expressions', () => {
    it('parses SUM(A1:A10)+IF(B1>0,B1,0)', () => {
      const ast = parseFormula('SUM(A1:A10)+IF(B1>0,B1,0)');
      expect(ast.kind).toBe('binaryOp');
      const add = ast as BinaryOpNode;
      expect(add.op).toBe('+');

      // Left: SUM(A1:A10)
      expect(add.left.kind).toBe('functionCall');
      const sum = add.left as FunctionCallNode;
      expect(sum.name).toBe('SUM');
      expect(sum.args).toHaveLength(1);
      expect(sum.args[0].kind).toBe('range');

      // Right: IF(B1>0,B1,0)
      expect(add.right.kind).toBe('functionCall');
      const ifFn = add.right as FunctionCallNode;
      expect(ifFn.name).toBe('IF');
      expect(ifFn.args).toHaveLength(3);
      expect(ifFn.args[0].kind).toBe('binaryOp');
      expect((ifFn.args[0] as BinaryOpNode).op).toBe('>');
    });

    it('parses a complex arithmetic expression: (A1+B1)*2/C1', () => {
      const ast = parseFormula('(A1+B1)*2/C1');
      // Top-level should be division: ((A1+B1)*2) / C1
      // Actually: multiplication and division are left-assoc same precedence
      // So: ((A1+B1) * 2) / C1
      expect(ast.kind).toBe('binaryOp');
      const div = ast as BinaryOpNode;
      expect(div.op).toBe('/');
      expect(div.left.kind).toBe('binaryOp');
      expect((div.left as BinaryOpNode).op).toBe('*');
    });

    it('parses chained additions left-associatively: 1+2+3', () => {
      // Should parse as: (1+2)+3
      const ast = parseFormula('1+2+3');
      expect(ast.kind).toBe('binaryOp');
      const outer = ast as BinaryOpNode;
      expect(outer.op).toBe('+');
      expect((outer.right as NumberLiteral).value).toBe(3);
      expect(outer.left.kind).toBe('binaryOp');
      const inner = outer.left as BinaryOpNode;
      expect(inner.op).toBe('+');
      expect((inner.left as NumberLiteral).value).toBe(1);
      expect((inner.right as NumberLiteral).value).toBe(2);
    });
  });

  // ── Error handling ───────────────────────────────────────────────────

  describe('error handling', () => {
    it('returns ErrorNode for unexpected end of expression (empty input)', () => {
      const ast = parseFormula('');
      expect(ast.kind).toBe('error');
      const err = ast as ErrorNode;
      expect(err.error).toBeInstanceOf(FormulaError);
      expect(err.error.message).toContain('Unexpected end');
    });

    it('returns ErrorNode for missing closing parenthesis', () => {
      const ast = parseFormula('(1+2');
      expect(ast.kind).toBe('error');
      const err = ast as ErrorNode;
      expect(err.error.message).toContain('closing parenthesis');
    });

    it('returns ErrorNode for unexpected token after expression', () => {
      const ast = parseFormula('1 2');
      expect(ast.kind).toBe('error');
      const err = ast as ErrorNode;
      expect(err.error.message).toContain('Unexpected token after expression');
    });

    it('returns ErrorNode for missing closing paren in function call', () => {
      const ast = parseFormula('SUM(1,2');
      expect(ast.kind).toBe('error');
      const err = ast as ErrorNode;
      expect(err.error.message).toContain(')');
    });

    it('returns ErrorNode when colon is not followed by a cell ref', () => {
      // A1: followed by a non-cell-ref token. The parser returns
      // an error for the unconsumed "5" token after the partial expression.
      const ast = parseFormula('A1:5');
      expect(ast.kind).toBe('error');
      const err = ast as ErrorNode;
      expect(err.error).toBeInstanceOf(FormulaError);
    });

    it('returns ErrorNode for an unexpected token like )', () => {
      const ast = parseFormula(')');
      expect(ast.kind).toBe('error');
    });
  });

  // ── Range in function ────────────────────────────────────────────────

  describe('range in function', () => {
    it('parses SUM(A1:B10) with range as single argument', () => {
      const ast = parseFormula('SUM(A1:B10)');
      expect(ast.kind).toBe('functionCall');
      const fn = ast as FunctionCallNode;
      expect(fn.name).toBe('SUM');
      expect(fn.args).toHaveLength(1);
      const range = fn.args[0] as RangeNode;
      expect(range.kind).toBe('range');
      expect(range.start.col).toBe(0); // A
      expect(range.start.row).toBe(0); // 1
      expect(range.end.col).toBe(1);   // B
      expect(range.end.row).toBe(9);   // 10
    });

    it('parses SUMPRODUCT with multiple range arguments', () => {
      const ast = parseFormula('SUMPRODUCT(A1:A10,B1:B10)');
      expect(ast.kind).toBe('functionCall');
      const fn = ast as FunctionCallNode;
      expect(fn.args).toHaveLength(2);
      expect(fn.args[0].kind).toBe('range');
      expect(fn.args[1].kind).toBe('range');
    });
  });
});
