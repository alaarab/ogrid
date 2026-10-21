import type { ConditionFilterKind, ConditionOperator, IColumnDef, IFilterCondition, IFilters, FilterValue, MultiSelectFilterMode } from '../types';
import { CONDITION_OPERATORS, normalizeConditionFilter, resolveConditionFilterKind } from './conditionFilter';
import { getFilterField } from './ogridHelpers';

/** A filter entry `validateFilters` dropped, and why. */
export interface IInvalidFilter {
  field: string;
  reason: string;
}

/** Result of {@link validateFilters} / {@link parseFilters}: the usable filters plus what was dropped. */
export interface IFilterValidationResult {
  filters: IFilters;
  invalid: IInvalidFilter[];
}

const MODES: readonly MultiSelectFilterMode[] = ['any', 'all', 'none'];
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const hasOwn = (o: object, key: string): boolean => Object.prototype.hasOwnProperty.call(o, key);

/** A real calendar day in YYYY-MM-DD (rejects 2026-02-30 and 2026-99-99). */
function isCalendarDay(v: string): boolean {
  if (!ISO_DAY.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Sets an own data property, even for keys like "__proto__". */
function setOwn<V>(target: Record<string, V>, key: string, value: V): void {
  Object.defineProperty(target, key, { value, enumerable: true, writable: true, configurable: true });
}
const isOperand = (v: unknown): v is string | number => typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v));

/** Rebuild one entry from known fields only, or return why it can't be used. */
function cleanFilterValue(raw: unknown): FilterValue | string {
  if (!isRecord(raw) || typeof raw.type !== 'string') return 'not a filter value';
  const { value } = raw;
  switch (raw.type) {
    case 'text':
      if (typeof value !== 'string') return 'text value must be a string';
      return value.trim() ? { type: 'text', value } : 'empty text';
    case 'multiSelect': {
      if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) return 'multiSelect value must be a string array';
      if (value.length === 0) return 'no options selected';
      const mode = raw.mode;
      if (mode !== undefined && (typeof mode !== 'string' || !MODES.includes(mode as MultiSelectFilterMode))) {
        return typeof mode === 'string' ? `unknown multiSelect mode "${mode}"` : 'multiSelect mode must be a string';
      }
      return mode === undefined || mode === 'any'
        ? { type: 'multiSelect', value: [...value] }
        : { type: 'multiSelect', value: [...value], mode: mode as MultiSelectFilterMode };
    }
    case 'people':
      if (!isRecord(value) || typeof value.email !== 'string' || !value.email || typeof value.displayName !== 'string') {
        return 'people value needs email and displayName';
      }
      return {
        type: 'people',
        value: {
          email: value.email,
          displayName: value.displayName,
          ...(typeof value.id === 'string' ? { id: value.id } : {}),
          ...(typeof value.photo === 'string' ? { photo: value.photo } : {}),
        },
      };
    case 'date': {
      if (!isRecord(value)) return 'date value must be { from?, to? }';
      // Every bound given must be a real day: dropping a bad one would quietly widen the range.
      for (const bound of ['from', 'to'] as const) {
        const b = value[bound];
        if (b !== undefined && b !== '' && (typeof b !== 'string' || !isCalendarDay(b))) return `date ${bound} must be a real day (YYYY-MM-DD)`;
      }
      const from = typeof value.from === 'string' && value.from ? value.from : undefined;
      const to = typeof value.to === 'string' && value.to ? value.to : undefined;
      if (!from && !to) return 'date range needs from or to (YYYY-MM-DD)';
      return { type: 'date', value: { ...(from ? { from } : {}), ...(to ? { to } : {}) } };
    }
    case 'condition': {
      if (!isRecord(value) || !Array.isArray(value.conditions)) return 'condition value needs conditions';
      // Own keys only: "constructor" or "toString" must not resolve to inherited members.
      if (typeof value.kind !== 'string' || !hasOwn(CONDITION_OPERATORS, value.kind)) {
        return typeof value.kind === 'string' ? `unknown condition kind "${value.kind}"` : 'condition kind must be a string';
      }
      const kind = value.kind as ConditionFilterKind;
      const operators = CONDITION_OPERATORS[kind] as readonly ConditionOperator[];
      const conditions: IFilterCondition[] = [];
      for (const c of value.conditions) {
        if (!isRecord(c) || typeof c.operator !== 'string' || !operators.includes(c.operator as ConditionOperator)) continue;
        conditions.push({
          operator: c.operator as ConditionOperator,
          ...(isOperand(c.value) ? { value: c.value } : {}),
          ...(isOperand(c.valueTo) ? { valueTo: c.valueTo } : {}),
        });
      }
      const normalized = normalizeConditionFilter({ kind, conditions, join: value.join === 'or' ? 'or' : 'and' });
      return normalized ? { type: 'condition', value: normalized } : 'no complete condition';
    }
    default:
      return `unknown filter type "${raw.type}"`;
  }
}

