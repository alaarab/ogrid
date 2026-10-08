/**
 * Formula evaluator  -  walks an AST and computes the result.
 */

import type {
  ASTNode,
  IFormulaContext,
  IEvaluator,
  IFormulaFunction,
  IFormulaLimits,
  BinaryOp,
} from './types';
import { FormulaError } from './types';
import { asArray, mapArrays } from './arrays';
import { dateToSerial } from './functions/date/shared';
import { MAX_FORMULA_DEPTH, MAX_FORMULA_STEPS, MAX_RANGE_CELLS, MAX_TEXT_LENGTH } from './limits';

/** Coerce a value to number following Excel semantics. */
export function toNumber(val: unknown): number | FormulaError {
  if (Array.isArray(val)) val = val[0]?.[0];
  if (val instanceof FormulaError) return val;
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'boolean') return val ? 1 : 0;
  if (typeof val === 'number') return Number.isFinite(val) ? val : new FormulaError('#NUM!', 'Non-finite number');
  if (val instanceof Date) return dateToSerial(val);
  // Only plain decimal text converts. Number() alone would also accept
  // whitespace (" " -> 0), hex ("0x10") and "Infinity", which Excel rejects.
  const text = String(val).trim();
  if (text.length > MAX_TEXT_LENGTH || !NUMERIC_TEXT_RE.test(text)) {
    return new FormulaError('#VALUE!', 'Cannot convert text to number');
  }
  const number = Number(text);
  return Number.isFinite(number) ? number : new FormulaError('#NUM!', 'Non-finite number');
}

const NUMERIC_TEXT_RE = /^[+-]?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i;

