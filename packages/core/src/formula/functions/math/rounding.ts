import type { IFormulaFunction, IFormulaContext, IEvaluator, ASTNode } from '../../types';
import { FormulaError } from '../../types';
import { toNumber, evalArg } from '../../evaluator';

/**
 * Rounding and truncation: ROUND, CEILING, FLOOR, ROUNDUP, ROUNDDOWN, INT,
 * TRUNC, MROUND.
 */
export function registerMathRoundingFunctions(registry: Map<string, IFormulaFunction>): void {
  registry.set('ROUND', {
    minArgs: 2,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawNum = evalArg(evaluator, args[0], context);
      if (rawNum instanceof FormulaError) return rawNum;
      const num = toNumber(rawNum);
      if (num instanceof FormulaError) return num;

      const rawDigits = evalArg(evaluator, args[1], context);
      if (rawDigits instanceof FormulaError) return rawDigits;
      const digits = toNumber(rawDigits);
      if (digits instanceof FormulaError) return digits;

      const factor = 10 ** Math.trunc(digits);
      // Excel ROUND rounds halves away from zero, unlike Math.round which rounds
      // halves toward +Infinity (so ROUND(-2.5, 0) is -3, not -2).
      const scaled = Math.round(Math.abs(num) * factor) / factor;
      return num < 0 ? -scaled : scaled;
    },
  });

  registry.set('CEILING', {
    minArgs: 2,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawNum = evalArg(evaluator, args[0], context);
      if (rawNum instanceof FormulaError) return rawNum;
      const num = toNumber(rawNum);
      if (num instanceof FormulaError) return num;

      const rawSig = evalArg(evaluator, args[1], context);
      if (rawSig instanceof FormulaError) return rawSig;
      const significance = toNumber(rawSig);
      if (significance instanceof FormulaError) return significance;

      if (significance === 0) return 0;
      return Math.ceil(num / significance) * significance;
    },
  });

  registry.set('FLOOR', {
    minArgs: 2,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawNum = evalArg(evaluator, args[0], context);
      if (rawNum instanceof FormulaError) return rawNum;
      const num = toNumber(rawNum);
      if (num instanceof FormulaError) return num;

      const rawSig = evalArg(evaluator, args[1], context);
      if (rawSig instanceof FormulaError) return rawSig;
      const significance = toNumber(rawSig);
      if (significance instanceof FormulaError) return significance;

      if (significance === 0) return 0;
      return Math.floor(num / significance) * significance;
    },
  });

  registry.set('ROUNDUP', {
    minArgs: 2,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawNum = evalArg(evaluator, args[0], context);
      if (rawNum instanceof FormulaError) return rawNum;
      const num = toNumber(rawNum);
      if (num instanceof FormulaError) return num;
      const rawDigits = evalArg(evaluator, args[1], context);
      if (rawDigits instanceof FormulaError) return rawDigits;
      const digits = toNumber(rawDigits);
      if (digits instanceof FormulaError) return digits;
      const factor = 10 ** Math.trunc(digits);
      return num >= 0
        ? Math.ceil(num * factor) / factor
        : Math.floor(num * factor) / factor;
    },
  });

  registry.set('ROUNDDOWN', {
    minArgs: 2,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawNum = evalArg(evaluator, args[0], context);
      if (rawNum instanceof FormulaError) return rawNum;
      const num = toNumber(rawNum);
      if (num instanceof FormulaError) return num;
      const rawDigits = evalArg(evaluator, args[1], context);
      if (rawDigits instanceof FormulaError) return rawDigits;
      const digits = toNumber(rawDigits);
      if (digits instanceof FormulaError) return digits;
      const factor = 10 ** Math.trunc(digits);
      return Math.trunc(num * factor) / factor;
    },
  });

  registry.set('INT', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawVal = evalArg(evaluator, args[0], context);
      if (rawVal instanceof FormulaError) return rawVal;
      const num = toNumber(rawVal);
      if (num instanceof FormulaError) return num;
      return Math.floor(num);
    },
  });

  registry.set('TRUNC', {
    minArgs: 1,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawVal = evalArg(evaluator, args[0], context);
      if (rawVal instanceof FormulaError) return rawVal;
      const num = toNumber(rawVal);
      if (num instanceof FormulaError) return num;
      let digits = 0;
      if (args.length >= 2) {
        const rawD = evalArg(evaluator, args[1], context);
        if (rawD instanceof FormulaError) return rawD;
        const d = toNumber(rawD);
        if (d instanceof FormulaError) return d;
        digits = Math.trunc(d);
      }
      const factor = 10 ** digits;
      return Math.trunc(num * factor) / factor;
    },
  });

  // ---------------------------------------------------------------------------
  // MROUND(number, multiple)  -  round to nearest multiple
  // ---------------------------------------------------------------------------
  registry.set('MROUND', {
    minArgs: 2,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawNum = evalArg(evaluator, args[0], context);
      if (rawNum instanceof FormulaError) return rawNum;
      const num = toNumber(rawNum);
      if (num instanceof FormulaError) return num;

      const rawMul = evalArg(evaluator, args[1], context);
      if (rawMul instanceof FormulaError) return rawMul;
      const multiple = toNumber(rawMul);
      if (multiple instanceof FormulaError) return multiple;

      if (multiple === 0) return 0;
      if ((num > 0 && multiple < 0) || (num < 0 && multiple > 0)) {
        return new FormulaError('#NUM!', 'MROUND: number and multiple must have the same sign');
      }
      return Math.round(num / multiple) * multiple;
    },
  });
}