/** The filter value type a column's filter UI produces, and the condition kind for condition filters. */
function expectedFor<T>(col: IColumnDef<T>): { type: FilterValue['type']; kind?: ConditionFilterKind } | undefined {
  const t = col.filterable?.type;
  if (!t) return undefined;
  if (t === 'number' || t === 'condition') return { type: 'condition', kind: resolveConditionFilterKind(col) };
  return { type: t };
}

/**
 * Check filter state from an untrusted source (URL, storage, an older app
 * version) and keep only what the grid can apply. Each entry is rebuilt from
 * its known fields; malformed ones are dropped and listed in `invalid`. With
 * `columns`, entries must also belong to a filterable column (by its filter
 * field) and match that column's filter type. Never throws.
 */
export function validateFilters<T>(value: unknown, columns?: readonly IColumnDef<T>[]): IFilterValidationResult {
  const filters: IFilters = {};
  const invalid: IInvalidFilter[] = [];
  if (!isRecord(value)) {
    if (value != null) invalid.push({ field: '', reason: 'filters must be an object' });
    return { filters, invalid };
  }
  const byField = columns ? new Map(columns.filter((c) => c.filterable).map((c) => [getFilterField(c), c])) : undefined;
  for (const field of Object.keys(value)) {
    if (value[field] === undefined) continue;
    let cleaned: FilterValue | string;
    try {
      cleaned = cleanFilterValue(value[field]);
    } catch {
      // Getters or proxies in hand-built input: drop the entry, never throw.
      cleaned = 'unreadable filter value';
    }
    if (typeof cleaned === 'string') {
      invalid.push({ field, reason: cleaned });
      continue;
    }
    if (byField) {
      const col = byField.get(field);
      const expected = col ? expectedFor(col) : undefined;
      if (!col || !expected) {
        invalid.push({ field, reason: 'no filterable column for this field' });
        continue;
      }
      if (expected.type !== cleaned.type || (cleaned.type === 'condition' && expected.kind && cleaned.value.kind !== expected.kind)) {
        invalid.push({ field, reason: `column expects a ${expected.kind ? `${expected.kind} ` : ''}${expected.type} filter` });
        continue;
      }
    }
    setOwn(filters, field, cleaned);
  }
  return { filters, invalid };
}

/**
 * Filter state as a compact string for a URL parameter or storage (JSON with
 * sorted keys, empty entries dropped). Returns '' when no filter is set.
 * Read it back with {@link parseFilters}.
 */
export function serializeFilters(filters: IFilters | undefined): string {
  const { filters: clean } = validateFilters(filters);
  const fields = Object.keys(clean).sort();
  if (fields.length === 0) return '';
  const ordered: IFilters = {};
  for (const field of fields) setOwn(ordered, field, clean[field]);
  return JSON.stringify(ordered);
}

/**
 * Read filter state written by {@link serializeFilters}. Bad JSON gives empty
 * filters; bad entries are dropped (see {@link validateFilters}). Never throws.
 */
export function parseFilters<T>(text: string | null | undefined, columns?: readonly IColumnDef<T>[]): IFilterValidationResult {
  if (!text) return { filters: {}, invalid: [] };
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { filters: {}, invalid: [{ field: '', reason: 'not valid JSON' }] };
  }
  return validateFilters(value, columns);
}
