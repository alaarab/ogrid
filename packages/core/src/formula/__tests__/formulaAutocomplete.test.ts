import { applyFormulaCompletion, getFormulaCaretContext, getFormulaCompletions } from '../formulaAutocomplete';
import { listFunctions } from '../functionMetadata';

/** Context at the '|' marker. */
function at(marked: string) {
  const caret = marked.indexOf('|');
  return getFormulaCaretContext(marked.replace('|', ''), caret);
}

describe('getFormulaCaretContext', () => {
  it('has no context outside formulas', () => {
    expect(at('SU|M')).toEqual({ token: null, call: null, inString: false });
  });

  it('finds the identifier being typed after =, (, comma and operators', () => {
    expect(at('=SU|')?.token).toEqual({ prefix: 'SU', start: 1, end: 3 });
    expect(at('=IF(A1>1,VL|')?.token?.prefix).toBe('VL');
    expect(at('=1+co|')?.token?.prefix).toBe('co');
    expect(at('=(ro|')?.token?.prefix).toBe('ro');
    expect(at('=A1:IN|')?.token?.prefix).toBe('IN');
  });

  it('extends the token past the caret for replacement', () => {
    expect(at('=SU|MX+1')?.token).toEqual({ prefix: 'SU', start: 1, end: 5 });
  });

  it('has no token in strings, sheet names, after $ or !, or for numbers', () => {
    expect(at('="SU|"')?.token).toBeNull();
    expect(at("='My Sh|eet'!A1")?.token).toBeNull();
    expect(at('=$A|')?.token).toBeNull();
    expect(at('=Sheet2!A|')?.token).toBeNull();
    expect(at('=12|')?.token).toBeNull();
    expect(at('=SUM(A1)x|')?.token).toBeNull();
    expect(at('=|')?.token).toBeNull();
  });

  it('reports the enclosing call and argument index', () => {
    expect(at('=SUM(|')?.call).toEqual({ name: 'SUM', argIndex: 0, openParen: 4 });
    expect(at('=sumifs(A:A, B:B, |')?.call).toMatchObject({ name: 'SUMIFS', argIndex: 2 });
  });

  it('tracks nesting: inner call while inside it, outer call after it closes', () => {
    expect(at('=IF(SUM(A1,B1|),1,2)')?.call).toMatchObject({ name: 'SUM', argIndex: 1 });
    expect(at('=IF(SUM(A1,B1),|1,2)')?.call).toMatchObject({ name: 'IF', argIndex: 1 });
    expect(at('=IF(SUM(A1,B1),1,2)|')?.call).toBeNull();
  });

  it('ignores commas in strings, array constants and grouping parens', () => {
    expect(at('=TEXTJOIN(", ", TRUE, |')?.call).toMatchObject({ name: 'TEXTJOIN', argIndex: 2 });
    expect(at('=TEXTJOIN("a"",b", |')?.call).toMatchObject({ argIndex: 1 });
    expect(at('=INDEX({1,2,3}, |')?.call).toMatchObject({ name: 'INDEX', argIndex: 1 });
    expect(at('=ROUND((1+2)*3, |')?.call).toMatchObject({ name: 'ROUND', argIndex: 1 });
    expect(at("=SUM('a,b'!A1, |")?.call).toMatchObject({ name: 'SUM', argIndex: 1 });
  });

  it('keeps the call while the caret is inside a string argument', () => {
    const ctx = at('=LEFT("ab|');
    expect(ctx.inString).toBe(true);
    expect(ctx.call).toMatchObject({ name: 'LEFT', argIndex: 0 });
  });

  it('handles dotted function names', () => {
    expect(at('=STDEV.S(1,|')?.call).toMatchObject({ name: 'STDEV.S', argIndex: 1 });
    expect(at('=STDEV.|')?.token?.prefix).toBe('STDEV.');
  });
});

describe('getFormulaCompletions', () => {
  const fns = listFunctions();

  it('puts prefix matches before contains matches', () => {
    const names = getFormulaCompletions('if', fns).map((c) => c.name);
    expect(names.slice(0, 4)).toEqual(['IF', 'IFERROR', 'IFNA', 'IFS']);
    expect(names.slice(4, 7)).toEqual(['AVERAGEIF', 'AVERAGEIFS', 'COUNTIF']);
    expect(names).toContain('SUMIFS');
  });

  it('includes named ranges', () => {
    const items = getFormulaCompletions('ta', fns, { TaxRate: 'B1' });
    expect(items.find((c) => c.name === 'TaxRate')).toEqual({ kind: 'name', name: 'TaxRate', description: 'B1' });
  });

  it('only prefix-matches tokens shaped like cell references', () => {
    expect(getFormulaCompletions('G1', fns)).toEqual([]);
    expect(getFormulaCompletions('LOG1', fns).map((c) => c.name)).toEqual(['LOG10']);
  });

  it('returns nothing for an empty prefix and honors the limit', () => {
    expect(getFormulaCompletions('', fns)).toEqual([]);
    expect(getFormulaCompletions('e', fns, undefined, 3)).toHaveLength(3);
  });
});

describe('applyFormulaCompletion', () => {
  it('inserts NAME( for functions', () => {
    expect(applyFormulaCompletion('=su', { start: 1, end: 3 }, { kind: 'function', name: 'SUM' })).toEqual({ text: '=SUM(', caret: 5 });
  });

  it('reuses an existing paren', () => {
    expect(applyFormulaCompletion('=su(A1)', { start: 1, end: 3 }, { kind: 'function', name: 'SUMSQ' })).toEqual({
      text: '=SUMSQ(A1)',
      caret: 7,
    });
  });

  it('inserts named ranges without a paren', () => {
    expect(applyFormulaCompletion('=1+ta', { start: 3, end: 5 }, { kind: 'name', name: 'TaxRate' })).toEqual({
      text: '=1+TaxRate',
      caret: 10,
    });
  });
});
