/**
 * Regressions from the 2026-09 audit: range dependencies, resource limits,
 * error containment, cycle cascades, volatile functions and sheet-name keys.
 */
import { FormulaEngine } from '../formulaEngine';
import { FormulaError } from '../types';
import type { IGridDataAccessor } from '../types';
import { fromCellKey, toCellKey } from '../cellAddressUtils';

function createAccessor(
  data: Record<string, unknown>,
  rows = 100,
  cols = 26,
): IGridDataAccessor {
  return {
    getCellValue: (col: number, row: number) => data[`${col},${row}`] ?? null,
    getRowCount: () => rows,
    getColumnCount: () => cols,
  };
}

const isError = (v: unknown, type?: string) =>
  v instanceof FormulaError && (type === undefined || v.type === type);

describe('FormulaEngine audit regressions', () => {
  it('evaluates a range far past the data without hanging', () => {
    const engine = new FormulaEngine();
    const accessor = createAccessor({ '0,0': 2, '1,1': 3 }, 10, 5);
    const start = performance.now();
    engine.setFormula(4, 5, '=SUM(A1:ZZZZZ2)', accessor);
    expect(engine.getValue(4, 5)).toBe(5);
    // Generous bound: this used to hang (24M-cell expansion), not merely run slow.
    expect(performance.now() - start).toBeLessThan(5000);
  });

  it('keeps range dependencies as ranges (running totals stay correct)', () => {
    const n = 1000;
    const data: Record<string, unknown> = {};
    for (let r = 0; r < n; r++) data[`0,${r}`] = 1;
    const accessor = createAccessor(data, n, 3);
    const engine = new FormulaEngine();
    for (let r = 0; r < n; r++) engine.setFormula(1, r, `=SUM($A$1:A${r + 1})`, accessor);
    expect(engine.getValue(1, n - 1)).toBe(n);
    // One range entry per formula, not one dependency per cell in the range.
    const graph = (engine as unknown as { depGraph: import('../dependencyGraph').DependencyGraph }).depGraph;
    expect(graph.getDependencies(`1,${n - 1}`).size).toBe(0);
    expect(graph.getRangeDependencies(`1,${n - 1}`)).toEqual([
      { sheet: undefined, minRow: 0, maxRow: n - 1, minCol: 0, maxCol: 0 },
    ]);
    data['0,0'] = 11;
    const result = engine.onCellChanged(0, 0, accessor);
    expect(result.updatedCells.length).toBe(n);
    expect(engine.getValue(1, n - 1)).toBe(n + 10);
  });

  it('recalculates range dependents when a formula cell inside the range changes', () => {
    const engine = new FormulaEngine();
    const accessor = createAccessor({ '0,1': 5 });
    engine.setFormula(0, 0, '=1', accessor); // A1
    engine.setFormula(1, 0, '=SUM(A1:A3)', accessor); // B1
    expect(engine.getValue(1, 0)).toBe(6);
    engine.setFormula(0, 0, '=10', accessor);
    expect(engine.getValue(1, 0)).toBe(15);
  });

  it('detects a cycle through a range', () => {
    const engine = new FormulaEngine();
    const accessor = createAccessor({});
    engine.setFormula(1, 0, '=A1+1', accessor); // B1
    engine.setFormula(0, 0, '=SUM(B1:B5)', accessor); // A1 -> B1 -> A1
    expect(isError(engine.getValue(0, 0), '#CIRC!')).toBe(true);
  });

  it('turns a throwing custom function into an error value', () => {
    const engine = new FormulaEngine({
      customFunctions: {
        BOOM: { minArgs: 0, maxArgs: 0, evaluate: () => { throw new Error('kaboom'); } },
      },
    });
    const accessor = createAccessor({});
    expect(() => engine.setFormula(0, 0, '=BOOM()', accessor)).not.toThrow();
    expect(engine.hasFormula(0, 0)).toBe(true);
    expect(isError(engine.getValue(0, 0), '#VALUE!')).toBe(true);
  });

  it('caps REPT, SEQUENCE and SUBSTITUTE work', () => {
    const engine = new FormulaEngine();
    const accessor = createAccessor({});
    engine.setFormula(0, 0, '=REPT("ab",10000000000)', accessor);
    expect(isError(engine.getValue(0, 0), '#VALUE!')).toBe(true);
    engine.setFormula(0, 1, '=REPT("ab",3)', accessor);
    expect(engine.getValue(0, 1)).toBe('ababab');

    const start = performance.now();
    engine.setFormula(0, 2, '=SEQUENCE(1000000000,1,7)', accessor);
    expect(engine.getValue(0, 2)).toBe(7);
    engine.setFormula(0, 3, '=SUBSTITUTE("abc","","x",1000000000000)', accessor);
    expect(engine.getValue(0, 3)).toBe('abc');
    expect(performance.now() - start).toBeLessThan(3000);
  });

  it('recalculates dependents when a new formula closes a cycle', () => {
    const engine = new FormulaEngine();
    const data: Record<string, unknown> = { '0,0': 5 };
    const accessor = createAccessor(data);
    engine.setFormula(1, 0, '=A1*2', accessor); // B1
    engine.setFormula(2, 0, '=B1+1', accessor); // C1
    expect(engine.getValue(2, 0)).toBe(11);
    const result = engine.setFormula(1, 0, '=C1', accessor); // B1 -> C1 -> B1
    expect(isError(engine.getValue(1, 0), '#CIRC!')).toBe(true);
    expect(isError(engine.getValue(2, 0), '#CIRC!')).toBe(true);
    expect(result.updatedCells.map((c) => c.cellKey).sort()).toEqual(['1,0', '2,0']);
  });

  it('recalculates INDIRECT and OFFSET formulas when any cell changes', () => {
    const engine = new FormulaEngine();
    const data: Record<string, unknown> = { '0,1': 10 };
    const accessor = createAccessor(data);
    engine.setFormula(1, 0, '=INDIRECT("A2")', accessor);
    engine.setFormula(2, 0, '=OFFSET(A1,1,0)', accessor);
    engine.setFormula(3, 0, '=B1+1', accessor);
    expect(engine.getValue(1, 0)).toBe(10);
    data['0,1'] = 99;
    engine.onCellChanged(0, 1, accessor);
    expect(engine.getValue(1, 0)).toBe(99);
    expect(engine.getValue(2, 0)).toBe(99);
    expect(engine.getValue(3, 0)).toBe(100);
  });

  it('drops volatility when the formula is replaced or cleared', () => {
    const engine = new FormulaEngine();
    const data: Record<string, unknown> = { '0,1': 10 };
    const accessor = createAccessor(data);
    engine.setFormula(1, 0, '=INDIRECT("A2")', accessor);
    engine.setFormula(1, 0, '=1', accessor);
    expect(engine.onCellChanged(0, 1, accessor).updatedCells).toEqual([]);
  });
});

