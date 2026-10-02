/** DateTime utility functions  -  zero dependencies. */

import type { TimeValue } from '../TimePicker/timepicker-utils';

export interface DateTimeValue {
  year: number;
  month: number; // 0-indexed
  date: number;
  hours: number;   // 0-23
  minutes: number; // 0-59
}

/** True when year/month/date form a real calendar date (works for years 0-99). */
function isValidYmd(year: number, month: number, date: number): boolean {
  const d = new Date(2000, 0, 1);
  d.setFullYear(year, month, date);
  return d.getFullYear() === year && d.getMonth() === month && d.getDate() === date;
}

/** Build a DateTimeValue from a Date's local components. */
function fromDate(d: Date): DateTimeValue {
  return {
    year: d.getFullYear(),
    month: d.getMonth(),
    date: d.getDate(),
    hours: d.getHours(),
    minutes: d.getMinutes(),
  };
}

/**
 * Parse a stored datetime into its parts. Accepts:
 *   - "YYYY-MM-DD h:mm AM/PM" (and optional seconds)
 *   - ISO-like "YYYY-MM-DDThh:mm[:ss[.sss]]" or the space variant (local wall time)
 *   - ISO with a zone ("...Z" or "...+hh:mm"), converted to local time
 *   - date-only "YYYY-MM-DD" (midnight)
 *   - Date instances and epoch-millisecond numbers
 * Returns null if invalid.
 */
export function parseDateTime(input: string | number | Date | null | undefined): DateTimeValue | null {
  if (input == null || input === '') return null;

  if (typeof input !== 'string') {
    const d = input instanceof Date ? input : new Date(input);
    return Number.isNaN(d.getTime()) ? null : fromDate(d);
  }

  const trimmed = input.trim();
  if (!trimmed) return null;

  // Try "YYYY-MM-DD h:mm[:ss] AM" format
  const match12 = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (match12?.[1] != null && match12[2] != null && match12[3] != null && match12[4] != null && match12[5] != null && match12[6] != null) {
    const year = parseInt(match12[1], 10);
    const month = parseInt(match12[2], 10) - 1;
    const date = parseInt(match12[3], 10);
    let hours = parseInt(match12[4], 10);
    const minutes = parseInt(match12[5], 10);
    const ampm = match12[6].toUpperCase();
    if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null;
    if (ampm === 'AM') { hours = hours === 12 ? 0 : hours; }
    else { hours = hours === 12 ? 12 : hours + 12; }
    if (!isValidYmd(year, month, date)) return null;
    return { year, month, date, hours, minutes };
  }

  // Try ISO "YYYY-MM-DDThh:mm[:ss[.sss]]" or the space variant
  const match24 = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/);
  if (match24?.[1] != null && match24[2] != null && match24[3] != null && match24[4] != null && match24[5] != null) {
    const year = parseInt(match24[1], 10);
    const month = parseInt(match24[2], 10) - 1;
    const date = parseInt(match24[3], 10);
    const hours = parseInt(match24[4], 10);
    const minutes = parseInt(match24[5], 10);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    if (!isValidYmd(year, month, date)) return null;
    return { year, month, date, hours, minutes };
  }

  // Try date-only "YYYY-MM-DD"
  const matchDate = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (matchDate?.[1] != null && matchDate[2] != null && matchDate[3] != null) {
    const year = parseInt(matchDate[1], 10);
    const month = parseInt(matchDate[2], 10) - 1;
    const date = parseInt(matchDate[3], 10);
    if (!isValidYmd(year, month, date)) return null;
    return { year, month, date, hours: 0, minutes: 0 };
  }

  // ISO with an explicit zone names an instant, so show it in local time.
  // (A loose `new Date(text)` fallback would accept typed junk like "12".)
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(trimmed)) {
    const zoned = new Date(trimmed);
    return Number.isNaN(zoned.getTime()) ? null : fromDate(zoned);
  }

  return null;
}

/**
 * Format DateTimeValue as "YYYY-MM-DD h:mm AM/PM" (or "YYYY-MM-DD HH:mm" when
 * `use24Hour` is true, matching a stored 24-hour value).
 */
export function formatDateTime(dt: DateTimeValue, use24Hour = false): string {
  const y = String(dt.year).padStart(4, '0');
  const m = String(dt.month + 1).padStart(2, '0');
  const d = String(dt.date).padStart(2, '0');
  const datePart = `${y}-${m}-${d}`;
  if (use24Hour) {
    const h = String(dt.hours).padStart(2, '0');
    const min = String(dt.minutes).padStart(2, '0');
    return `${datePart} ${h}:${min}`;
  }
  const ampm = dt.hours < 12 ? 'AM' : 'PM';
  const h = dt.hours % 12 === 0 ? 12 : dt.hours % 12;
  const min = String(dt.minutes).padStart(2, '0');
  return `${datePart} ${h}:${min} ${ampm}`;
}

/**
 * Extract just the TimeValue from a DateTimeValue.
 */
export function getTimeFromDateTime(dt: DateTimeValue): TimeValue {
  return { hours: dt.hours, minutes: dt.minutes };
}
