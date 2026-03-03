import { getCalendarGrid, formatDate, parseDate, DAY_NAMES, MONTH_NAMES } from '@alaarab/ogrid-inputs';

describe('DatePickerEditorComponent imports', () => {
  it('calendar utils are available', () => {
    expect(DAY_NAMES).toHaveLength(7);
    expect(MONTH_NAMES).toHaveLength(12);
    expect(formatDate(2024, 0, 5)).toBe('2024-01-05');
  });

  it('getCalendarGrid returns 6x7 grid', () => {
    const grid = getCalendarGrid(2024, 0);
    expect(grid).toHaveLength(6);
    grid.forEach(week => expect(week).toHaveLength(7));
  });

  it('parseDate parses valid YYYY-MM-DD strings', () => {
    const result = parseDate('2024-03-15');
    expect(result).toEqual({ year: 2024, month: 2, date: 15 });
  });

  it('parseDate returns null for invalid strings', () => {
    expect(parseDate('not-a-date')).toBeNull();
    expect(parseDate('')).toBeNull();
  });

  it('formatDate pads month and day with leading zeros', () => {
    expect(formatDate(2024, 0, 1)).toBe('2024-01-01');
    expect(formatDate(2024, 11, 31)).toBe('2024-12-31');
  });

  it('calendar grid days have expected shape', () => {
    const grid = getCalendarGrid(2024, 2); // March 2024
    const day = grid[0][0];
    expect(day).toHaveProperty('year');
    expect(day).toHaveProperty('month');
    expect(day).toHaveProperty('date');
    expect(day).toHaveProperty('isCurrentMonth');
    expect(day).toHaveProperty('isToday');
  });

  it('DAY_NAMES starts with Su and ends with Sa', () => {
    expect(DAY_NAMES[0]).toBe('Su');
    expect(DAY_NAMES[6]).toBe('Sa');
  });

  it('MONTH_NAMES has correct first and last entries', () => {
    expect(MONTH_NAMES[0]).toBe('January');
    expect(MONTH_NAMES[11]).toBe('December');
  });
});