describe('cell keys with unusual sheet names', () => {
  it.each(['2024', 'Q1:Q2', 'a,b', 'Sheet 1'])('round-trips sheet %p', (sheet) => {
    expect(fromCellKey(toCellKey(3, 4, sheet))).toEqual({ col: 3, row: 4, sheet });
  });

  it('parses unsheeted keys', () => {
    expect(fromCellKey(toCellKey(3, 4))).toEqual({ col: 3, row: 4 });
  });
});

describe('formula parsing and arithmetic edge cases', () => {
  const evalFormula = (formula: string) => {
    const engine = new FormulaEngine();
    engine.setFormula(0, 0, formula, createAccessor({}));
    return engine.getValue(0, 0);
  };

  it('parses scientific notation', () => {
    expect(evalFormula('=1e5')).toBe(100000);
    expect(evalFormula('=2.5E-3*1000')).toBe(2.5);
    expect(evalFormula('=1E+2')).toBe(100);
  });

  it('rejects unterminated strings', () => {
    expect(isError(evalFormula('="abc'))).toBe(true);
  });

  it('does not coerce whitespace, hex or Infinity text to numbers', () => {
    expect(isError(evalFormula('=" "+1', ), '#VALUE!')).toBe(true);
    expect(isError(evalFormula('="0x10"+1'), '#VALUE!')).toBe(true);
    expect(isError(evalFormula('="Infinity"+1'), '#VALUE!')).toBe(true);
    expect(evalFormula('=" 42 "+1')).toBe(43);
  });

  it('maps non-finite arithmetic to Excel errors', () => {
    expect(isError(evalFormula('=0^-1'), '#DIV/0!')).toBe(true);
    expect(isError(evalFormula('=(-8)^(1/3)'), '#NUM!')).toBe(true);
    expect(isError(evalFormula('=10^400'), '#NUM!')).toBe(true);
  });
});
