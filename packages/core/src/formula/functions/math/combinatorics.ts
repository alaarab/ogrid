import type { IFormulaFunction, IFormulaContext, IEvaluator, ASTNode } from '../../types';
import { FormulaError } from '../../types';
import { toNumber } from '../../evaluator';

/**
 * Combinatorics and integer functions: COMBIN, PERMUT, FACT, GCD, LCM.
 */
export function registerMathCombinatoricsFunctions(registry: Map<string, IFormulaFunction>): void {
  // ---------------------------------------------------------------------------
  // COMBIN(n, k)  -  n! / (k! * (n-k)!)
  // ---------------------------------------------------------------------------
  registry.set('COMBIN', {
    minArgs: 2,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawN = evaluator.evaluate(args[0], context);
      if (rawN instanceof FormulaError) return rawN;
      const n = toNumber(rawN);
      if (n instanceof FormulaError) return n;

      const rawK = evaluator.evaluate(args[1], context);
      if (rawK instanceof FormulaError) return rawK;
      const k = toNumber(rawK);
      if (k instanceof FormulaError) return k;

      const ni = Math.trunc(n);
      const ki = Math.trunc(k);

      if (ni < 0 || ki < 0) return new FormulaError('#NUM!', 'COMBIN: n and k must be non-negative');
      if (ki > ni) return new FormulaError('#NUM!', 'COMBIN: k must be <= n');

      // Compute using multiplicative formula to avoid factorial overflow
      if (ki === 0 || ki === ni) return 1;
      const kk = Math.min(ki, ni - ki);
      let result = 1;
      for (let i = 0; i < kk; i++) {
        result = result * (ni - i) / (i + 1);
      }
      return Math.round(result);
    },
  });

  // ---------------------------------------------------------------------------
  // PERMUT(n, k)  -  n! / (n-k)!
  // ---------------------------------------------------------------------------
  registry.set('PERMUT', {
    minArgs: 2,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawN = evaluator.evaluate(args[0], context);
      if (rawN instanceof FormulaError) return rawN;
      const n = toNumber(rawN);
      if (n instanceof FormulaError) return n;

      const rawK = evaluator.evaluate(args[1], context);
      if (rawK instanceof FormulaError) return rawK;
      const k = toNumber(rawK);
      if (k instanceof FormulaError) return k;

      const ni = Math.trunc(n);
      const ki = Math.trunc(k);

      if (ni < 0 || ki < 0) return new FormulaError('#NUM!', 'PERMUT: n and k must be non-negative');
      if (ki > ni) return new FormulaError('#NUM!', 'PERMUT: k must be <= n');

      let result = 1;
      for (let i = 0; i < ki; i++) {
        result *= (ni - i);
      }
      return result;
    },
  });

  // ---------------------------------------------------------------------------
  // FACT(number)  -  factorial
  // ---------------------------------------------------------------------------
  registry.set('FACT', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawVal = evaluator.evaluate(args[0], context);
      if (rawVal instanceof FormulaError) return rawVal;
      const num = toNumber(rawVal);
      if (num instanceof FormulaError) return num;

      const n = Math.trunc(num);
      if (n < 0) return new FormulaError('#NUM!', 'FACT: argument must be non-negative');
      if (n > 170) return new FormulaError('#NUM!', 'FACT: argument too large (>170)');

      let result = 1;
      for (let i = 2; i <= n; i++) {
        result *= i;
      }
      return result;
    },
  });

  // ---------------------------------------------------------------------------
  // GCD(number1, [number2], ...)  -  greatest common divisor
  // ---------------------------------------------------------------------------
  registry.set('GCD', {
    minArgs: 1,
    maxArgs: -1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const nums: number[] = [];
      for (const arg of args) {
        const rawVal = evaluator.evaluate(arg, context);
        if (rawVal instanceof FormulaError) return rawVal;
        const v = toNumber(rawVal);
        if (v instanceof FormulaError) return v;
        const n = Math.trunc(Math.abs(v));
        nums.push(n);
      }

      if (nums.length === 0) return new FormulaError('#NUM!', 'GCD: no arguments');

      let result = nums[0];
      for (let i = 1; i < nums.length; i++) {
        result = gcdTwo(result, nums[i]);
      }
      return result;
    },
  });

  // ---------------------------------------------------------------------------
  // LCM(number1, [number2], ...)  -  least common multiple
  // ---------------------------------------------------------------------------
  registry.set('LCM', {
    minArgs: 1,
    maxArgs: -1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const nums: number[] = [];
      for (const arg of args) {
        const rawVal = evaluator.evaluate(arg, context);
        if (rawVal instanceof FormulaError) return rawVal;
        const v = toNumber(rawVal);
        if (v instanceof FormulaError) return v;
        const n = Math.trunc(Math.abs(v));
        nums.push(n);
      }

      if (nums.length === 0) return new FormulaError('#NUM!', 'LCM: no arguments');

      let result = nums[0];
      for (let i = 1; i < nums.length; i++) {
        const g = gcdTwo(result, nums[i]);
        if (g === 0) { result = 0; break; }
        result = (result / g) * nums[i];
      }
      return result;
    },
  });
}

/** Euclidean GCD for two non-negative integers. */
function gcdTwo(a: number, b: number): number {
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}
