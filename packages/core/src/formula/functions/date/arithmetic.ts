import type { IFormulaFunction, IFormulaContext, IEvaluator, ASTNode } from '../../types';
import { FormulaError } from '../../types';
import { toNumber, evalArg, flattenArgs } from '../../evaluator';
import { toDate, isLeapYear, parseWeekendNumber, dateToSerial, utcDate, serialDay, serialToDate, weekday, MAX_DATE_SERIAL } from './shared';

/**
 * Date arithmetic, differences, and business-day calculations: DATEDIF, EDATE,
 * EOMONTH, NETWORKDAYS, DAYS, DAYS360, ISOWEEKNUM, YEARFRAC, WORKDAY, WORKDAY.INTL.
 */
export function registerDateArithmeticFunctions(registry: Map<string, IFormulaFunction>): void {
  registry.set('DATEDIF', {
    minArgs: 3,
    maxArgs: 3,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawStart = evalArg(evaluator, args[0], context);
      if (rawStart instanceof FormulaError) return rawStart;
      const startDate = toDate(rawStart);
      if (startDate instanceof FormulaError) return startDate;
      const rawEnd = evalArg(evaluator, args[1], context);
      if (rawEnd instanceof FormulaError) return rawEnd;
      const endDate = toDate(rawEnd);
      if (endDate instanceof FormulaError) return endDate;
      const rawUnit = evalArg(evaluator, args[2], context);
      if (rawUnit instanceof FormulaError) return rawUnit;
      const unit = String(rawUnit).toUpperCase();
      const startSerial = serialDay(rawStart);
      const endSerial = serialDay(rawEnd);
      if (startSerial instanceof FormulaError) return startSerial;
      if (endSerial instanceof FormulaError) return endSerial;
      if (startSerial > endSerial) return new FormulaError('#NUM!', 'DATEDIF start date must be <= end date');
      switch (unit) {
        case 'Y': {
          let years = endDate.getUTCFullYear() - startDate.getUTCFullYear();
          if (endDate.getUTCMonth() < startDate.getUTCMonth() ||
              (endDate.getUTCMonth() === startDate.getUTCMonth() && endDate.getUTCDate() < startDate.getUTCDate())) {
            years--;
          }
          return years;
        }
        case 'M': {
          let months = (endDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12 + endDate.getUTCMonth() - startDate.getUTCMonth();
          if (endDate.getUTCDate() < startDate.getUTCDate()) months--;
          return months;
        }
        case 'D': {
          const start = serialDay(rawStart);
          const end = serialDay(rawEnd);
          if (start instanceof FormulaError) return start;
          if (end instanceof FormulaError) return end;
          return end - start;
        }
        case 'YM': {
          const months = (endDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12 + endDate.getUTCMonth() - startDate.getUTCMonth() - (endDate.getUTCDate() < startDate.getUTCDate() ? 1 : 0);
          return months % 12;
        }
        case 'MD': {
          const day = endDate.getUTCDate() - startDate.getUTCDate();
          return day >= 0 ? day : day + utcDate(endDate.getUTCFullYear(), endDate.getUTCMonth(), 0).getUTCDate();
        }
        case 'YD': {
          const year = endDate.getUTCFullYear() - (endDate.getUTCMonth() < startDate.getUTCMonth() || (endDate.getUTCMonth() === startDate.getUTCMonth() && endDate.getUTCDate() < startDate.getUTCDate()) ? 1 : 0);
          return Math.floor((endDate.getTime() - utcDate(year, startDate.getUTCMonth(), startDate.getUTCDate()).getTime()) / 86400000);
        }
        default:
          return new FormulaError('#VALUE!', 'Invalid DATEDIF unit');
      }
    },
  });

  registry.set('EDATE', {
    minArgs: 2,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawDate = evalArg(evaluator, args[0], context);
      if (rawDate instanceof FormulaError) return rawDate;
      const date = toDate(rawDate);
      if (date instanceof FormulaError) return date;
      const rawMonths = evalArg(evaluator, args[1], context);
      if (rawMonths instanceof FormulaError) return rawMonths;
      const months = toNumber(rawMonths);
      if (months instanceof FormulaError) return months;
      // Excel EDATE clamps the day to the last day of the target month rather
      // than overflowing (EDATE(2021-01-31, 1) is 2021-02-28, not 2021-03-03).
      // Set the day to 1 before shifting the month so setMonth can't roll over,
      // then clamp the original day-of-month to the target month's length.
      const result = new Date(date);
      const day = serialDay(rawDate) === 60 ? 29 : result.getUTCDate();
      result.setUTCDate(1);
      result.setUTCMonth(result.getUTCMonth() + Math.trunc(months));
      const leapMonth = result.getUTCFullYear() === 1900 && result.getUTCMonth() === 1;
      const lastDay = leapMonth ? 29 : utcDate(result.getUTCFullYear(), result.getUTCMonth() + 1, 0).getUTCDate();
      if (leapMonth && Math.min(day, lastDay) === 29) return toDate(60);
      result.setUTCDate(Math.min(day, lastDay));
      return serialToDate(dateToSerial(result));
    },
  });

  registry.set('EOMONTH', {
    minArgs: 2,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawDate = evalArg(evaluator, args[0], context);
      if (rawDate instanceof FormulaError) return rawDate;
      const date = toDate(rawDate);
      if (date instanceof FormulaError) return date;
      const rawMonths = evalArg(evaluator, args[1], context);
      if (rawMonths instanceof FormulaError) return rawMonths;
      const months = toNumber(rawMonths);
      if (months instanceof FormulaError) return months;
      // Last day of the target month
      const result = utcDate(date.getUTCFullYear(), date.getUTCMonth() + Math.trunc(months) + 1, 0);
      if (result.getUTCFullYear() === 1900 && result.getUTCMonth() === 1) return toDate(60);
      return serialToDate(dateToSerial(result));
    },
  });

  registry.set('NETWORKDAYS', {
    minArgs: 2,
    maxArgs: 3,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const start = serialDay(evalArg(evaluator, args[0], context));
      if (start instanceof FormulaError) return start;
      const end = serialDay(evalArg(evaluator, args[1], context));
      if (end instanceof FormulaError) return end;
      const holidays = holidayDays(args[2], context, evaluator);
      if (holidays instanceof FormulaError) return holidays;
      const sign = end >= start ? 1 : -1;
      const from = Math.min(start, end);
      const to = Math.max(start, end);
      const mask = [false, false, false, false, false, true, true];
      let count = workingDays(from, to, mask);
      for (const holiday of holidays) if (holiday >= from && holiday <= to && !mask[weekday(holiday)]) count--;
      return count * sign;
    },
  });

  // --- DAYS ---
  registry.set('DAYS', {
    minArgs: 2,
    maxArgs: 2,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawEnd = evalArg(evaluator, args[0], context);
      if (rawEnd instanceof FormulaError) return rawEnd;
      const endDate = toDate(rawEnd);
      if (endDate instanceof FormulaError) return endDate;
      const rawStart = evalArg(evaluator, args[1], context);
      if (rawStart instanceof FormulaError) return rawStart;
      const startDate = toDate(rawStart);
      if (startDate instanceof FormulaError) return startDate;
      const start = serialDay(rawStart);
      const end = serialDay(rawEnd);
      if (start instanceof FormulaError) return start;
      if (end instanceof FormulaError) return end;
      return end - start;
    },
  });

  // --- DAYS360 ---
  registry.set('DAYS360', {
    minArgs: 2,
    maxArgs: 3,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawStart = evalArg(evaluator, args[0], context);
      if (rawStart instanceof FormulaError) return rawStart;
      const startDate = toDate(rawStart);
      if (startDate instanceof FormulaError) return startDate;
      const rawEnd = evalArg(evaluator, args[1], context);
      if (rawEnd instanceof FormulaError) return rawEnd;
      const endDate = toDate(rawEnd);
      if (endDate instanceof FormulaError) return endDate;

      let method = false;
      if (args.length >= 3) {
        const rawMethod = evalArg(evaluator, args[2], context);
        if (rawMethod instanceof FormulaError) return rawMethod;
        method = !!rawMethod;
      }

      const sm = startDate.getUTCMonth() + 1;
      const em = endDate.getUTCMonth() + 1;
      let sd = startDate.getUTCDate();
      let ed = endDate.getUTCDate();
      const sy = startDate.getUTCFullYear();
      const ey = endDate.getUTCFullYear();

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
      const rawDate = evalArg(evaluator, args[0], context);
      if (rawDate instanceof FormulaError) return rawDate;
      const date = toDate(rawDate);
      if (date instanceof FormulaError) return date;
      // ISO 8601: week containing the first Thursday
      const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
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
      const rawStart = evalArg(evaluator, args[0], context);
      if (rawStart instanceof FormulaError) return rawStart;
      const startDate = toDate(rawStart);
      if (startDate instanceof FormulaError) return startDate;
      const rawEnd = evalArg(evaluator, args[1], context);
      if (rawEnd instanceof FormulaError) return rawEnd;
      const endDate = toDate(rawEnd);
      if (endDate instanceof FormulaError) return endDate;

      let basis = 0;
      if (args.length >= 3) {
        const rawBasis = evalArg(evaluator, args[2], context);
        if (rawBasis instanceof FormulaError) return rawBasis;
        const b = toNumber(rawBasis);
        if (b instanceof FormulaError) return b;
        basis = Math.trunc(b);
      }

      const sy = startDate.getUTCFullYear();
      const sm = startDate.getUTCMonth() + 1;
      const sd = startDate.getUTCDate();
      const ey = endDate.getUTCFullYear();
      const em = endDate.getUTCMonth() + 1;
      const ed = endDate.getUTCDate();

      switch (basis) {
        case 4:
        case 0: {
          // US or European 30/360
          const startDay = sd === 31 ? 30 : sd;
          const endDay = ed === 31 && (basis === 4 || startDay === 30) ? 30 : ed;
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
        case 2:
        case 3: {
          // Actual/365
          const diffMs = Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd);
          return (diffMs / 86400000) / (basis === 2 ? 360 : 365);
        }
        default:
          return new FormulaError('#VALUE!', 'YEARFRAC basis must be 0 through 4');
      }
    },
  });

  // --- WORKDAY ---
  registry.set('WORKDAY', {
    minArgs: 2,
    maxArgs: 3,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawStart = evalArg(evaluator, args[0], context);
      if (rawStart instanceof FormulaError) return rawStart;
      const startDate = toDate(rawStart);
      if (startDate instanceof FormulaError) return startDate;
      const rawDays = evalArg(evaluator, args[1], context);
      if (rawDays instanceof FormulaError) return rawDays;
      const daysNum = toNumber(rawDays);
      if (daysNum instanceof FormulaError) return daysNum;
      const days = Math.trunc(daysNum);

      return serialToDate(workday(rawStart, days, [false, false, false, false, false, true, true], args[2], context, evaluator));
    },
  });

  // --- WORKDAY.INTL ---
  registry.set('WORKDAY.INTL', {
    minArgs: 2,
    maxArgs: 4,
    evaluate(args: ASTNode[], context: IFormulaContext, evaluator: IEvaluator): unknown {
      const rawStart = evalArg(evaluator, args[0], context);
      if (rawStart instanceof FormulaError) return rawStart;
      const startDate = toDate(rawStart);
      if (startDate instanceof FormulaError) return startDate;
      const rawDays = evalArg(evaluator, args[1], context);
      if (rawDays instanceof FormulaError) return rawDays;
      const daysNum = toNumber(rawDays);
      if (daysNum instanceof FormulaError) return daysNum;
      const days = Math.trunc(daysNum);

      // Parse weekend mask: "0000011" string or Excel weekend number 1-17
      let weekendMask = [false, false, false, false, false, true, true]; // Mon-Sun, default Sat+Sun
      if (args.length >= 3) {
        const rawWeekend = evalArg(evaluator, args[2], context);
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

      return serialToDate(workday(rawStart, days, weekendMask, args[3], context, evaluator));
    },
  });
}

