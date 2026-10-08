/**
 * Excel-style fill series detection for the fill handle.
 *
 * A fill extends each "line" of the source block (a column when filling
 * down/up, a row when filling right/left) on its own. `detectFillSeries`
 * looks at a line's source values and returns the series that continues
 * them, or null when the line is not a series and the fill should copy it.
 */

/** A detected series. `valueAt(k)` is the value `k` steps from the first source cell (negative k extends up/left). */
export interface IFillSeries {
  valueAt: (k: number) => unknown;
}

/** Options for `detectFillSeries`. */
export interface IDetectFillSeriesOptions {
  /**
   * Excel's Ctrl-drag: a lone number counts up instead of copying, and every
   * other series copies instead of continuing.
   */
  alternate?: boolean;
}

const WEEKDAYS_LONG = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WEEKDAYS_SHORT = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MONTHS_LONG = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MONTHS_SHORT = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const QUARTERS = ['q1', 'q2', 'q3', 'q4'];
const CYCLES = [WEEKDAYS_LONG, WEEKDAYS_SHORT, MONTHS_LONG, MONTHS_SHORT, QUARTERS];

const NUMERIC_STRING_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TRAILING_NUMBER_RE = /^(.*?)(\d+)$/;

/** Drop floating point noise (0.1 + 0.2) from generated numbers. */
const clean = (n: number): number => Number(n.toPrecision(15));

const mod = (n: number, m: number): number => ((n % m) + m) % m;

/** The constant step between consecutive values, or null when they are not evenly spaced. */
function constantStep(values: number[]): number | null {
  if (values.length < 2) return null;
  const first = values[0] as number;
  const step = (values[1] as number) - first;
  for (let i = 2; i < values.length; i++) {
    if (Math.abs((values[i] as number) - (values[i - 1] as number) - step) > 1e-9) return null;
  }
  return step;
}

function numericSeries(raw: unknown[], nums: number[], alternate: boolean): IFillSeries | null {
  let a: number;
  let b: number;
  if (nums.length === 1) {
    // A lone number copies; Ctrl counts up by one.
    if (!alternate) return null;
    a = nums[0] as number;
    b = 1;
  } else {
    if (alternate) return null;
    // Least-squares line through the source (Excel's linear trend); for an
    // evenly spaced source this is exactly its step.
    const n = nums.length;
    const xMean = (n - 1) / 2;
    const yMean = nums.reduce((s, v) => s + v, 0) / n;
    let num = 0;
    let den = 0;
    nums.forEach((y, x) => {
      num += (x - xMean) * (y - yMean);
      den += (x - xMean) ** 2;
    });
    b = num / den;
    a = yMean - b * xMean;
  }
  const asString = typeof raw[0] === 'string';
  return {
    valueAt: (k) => {
      const v = clean(a + b * k);
      return asString ? String(v) : v;
    },
  };
}

interface DateParts { y: number; m: number; d: number }

function dateParts(v: unknown): DateParts | null {
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? null : { y: v.getFullYear(), m: v.getMonth(), d: v.getDate() };
  }
  if (typeof v === 'string') {
    const match = ISO_DATE_RE.exec(v);
    if (!match) return null;
    const y = Number(match[1]);
    const m = Number(match[2]) - 1;
    const d = Number(match[3]);
    const probe = new Date(Date.UTC(y, m, d));
    if (probe.getUTCMonth() !== m || probe.getUTCDate() !== d) return null;
    return { y, m, d };
  }
  return null;
}

const daysInMonth = (y: number, m: number): number => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
const dayNumber = (p: DateParts): number => Math.round(Date.UTC(p.y, p.m, p.d) / 86_400_000);
const pad2 = (n: number): string => String(n).padStart(2, '0');

