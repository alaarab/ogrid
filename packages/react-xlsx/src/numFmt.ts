// Excel number-format (numFmt) display formatter. Pure module.
//
// Covers what real workbooks use day to day: General, fixed decimals,
// thousands separators, scaling commas, percent, currency literals and
// [$€-407] locale currency tags, scientific notation, up to four sections
// (positive;negative;zero;text) with [Red]-style colors and [>=100]
// conditions, text placeholders (@), _x spacing, *x fill, and date/time
// tokens including elapsed [h]:mm:ss and fractional seconds.
// Not covered: fractions (# ?/?) render as decimals, locale-specific
// separators (output is always en-US: "," groups, "." decimals), and the
// system long-date/long-time formats ([$-F800], [$-F400]).

export interface FormattedValue {
  text: string;
  /** CSS color from a [Red]/[Color10] section tag, when present. */
  color?: string;
}

const DAY_MS = 86_400_000;
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const NAMED_COLORS: Record<string, string> = {
  black: '#000000', blue: '#0000FF', cyan: '#00FFFF', green: '#00FF00',
  magenta: '#FF00FF', red: '#FF0000', white: '#FFFFFF', yellow: '#FFFF00',
};

/** True for formats that render a date or time. */
export function isDateFormat(numFmt: string | undefined): boolean {
  if (!numFmt) return false;
  const section = splitSections(numFmt)[0] ?? '';
  return tokenize(section).some((t) => t.kind === 'date' || t.kind === 'elapsed' || t.kind === 'ampm');
}

/** Date → Excel serial day number (UTC calendar, 1900 date system). */
export function dateToSerial(date: Date): number {
  const serial = (date.getTime() - EXCEL_EPOCH) / DAY_MS;
  // Excel's fictional 1900-02-29 sits at serial 60; earlier dates shift by one.
  return serial < 61 ? serial - 1 : serial;
}

function serialToDate(serial: number): Date {
  return new Date(EXCEL_EPOCH + Math.round((serial < 60 ? serial + 1 : serial) * DAY_MS));
}

/**
 * Format a cell value with an Excel numFmt. Returns null when the format
 * does not apply (e.g. text in a numeric-only format), so callers can fall
 * back to their default display.
 */
export function formatWithNumFmt(value: unknown, numFmt: string | undefined): FormattedValue | null {
  const fmt = numFmt && numFmt !== 'General' ? numFmt : 'General';
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return { text: value ? 'TRUE' : 'FALSE' };
  if (typeof value === 'string') {
    const sections = splitSections(fmt);
    const textSection = sections.length >= 4 ? sections[3] : sections.find((s) => s.includes('@'));
    if (textSection === undefined) return null;
    return renderText(value, textSection);
  }
  let num: number;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    num = dateToSerial(value);
  } else if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    num = value;
  } else {
    return null;
  }
  if (fmt === 'General') {
    return value instanceof Date ? { text: formatDateTokens(num, tokenize('yyyy-mm-dd')) } : { text: formatGeneral(num) };
  }
  const { section, negativeHandled } = pickSection(splitSections(fmt), num);
  const tokens = tokenize(section.body);
  const color = section.color;
  const isDate = tokens.some((t) => t.kind === 'date' || t.kind === 'elapsed' || t.kind === 'ampm');
  let text: string;
  if (isDate) {
    text = num < 0 ? '#'.repeat(10) : formatDateTokens(num, tokens);
  } else if (tokens.some((t) => t.kind === 'digit')) {
    text = formatNumberTokens(negativeHandled ? Math.abs(num) : num, tokens);
  } else if (tokens.some((t) => t.kind === 'general')) {
    text = tokens.map((t) => t.kind === 'general' ? formatGeneral(negativeHandled ? Math.abs(num) : num) : literalOf(t)).join('');
  } else {
    // Literal-only section (e.g. "-" for zero in accounting formats).
    text = tokens.map(literalOf).join('');
  }
  return color ? { text, color } : { text };
}

/** Excel's General display: up to 11 significant digits, scientific for very large/small. */
export function formatGeneral(num: number): string {
  if (num === 0) return '0';
  const abs = Math.abs(num);
  if (abs >= 1e11 || abs < 1e-9) {
    const [mantissa = '', exp = '0'] = num.toExponential(5).split('e');
    const m = mantissa.replace(/\.?0+$/, '');
    const e = Number(exp);
    return `${m}E${e < 0 ? '-' : '+'}${String(Math.abs(e)).padStart(2, '0')}`;
  }
  const intDigits = Math.max(1, Math.floor(Math.log10(abs)) + 1);
  const decimals = Math.max(0, 10 - intDigits);
  return String(roundTo(num, decimals));
}

