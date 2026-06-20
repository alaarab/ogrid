import type { IColumnDef, IValueParserParams } from '../types/columnTypes';

/**
 * Result of parsing a cell value. When `valid` is false the change should be skipped.
 */
export interface ParseValueResult {
  valid: boolean;
  value: unknown;
}

/**
 * Run the column's valueParser (if any), or auto-validate select columns.
 * Returns `{ valid: true, value }` with the parsed value, or `{ valid: false }` to reject.
 */
export function parseValue<T>(
  newValue: unknown,
  oldValue: unknown,
  item: T,
  col: IColumnDef<T>
): ParseValueResult {
  // 1. Custom valueParser takes priority
  if (col.valueParser) {
    const params: IValueParserParams<T> = {
      newValue,
      oldValue,
      data: item,
      column: col,
    };
    const parsed = col.valueParser(params);
    if (parsed === undefined) {
      return { valid: false, value: undefined };
    }
    return { valid: true, value: parsed };
  }

  // 2. Auto-validate select columns against allowed values
  if (
    col.cellEditor === 'select' &&
    col.cellEditorParams?.values != null &&
    Array.isArray(col.cellEditorParams.values)
  ) {
    const allowedValues = col.cellEditorParams.values as unknown[];
    const strValue = typeof newValue === 'string' ? newValue : String(newValue ?? '');

    // Allow clearing (empty string)
    if (strValue === '') {
      return { valid: true, value: '' };
    }

    // Case-insensitive match; return canonical value from the options list
    const match = allowedValues.find(
      (v) => String(v).toLowerCase() === strValue.toLowerCase()
    );
    if (match !== undefined) {
      return { valid: true, value: match };
    }
    return { valid: false, value: undefined };
  }

  // 3. Auto-validate built-in column types
  const colType = col.type;
  if (colType === 'date') {
    const parsed = dateParser({ newValue, oldValue, data: item, column: col });
    return parsed === undefined ? { valid: false, value: undefined } : { valid: true, value: parsed };
  }
  if (colType === 'boolean') {
    const parsed = booleanParser({ newValue, oldValue, data: item, column: col });
    return parsed === undefined ? { valid: false, value: undefined } : { valid: true, value: parsed };
  }
  if (colType === 'numeric') {
    const parsed = numberParser({ newValue, oldValue, data: item, column: col });
    return parsed === undefined ? { valid: false, value: undefined } : { valid: true, value: parsed };
  }

  // 4. No parser, not a select column, no built-in type  -  pass through unchanged
  return { valid: true, value: newValue };
}

// --- Built-in parser helpers ---
// Consumers assign these to columns: { valueParser: numberParser }
// Return `undefined` to reject; `null` to clear the cell.

/**
 * Parses a value as a number. Strips whitespace and commas.
 * Returns `undefined` (reject) if result is NaN.
 */
export function numberParser<T>(params: IValueParserParams<T>): unknown {
  const { newValue } = params;
  if (newValue === '' || newValue == null) return null;
  const str = String(newValue).replace(/[\s,]/g, '');
  const num = Number(str);
  return Number.isNaN(num) ? undefined : num;
}

/**
 * Parses a currency string. Strips currency symbols ($, €, £, ¥), whitespace, commas.
 * Returns `undefined` (reject) if result is NaN.
 */
export function currencyParser<T>(params: IValueParserParams<T>): unknown {
  const { newValue } = params;
  if (newValue === '' || newValue == null) return null;
  const str = String(newValue)
    .replace(/[$\u20AC\u00A3\u00A5]/g, '') // $, €, £, ¥
    .replace(/[\s,]/g, '');
  const num = Number(str);
  return Number.isNaN(num) ? undefined : num;
}

/**
 * Parses a date string via `new Date()`. Returns ISO string or `undefined` if invalid.
 */
export function dateParser<T>(params: IValueParserParams<T>): unknown {
  const { newValue } = params;
  if (newValue === '' || newValue == null) return null;
  const str = String(newValue).trim();
  // A bare YYYY-MM-DD is already in the target format; return it verbatim (after
  // validation) so we never round-trip it through a Date, which would shift the
  // day in negative-UTC-offset timezones.
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    const probe = new Date(Number(y), Number(m) - 1, Number(d));
    if (probe.getMonth() !== Number(m) - 1 || probe.getDate() !== Number(d)) return undefined;
    return str;
  }
  const date = new Date(str);
  if (Number.isNaN(date.getTime())) return undefined;
  // ISO 8601 timestamps (with a `T` time component) represent a UTC-anchored
  // instant, so take their UTC date part. Non-ISO locale strings (e.g.
  // "3/15/2020") are parsed as *local* midnight; reading the UTC date there would
  // shift the day in positive-UTC-offset timezones, so use the local fields.
  if (str.includes('T')) {
    return date.toISOString().substring(0, 10);
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Validates an email address with a basic regex.
 * Returns the trimmed string or `undefined` if invalid.
 */
export function emailParser<T>(params: IValueParserParams<T>): unknown {
  const { newValue } = params;
  if (newValue === '' || newValue == null) return null;
  const str = String(newValue).trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str) ? str : undefined;
}

/**
 * Parses boolean-like values: true/false/yes/no/1/0.
 * Returns `undefined` if not recognized.
 */
export function booleanParser<T>(params: IValueParserParams<T>): unknown {
  const { newValue } = params;
  if (newValue === '' || newValue == null) return null;
  const str = String(newValue).trim().toLowerCase();
  if (['true', 'yes', '1'].includes(str)) return true;
  if (['false', 'no', '0'].includes(str)) return false;
  return undefined;
}
