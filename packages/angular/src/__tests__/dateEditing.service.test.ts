/**
 * Tests for Angular date editor integration with dateFormatter utilities.
 * These tests exercise the BaseInlineCellEditorComponent logic (extracted
 * as pure functions to avoid Angular dependency injection in unit tests).
 */

import {
  formatDateForDisplay,
  parseUserInputDate,
  getDateInputPlaceholder,
} from '@alaarab/ogrid-core';

// ---------------------------------------------------------------------------
// 1. formatDateForDisplay
// ---------------------------------------------------------------------------

describe('formatDateForDisplay', () => {
  describe('YYYY-MM-DD format (ISO default)', () => {
    it('formats ISO string in YYYY-MM-DD', () => {
      expect(formatDateForDisplay('2024-03-15T00:00:00.000Z', 'YYYY-MM-DD')).toBe('2024-03-15');
    });

    it('formats bare YYYY-MM-DD value in YYYY-MM-DD', () => {
      expect(formatDateForDisplay('2024-03-15', 'YYYY-MM-DD')).toBe('2024-03-15');
    });

    it('returns null for null input', () => {
      expect(formatDateForDisplay(null, 'YYYY-MM-DD')).toBeNull();
    });

    it('returns null for undefined input', () => {
      expect(formatDateForDisplay(undefined, 'YYYY-MM-DD')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(formatDateForDisplay('', 'YYYY-MM-DD')).toBeNull();
    });

    it('returns null for invalid date', () => {
      expect(formatDateForDisplay('not-a-date', 'YYYY-MM-DD')).toBeNull();
    });
  });

  describe('MM/DD/YYYY format', () => {
    it('formats ISO string as MM/DD/YYYY', () => {
      expect(formatDateForDisplay('2024-03-15T00:00:00.000Z', 'MM/DD/YYYY')).toBe('03/15/2024');
    });

    it('formats bare YYYY-MM-DD in MM/DD/YYYY', () => {
      expect(formatDateForDisplay('2024-01-05', 'MM/DD/YYYY')).toBe('01/05/2024');
    });

    it('pads single-digit month and day', () => {
      expect(formatDateForDisplay('2024-01-05', 'MM/DD/YYYY')).toBe('01/05/2024');
    });
  });

  describe('DD/MM/YYYY format', () => {
    it('formats ISO string as DD/MM/YYYY', () => {
      expect(formatDateForDisplay('2024-03-15T00:00:00.000Z', 'DD/MM/YYYY')).toBe('15/03/2024');
    });

    it('formats bare YYYY-MM-DD in DD/MM/YYYY', () => {
      expect(formatDateForDisplay('2024-12-31', 'DD/MM/YYYY')).toBe('31/12/2024');
    });
  });

  describe('UTC behavior', () => {
    it('does not shift date due to timezone offset (uses UTC)', () => {
      // "2024-03-15T00:00:00.000Z" should display as 2024-03-15, not 2024-03-14
      const result = formatDateForDisplay('2024-03-15T00:00:00.000Z', 'YYYY-MM-DD');
      expect(result).toBe('2024-03-15');
    });
  });
});

// ---------------------------------------------------------------------------
// 2. parseUserInputDate
// ---------------------------------------------------------------------------

describe('parseUserInputDate', () => {
  describe('YYYY-MM-DD format', () => {
    it('parses YYYY-MM-DD input', () => {
      const result = parseUserInputDate('2024-03-15', 'YYYY-MM-DD');
      expect(result).not.toBeNull();
      expect(result!.toISOString()).toBe('2024-03-15T00:00:00.000Z');
    });

    it('returns null for empty string', () => {
      expect(parseUserInputDate('', 'YYYY-MM-DD')).toBeNull();
    });

    it('returns null for invalid date', () => {
      expect(parseUserInputDate('not-a-date', 'YYYY-MM-DD')).toBeNull();
    });

    it('returns null for out-of-range month', () => {
      expect(parseUserInputDate('2024-13-01', 'YYYY-MM-DD')).toBeNull();
    });

    it('returns null for out-of-range day', () => {
      expect(parseUserInputDate('2024-02-30', 'YYYY-MM-DD')).toBeNull();
    });
  });

  describe('MM/DD/YYYY format', () => {
    it('parses MM/DD/YYYY correctly', () => {
      const result = parseUserInputDate('03/15/2024', 'MM/DD/YYYY');
      expect(result).not.toBeNull();
      expect(result!.toISOString()).toBe('2024-03-15T00:00:00.000Z');
    });

    it('parses single-digit month and day', () => {
      const result = parseUserInputDate('1/5/2024', 'MM/DD/YYYY');
      expect(result).not.toBeNull();
      expect(result!.getUTCMonth()).toBe(0); // January
      expect(result!.getUTCDate()).toBe(5);
    });

    it('returns null for invalid date', () => {
      expect(parseUserInputDate('13/01/2024', 'MM/DD/YYYY')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(parseUserInputDate('', 'MM/DD/YYYY')).toBeNull();
    });
  });

  describe('DD/MM/YYYY format', () => {
    it('parses DD/MM/YYYY correctly', () => {
      const result = parseUserInputDate('15/03/2024', 'DD/MM/YYYY');
      expect(result).not.toBeNull();
      expect(result!.toISOString()).toBe('2024-03-15T00:00:00.000Z');
    });

    it('differentiates DD/MM/YYYY from MM/DD/YYYY', () => {
      // 05/01/2024 in DD/MM should be January 5th, not May 1st
      const result = parseUserInputDate('05/01/2024', 'DD/MM/YYYY');
      expect(result).not.toBeNull();
      expect(result!.getUTCMonth()).toBe(0); // January
      expect(result!.getUTCDate()).toBe(5);
    });

    it('returns null for invalid day > 31', () => {
      expect(parseUserInputDate('32/01/2024', 'DD/MM/YYYY')).toBeNull();
    });
  });

  describe('roundtrip: formatDateForDisplay → parseUserInputDate', () => {
    const testDate = '2024-03-15T00:00:00.000Z';

    it('roundtrips through MM/DD/YYYY', () => {
      const displayed = formatDateForDisplay(testDate, 'MM/DD/YYYY');
      expect(displayed).not.toBeNull();
      const parsed = parseUserInputDate(displayed!, 'MM/DD/YYYY');
      expect(parsed).not.toBeNull();
      expect(parsed!.getUTCFullYear()).toBe(2024);
      expect(parsed!.getUTCMonth()).toBe(2); // March = index 2
      expect(parsed!.getUTCDate()).toBe(15);
    });

    it('roundtrips through DD/MM/YYYY', () => {
      const displayed = formatDateForDisplay(testDate, 'DD/MM/YYYY');
      expect(displayed).not.toBeNull();
      const parsed = parseUserInputDate(displayed!, 'DD/MM/YYYY');
      expect(parsed).not.toBeNull();
      expect(parsed!.getUTCFullYear()).toBe(2024);
      expect(parsed!.getUTCMonth()).toBe(2);
      expect(parsed!.getUTCDate()).toBe(15);
    });

    it('roundtrips through YYYY-MM-DD', () => {
      const displayed = formatDateForDisplay(testDate, 'YYYY-MM-DD');
      expect(displayed).not.toBeNull();
      const parsed = parseUserInputDate(displayed!, 'YYYY-MM-DD');
      expect(parsed).not.toBeNull();
      expect(parsed!.getUTCFullYear()).toBe(2024);
      expect(parsed!.getUTCMonth()).toBe(2);
      expect(parsed!.getUTCDate()).toBe(15);
    });
  });
});

// ---------------------------------------------------------------------------
// 3. getDateInputPlaceholder
// ---------------------------------------------------------------------------

describe('getDateInputPlaceholder', () => {
  it('returns YYYY-MM-DD for ISO format', () => {
    expect(getDateInputPlaceholder('YYYY-MM-DD')).toBe('YYYY-MM-DD');
  });

  it('returns MM/DD/YYYY for US format', () => {
    expect(getDateInputPlaceholder('MM/DD/YYYY')).toBe('MM/DD/YYYY');
  });

  it('returns DD/MM/YYYY for European format', () => {
    expect(getDateInputPlaceholder('DD/MM/YYYY')).toBe('DD/MM/YYYY');
  });

  it('returns custom format as-is', () => {
    expect(getDateInputPlaceholder('YYYY.MM.DD')).toBe('YYYY.MM.DD');
  });
});

// ---------------------------------------------------------------------------
// 4. Angular component date logic (simulated without DOM)
// ---------------------------------------------------------------------------

describe('Angular date editor component logic', () => {
  /**
   * Simulates syncFromInputs for the 'date' editorType.
   * Mirrors the logic in BaseInlineCellEditorComponent.syncFromInputs.
   */
  function syncDateValue(
    rawValue: unknown,
    editorType: 'native' | 'text' | 'calendar',
    dateFormat: string
  ): string {
    let strVal = rawValue != null ? String(rawValue) : '';
    if (editorType === 'native') {
      // Native <input type="date"> requires YYYY-MM-DD
      strVal = strVal.match(/^\d{4}-\d{2}-\d{2}/) ? strVal.substring(0, 10) : strVal;
    } else {
      strVal = formatDateForDisplay(strVal, dateFormat) ?? strVal;
    }
    return strVal;
  }

  /**
   * Simulates commitDateOrValue for non-native editors.
   * Returns the value to commit (ISO string, null for empty, or raw string for invalid).
   */
  function commitDateValue(localValue: string, dateFormat: string): unknown {
    if (!localValue.trim()) return null; // empty → clear cell
    const parsed = parseUserInputDate(localValue, dateFormat);
    if (parsed instanceof Date) return parsed.toISOString();
    return localValue; // fallback: pass through raw string
  }

  describe('syncFromInputs with native editor type', () => {
    it('extracts YYYY-MM-DD from full ISO string', () => {
      const result = syncDateValue('2024-03-15T00:00:00.000Z', 'native', 'YYYY-MM-DD');
      expect(result).toBe('2024-03-15');
    });

    it('keeps plain YYYY-MM-DD as-is', () => {
      const result = syncDateValue('2024-03-15', 'native', 'YYYY-MM-DD');
      expect(result).toBe('2024-03-15');
    });

    it('returns empty string for null', () => {
      const result = syncDateValue(null, 'native', 'YYYY-MM-DD');
      expect(result).toBe('');
    });
  });

  describe('syncFromInputs with text editor type', () => {
    it('formats ISO date to MM/DD/YYYY for text input', () => {
      const result = syncDateValue('2024-03-15T00:00:00.000Z', 'text', 'MM/DD/YYYY');
      expect(result).toBe('03/15/2024');
    });

    it('formats ISO date to DD/MM/YYYY for text input', () => {
      const result = syncDateValue('2024-12-31', 'text', 'DD/MM/YYYY');
      expect(result).toBe('31/12/2024');
    });

    it('formats ISO date to YYYY-MM-DD for text input', () => {
      const result = syncDateValue('2024-06-01', 'text', 'YYYY-MM-DD');
      expect(result).toBe('2024-06-01');
    });

    it('returns empty string for null value', () => {
      const result = syncDateValue(null, 'text', 'MM/DD/YYYY');
      expect(result).toBe('');
    });
  });

  describe('commitDateValue with text editors', () => {
    it('parses MM/DD/YYYY user input to ISO string', () => {
      const result = commitDateValue('03/15/2024', 'MM/DD/YYYY');
      expect(result).toBe('2024-03-15T00:00:00.000Z');
    });

    it('parses DD/MM/YYYY user input to ISO string', () => {
      const result = commitDateValue('15/03/2024', 'DD/MM/YYYY');
      expect(result).toBe('2024-03-15T00:00:00.000Z');
    });

    it('parses YYYY-MM-DD user input to ISO string', () => {
      const result = commitDateValue('2024-03-15', 'YYYY-MM-DD');
      expect(result).toBe('2024-03-15T00:00:00.000Z');
    });

    it('returns null for empty input', () => {
      const result = commitDateValue('', 'MM/DD/YYYY');
      expect(result).toBeNull();
    });

    it('passes through invalid date as raw string (caller can reject or display error)', () => {
      const result = commitDateValue('not-a-date', 'MM/DD/YYYY');
      expect(result).toBe('not-a-date');
    });
  });

  describe('all 3 format options end-to-end', () => {
    const isoDate = '2024-11-20T00:00:00.000Z';

    it('MM/DD/YYYY: display and commit roundtrip', () => {
      const displayed = syncDateValue(isoDate, 'text', 'MM/DD/YYYY');
      expect(displayed).toBe('11/20/2024');
      const committed = commitDateValue(displayed, 'MM/DD/YYYY');
      expect(committed).toBe('2024-11-20T00:00:00.000Z');
    });

    it('DD/MM/YYYY: display and commit roundtrip', () => {
      const displayed = syncDateValue(isoDate, 'text', 'DD/MM/YYYY');
      expect(displayed).toBe('20/11/2024');
      const committed = commitDateValue(displayed, 'DD/MM/YYYY');
      expect(committed).toBe('2024-11-20T00:00:00.000Z');
    });

    it('YYYY-MM-DD: display and commit roundtrip', () => {
      const displayed = syncDateValue(isoDate, 'text', 'YYYY-MM-DD');
      expect(displayed).toBe('2024-11-20');
      const committed = commitDateValue(displayed, 'YYYY-MM-DD');
      expect(committed).toBe('2024-11-20T00:00:00.000Z');
    });
  });
});
