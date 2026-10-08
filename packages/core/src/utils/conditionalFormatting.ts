/**
 * Conditional formatting evaluation (framework-agnostic).
 *
 * createConditionalFormatter() takes the rules and the grid's sheet rows,
 * and answers "how does this cell look?" per cell. Statistics a rule needs
 * (min/max/average/rank/duplicate counts/percentiles) are computed once per
 * rule, the first time a cell asks, and results are cached per row object.
 * Build a new formatter whenever the data, columns, rules or formula results
 * change.
 */

import type { IColumnDef } from '../types/columnTypes';
import type {
  ConditionalFormatDatePeriod,
  ConditionalFormatIconSet,
  ICellConditionalFormat,
  IColorScaleStop,
  IConditionalFormatColorScaleRule,
  IConditionalFormatRule,
  IConditionalFormatStyle,
  IConditionalFormatValueBound,
} from '../types/conditionalFormatTypes';
import { getCellValue } from './cellValue';

/** Inputs the formatter reads. Row N of `items` is sheet row N. */
export interface IConditionalFormatContext<T> {
  /** Every row the rules cover, in sheet order (the full data, not the current page). */
  items: readonly T[];
  /** Flat column defs; a column's index is its formula column. */
  columns: readonly IColumnDef<T>[];
  /** Cell value (e.g. a formula cell's computed result). Defaults to getCellValue. */
  getValue?: (item: T, column: IColumnDef<T>, sheetRow: number, colIndex: number) => unknown;
  /**
   * Evaluates `formula` rules: the formula written for `anchor`, evaluated
   * for `cell` (sheet coordinates). Without it formula rules never match.
   */
  evaluateFormula?: (formula: string, anchor: { col: number; row: number }, cell: { col: number; row: number }) => unknown;
  /** "Today" for date rules. Defaults to now. */
  now?: Date;
}

export interface IConditionalFormatter<T> {
  /** The cell's combined format, or undefined when no rule applies. */
  getCellFormat(item: T, columnId: string): ICellConditionalFormat | undefined;
}

// ---------------------------------------------------------------------------
// Default palettes (CSS variables with light-theme fallbacks; the OGrid theme
// redefines them for dark mode)
// ---------------------------------------------------------------------------

/** Excel's built-in highlight styles. */
export const CONDITIONAL_FORMAT_STYLES = {
  lightRedFillDarkRedText: { background: 'var(--ogrid-cf-bad-bg, #ffc7ce)', color: 'var(--ogrid-cf-bad-text, #9c0006)' },
  yellowFillDarkYellowText: { background: 'var(--ogrid-cf-neutral-bg, #ffeb9c)', color: 'var(--ogrid-cf-neutral-text, #9c5700)' },
  greenFillDarkGreenText: { background: 'var(--ogrid-cf-good-bg, #c6efce)', color: 'var(--ogrid-cf-good-text, #006100)' },
  lightRedFill: { background: 'var(--ogrid-cf-bad-bg, #ffc7ce)' },
  redText: { color: 'var(--ogrid-cf-bad-text, #9c0006)' },
  redBorder: { border: 'var(--ogrid-cf-bad-text, #9c0006)' },
} satisfies Record<string, IConditionalFormatStyle>;

/** Excel's built-in color scales (concrete colors so values interpolate; dimmed in dark themes). */
export const COLOR_SCALES: Record<'greenYellowRed' | 'redYellowGreen' | 'blueWhiteRed' | 'whiteGreen' | 'whiteRed', IConditionalFormatColorScaleRule['stops']> = {
  greenYellowRed: [
    { type: 'min', color: '#f8696b' },
    { type: 'percentile', value: 50, color: '#ffeb84' },
    { type: 'max', color: '#63be7b' },
  ],
  redYellowGreen: [
    { type: 'min', color: '#63be7b' },
    { type: 'percentile', value: 50, color: '#ffeb84' },
    { type: 'max', color: '#f8696b' },
  ],
  blueWhiteRed: [
    { type: 'min', color: '#5a8ac6' },
    { type: 'percentile', value: 50, color: '#fcfcff' },
    { type: 'max', color: '#f8696b' },
  ],
  whiteGreen: [
    { type: 'min', color: '#fcfcff' },
    { type: 'max', color: '#63be7b' },
  ],
  whiteRed: [
    { type: 'min', color: '#fcfcff' },
    { type: 'max', color: '#f8696b' },
  ],
};

