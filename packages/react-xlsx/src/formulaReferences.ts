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

export function normalizeFormula(formula: string): string {
  const normalized = formula.replace(
    /"(?:[^"]|"")*"|'(?:[^']|'')*'|(?:_xlfn\.|_xlws\.)+(?=[A-Za-z_][A-Za-z0-9_.]*\s*\()/gi,
    (match) => match.startsWith('"') || match.startsWith("'") ? match : '',
  );
  return normalized.startsWith('=') ? normalized : `=${normalized}`;
}