function holidayDays(arg: ASTNode | undefined, context: IFormulaContext, evaluator: IEvaluator): Set<number> | FormulaError {
  const days = new Set<number>();
  if (!arg) return days;
  for (const value of flattenArgs([arg], context, evaluator)) {
    if (value === null || value === undefined || value === '') continue;
    const day = serialDay(value);
    if (day instanceof FormulaError) return day;
    days.add(day);
  }
  return days;
}

function workingDays(from: number, to: number, mask: boolean[]): number {
  const length = to - from + 1;
  const perWeek = mask.filter(day => !day).length;
  let count = Math.floor(length / 7) * perWeek;
  for (let i = 0; i < length % 7; i++) if (!mask[weekday(from + i)]) count++;
  return count;
}

function workday(startValue: unknown, days: number, mask: boolean[], holidaysArg: ASTNode | undefined, context: IFormulaContext, evaluator: IEvaluator): number | FormulaError {
  if (mask.every(Boolean)) return new FormulaError('#VALUE!', 'Weekend mask has no working days');
  if (!Number.isFinite(days) || Math.abs(days) >= MAX_DATE_SERIAL) return new FormulaError('#NUM!', 'Too many working days');
  const start = serialDay(startValue);
  if (start instanceof FormulaError) return start;
  if (days === 0) return start;
  const holidays = holidayDays(holidaysArg, context, evaluator);
  if (holidays instanceof FormulaError) return holidays;
  const step = days > 0 ? 1 : -1;
  const target = Math.abs(days);
  const count = (distance: number): number => {
    const from = step > 0 ? start + 1 : start - distance;
    const to = step > 0 ? start + distance : start - 1;
    let result = workingDays(from, to, mask);
    context.consumeWork?.(holidays.size);
    for (const holiday of holidays) if (holiday >= from && holiday <= to && !mask[weekday(holiday)]) result--;
    return result;
  };
  // Monotone search over the Excel date domain: at most 22 iterations.
  let low = 1;
  let high = step > 0 ? MAX_DATE_SERIAL - 1 - start : start;
  if (count(high) < target) return new FormulaError('#NUM!', 'Workday outside Excel date range');
  for (let i = 0; i < 22 && low < high; i++) {
    const mid = Math.floor((low + high) / 2);
    if (count(mid) >= target) high = mid;
    else low = mid + 1;
  }
  return start + step * low;
}