const DEFAULT_BAR = 'var(--ogrid-cf-bar, #638ec6)';
const DEFAULT_BAR_FADE = 'var(--ogrid-cf-bar-fade, rgba(99, 142, 198, 0.15))';
const DEFAULT_NEGATIVE_BAR = 'var(--ogrid-cf-bar-negative, #e05252)';
const DEFAULT_NEGATIVE_BAR_FADE = 'var(--ogrid-cf-bar-negative-fade, rgba(224, 82, 82, 0.15))';

// ---------------------------------------------------------------------------
// Value helpers
// ---------------------------------------------------------------------------

function isErrorValue(v: unknown): boolean {
  if (v == null || typeof v !== 'object' || v instanceof Date) return false;
  const type = (v as { type?: unknown }).type;
  return typeof type === 'string' && type.startsWith('#');
}

function isBlank(v: unknown): boolean {
  return v == null || (typeof v === 'string' && v.trim() === '');
}

/** Numbers and dates are numeric (dates by time), as in Excel. */
function toNumber(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (v instanceof Date) {
    const t = v.getTime();
    return Number.isNaN(t) ? undefined : t;
  }
  return undefined;
}

function toDate(v: unknown): Date | undefined {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? undefined : v;
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
    // Date-only ISO strings are local dates, not UTC midnight.
    const d = v.length === 10 ? new Date(`${v}T00:00:00`) : new Date(v);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}

function textOf(v: unknown): string {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

/** Duplicate key: numbers by value, text case-insensitively. */
function duplicateKey(v: unknown): string | undefined {
  if (isBlank(v) || isErrorValue(v)) return undefined;
  const n = toNumber(v);
  if (n !== undefined) return `n:${n}`;
  if (typeof v === 'boolean') return `b:${v}`;
  return `s:${String(v).toLowerCase()}`;
}

/** Excel PERCENTILE.INC over ascending `sorted`. */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const k = (Math.min(100, Math.max(0, p)) / 100) * (sorted.length - 1);
  const lo = Math.floor(k);
  const hi = Math.ceil(k);
  const a = sorted[lo] as number;
  const b = sorted[hi] as number;
  return a + (b - a) * (k - lo);
}

function compareValues(a: unknown, b: unknown): number | undefined {
  const na = toNumber(a);
  let nb = toNumber(b);
  // A rule value typed as text ("100") still compares numerically with numbers.
  if (nb === undefined && typeof b === 'string' && b.trim() !== '' && Number.isFinite(Number(b))) nb = Number(b);
  if (na !== undefined && nb !== undefined) return na - nb;
  if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b, undefined, { sensitivity: 'base' });
  return undefined;
}

// ---------------------------------------------------------------------------
// Date periods
// ---------------------------------------------------------------------------

function dayStart(d: Date, addDays = 0): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + addDays).getTime();
}

/** [start, end) of a period in local time. Weeks start on Sunday, as in Excel. */
function periodBounds(period: ConditionalFormatDatePeriod, now: Date): [number, number] {
  const weekStart = -now.getDay();
  switch (period) {
    case 'yesterday': return [dayStart(now, -1), dayStart(now)];
    case 'today': return [dayStart(now), dayStart(now, 1)];
    case 'tomorrow': return [dayStart(now, 1), dayStart(now, 2)];
    case 'last7Days': return [dayStart(now, -6), dayStart(now, 1)];
    case 'lastWeek': return [dayStart(now, weekStart - 7), dayStart(now, weekStart)];
    case 'thisWeek': return [dayStart(now, weekStart), dayStart(now, weekStart + 7)];
    case 'nextWeek': return [dayStart(now, weekStart + 7), dayStart(now, weekStart + 14)];
    case 'lastMonth': return [new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime(), new Date(now.getFullYear(), now.getMonth(), 1).getTime()];
    case 'thisMonth': return [new Date(now.getFullYear(), now.getMonth(), 1).getTime(), new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime()];
    case 'nextMonth': return [new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime(), new Date(now.getFullYear(), now.getMonth() + 2, 1).getTime()];
  }
}

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

