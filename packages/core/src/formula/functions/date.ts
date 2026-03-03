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

  // --- DAYS ---
  registry.set('DAYS', {
    minArgs: 2,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawEnd = evaluator.evaluate(args[0], context);
      if (rawEnd instanceof FormulaError) return rawEnd;
      const endDate = toDate(rawEnd);
      if (endDate instanceof FormulaError) return endDate;
      const rawStart = evaluator.evaluate(args[1], context);
      if (rawStart instanceof FormulaError) return rawStart;
      const startDate = toDate(rawStart);
      if (startDate instanceof FormulaError) return startDate;
      const endMs = Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
      const startMs = Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      return Math.round((endMs - startMs) / 86400000);
    },
  });

  // --- DAYS360 ---
  registry.set('DAYS360', {
    minArgs: 2,
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

      let method = false;
      if (args.length >= 3) {
        const rawMethod = evaluator.evaluate(args[2], context);
        if (rawMethod instanceof FormulaError) return rawMethod;
        method = !!rawMethod;
      }

      const sm = startDate.getMonth() + 1;
      const em = endDate.getMonth() + 1;
      let sd = startDate.getDate();
      let ed = endDate.getDate();
      const sy = startDate.getFullYear();
      const ey = endDate.getFullYear();

      if (!method) {
        // US method (NASD): cap start day and end day at 30
        if (sd === 31) sd = 30;
        if (ed === 31 && sd === 30) ed = 30;
      } else {
        // European method: cap both at 30
        if (sd === 31) sd = 30;
        if (ed === 31) ed = 30;
      }

      return (ey - sy) * 360 + (em - sm) * 30 + (ed - sd);
    },
  });

  // --- ISOWEEKNUM ---
  registry.set('ISOWEEKNUM', {
    minArgs: 1,
    maxArgs: 1,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawDate = evaluator.evaluate(args[0], context);
      if (rawDate instanceof FormulaError) return rawDate;
      const date = toDate(rawDate);
      if (date instanceof FormulaError) return date;
      // ISO 8601: week containing the first Thursday
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      // Set to nearest Thursday: current date + 4 - current day number (Mon=1)
      const day = d.getUTCDay() || 7; // ISO: Mon=1, Sun=7
      d.setUTCDate(d.getUTCDate() + 4 - day);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    },
  });

  // --- YEARFRAC ---
  registry.set('YEARFRAC', {
    minArgs: 2,
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

      let basis = 0;
      if (args.length >= 3) {
        const rawBasis = evaluator.evaluate(args[2], context);
        if (rawBasis instanceof FormulaError) return rawBasis;
        const b = toNumber(rawBasis);
        if (b instanceof FormulaError) return b;
        basis = Math.trunc(b);
      }

      const sy = startDate.getFullYear();
      const sm = startDate.getMonth() + 1;
      const sd = startDate.getDate();
      const ey = endDate.getFullYear();
      const em = endDate.getMonth() + 1;
      const ed = endDate.getDate();

      switch (basis) {
        case 0: {
          // US 30/360
          const startDay = sd === 31 ? 30 : sd;
          const endDay = ed === 31 && startDay === 30 ? 30 : ed;
          const days360 = (ey - sy) * 360 + (em - sm) * 30 + (endDay - startDay);
          return days360 / 360;
        }
        case 1: {
          // Actual/Actual
          const diffMs = Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd);
          const diffDays = diffMs / 86400000;
          // Average days in year between start and end
          const avgYear = (ey === sy)
            ? (isLeapYear(sy) ? 366 : 365)
            : ((Date.UTC(ey + 1, 0, 1) - Date.UTC(sy, 0, 1)) / 86400000) / (ey - sy + 1);
          return diffDays / avgYear;
        }
        case 3: {
          // Actual/365
          const diffMs = Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd);
          return (diffMs / 86400000) / 365;
        }
        default:
          return new FormulaError('#VALUE!', 'YEARFRAC basis must be 0, 1, or 3');
      }
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

  // --- WORKDAY ---
  registry.set('WORKDAY', {
    minArgs: 2,
    maxArgs: 3,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawStart = evaluator.evaluate(args[0], context);
      if (rawStart instanceof FormulaError) return rawStart;
      const startDate = toDate(rawStart);
      if (startDate instanceof FormulaError) return startDate;
      const rawDays = evaluator.evaluate(args[1], context);
      if (rawDays instanceof FormulaError) return rawDays;
      const daysNum = toNumber(rawDays);
      if (daysNum instanceof FormulaError) return daysNum;
      const days = Math.trunc(daysNum);

      // Build holiday set (as UTC date strings for comparison)
      const holidaySet = new Set<string>();
      if (args.length >= 3) {
        const rawHol = args[2];
        let holVals: unknown[];
        if (rawHol.kind === 'range') {
          holVals = context.getRangeValues({ start: rawHol.start, end: rawHol.end }).flat();
        } else {
          holVals = [evaluator.evaluate(rawHol, context)];
        }
        for (const hv of holVals) {
          if (hv === null || hv === undefined) continue;
          const hd = toDate(hv);
          if (!(hd instanceof FormulaError)) {
            holidaySet.add(`${hd.getFullYear()}-${hd.getMonth()}-${hd.getDate()}`);
          }
        }
      }

      const current = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      const step = days >= 0 ? 1 : -1;
      let remaining = Math.abs(days);
      while (remaining > 0) {
        current.setDate(current.getDate() + step);
        const dow = current.getDay();
        if (dow === 0 || dow === 6) continue; // weekend
        const key = `${current.getFullYear()}-${current.getMonth()}-${current.getDate()}`;
        if (holidaySet.has(key)) continue; // holiday
        remaining--;
      }
      return current;
    },
  });

  // --- WORKDAY.INTL ---
  registry.set('WORKDAY.INTL', {
    minArgs: 2,
    maxArgs: 4,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawStart = evaluator.evaluate(args[0], context);
      if (rawStart instanceof FormulaError) return rawStart;
      const startDate = toDate(rawStart);
      if (startDate instanceof FormulaError) return startDate;
      const rawDays = evaluator.evaluate(args[1], context);
      if (rawDays instanceof FormulaError) return rawDays;
      const daysNum = toNumber(rawDays);
      if (daysNum instanceof FormulaError) return daysNum;
      const days = Math.trunc(daysNum);

      // Parse weekend mask: "0000011" string or Excel weekend number 1-17
      let weekendMask = [false, false, false, false, false, true, true]; // Mon-Sun, default Sat+Sun
      if (args.length >= 3) {
        const rawWeekend = evaluator.evaluate(args[2], context);
        if (rawWeekend instanceof FormulaError) return rawWeekend;
        if (typeof rawWeekend === 'string' && /^[01]{7}$/.test(rawWeekend)) {
          weekendMask = rawWeekend.split('').map(c => c === '1');
        } else {
          const wn = toNumber(rawWeekend);
          if (wn instanceof FormulaError) return wn;
          const parsed = parseWeekendNumber(Math.trunc(wn));
          if (!parsed) return new FormulaError('#VALUE!', 'WORKDAY.INTL invalid weekend number');
          weekendMask = parsed;
        }
      }

      // Build holiday set
      const holidaySet = new Set<string>();
      if (args.length >= 4) {
        const rawHol = args[3];
        let holVals: unknown[];
        if (rawHol.kind === 'range') {
          holVals = context.getRangeValues({ start: rawHol.start, end: rawHol.end }).flat();
        } else {
          holVals = [evaluator.evaluate(rawHol, context)];
        }
        for (const hv of holVals) {
          if (hv === null || hv === undefined) continue;
          const hd = toDate(hv);
          if (!(hd instanceof FormulaError)) {
            holidaySet.add(`${hd.getFullYear()}-${hd.getMonth()}-${hd.getDate()}`);
          }
        }
      }

      const current = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      const step = days >= 0 ? 1 : -1;
      let remaining = Math.abs(days);
      while (remaining > 0) {
        current.setDate(current.getDate() + step);
        // getDay() returns 0=Sun..6=Sat; mask is Mon(0)..Sun(6)
        const dow = current.getDay();
        const maskIndex = dow === 0 ? 6 : dow - 1; // convert Sun=0 to index 6, Mon=1 to index 0
        if (weekendMask[maskIndex]) continue;
        const key = `${current.getFullYear()}-${current.getMonth()}-${current.getDate()}`;
        if (holidaySet.has(key)) continue;
        remaining--;
      }
      return current;
    },
  });
}

