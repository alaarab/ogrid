/**
 * Sort/filter primitives shared by the main-thread path (utils/clientSideData)
 * and the Web Worker (workers/sortFilterWorker).
 *
 * The worker runs from a Blob built out of `Function.prototype.toString()`, so
 * it can't import modules. Instead, `SORT_FILTER_PRIMITIVES` is serialized into
 * the Blob ahead of the worker body. That only works because these are plain
 * `function` declarations: they keep their (possibly minified) names when
 * stringified, and they reference nothing but each other and globals.
 * Keep it that way: no imports, no closures, no arrow-function constants.
 */

/**
 * Timestamp for a date-column cell value (NaN when missing or invalid).
 * Bare `YYYY-MM-DD` strings are read as UTC midnight to match date display
 * and UTC filter bounds. Dates and numeric timestamps represent instants.
 */
export function toDateTimestamp(value: unknown): number {
  if (value == null) return NaN;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return new Date(String(value)).getTime();
}

/**
 * Default (no custom `compare`, non-date) sort key: numbers as-is, everything
 * else lowercased text, null/undefined as `undefined`.
 */
export function toSortKey(value: unknown): string | number | undefined {
  if (value == null) return undefined;
  if (typeof value === 'number') return value;
  return String(value).toLowerCase();
}

/** Create once per execution context so comparisons reuse the locale collator. */
export function createSortCollator(): Intl.Collator {
  return new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Ascending total order over sort keys: missing values first, then numbers
 * (numerically), then text (locale-aware, with numeric strings in natural order).
 */
export function compareSortKeys(a: string | number | undefined, b: string | number | undefined, collator: Intl.Collator): number {
  if (a === undefined || b === undefined) return a === b ? 0 : a === undefined ? -1 : 1;
  const an = typeof a === 'number';
  const bn = typeof b === 'number';
  if (an !== bn) return an ? -1 : 1;
  if (typeof a === 'string' && typeof b === 'string') return collator.compare(a, b);
  return a === b ? 0 : a > b ? 1 : -1;
}

/** Ascending order over timestamps: invalid/missing (NaN) first. */
export function compareTimestamps(a: number, b: number): number {
  const an = Number.isNaN(a);
  const bn = Number.isNaN(b);
  if (an || bn) return an && bn ? 0 : an ? -1 : 1;
  return a === b ? 0 : a > b ? 1 : -1;
}

// --- Condition filters ('condition' FilterValue) ---

/** Serializable condition filter shape (mirrors IConditionFilterValue in types). */
export interface ConditionFilterInput {
  kind: 'text' | 'number' | 'date';
  conditions: { operator: string; value?: string | number; valueTo?: string | number }[];
  join?: 'and' | 'or';
}

/** A condition with its operands parsed once, ready to test cells. */
export interface PreparedCondition {
  kind: 'text' | 'number' | 'date';
  op: string;
  /** Number operand, date range start, or lowercased text. */
  a: number | string;
  /** Upper number bound or date range end. */
  b: number;
}

export interface PreparedConditionFilter {
  or: boolean;
  conditions: PreparedCondition[];
}

/** Blank for condition filters: null/undefined, whitespace-only text, or NaN. */
export function isBlankCellValue(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (typeof value === 'number') return Number.isNaN(value);
  return false;
}

/**
 * Number for number condition filters: numbers as-is, numeric text (thousands
 * separators allowed) parsed, everything else (blank, booleans, dates, other text) NaN.
 */
export function toFilterNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return NaN;
  const text = value.trim().replace(/,/g, '');
  return text === '' ? NaN : Number(text);
}

/** UTC midnight of the day a date-ish value falls on (NaN when invalid). */
export function toUtcDayStart(value: unknown): number {
  if (isBlankCellValue(value)) return NaN;
  const ts = toDateTimestamp(value);
  return Number.isNaN(ts) ? NaN : Math.floor(ts / 86400000) * 86400000;
}

/** True for operators that compare a cell against statistics of the whole column. */
export function isStatsConditionOperator(op: string): boolean {
  return op === 'top' || op === 'bottom' || op === 'aboveAverage' || op === 'belowAverage';
}

/** True when any condition of the filter needs every value in the column (top N, average). */
export function conditionFilterNeedsColumnValues(filter: ConditionFilterInput): boolean {
  const conditions = filter.conditions || [];
  for (let i = 0; i < conditions.length; i++) {
    const c = conditions[i];
    if (c && isStatsConditionOperator(c.operator)) return true;
  }
  return false;
}

/**
 * Parse one condition's operands. Returns null when the condition is incomplete
 * (no operator, a missing or unparsable operand, top/bottom N below 1), so it
 * is ignored. `columnValues` is needed only for top/bottom and above/below average.
 */
