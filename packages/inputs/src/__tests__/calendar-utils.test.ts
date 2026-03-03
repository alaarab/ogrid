import { getCalendarGrid, formatDate, parseDate, DAY_NAMES, MONTH_NAMES } from '../calendar/calendar-utils';

describe('calendar-utils', () => {
  describe('formatDate', () => {
    it('formats date with zero-padding', () => {
      expect(formatDate(2024, 0, 5)).toBe('2024-01-05');
      expect(formatDate(2024, 11, 25)).toBe('2024-12-25');
    });
  });

  describe('parseDate', () => {
    it('parses valid YYYY-MM-DD', () => {
      expect(parseDate('2024-03-15')).toEqual({ year: 2024, month: 2, date: 15 });
    });

    it('returns null for invalid format', () => {
      expect(parseDate('not-a-date')).toBeNull();
      expect(parseDate('')).toBeNull();
    });

    it('returns null for invalid date values', () => {
      expect(parseDate('2024-02-30')).toBeNull(); // Feb 30 doesn't exist
      expect(parseDate('2024-13-01')).toBeNull(); // Month 13
    });

    it('handles dates with extra text after YYYY-MM-DD', () => {
      const result = parseDate('2024-06-15T10:30:00Z');
      expect(result).toEqual({ year: 2024, month: 5, date: 15 });
    });
  });

  describe('getCalendarGrid', () => {
    it('returns 6 weeks of 7 days', () => {
      const grid = getCalendarGrid(2024, 0); // January 2024
      expect(grid).toHaveLength(6);
      grid.forEach((week) => expect(week).toHaveLength(7));
    });

    it('first day of month is in grid', () => {
      const grid = getCalendarGrid(2024, 0);
      const allDays = grid.flat();
      const jan1 = allDays.find((d) => d.date === 1 && d.month === 0 && d.year === 2024);
      expect(jan1).toBeDefined();
      expect(jan1!.isCurrentMonth).toBe(true);
    });

    it('marks adjacent month days correctly', () => {
      const grid = getCalendarGrid(2024, 0); // January 2024 starts on Monday
      const allDays = grid.flat();
      const adjacentDays = allDays.filter((d) => !d.isCurrentMonth);
      expect(adjacentDays.length).toBeGreaterThan(0);
    });

    it('marks today correctly', () => {
      const now = new Date();
      const grid = getCalendarGrid(now.getFullYear(), now.getMonth());
      const allDays = grid.flat();
      const todayCell = allDays.find((d) => d.isToday);
      expect(todayCell).toBeDefined();
      expect(todayCell!.date).toBe(now.getDate());
    });
  });

  describe('constants', () => {
    it('has 7 day names', () => {
      expect(DAY_NAMES).toHaveLength(7);
    });

    it('has 12 month names', () => {
      expect(MONTH_NAMES).toHaveLength(12);
    });
  });
});
