/**
 * Date formatting utilities for OGrid.
 * Pure TypeScript — no framework dependencies.
 * All operations default to UTC to avoid off-by-one day shifts.
 */

export const DEFAULT_DATE_FORMAT = 'YYYY-MM-DD';

/**
 * Format a date value for display using the given format string.
 *
 * Supported tokens:
 *   YYYY  — 4-digit year
 *   MM    — 2-digit month (01–12)
 *   DD    — 2-digit day (01–31)
 *
 * Custom separators (/, -, ., space, etc.) are preserved as-is.
 *
 * @param value     Raw cell value (ISO string, Date, number, or anything coercible to a date string).
 * @param format    Target display format (e.g. 'MM/DD/YYYY').
 * @param timeZone  IANA timezone for display. Defaults to 'UTC'.
 * @returns Formatted date string, or null when the value is null/undefined/invalid.
 */
export function formatDateForDisplay(
  value: unknown,
  format: string,
  timeZone = 'UTC'
): string | null {
  if (value == null) return null;

  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;

  let year: number;
  let month: number;
  let day: number;

  if (timeZone === 'UTC') {
    year = d.getUTCFullYear();
    month = d.getUTCMonth() + 1;
    day = d.getUTCDate();
  } else {
    // Use Intl.DateTimeFormat for non-UTC timezone support
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = fmt.formatToParts(d);
    year = parseInt(parts.find((p) => p.type === 'year')?.value ?? '0', 10);
    month = parseInt(parts.find((p) => p.type === 'month')?.value ?? '0', 10);
    day = parseInt(parts.find((p) => p.type === 'day')?.value ?? '0', 10);
  }

  const yyyy = String(year).padStart(4, '0');
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');

  return format
    .replace('YYYY', yyyy)
    .replace('MM', mm)
    .replace('DD', dd);
}

/**
 * Parse a user-typed date string into a UTC Date object.
 *
 * The parser is deliberately forgiving:
 *   - Accepts common separators: `/`, `-`, `.`, or whitespace
 *   - Accepts partial dates: two parts (M/D or D/M) → implies current UTC year
 *   - Accepts condensed 8-digit (YYYYMMDD) or 4-digit (MMDD) numbers
 *   - Handles two-digit years (< 50 → 20xx, >= 50 → 19xx)
 *   - The `format` hint determines field order (M/D/Y vs D/M/Y vs Y/M/D)
 *
 * @param input   The raw string typed by the user.
 * @param format  Format hint that indicates expected field order (e.g. 'MM/DD/YYYY').
 * @returns A UTC Date at midnight (00:00:00.000Z), or null for invalid/unparseable input.
 */
export function parseUserInputDate(input: string, format: string): Date | null {
  if (!input || !input.trim()) return null;

  const trimmed = input.trim();
  const parts = trimmed.split(/[/\-.\s]+/).filter(Boolean);

  if (parts.length === 0) return null;

  const currentYear = new Date().getUTCFullYear();
  const order = detectFormatOrder(format);

  let year: number | undefined;
  let month: number | undefined;
  let day: number | undefined;

  if (parts.length === 3) {
    const [a, b, c] = parts.map(Number);
    if (order === 'YMD') {
      year = a; month = b; day = c;
    } else if (order === 'DMY') {
      day = a; month = b; year = c;
    } else {
      // MDY (default)
      month = a; day = b; year = c;
    }
    // Two-digit year expansion
    if (year !== undefined && year < 100) {
      year = year < 50 ? 2000 + year : 1900 + year;
    }
  } else if (parts.length === 2) {
    const [a, b] = parts.map(Number);
    if (order === 'DMY') {
      day = a; month = b;
    } else {
      month = a; day = b;
    }
    year = currentYear;
  } else if (parts.length === 1) {
    const raw = parts[0];
    if (/^\d+$/.test(raw)) {
      if (raw.length === 8) {
        // YYYYMMDD
        year = parseInt(raw.slice(0, 4), 10);
        month = parseInt(raw.slice(4, 6), 10);
        day = parseInt(raw.slice(6, 8), 10);
      } else if (raw.length === 4) {
        // MMDD with current year
        month = parseInt(raw.slice(0, 2), 10);
        day = parseInt(raw.slice(2, 4), 10);
        year = currentYear;
      } else {
        return null;
      }
    } else {
      return null;
    }
  } else {
    return null;
  }

  if (!isValidDateParts(year, month, day)) return null;

  const d = new Date(Date.UTC(year as number, (month as number) - 1, day as number));
  // Guard against overflow (e.g. Feb 30 → Mar 2)
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() + 1 !== month ||
    d.getUTCDate() !== day
  ) {
    return null;
  }

  return d;
}

/**
 * Returns a placeholder string appropriate for the given date format.
 *
 * For the three standard formats (and any custom format), the format pattern
 * itself is returned so the user knows what to type.
 *
 * @example
 *   getDateInputPlaceholder('MM/DD/YYYY') // => 'MM/DD/YYYY'
 *   getDateInputPlaceholder('DD/MM/YYYY') // => 'DD/MM/YYYY'
 *   getDateInputPlaceholder('YYYY-MM-DD') // => 'YYYY-MM-DD'
 */
export function getDateInputPlaceholder(format: string): string {
  return format;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type FormatOrder = 'MDY' | 'DMY' | 'YMD';

/** Determine the field order from a format string by comparing token positions. */
function detectFormatOrder(format: string): FormatOrder {
  const yIdx = format.indexOf('Y');
  const mIdx = format.indexOf('M');
  const dIdx = format.indexOf('D');

  if (yIdx === -1 || mIdx === -1 || dIdx === -1) return 'MDY';

  if (yIdx < mIdx && mIdx < dIdx) return 'YMD';
  if (dIdx < mIdx && mIdx < yIdx) return 'DMY';
  return 'MDY';
}

function isValidDateParts(
  year: number | undefined,
  month: number | undefined,
  day: number | undefined
): boolean {
  if (year == null || month == null || day == null) return false;
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  return true;
}
