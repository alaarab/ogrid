import { FormulaError, type ASTNode, type IFormulaContext, type IEvaluator, type IFormulaFunction } from '../types';
import { compareValues, evalArg, logicalValue, toNumber } from '../evaluator';
import { asArray, checkArraySize, transpose } from '../arrays';

function numberArg(args: ASTNode[], index: number, fallback: number, context: IFormulaContext, evaluator: IEvaluator): number | FormulaError {
  const value = args[index] ? evalArg(evaluator, args[index], context) : undefined;
  return value === undefined ? fallback : toNumber(value);
}

function boolArg(args: ASTNode[], index: number, context: IFormulaContext, evaluator: IEvaluator): boolean | FormulaError {
  const value = args[index] ? evalArg(evaluator, args[index], context) : undefined;
  return value === undefined ? false : logicalValue(value);
}

export function registerDynamicArrayFunctions(registry: Map<string, IFormulaFunction>): void {
  for (const name of ['SEQUENCE', 'RANDARRAY']) registry.set(name, {
    minArgs: name === 'SEQUENCE' ? 1 : 0,
    maxArgs: name === 'SEQUENCE' ? 4 : 5,
    evaluate(args, context, evaluator) {
      const numbers = [0, 1, 2, 3].map((i) => numberArg(args, i, name === 'SEQUENCE' ? 1 : i < 2 ? 1 : i === 2 ? 0 : 1, context, evaluator));
      for (const value of numbers) if (value instanceof FormulaError) return value;
      const [rawRows = 1, rawCols = 1, start = 1, step = 1] = numbers as number[];
      const rows = Math.trunc(rawRows), cols = Math.trunc(rawCols);
      checkArraySize(rows, cols, context);
      const whole = name === 'RANDARRAY' ? boolArg(args, 4, context, evaluator) : false;
      if (whole instanceof FormulaError) return whole;
      if (name === 'RANDARRAY' && (start > step || whole && Math.ceil(start) > Math.floor(step))) return new FormulaError('#VALUE!', 'Invalid random bounds');
      return Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => {
        const value = name === 'SEQUENCE' ? start + (r * cols + c) * step
          : whole ? Math.floor(Math.random() * (Math.floor(step) - Math.ceil(start) + 1)) + Math.ceil(start)
          : start + Math.random() * (step - start);
        return Number.isFinite(value) ? value : new FormulaError('#NUM!');
      }));
    },
  });

  registry.set('TRANSPOSE', {
    minArgs: 1, maxArgs: 1,
    evaluate(args, context, evaluator) {
      const value = evalArg(evaluator, args[0], context);
      return value instanceof FormulaError ? value : transpose(asArray(value));
    },
  });

  registry.set('UNIQUE', {
    minArgs: 1, maxArgs: 3,
    evaluate(args, context, evaluator) {
      const value = evalArg(evaluator, args[0], context);
      if (value instanceof FormulaError) return value;
      const byCol = boolArg(args, 1, context, evaluator), exactlyOnce = boolArg(args, 2, context, evaluator);
      if (byCol instanceof FormulaError) return byCol;
      if (exactlyOnce instanceof FormulaError) return exactlyOnce;
      const array = byCol ? transpose(asArray(value)) : asArray(value);
      // Typed, case-insensitive row keys preserve first occurrence and avoid quadratic comparisons.
      const groups = new Map<string, { row: unknown[]; count: number }>();
      for (const row of array) {
        context.consumeWork?.(row.length);
        const key = JSON.stringify(row.map(v => v instanceof FormulaError ? ['error', v.type] : v instanceof Date ? ['date', v.getTime()] : [typeof v, typeof v === 'string' ? v.toLowerCase() : v ?? 0]));
        const group = groups.get(key);
        if (group) group.count++;
        else groups.set(key, { row, count: 1 });
      }
      const result = [...groups.values()].filter(g => !exactlyOnce || g.count === 1).map(g => g.row);
      if (!result.length) return new FormulaError('#CALC!', 'Empty array');
      return byCol ? transpose(result) : result;
    },
  });

  registry.set('FILTER', {
    minArgs: 2, maxArgs: 3,
    evaluate(args, context, evaluator) {
      const value = evalArg(evaluator, args[0], context), include = evalArg(evaluator, args[1], context);
      if (value instanceof FormulaError) return value;
      if (include instanceof FormulaError) return include;
      const array = asArray(value), mask = asArray(include);
      const vertical = mask.length === array.length && mask[0]?.length === 1;
      const horizontal = mask.length === 1 && mask[0]?.length === array[0]?.length;
      if (!vertical && !horizontal) return new FormulaError('#VALUE!', 'FILTER dimensions do not match');
      const keep: boolean[] = [];
      for (const v of vertical ? mask.map(r => r[0]) : mask[0] ?? []) {
        const logical = typeof v === 'string' && v !== '' && !/^(TRUE|FALSE)$/i.test(v) ? new FormulaError('#VALUE!') : logicalValue(v === '' ? false : v);
        if (logical instanceof FormulaError) return logical;
        keep.push(logical);
      }
      const result = vertical ? array.filter((_, r) => keep[r]) : array.map(row => row.filter((_, c) => keep[c]));
      if (!result.length || !result[0]?.length) return args[2] ? evalArg(evaluator, args[2], context) : new FormulaError('#CALC!', 'Empty array');
      return result;
    },
  });

  registry.set('SORT', {
    minArgs: 1, maxArgs: 4,
    evaluate(args, context, evaluator) {
      const value = evalArg(evaluator, args[0], context);
      if (value instanceof FormulaError) return value;
      const index = numberArg(args, 1, 1, context, evaluator), order = numberArg(args, 2, 1, context, evaluator), byCol = boolArg(args, 3, context, evaluator);
      if (index instanceof FormulaError) return index;
      if (order instanceof FormulaError) return order;
      if (byCol instanceof FormulaError) return byCol;
      const array = byCol ? transpose(asArray(value)) : asArray(value);
      if (index < 1 || index > (array[0]?.length ?? 0) || (order !== 1 && order !== -1)) return new FormulaError('#VALUE!', 'Invalid sort arguments');
      const result = array.slice().sort((a, b) => { context.consumeWork?.(1); return order * compareValues(a[Math.trunc(index) - 1], b[Math.trunc(index) - 1]); });
      return byCol ? transpose(result) : result;
    },
  });

  registry.set('SORTBY', {
    minArgs: 2, maxArgs: -1,
    evaluate(args, context, evaluator) {
      const value = evalArg(evaluator, args[0], context);
      if (value instanceof FormulaError) return value;
      const array = asArray(value);
      const keys: Array<{ values: unknown[]; order: number }> = [];
      let byCol: boolean | undefined;
      for (let i = 1; i < args.length; i += 2) {
        const key = evalArg(evaluator, args[i], context), order = numberArg(args, i + 1, 1, context, evaluator);
        if (key instanceof FormulaError) return key;
        if (order instanceof FormulaError) return order;
        const k = asArray(key);
        const horizontal = k.length === 1 && k[0]?.length === array[0]?.length;
        const vertical = k.length === array.length && k[0]?.length === 1;
        if ((!horizontal && !vertical) || (byCol !== undefined && byCol !== !vertical) || (order !== 1 && order !== -1)) return new FormulaError('#VALUE!', 'SORTBY dimensions or order do not match');
        byCol = !vertical;
        keys.push({ values: vertical ? k.map(r => r[0]) : k[0] ?? [], order });
      }
      const rows = byCol ? transpose(array) : array;
      const indices = rows.map((_, i) => i).sort((a, b) => {
        for (const key of keys) {
          context.consumeWork?.(1);
          const comparison = key.order * compareValues(key.values[a], key.values[b]);
          if (comparison) return comparison;
        }
        return a - b;
      });
      const result = indices.map(i => rows[i] ?? []);
      return byCol ? transpose(result) : result;
    },
  });
}
