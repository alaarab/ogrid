import type { IFormulaFunction, IFormulaContext, IEvaluator, ASTNode } from '../../types';
import { FormulaError } from '../../types';
import { toNumber, flattenArgs, evalArg } from '../../evaluator';

/**
 * Aggregation and ranking over value lists/ranges: SUM, AVERAGE, MIN, MAX,
 * COUNT, COUNTA, PRODUCT, SUMPRODUCT, MEDIAN, LARGE, SMALL, RANK.
 */
export function registerMathAggregationFunctions(registry: Map<string, IFormulaFunction>): void {
  registry.set('SUM', {
    minArgs: 1,
    maxArgs: -1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const values = flattenArgs(args, context, evaluator);
      let sum = 0;
      for (const val of values) {
        if (val instanceof FormulaError) return val;
        if (typeof val === 'number') {
          sum += val;
        } else if (typeof val === 'boolean') {
          sum += val ? 1 : 0;
        }
        // non-numeric (strings, null, undefined) are ignored in SUM
      }
      return sum;
    },
  });

  registry.set('AVERAGE', {
    minArgs: 1,
    maxArgs: -1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const values = flattenArgs(args, context, evaluator);
      let sum = 0;
      let count = 0;
      for (const val of values) {
        if (val instanceof FormulaError) return val;
        if (typeof val === 'number') {
          sum += val;
          count++;
        } else if (typeof val === 'boolean') {
          sum += val ? 1 : 0;
          count++;
        }
      }
      if (count === 0) return new FormulaError('#DIV/0!', 'No numeric values for AVERAGE');
      return sum / count;
    },
  });

  registry.set('MIN', {
    minArgs: 1,
    maxArgs: -1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const values = flattenArgs(args, context, evaluator);
      let min = Infinity;
      for (const val of values) {
        if (val instanceof FormulaError) return val;
        if (typeof val === 'number') {
          if (val < min) min = val;
        } else if (typeof val === 'boolean') {
          const n = val ? 1 : 0;
          if (n < min) min = n;
        }
      }
      return min === Infinity ? 0 : min;
    },
  });

  registry.set('MAX', {
    minArgs: 1,
    maxArgs: -1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const values = flattenArgs(args, context, evaluator);
      let max = -Infinity;
      for (const val of values) {
        if (val instanceof FormulaError) return val;
        if (typeof val === 'number') {
          if (val > max) max = val;
        } else if (typeof val === 'boolean') {
          const n = val ? 1 : 0;
          if (n > max) max = n;
        }
      }
      return max === -Infinity ? 0 : max;
    },
  });

  registry.set('COUNT', {
    minArgs: 1,
    maxArgs: -1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const values = flattenArgs(args, context, evaluator);
      let count = 0;
      for (const val of values) {
        if (val instanceof FormulaError) return val;
        if (typeof val === 'number') {
          count++;
        }
      }
      return count;
    },
  });

  registry.set('COUNTA', {
    minArgs: 1,
    maxArgs: -1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const values = flattenArgs(args, context, evaluator);
      let count = 0;
      for (const val of values) {
        if (val instanceof FormulaError) return val;
        if (val !== null && val !== undefined && val !== '') {
          count++;
        }
      }
      return count;
    },
  });

  registry.set('PRODUCT', {
    minArgs: 1,
    maxArgs: -1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const values = flattenArgs(args, context, evaluator);
      let product = 1;
      let hasNumber = false;
      for (const val of values) {
        if (val instanceof FormulaError) return val;
        if (typeof val === 'number') {
          product *= val;
          hasNumber = true;
        }
      }
      return hasNumber ? product : 0;
    },
  });

  registry.set('SUMPRODUCT', {
    minArgs: 1,
    maxArgs: -1,
    evaluate(args: ASTNode[], context: IFormulaContext, _evaluator: IEvaluator): unknown {
      // All args must be ranges of the same dimensions
      const arrays: unknown[][][] = [];
      for (const arg of args) {
        if (arg.kind !== 'range') {
          return new FormulaError('#VALUE!', 'SUMPRODUCT arguments must be ranges');
        }
        arrays.push(context.getRangeValues({ start: arg.start, end: arg.end }));
      }
      const firstArray = arrays[0];
      if (firstArray === undefined) return 0;
      const rows = firstArray.length;
      const firstRow = firstArray[0];
      const cols = firstRow !== undefined ? firstRow.length : 0;
      // Verify same dimensions
      for (let a = 1; a < arrays.length; a++) {
        const arr = arrays[a];
        if (arr === undefined) continue;
        if (arr.length !== rows || (rows > 0 && arr[0]?.length !== cols)) {
          return new FormulaError('#VALUE!', 'SUMPRODUCT arrays must have same dimensions');
        }
      }
      let sum = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          let product = 1;
          for (let a = 0; a < arrays.length; a++) {
            const v = toNumber(arrays[a]?.[r]?.[c]);
            if (v instanceof FormulaError) { product = 0; break; }
            product *= v;
          }
          sum += product;
        }
      }
      return sum;
    },
  });

  registry.set('MEDIAN', {
    minArgs: 1,
    maxArgs: -1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const values = flattenArgs(args, context, evaluator);
      const nums: number[] = [];
      for (const val of values) {
        if (val instanceof FormulaError) return val;
        if (typeof val === 'number') nums.push(val);
      }
      if (nums.length === 0) return new FormulaError('#NUM!', 'No numeric values for MEDIAN');
      nums.sort((a, b) => a - b);
      const mid = Math.floor(nums.length / 2);
      const upper = nums[mid];
      if (nums.length % 2 !== 0) return upper;
      const lower = nums[mid - 1];
      if (upper === undefined || lower === undefined) {
        return new FormulaError('#NUM!', 'No numeric values for MEDIAN');
      }
      return (lower + upper) / 2;
    },
  });

  registry.set('LARGE', {
    minArgs: 2,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rangeArg = args[0];
      if (rangeArg === undefined || rangeArg.kind !== 'range') {
        return new FormulaError('#VALUE!', 'LARGE first argument must be a range');
      }
      const rangeData = context.getRangeValues({ start: rangeArg.start, end: rangeArg.end });
      const rawK = evalArg(evaluator, args[1], context);
      if (rawK instanceof FormulaError) return rawK;
      const k = toNumber(rawK);
      if (k instanceof FormulaError) return k;
      const nums: number[] = [];
      for (const row of rangeData) {
        for (const cell of row) {
          if (typeof cell === 'number') nums.push(cell);
        }
      }
      const ki = Math.trunc(k);
      if (ki < 1 || ki > nums.length) return new FormulaError('#NUM!', 'LARGE k out of range');
      nums.sort((a, b) => b - a);
      return nums[ki - 1];
    },
  });

  registry.set('SMALL', {
    minArgs: 2,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rangeArg = args[0];
      if (rangeArg === undefined || rangeArg.kind !== 'range') {
        return new FormulaError('#VALUE!', 'SMALL first argument must be a range');
      }
      const rangeData = context.getRangeValues({ start: rangeArg.start, end: rangeArg.end });
      const rawK = evalArg(evaluator, args[1], context);
      if (rawK instanceof FormulaError) return rawK;
      const k = toNumber(rawK);
      if (k instanceof FormulaError) return k;
      const nums: number[] = [];
      for (const row of rangeData) {
        for (const cell of row) {
          if (typeof cell === 'number') nums.push(cell);
        }
      }
      const ki = Math.trunc(k);
      if (ki < 1 || ki > nums.length) return new FormulaError('#NUM!', 'SMALL k out of range');
      nums.sort((a, b) => a - b);
      return nums[ki - 1];
    },
  });

  registry.set('RANK', {
    minArgs: 2,
    maxArgs: 3,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawNum = evalArg(evaluator, args[0], context);
      if (rawNum instanceof FormulaError) return rawNum;
      const num = toNumber(rawNum);
      if (num instanceof FormulaError) return num;
      const rangeArg = args[1];
      if (rangeArg === undefined || rangeArg.kind !== 'range') {
        return new FormulaError('#VALUE!', 'RANK second argument must be a range');
      }
      const rangeData = context.getRangeValues({ start: rangeArg.start, end: rangeArg.end });
      let order = 0; // 0 = descending, 1 = ascending
      if (args.length >= 3) {
        const rawO = evalArg(evaluator, args[2], context);
        if (rawO instanceof FormulaError) return rawO;
        const o = toNumber(rawO);
        if (o instanceof FormulaError) return o;
        order = o;
      }
      const nums: number[] = [];
      for (const row of rangeData) {
        for (const cell of row) {
          if (typeof cell === 'number') nums.push(cell);
        }
      }
      if (!nums.includes(num)) return new FormulaError('#N/A', 'RANK value not found in range');
      let rank = 1;
      for (const n of nums) {
        if (order === 0 ? n > num : n < num) rank++;
      }
      return rank;
    },
  });
}