// ---- Sections ---------------------------------------------------------------

interface Section {
  body: string;
  color?: string;
  condition?: { op: string; value: number };
}

function splitSections(fmt: string): string[] {
  const out = [''];
  let quoted = false;
  let bracket = false;
  for (let i = 0; i < fmt.length; i++) {
    const ch = fmt[i] as string;
    if (!quoted && !bracket && (ch === '\\' || ch === '_' || ch === '*') && i + 1 < fmt.length) {
      out[out.length - 1] += ch + fmt[++i];
      continue;
    }
    if (ch === '"' && !bracket) quoted = !quoted;
    else if (ch === '[' && !quoted) bracket = true;
    else if (ch === ']' && !quoted) bracket = false;
    if (ch === ';' && !quoted && !bracket) out.push('');
    else out[out.length - 1] += ch;
  }
  return out;
}

function parseSection(raw: string): Section {
  const section: Section = { body: '' };
  section.body = raw.replace(/\[([^\]]*)\]/g, (match, inner: string) => {
    const lower = inner.toLowerCase();
    if (NAMED_COLORS[lower]) { section.color = NAMED_COLORS[lower]; return ''; }
    if (/^color\d+$/.test(lower)) { section.color = INDEXED_FORMAT_COLORS[Number(lower.slice(5)) - 1]; return ''; }
    const cond = /^(<=|>=|<>|<|>|=)\s*(-?\d+(?:\.\d+)?)$/.exec(inner);
    if (cond) { section.condition = { op: cond[1] as string, value: Number(cond[2]) }; return ''; }
    if (inner.startsWith('$')) {
      // [$€-407] → "€"; [$-409] → "" (locale only).
      const symbol = inner.slice(1).split('-')[0] ?? '';
      return symbol ? `"${symbol.replace(/"/g, '')}"` : '';
    }
    // Elapsed time and anything unknown stay for the tokenizer.
    return /^(h+|m+|s+)$/i.test(inner) ? match : '';
  });
  return section;
}

function testCondition(cond: NonNullable<Section['condition']>, n: number): boolean {
  switch (cond.op) {
    case '<': return n < cond.value;
    case '<=': return n <= cond.value;
    case '>': return n > cond.value;
    case '>=': return n >= cond.value;
    case '=': return n === cond.value;
    default: return n !== cond.value;
  }
}

function pickSection(rawSections: string[], num: number): { section: Section; negativeHandled: boolean } {
  const numeric = rawSections.slice(0, 3).map(parseSection);
  if (numeric.some((s) => s.condition)) {
    for (let i = 0; i < numeric.length; i++) {
      const s = numeric[i] as Section;
      if (!s.condition || testCondition(s.condition, num)) {
        // A conditional section shows the magnitude; the sign comes from literals.
        return { section: s, negativeHandled: i > 0 || !!s.condition };
      }
    }
    return { section: numeric[numeric.length - 1] as Section, negativeHandled: false };
  }
  if (num < 0 && numeric.length >= 2) return { section: numeric[1] as Section, negativeHandled: true };
  if (num === 0 && numeric.length >= 3) return { section: numeric[2] as Section, negativeHandled: false };
  return { section: numeric[0] as Section, negativeHandled: false };
}

// ---- Tokens -----------------------------------------------------------------

type Token =
  | { kind: 'literal'; text: string }
  | { kind: 'digit'; ch: '0' | '#' | '?' }
  | { kind: 'point' }
  | { kind: 'comma' }
  | { kind: 'percent' }
  | { kind: 'exp'; sign: '+' | '-' }
  | { kind: 'date'; text: string }
  | { kind: 'elapsed'; unit: 'h' | 'm' | 's'; width: number }
  | { kind: 'ampm'; text: string }
  | { kind: 'fraction'; width: number }
  | { kind: 'text' }
  | { kind: 'general' };

