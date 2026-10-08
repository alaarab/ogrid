import { tokenize } from '@alaarab/ogrid-core/formula';

/** Header insertion/removal moves absolute rows too. Qualified references
 * stay in worksheet coordinates, matching the workbook sheet accessors.
 * Like deleting a row in Excel, a range starting on a removed row shrinks
 * and a single reference to it becomes #REF!; `onRemovedRow` reports either. */
export function rebaseFormulaRows(formula: string, rowDelta: number, onRemovedRow?: () => void): string {
  const offset = formula.startsWith('=') ? 1 : 0;
  try {
    const tokens = tokenize(formula.slice(offset));
    const replacements: Array<{ start: number; length: number; value: string }> = [];
    let qualified = false;
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (!token) continue;
      if (token.type === 'SHEET_REF') { qualified = true; continue; }
      if (token.type === 'COLON') continue;
      if (token.type !== 'CELL_REF') { qualified = false; continue; }
      if (!qualified) {
        const parts = /^(\$?[A-Za-z]+\$?)(\d+)$/.exec(token.value);
        if (parts) {
          let row = Number(parts[2]) + rowDelta;
          if (row < 1) {
            onRemovedRow?.();
            const end = tokens[i + 1]?.type === 'COLON' ? tokens[i + 2] : undefined;
            const endRow = end?.type === 'CELL_REF' ? Number(/\d+$/.exec(end.value)?.[0]) + rowDelta : 0;
            if (endRow >= 1) row = 1;
          }
          replacements.push({
            start: token.position + offset,
            length: token.value.length,
            value: row < 1 ? '#REF!' : `${parts[1]}${row}`,
          });
        }
      }
      if (tokens[i + 1]?.type !== 'COLON') qualified = false;
    }
    let result = formula;
    for (const { start, length, value } of replacements.reverse()) {
      result = result.slice(0, start) + value + result.slice(start + length);
    }
    return result;
  } catch {
    // Preserve unsupported Excel syntax for export and cached-value fallback.
    return formula;
  }
}

/** Functions added after Excel 2007. The file format stores them with an
 * `_xlfn.` prefix; without it Excel shows #NAME? until the cell is re-entered. */
const FUTURE_FUNCTIONS = new Set([
  'ACOT', 'ACOTH', 'AGGREGATE', 'ARABIC', 'ARRAYTOTEXT', 'BASE', 'BETA.DIST', 'BETA.INV', 'BINOM.DIST',
  'BINOM.DIST.RANGE', 'BINOM.INV', 'BITAND', 'BITLSHIFT', 'BITOR', 'BITRSHIFT', 'BITXOR', 'BYCOL', 'BYROW',
  'CEILING.MATH', 'CEILING.PRECISE', 'CHISQ.DIST', 'CHISQ.DIST.RT', 'CHISQ.INV', 'CHISQ.INV.RT', 'CHISQ.TEST',
  'CHOOSECOLS', 'CHOOSEROWS', 'COMBINA', 'CONCAT', 'CONFIDENCE.NORM', 'CONFIDENCE.T', 'COT', 'COTH',
  'COVARIANCE.P', 'COVARIANCE.S', 'CSC', 'CSCH', 'DAYS', 'DECIMAL', 'DROP', 'ERF.PRECISE', 'ERFC.PRECISE',
  'EXPAND', 'EXPON.DIST', 'F.DIST', 'F.DIST.RT', 'F.INV', 'F.INV.RT', 'F.TEST', 'FLOOR.MATH', 'FLOOR.PRECISE',
  'FORECAST.LINEAR', 'FORMULATEXT', 'GAMMA', 'GAMMA.DIST', 'GAMMA.INV', 'GAMMALN.PRECISE', 'GAUSS', 'HSTACK',
  'IFNA', 'IFS', 'IMCOSH', 'IMCOT', 'IMCSC', 'IMCSCH', 'IMSEC', 'IMSECH', 'IMSINH', 'IMTAN', 'ISFORMULA',
  'ISOMITTED', 'ISOWEEKNUM', 'LAMBDA', 'LET', 'LOGNORM.DIST', 'LOGNORM.INV', 'MAKEARRAY', 'MAP', 'MAXIFS',
  'MINIFS', 'MODE.MULT', 'MODE.SNGL', 'MUNIT', 'NEGBINOM.DIST', 'NORM.DIST', 'NORM.INV', 'NORM.S.DIST',
  'NORM.S.INV', 'NUMBERVALUE', 'PDURATION', 'PERCENTILE.EXC', 'PERCENTILE.INC', 'PERCENTRANK.EXC',
  'PERCENTRANK.INC', 'PERMUTATIONA', 'PHI', 'POISSON.DIST', 'QUARTILE.EXC', 'QUARTILE.INC', 'RANDARRAY',
  'RANK.AVG', 'RANK.EQ', 'REDUCE', 'RRI', 'SCAN', 'SEC', 'SECH', 'SEQUENCE', 'SHEET', 'SHEETS', 'SKEW.P',
  'SORTBY', 'STDEV.P', 'STDEV.S', 'SWITCH', 'T.DIST', 'T.DIST.2T', 'T.DIST.RT', 'T.INV', 'T.INV.2T', 'T.TEST',
  'TAKE', 'TEXTAFTER', 'TEXTBEFORE', 'TEXTJOIN', 'TEXTSPLIT', 'TOCOL', 'TOROW', 'UNICHAR', 'UNICODE', 'UNIQUE',
  'VALUETOTEXT', 'VAR.P', 'VAR.S', 'VSTACK', 'WEIBULL.DIST', 'WRAPCOLS', 'WRAPROWS', 'XLOOKUP', 'XMATCH', 'XOR',
  'Z.TEST',
]);
/** Dynamic-array functions that also carry the `_xlws.` namespace. */
const WORKSHEET_FUNCTIONS = new Set(['FILTER', 'SORT']);

