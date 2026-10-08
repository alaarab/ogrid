import { FormulaEngine } from '../formulaEngine';
import { FormulaEvaluator } from '../evaluator';
import { createBuiltInFunctions } from '../functions';
import { parse } from '../parser';
import { tokenize } from '../tokenizer';
import { FormulaError, type IFormulaContext, type IGridDataAccessor } from '../types';

function fixture(data: unknown[][] = [[3, 'c'], [1, 'a'], [3, 'c'], [2, 'b']]) {
  const accessor: IGridDataAccessor = {
    getCellValue: (col, row) => data[row]?.[col],
    getRowCount: () => data.length,
    getColumnCount: () => 8,
  };
  const context: IFormulaContext = {
    getCellValue: a => accessor.getCellValue(a.col, a.row),
    getRangeValues: ({ start, end }) => Array.from({ length: end.row - start.row + 1 }, (_, r) =>
      Array.from({ length: end.col - start.col + 1 }, (_, c) => accessor.getCellValue(start.col + c, start.row + r))),
    now: () => new Date(),
    currentCell: { col: 5, row: 1, absCol: false, absRow: false },
  };
  const evaluator = new FormulaEvaluator(createBuiltInFunctions());
  const evaluate = (formula: string) => evaluator.evaluate(parse(tokenize(formula.replace(/^=/, ''))), context);
  return { data, accessor, evaluate, engine: new FormulaEngine() };
}

describe('dynamic array evaluation', () => {
  it.each([
    ['SEQUENCE(2,3,10,2)', [[10, 12, 14], [16, 18, 20]]],
    ['UNIQUE(A1:B4)', [[3, 'c'], [1, 'a'], [2, 'b']]],
    ['UNIQUE(A1:B4,FALSE,TRUE)', [[1, 'a'], [2, 'b']]],
    ['FILTER(A1:B4,A1:A4>1)', [[3, 'c'], [3, 'c'], [2, 'b']]],
    ['FILTER(A1:B4,A1:A4>5,"empty")', 'empty'],
    ['SORT(A1:B4,1,-1)', [[3, 'c'], [3, 'c'], [2, 'b'], [1, 'a']]],
    ['SORTBY(A1:B4,B1:B4,1,A1:A4,-1)', [[1, 'a'], [2, 'b'], [3, 'c'], [3, 'c']]],
    ['TEXTSPLIT("a,b;c",",",";")', [['a', 'b'], ['c', new FormulaError('#N/A')]]],
    ['TRANSPOSE(A1:B2)', [[3, 1], ['c', 'a']]],
    ['A1:A4*2', [[6], [2], [6], [4]]],
    ['-SEQUENCE(2)', [[-1], [-2]]],
    ['ABS(A1:A4-2)', [[1], [1], [1], [0]]],
    ['IF(A1:A4>2,"yes","no")', [['yes'], ['no'], ['yes'], ['no']]],
    ['@A1:A4', 1],
    ['ROWS(SEQUENCE(2,3))', 2],
    ['COLUMNS(SEQUENCE(2,3))', 3],
    ['INDEX(A1:B4,0,2)', [['c'], ['a'], ['c'], ['b']]],
    ['XLOOKUP(1,A1:A4,A1:B4)', [[1, 'a']]],
  ])('evaluates %s with its complete shape', (formula, expected) => {
    expect(fixture().evaluate(formula)).toEqual(expected);
  });

  it('returns a bounded integer RANDARRAY and rejects invalid sizes before allocation', () => {
    const { evaluate } = fixture();
    const result = evaluate('RANDARRAY(3,2,5,6,TRUE)') as number[][];
    expect(result.map(r => r.length)).toEqual([2, 2, 2]);
    expect(result.flat().every(v => v === 5 || v === 6)).toBe(true);
    expect(evaluate('SEQUENCE(1000000000)')).toBeInstanceOf(FormulaError);
    expect(evaluate('FILTER(A1:B4,A1:A4>9)')).toEqual(new FormulaError('#CALC!', 'Empty array'));
  });
});

