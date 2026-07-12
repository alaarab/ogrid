/** DateTime utility functions  -  zero dependencies. */

import type { TimeValue } from '../TimePicker/timepicker-utils';

export interface DateTimeValue {
  year: number;
  month: number; // 0-indexed
  date: number;
  hours: number;   // 0-23
  minutes: number; // 0-59
}

/**
 * Parse an ISO-like datetime string "YYYY-MM-DD h:mm AM/PM" or "YYYY-MM-DDThh:mm".
 * Returns null if invalid.
 */
export function parseDateTime(str: string): DateTimeValue | null {
  if (!str) return null;
  const trimmed = str.trim();

  // Try "YYYY-MM-DD h:mm AM" format
  const match12 = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
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
    const d = new Date(year, month, date);
    if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== date) return null;
    return { year, month, date, hours, minutes };
  }

  // Try ISO "YYYY-MM-DDThh:mm" or "YYYY-MM-DD hh:mm"
  const match24 = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/);
  if (match24?.[1] != null && match24[2] != null && match24[3] != null && match24[4] != null && match24[5] != null) {
    const year = parseInt(match24[1], 10);
    const month = parseInt(match24[2], 10) - 1;
    const date = parseInt(match24[3], 10);
    const hours = parseInt(match24[4], 10);
    const minutes = parseInt(match24[5], 10);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    const d = new Date(year, month, date);
    if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== date) return null;
    return { year, month, date, hours, minutes };
  }

  return null;
}

/**
 * Format DateTimeValue as "YYYY-MM-DD h:mm AM/PM".
 */
export function formatDateTime(dt: DateTimeValue): string {
  const m = String(dt.month + 1).padStart(2, '0');
  const d = String(dt.date).padStart(2, '0');
  const datePart = `${dt.year}-${m}-${d}`;
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
