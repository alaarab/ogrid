/**
 * Formula evaluator  -  walks an AST and computes the result.
 */

import type {
  ASTNode,
  IFormulaContext,
  IEvaluator,
  IFormulaFunction,
  BinaryOp,
} from './types';
import { FormulaError } from './types';

/** Coerce a value to number following Excel semantics. */
export function toNumber(val: unknown): number | FormulaError {
  if (val instanceof FormulaError) return val;
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'boolean') return val ? 1 : 0;
  if (typeof val === 'number') return val;
  if (val instanceof Date) return val.getTime();
  const n = Number(val);
  if (Number.isNaN(n)) return new FormulaError('#VALUE!', `Cannot convert "${val}" to number`);
  return n;
}

/** Coerce a value to string. */
export function toString(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (val instanceof FormulaError) return val.toString();
  if (val instanceof Date) return val.toLocaleDateString();
  return String(val);
}

/** Coerce a value to boolean following Excel semantics. */
export function toBoolean(val: unknown): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  if (typeof val === 'string') {
    if (val.toUpperCase() === 'TRUE') return true;
    if (val.toUpperCase() === 'FALSE') return false;
    return val.length > 0;
  }
  return val !== null && val !== undefined;
}

/** Evaluate each arg, expanding ranges into flat arrays. */
export function flattenArgs(
  args: ASTNode[],
  context: IFormulaContext,
  evaluator: IEvaluator
): unknown[] {
  const result: unknown[] = [];
  for (const arg of args) {
    if (arg.kind === 'range') {
      const values = context.getRangeValues({ start: arg.start, end: arg.end });
      for (const row of values) {
        for (const val of row) {
          result.push(val);
        }
      }
    } else {
      result.push(evaluator.evaluate(arg, context));
    }
  }
  return result;
}

/**
 * Evaluate an argument AST node that may be absent under noUncheckedIndexedAccess.
 * The evaluator enforces minArgs before invoking a function, so a missing required
 * argument is unreachable at runtime; this returns a FormulaError for type safety
 * (callers already propagate FormulaError results).
 */
export function evalArg(
  evaluator: IEvaluator,
  node: ASTNode | undefined,
  context: IFormulaContext
): unknown {
  if (node === undefined) return new FormulaError('#ERROR!', 'Missing argument');
  return evaluator.evaluate(node, context);
}

export class FormulaEvaluator implements IEvaluator {
  private functions: Map<string, IFormulaFunction>;

  constructor(builtInFunctions: Map<string, IFormulaFunction>) {
    this.functions = new Map(builtInFunctions);
  }

  registerFunction(name: string, fn: IFormulaFunction): void {
    this.functions.set(name.toUpperCase(), fn);
  }

  evaluate(node: ASTNode, context: IFormulaContext): unknown {
    switch (node.kind) {
      case 'number':
        return node.value;
      case 'string':
        return node.value;
      case 'boolean':
        return node.value;
      case 'error':
        return node.error;

      case 'cellRef': {
        const val = context.getCellValue(node.address);
        return val;
      }

      case 'range':
        // Standalone range reference outside a function  -  evaluate as the top-left cell
        return context.getCellValue(node.start);

      case 'functionCall':
        return this.evaluateFunction(node.name, node.args, context);

      case 'binaryOp':
        return this.evaluateBinaryOp(node.op, node.left, node.right, context);

      case 'unaryOp':
        return this.evaluateUnaryOp(node.op, node.operand, context);
    }
  }

  private evaluateFunction(
    name: string,
    args: ASTNode[],
    context: IFormulaContext
  ): unknown {
    // Function names are already uppercased at parse time (tokenizer preserves source case,
    // but the parser stores them uppercase via FunctionCallNode). For safety, uppercase here
    // but cache the result to avoid repeated allocations.
    const fn = this.functions.get(name);
    if (!fn) {
      return new FormulaError('#NAME?', `Unknown function: ${name}`);
    }

    if (args.length < fn.minArgs) {
      return new FormulaError('#ERROR!', `${name} requires at least ${fn.minArgs} argument(s)`);
    }
    if (fn.maxArgs >= 0 && args.length > fn.maxArgs) {
      return new FormulaError('#ERROR!', `${name} accepts at most ${fn.maxArgs} argument(s)`);
    }

    return fn.evaluate(args, context, this);
  }

