import type { IFormulaFunction, IFormulaContext, IEvaluator, ASTNode } from '../types';
import { FormulaError } from '../types';
import { toNumber, flattenArgs } from '../evaluator';

export function registerMathFunctions(registry: Map<string, IFormulaFunction>): void {
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

  registry.set('ROUND', {
    minArgs: 2,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawNum = evaluator.evaluate(args[0], context);
      if (rawNum instanceof FormulaError) return rawNum;
      const num = toNumber(rawNum);
      if (num instanceof FormulaError) return num;

      const rawDigits = evaluator.evaluate(args[1], context);
      if (rawDigits instanceof FormulaError) return rawDigits;
      const digits = toNumber(rawDigits);
      if (digits instanceof FormulaError) return digits;

      const factor = Math.pow(10, Math.trunc(digits));
      return Math.round(num * factor) / factor;
    },
  });

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

  registry.set('CEILING', {
    minArgs: 2,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawNum = evaluator.evaluate(args[0], context);
      if (rawNum instanceof FormulaError) return rawNum;
      const num = toNumber(rawNum);
      if (num instanceof FormulaError) return num;

      const rawSig = evaluator.evaluate(args[1], context);
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
      const rawNum = evaluator.evaluate(args[0], context);
      if (rawNum instanceof FormulaError) return rawNum;
      const num = toNumber(rawNum);
      if (num instanceof FormulaError) return num;

      const rawSig = evaluator.evaluate(args[1], context);
      if (rawSig instanceof FormulaError) return rawSig;
      const significance = toNumber(rawSig);
      if (significance instanceof FormulaError) return significance;

      if (significance === 0) return 0;
      return Math.floor(num / significance) * significance;
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
      return num % divisor;
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

      return Math.pow(base, exponent);
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

  registry.set('ROUNDUP', {
    minArgs: 2,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawNum = evaluator.evaluate(args[0], context);
      if (rawNum instanceof FormulaError) return rawNum;
      const num = toNumber(rawNum);
      if (num instanceof FormulaError) return num;
      const rawDigits = evaluator.evaluate(args[1], context);
      if (rawDigits instanceof FormulaError) return rawDigits;
      const digits = toNumber(rawDigits);
      if (digits instanceof FormulaError) return digits;
      const factor = Math.pow(10, Math.trunc(digits));
      return num >= 0
        ? Math.ceil(num * factor) / factor
        : Math.floor(num * factor) / factor;
    },
  });

  registry.set('ROUNDDOWN', {
    minArgs: 2,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawNum = evaluator.evaluate(args[0], context);
      if (rawNum instanceof FormulaError) return rawNum;
      const num = toNumber(rawNum);
      if (num instanceof FormulaError) return num;
      const rawDigits = evaluator.evaluate(args[1], context);
      if (rawDigits instanceof FormulaError) return rawDigits;
      const digits = toNumber(rawDigits);
      if (digits instanceof FormulaError) return digits;
      const factor = Math.pow(10, Math.trunc(digits));
      return Math.trunc(num * factor) / factor;
    },
  });

  registry.set('INT', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawVal = evaluator.evaluate(args[0], context);
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
      const rawVal = evaluator.evaluate(args[0], context);
      if (rawVal instanceof FormulaError) return rawVal;
      const num = toNumber(rawVal);
      if (num instanceof FormulaError) return num;
      let digits = 0;
      if (args.length >= 2) {
        const rawD = evaluator.evaluate(args[1], context);
        if (rawD instanceof FormulaError) return rawD;
        const d = toNumber(rawD);
        if (d instanceof FormulaError) return d;
        digits = Math.trunc(d);
      }
      const factor = Math.pow(10, digits);
      return Math.trunc(num * factor) / factor;
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
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      // All args must be ranges of the same dimensions
      const arrays: unknown[][][] = [];
      for (const arg of args) {
        if (arg.kind !== 'range') {
          return new FormulaError('#VALUE!', 'SUMPRODUCT arguments must be ranges');
        }
        arrays.push(context.getRangeValues({ start: arg.start, end: arg.end }));
      }
      if (arrays.length === 0) return 0;
      const rows = arrays[0].length;
      const cols = rows > 0 ? arrays[0][0].length : 0;
      // Verify same dimensions
      for (let a = 1; a < arrays.length; a++) {
        if (arrays[a].length !== rows || (rows > 0 && arrays[a][0].length !== cols)) {
          return new FormulaError('#VALUE!', 'SUMPRODUCT arrays must have same dimensions');
        }
      }
      let sum = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          let product = 1;
          for (let a = 0; a < arrays.length; a++) {
            const v = toNumber(arrays[a][r][c]);
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
      return nums.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
    },
  });

  registry.set('LARGE', {
    minArgs: 2,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      if (args[0].kind !== 'range') {
        return new FormulaError('#VALUE!', 'LARGE first argument must be a range');
      }
      const rangeData = context.getRangeValues({ start: args[0].start, end: args[0].end });
      const rawK = evaluator.evaluate(args[1], context);
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
      if (args[0].kind !== 'range') {
        return new FormulaError('#VALUE!', 'SMALL first argument must be a range');
      }
      const rangeData = context.getRangeValues({ start: args[0].start, end: args[0].end });
      const rawK = evaluator.evaluate(args[1], context);
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
      const rawNum = evaluator.evaluate(args[0], context);
      if (rawNum instanceof FormulaError) return rawNum;
      const num = toNumber(rawNum);
      if (num instanceof FormulaError) return num;
      if (args[1].kind !== 'range') {
        return new FormulaError('#VALUE!', 'RANK second argument must be a range');
      }
      const rangeData = context.getRangeValues({ start: args[1].start, end: args[1].end });
      let order = 0; // 0 = descending, 1 = ascending
      if (args.length >= 3) {
        const rawO = evaluator.evaluate(args[2], context);
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
