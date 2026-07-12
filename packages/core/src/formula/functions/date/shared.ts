import { FormulaError } from '../../types';

/**
 * Coerce a value to a Date: passes through valid Date instances, parses strings,
 * and treats numbers as timestamps. Returns a FormulaError for anything else.
 * Shared by the date component and date arithmetic function modules.
 */
export function toDate(val: unknown): Date | FormulaError {
  if (val instanceof FormulaError) return val;
  if (val instanceof Date) {
    if (Number.isNaN(val.getTime())) return new FormulaError('#VALUE!', 'Invalid date');
    return val;
  }
  if (typeof val === 'string') {
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return new FormulaError('#VALUE!', `Cannot parse "${val}" as date`);
    return d;
  }
  if (typeof val === 'number') {
    // Treat number as a timestamp
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return new FormulaError('#VALUE!', 'Invalid numeric date');
    return d;
  }
  return new FormulaError('#VALUE!', 'Cannot convert value to date');
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