function tokenize(section: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < section.length) {
    const ch = section[i] as string;
    const rest = section.slice(i);
    if (ch === '"') {
      const end = section.indexOf('"', i + 1);
      const stop = end < 0 ? section.length : end;
      tokens.push({ kind: 'literal', text: section.slice(i + 1, stop) });
      i = stop + 1;
      continue;
    }
    if (ch === '\\' || ch === '!') { tokens.push({ kind: 'literal', text: section[i + 1] ?? '' }); i += 2; continue; }
    if (ch === '_') { tokens.push({ kind: 'literal', text: ' ' }); i += 2; continue; }
    if (ch === '*') { i += 2; continue; }
    if (ch === '[') {
      const m = /^\[(h+|m+|s+)\]/i.exec(rest);
      if (m) {
        const unit = (m[1] as string)[0]?.toLowerCase() as 'h' | 'm' | 's';
        tokens.push({ kind: 'elapsed', unit, width: (m[1] as string).length });
        i += m[0].length;
        continue;
      }
      const end = section.indexOf(']', i);
      i = end < 0 ? section.length : end + 1;
      continue;
    }
    if (/^general/i.test(rest)) { tokens.push({ kind: 'general' }); i += 7; continue; }
    if (/^am\/pm/i.test(rest)) { tokens.push({ kind: 'ampm', text: rest.slice(0, 5) }); i += 5; continue; }
    if (/^a\/p/i.test(rest)) { tokens.push({ kind: 'ampm', text: rest.slice(0, 3) }); i += 3; continue; }
    if (/^e[+-]/i.test(rest) && tokens.some((t) => t.kind === 'digit')) {
      tokens.push({ kind: 'exp', sign: rest[1] as '+' | '-' });
      i += 2;
      continue;
    }
    const dateRun = /^([yYmMdDhHsS])\1*/.exec(rest);
    if (dateRun) { tokens.push({ kind: 'date', text: dateRun[0] }); i += dateRun[0].length; continue; }
    if (ch === '0' || ch === '#' || ch === '?') { tokens.push({ kind: 'digit', ch }); i++; continue; }
    if (ch === '.') {
      // ".0" after seconds is fractional seconds.
      const prev = [...tokens].reverse().find((t) => t.kind !== 'literal');
      const frac = /^\.(0+)/.exec(rest);
      if (frac && prev && (prev.kind === 'date' && /^s/i.test(prev.text) || prev.kind === 'elapsed' && prev.unit === 's')) {
        tokens.push({ kind: 'fraction', width: (frac[1] as string).length });
        i += frac[0].length;
        continue;
      }
      tokens.push({ kind: 'point' });
      i++;
      continue;
    }
    if (ch === ',') { tokens.push({ kind: 'comma' }); i++; continue; }
    if (ch === '%') { tokens.push({ kind: 'percent' }); i++; continue; }
    if (ch === '@') { tokens.push({ kind: 'text' }); i++; continue; }
    tokens.push({ kind: 'literal', text: ch });
    i++;
  }
  return tokens;
}

function literalOf(t: Token): string {
  if (t.kind === 'literal') return t.text;
  if (t.kind === 'percent') return '%';
  if (t.kind === 'comma') return ',';
  if (t.kind === 'point') return '.';
  return '';
}

function renderText(value: string, section: string): FormattedValue {
  const parsed = parseSection(section);
  const text = tokenize(parsed.body).map((t) => t.kind === 'text' ? value : literalOf(t)).join('');
  return parsed.color ? { text, color: parsed.color } : { text };
}

// ---- Numbers ----------------------------------------------------------------

function roundTo(n: number, decimals: number): number {
  if (decimals > 15) return n;
  const r = Number(`${Math.round(Number(`${Math.abs(n)}e${decimals}`))}e-${decimals}`);
  return Number.isFinite(r) ? Math.sign(n) * r : n;
}