  private evaluateBinaryOp(
    op: BinaryOp,
    left: ASTNode,
    right: ASTNode,
    context: IFormulaContext
  ): unknown {
    // String concatenation
    if (op === '&') {
      const l = this.evaluate(left, context);
      if (l instanceof FormulaError) return l;
      const r = this.evaluate(right, context);
      if (r instanceof FormulaError) return r;
      return toString(l) + toString(r);
    }

    // Comparison operators
    if (op === '>' || op === '<' || op === '>=' || op === '<=' || op === '=' || op === '<>') {
      const l = this.evaluate(left, context);
      if (l instanceof FormulaError) return l;
      const r = this.evaluate(right, context);
      if (r instanceof FormulaError) return r;
      return this.compare(op, l, r);
    }

    // Arithmetic operators
    const lVal = this.evaluate(left, context);
    if (lVal instanceof FormulaError) return lVal;
    const rVal = this.evaluate(right, context);
    if (rVal instanceof FormulaError) return rVal;

    const lNum = toNumber(lVal);
    if (lNum instanceof FormulaError) return lNum;
    const rNum = toNumber(rVal);
    if (rNum instanceof FormulaError) return rNum;

    switch (op) {
      case '+': return lNum + rNum;
      case '-': return lNum - rNum;
      case '*': return lNum * rNum;
      case '/':
        if (rNum === 0) return new FormulaError('#DIV/0!');
        return lNum / rNum;
      case '^': return lNum ** rNum;
      case '%': return lNum * rNum / 100;
      default:
        return new FormulaError('#ERROR!', `Unknown operator: ${op}`);
    }
  }

  private evaluateUnaryOp(
    op: '+' | '-',
    operand: ASTNode,
    context: IFormulaContext
  ): unknown {
    const val = this.evaluate(operand, context);
    if (val instanceof FormulaError) return val;
    const num = toNumber(val);
    if (num instanceof FormulaError) return num;
    return op === '-' ? -num : num;
  }

  private compare(op: BinaryOp, left: unknown, right: unknown): boolean {
    // Excel comparison: same-type comparisons are straightforward.
    // Mixed types: numbers < strings < booleans in Excel, but we simplify
    // by coercing both to numbers if possible, otherwise string comparison.
    if (typeof left === 'number' && typeof right === 'number') {
      return this.numCompare(op, left, right);
    }
    if (typeof left === 'string' && typeof right === 'string') {
      return this.strCompare(op, left, right);
    }
    if (typeof left === 'boolean' && typeof right === 'boolean') {
      return this.numCompare(op, left ? 1 : 0, right ? 1 : 0);
    }

    // Try numeric comparison for mixed types
    const lNum = toNumber(left);
    const rNum = toNumber(right);
    if (typeof lNum === 'number' && typeof rNum === 'number') {
      return this.numCompare(op, lNum, rNum);
    }

    // Fall back to string comparison
    return this.strCompare(op, toString(left), toString(right));
  }

  private numCompare(op: BinaryOp, a: number, b: number): boolean {
    switch (op) {
      case '>': return a > b;
      case '<': return a < b;
      case '>=': return a >= b;
      case '<=': return a <= b;
      case '=': return a === b;
      case '<>': return a !== b;
      default: return false;
    }
  }

  private strCompare(op: BinaryOp, a: string, b: string): boolean {
    const al = a.toLowerCase();
    const bl = b.toLowerCase();
    switch (op) {
      case '>': return al > bl;
      case '<': return al < bl;
      case '>=': return al >= bl;
      case '<=': return al <= bl;
      case '=': return al === bl;
      case '<>': return al !== bl;
      default: return false;
    }
  }
}
