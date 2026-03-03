import {
  formatDateForDisplay,
  parseUserInputDate,
  getDateInputPlaceholder,
  DEFAULT_DATE_FORMAT,
} from '../dateFormatter';

// ---------------------------------------------------------------------------
// DEFAULT_DATE_FORMAT
// ---------------------------------------------------------------------------

describe('DEFAULT_DATE_FORMAT', () => {
  it('is YYYY-MM-DD', () => {
    expect(DEFAULT_DATE_FORMAT).toBe('YYYY-MM-DD');
  });
});

// ---------------------------------------------------------------------------
// getDateInputPlaceholder
// ---------------------------------------------------------------------------

describe('getDateInputPlaceholder', () => {
  it('returns MM/DD/YYYY for MM/DD/YYYY format', () => {
    expect(getDateInputPlaceholder('MM/DD/YYYY')).toBe('MM/DD/YYYY');
  });

  it('returns DD/MM/YYYY for DD/MM/YYYY format', () => {
    expect(getDateInputPlaceholder('DD/MM/YYYY')).toBe('DD/MM/YYYY');
  });

  it('returns YYYY-MM-DD for YYYY-MM-DD format', () => {
    expect(getDateInputPlaceholder('YYYY-MM-DD')).toBe('YYYY-MM-DD');
  });

  it('returns custom format as-is', () => {
    expect(getDateInputPlaceholder('DD.MM.YYYY')).toBe('DD.MM.YYYY');
  });
});

// ---------------------------------------------------------------------------
// formatDateForDisplay
// ---------------------------------------------------------------------------

