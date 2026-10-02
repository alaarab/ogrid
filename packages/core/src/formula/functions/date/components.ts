import type { IFormulaFunction, IFormulaContext, IEvaluator, ASTNode } from '../../types';
import { FormulaError } from '../../types';
import { toNumber, evalArg } from '../../evaluator';
import { toDate, dateToSerial, utcDate, serialDay, serialToDate, weekday } from './shared';

/**
 * Date/time component access, construction, and parsing: TODAY, NOW, YEAR,
 * MONTH, DAY, DATE, HOUR, MINUTE, SECOND, WEEKDAY, TIME, DATEVALUE, TIMEVALUE.
 */
export function registerDateComponentFunctions(registry: Map<string, IFormulaFunction>): void {
  registry.set('TODAY', {
    minArgs: 0,
    maxArgs: 0,
    evaluate(_args: ASTNode[], context: IFormulaContext): unknown {
      const now = context.now();
      // Return date with no time component
      return utcDate(now.getFullYear(), now.getMonth(), now.getDate());
    },
  });

  registry.set('NOW', {
    minArgs: 0,
    maxArgs: 0,
    evaluate(_args: ASTNode[], context: IFormulaContext): unknown {
      const now = context.now();
      const date = utcDate(now.getFullYear(), now.getMonth(), now.getDate());
      // Local wall-clock time in UTC fields, matching TODAY and the date columns.
      date.setUTCHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
      return date;
    },
  });

  registry.set('YEAR', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evalArg(evaluator, args[0], context);
      if (val instanceof FormulaError) return val;
      const date = toDate(val);
      if (date instanceof FormulaError) return date;
      return date.getUTCFullYear();
    },
  });

  registry.set('MONTH', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evalArg(evaluator, args[0], context);
      if (val instanceof FormulaError) return val;
      const date = toDate(val);
      if (date instanceof FormulaError) return date;
      return date.getUTCMonth() + 1; // 1-12
    },
  });

  registry.set('DAY', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evalArg(evaluator, args[0], context);
      if (val instanceof FormulaError) return val;
      const date = toDate(val);
      if (date instanceof FormulaError) return date;
      return serialDay(val) === 60 ? 29 : date.getUTCDate(); // 1-31
    },
  });

  registry.set('DATE', {
    minArgs: 3,
    maxArgs: 3,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawY = evalArg(evaluator, args[0], context);
      if (rawY instanceof FormulaError) return rawY;
      const y = toNumber(rawY);
      if (y instanceof FormulaError) return y;
      const rawM = evalArg(evaluator, args[1], context);
      if (rawM instanceof FormulaError) return rawM;
      const m = toNumber(rawM);
      if (m instanceof FormulaError) return m;
      const rawD = evalArg(evaluator, args[2], context);
      if (rawD instanceof FormulaError) return rawD;
      const d = toNumber(rawD);
      if (d instanceof FormulaError) return d;
      const year = Math.trunc(y) < 1900 ? Math.trunc(y) + 1900 : Math.trunc(y);
      if (y < 0 || year > 9999) return new FormulaError('#NUM!', 'Invalid year');
      // Include Excel's fictitious leap day when normalising day overflow.
      const first = dateToSerial(utcDate(year, Math.trunc(m) - 1, 1));
      if (first instanceof FormulaError) return first;
      const result = first + Math.trunc(d) - 1;
      const date = toDate(result);
      return date instanceof FormulaError ? new FormulaError('#NUM!', 'Invalid date') : date;
    },
  });

  registry.set('WEEKDAY', {
    minArgs: 1,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawDate = evalArg(evaluator, args[0], context);
      if (rawDate instanceof FormulaError) return rawDate;
      const date = toDate(rawDate);
      if (date instanceof FormulaError) return date;
      let returnType = 1;
      if (args.length >= 2) {
        const rawRT = evalArg(evaluator, args[1], context);
        if (rawRT instanceof FormulaError) return rawRT;
        const rt = toNumber(rawRT);
        if (rt instanceof FormulaError) return rt;
        returnType = Math.trunc(rt);
      }
      const serial = serialDay(rawDate);
      if (serial instanceof FormulaError) return serial;
      const day = (weekday(serial) + 1) % 7; // 0=Sun, 6=Sat
      switch (returnType) {
        case 1: return day + 1; // 1=Sun, 7=Sat
        case 2: return day === 0 ? 7 : day; // 1=Mon, 7=Sun
        case 3: return day === 0 ? 6 : day - 1; // 0=Mon, 6=Sun
        default:
          if (returnType >= 11 && returnType <= 17) return (day - (returnType - 10) + 7) % 7 + 1;
          return new FormulaError('#NUM!', 'Invalid WEEKDAY return_type');
      }
    },
  });

  registry.set('HOUR', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evalArg(evaluator, args[0], context);
      if (val instanceof FormulaError) return val;
      const date = toDate(val);
      if (date instanceof FormulaError) return date;
      return date.getUTCHours();
    },
  });

  registry.set('MINUTE', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evalArg(evaluator, args[0], context);
      if (val instanceof FormulaError) return val;
      const date = toDate(val);
      if (date instanceof FormulaError) return date;
      return date.getUTCMinutes();
    },
  });

  registry.set('SECOND', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const val = evalArg(evaluator, args[0], context);
      if (val instanceof FormulaError) return val;
      const date = toDate(val);
      if (date instanceof FormulaError) return date;
      return date.getUTCSeconds();
    },
  });

  // --- DATEVALUE ---
  registry.set('DATEVALUE', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawVal = evalArg(evaluator, args[0], context);
      if (rawVal instanceof FormulaError) return rawVal;
      return serialToDate(serialDay(rawVal));
    },
  });

  // --- TIMEVALUE ---
  registry.set('TIMEVALUE', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawVal = evalArg(evaluator, args[0], context);
      if (rawVal instanceof FormulaError) return rawVal;
      const str = typeof rawVal === 'string' ? rawVal : String(rawVal);
      const match = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?$/i);
      const hourStr = match?.[1];
      const minuteStr = match?.[2];
      if (!match || hourStr === undefined || minuteStr === undefined) {
        return new FormulaError('#VALUE!', `TIMEVALUE cannot parse "${str}"`);
      }
      let hours = parseInt(hourStr, 10);
      const minutes = parseInt(minuteStr, 10);
      const seconds = match[3] ? parseInt(match[3], 10) : 0;
      const ampm = match[4] ? match[4].toUpperCase() : null;
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
      if (hours > 23 || minutes > 59 || seconds > 59) {
        return new FormulaError('#VALUE!', 'TIMEVALUE: invalid time component');
      }
      return (hours * 3600 + minutes * 60 + seconds) / 86400;
    },
  });

  // --- TIME ---
  registry.set('TIME', {
    minArgs: 3,
    maxArgs: 3,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawH = evalArg(evaluator, args[0], context);
      if (rawH instanceof FormulaError) return rawH;
      const h = toNumber(rawH);
      if (h instanceof FormulaError) return h;
      const rawM = evalArg(evaluator, args[1], context);
      if (rawM instanceof FormulaError) return rawM;
      const m = toNumber(rawM);
      if (m instanceof FormulaError) return m;
      const rawS = evalArg(evaluator, args[2], context);
      if (rawS instanceof FormulaError) return rawS;
      const s = toNumber(rawS);
      if (s instanceof FormulaError) return s;
      const totalSeconds = Math.trunc(h) * 3600 + Math.trunc(m) * 60 + Math.trunc(s);
      if (totalSeconds < 0 || h < 0 || m < 0 || s < 0) return new FormulaError('#NUM!', 'Negative time');
      return (totalSeconds % 86400) / 86400;
    },
  });
}