export function prepareCondition(
  kind: 'text' | 'number' | 'date',
  condition: { operator: string; value?: string | number; valueTo?: string | number },
  columnValues: unknown[] | null,
): PreparedCondition | null {
  const op = condition ? condition.operator : '';
  if (!op) return null;
  if (op === 'blank' || op === 'notBlank') return { kind, op, a: NaN, b: NaN };

  if (isStatsConditionOperator(op)) {
    if (kind !== 'number') return null;
    const nums: number[] = [];
    const values = columnValues || [];
    for (let i = 0; i < values.length; i++) {
      const n = toFilterNumber(values[i]);
      if (Number.isFinite(n)) nums.push(n);
    }
    if (op === 'aboveAverage' || op === 'belowAverage') {
      let sum = 0;
      for (let i = 0; i < nums.length; i++) sum += nums[i] as number;
      return { kind, op, a: nums.length ? sum / nums.length : NaN, b: NaN };
    }
    const count = Math.floor(toFilterNumber(condition.value));
    if (!(count >= 1)) return null;
    nums.sort((x, y) => (op === 'top' ? y - x : x - y));
    const threshold = nums.length ? (nums[Math.min(count, nums.length) - 1] as number) : NaN;
    return { kind, op, a: threshold, b: NaN };
  }

  if (kind === 'text') {
    const v = condition.value;
    if (v == null || String(v) === '') return null;
    return { kind, op, a: String(v).toLowerCase(), b: NaN };
  }

  if (kind === 'number') {
    let a = toFilterNumber(condition.value);
    if (!Number.isFinite(a)) return null;
    let b = NaN;
    if (op === 'between') {
      b = toFilterNumber(condition.valueTo);
      if (!Number.isFinite(b)) return null;
      if (b < a) {
        const t = a;
        a = b;
        b = t;
      }
    }
    return { kind, op, a, b };
  }

  // Date: `a` is the operand's UTC day start; `b` the end of the range's last day.
  let start = toUtcDayStart(condition.value);
  if (Number.isNaN(start)) return null;
  let end = start + 86399999;
  if (op === 'between') {
    const to = toUtcDayStart(condition.valueTo);
    if (Number.isNaN(to)) return null;
    if (to < start) {
      end = start + 86399999;
      start = to;
    } else {
      end = to + 86399999;
    }
  }
  return { kind, op, a: start, b: end };
}

/** Prepare a condition filter; null when it has no complete condition (so it filters nothing). */
export function prepareConditionFilter(
  filter: ConditionFilterInput,
  columnValues: unknown[] | null,
): PreparedConditionFilter | null {
  const prepared: PreparedCondition[] = [];
  const conditions = filter?.conditions || [];
  for (let i = 0; i < conditions.length; i++) {
    const c = conditions[i];
    if (!c) continue;
    const p = prepareCondition(filter.kind, c, columnValues);
    if (p) prepared.push(p);
  }
  if (prepared.length === 0) return null;
  return { or: filter.join === 'or', conditions: prepared };
}

/** Test one cell value against one prepared condition. */
export function matchPreparedCondition(c: PreparedCondition, value: unknown): boolean {
  const op = c.op;
  if (op === 'blank') return isBlankCellValue(value);
  if (op === 'notBlank') return !isBlankCellValue(value);

  if (c.kind === 'text') {
    const text = value == null ? '' : String(value).toLowerCase();
    const q = c.a as string;
    switch (op) {
      case 'equals': return text === q;
      case 'notEquals': return text !== q;
      case 'contains': return text.indexOf(q) !== -1;
      case 'notContains': return text.indexOf(q) === -1;
      case 'beginsWith': return text.slice(0, q.length) === q;
      case 'endsWith': return q.length <= text.length && text.slice(text.length - q.length) === q;
      default: return false;
    }
  }

  if (c.kind === 'number') {
    const n = toFilterNumber(value);
    const a = c.a as number;
    if (op === 'notEquals') return !(n === a);
    if (Number.isNaN(n)) return false;
    switch (op) {
      case 'equals': return n === a;
      case 'greaterThan': return n > a;
      case 'greaterThanOrEqual': return n >= a;
      case 'lessThan': return n < a;
      case 'lessThanOrEqual': return n <= a;
      case 'between': return n >= a && n <= c.b;
      case 'top': return n >= a;
      case 'bottom': return n <= a;
      case 'aboveAverage': return n > a;
      case 'belowAverage': return n < a;
      default: return false;
    }
  }

  // Date: compare the cell's instant against the operand day's bounds.
  const ts = isBlankCellValue(value) ? NaN : toDateTimestamp(value);
  const start = c.a as number;
  const end = c.b;
  const onDay = ts >= start && ts <= end;
  if (op === 'notEquals') return !onDay;
  if (Number.isNaN(ts)) return false;
  switch (op) {
    case 'equals': case 'between': return onDay;
    case 'greaterThan': return ts > end;
    case 'greaterThanOrEqual': return ts >= start;
    case 'lessThan': return ts < start;
    case 'lessThanOrEqual': return ts <= end;
    default: return false;
  }
}

/** Test one cell value against a prepared condition filter (AND / OR of its conditions). */
export function matchConditionFilter(filter: PreparedConditionFilter, value: unknown): boolean {
  const conditions = filter.conditions;
  for (let i = 0; i < conditions.length; i++) {
    const hit = matchPreparedCondition(conditions[i] as PreparedCondition, value);
    if (filter.or && hit) return true;
    if (!filter.or && !hit) return false;
  }
  return !filter.or;
}

// --- Multi-level sort ---

/**
 * Compare two rows across sort levels: the first non-zero level wins. Each
 * level is `[keys, isDate, dir]` where `keys[row]` holds that row's precomputed
 * sort key (timestamp for date levels).
 */
export function compareSortLevels(
  levels: [(string | number | undefined)[], boolean, number][],
  a: number,
  b: number,
  collator: Intl.Collator,
): number {
  for (let i = 0; i < levels.length; i++) {
    const level = levels[i] as [(string | number | undefined)[], boolean, number];
    const keys = level[0];
    const r = level[1]
      ? compareTimestamps(keys[a] as number, keys[b] as number)
      : compareSortKeys(keys[a], keys[b], collator);
    if (r !== 0) return r * level[2];
  }
  return 0;
}

/** Serialized ahead of the worker body; see the file comment. */
export const SORT_FILTER_PRIMITIVES = [
  toDateTimestamp, toSortKey, createSortCollator, compareSortKeys, compareTimestamps,
  isBlankCellValue, toFilterNumber, toUtcDayStart, isStatsConditionOperator, conditionFilterNeedsColumnValues,
  prepareCondition, prepareConditionFilter, matchPreparedCondition, matchConditionFilter, compareSortLevels,
];
