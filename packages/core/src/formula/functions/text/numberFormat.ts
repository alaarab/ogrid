import { FormulaError } from '../../types';
import { toDate } from '../date/shared';

/** Supported Excel formats: number placeholders, currency/literals, sections and date/time tokens. */
export function formatNumber(value: number, format: string): string | FormulaError {
  if (format.length > 255) return new FormulaError('#VALUE!', 'TEXT format too long');
  const sections = [''];
  let quoted = false;
  for (let i = 0; i < format.length; i++) {
    const char = format[i] ?? '';
    if (char === '\\' && i + 1 < format.length) {
      sections[sections.length - 1] += char + format[++i];
      continue;
    }
    if (char === '"') quoted = !quoted;
    if (char === ';' && !quoted) sections.push('');
    else sections[sections.length - 1] += char;
  }
  const section = sections[value < 0 && sections.length > 1 ? 1 : value === 0 && sections.length > 2 ? 2 : 0] ?? '';
  const tokens = section.match(/"[^"]*"|\\.|AM\/PM|[ymdhs]+|./gi) ?? [];
  const unquoted = tokens.map(token => token.startsWith('"') || token.startsWith('\\') ? ' '.repeat(token.length) : token).join('');
  const literal = (token: string) => token.startsWith('"') ? token.slice(1, -1) : token.startsWith('\\') ? token.slice(1) : token;
  if (/[ydhs]|am\/pm/i.test(unquoted) || /^m+$/i.test(unquoted.trim())) {
    const date = toDate(value);
    if (date instanceof FormulaError) return date;
    const pad = (num: number, width: number) => String(num).padStart(width, '0');
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const ampm = /am\/pm/i.test(unquoted);
    return tokens.map((token, index) => {
      if (token.startsWith('"') || token.startsWith('\\')) return literal(token);
      const lower = token.toLowerCase();
      if (/^y+$/.test(lower)) return token.length === 2 ? pad(date.getUTCFullYear() % 100, 2) : pad(date.getUTCFullYear(), 4);
      if (/^d+$/.test(lower)) {
        const day = Math.floor(value) === 60 ? 29 : date.getUTCDate();
        if (token.length <= 2) return token.length === 2 ? pad(day, 2) : String(day);
        const name = days[date.getUTCDay()] ?? '';
        return token.length === 3 ? name.slice(0, 3) : name;
      }
      if (/^m+$/.test(lower)) {
        const before = tokens.slice(0, index).reverse().find(part => /^[ymdhs]+$/i.test(part));
        const after = tokens.slice(index + 1).find(part => /^[ymdhs]+$/i.test(part));
        const minute = /^h+$/i.test(before ?? '') || /^s+$/i.test(after ?? '');
        const num = minute ? date.getUTCMinutes() : date.getUTCMonth() + 1;
        if (minute || token.length <= 2) return token.length === 2 ? pad(num, 2) : String(num);
        const name = months[num - 1] ?? '';
        return token.length === 3 ? name.slice(0, 3) : token.length === 5 ? name.slice(0, 1) : name;
      }
      if (/^h+$/.test(lower)) {
        const hour = ampm ? date.getUTCHours() % 12 || 12 : date.getUTCHours();
        return token.length === 2 ? pad(hour, 2) : String(hour);
      }
      if (/^s+$/.test(lower)) return token.length === 2 ? pad(date.getUTCSeconds(), 2) : String(date.getUTCSeconds());
      if (lower === 'am/pm') return date.getUTCHours() >= 12 ? 'PM' : 'AM';
      return token;
    }).join('');
  }
  const pattern = /[0#?][0#?,]*(?:\.[0#?]+)?/.exec(unquoted);
  if (!pattern) return tokens.map(literal).join('');
  if (/[[\]@Ee]/.test(unquoted)) return new FormulaError('#VALUE!', 'Unsupported TEXT format');
  const decimals = pattern[0].split('.')[1] ?? '';
  if (decimals.length > 100) return new FormulaError('#VALUE!', 'Too many decimal places');
  const percent = unquoted.includes('%');
  const magnitude = value < 0 && sections.length > 1 ? Math.abs(value) : value;
  const scaled = percent ? magnitude * 100 : magnitude;
  if (!Number.isFinite(scaled)) return new FormulaError('#NUM!', 'TEXT value overflow');
  const integerDigits = (pattern[0].split('.')[0] ?? '').replace(/[^0]/g, '').length;
  if (integerDigits > 21) return new FormulaError('#VALUE!', 'Too many integer placeholders');
  const result = scaled.toLocaleString('en-US', {
    minimumIntegerDigits: Math.max(1, integerDigits),
    minimumFractionDigits: decimals.replace(/[^0]/g, '').length,
    maximumFractionDigits: decimals.length,
    useGrouping: pattern[0].includes(','),
  });
  const decode = (text: string) => (text.match(/"[^"]*"|\\.|./g) ?? []).map(literal).join('');
  return decode(section.slice(0, pattern.index)) + result + decode(section.slice(pattern.index + pattern[0].length));
}
