/**
 * Keyboard navigation helpers for the editors' button grids (calendar days,
 * color swatches). Internal: not part of the public API.
 */

export interface CalendarDate {
  year: number;
  month: number; // 0-indexed
  date: number;
}

function daysInMonth(year: number, month: number): number {
  const d = new Date(2000, 0, 1);
  d.setFullYear(year, month + 1, 0);
  return d.getDate();
}

function addDays(from: CalendarDate, days: number): CalendarDate {
  // setFullYear avoids the Date constructor mapping years 0-99 to 1900-1999.
  const d = new Date(2000, 0, 1);
  d.setFullYear(from.year, from.month, from.date + days);
  return { year: d.getFullYear(), month: d.getMonth(), date: d.getDate() };
}

function addMonths(from: CalendarDate, months: number): CalendarDate {
  const total = from.year * 12 + from.month + months;
  const year = Math.floor(total / 12);
  const month = total - year * 12;
  // Clamp the day: Jan 31 + 1 month is Feb 28/29, not Mar 2/3.
  return { year, month, date: Math.min(from.date, daysInMonth(year, month)) };
}

/**
 * The date a calendar key moves focus to (WAI-ARIA date picker grid pattern):
 * arrows move by day/week, Home/End to the start/end of the week (Sunday
 * first), PageUp/PageDown by month, Shift+PageUp/PageDown by year.
 * Returns null for keys that are not calendar navigation.
 */
export function nextCalendarDate(from: CalendarDate, key: string, shiftKey = false): CalendarDate | null {
  switch (key) {
    case 'ArrowLeft': return addDays(from, -1);
    case 'ArrowRight': return addDays(from, 1);
    case 'ArrowUp': return addDays(from, -7);
    case 'ArrowDown': return addDays(from, 7);
    case 'Home': {
      const d = new Date(2000, 0, 1);
      d.setFullYear(from.year, from.month, from.date);
      return addDays(from, -d.getDay());
    }
    case 'End': {
      const d = new Date(2000, 0, 1);
      d.setFullYear(from.year, from.month, from.date);
      return addDays(from, 6 - d.getDay());
    }
    case 'PageUp': return addMonths(from, shiftKey ? -12 : -1);
    case 'PageDown': return addMonths(from, shiftKey ? 12 : 1);
    default: return null;
  }
}

/**
 * The index a key moves focus to in a row-major grid of `count` items laid out
 * in `columns` columns. Clamps at the edges; returns null for other keys.
 */
export function nextGridIndex(index: number, key: string, count: number, columns: number): number | null {
  if (count <= 0) return null;
  let next: number;
  switch (key) {
    case 'ArrowLeft': next = index - 1; break;
    case 'ArrowRight': next = index + 1; break;
    case 'ArrowUp': next = index - columns; break;
    case 'ArrowDown': next = index + columns; break;
    case 'Home': next = 0; break;
    case 'End': next = count - 1; break;
    default: return null;
  }
  if (next < 0 || next >= count) return index;
  return next;
}