function formatNumberTokens(num: number, tokens: Token[]): string {
  const firstDigit = tokens.findIndex((t) => t.kind === 'digit');
  let lastDigit = -1;
  for (let i = tokens.length - 1; i >= 0; i--) if (tokens[i]?.kind === 'digit') { lastDigit = i; break; }
  const pointIdx = tokens.findIndex((t, i) => t.kind === 'point' && i > firstDigit && i <= lastDigit + 1);
  const expIdx = tokens.findIndex((t) => t.kind === 'exp');
  const intEnd = pointIdx >= 0 ? pointIdx : expIdx >= 0 ? expIdx : lastDigit + 1;

  // Scaling commas directly after the last integer/decimal placeholder divide by 1000 each.
  let scale = 0;
  let scaleEnd = lastDigit + 1;
  while (tokens[scaleEnd]?.kind === 'comma') { scale++; scaleEnd++; }
  const grouping = tokens.slice(firstDigit, intEnd).some((t) => t.kind === 'comma');
  const percents = tokens.filter((t) => t.kind === 'percent').length;

  const fracDigits = pointIdx >= 0
    ? tokens.slice(pointIdx + 1, expIdx >= 0 ? expIdx : lastDigit + 1).filter((t) => t.kind === 'digit') as Array<{ kind: 'digit'; ch: string }>
    : [];
  const intDigits = tokens.slice(firstDigit, intEnd).filter((t) => t.kind === 'digit') as Array<{ kind: 'digit'; ch: string }>;

  let value = num * 100 ** percents / 1000 ** scale;
  const negative = value < 0;
  value = Math.abs(value);

  let expText = '';
  if (expIdx >= 0) {
    const expToken = tokens[expIdx] as { kind: 'exp'; sign: '+' | '-' };
    const expDigits = tokens.slice(expIdx + 1).filter((t) => t.kind === 'digit').length;
    const intCount = Math.max(1, intDigits.length);
    let exponent = value === 0 ? 0 : Math.floor(Math.log10(value));
    // Engineering-style formats (##0.0E+0) step the exponent by the integer width.
    if (intCount > 1 && intDigits.some((d) => d.ch === '#')) exponent = Math.floor(exponent / intCount) * intCount;
    value = value / 10 ** exponent;
    if (roundTo(value, fracDigits.length) >= 10 ** Math.max(1, intDigits.length) && !(intCount > 1)) {
      value /= 10;
      exponent += 1;
    }
    const sign = exponent < 0 ? '-' : expToken.sign === '+' ? '+' : '';
    expText = `E${sign}${String(Math.abs(exponent)).padStart(Math.max(1, expDigits), '0')}`;
  }

  const rounded = roundTo(value, fracDigits.length);
  const fixed = rounded.toFixed(fracDigits.length);
  let [intStr = '0', fracStr = ''] = fixed.split('.');
  // Optional decimals (#, ?) drop trailing zeros; ? keeps their width as spaces.
  let fracOut = '';
  for (let i = 0; i < fracDigits.length; i++) {
    const d = fracStr[i] ?? '0';
    fracOut += d;
  }
  let trim = fracOut.length;
  while (trim > 0 && fracOut[trim - 1] === '0' && fracDigits[trim - 1]?.ch !== '0') trim--;
  const trailing = fracDigits.slice(trim).map((d) => d.ch === '?' ? ' ' : '').join('');
  fracOut = fracOut.slice(0, trim) + trailing;
  fracStr = fracOut;

  // Integer part: drop a lone "0" when there is no mandatory integer digit (#.##).
  if (intStr === '0' && !intDigits.some((d) => d.ch === '0')) intStr = '';
  const minInt = intDigits.filter((d) => d.ch === '0').length;
  const hasInnerLiterals = tokens.slice(firstDigit, intEnd).some((t) => t.kind === 'literal');

  let intOut: string;
  if (hasInnerLiterals && !grouping) {
    // Fill placeholders right to left, keeping literals in place (phone/ID formats).
    const parts: string[] = [];
    let digits = intStr;
    const slice = tokens.slice(firstDigit, intEnd);
    for (let i = slice.length - 1; i >= 0; i--) {
      const t = slice[i] as Token;
      if (t.kind === 'digit') {
        const isFirst = slice.findIndex((x) => x.kind === 'digit') === i;
        if (isFirst) { parts.unshift(digits || (t.ch === '0' ? '0' : t.ch === '?' ? ' ' : '')); digits = ''; }
        else if (digits) { parts.unshift(digits.slice(-1)); digits = digits.slice(0, -1); }
        else parts.unshift(t.ch === '0' ? '0' : t.ch === '?' ? ' ' : '');
      } else {
        parts.unshift(literalOf(t));
      }
    }
    intOut = parts.join('');
  } else {
    intOut = intStr.padStart(minInt, '0');
    if (grouping) intOut = intOut.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  const numberText = intOut + (pointIdx >= 0 ? `.${fracStr}` : '') + expText;
  const prefix = tokens.slice(0, firstDigit).map(literalOf).join('');
  const suffixStart = Math.max(scaleEnd, expIdx >= 0 ? tokens.length : lastDigit + 1);
  const suffix = tokens.slice(suffixStart).map((t) => t.kind === 'comma' ? '' : literalOf(t)).join('');
  // Literals between the point and the decimals are rare; ignore them.
  return `${negative ? '-' : ''}${prefix}${numberText}${suffix}`;
}

// ---- Dates ------------------------------------------------------------------

function formatDateTokens(serial: number, tokens: Token[]): string {
  const hasAmPm = tokens.some((t) => t.kind === 'ampm');
  const fracWidth = Math.max(0, ...tokens.map((t) => t.kind === 'fraction' ? t.width : 0));
  // Round to the displayed precision so 23:59:59.6 shows as the next second.
  const steps = 86400 * 10 ** fracWidth;
  const roundedSerial = Math.round(serial * steps) / steps;
  const date = serialToDate(Math.floor(roundedSerial));
  const timeSeconds = Math.round((roundedSerial - Math.floor(roundedSerial)) * 86400 * 10 ** fracWidth) / 10 ** fracWidth;
  const hours = Math.floor(timeSeconds / 3600);
  const minutes = Math.floor((timeSeconds % 3600) / 60);
  const seconds = Math.floor(timeSeconds % 60);
  const fraction = timeSeconds - Math.floor(timeSeconds);
  const pad = (n: number, w: number) => String(n).padStart(w, '0');
  const isLeapDay = Math.floor(serial) === 60;

  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i] as Token;
    if (t.kind === 'date') {
      const lower = t.text.toLowerCase();
      const c = lower[0];
      if (c === 'y') out.push(lower.length <= 2 ? pad(date.getUTCFullYear() % 100, 2) : pad(date.getUTCFullYear(), 4));
      else if (c === 'd') {
        const day = isLeapDay ? 29 : date.getUTCDate();
        if (lower.length === 1) out.push(String(day));
        else if (lower.length === 2) out.push(pad(day, 2));
        else {
          const name = DAYS[date.getUTCDay()] ?? '';
          out.push(lower.length === 3 ? name.slice(0, 3) : name);
        }
      } else if (c === 'h') {
        const h = hasAmPm ? (hours % 12 || 12) : hours;
        out.push(lower.length >= 2 ? pad(h, 2) : String(h));
      } else if (c === 's') {
        out.push(lower.length >= 2 ? pad(seconds, 2) : String(seconds));
      } else if (c === 'm') {
        if (isMinuteToken(tokens, i)) out.push(lower.length >= 2 ? pad(minutes, 2) : String(minutes));
        else {
          const month = isLeapDay ? 2 : date.getUTCMonth() + 1;
          const name = MONTHS[month - 1] ?? '';
          if (lower.length === 1) out.push(String(month));
          else if (lower.length === 2) out.push(pad(month, 2));
          else if (lower.length === 3) out.push(name.slice(0, 3));
          else if (lower.length === 5) out.push(name.slice(0, 1));
          else out.push(name);
        }
      }
    } else if (t.kind === 'elapsed') {
      const totalSeconds = Math.round(roundedSerial * 86400);
      const v = t.unit === 'h' ? Math.floor(totalSeconds / 3600) : t.unit === 'm' ? Math.floor(totalSeconds / 60) : totalSeconds;
      out.push(pad(v, t.width));
    } else if (t.kind === 'ampm') {
      const pm = hours >= 12;
      if (t.text.length === 5) out.push(pm ? 'PM' : 'AM');
      else out.push(pm ? (t.text[2] === 'p' ? 'p' : 'P') : (t.text[0] === 'a' ? 'a' : 'A'));
    } else if (t.kind === 'fraction') {
      out.push(`.${fraction.toFixed(t.width).slice(2)}`);
    } else if (t.kind === 'digit') {
      out.push(t.ch === '0' ? '0' : '');
    } else {
      out.push(literalOf(t));
    }
  }
  return out.join('');
}

