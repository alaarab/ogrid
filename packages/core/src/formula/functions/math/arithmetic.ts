import type { IFormulaFunction, IFormulaContext, IEvaluator, ASTNode } from '../../types';
import { FormulaError } from '../../types';
import { toNumber } from '../../evaluator';

/**
 * Elementary arithmetic, powers, logs, and constants/random: ABS, MOD, POWER,
 * SQRT, SIGN, QUOTIENT, LOG, LN, EXP, PI, RAND, RANDBETWEEN.
 */
export function registerMathArithmeticFunctions(registry: Map<string, IFormulaFunction>): void {
  registry.set('ABS', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawVal = evaluator.evaluate(args[0], context);
      if (rawVal instanceof FormulaError) return rawVal;
      const num = toNumber(rawVal);
      if (num instanceof FormulaError) return num;
      return Math.abs(num);
    },
  });

  registry.set('MOD', {
    minArgs: 2,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawNum = evaluator.evaluate(args[0], context);
      if (rawNum instanceof FormulaError) return rawNum;
      const num = toNumber(rawNum);
      if (num instanceof FormulaError) return num;

      const rawDiv = evaluator.evaluate(args[1], context);
      if (rawDiv instanceof FormulaError) return rawDiv;
      const divisor = toNumber(rawDiv);
      if (divisor instanceof FormulaError) return divisor;

      if (divisor === 0) return new FormulaError('#DIV/0!', 'Division by zero in MOD');
      // Excel MOD result takes the sign of the divisor, unlike JS `%` which takes
      // the sign of the dividend (so MOD(-3, 2) is 1, not -1).
      return num - divisor * Math.floor(num / divisor);
    },
  });

  registry.set('POWER', {
    minArgs: 2,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawBase = evaluator.evaluate(args[0], context);
      if (rawBase instanceof FormulaError) return rawBase;
      const base = toNumber(rawBase);
      if (base instanceof FormulaError) return base;

      const rawExp = evaluator.evaluate(args[1], context);
      if (rawExp instanceof FormulaError) return rawExp;
      const exponent = toNumber(rawExp);
      if (exponent instanceof FormulaError) return exponent;

      return base ** exponent;
    },
  });

  registry.set('SQRT', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawVal = evaluator.evaluate(args[0], context);
      if (rawVal instanceof FormulaError) return rawVal;
      const num = toNumber(rawVal);
      if (num instanceof FormulaError) return num;
      if (num < 0) return new FormulaError('#VALUE!', 'Cannot take square root of negative number');
      return Math.sqrt(num);
    },
  });

  registry.set('SIGN', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawVal = evaluator.evaluate(args[0], context);
      if (rawVal instanceof FormulaError) return rawVal;
      const num = toNumber(rawVal);
      if (num instanceof FormulaError) return num;
      return num > 0 ? 1 : num < 0 ? -1 : 0;
    },
  });

  // ---------------------------------------------------------------------------
  // QUOTIENT(numerator, denominator)  -  integer part of division
  // ---------------------------------------------------------------------------
  registry.set('QUOTIENT', {
    minArgs: 2,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawNum = evaluator.evaluate(args[0], context);
      if (rawNum instanceof FormulaError) return rawNum;
      const num = toNumber(rawNum);
      if (num instanceof FormulaError) return num;

      const rawDen = evaluator.evaluate(args[1], context);
      if (rawDen instanceof FormulaError) return rawDen;
      const den = toNumber(rawDen);
      if (den instanceof FormulaError) return den;

      if (den === 0) return new FormulaError('#DIV/0!', 'QUOTIENT: division by zero');
      return Math.trunc(num / den);
    },
  });

  registry.set('LOG', {
    minArgs: 1,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawVal = evaluator.evaluate(args[0], context);
      if (rawVal instanceof FormulaError) return rawVal;
      const num = toNumber(rawVal);
      if (num instanceof FormulaError) return num;
      if (num <= 0) return new FormulaError('#NUM!', 'LOG requires a positive number');
      let base = 10;
      if (args.length >= 2) {
        const rawB = evaluator.evaluate(args[1], context);
        if (rawB instanceof FormulaError) return rawB;
        const b = toNumber(rawB);
        if (b instanceof FormulaError) return b;
        if (b <= 0 || b === 1) return new FormulaError('#NUM!', 'LOG base must be positive and not 1');
        base = b;
      }
      return Math.log(num) / Math.log(base);
    },
  });

  registry.set('LN', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawVal = evaluator.evaluate(args[0], context);
      if (rawVal instanceof FormulaError) return rawVal;
      const num = toNumber(rawVal);
      if (num instanceof FormulaError) return num;
      if (num <= 0) return new FormulaError('#NUM!', 'LN requires a positive number');
      return Math.log(num);
    },
  });

  registry.set('EXP', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawVal = evaluator.evaluate(args[0], context);
      if (rawVal instanceof FormulaError) return rawVal;
      const num = toNumber(rawVal);
      if (num instanceof FormulaError) return num;
      return Math.exp(num);
    },
  });

  registry.set('PI', {
    minArgs: 0,
    maxArgs: 0,
    evaluate(): unknown {
      return Math.PI;
    },
  });

  registry.set('RAND', {
    minArgs: 0,
    maxArgs: 0,
    evaluate(): unknown {
      return Math.random();
    },
  });

  registry.set('RANDBETWEEN', {
    minArgs: 2,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawLow = evaluator.evaluate(args[0], context);
      if (rawLow instanceof FormulaError) return rawLow;
      const low = toNumber(rawLow);
      if (low instanceof FormulaError) return low;
      const rawHigh = evaluator.evaluate(args[1], context);
      if (rawHigh instanceof FormulaError) return rawHigh;
      const high = toNumber(rawHigh);
      if (high instanceof FormulaError) return high;
      const lo = Math.ceil(low);
      const hi = Math.floor(high);
      if (lo > hi) return new FormulaError('#NUM!', 'RANDBETWEEN bottom must be <= top');
      return Math.floor(Math.random() * (hi - lo + 1)) + lo;
    },
  });
}
