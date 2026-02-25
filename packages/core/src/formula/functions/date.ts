import type { IFormulaFunction, IFormulaContext, IEvaluator, ASTNode } from '../types';
import { FormulaError } from '../types';
import { toNumber } from '../evaluator';

function toDate(val: unknown): Date | FormulaError {
  if (val instanceof FormulaError) return val;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return new FormulaError('#VALUE!', 'Invalid date');
    return val;
  }
  if (typeof val === 'string') {
    const d = new Date(val);
    if (isNaN(d.getTime())) return new FormulaError('#VALUE!', `Cannot parse "${val}" as date`);
    return d;
  }
  if (typeof val === 'number') {
    // Treat number as a timestamp
    const d = new Date(val);
    if (isNaN(d.getTime())) return new FormulaError('#VALUE!', 'Invalid numeric date');
    return d;
  }
  return new FormulaError('#VALUE!', 'Cannot convert value to date');
}

export function registerDateFunctions(registry: Map<string, IFormulaFunction>): void {
  registry.set('TODAY', {
    minArgs: 0,
    maxArgs: 0,
    evaluate(_args: ASTNode[], context: IFormulaContext): unknown {
      const now = context.now();
      // Return date with no time component
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    },
  });

  registry.set('NOW', {
    minArgs: 0,
    maxArgs: 0,
    evaluate(_args: ASTNode[], context: IFormulaContext): unknown {
      return context.now();
    },
  });

  registry.set('YEAR', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evaluator.evaluate(args[0], context);
      if (val instanceof FormulaError) return val;
      const date = toDate(val);
      if (date instanceof FormulaError) return date;
      return date.getFullYear();
    },
  });

  registry.set('MONTH', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evaluator.evaluate(args[0], context);
      if (val instanceof FormulaError) return val;
      const date = toDate(val);
      if (date instanceof FormulaError) return date;
      return date.getMonth() + 1; // 1-12
    },
  });

  registry.set('DAY', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evaluator.evaluate(args[0], context);
      if (val instanceof FormulaError) return val;
      const date = toDate(val);
      if (date instanceof FormulaError) return date;
      return date.getDate(); // 1-31
    },
  });

  registry.set('DATE', {
    minArgs: 3,
    maxArgs: 3,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawY = evaluator.evaluate(args[0], context);
      if (rawY instanceof FormulaError) return rawY;
      const y = toNumber(rawY);
      if (y instanceof FormulaError) return y;
      const rawM = evaluator.evaluate(args[1], context);
      if (rawM instanceof FormulaError) return rawM;
      const m = toNumber(rawM);
      if (m instanceof FormulaError) return m;
      const rawD = evaluator.evaluate(args[2], context);
      if (rawD instanceof FormulaError) return rawD;
      const d = toNumber(rawD);
      if (d instanceof FormulaError) return d;
      return new Date(Math.trunc(y), Math.trunc(m) - 1, Math.trunc(d));
    },
  });

  registry.set('DATEDIF', {
    minArgs: 3,
    maxArgs: 3,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawStart = evaluator.evaluate(args[0], context);
      if (rawStart instanceof FormulaError) return rawStart;
      const startDate = toDate(rawStart);
      if (startDate instanceof FormulaError) return startDate;
      const rawEnd = evaluator.evaluate(args[1], context);
      if (rawEnd instanceof FormulaError) return rawEnd;
      const endDate = toDate(rawEnd);
      if (endDate instanceof FormulaError) return endDate;
      const rawUnit = evaluator.evaluate(args[2], context);
      if (rawUnit instanceof FormulaError) return rawUnit;
      const unit = String(rawUnit).toUpperCase();
      if (startDate > endDate) return new FormulaError('#NUM!', 'DATEDIF start date must be <= end date');
      switch (unit) {
        case 'Y': {
          let years = endDate.getFullYear() - startDate.getFullYear();
          if (endDate.getMonth() < startDate.getMonth() ||
              (endDate.getMonth() === startDate.getMonth() && endDate.getDate() < startDate.getDate())) {
            years--;
          }
          return years;
        }
        case 'M': {
          let months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + endDate.getMonth() - startDate.getMonth();
          if (endDate.getDate() < startDate.getDate()) months--;
          return months;
        }
        case 'D':
          return Math.floor((endDate.getTime() - startDate.getTime()) / 86400000);
        default:
          return new FormulaError('#VALUE!', 'DATEDIF unit must be Y, M, or D');
      }
    },
  });

  registry.set('EDATE', {
    minArgs: 2,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawDate = evaluator.evaluate(args[0], context);
      if (rawDate instanceof FormulaError) return rawDate;
      const date = toDate(rawDate);
      if (date instanceof FormulaError) return date;
      const rawMonths = evaluator.evaluate(args[1], context);
      if (rawMonths instanceof FormulaError) return rawMonths;
      const months = toNumber(rawMonths);
      if (months instanceof FormulaError) return months;
      const result = new Date(date);
      result.setMonth(result.getMonth() + Math.trunc(months));
      return result;
    },
  });

  registry.set('EOMONTH', {
    minArgs: 2,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawDate = evaluator.evaluate(args[0], context);
      if (rawDate instanceof FormulaError) return rawDate;
      const date = toDate(rawDate);
      if (date instanceof FormulaError) return date;
      const rawMonths = evaluator.evaluate(args[1], context);
      if (rawMonths instanceof FormulaError) return rawMonths;
      const months = toNumber(rawMonths);
      if (months instanceof FormulaError) return months;
      // Last day of the target month
      const result = new Date(date.getFullYear(), date.getMonth() + Math.trunc(months) + 1, 0);
      return result;
    },
  });

  registry.set('WEEKDAY', {
    minArgs: 1,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawDate = evaluator.evaluate(args[0], context);
      if (rawDate instanceof FormulaError) return rawDate;
      const date = toDate(rawDate);
      if (date instanceof FormulaError) return date;
      let returnType = 1;
      if (args.length >= 2) {
        const rawRT = evaluator.evaluate(args[1], context);
        if (rawRT instanceof FormulaError) return rawRT;
        const rt = toNumber(rawRT);
        if (rt instanceof FormulaError) return rt;
        returnType = Math.trunc(rt);
      }
      const day = date.getDay(); // 0=Sun, 6=Sat
      switch (returnType) {
        case 1: return day + 1; // 1=Sun, 7=Sat
        case 2: return day === 0 ? 7 : day; // 1=Mon, 7=Sun
        case 3: return day === 0 ? 6 : day - 1; // 0=Mon, 6=Sun
        default: return new FormulaError('#VALUE!', 'WEEKDAY return_type must be 1, 2, or 3');
      }
    },
  });

  registry.set('HOUR', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evaluator.evaluate(args[0], context);
      if (val instanceof FormulaError) return val;
      const date = toDate(val);
      if (date instanceof FormulaError) return date;
      return date.getHours();
    },
  });

  registry.set('MINUTE', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evaluator.evaluate(args[0], context);
      if (val instanceof FormulaError) return val;
      const date = toDate(val);
      if (date instanceof FormulaError) return date;
      return date.getMinutes();
    },
  });

  registry.set('SECOND', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evaluator.evaluate(args[0], context);
      if (val instanceof FormulaError) return val;
      const date = toDate(val);
      if (date instanceof FormulaError) return date;
      return date.getSeconds();
    },
  });

  registry.set('NETWORKDAYS', {
    minArgs: 2,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawStart = evaluator.evaluate(args[0], context);
      if (rawStart instanceof FormulaError) return rawStart;
      const startDate = toDate(rawStart);
      if (startDate instanceof FormulaError) return startDate;
      const rawEnd = evaluator.evaluate(args[1], context);
      if (rawEnd instanceof FormulaError) return rawEnd;
      const endDate = toDate(rawEnd);
      if (endDate instanceof FormulaError) return endDate;
      const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
      const sign = end >= start ? 1 : -1;
      const [from, to] = sign === 1 ? [start, end] : [end, start];
      let count = 0;
      const current = new Date(from);
      while (current <= to) {
        const day = current.getDay();
        if (day !== 0 && day !== 6) count++;
        current.setDate(current.getDate() + 1);
      }
      return count * sign;
    },
  });
}
