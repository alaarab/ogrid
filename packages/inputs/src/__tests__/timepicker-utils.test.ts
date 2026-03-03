import {
  parseTime,
  formatTime12,
  formatTime24,
  toHour12,
  toAmPm,
  fromHour12,
  clampTime,
  getMinuteOptions,
  getHour12Options,
} from '../timepicker/timepicker-utils';

describe('parseTime', () => {
  it('returns null for empty string', () => {
    expect(parseTime('')).toBeNull();
  });

  it('parses 12-hour AM format', () => {
    expect(parseTime('2:30 AM')).toEqual({ hours: 2, minutes: 30 });
  });

  it('parses 12-hour PM format', () => {
    expect(parseTime('2:30 PM')).toEqual({ hours: 14, minutes: 30 });
  });

  it('parses 12:00 PM (noon)', () => {
    expect(parseTime('12:00 PM')).toEqual({ hours: 12, minutes: 0 });
  });

  it('parses 12:00 AM (midnight)', () => {
    expect(parseTime('12:00 AM')).toEqual({ hours: 0, minutes: 0 });
  });

  it('parses case-insensitive am/pm', () => {
    expect(parseTime('9:15 am')).toEqual({ hours: 9, minutes: 15 });
    expect(parseTime('9:15 pm')).toEqual({ hours: 21, minutes: 15 });
  });

  it('parses 24-hour format', () => {
    expect(parseTime('14:30')).toEqual({ hours: 14, minutes: 30 });
    expect(parseTime('0:00')).toEqual({ hours: 0, minutes: 0 });
    expect(parseTime('23:59')).toEqual({ hours: 23, minutes: 59 });
  });

  it('returns null for invalid hours (12-hr)', () => {
    expect(parseTime('13:00 AM')).toBeNull();
    expect(parseTime('0:00 AM')).toBeNull();
  });

  it('returns null for invalid minutes', () => {
    expect(parseTime('2:60 AM')).toBeNull();
    expect(parseTime('14:99')).toBeNull();
  });

  it('returns null for invalid 24-hr hours', () => {
    expect(parseTime('24:00')).toBeNull();
  });

  it('returns null for garbage input', () => {
    expect(parseTime('not a time')).toBeNull();
  });
});

describe('formatTime12', () => {
  it('formats noon correctly', () => {
    expect(formatTime12({ hours: 12, minutes: 0 })).toBe('12:00 PM');
  });

  it('formats midnight correctly', () => {
    expect(formatTime12({ hours: 0, minutes: 0 })).toBe('12:00 AM');
  });

  it('formats afternoon hours', () => {
    expect(formatTime12({ hours: 14, minutes: 30 })).toBe('2:30 PM');
  });

  it('formats morning hours', () => {
    expect(formatTime12({ hours: 9, minutes: 5 })).toBe('9:05 AM');
  });

  it('pads minutes with leading zero', () => {
    expect(formatTime12({ hours: 3, minutes: 5 })).toBe('3:05 AM');
  });
});

describe('formatTime24', () => {
  it('formats with leading zeros', () => {
    expect(formatTime24({ hours: 9, minutes: 5 })).toBe('09:05');
    expect(formatTime24({ hours: 0, minutes: 0 })).toBe('00:00');
    expect(formatTime24({ hours: 23, minutes: 59 })).toBe('23:59');
  });
});

describe('toHour12', () => {
  it('returns 12 for midnight (0)', () => {
    expect(toHour12(0)).toBe(12);
  });
  it('returns 12 for noon (12)', () => {
    expect(toHour12(12)).toBe(12);
  });
  it('returns 1 for 13:00', () => {
    expect(toHour12(13)).toBe(1);
  });
  it('returns same value for 1-11', () => {
    expect(toHour12(9)).toBe(9);
  });
});

describe('toAmPm', () => {
  it('returns AM for 0-11', () => {
    expect(toAmPm(0)).toBe('AM');
    expect(toAmPm(11)).toBe('AM');
  });
  it('returns PM for 12-23', () => {
    expect(toAmPm(12)).toBe('PM');
    expect(toAmPm(23)).toBe('PM');
  });
});

describe('fromHour12', () => {
  it('converts AM 12 to 0', () => {
    expect(fromHour12(12, 'AM')).toBe(0);
  });
  it('converts PM 12 to 12', () => {
    expect(fromHour12(12, 'PM')).toBe(12);
  });
  it('converts AM hours correctly', () => {
    expect(fromHour12(9, 'AM')).toBe(9);
  });
  it('converts PM hours correctly', () => {
    expect(fromHour12(2, 'PM')).toBe(14);
  });
});

describe('clampTime', () => {
  it('clamps to min', () => {
    expect(clampTime(-1, 0, 59)).toBe(0);
  });
  it('clamps to max', () => {
    expect(clampTime(60, 0, 59)).toBe(59);
  });
  it('returns value within range unchanged', () => {
    expect(clampTime(30, 0, 59)).toBe(30);
  });
});

describe('getMinuteOptions', () => {
  it('returns options at default step 5', () => {
    const opts = getMinuteOptions();
    expect(opts).toHaveLength(12);
    expect(opts[0]).toBe(0);
    expect(opts[1]).toBe(5);
    expect(opts[11]).toBe(55);
  });

  it('returns options at step 15', () => {
    const opts = getMinuteOptions(15);
    expect(opts).toEqual([0, 15, 30, 45]);
  });

  it('returns options at step 30', () => {
    const opts = getMinuteOptions(30);
    expect(opts).toEqual([0, 30]);
  });
});

describe('getHour12Options', () => {
  it('returns 12 options starting with 12', () => {
    const opts = getHour12Options();
    expect(opts).toHaveLength(12);
    expect(opts[0]).toBe(12);
    expect(opts[1]).toBe(1);
    expect(opts[11]).toBe(11);
  });
});