/** End of a quoted token, respecting Excel's doubled quote escaping. */
function quoteEnd(text: string, start: number): number {
  const quote = text[start];
  for (let i = start + 1; i < text.length; i++) {
    if (text[i] !== quote) continue;
    if (text[i + 1] === quote) { i++; continue; }
    return i + 1;
  }
  return text.length;
}

function balancedEnd(text: string, start: number): number {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '"' || text[i] === "'") { i = quoteEnd(text, i) - 1; continue; }
    if (text[i] === '(') depth++;
    if (text[i] === ')' && --depth === 0) return i + 1;
  }
  return text.length;
}

/** @ binds a complete unary operand (references, functions or parentheses). */
function operandEnd(text: string, start: number): number {
  let i = start;
  while (/\s/.test(text[i] ?? '') && i < text.length) i++;
  if (['@', '+', '-'].includes(text[i] ?? '')) return operandEnd(text, i + 1);
  if (text[i] === '(') i = balancedEnd(text, i);
  else if (text[i] === '"') i = quoteEnd(text, i);
  else if (/^(?:\d|\.\d)/.test(text.slice(i))) {
    i += /^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i.exec(text.slice(i))?.[0].length ?? 0;
  } else if (text[i] === '#') {
    i += /^#(?:REF!|DIV\/0!|VALUE!|NAME\?|N\/A|NUM!|NULL!|SPILL!|CALC!)/i.exec(text.slice(i))?.[0].length ?? 0;
  }
  else {
    if (text[i] === "'") i = quoteEnd(text, i);
    while (i < text.length && /[A-Za-z0-9_.$!:]/.test(text.charAt(i))) i++;
    let next = i;
    while (next < text.length && /\s/.test(text.charAt(next))) next++;
    if (text[next] === '(') i = balancedEnd(text, next);
    else if (text[i] === '#') i++;
  }
  while (text[i] === '%') i++;
  return i;
}

function serializeIntersections(text: string): string {
  const positions: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '"' || text[i] === "'") { i = quoteEnd(text, i) - 1; continue; }
    if (text[i] === '@') positions.push(i);
  }
  for (const start of positions.reverse()) {
    const end = operandEnd(text, start + 1);
    if (end > start + 1) text = `${text.slice(0, start)}_xlfn.SINGLE(${text.slice(start + 1, end)})${text.slice(end)}`;
  }
  return text;
}

function normalizeIntersections(text: string): string {
  let result = '';
  for (let i = 0; i < text.length;) {
    if (text[i] === '"' || text[i] === "'") {
      const end = quoteEnd(text, i);
      result += text.slice(i, end); i = end; continue;
    }
    const single = (i === 0 || !/[A-Za-z0-9_.]/.test(text.charAt(i - 1))) && /^(?:_xlfn\.)?SINGLE\s*\(/i.exec(text.slice(i));
    if (single) {
      const open = i + single[0].length - 1, end = balancedEnd(text, open);
      const operand = normalizeIntersections(text.slice(open + 1, end - 1));
      result += `@${operandEnd(operand, 0) === operand.length ? operand : `(${operand})`}`;
      i = end;
    } else { result += text[i]; i++; }
  }
  return result;
}

/**
 * The inverse of normalizeFormula for export: drop the leading "=" and give
 * post-2007 functions their `_xlfn.` file-format prefix. String literals and
 * quoted sheet names are left untouched.
 */
export function toFileFormula(formula: string): string {
  const rawBody = formula.startsWith('=') ? formula.slice(1) : formula;
  // Excel serializes spill references as ANCHORARRAY, not a literal '#'.
  const intersected = serializeIntersections(rawBody);
  const body = intersected.replace(/"(?:[^"]|"")*"|((?:'(?:[^']|'')*'!|[A-Za-z_][A-Za-z0-9_]*!)?\$?[A-Za-z]{1,3}\$?\d+)#|'(?:[^']|'')*'/g,
    (match, ref: string | undefined) => ref ? `_xlfn.ANCHORARRAY(${ref})` : match);

  return body.replace(
    /"(?:[^"]|"")*"|'(?:[^']|'')*'|(?<![A-Za-z0-9_.])((?:_xlfn\.|_xlws\.)*)([A-Za-z][A-Za-z0-9_.]*)(?=\s*\()/g,
    (match, prefix: string | undefined, name: string | undefined) => {
      if (match.startsWith('"') || match.startsWith("'") || name === undefined || prefix) return match;
      const upper = name.toUpperCase();
      if (WORKSHEET_FUNCTIONS.has(upper)) return `_xlfn._xlws.${name}`;
      return FUTURE_FUNCTIONS.has(upper) ? `_xlfn.${name}` : match;
    },
  );
}

export function normalizeFormula(formula: string): string {
  const spillRefs = formula.replace(/"(?:[^"]|"")*"|(?:_xlfn\.)?ANCHORARRAY\(((?:'(?:[^']|'')*'!|[A-Za-z_][A-Za-z0-9_]*!)?\$?[A-Za-z]{1,3}\$?\d+)\)|'(?:[^']|'')*'/gi,
    (match, ref: string | undefined) => ref ? `${ref}#` : match);
  const intersections = normalizeIntersections(spillRefs);
  const normalized = intersections.replace(
    /"(?:[^"]|"")*"|'(?:[^']|'')*'|(?:_xlfn\.|_xlws\.)+(?=[A-Za-z_][A-Za-z0-9_.]*\s*\()/gi,
    (match) => match.startsWith('"') || match.startsWith("'") ? match : '',
  );
  return normalized.startsWith('=') ? normalized : `=${normalized}`;
}
