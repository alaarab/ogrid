import type { IDataValidationRule, IListDataValidationRule, IColumnDef } from '../types';
import { getCellValue } from './cellValue';

export interface IDataValidationContext<T> {
  items: T[];
  columns: IColumnDef<T>[];
  namedRanges?: Record<string, string>;
  getValue?: (col: number, row: number, sheet?: string) => unknown;
  /** Injected by the formula feature; the proposed value overrides the target cell for custom formulas. */
  evaluateFormula?: (formula: string, anchor: { col: number; row: number }, cell: { col: number; row: number }, proposed?: { value: unknown }) => unknown;
  /** Optional source resolver (e.g. XLSX ranges including promoted header cells). */
  resolveSource?: (source: string, anchor: { col: number; row: number }, cell: { col: number; row: number }) => unknown[] | undefined;
}

const DAY = 86400000;
/** Excel 1900-system serial, including Excel's fictitious 1900-02-29. */
export function validationDateSerial(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  if (value instanceof Date || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value))) {
    const time = value instanceof Date ? value.getTime() : Date.parse(value);
    if (typeof value === 'string' && Number.isFinite(time) && new Date(Date.parse(value.slice(0, 10) + 'T00:00:00Z')).toISOString().slice(0, 10) !== value.slice(0, 10)) return NaN;
    const days = time / DAY + 25569;
    return days < 61 ? days - 1 : days;
  }
  return NaN;
}
function numeric(value: unknown): number {
  return typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
}
function timeSerial(value: unknown): number {
  if (value instanceof Date) return (value.getUTCHours() * 3600 + value.getUTCMinutes() * 60 + value.getUTCSeconds()) / 86400;
  if (typeof value === 'string') {
    const m = /^(\d{1,2}):(\d{2})(?::(\d{2}(?:\.\d+)?))?$/.exec(value);
    if (m) {
      const h = Number(m[1]), min = Number(m[2]), sec = Number(m[3] ?? 0);
      return h < 24 && min < 60 && sec < 60 ? (h * 3600 + min * 60 + sec) / 86400 : NaN;
    }
  }
  const n = numeric(value);
  return n >= 0 && n < 1 ? n : NaN;
}
function isError(v: unknown): boolean {
  return !!v && typeof v === 'object' && 'type' in v && String(v.type).startsWith('#');
}
function letterIndex(s: string): number {
  let n = 0;
  for (const c of s.toUpperCase()) n = n * 26 + c.charCodeAt(0) - 64;
  return n - 1;
}