/** Parse #rgb, #rrggbb, #rrggbbaa or rgb()/rgba() into [r, g, b]. */
export function parseCssColor(color: string): [number, number, number] | undefined {
  const c = color.trim();
  let m = /^#([0-9a-f]{3})$/i.exec(c);
  if (m) {
    const h = m[1] as string;
    return [0, 1, 2].map((i) => Number.parseInt(`${h[i]}${h[i]}`, 16)) as [number, number, number];
  }
  m = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/i.exec(c);
  if (m) {
    const h = m[1] as string;
    return [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
  }
  m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(c);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  return undefined;
}

function toHex(rgb: [number, number, number]): string {
  return `#${rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`;
}

/** Color `t` (0-1) of the way from `a` to `b`; non-parseable colors snap to the nearer end. */
export function interpolateColor(a: string, b: string, t: number): string {
  const ca = parseCssColor(a);
  const cb = parseCssColor(b);
  if (!ca || !cb) return t < 0.5 ? a : b;
  return toHex([0, 1, 2].map((i) => (ca[i] as number) + ((cb[i] as number) - (ca[i] as number)) * t) as [number, number, number]);
}

function fadeOf(color: string, fallback: string): string {
  if (color === DEFAULT_BAR) return DEFAULT_BAR_FADE;
  if (color === DEFAULT_NEGATIVE_BAR) return DEFAULT_NEGATIVE_BAR_FADE;
  const rgb = parseCssColor(color);
  return rgb ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.15)` : fallback;
}

// ---------------------------------------------------------------------------
// Rule state
// ---------------------------------------------------------------------------

interface RuleStats {
  sorted: number[];
  min: number;
  max: number;
  avg: number;
  std: number;
  counts: Map<string, number>;
}

interface RuleState<T> {
  rule: IConditionalFormatRule<T>;
  anchorCol: number;
  anchorRow: number;
  stats?: RuleStats;
  /** Rule-specific thresholds resolved from stats. */
  resolved?: unknown;
}

function compareRulePriority<T>(a: { rule: IConditionalFormatRule<T>; index: number }, b: { rule: IConditionalFormatRule<T>; index: number }): number {
  const pa = a.rule.priority ?? Number.POSITIVE_INFINITY;
  const pb = b.rule.priority ?? Number.POSITIVE_INFINITY;
  if (pa !== pb) return pa < pb ? -1 : 1;
  return a.index - b.index;
}

function resolveBound(bound: IConditionalFormatValueBound | undefined, stats: RuleStats, fallback: 'min' | 'max'): number {
  const b = bound ?? { type: fallback };
  switch (b.type) {
    case 'min': return stats.min;
    case 'max': return stats.max;
    case 'number': return b.value ?? 0;
    case 'percent': return stats.min + ((b.value ?? 0) / 100) * (stats.max - stats.min);
    case 'percentile': return percentile(stats.sorted, b.value ?? 50);
  }
}

const ICON_COLORS = ['var(--ogrid-cf-icon-good, #2e9e4f)', 'var(--ogrid-cf-icon-neutral, #d79b00)', 'var(--ogrid-cf-icon-bad, #d13438)'] as const;
const ICON_GLYPHS: Record<ConditionalFormatIconSet, readonly [string, string, string]> = {
  '3Arrows': ['▲', '▶', '▼'],
  '3TrafficLights': ['●', '●', '●'],
  '3Symbols': ['✔', '!', '✖'],
};
const ICON_LABELS: Record<ConditionalFormatIconSet, readonly [string, string, string]> = {
  '3Arrows': ['Up', 'Sideways', 'Down'],
  '3TrafficLights': ['Green', 'Yellow', 'Red'],
  '3Symbols': ['Check', 'Exclamation', 'Cross'],
};

/** Glyph, color and label for an icon. */
export function getConditionalFormatIcon(set: ConditionalFormatIconSet, index: 0 | 1 | 2): { glyph: string; color: string; label: string } {
  return { glyph: ICON_GLYPHS[set][index], color: ICON_COLORS[index], label: ICON_LABELS[set][index] };
}

// ---------------------------------------------------------------------------
// Formatter
// ---------------------------------------------------------------------------

/**
 * Build a formatter for `rules` over `ctx.items`. Returns undefined when there
 * are no rules, so callers can skip the per-cell work entirely.
 */
export function createConditionalFormatter<T>(
  rules: readonly IConditionalFormatRule<T>[] | undefined,
  ctx: IConditionalFormatContext<T>,
): IConditionalFormatter<T> | undefined {
  if (!rules || rules.length === 0) return undefined;
  const { items, columns } = ctx;
  const now = ctx.now ?? new Date();
  const colIndex = new Map<string, number>();
  columns.forEach((c, i) => { colIndex.set(c.columnId, i); });
  const readValue = ctx.getValue ?? ((item: T, column: IColumnDef<T>) => getCellValue(item, column));

  // Rules per column, in priority order.
  const byColumn = new Map<string, RuleState<T>[]>();
  const ordered = rules.map((rule, index) => ({ rule, index })).sort(compareRulePriority);
  for (const { rule } of ordered) {
    const anchorCol = rule.columnIds.reduce((m, id) => Math.min(m, colIndex.get(id) ?? Number.POSITIVE_INFINITY), Number.POSITIVE_INFINITY);
    const state: RuleState<T> = { rule, anchorCol: Number.isFinite(anchorCol) ? anchorCol : 0, anchorRow: rule.rows?.start ?? 0 };
    for (const id of new Set(rule.columnIds)) {
      if (!colIndex.has(id)) continue;
      let list = byColumn.get(id);
      if (!list) { list = []; byColumn.set(id, list); }
      list.push(state);
    }
  }
  if (byColumn.size === 0) return undefined;

  // Sheet row of each item, built on first use.
  let rowOf: Map<T, number> | undefined;
  const sheetRowOf = (item: T): number => {
    if (!rowOf) {
      rowOf = new Map();
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item !== undefined) rowOf.set(item, i);
      }
    }
    return rowOf.get(item) ?? -1;
  };

  const rowApplies = (rule: IConditionalFormatRule<T>, item: T, row: number): boolean => {
    if (rule.rows) {
      if (row < 0) return false;
      if (rule.rows.start != null && row < rule.rows.start) return false;
      if (rule.rows.end != null && row > rule.rows.end) return false;
    }
    return !rule.rowFilter || rule.rowFilter(item, row);
  };

  const statsOf = (state: RuleState<T>): RuleStats => {
    if (state.stats) return state.stats;
    const { rule } = state;
    const numbers: number[] = [];
    const counts = new Map<string, number>();
    const cols = rule.columnIds.map((id) => colIndex.get(id)).filter((i): i is number => i !== undefined);
    const wantsCounts = rule.type === 'duplicateValues';
    const start = Math.max(0, rule.rows?.start ?? 0);
    const end = Math.min(items.length - 1, rule.rows?.end ?? items.length - 1);
    for (let r = start; r <= end; r++) {
      const item = items[r];
      // Server-side sheets hold only the current page; earlier rows are holes.
      if (item === undefined) continue;
      if (rule.rowFilter && !rule.rowFilter(item, r)) continue;
      for (const c of cols) {
        const v = readValue(item, columns[c] as IColumnDef<T>, r, c);
        if (wantsCounts) {
          const key = duplicateKey(v);
          if (key !== undefined) counts.set(key, (counts.get(key) ?? 0) + 1);
        } else {
          const n = toNumber(v);
          if (n !== undefined) numbers.push(n);
        }
      }
    }
    numbers.sort((a, b) => a - b);
    let sum = 0;
    for (const n of numbers) sum += n;
    const avg = numbers.length ? sum / numbers.length : 0;
    let sq = 0;
    for (const n of numbers) sq += (n - avg) ** 2;
    state.stats = {
      sorted: numbers,
      min: numbers.length ? (numbers[0] as number) : 0,
      max: numbers.length ? (numbers[numbers.length - 1] as number) : 0,
      avg,
      std: numbers.length ? Math.sqrt(sq / numbers.length) : 0,
      counts,
    };
    return state.stats;
  };

  /** Evaluate one rule for one cell. Returns false (no match) or what the rule contributes. */
  const evaluate = (
    state: RuleState<T>,
    value: unknown,
    item: T,
    row: number,
    col: number,
  ): false | { style?: IConditionalFormatStyle; background?: string; dataBar?: ICellConditionalFormat['dataBar']; icon?: ICellConditionalFormat['icon'] } => {
    const { rule } = state;
    switch (rule.type) {
      case 'cellValue': {
        if (isBlank(value) || isErrorValue(value)) return false;
        const c1 = compareValues(value, rule.value);
        const op = rule.operator;
        if (op === 'between' || op === 'notBetween') {
          const c2 = compareValues(value, rule.value2 ?? rule.value);
          if (c1 === undefined || c2 === undefined) return op === 'notBetween' ? { style: rule.style } : false;
          // Bounds may be given in either order, as in Excel.
          const lowFirst = (compareValues(rule.value, rule.value2 ?? rule.value) ?? 0) <= 0;
          const inside = lowFirst ? c1 >= 0 && c2 <= 0 : c2 >= 0 && c1 <= 0;
          return inside === (op === 'between') ? { style: rule.style } : false;
        }
        if (c1 === undefined) return op === 'notEqual' ? { style: rule.style } : false;
        const ok = op === 'greaterThan' ? c1 > 0
          : op === 'greaterThanOrEqual' ? c1 >= 0
          : op === 'lessThan' ? c1 < 0
          : op === 'lessThanOrEqual' ? c1 <= 0
          : op === 'equal' ? c1 === 0
          : c1 !== 0;
        return ok ? { style: rule.style } : false;
      }
      case 'text': {
        if (isErrorValue(value)) return false;
        const cs = rule.caseSensitive === true;
        const hay = cs ? textOf(value) : textOf(value).toLowerCase();
        const needle = cs ? rule.text : rule.text.toLowerCase();
        const ok = rule.operator === 'contains' ? hay.includes(needle)
          : rule.operator === 'notContains' ? !hay.includes(needle)
          : rule.operator === 'beginsWith' ? hay.startsWith(needle)
          : hay.endsWith(needle);
        return ok ? { style: rule.style } : false;
      }
      case 'dateOccurring': {
        const d = toDate(value);
        if (!d) return false;
        let bounds = state.resolved as [number, number] | undefined;
        if (!bounds) { bounds = periodBounds(rule.period, now); state.resolved = bounds; }
        const t = d.getTime();
        return t >= bounds[0] && t < bounds[1] ? { style: rule.style } : false;
      }
      case 'duplicateValues': {
        const key = duplicateKey(value);
        if (key === undefined) return false;
        const count = statsOf(state).counts.get(key) ?? 0;
        return (rule.unique ? count === 1 : count > 1) ? { style: rule.style } : false;
      }
      case 'topBottom': {
        const n = toNumber(value);
        if (n === undefined) return false;
        const { sorted } = statsOf(state);
        if (sorted.length === 0) return false;
        let threshold = state.resolved as number | undefined;
        if (threshold === undefined) {
          const count = Math.max(1, Math.min(sorted.length, rule.percent ? Math.floor((sorted.length * rule.rank) / 100) : Math.floor(rule.rank)));
          threshold = rule.direction === 'top' ? (sorted[sorted.length - count] as number) : (sorted[count - 1] as number);
          state.resolved = threshold;
        }
        return (rule.direction === 'top' ? n >= threshold : n <= threshold) ? { style: rule.style } : false;
      }
      case 'average': {
        const n = toNumber(value);
        if (n === undefined) return false;
        const { avg, std, sorted } = statsOf(state);
        if (sorted.length === 0) return false;
        const k = rule.stdDev ?? 0;
        const ok = rule.direction === 'above'
          ? (rule.orEqual ? n >= avg + k * std : n > avg + k * std)
          : (rule.orEqual ? n <= avg - k * std : n < avg - k * std);
        return ok ? { style: rule.style } : false;
      }
      case 'blanks': return isBlank(value) ? { style: rule.style } : false;
      case 'noBlanks': return !isBlank(value) ? { style: rule.style } : false;
      case 'errors': return isErrorValue(value) ? { style: rule.style } : false;
      case 'noErrors': return !isErrorValue(value) ? { style: rule.style } : false;
      case 'formula': {
        if (!ctx.evaluateFormula || row < 0) return false;
        const result = ctx.evaluateFormula(rule.formula, { col: state.anchorCol, row: state.anchorRow }, { col, row });
        const ok = typeof result === 'boolean' ? result
          : typeof result === 'number' ? result !== 0
          : typeof result === 'string' ? result.toUpperCase() === 'TRUE'
          : false;
        return ok ? { style: rule.style } : false;
      }
      case 'predicate':
        return rule.test(value, item, row) ? { style: rule.style } : false;
      case 'colorScale': {
        const n = toNumber(value);
        if (n === undefined) return false;
        const stats = statsOf(state);
        if (stats.sorted.length === 0) return false;
        const stops = rule.stops;
        let points = state.resolved as number[] | undefined;
        if (!points) {
          points = stops.map((s, i) => resolveBound(s, stats, i === 0 ? 'min' : 'max'));
          state.resolved = points;
        }
        const first = stops[0] as IColorScaleStop;
        const last = stops[stops.length - 1] as IColorScaleStop;
        if (n <= (points[0] as number)) return { background: first.color };
        if (n >= (points[points.length - 1] as number)) return { background: last.color };
        for (let i = 1; i < points.length; i++) {
          const hi = points[i] as number;
          if (n <= hi) {
            const lo = points[i - 1] as number;
            const t = hi === lo ? 1 : (n - lo) / (hi - lo);
            return { background: interpolateColor((stops[i - 1] as IColorScaleStop).color, (stops[i] as IColorScaleStop).color, t) };
          }
        }
        return { background: last.color };
      }
      case 'dataBar': {
        const n = toNumber(value);
        if (n === undefined) return false;
        const stats = statsOf(state);
        let range = state.resolved as [number, number] | undefined;
        if (!range) {
          // Automatic ends: bars start at 0 unless values go below it.
          const lo = rule.min ? resolveBound(rule.min, stats, 'min') : Math.min(0, stats.min);
          const hi = rule.max ? resolveBound(rule.max, stats, 'max') : Math.max(0, stats.max);
          range = [lo, hi];
          state.resolved = range;
        }
        const [lo, hi] = range;
        const span = hi - lo;
        const pos = (v: number) => (span <= 0 ? (v > lo ? 100 : 0) : Math.min(100, Math.max(0, ((v - lo) / span) * 100)));
        const axis = lo >= 0 ? 0 : hi <= 0 ? 100 : pos(0);
        const p = pos(n);
        const negative = n < 0;
        return {
          dataBar: {
            start: Math.min(p, axis),
            end: Math.max(p, axis),
            color: negative ? (rule.negativeColor ?? DEFAULT_NEGATIVE_BAR) : (rule.color ?? DEFAULT_BAR),
            gradient: rule.gradient !== false,
            negative,
            barOnly: rule.barOnly === true,
          },
        };
      }
      case 'iconSet': {
        const n = toNumber(value);
        if (n === undefined) return false;
        const stats = statsOf(state);
        if (stats.sorted.length === 0) return false;
        let cut = state.resolved as [number, number] | undefined;
        if (!cut) {
          const [t1, t2] = rule.thresholds ?? [33, 67];
          const type = rule.thresholdType ?? 'percent';
          cut = [resolveBound({ type, value: t1 }, stats, 'min'), resolveBound({ type, value: t2 }, stats, 'max')];
          state.resolved = cut;
        }
        let index: 0 | 1 | 2 = n >= cut[1] ? 0 : n >= cut[0] ? 1 : 2;
        if (rule.reverse) index = (2 - index) as 0 | 1 | 2;
        return { icon: { set: rule.iconSet, index, iconOnly: rule.iconOnly === true } };
      }
    }
  };

  const cache = new WeakMap<object, Map<string, ICellConditionalFormat | null>>();

  const compute = (item: T, columnId: string): ICellConditionalFormat | undefined => {
    const list = byColumn.get(columnId);
    if (!list) return undefined;
    const col = colIndex.get(columnId) as number;
    const row = sheetRowOf(item);
    let value: unknown;
    let hasValue = false;
    let result: ICellConditionalFormat | undefined;
    for (const state of list) {
      if (!rowApplies(state.rule, item, row)) continue;
      if (!hasValue) { value = readValue(item, columns[col] as IColumnDef<T>, row, col); hasValue = true; }
      const hit = evaluate(state, value, item, row, col);
      if (!hit) continue;
      if (!result) result = { style: {} };
      if (hit.style) {
        for (const key of Object.keys(hit.style) as Array<keyof IConditionalFormatStyle>) {
          if (result.style[key] === undefined && hit.style[key] !== undefined) {
            (result.style as Record<string, unknown>)[key] = hit.style[key];
          }
        }
      }
      if (hit.background !== undefined && result.style.background === undefined) {
        result.style.background = hit.background;
        result.scaled = true;
      }
      if (hit.dataBar && !result.dataBar) result.dataBar = hit.dataBar;
      if (hit.icon && !result.icon) result.icon = hit.icon;
      if (state.rule.stopIfTrue) break;
    }
    return result;
  };

  return {
    getCellFormat(item: T, columnId: string): ICellConditionalFormat | undefined {
      if (!byColumn.has(columnId)) return undefined;
      if (item === null || typeof item !== 'object') return compute(item, columnId);
      let perItem = cache.get(item as object);
      if (!perItem) { perItem = new Map(); cache.set(item as object, perItem); }
      const hit = perItem.get(columnId);
      if (hit !== undefined) return hit ?? undefined;
      const computed = compute(item, columnId);
      perItem.set(columnId, computed ?? null);
      return computed;
    },
  };
}

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------

/** Options for conditionalFormatCellStyle. */
export interface ConditionalFormatCellStyleOptions {
  /** Translucent tint painted over the format (range selection, cut). */
  tint?: string;
  /** Paint an opaque base under the format (pinned/sticky cells). */
  opaque?: boolean;
}

/**
 * CSS for the cell element (`<td>`): fill, color-scale fill, data bar and
 * border, all as background longhands so text, the selection tint (`tint`,
 * the top layer), the active-cell and focus outlines and box-shadow overlays
 * (Find match highlight) draw on top. Undefined when the format has none.
 */
export function conditionalFormatCellStyle(
  cf: ICellConditionalFormat,
  options: ConditionalFormatCellStyleOptions = {},
): Record<string, string> | undefined {
  const { tint, opaque } = options;
  const bar = cf.dataBar;
  const fill = cf.style.background;
  if (!bar && !fill && !cf.style.border && !tint) return undefined;
  const images: string[] = [];
  const sizes: string[] = [];
  const positions: string[] = [];
  const layer = (image: string, size = '100% 100%', position = 'center') => {
    images.push(image);
    sizes.push(size);
    positions.push(position);
  };
  if (tint) layer(`linear-gradient(${tint}, ${tint})`);
  const border = cf.style.border;
  if (border) {
    // Four 1px edges as background layers: box-shadow (Find highlight) and
    // outline (focus) stay free for the grid's own overlays.
    const edge = `linear-gradient(${border}, ${border})`;
    layer(edge, '100% 1px', 'top');
    layer(edge, '100% 1px', 'bottom');
    layer(edge, '1px 100%', 'left');
    layer(edge, '1px 100%', 'right');
  }
  if (bar) {
    const s = bar.start.toFixed(2);
    const e = bar.end.toFixed(2);
    const color = bar.color;
    const fade = bar.gradient ? fadeOf(color, color) : color;
    // Negative bars grow left from the axis, so they fade toward the left.
    const [from, to] = bar.negative ? [fade, color] : [color, fade];
    layer(`linear-gradient(to right, transparent ${s}%, ${from} ${s}%, ${to} ${e}%, transparent ${e}%)`, '100% 70%');
  }
  if (fill && cf.scaled) layer('linear-gradient(var(--ogrid-cf-scale-veil, transparent), var(--ogrid-cf-scale-veil, transparent))');
  const style: Record<string, string> = {};
  if (fill && opaque) layer(`linear-gradient(${fill}, ${fill})`);
  if (images.length) {
    style.backgroundImage = images.join(', ');
    style.backgroundSize = sizes.join(', ');
    style.backgroundPosition = positions.join(', ');
    style.backgroundRepeat = 'no-repeat';
  }
  if (opaque) style.backgroundColor = 'var(--ogrid-bg, #fff)';
  else if (fill) style.backgroundColor = fill;
  return style;
}

/** CSS for the cell's text: color, weight, style, decoration. Undefined when the format sets none. */
export function conditionalFormatTextStyle(cf: ICellConditionalFormat): Record<string, string> | undefined {
  const { color, bold, italic, underline, strikethrough } = cf.style;
  const hideText = cf.dataBar?.barOnly || cf.icon?.iconOnly;
  if (color === undefined && bold === undefined && italic === undefined && underline === undefined && strikethrough === undefined && !hideText) return undefined;
  const style: Record<string, string> = {};
  if (hideText) style.color = 'transparent';
  else if (color !== undefined) style.color = color;
  if (bold !== undefined) style.fontWeight = bold ? '700' : '400';
  if (italic !== undefined) style.fontStyle = italic ? 'italic' : 'normal';
  if (underline || strikethrough) style.textDecoration = [underline ? 'underline' : '', strikethrough ? 'line-through' : ''].filter(Boolean).join(' ');
  return style;
}