/** Determine if a year is a leap year. */
function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Parse Excel weekend number (1-17) into a Mon-Sun boolean mask.
 * true = weekend (non-working).
 */
function parseWeekendNumber(n: number): boolean[] | null {
  // Mon=idx 0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6
  // Excel weekend numbers per spec:
  // 1=Sat+Sun, 2=Sun+Mon, 3=Mon+Tue, 4=Tue+Wed, 5=Wed+Thu, 6=Thu+Fri, 7=Fri+Sat
  // 11=Sun only, 12=Mon only, 13=Tue only, 14=Wed only, 15=Thu only, 16=Fri only, 17=Sat only
  const twoDay: [number, number][] = [
    [5, 6], // 1: Sat+Sun
    [6, 0], // 2: Sun+Mon  (Sun=index6, Mon=index0)
    [0, 1], // 3: Mon+Tue
    [1, 2], // 4: Tue+Wed
    [2, 3], // 5: Wed+Thu
    [3, 4], // 6: Thu+Fri
    [4, 5], // 7: Fri+Sat
  ];
  if (n >= 1 && n <= 7) {
    const mask = [false, false, false, false, false, false, false];
    const [a, b] = twoDay[n - 1];
    mask[a] = true;
    mask[b] = true;
    return mask;
  }
  if (n >= 11 && n <= 17) {
    const mask = [false, false, false, false, false, false, false];
    // 11=Sun(6), 12=Mon(0), 13=Tue(1), 14=Wed(2), 15=Thu(3), 16=Fri(4), 17=Sat(5)
    const singleDay = [6, 0, 1, 2, 3, 4, 5];
    mask[singleDay[n - 11]] = true;
    return mask;
  }
  return null;
}