/** Stateless validator: later rules override earlier rules on overlapping cells (like Excel). */
export function createDataValidator<T>(rules: readonly IDataValidationRule<T>[], context: IDataValidationContext<T>) {
  const colIndex = new Map(context.columns.map((c, i) => [c.columnId, i]));
  const read = (col: number, row: number, sheet?: string): unknown => {
    if (context.getValue) return context.getValue(col, row, sheet);
    const item = context.items[row], column = context.columns[col];
    return item !== undefined && column && !sheet ? getCellValue(item, column) : undefined;
  };
  const ruleFor = (item: T, columnId: string, row: number): IDataValidationRule<T> | undefined => {
    for (let i = rules.length - 1; i >= 0; i--) {
      const rule = rules[i];
      if (rule?.columnIds.includes(columnId) && row >= (rule.rows?.start ?? 0) && row <= (rule.rows?.end ?? Infinity) && (!rule.rowFilter || rule.rowFilter(item, row))) return rule;
    }
    return undefined;
  };
  const coords = (rule: IDataValidationRule<T>, columnId: string, row: number) => ({
    anchor: { col: colIndex.get(rule.anchor?.columnId ?? rule.columnIds[0] ?? '') ?? 0, row: rule.anchor?.row ?? rule.rows?.start ?? 0 },
    cell: { col: colIndex.get(columnId) ?? 0, row },
  });
  const listValues = (rule: IListDataValidationRule<T>, columnId: string, row: number): unknown[] => {
    if (rule.values) return rule.values;
    if (!rule.source) return [];
    const { anchor, cell } = coords(rule, columnId, row);
    const resolved = context.resolveSource?.(rule.source, anchor, cell);
    if (resolved) return resolved;
    let source = rule.source.replace(/^=/, '').trim();
    const named = context.namedRanges?.[source] ?? Object.entries(context.namedRanges ?? {}).find(([n]) => n.toLowerCase() === source.toLowerCase())?.[1];
    source = named ?? source;
    source = source.replace(/^=/, '');
    const m = /^(?:(?:'((?:[^']|'')+)'|([^!]+))!)?\$?([A-Z]+)\$?(\d+)(?::\$?([A-Z]+)\$?(\d+))?$/i.exec(source);
    if (m) {
      const area = source.slice(source.lastIndexOf('!') + 1);
      const refs = area.split(':');
      const shifted = (ref: string) => {
        const match = /^(\$?)([A-Z]+)(\$?)(\d+)$/i.exec(ref);
        return { col: letterIndex(match?.[2] ?? '') + (!named && !match?.[1] ? cell.col - anchor.col : 0), row: Number(match?.[4]) - 1 + (!named && !match?.[3] ? cell.row - anchor.row : 0) };
      };
      const start = shifted(refs[0] ?? ''), end = shifted(refs[1] ?? refs[0] ?? '');
      const c0 = start.col, c1 = end.col, r0 = start.row, r1 = end.row;
      if (Math.min(c0, c1, r0, r1) < 0) return [];
      // Bound source work for untrusted ranges; a list this large isn't usable as a dropdown.
      if ((Math.abs(c1 - c0) + 1) * (Math.abs(r1 - r0) + 1) > 100000) return [];
      const values: unknown[] = [];
      for (let r = Math.min(r0, r1); r <= Math.max(r0, r1); r++) for (let c = Math.min(c0, c1); c <= Math.max(c0, c1); c++) {
        const v = read(c, r, m[1]?.replace(/''/g, "'") ?? m[2]);
        if (v !== undefined && v !== null && v !== '') values.push(v);
      }
      return values;
    }
    const result = context.evaluateFormula?.(`=${source}`, anchor, cell);
    return Array.isArray(result) ? result.flat(Infinity) : result == null || isError(result) ? [] : [result];
  };
  const validate = (rule: IDataValidationRule<T>, value: unknown, columnId: string, row: number): boolean => {
    if (value === '' || value === null || value === undefined) return rule.allowBlank === true;
    const { anchor, cell } = coords(rule, columnId, row);
    // Formula text is checked by its computed result before anything is stored.
    if (typeof value === 'string' && value.startsWith('=') && context.evaluateFormula) {
      const result = context.evaluateFormula(value, cell, cell, { value });
      // Validation belongs to the user-editable anchor; spill children are checked by their displayed values.
      value = Array.isArray(result) ? Array.isArray(result[0]) ? result[0][0] : result[0] : result;
    }
    if (isError(value)) return false;
    if (rule.type === 'list') return listValues(rule, columnId, row).some((v) => String(v).toLowerCase() === String(value).toLowerCase());
    if (rule.type === 'custom') {
      if (!context.evaluateFormula) return false;
      const result = context.evaluateFormula(rule.formula, anchor, cell, { value });
      return !isError(result) && (result === true || (typeof result === 'number' && Number.isFinite(result) && result !== 0));
    }
    const convert = rule.type === 'date' ? validationDateSerial : rule.type === 'time' ? timeSerial : numeric;
    const n = rule.type === 'textLength' ? String(value).length : convert(value);
    if (!Number.isFinite(n) || (rule.type === 'whole' && !Number.isInteger(n))) return false;
    const bound = (v: number | string | undefined): number => {
      const resolved = typeof v === 'string' && v.startsWith('=') ? context.evaluateFormula?.(v, anchor, cell, { value }) : v;
      return convert(resolved);
    };
    const a = bound(rule.value), b = bound(rule.value2);
    if (!Number.isFinite(a)) return false;
    switch (rule.operator) {
      case 'between': return Number.isFinite(b) && n >= a && n <= b;
      case 'notBetween': return Number.isFinite(b) && (n < a || n > b);
      case 'equal': return n === a;
      case 'notEqual': return n !== a;
      case 'greaterThan': return n > a;
      case 'lessThan': return n < a;
      case 'greaterThanOrEqual': return n >= a;
      case 'lessThanOrEqual': return n <= a;
    }
  };
  return { ruleFor, listValues, validate, isValid: (item: T, columnId: string, row: number, value: unknown) => {
    const rule = ruleFor(item, columnId, row);
    return !rule || validate(rule, value, columnId, row);
  } };
}

/** Remove validation only from a rectangle, preserving the remainder of intersecting rules. */
export function replaceDataValidationRange<T>(rules: readonly IDataValidationRule<T>[], columnIds: string[], rows: { start: number; end: number }, replacement?: IDataValidationRule<T>): IDataValidationRule<T>[] {
  const out: IDataValidationRule<T>[] = [];
  for (const rule of rules) {
    const affected = rule.columnIds.filter((id) => columnIds.includes(id));
    const start = rule.rows?.start ?? 0, end = rule.rows?.end ?? Infinity;
    if (!affected.length || end < rows.start || start > rows.end) { out.push(rule); continue; }
    const origin = rule.anchor ?? { columnId: rule.columnIds[0] ?? '', row: start };
    const other = rule.columnIds.filter((id) => !columnIds.includes(id));
    if (other.length) out.push({ ...rule, columnIds: other, anchor: origin });
    if (start < rows.start) out.push({ ...rule, columnIds: affected, rows: { start, end: rows.start - 1 }, anchor: origin });
    if (end > rows.end) out.push({ ...rule, columnIds: affected, rows: { start: rows.end + 1, ...(Number.isFinite(end) ? { end } : {}) }, anchor: origin });
  }
  if (replacement) out.push({ ...replacement, columnIds, rows });
  return out;
}
