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

/**
 * The inverse of normalizeFormula for export: drop the leading "=" and give
 * post-2007 functions their `_xlfn.` file-format prefix. String literals and
 * quoted sheet names are left untouched.
 */
export function toFileFormula(formula: string): string {
  const body = formula.startsWith('=') ? formula.slice(1) : formula;
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
  const normalized = formula.replace(
    /"(?:[^"]|"")*"|'(?:[^']|'')*'|(?:_xlfn\.|_xlws\.)+(?=[A-Za-z_][A-Za-z0-9_.]*\s*\()/gi,
    (match) => match.startsWith('"') || match.startsWith("'") ? match : '',
  );
  return normalized.startsWith('=') ? normalized : `=${normalized}`;
}
