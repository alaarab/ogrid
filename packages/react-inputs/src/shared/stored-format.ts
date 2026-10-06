/**
 * Format preservation for the time and date-time editors: detect how a cell
 * value is stored (12/24-hour, seconds, ISO "T", time zone, Date, epoch) and
 * write edits back in that same shape, so opening an editor and committing
 * never rewrites a value into a different format. Internal: not public API.
 */
import { formatTime12, formatTime24, parseTime } from '@alaarab/ogrid-inputs';
import type { TimeValue } from '@alaarab/ogrid-inputs';
import { formatDateTime } from '../DateTimePicker/datetime-utils';
import type { DateTimeValue } from '../DateTimePicker/datetime-utils';

const pad = (n: number, len = 2) => String(n).padStart(len, '0');

// ── Time ("14:30", "14:30:00", "2:30 PM", "2:30:15 PM") ──

export interface StoredTimeFormat {
  hour12: boolean;
  /** Original seconds digits, or null when the value has no seconds. */
  seconds: string | null;
}

const TIME_RE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?(\s*(?:AM|PM))?$/i;

/** Parse a time with optional seconds. Seconds are validated but not part of the TimeValue. */
export function parseStoredTime(raw: string): { time: TimeValue; format: StoredTimeFormat } | null {
  const m = raw.trim().match(TIME_RE);
  if (!m?.[1] || !m[2]) return null;
  if (m[3] != null && parseInt(m[3], 10) > 59) return null;
  const time = parseTime(`${m[1]}:${m[2]}${m[4] ?? ''}`);
  if (!time) return null;
  return { time, format: { hour12: m[4] != null, seconds: m[3] ?? null } };
}

/**
 * Format a time in the stored shape. The editors pick whole minutes, so the
 * original seconds are kept only while the time is unchanged from `initial`.
 */
export function formatStoredTime(time: TimeValue, format: StoredTimeFormat, initial: TimeValue | null): string {
  const base = format.hour12 ? formatTime12(time) : formatTime24(time);
  if (format.seconds == null) return base;
  const unchanged = initial != null && initial.hours === time.hours && initial.minutes === time.minutes;
  const secs = `:${unchanged ? format.seconds : '00'}`;
  return format.hour12 ? base.replace(/ (AM|PM)$/, `${secs} $1`) : base + secs;
}

// ── Date-time ──

export interface StoredDateTimeFormat {
  kind: 'string' | 'date' | 'epoch';
  hour12: boolean;
  separator: 'T' | ' ';
  /** Original seconds / fraction digits (null when absent). */
  seconds: string | null;
  fraction: string | null;
  /** 'Z', '+hh:mm' / '-hh:mm', or null for local wall time. */
  zone: string | null;
}

const DEFAULT_DATETIME_FORMAT: StoredDateTimeFormat = {
  kind: 'string', hour12: true, separator: ' ', seconds: null, fraction: null, zone: null,
};

const ISO_RE = /^\d{4}-\d{2}-\d{2}([T ])\d{1,2}:\d{2}(?::(\d{2})(?:\.(\d+))?)?(Z|[+-]\d{2}:\d{2})?$/;
const AMPM_RE = /^\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}(?::(\d{2}))?\s*(?:AM|PM)$/i;

/** Detect the stored shape of a date-time cell value (12-hour string when empty or unknown). */
export function detectDateTimeFormat(value: unknown): StoredDateTimeFormat {
  if (value instanceof Date) {
    return { ...DEFAULT_DATETIME_FORMAT, kind: 'date', hour12: false, seconds: pad(value.getSeconds()), fraction: pad(value.getMilliseconds(), 3) };
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const d = new Date(value);
    return { ...DEFAULT_DATETIME_FORMAT, kind: 'epoch', hour12: false, seconds: pad(d.getSeconds()), fraction: pad(d.getMilliseconds(), 3) };
  }
  if (typeof value !== 'string') return DEFAULT_DATETIME_FORMAT;
  const raw = value.trim();
  const ampm = raw.match(AMPM_RE);
  if (ampm) return { ...DEFAULT_DATETIME_FORMAT, seconds: ampm[1] ?? null };
  const iso = raw.match(ISO_RE);
  if (iso) {
    return {
      kind: 'string',
      hour12: false,
      separator: iso[1] === 'T' ? 'T' : ' ',
      seconds: iso[2] ?? null,
      fraction: iso[3] ?? null,
      zone: iso[4] ?? null,
    };
  }
  // Date-only "YYYY-MM-DD" (or anything else): fall back to the 12-hour shape.
  return DEFAULT_DATETIME_FORMAT;
}

function sameMinute(a: DateTimeValue, b: DateTimeValue | null): boolean {
  return b != null && a.year === b.year && a.month === b.month && a.date === b.date
    && a.hours === b.hours && a.minutes === b.minutes;
}

function localInstant(dt: DateTimeValue, seconds: number, ms: number): Date {
  // setFullYear avoids the Date constructor mapping years 0-99 to 1900-1999.
  const d = new Date(2000, 0, 1, dt.hours, dt.minutes, seconds, ms);
  d.setFullYear(dt.year, dt.month, dt.date);
  return d;
}

function zoneOffsetMinutes(zone: string): number {
  if (zone === 'Z') return 0;
  const sign = zone.startsWith('-') ? -1 : 1;
  const [h, m] = zone.slice(1).split(':');
  return sign * (parseInt(h ?? '0', 10) * 60 + parseInt(m ?? '0', 10));
}

/**
 * Convert an edited date-time (local wall time) back into the stored shape:
 * a Date for Date cells, epoch milliseconds for number cells, and otherwise a
 * string with the original separator, seconds, fraction and time zone. The
 * original seconds/fraction are kept only while the minute is unchanged.
 */
export function toStoredDateTime(dt: DateTimeValue, format: StoredDateTimeFormat, initial: DateTimeValue | null): unknown {
  const unchanged = sameMinute(dt, initial);
  const secText = format.seconds == null ? null : unchanged ? format.seconds : '00';
  const fracText = format.fraction == null ? null : unchanged ? format.fraction : '0'.repeat(format.fraction.length);
  const secs = secText == null ? 0 : parseInt(secText, 10);
  const ms = fracText == null ? 0 : Math.round(parseFloat(`0.${fracText}`) * 1000);

  if (format.kind === 'date') return localInstant(dt, secs, ms);
  if (format.kind === 'epoch') return localInstant(dt, secs, ms).getTime();

  if (format.hour12) {
    const base = formatDateTime(dt, false);
    return secText == null ? base : base.replace(/ (AM|PM)$/, `:${secText} $1`);
  }

  let parts = dt;
  if (format.zone) {
    // Re-express the local instant in the stored zone's wall time.
    const instant = localInstant(dt, secs, ms);
    const shifted = new Date(instant.getTime() + zoneOffsetMinutes(format.zone) * 60_000);
    parts = {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth(),
      date: shifted.getUTCDate(),
      hours: shifted.getUTCHours(),
      minutes: shifted.getUTCMinutes(),
    };
  }
  const datePart = `${pad(parts.year, 4)}-${pad(parts.month + 1)}-${pad(parts.date)}`;
  let timePart = `${pad(parts.hours)}:${pad(parts.minutes)}`;
  if (secText != null) timePart += `:${secText}`;
  if (secText != null && fracText != null) timePart += `.${fracText}`;
  return `${datePart}${format.separator}${timePart}${format.zone ?? ''}`;
}