function dateSeries(raw: unknown[], parts: DateParts[]): IFillSeries | null {
  const first = parts[0] as DateParts;
  const template = raw[0];
  /** A date in the same representation as the first source value (Date or 'YYYY-MM-DD'). */
  const build = (y: number, m: number, d: number): unknown => {
    if (template instanceof Date) {
      return new Date(y, m, d, template.getHours(), template.getMinutes(), template.getSeconds(), template.getMilliseconds());
    }
    const u = new Date(Date.UTC(y, m, d));
    return `${String(u.getUTCFullYear()).padStart(4, '0')}-${pad2(u.getUTCMonth() + 1)}-${pad2(u.getUTCDate())}`;
  };

  // Same day of the month throughout: a month (or year) series, clamped to
  // short months (Jan 31 + 1 month = Feb 28/29).
  if (parts.length >= 2 && parts.every((p) => p.d === first.d)) {
    const monthIndex = parts.map((p) => p.y * 12 + p.m);
    const step = constantStep(monthIndex);
    if (step !== null && step !== 0) {
      return {
        valueAt: (k) => {
          const total = first.y * 12 + first.m + step * k;
          const y = Math.floor(total / 12);
          const m = mod(total, 12);
          return build(y, m, Math.min(first.d, daysInMonth(y, m)));
        },
      };
    }
  }
  const step = parts.length === 1 ? 1 : constantStep(parts.map(dayNumber));
  if (step === null) return null;
  return { valueAt: (k) => build(first.y, first.m, first.d + step * k) };
}

/** Re-case a list entry like the source text: UPPER, lower or Title. */
function matchCase(entry: string, sample: string): string {
  if (sample === sample.toUpperCase()) return entry.toUpperCase();
  if (sample === sample.toLowerCase()) return entry.toLowerCase();
  return entry.charAt(0).toUpperCase() + entry.slice(1);
}

function cycleSeries(strings: string[]): IFillSeries | null {
  const lower = strings.map((s) => s.trim().toLowerCase());
  for (const list of CYCLES) {
    const idx = lower.map((s) => list.indexOf(s));
    if (idx.some((i) => i < 0)) continue;
    const len = list.length;
    let step = 1;
    if (idx.length >= 2) {
      step = mod((idx[1] as number) - (idx[0] as number), len);
      for (let i = 2; i < idx.length; i++) {
        if (mod((idx[i] as number) - (idx[i - 1] as number), len) !== step) return null;
      }
      if (step === 0) return null;
    }
    const start = idx[0] as number;
    const sample = (strings[0] as string).trim();
    return { valueAt: (k) => matchCase(list[mod(start + step * k, len)] as string, sample) };
  }
  return null;
}

function trailingNumberSeries(strings: string[]): IFillSeries | null {
  const matches = strings.map((s) => TRAILING_NUMBER_RE.exec(s));
  if (matches.some((m) => m === null)) return null;
  const prefix = (matches[0] as RegExpExecArray)[1] as string;
  if (matches.some((m) => (m as RegExpExecArray)[1] !== prefix)) return null;
  const digits = (matches[0] as RegExpExecArray)[2] as string;
  // "Item 007" keeps its width; "Item 7" does not gain zeros.
  const width = digits.length > 1 && digits.startsWith('0') ? digits.length : 0;
  const nums = matches.map((m) => Number((m as RegExpExecArray)[2]));
  const step = nums.length === 1 ? 1 : constantStep(nums);
  if (step === null) return null;
  const start = nums[0] as number;
  // Counting below zero turns back up (Item 1, Item 0, Item 1, ...), like Excel.
  return { valueAt: (k) => `${prefix}${String(Math.abs(start + step * k)).padStart(width, '0')}` };
}

/**
 * The series that continues `values` (one line of a fill source, in fill
 * order), or null when the line should be copied instead.
 *
 * Detected, in order: numbers (a lone number copies, two or more follow their
 * linear trend), dates (`Date` objects or `YYYY-MM-DD` strings: one date steps
 * by a day; dates on the same day of the month step by months or years),
 * weekday and month names (full or three-letter, any case), quarters
 * (Q1..Q4), and text ending in a number ("Item 1" -> "Item 2"). Any blank
 * value means no series. `alternate` is Excel's Ctrl-drag (see
 * `IDetectFillSeriesOptions`).
 */
export function detectFillSeries(values: unknown[], options?: IDetectFillSeriesOptions): IFillSeries | null {
  if (values.length === 0) return null;
  if (values.some((v) => v == null || v === '')) return null;
  const alternate = options?.alternate === true;

  if (values.every((v) => (typeof v === 'number' && Number.isFinite(v)) || (typeof v === 'string' && NUMERIC_STRING_RE.test(v.trim())))) {
    return numericSeries(values, values.map((v) => Number(typeof v === 'string' ? v.trim() : v)), alternate);
  }
  // Everything below is a series by default; Ctrl copies it instead.
  if (alternate) return null;

  const parts = values.map(dateParts);
  if (parts.every((p) => p !== null)) return dateSeries(values, parts as DateParts[]);

  if (!values.every((v) => typeof v === 'string')) return null;
  const strings = values as string[];
  return cycleSeries(strings) ?? trailingNumberSeries(strings);
}
