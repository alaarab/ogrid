import type { IFormulaFunction, IFormulaContext, IEvaluator, ASTNode } from '../../types';
import { FormulaError } from '../../types';
import { toNumber } from '../../evaluator';
import { toDate } from './shared';

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

  // --- DATEVALUE ---
  registry.set('DATEVALUE', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawVal = evaluator.evaluate(args[0], context);
      if (rawVal instanceof FormulaError) return rawVal;
      const str = typeof rawVal === 'string' ? rawVal : String(rawVal);
      const d = new Date(str);
      if (isNaN(d.getTime())) return new FormulaError('#VALUE!', `DATEVALUE cannot parse "${str}"`);
      // Return Excel-like serial (days since 1900-01-01, with Excel's 1900 leap year bug offset)
      // We return the Date object directly  -  consistent with how the engine handles dates
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    },
  });

  // --- TIMEVALUE ---
  registry.set('TIMEVALUE', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawVal = evaluator.evaluate(args[0], context);
      if (rawVal instanceof FormulaError) return rawVal;
      const str = typeof rawVal === 'string' ? rawVal : String(rawVal);
      const match = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?$/i);
      if (!match) return new FormulaError('#VALUE!', `TIMEVALUE cannot parse "${str}"`);
      let hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
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
      const rawH = evaluator.evaluate(args[0], context);
      if (rawH instanceof FormulaError) return rawH;
      const h = toNumber(rawH);
      if (h instanceof FormulaError) return h;
      const rawM = evaluator.evaluate(args[1], context);
      if (rawM instanceof FormulaError) return rawM;
      const m = toNumber(rawM);
      if (m instanceof FormulaError) return m;
      const rawS = evaluator.evaluate(args[2], context);
      if (rawS instanceof FormulaError) return rawS;
      const s = toNumber(rawS);
      if (s instanceof FormulaError) return s;
      const totalSeconds = Math.trunc(h) * 3600 + Math.trunc(m) * 60 + Math.trunc(s);
      return (totalSeconds % 86400) / 86400;
    },
  });
}
