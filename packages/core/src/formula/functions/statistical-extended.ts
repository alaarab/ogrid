import type { IFormulaFunction, IFormulaContext, IEvaluator, ASTNode } from '../types';
import { FormulaError } from '../types';
import { toNumber, flattenArgs } from '../evaluator';

/** Extract numeric values from flattened args, returning FormulaError on any error value. */
function extractNums(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): number[] | FormulaError {
  const values = flattenArgs(args, context, evaluator);
  const nums: number[] = [];
  for (const val of values) {
    if (val instanceof FormulaError) return val;
    if (typeof val === 'number') nums.push(val);
    else if (typeof val === 'boolean') nums.push(val ? 1 : 0);
    // strings and nulls ignored (Excel behavior)
  }
  return nums;
}

function mean(nums: number[]): number {
  let sum = 0;
  for (const n of nums) sum += n;
  return sum / nums.length;
}

export function registerStatisticalExtendedFunctions(registry: Map<string, IFormulaFunction>): void {
  // STDEV / STDEV.S  -  sample standard deviation: sqrt(sum((x - mean)^2) / (n-1))
  const stdevImpl: IFormulaFunction = {
    minArgs: 1,
    maxArgs: -1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const nums = extractNums(args, context, evaluator);
      if (nums instanceof FormulaError) return nums;
      if (nums.length < 2) return new FormulaError('#DIV/0!', 'STDEV requires at least 2 values');
      const m = mean(nums);
      let sum = 0;
      for (const n of nums) sum += (n - m) * (n - m);
      return Math.sqrt(sum / (nums.length - 1));
    },
  };
  registry.set('STDEV', stdevImpl);
  registry.set('STDEV.S', stdevImpl);

  // STDEVP / STDEV.P  -  population standard deviation: sqrt(sum((x - mean)^2) / n)
  const stdevpImpl: IFormulaFunction = {
    minArgs: 1,
    maxArgs: -1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const nums = extractNums(args, context, evaluator);
      if (nums instanceof FormulaError) return nums;
      if (nums.length === 0) return new FormulaError('#DIV/0!', 'STDEVP requires at least 1 value');
      const m = mean(nums);
      let sum = 0;
      for (const n of nums) sum += (n - m) * (n - m);
      return Math.sqrt(sum / nums.length);
    },
  };
  registry.set('STDEVP', stdevpImpl);
  registry.set('STDEV.P', stdevpImpl);

  // VAR / VAR.S  -  sample variance
  const varImpl: IFormulaFunction = {
    minArgs: 1,
    maxArgs: -1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const nums = extractNums(args, context, evaluator);
      if (nums instanceof FormulaError) return nums;
      if (nums.length < 2) return new FormulaError('#DIV/0!', 'VAR requires at least 2 values');
      const m = mean(nums);
      let sum = 0;
      for (const n of nums) sum += (n - m) * (n - m);
      return sum / (nums.length - 1);
    },
  };
  registry.set('VAR', varImpl);
  registry.set('VAR.S', varImpl);

  // VARP / VAR.P  -  population variance
  const varpImpl: IFormulaFunction = {
    minArgs: 1,
    maxArgs: -1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const nums = extractNums(args, context, evaluator);
      if (nums instanceof FormulaError) return nums;
      if (nums.length === 0) return new FormulaError('#DIV/0!', 'VARP requires at least 1 value');
      const m = mean(nums);
      let sum = 0;
      for (const n of nums) sum += (n - m) * (n - m);
      return sum / nums.length;
    },
  };
  registry.set('VARP', varpImpl);
  registry.set('VAR.P', varpImpl);

  // CORREL(array1, array2)  -  Pearson correlation coefficient
  registry.set('CORREL', {
    minArgs: 2,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const arg0 = args[0];
      const arg1 = args[1];
      if (arg0 === undefined || arg1 === undefined) {
        return new FormulaError('#N/A', 'CORREL: arrays must have same number of values');
      }
      const nums1 = extractNums([arg0], context, evaluator);
      if (nums1 instanceof FormulaError) return nums1;
      const nums2 = extractNums([arg1], context, evaluator);
      if (nums2 instanceof FormulaError) return nums2;

      if (nums1.length !== nums2.length) {
        return new FormulaError('#N/A', 'CORREL: arrays must have same number of values');
      }
      if (nums1.length < 2) {
        return new FormulaError('#DIV/0!', 'CORREL requires at least 2 paired values');
      }

      const m1 = mean(nums1);
      const m2 = mean(nums2);

      let cov = 0;
      let var1 = 0;
      let var2 = 0;
      for (let i = 0; i < nums1.length; i++) {
        const v1 = nums1[i];
        const v2 = nums2[i];
        if (v1 === undefined || v2 === undefined) continue;
        const d1 = v1 - m1;
        const d2 = v2 - m2;
        cov += d1 * d2;
        var1 += d1 * d1;
        var2 += d2 * d2;
      }

      const denom = Math.sqrt(var1 * var2);
      if (denom === 0) return new FormulaError('#DIV/0!', 'CORREL: zero variance');
      return cov / denom;
    },
  });

  // PERCENTILE / PERCENTILE.INC(array, k)  -  interpolated k-th percentile, k in [0,1]
  function percentileCalc(nums: number[], k: number): number | FormulaError {
    if (k < 0 || k > 1) return new FormulaError('#NUM!', 'PERCENTILE: k must be between 0 and 1');
    if (nums.length === 0) return new FormulaError('#NUM!', 'PERCENTILE: empty array');
    const sorted = [...nums].sort((a, b) => a - b);
    const idx = k * (sorted.length - 1);
    const low = Math.floor(idx);
    const high = Math.ceil(idx);
    const lowVal = sorted[low];
    const highVal = sorted[high];
    if (lowVal === undefined || highVal === undefined) {
      return new FormulaError('#NUM!', 'PERCENTILE: empty array');
    }
    if (low === high) return lowVal;
    const frac = idx - low;
    return lowVal + frac * (highVal - lowVal);
  }

  const percentileImpl: IFormulaFunction = {
    minArgs: 2,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const arrayArg = args[0];
      const kArg = args[1];
      if (arrayArg === undefined || kArg === undefined) {
        return new FormulaError('#NUM!', 'PERCENTILE: empty array');
      }
      const nums = extractNums([arrayArg], context, evaluator);
      if (nums instanceof FormulaError) return nums;

      const rawK = evaluator.evaluate(kArg, context);
      if (rawK instanceof FormulaError) return rawK;
      const k = toNumber(rawK);
      if (k instanceof FormulaError) return k;

      return percentileCalc(nums, k);
    },
  };
  registry.set('PERCENTILE', percentileImpl);
  registry.set('PERCENTILE.INC', percentileImpl);

  // QUARTILE / QUARTILE.INC(array, quart)  -  uses PERCENTILE internally (quart*0.25)
  const quartileImpl: IFormulaFunction = {
    minArgs: 2,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const arrayArg = args[0];
      const quartArg = args[1];
      if (arrayArg === undefined || quartArg === undefined) {
        return new FormulaError('#NUM!', 'QUARTILE: quart must be 0, 1, 2, 3, or 4');
      }
      const nums = extractNums([arrayArg], context, evaluator);
      if (nums instanceof FormulaError) return nums;

      const rawQuart = evaluator.evaluate(quartArg, context);
      if (rawQuart instanceof FormulaError) return rawQuart;
      const quart = toNumber(rawQuart);
      if (quart instanceof FormulaError) return quart;

      const quartInt = Math.trunc(quart);
      if (quartInt < 0 || quartInt > 4) {
        return new FormulaError('#NUM!', 'QUARTILE: quart must be 0, 1, 2, 3, or 4');
      }

      return percentileCalc(nums, quartInt * 0.25);
    },
  };
  registry.set('QUARTILE', quartileImpl);
  registry.set('QUARTILE.INC', quartileImpl);

  // MODE / MODE.SNGL  -  most frequent value (first one if tie)
  const modeImpl: IFormulaFunction = {
    minArgs: 1,
    maxArgs: -1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const nums = extractNums(args, context, evaluator);
      if (nums instanceof FormulaError) return nums;
      if (nums.length === 0) return new FormulaError('#N/A', 'MODE: no numeric values');

      const freq = new Map<number, number>();
      for (const n of nums) {
        freq.set(n, (freq.get(n) ?? 0) + 1);
      }

      let maxFreq = 0;
      let modeVal: number | null = null;
      // Preserve first occurrence order for tie-breaking
      for (const n of nums) {
        const f = freq.get(n) ?? 0;
        if (f > maxFreq) {
          maxFreq = f;
          modeVal = n;
        }
      }

      if (maxFreq < 1 || modeVal === null) return new FormulaError('#N/A', 'MODE: no values');
      return modeVal;
    },
  };
  registry.set('MODE', modeImpl);
  registry.set('MODE.SNGL', modeImpl);

  // GEOMEAN  -  geometric mean: exp(sum(ln(x)) / n)
  registry.set('GEOMEAN', {
    minArgs: 1,
    maxArgs: -1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const nums = extractNums(args, context, evaluator);
      if (nums instanceof FormulaError) return nums;
      if (nums.length === 0) return new FormulaError('#NUM!', 'GEOMEAN: no numeric values');

      let sumLn = 0;
      for (const n of nums) {
        if (n <= 0) return new FormulaError('#NUM!', 'GEOMEAN: all values must be positive');
        sumLn += Math.log(n);
      }
      return Math.exp(sumLn / nums.length);
    },
  });

  // HARMEAN  -  harmonic mean: n / sum(1/x)
  registry.set('HARMEAN', {
    minArgs: 1,
    maxArgs: -1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const nums = extractNums(args, context, evaluator);
      if (nums instanceof FormulaError) return nums;
      if (nums.length === 0) return new FormulaError('#NUM!', 'HARMEAN: no numeric values');

      let sumRecip = 0;
      for (const n of nums) {
        if (n <= 0) return new FormulaError('#NUM!', 'HARMEAN: all values must be positive');
        sumRecip += 1 / n;
      }
      if (sumRecip === 0) return new FormulaError('#DIV/0!', 'HARMEAN: sum of reciprocals is zero');
      return nums.length / sumRecip;
    },
  });
}
