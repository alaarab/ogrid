/** Calendar utility functions  -  zero dependencies. */

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

export { DAY_NAMES, MONTH_NAMES };

export interface CalendarDay {
  date: number;
  month: number; // 0-indexed
  year: number;
  isCurrentMonth: boolean;
  isToday: boolean;
}

/**
 * Returns a 6×7 grid of CalendarDay objects for the given month/year.
 * Weeks start on Sunday. Cells from adjacent months fill the grid.
 */
export function getCalendarGrid(year: number, month: number): CalendarDay[][] {
  const today = new Date();
  const todayY = today.getFullYear();
  const todayM = today.getMonth();
  const todayD = today.getDate();

  const firstDay = new Date(year, month, 1);
  const startDow = firstDay.getDay(); // 0=Sun

  // Start from the Sunday of the first week
  const startDate = new Date(year, month, 1 - startDow);

  const weeks: CalendarDay[][] = [];
  const cursor = new Date(startDate);

  for (let w = 0; w < 6; w++) {
    const week: CalendarDay[] = [];
    for (let d = 0; d < 7; d++) {
      week.push({
        date: cursor.getDate(),
        month: cursor.getMonth(),
        year: cursor.getFullYear(),
        isCurrentMonth: cursor.getMonth() === month && cursor.getFullYear() === year,
        isToday: cursor.getFullYear() === todayY && cursor.getMonth() === todayM && cursor.getDate() === todayD,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }

  return weeks;
}

/** Format a date as YYYY-MM-DD. */
export function formatDate(year: number, month: number, date: number): string {
  const m = String(month + 1).padStart(2, '0');
  const d = String(date).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

/** Parse a YYYY-MM-DD string into { year, month, date }. Returns null if invalid. */
export function parseDate(str: string): { year: number; month: number; date: number } | null {
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const date = parseInt(match[3], 10);
  // Validate
  const d = new Date(year, month, date);
  if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== date) return null;
  return { year, month, date };
}