describe('formatDateForDisplay', () => {
  describe('null / undefined / empty values', () => {
    it('returns null for null', () => {
      expect(formatDateForDisplay(null, 'MM/DD/YYYY')).toBeNull();
    });

    it('returns null for undefined', () => {
      expect(formatDateForDisplay(undefined, 'MM/DD/YYYY')).toBeNull();
    });

    it('returns null for invalid date string', () => {
      expect(formatDateForDisplay('not-a-date', 'MM/DD/YYYY')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(formatDateForDisplay('', 'MM/DD/YYYY')).toBeNull();
    });
  });

  describe('ISO date strings (UTC)', () => {
    it('formats YYYY-MM-DDT00:00:00.000Z to MM/DD/YYYY', () => {
      expect(formatDateForDisplay('2024-03-15T00:00:00.000Z', 'MM/DD/YYYY')).toBe('03/15/2024');
    });

    it('formats YYYY-MM-DDT00:00:00.000Z to DD/MM/YYYY', () => {
      expect(formatDateForDisplay('2024-03-15T00:00:00.000Z', 'DD/MM/YYYY')).toBe('15/03/2024');
    });

    it('formats YYYY-MM-DDT00:00:00.000Z to YYYY-MM-DD', () => {
      expect(formatDateForDisplay('2024-03-15T00:00:00.000Z', 'YYYY-MM-DD')).toBe('2024-03-15');
    });
  });

  describe('plain YYYY-MM-DD date strings', () => {
    it('formats 2024-01-01 to MM/DD/YYYY', () => {
      expect(formatDateForDisplay('2024-01-01', 'MM/DD/YYYY')).toBe('01/01/2024');
    });

    it('formats 2024-12-31 to DD/MM/YYYY', () => {
      expect(formatDateForDisplay('2024-12-31', 'DD/MM/YYYY')).toBe('31/12/2024');
    });

    it('formats 2024-06-15 to YYYY-MM-DD', () => {
      expect(formatDateForDisplay('2024-06-15', 'YYYY-MM-DD')).toBe('2024-06-15');
    });
  });

  describe('Date objects', () => {
    it('accepts a Date object and formats it', () => {
      const d = new Date(Date.UTC(2024, 2, 15)); // March 15, 2024 UTC
      expect(formatDateForDisplay(d, 'MM/DD/YYYY')).toBe('03/15/2024');
    });
  });

  describe('UTC timezone — no off-by-one day shifts', () => {
    // UTC midnight in negative-offset timezones must NOT shift the date backward
    it('2024-03-15T00:00:00.000Z renders as 03/15/2024 regardless of local timezone', () => {
      const result = formatDateForDisplay('2024-03-15T00:00:00.000Z', 'MM/DD/YYYY');
      expect(result).toBe('03/15/2024');
    });

    it('2000-01-01T00:00:00.000Z renders as 01/01/2000', () => {
      expect(formatDateForDisplay('2000-01-01T00:00:00.000Z', 'YYYY-MM-DD')).toBe('2000-01-01');
    });
  });

  describe('custom format patterns', () => {
    it('handles dot-separated DD.MM.YYYY', () => {
      expect(formatDateForDisplay('2024-03-15T00:00:00.000Z', 'DD.MM.YYYY')).toBe('15.03.2024');
    });

    it('handles YYYY/MM/DD', () => {
      expect(formatDateForDisplay('2024-03-15T00:00:00.000Z', 'YYYY/MM/DD')).toBe('2024/03/15');
    });
  });

  describe('zero-padding', () => {
    it('pads single-digit month and day', () => {
      expect(formatDateForDisplay('2024-01-05T00:00:00.000Z', 'MM/DD/YYYY')).toBe('01/05/2024');
    });
  });
});

// ---------------------------------------------------------------------------
// parseUserInputDate
// ---------------------------------------------------------------------------

describe('parseUserInputDate', () => {
  describe('null / empty / whitespace', () => {
    it('returns null for empty string', () => {
      expect(parseUserInputDate('', 'MM/DD/YYYY')).toBeNull();
    });

    it('returns null for whitespace-only string', () => {
      expect(parseUserInputDate('   ', 'YYYY-MM-DD')).toBeNull();
    });
  });

  describe('invalid input', () => {
    it('returns null for a non-date word', () => {
      expect(parseUserInputDate('hello', 'MM/DD/YYYY')).toBeNull();
    });

    it('returns null for month > 12', () => {
      expect(parseUserInputDate('13/05/2024', 'MM/DD/YYYY')).toBeNull();
    });

    it('returns null for day > 31', () => {
      expect(parseUserInputDate('01/32/2024', 'MM/DD/YYYY')).toBeNull();
    });

    it('returns null for Feb 30 (overflow)', () => {
      expect(parseUserInputDate('2024-02-30', 'YYYY-MM-DD')).toBeNull();
    });

    it('returns null for Feb 31', () => {
      expect(parseUserInputDate('02/31/2024', 'MM/DD/YYYY')).toBeNull();
    });
  });

  describe('standard three-part input (format: MM/DD/YYYY)', () => {
    it('parses 03/15/2024', () => {
      const d = parseUserInputDate('03/15/2024', 'MM/DD/YYYY');
      expect(d).not.toBeNull();
      expect(d!.getUTCFullYear()).toBe(2024);
      expect(d!.getUTCMonth()).toBe(2); // March = 2
      expect(d!.getUTCDate()).toBe(15);
    });

    it('parses with dash separators: 03-15-2024', () => {
      const d = parseUserInputDate('03-15-2024', 'MM/DD/YYYY');
      expect(d).not.toBeNull();
      expect(d!.getUTCMonth()).toBe(2);
      expect(d!.getUTCDate()).toBe(15);
    });

    it('parses with dot separators: 03.15.2024', () => {
      const d = parseUserInputDate('03.15.2024', 'MM/DD/YYYY');
      expect(d).not.toBeNull();
      expect(d!.getUTCDate()).toBe(15);
    });

    it('parses single-digit month and day: 3/5/2024', () => {
      const d = parseUserInputDate('3/5/2024', 'MM/DD/YYYY');
      expect(d).not.toBeNull();
      expect(d!.getUTCMonth()).toBe(2);
      expect(d!.getUTCDate()).toBe(5);
    });
  });

  describe('DD/MM/YYYY format', () => {
    it('parses 15/03/2024 correctly (day first)', () => {
      const d = parseUserInputDate('15/03/2024', 'DD/MM/YYYY');
      expect(d).not.toBeNull();
      expect(d!.getUTCFullYear()).toBe(2024);
      expect(d!.getUTCMonth()).toBe(2); // March
      expect(d!.getUTCDate()).toBe(15);
    });
  });

  describe('YYYY-MM-DD format', () => {
    it('parses 2024-03-15', () => {
      const d = parseUserInputDate('2024-03-15', 'YYYY-MM-DD');
      expect(d).not.toBeNull();
      expect(d!.getUTCFullYear()).toBe(2024);
      expect(d!.getUTCMonth()).toBe(2);
      expect(d!.getUTCDate()).toBe(15);
    });

    it('parses 2024/03/15 with slash separators', () => {
      const d = parseUserInputDate('2024/03/15', 'YYYY-MM-DD');
      expect(d).not.toBeNull();
      expect(d!.getUTCDate()).toBe(15);
    });
  });

  describe('two-digit year expansion', () => {
    it('expands year < 50 to 20xx', () => {
      const d = parseUserInputDate('03/15/24', 'MM/DD/YYYY');
      expect(d).not.toBeNull();
      expect(d!.getUTCFullYear()).toBe(2024);
    });

    it('expands year >= 50 to 19xx', () => {
      const d = parseUserInputDate('03/15/75', 'MM/DD/YYYY');
      expect(d).not.toBeNull();
      expect(d!.getUTCFullYear()).toBe(1975);
    });
  });

  describe('two-part input (M/D with implied current year)', () => {
    it('parses M/D and defaults to current UTC year for MM/DD/YYYY format', () => {
      const d = parseUserInputDate('3/15', 'MM/DD/YYYY');
      expect(d).not.toBeNull();
      expect(d!.getUTCFullYear()).toBe(new Date().getUTCFullYear());
      expect(d!.getUTCMonth()).toBe(2);
      expect(d!.getUTCDate()).toBe(15);
    });

    it('parses D/M and defaults to current UTC year for DD/MM/YYYY format', () => {
      const d = parseUserInputDate('15/3', 'DD/MM/YYYY');
      expect(d).not.toBeNull();
      expect(d!.getUTCFullYear()).toBe(new Date().getUTCFullYear());
      expect(d!.getUTCMonth()).toBe(2);
      expect(d!.getUTCDate()).toBe(15);
    });
  });

  describe('condensed 8-digit YYYYMMDD input', () => {
    it('parses 20240315', () => {
      const d = parseUserInputDate('20240315', 'MM/DD/YYYY');
      expect(d).not.toBeNull();
      expect(d!.getUTCFullYear()).toBe(2024);
      expect(d!.getUTCMonth()).toBe(2);
      expect(d!.getUTCDate()).toBe(15);
    });
  });

  describe('condensed 4-digit MMDD input', () => {
    it('parses 0315 and assigns current year', () => {
      const d = parseUserInputDate('0315', 'MM/DD/YYYY');
      expect(d).not.toBeNull();
      expect(d!.getUTCFullYear()).toBe(new Date().getUTCFullYear());
      expect(d!.getUTCMonth()).toBe(2);
      expect(d!.getUTCDate()).toBe(15);
    });
  });

  describe('UTC output', () => {
    it('returned Date has UTC time of 00:00:00.000', () => {
      const d = parseUserInputDate('2024-03-15', 'YYYY-MM-DD');
      expect(d).not.toBeNull();
      expect(d!.getUTCHours()).toBe(0);
      expect(d!.getUTCMinutes()).toBe(0);
      expect(d!.getUTCSeconds()).toBe(0);
      expect(d!.getUTCMilliseconds()).toBe(0);
    });
  });

  describe('round-trip: formatDateForDisplay ↔ parseUserInputDate', () => {
    const iso = '2024-06-01T00:00:00.000Z';

    it('round-trips via MM/DD/YYYY', () => {
      const displayed = formatDateForDisplay(iso, 'MM/DD/YYYY');
      expect(displayed).toBe('06/01/2024');
      const parsed = parseUserInputDate(displayed!, 'MM/DD/YYYY');
      expect(parsed).not.toBeNull();
      expect(parsed!.toISOString()).toBe('2024-06-01T00:00:00.000Z');
    });

    it('round-trips via DD/MM/YYYY', () => {
      const displayed = formatDateForDisplay(iso, 'DD/MM/YYYY');
      expect(displayed).toBe('01/06/2024');
      const parsed = parseUserInputDate(displayed!, 'DD/MM/YYYY');
      expect(parsed).not.toBeNull();
      expect(parsed!.toISOString()).toBe('2024-06-01T00:00:00.000Z');
    });

    it('round-trips via YYYY-MM-DD', () => {
      const displayed = formatDateForDisplay(iso, 'YYYY-MM-DD');
      expect(displayed).toBe('2024-06-01');
      const parsed = parseUserInputDate(displayed!, 'YYYY-MM-DD');
      expect(parsed).not.toBeNull();
      expect(parsed!.toISOString()).toBe('2024-06-01T00:00:00.000Z');
    });
  });
});