describe('spill lifecycle', () => {
  it('spills values, exposes the anchor, and copies only the formula at the anchor', () => {
    const { engine, accessor } = fixture();
    const changes = engine.setFormula(3, 0, '=SEQUENCE(2,2)', accessor);
    expect(changes.updatedCells.map(c => c.newValue)).toEqual([1, 2, 3, 4]);
    expect(engine.getValue(4, 1)).toBe(4);
    expect(engine.getFormula(4, 1)).toBeUndefined();
    expect(engine.getSpillRange(4, 1)).toEqual({ anchorCol: 3, anchorRow: 0, endCol: 4, endRow: 1 });
  });

  it.each([0, false, 'occupied', '=1'])('blocks the entire spill on a non-empty target (%s) and recovers when cleared', value => {
    const { engine, accessor, data } = fixture();
    data[1]![3] = value;
    engine.setFormula(3, 0, '=SEQUENCE(3)', accessor);
    expect(engine.getValue(3, 0)).toEqual(new FormulaError('#SPILL!', 'Spill range is blocked'));
    expect(engine.getValue(3, 2)).toBeUndefined();
    data[1]![3] = '';
    engine.onCellChanged(3, 1, accessor);
    expect(engine.getValue(3, 2)).toBe(3);
  });

  it('updates direct child and A1# dependents through growth, shrink, and anchor deletion', () => {
    const { engine, accessor, data } = fixture();
    engine.loadFormulas([
      { col: 5, row: 0, formula: '=SUM(D1#)' },
      { col: 5, row: 1, formula: '=COUNTA(D1#)' },
      { col: 5, row: 2, formula: '=D3*10' },
      { col: 3, row: 0, formula: '=SEQUENCE(A1)' },
    ], accessor);
    expect([engine.getValue(5, 0), engine.getValue(5, 1), engine.getValue(5, 2)]).toEqual([6, 3, 30]);
    data[0]![0] = 4;
    engine.onCellChanged(0, 0, accessor);
    expect([engine.getValue(5, 0), engine.getValue(5, 1), engine.getValue(3, 3)]).toEqual([10, 4, 4]);
    data[0]![0] = 1;
    const resized = engine.onCellChanged(0, 0, accessor);
    expect(resized.updatedCells.some(c => c.col === 3 && c.row === 2 && c.newValue === undefined)).toBe(true);
    expect([engine.getValue(5, 0), engine.getValue(5, 1), engine.getValue(5, 2)]).toEqual([1, 1, 0]);
    engine.setFormula(3, 0, null, accessor);
    expect(engine.getSpillRange(3, 0)).toBeUndefined();
    expect((engine.getValue(5, 0) as FormulaError).type).toBe('#REF!');
  });

  it('blocks overlapping spills and recovers after the winning anchor is removed', () => {
    const { engine, accessor } = fixture();
    engine.setFormula(4, 0, '=SEQUENCE(3)', accessor);
    engine.setFormula(3, 1, '=SEQUENCE(2,2)', accessor);
    expect((engine.getValue(3, 1) as FormulaError).type).toBe('#SPILL!');
    engine.setFormula(4, 0, null, accessor);
    expect(engine.getValue(4, 2)).toBe(4);
  });

  it('keeps volatile arrays and their consumers consistent after recalculation', () => {
    const { engine, accessor } = fixture();
    engine.loadFormulas([
      { col: 3, row: 0, formula: '=RANDARRAY(2)' },
      { col: 5, row: 0, formula: '=SUM(D1#)' },
      { col: 5, row: 1, formula: '=D2' },
    ], accessor);
    for (let i = 0; i < 3; i++) {
      engine.onCellChanged(0, 0, accessor);
      expect(engine.getValue(5, 0)).toBe((engine.getValue(3, 0) as number) + (engine.getValue(3, 1) as number));
      expect(engine.getValue(5, 1)).toBe(engine.getValue(3, 1));
    }
  });

  it('preserves the shape of a range with trailing blanks and keeps SUM reads clipped', () => {
    const { engine, accessor } = fixture([[7]]);
    engine.setFormula(3, 0, '=A1:A5*2', accessor);
    expect([0, 1, 2, 3, 4].map(r => engine.getValue(3, r))).toEqual([14, 0, 0, 0, 0]);
    engine.setFormula(5, 0, '=SUM(A1:A1048576)', accessor);
    expect(engine.getValue(5, 0)).toBe(7);
  });

  it('refreshes INDIRECT readers when a growing spill creates their target cell', () => {
    const { engine, accessor, data } = fixture([[1]]);
    engine.loadFormulas([
      { col: 3, row: 0, formula: '=SEQUENCE(A1)' },
      { col: 5, row: 0, formula: '=INDIRECT("D2")' },
    ], accessor);
    data[0]![0] = 3;
    engine.onCellChanged(0, 0, accessor);
    expect(engine.getValue(5, 0)).toBe(2);
  });

  it('reports cleared spill children when formulas are reloaded for host undo', () => {
    const { engine, accessor } = fixture();
    engine.setFormula(3, 0, '=SEQUENCE(3)', accessor);
    const cleared = engine.loadFormulas([], accessor);
    expect(cleared.updatedCells.map(c => [c.col, c.row, c.newValue])).toEqual([[3, 0, undefined], [3, 1, undefined], [3, 2, undefined]]);
  });

  it('detects a circular reference through a spill child without leaving stale output', () => {
    const { engine, accessor } = fixture();
    engine.setFormula(3, 0, '=SEQUENCE(2)+D2', accessor);
    expect((engine.getValue(3, 0) as FormulaError).type).toBe('#CIRC!');
    expect(engine.getValue(3, 1)).toBeUndefined();
  });
});
