import { describe, expect, test } from 'bun:test';
import { formatGeneral, formatWithNumFmt, isDateFormat } from '../numFmt';

const fmt = (value: unknown, numFmt?: string) => formatWithNumFmt(value, numFmt)?.text;

describe('formatWithNumFmt', () => {
  test.each([
    [1234.5, '#,##0.00', '1,234.50'],
    [1234.567, '0.0', '1234.6'],
    [0.5, '0%', '50%'],
    [0.12345, '0.00%', '12.35%'],
    [1234.5, '"$"#,##0.00', '$1,234.50'],
    [-1234.5, '"$"#,##0.00', '-$1,234.50'],
    [-1234.5, '"$"#,##0.00_);\\("$"#,##0.00\\)', '($1,234.50)'],
    [1234.5, '[$€-407]#,##0.00', '€1,234.50'],
    [0, '#,##0;-#,##0;"-"', '-'],
    [1500000, '#,##0,,"M"', '2M'],
    [12345, '0.00E+00', '1.23E+04'],
    [5551234, '000-0000', '555-1234'],
    [7, '000', '007'],
    [1.005, '0.00', '1.01'],
    [3.1, '#.##', '3.1'],
  ])('%p with %p → %p', (value, numFmt, expected) => {
    expect(fmt(value, numFmt)).toBe(expected);
  });

  test('negative sections report their color', () => {
    expect(formatWithNumFmt(-5, '0;[Red]0')).toEqual({ text: '5', color: '#FF0000' });
    expect(formatWithNumFmt(5, '0;[Red]0')).toEqual({ text: '5' });
  });

  test('conditions pick the section', () => {
    expect(fmt(150, '[>=100]"big";"small"')).toBe('big');
    expect(fmt(5, '[>=100]"big";"small"')).toBe('small');
  });

  test('dates and times from Date values and serials (UTC calendar)', () => {
    const d = new Date(Date.UTC(2024, 0, 15, 14, 5, 9));
    expect(fmt(d, 'yyyy-mm-dd')).toBe('2024-01-15');
    expect(fmt(d, 'd-mmm-yy')).toBe('15-Jan-24');
    expect(fmt(d, 'dddd, mmmm d, yyyy')).toBe('Monday, January 15, 2024');
    expect(fmt(d, 'h:mm AM/PM')).toBe('2:05 PM');
    expect(fmt(d, 'hh:mm:ss')).toBe('14:05:09');
    expect(fmt(45306, 'm/d/yyyy')).toBe('1/15/2024');
    expect(fmt(1.5, '[h]:mm')).toBe('36:00');
  });

  test('text sections and General', () => {
    expect(fmt('abc', '0;0;0;"<"@">"')).toBe('<abc>');
    expect(fmt('abc', '0.00')).toBeUndefined();
    expect(fmt(0.1 + 0.2, undefined)).toBe('0.3');
    expect(fmt(true, 'General')).toBe('TRUE');
    expect(formatGeneral(123456789012)).toBe('1.23457E+11');
  });

  test('isDateFormat', () => {
    expect(isDateFormat('yyyy-mm-dd')).toBe(true);
    expect(isDateFormat('h:mm')).toBe(true);
    expect(isDateFormat('#,##0.00')).toBe(false);
    expect(isDateFormat('"d"0')).toBe(false);
  });
});