/** Coerce a value to string. */
export function toText(val: unknown): string {
  if (Array.isArray(val)) val = val[0]?.[0];
  if (val === null || val === undefined) return '';
  if (val instanceof FormulaError) return val.toString();
  if (val instanceof Date) return toText(dateToSerial(val));
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number' && Number.isFinite(val)) return String(Number(val.toPrecision(15)));
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

/** Strict coercion for logical formula functions; keep the public toBoolean helper compatible. */
export function logicalValue(val: unknown): boolean | FormulaError {
  if (val instanceof FormulaError) return val;
  if (val === null || val === undefined) return false;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  if (typeof val === 'string' && /^(TRUE|FALSE)$/i.test(val)) return val.toUpperCase() === 'TRUE';
  return new FormulaError('#VALUE!', 'Invalid logical value');
}

export function compareValues(left: unknown, right: unknown): number {
  if (Array.isArray(left)) left = left[0]?.[0];
  if (Array.isArray(right)) right = right[0]?.[0];
  if (left instanceof Date) left = dateToSerial(left);
  if (right instanceof Date) right = dateToSerial(right);
  const blank = (value: unknown) => value === null || value === undefined;
  const empty = (value: unknown) => typeof value === 'string' ? '' : typeof value === 'boolean' ? false : 0;
  if (blank(left)) left = empty(right);
  if (blank(right)) right = empty(left);
  const rank = (value: unknown) => typeof value === 'number' ? 0 : typeof value === 'string' ? 1 : 2;
  if (typeof left !== typeof right) return rank(left) - rank(right);
  if (typeof left === 'string' && typeof right === 'string') { left = left.toLowerCase(); right = right.toLowerCase(); }
  return left === right ? 0 : (left as number) < (right as number) ? -1 : 1;
}

/** Evaluate each arg, expanding ranges into flat arrays. */
export function flattenArgs(
  args: ASTNode[],
  context: IFormulaContext,
  evaluator: IEvaluator,
  skipReferenceBooleans = false
): unknown[] {
  const result: unknown[] = [];
  for (const arg of args) {
    if (arg.kind === 'range') {
      const values = context.getRangeValues({ start: arg.start, end: arg.end });
      for (const row of values) {
        for (const val of row) {
          if (!skipReferenceBooleans || typeof val !== 'boolean') result.push(skipReferenceBooleans && val instanceof Date ? toNumber(val) : val);
        }
      }
    } else {
      const value = evaluator.evaluate(arg, context);
      if (Array.isArray(value)) {
        for (const row of value as unknown[][]) for (const cell of row) {
          if (!skipReferenceBooleans || typeof cell !== 'boolean') result.push(skipReferenceBooleans && cell instanceof Date ? toNumber(cell) : cell);
        }
      } else if (!skipReferenceBooleans || arg.kind !== 'cellRef' || typeof value !== 'boolean') result.push(skipReferenceBooleans && value instanceof Date ? toNumber(value) : value);
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

/** A literal node for a scalar result, or undefined when there is none. */
function literalNode(value: unknown): ASTNode {
  return { kind: 'value', value };
}

/** Built-ins whose scalar arguments Excel evaluates element by element. */
const ELEMENTWISE_FUNCTIONS = new Set((
  'ABS ACOS ACOSH ACOT ACOTH ASIN ASINH ATAN ATANH ATAN2 COS COSH COT COTH CSC CSCH DEGREES EXP INT LN LOG LOG10 MOD POWER RADIANS ROUND ROUNDDOWN ROUNDUP SIGN SIN SINH SQRT TAN TANH TRUNC CEILING FLOOR MROUND ' +
  'LEFT RIGHT MID LEN LOWER UPPER PROPER TRIM CLEAN REPT SUBSTITUTE REPLACE FIND SEARCH TEXT VALUE CHAR CODE UNICHAR UNICODE EXACT NOT N T ISNUMBER ISTEXT ISBLANK ISERROR ISERR ISNA ISLOGICAL YEAR MONTH DAY HOUR MINUTE SECOND DATE TIME'
).split(' '));

/** Replace LET-bound names in `node`, respecting shadowing by nested LETs. */
function substituteNames(node: ASTNode, bindings: ReadonlyMap<string, ASTNode>): ASTNode {
  if (bindings.size === 0) return node;
  switch (node.kind) {
    case 'name':
      return bindings.get(node.name) ?? node;
    case 'binaryOp':
      return { ...node, left: substituteNames(node.left, bindings), right: substituteNames(node.right, bindings) };
    case 'unaryOp':
      return { ...node, operand: substituteNames(node.operand, bindings) };
    case 'functionCall': {
      if (node.name !== 'LET') return { ...node, args: node.args.map(arg => substituteNames(arg, bindings)) };
      // A nested LET's own name shadows the outer binding after its value.
      const scope = new Map(bindings);
      const args: ASTNode[] = [];
      for (let i = 0; i < node.args.length; i++) {
        const arg = node.args[i];
        if (arg === undefined) continue;
        const next = node.args[i + 1];
        if (arg.kind === 'name' && i % 2 === 0 && next !== undefined && i < node.args.length - 1) {
          args.push(arg, substituteNames(next, scope));
          scope.delete(arg.name);
          i++;
        } else args.push(substituteNames(arg, scope));
      }
      return { ...node, args };
    }
    default:
      return node;
  }
}

export class FormulaEvaluator implements IEvaluator {
  private depth = 0;
  private steps = 0;
  private functions: Map<string, IFormulaFunction>;

  private readonly maxRangeCells: number;
  private readonly maxWork: number;

  constructor(builtInFunctions: Map<string, IFormulaFunction>, limits?: IFormulaLimits) {
    this.functions = new Map(builtInFunctions);
    this.maxRangeCells = limits?.maxRangeCells ?? MAX_RANGE_CELLS;
    this.maxWork = limits?.maxWork ?? MAX_FORMULA_STEPS;
  }

  registerFunction(name: string, fn: IFormulaFunction): void {
    this.functions.set(name.toUpperCase(), fn);
  }

  evaluate(node: ASTNode, context: IFormulaContext): unknown {
    if (this.depth === 0) {
      this.steps = 0;
      let rangeCells = 0;
      let work = 0;
      const { maxRangeCells, maxWork } = this;
      const consumeWork = (steps: number) => {
        work += steps;
        if (work > maxWork) throw new FormulaError('#VALUE!', 'Formula work limit exceeded');
      };
      const original = context;
      const readRange = (range: Parameters<IFormulaContext['getRangeValues']>[0], preserveShape = false): unknown[][] => {
        const data = preserveShape && original.getArrayRangeValues ? original.getArrayRangeValues(range) : original.getRangeValues(range);
        let cells = 0;
        for (const row of data) {
          cells += row.length;
          for (const value of row) {
            if (typeof value === 'string' && value.length > MAX_TEXT_LENGTH) throw new FormulaError('#VALUE!', 'Cell text too long');
          }
        }
        rangeCells += cells;
        if (rangeCells > maxRangeCells) throw new FormulaError('#VALUE!', 'Range too large');
        consumeWork(cells);
        return data;
      };
      context = {
        ...original,
        consumeWork,
        maxArrayCells: maxRangeCells,
        getSpillValues: original.getSpillValues && (address => {
          const value = original.getSpillValues?.(address);
          if (Array.isArray(value)) {
            const cells = value.reduce((sum, row) => sum + row.length, 0);
            rangeCells += cells;
            if (rangeCells > maxRangeCells) throw new FormulaError('#VALUE!', 'Range too large');
            consumeWork(cells);
          }
          return value;
        }),
        getCellValue: address => {
          const value = original.getCellValue(address);
          consumeWork(typeof value === 'string' ? value.length + 1 : 1);
          return value;
        },
        getRangeValues: range => readRange(range),
        getArrayRangeValues: range => readRange(range, true),
      };
    }
    if (this.depth >= MAX_FORMULA_DEPTH || ++this.steps > this.maxWork) return new FormulaError('#VALUE!', 'Formula evaluation limit exceeded');
    this.depth++;
    try {
      const result = this.evaluateNode(node, context);
      if (typeof result === 'number' && !Number.isFinite(result)) return new FormulaError('#NUM!', 'Non-finite result');
      if (typeof result === 'string' && result.length > MAX_TEXT_LENGTH) return new FormulaError('#VALUE!', 'Text result too long');
      return result;
    } catch (error) {
      if (error instanceof FormulaError) return error;
      throw error;
    } finally { this.depth--; }
  }

  private evaluateNode(node: ASTNode, context: IFormulaContext): unknown {
    switch (node.kind) {
      case 'number':
        return node.value;
      case 'string':
        return node.value;
      case 'boolean':
      case 'value':
        return node.value;
      case 'error':
        return node.error;

      case 'cellRef': {
        const val = context.getCellValue(node.address);
        return val;
      }

      case 'range':
        return (context.getArrayRangeValues ?? context.getRangeValues)({ start: node.start, end: node.end });

      case 'spillRef':
        return context.getSpillValues?.(node.address) ?? new FormulaError('#REF!', 'Cell has no spill range');

      case 'functionCall':
        return this.evaluateFunction(node.name, node.args, context);

      case 'binaryOp':
        return this.evaluateBinaryOp(node.op, node.left, node.right, context);

      case 'unaryOp':
        return this.evaluateUnaryOp(node.op, node.operand, context);

      case 'name':
        // LET substitutes bound names before evaluating; one left here is unbound.
        return new FormulaError('#NAME?', `Unknown name: ${node.name}`);
    }
  }

  /**
   * LET(name1, value1, ..., calculation). Each value is evaluated once, in
   * order, and its name is substituted into the later arguments: references
   * (cells, ranges) stay references so SUM(r) and friends still see a range;
   * scalar results become literals; anything else (arrays, blanks) substitutes
   * the value expression itself.
   */
  private evaluateLet(args: ASTNode[], context: IFormulaContext): unknown {
    if (args.length < 3 || args.length % 2 === 0) return new FormulaError('#VALUE!', 'LET requires name/value pairs and a calculation');
    const bindings = new Map<string, ASTNode>();
    for (let i = 0; i < args.length - 1; i += 2) {
      const nameNode = args[i];
      const valueArg = args[i + 1];
      if (nameNode?.kind !== 'name' || valueArg === undefined) return new FormulaError('#VALUE!', 'LET names must be identifiers');
      const valueNode = substituteNames(valueArg, bindings);
      let bound = valueNode;
      if (valueNode.kind !== 'range' && valueNode.kind !== 'cellRef') {
        bound = literalNode(this.evaluate(valueNode, context)) ?? valueNode;
      }
      bindings.set(nameNode.name, bound);
    }
    const calculation = args[args.length - 1];
    if (calculation === undefined) return new FormulaError('#VALUE!', 'LET requires a calculation');
    return this.evaluate(substituteNames(calculation, bindings), context);
  }

  private evaluateFunction(
    name: string,
    args: ASTNode[],
    context: IFormulaContext
  ): unknown {
    // Function names are already uppercased at parse time (tokenizer preserves source case,
    // but the parser stores them uppercase via FunctionCallNode). For safety, uppercase here
    // but cache the result to avoid repeated allocations.
    // LET binds names at parse time, so it is part of the evaluator, not the registry.
    if (name === 'LET') return this.evaluateLet(args, context);
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

    if (ELEMENTWISE_FUNCTIONS.has(name)) {
      const values = args.map(arg => this.evaluate(arg, context));
      if (values.some(Array.isArray)) return mapArrays(values, context, cells => fn.evaluate(cells.map(literalNode), context, this));
    }
    return fn.evaluate(args, context, this);
  }

  private evaluateBinaryOp(
    op: BinaryOp,
    left: ASTNode,
    right: ASTNode,
    context: IFormulaContext
  ): unknown {
    const leftValue = this.evaluate(left, context);
    const rightValue = this.evaluate(right, context);
    return mapArrays([leftValue, rightValue], context, ([lVal, rVal]) => {
      if (lVal instanceof FormulaError) return lVal;
      if (rVal instanceof FormulaError) return rVal;
      if (op === '&') return toText(lVal) + toText(rVal);
      if (op === '>' || op === '<' || op === '>=' || op === '<=' || op === '=' || op === '<>') return this.compare(op, lVal, rVal);
    const lNum = toNumber(lVal);
    if (lNum instanceof FormulaError) return lNum;
    const rNum = toNumber(rVal);
    if (rNum instanceof FormulaError) return rNum;

    let result: number;
    switch (op) {
      case '+': result = lNum + rNum; break;
      case '-': result = lNum - rNum; break;
      case '*': result = lNum * rNum; break;
      case '/':
        if (rNum === 0) return new FormulaError('#DIV/0!');
        result = lNum / rNum;
        break;
      case '^':
        // Excel: 0 raised to a negative power is #DIV/0!
        if (lNum === 0 && rNum < 0) return new FormulaError('#DIV/0!');
        result = lNum ** rNum;
        break;
      // Postfix percent. The parser encodes `X%` as binaryOp('%', X, 100),
      // so this is a division: 50% -> 50 / 100 -> 0.5 (matching Excel).
      case '%': result = lNum / rNum; break;
      default:
        return new FormulaError('#ERROR!', `Unknown operator: ${op}`);
    }
    // Overflow and NaN (e.g. (-8)^(1/3)) surface as #NUM!, as in Excel.
    if (!Number.isFinite(result)) return new FormulaError('#NUM!', 'Result is not a finite number');
    return result;
    });
  }

  private evaluateUnaryOp(
    op: '+' | '-' | '@',
    operand: ASTNode,
    context: IFormulaContext
  ): unknown {
    if (op === '@' && operand.kind === 'range') {
      const minRow = Math.min(operand.start.row, operand.end.row), maxRow = Math.max(operand.start.row, operand.end.row);
      const minCol = Math.min(operand.start.col, operand.end.col), maxCol = Math.max(operand.start.col, operand.end.col);
      const row = minRow === maxRow ? minRow : context.currentCell?.row;
      const col = minCol === maxCol ? minCol : context.currentCell?.col;
      if (row === undefined || col === undefined || row < minRow || row > maxRow || col < minCol || col > maxCol) return new FormulaError('#VALUE!', 'No implicit intersection');
      return context.getCellValue({ ...operand.start, row, col });
    }
    const val = this.evaluate(operand, context);
    if (op === '@') return asArray(val)[0]?.[0];
    return mapArrays([val], context, ([value]) => {
      const num = toNumber(value);
      if (num instanceof FormulaError) return num;
      return op === '-' ? -num : num;
    });
  }

  private compare(op: BinaryOp, left: unknown, right: unknown): boolean {
    return this.numCompare(op, compareValues(left, right), 0);
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

}
