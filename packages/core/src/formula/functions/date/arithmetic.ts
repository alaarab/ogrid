import type { IFormulaFunction, IFormulaContext, IEvaluator, ASTNode } from '../../types';
import { FormulaError } from '../../types';
import { toNumber } from '../../evaluator';
import { toDate, isLeapYear, parseWeekendNumber } from './shared';

/**
 * Date arithmetic, differences, and business-day calculations: DATEDIF, EDATE,
 * EOMONTH, NETWORKDAYS, DAYS, DAYS360, ISOWEEKNUM, YEARFRAC, WORKDAY, WORKDAY.INTL.
 */
export function registerDateArithmeticFunctions(registry: Map<string, IFormulaFunction>): void {
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
      // Excel EDATE clamps the day to the last day of the target month rather
      // than overflowing (EDATE(2021-01-31, 1) is 2021-02-28, not 2021-03-03).
      // Set the day to 1 before shifting the month so setMonth can't roll over,
      // then clamp the original day-of-month to the target month's length.
      const result = new Date(date);
      const day = result.getDate();
      result.setDate(1);
      result.setMonth(result.getMonth() + Math.trunc(months));
      const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
      result.setDate(Math.min(day, lastDay));
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
