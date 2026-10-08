import type { IFormulaFunction, IFormulaContext, IEvaluator, ASTNode } from '../../types';
import { FormulaError } from '../../types';
import { toNumber, evalArg } from '../../evaluator';

/** Excel rejects SIN/COS/TAN arguments at or beyond 2^27 with #NUM!. */
const MAX_TRIG_ARG = 2 ** 27;

/** A one-argument numeric function; `fn` may return a FormulaError for domain errors. */
function unary(fn: (x: number) => number | FormulaError): IFormulaFunction {
  return {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const raw = evalArg(evaluator, args[0], context);
      if (raw instanceof FormulaError) return raw;
      const num = toNumber(raw);
      if (num instanceof FormulaError) return num;
      return fn(num);
    },
  };
}

function periodic(fn: (x: number) => number): IFormulaFunction {
  return unary(x => Math.abs(x) >= MAX_TRIG_ARG ? new FormulaError('#NUM!', 'Argument too large') : fn(x));
}

/**
 * Trigonometry and angle conversion: SIN, COS, TAN, ASIN, ACOS, ATAN, ATAN2,
 * RADIANS, DEGREES. Angles are in radians, as in Excel.
 */
export function registerMathTrigFunctions(registry: Map<string, IFormulaFunction>): void {
  registry.set('SIN', periodic(Math.sin));
  registry.set('COS', periodic(Math.cos));
  registry.set('TAN', periodic(Math.tan));
  registry.set('ASIN', unary(x => x < -1 || x > 1 ? new FormulaError('#NUM!', 'ASIN requires -1 <= number <= 1') : Math.asin(x)));
  registry.set('ACOS', unary(x => x < -1 || x > 1 ? new FormulaError('#NUM!', 'ACOS requires -1 <= number <= 1') : Math.acos(x)));
  registry.set('ATAN', unary(Math.atan));
  registry.set('RADIANS', unary(x => x * Math.PI / 180));
  registry.set('DEGREES', unary(x => x * 180 / Math.PI));

  // ATAN2(x_num, y_num): Excel takes x first, unlike Math.atan2(y, x).
  registry.set('ATAN2', {
    minArgs: 2,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawX = evalArg(evaluator, args[0], context);
      if (rawX instanceof FormulaError) return rawX;
      const x = toNumber(rawX);
      if (x instanceof FormulaError) return x;
      const rawY = evalArg(evaluator, args[1], context);
      if (rawY instanceof FormulaError) return rawY;
      const y = toNumber(rawY);
      if (y instanceof FormulaError) return y;
      if (x === 0 && y === 0) return new FormulaError('#DIV/0!', 'ATAN2 of (0, 0)');
      return Math.atan2(y, x);
    },
  });

  registry.set('LOG10', unary(x => x <= 0 ? new FormulaError('#NUM!', 'LOG10 requires a positive number') : Math.log10(x)));
}