/** "m" means minutes right after an hour token or right before a seconds token. */
function isMinuteToken(tokens: Token[], index: number): boolean {
  for (let i = index - 1; i >= 0; i--) {
    const t = tokens[i] as Token;
    if (t.kind === 'date') return /^h/i.test(t.text);
    if (t.kind === 'elapsed') return t.unit === 'h';
  }
  for (let i = index + 1; i < tokens.length; i++) {
    const t = tokens[i] as Token;
    if (t.kind === 'date') return /^s/i.test(t.text);
    if (t.kind === 'elapsed') return t.unit === 's';
  }
  return false;
}

/** [Color1]…[Color56] use the legacy 56-color palette. */
const INDEXED_FORMAT_COLORS = [
  '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
  '#800000', '#008000', '#000080', '#808000', '#800080', '#008080', '#C0C0C0', '#808080',
  '#9999FF', '#993366', '#FFFFCC', '#CCFFFF', '#660066', '#FF8080', '#0066CC', '#CCCCFF',
  '#000080', '#FF00FF', '#FFFF00', '#00FFFF', '#800080', '#800000', '#008080', '#0000FF',
  '#00CCFF', '#CCFFFF', '#CCFFCC', '#FFFF99', '#99CCFF', '#FF99CC', '#CC99FF', '#FFCC99',
  '#3366FF', '#33CCCC', '#99CC00', '#FFCC00', '#FF9900', '#FF6600', '#666699', '#969696',
  '#003366', '#339966', '#003300', '#333300', '#993300', '#993366', '#333399', '#333333',
];
export { INDEXED_FORMAT_COLORS as LEGACY_PALETTE };
