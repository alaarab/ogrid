import { parseDateTime, formatDateTime } from '../DateTimePicker/datetime-utils';

describe('parseDateTime', () => {
  it('parses the 12-hour form', () => {
    expect(parseDateTime('2024-06-01 2:30 PM')).toEqual({
      year: 2024, month: 5, date: 1, hours: 14, minutes: 30,
    });
  });

  it('parses the 24-hour ISO form', () => {
    expect(parseDateTime('2024-06-01T14:30')).toEqual({
      year: 2024, month: 5, date: 1, hours: 14, minutes: 30,
    });
  });

  it('parses an ISO string with seconds as local wall time (I02)', () => {
    expect(parseDateTime('2024-01-15T10:30:00')).toEqual({
      year: 2024, month: 0, date: 15, hours: 10, minutes: 30,
    });
  });

  it('converts an ISO string with a Z suffix to local time (I02)', () => {
    const d = new Date('2024-01-15T10:30:00Z');
    expect(parseDateTime('2024-01-15T10:30:00Z')).toEqual({
      year: d.getFullYear(), month: d.getMonth(), date: d.getDate(), hours: d.getHours(), minutes: d.getMinutes(),
    });
  });

  it('parses a date-only string as midnight (I02)', () => {
    expect(parseDateTime('2024-01-15')).toEqual({
      year: 2024, month: 0, date: 15, hours: 0, minutes: 0,
    });
  });

  it('parses Date instances (I02)', () => {
    expect(parseDateTime(new Date(2024, 0, 15, 10, 30))).toEqual({
      year: 2024, month: 0, date: 15, hours: 10, minutes: 30,
    });
  });

  it('returns null for empty or unparseable input', () => {
    expect(parseDateTime('')).toBeNull();
    expect(parseDateTime(null)).toBeNull();
    expect(parseDateTime('garbage')).toBeNull();
    expect(parseDateTime('2024-02-30 10:00')).toBeNull();
    // Partial typing must not be read by a loose Date fallback.
    expect(parseDateTime('12')).toBeNull();
  });
});

describe('formatDateTime', () => {
  it('formats as 12-hour by default', () => {
    expect(formatDateTime({ year: 2024, month: 0, date: 15, hours: 14, minutes: 30 })).toBe('2024-01-15 2:30 PM');
  });

  it('formats as 24-hour when requested (I10)', () => {
    expect(formatDateTime({ year: 2024, month: 0, date: 15, hours: 14, minutes: 30 }, true)).toBe('2024-01-15 14:30');
  });
});
