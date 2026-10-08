import type { IFormulaFunction, IFormulaContext, IEvaluator, ASTNode, ICellAddress } from '../../types';
import { FormulaError } from '../../types';
import { toNumber, flattenArgs, evalArg } from '../../evaluator';

const SUBTOTAL_FUNCTIONS: Record<number, string> = {
  1: 'AVERAGE', 2: 'COUNT', 3: 'COUNTA', 4: 'MAX', 5: 'MIN', 6: 'PRODUCT',
  7: 'STDEV', 8: 'STDEVP', 9: 'SUM', 10: 'VAR', 11: 'VARP',
};

const SUBTOTAL_FORMULA = /\bSUBTOTAL\s*\(/i;

/** A context whose reads treat cells containing a SUBTOTAL formula as blank. */
function withoutSubtotalCells(context: IFormulaContext): IFormulaContext {
  const getFormula = context.getCellFormula?.bind(context);
  if (!getFormula) return context;
  const isSubtotal = (address: ICellAddress) => SUBTOTAL_FORMULA.test(getFormula(address) ?? '');
  return {
    ...context,
    getCellValue: address => isSubtotal(address) ? null : context.getCellValue(address),
    getRangeValues: range => {
      const data = context.getRangeValues(range);
      const top = Math.min(range.start.row, range.end.row);
      const left = Math.min(range.start.col, range.end.col);
      return data.map((row, r) => row.map((value, c) =>
        isSubtotal({ col: left + c, row: top + r, absCol: false, absRow: false, sheet: range.start.sheet }) ? null : value));
    },
  };
}

/** A context whose reads treat cells in hidden rows as blank (SUBTOTAL 101-111). */
function withoutHiddenRows(context: IFormulaContext): IFormulaContext {
  const isRowHidden = context.isRowHidden?.bind(context);
  if (!isRowHidden) return context;
  return {
    ...context,
    getCellValue: address => isRowHidden(address.row, address.sheet) ? null : context.getCellValue(address),
    getRangeValues: range => {
      const data = context.getRangeValues(range);
      const top = Math.min(range.start.row, range.end.row);
      return data.map((row, r) => isRowHidden(top + r, range.start.sheet) ? row.map(() => null) : row);
    },
  };
}

/**
 * Aggregation and ranking over value lists/ranges: SUM, AVERAGE, MIN, MAX,
 * COUNT, COUNTA, PRODUCT, SUMPRODUCT, SUMSQ, SUBTOTAL, MEDIAN, LARGE, SMALL, RANK.
 */
export function registerMathAggregationFunctions(registry: Map<string, IFormulaFunction>): void {
  registry.set('SUM', {
    minArgs: 1,
    maxArgs: -1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const values = flattenArgs(args, context, evaluator, true);
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
      const values = flattenArgs(args, context, evaluator, true);
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
      const values = flattenArgs(args, context, evaluator, true);
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
      const values = flattenArgs(args, context, evaluator, true);
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
      const values = flattenArgs(args, context, evaluator, true);
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
      const values = flattenArgs(args, context, evaluator, true);
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
      const values = flattenArgs(args, context, evaluator, true);
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
            const v = arrays[a]?.[r]?.[c];
            if (v instanceof FormulaError) return v;
            product *= typeof v === 'number' ? v : 0;
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
      const values = flattenArgs(args, context, evaluator, true);
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
      if (rangeArg === undefined || (rangeArg.kind !== 'range' && rangeArg.kind !== 'cellRef')) {
        return new FormulaError('#VALUE!', 'LARGE first argument must be a range');
      }
      const rangeData = rangeArg.kind === 'range' ? context.getRangeValues({ start: rangeArg.start, end: rangeArg.end }) : [[context.getCellValue(rangeArg.address)]];
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
      if (rangeArg === undefined || (rangeArg.kind !== 'range' && rangeArg.kind !== 'cellRef')) {
        return new FormulaError('#VALUE!', 'SMALL first argument must be a range');
      }
      const rangeData = rangeArg.kind === 'range' ? context.getRangeValues({ start: rangeArg.start, end: rangeArg.end }) : [[context.getCellValue(rangeArg.address)]];
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

  // SUMSQ: references contribute only their numbers; direct arguments are
  // coerced (TRUE, "3"), and non-numeric direct text is #VALUE!, as in Excel.
  registry.set('SUMSQ', {
    minArgs: 1,
    maxArgs: -1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      let sum = 0;
      for (const arg of args) {
        if (arg.kind === 'range' || arg.kind === 'cellRef') {
          for (const value of flattenArgs([arg], context, evaluator)) {
            if (value instanceof FormulaError) return value;
            if (typeof value === 'number') sum += value * value;
          }
          continue;
        }
        const value = evaluator.evaluate(arg, context);
        if (value instanceof FormulaError) return value;
        if (Array.isArray(value)) {
          for (const row of value as unknown[][]) for (const cell of row) {
            if (cell instanceof FormulaError) return cell;
            if (typeof cell === 'number') sum += cell * cell;
          }
          continue;
        }
        const n = toNumber(value);
        if (n instanceof FormulaError) return n;
        sum += n * n;
      }
      return sum;
    },
  });

  // SUBTOTAL(function_num, ref1, ...): 1-11 and 101-111 map to AVERAGE, COUNT,
  // COUNTA, MAX, MIN, PRODUCT, STDEV, STDEVP, SUM, VAR, VARP. Cells holding
  // their own SUBTOTAL formula are skipped so nested subtotals don't double
  // count. 101-111 also skip rows the data accessor reports hidden
  // (`isRowHidden`); without that information they behave like 1-11.
  registry.set('SUBTOTAL', {
    minArgs: 2,
    maxArgs: -1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawCode = evalArg(evaluator, args[0], context);
      if (rawCode instanceof FormulaError) return rawCode;
      const code = toNumber(rawCode);
      if (code instanceof FormulaError) return code;
      const n = Math.trunc(code);
      const name = n >= 1 && n <= 11 ? SUBTOTAL_FUNCTIONS[n] : n >= 101 && n <= 111 ? SUBTOTAL_FUNCTIONS[n - 100] : undefined;
      const fn = name === undefined ? undefined : registry.get(name);
      if (fn === undefined) return new FormulaError('#VALUE!', 'SUBTOTAL function_num must be 1-11 or 101-111');
      const refs = args.slice(1);
      for (const ref of refs) {
        const isReference = ref.kind === 'range' || ref.kind === 'cellRef' || ref.kind === 'functionCall' && (ref.name === 'OFFSET' || ref.name === 'INDIRECT');
        if (!isReference) return new FormulaError('#VALUE!', 'SUBTOTAL arguments must be references');
      }
      const visible = n >= 101 ? withoutHiddenRows(context) : context;
      return fn.evaluate(refs, withoutSubtotalCells(visible), evaluator);
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
      if (rangeArg === undefined || (rangeArg.kind !== 'range' && rangeArg.kind !== 'cellRef')) {
        return new FormulaError('#VALUE!', 'RANK second argument must be a range');
      }
      const rangeData = rangeArg.kind === 'range' ? context.getRangeValues({ start: rangeArg.start, end: rangeArg.end }) : [[context.getCellValue(rangeArg.address)]];
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
