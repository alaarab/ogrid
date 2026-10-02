import { FormulaError } from '../../types';

const DAY_MS = 86_400_000;
const EPOCH = Date.UTC(1899, 11, 31);
export const MAX_DATE_SERIAL = 2_958_466;
const leapDayDates = new WeakMap<Date, number>();

/** UTC calendar dates avoid timezone and DST shifts. Excel reserves serial 60 for 1900-02-29. */
export function dateToSerial(date: Date): number | FormulaError {
  const leapDay = leapDayDates.get(date);
  if (leapDay !== undefined) return leapDay;
  const days = (date.getTime() - EPOCH) / DAY_MS;
  const serial = days >= 60 ? days + 1 : days;
  return Number.isFinite(serial) && serial >= 0 && serial < MAX_DATE_SERIAL
    ? serial : new FormulaError('#NUM!', 'Date outside Excel date range');
}

export function utcDate(year: number, month: number, day: number): Date {
  const date = new Date(0);
  date.setUTCFullYear(year, month, day);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

export function toDate(val: unknown): Date | FormulaError {
  if (val instanceof FormulaError) return val;
  let date: Date;
  if (typeof val === 'number') {
    if (!Number.isFinite(val) || val < 0 || val >= MAX_DATE_SERIAL) return new FormulaError('#NUM!', 'Invalid serial date');
    const days = val >= 60 ? val - 1 : val;
    date = new Date(EPOCH + Math.round(days * DAY_MS));
    if (Math.floor(val) === 60) leapDayDates.set(date, val);
  } else if (val instanceof Date) {
    date = new Date(val);
    const leapDay = leapDayDates.get(val);
    if (leapDay !== undefined) leapDayDates.set(date, leapDay);
  } else if (typeof val === 'string' && val.length <= 32767) {
    // ISO dates/times without a zone represent the same calendar value everywhere.
    const leapDay = /^1900-02-29(?:$|T)/.test(val);
    const input = leapDay ? val.replace('1900-02-29', '1900-02-28') : val;
    const text = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(input) ? `${input}Z` : input;
    date = new Date(text);
    if (!/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(input) && !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(input) && !Number.isNaN(date.getTime())) {
      const local = date;
      date = utcDate(local.getFullYear(), local.getMonth(), local.getDate());
      date.setUTCHours(local.getHours(), local.getMinutes(), local.getSeconds(), local.getMilliseconds());
    }
    if (leapDay && !Number.isNaN(date.getTime())) leapDayDates.set(date, 60 + (date.getTime() - utcDate(1900, 1, 28).getTime()) / DAY_MS);
  } else return new FormulaError('#VALUE!', 'Cannot convert value to date');
  if (Number.isNaN(date.getTime())) return new FormulaError('#VALUE!', 'Invalid date');
  const serial = dateToSerial(date);
  if (serial instanceof FormulaError) return serial;
  return date;
}

/**
 * Date-producing functions return a Date at UTC midnight (the calendar day in
 * UTC fields, as date columns display it) rather than a bare serial, so the
 * grid and valueFormatter still receive dates. Arithmetic reads it as a serial.
 */
export function serialToDate(serial: number | FormulaError): Date | FormulaError {
  return serial instanceof FormulaError ? serial : toDate(serial);
}

export function serialDay(val: unknown): number | FormulaError {
  if (typeof val === 'number') {
    const date = toDate(val);
    return date instanceof FormulaError ? date : Math.floor(val);
  }
  const date = toDate(val);
  if (date instanceof FormulaError) return date;
  const serial = dateToSerial(date);
  return serial instanceof FormulaError ? serial : Math.floor(serial);
}

/** Monday=0 through Sunday=6, including Excel's pre-March-1900 weekday convention. */
export function weekday(serial: number): number {
  return ((Math.floor(serial) + 5) % 7 + 7) % 7;
}

/** Determine if a year is a leap year. */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Parse Excel weekend number (1-17) into a Mon-Sun boolean mask.
 * true = weekend (non-working).
 */
export function parseWeekendNumber(n: number): boolean[] | null {
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
    const pair = twoDay[n - 1];
    if (pair === undefined) return null;
    const mask = [false, false, false, false, false, false, false];
    const [a, b] = pair;
    mask[a] = true;
    mask[b] = true;
    return mask;
  }
  if (n >= 11 && n <= 17) {
    const mask = [false, false, false, false, false, false, false];
    // 11=Sun(6), 12=Mon(0), 13=Tue(1), 14=Wed(2), 15=Thu(3), 16=Fri(4), 17=Sat(5)
    const singleDay = [6, 0, 1, 2, 3, 4, 5];
    const dayIdx = singleDay[n - 11];
    if (dayIdx === undefined) return null;
    mask[dayIdx] = true;
    return mask;
  }
  return null;
}
