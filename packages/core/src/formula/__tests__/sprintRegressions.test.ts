import { describe, expect, it } from 'bun:test';
import { FormulaEngine } from '../formulaEngine';
import { FormulaError } from '../types';
import { adjustFormulaReferences, formatAddress } from '../cellAddressUtils';
import { toNumber } from '../evaluator';

function grid(data: unknown[][] = []) {
  const engine = new FormulaEngine();
  const accessor = {
    getCellValue: (col: number, row: number) => data[row]?.[col],
    getRowCount: () => data.length,
    getColumnCount: () => Math.max(1, ...data.map(row => row.length)),
  };
  const calc = (formula: string, col = 10, row = 0) => {
    engine.setFormula(col, row, formula, accessor);
    return engine.getValue(col, row);
  };
  return { engine, accessor, calc };
}
const error = (value: unknown, type: string) => {
  expect(value).toBeInstanceOf(FormulaError);
  expect(String(value)).toBe(type);
};

describe('T4/T5 cluster regressions', () => {
  it('F06: ISO dates and DST intervals use calendar days', () => {
    const { calc } = grid();
    expect(calc('=DAY("2024-03-01")')).toBe(1);
    expect(calc('=MONTH("2024-03-01")')).toBe(3);
    expect(calc('=NETWORKDAYS("2024-03-04","2024-03-08")')).toBe(5);
    expect(calc('=DAYS("2024-03-11","2024-03-09")')).toBe(2);
  });
  it('F07: serial arithmetic and serial input', () => {
    const { calc } = grid();
    expect(calc('=DATE(2024,3,1)+30')).toBe(45382);
    expect(calc('=DATE(2024,3,10)-DATE(2024,3,1)')).toBe(9);
    expect(calc('=YEAR(45352)')).toBe(2024);
    expect(calc('=DAY(60)')).toBe(29);
    expect(toNumber(calc('=DATE(1900,2,29)'))).toBe(60);
    expect(calc('=DAYS(61,59)')).toBe(2);
    expect(calc('=DATEDIF(59,61,"D")')).toBe(2);
    expect(toNumber(calc('=EDATE(60,1)'))).toBe(89);
    expect(toNumber(calc('=EOMONTH(32,0)'))).toBe(60);
    expect(toNumber(calc('=DATEVALUE("1900-02-29")'))).toBe(60);
    expect(calc('=DAY("1900-02-29")')).toBe(29);
    error(calc('=DATEDIF(60,59,"D")'), '#NUM!');
  });
  it('F07: date functions still return Dates (UTC midnight) for date columns and valueFormatter', () => {
    const { calc } = grid();
    for (const formula of ['=DATE(2024,3,1)', '=EDATE("2024-01-01",2)', '=EOMONTH("2024-03-10",0)', '=WORKDAY("2024-02-29",1)', '=DATEVALUE("2024-03-01")']) {
      const value = calc(formula);
      expect(value).toBeInstanceOf(Date);
      expect((value as Date).toISOString().slice(0, 10)).toBe(formula === '=EOMONTH("2024-03-10",0)' ? '2024-03-31' : '2024-03-01');
    }
    expect((calc('=TODAY()') as Date).getUTCHours()).toBe(0);
  });
  it('F04: clearing a cycle restores the data accessor and partner', () => {
    const { engine, accessor } = grid([[0, 10]]);
    engine.setFormula(0, 0, '=B1+1', accessor);
    engine.setFormula(1, 0, '=A1+1', accessor);
    engine.setFormula(1, 0, null, accessor);
    expect(engine.getValue(1, 0)).toBeUndefined();
    expect(engine.getValue(0, 0)).toBe(11);
  });
  it('F05: cycle dependents can catch errors', () => {
    const { engine, accessor } = grid();
    engine.loadFormulas([
      { col: 2, row: 0, formula: '=IFERROR(A1,0)' },
      { col: 3, row: 0, formula: '=ISERROR(A1)' },
      { col: 0, row: 0, formula: '=B1' },
      { col: 1, row: 0, formula: '=A1' },
    ], accessor);
    error(engine.getValue(0, 0), '#CIRC!');
    expect(engine.getValue(2, 0)).toBe(0);
    expect(engine.getValue(3, 0)).toBe(true);
  });
  it('F11: dynamic references read freshly recalculated formulas', () => {
    const data = [[1]];
    const { engine, accessor } = grid(data);
    engine.loadFormulas([
      { col: 2, row: 0, formula: '=INDIRECT("B1")' },
      { col: 3, row: 0, formula: '=OFFSET(A1,0,1)' },
      { col: 1, row: 0, formula: '=A1*2' },
      { col: 4, row: 0, formula: '=C1+1' },
    ], accessor);
    data[0]![0] = 5;
    engine.onCellChanged(0, 0, accessor);
    expect(engine.getValue(2, 0)).toBe(10);
    expect(engine.getValue(3, 0)).toBe(10);
    expect(engine.getValue(4, 0)).toBe(11);
  });
  it('F12: blank, numeric, boolean and wildcard criteria and lookups', () => {
    const { calc } = grid([[1], [''], [null], ['apple'], [true], [0], ['apricot'], ['ap*']]);
    expect(calc('=COUNTIF(A1:A7,"<>")')).toBe(5);
    expect(calc('=COUNTIF(A1:A7,0)')).toBe(1);
    expect(calc('=COUNTIF(A1:A7,"<5")')).toBe(2);
    expect(calc('=COUNTIF(A1:A7,"ap*")')).toBe(2);
    expect(calc('=COUNTIF(A1:A7,"TRUE")')).toBe(1);
    expect(calc('=COUNTIF(A1:A7,"=")')).toBe(2);
    expect(calc('=COUNTIFS(A1:A20,"",A1:A20,"=")')).toBe(14);
    expect(calc('=MATCH("ap*",A1:A7,0)')).toBe(4);
    expect(calc('=MATCH("ap~*",A1:A8,0)')).toBe(8);
    expect(calc('=SEARCH("a?*e","xxApple")')).toBe(3);
  });
  it('F13: digit names and definitions follow later changes', () => {
    const { engine, accessor, calc } = grid([[1], [2], [3]]);
    engine.defineNamedRange('Sales2024', 'A1:A2');
    expect(calc('=SUM(Sales2024)')).toBe(3);
    engine.defineNamedRange('Sales2024', 'A1:A3');
    engine.recalcAll(accessor);
    expect(engine.getValue(10, 0)).toBe(6);
    calc('=SUM(Later)');
    engine.defineNamedRange('Later', 'A1:A3');
    engine.recalcAll(accessor);
    expect(engine.getValue(10, 0)).toBe(6);
    engine.removeNamedRange('Later');
    engine.recalcAll(accessor);
    error(engine.getValue(10, 0), '#NAME?');
  });
  it('F14: decimal rounding avoids binary scaling errors', () => {
    const { calc } = grid();
    for (const [f, expected] of [
      ['ROUND(1.005,2)', 1.01], ['ROUND(-1.005,2)', -1.01],
      ['ROUNDDOWN(4.35,2)', 4.35], ['TRUNC(4.35,2)', 4.35],
      ['FLOOR(0.3,0.1)', 0.3], ['CEILING(0.6,0.2)', 0.6],
    ] as const) expect(calc(`=${f}`)).toBe(expected);
  });
  it('F15: logical coercion and ignored range blanks/text', () => {
    const { calc } = grid([[true], [null], [true], ['FALSE']]);
    expect(calc('=IF("FALSE",1,2)')).toBe(2);
    expect(calc('=NOT("FALSE")')).toBe(true);
    expect(calc('=AND(A1:A4)')).toBe(true);
    error(calc('=IF("hello",1,2)'), '#VALUE!');
    error(calc('=AND(A4:A4)'), '#VALUE!');
  });
  it('F16: current coordinates and dynamic ranges in aggregates', () => {
    const { calc } = grid([[1], [2], [3]]);
    expect(calc('=ROW()', 2, 4)).toBe(5);
    expect(calc('=COLUMN()', 3, 6)).toBe(4);
    expect(calc('=SUM(INDIRECT("A1:A3"))')).toBe(6);
    expect(calc('=SUM(OFFSET(A1,0,0,3,1))')).toBe(6);
  });
  it('F17: CORREL keeps complete pairs and requires equal shape', () => {
    const { calc } = grid([[1, 1], [3, 3], ['x', -100], [100, 'y']]);
    expect(calc('=CORREL(A1:A4,B1:B4)')).toBe(1);
    error(calc('=CORREL(A1:A4,B1:B3)'), '#N/A');
  });
  it('F19: every function maps non-finite results to NUM', () => {
    const { calc } = grid();
    for (const f of ['POWER(10,400)', 'EXP(1000)', 'ROUND(1,400)', 'SQRT(-1)']) error(calc(`=${f}`), '#NUM!');
  });
  it('F20: ranges, single references and horizontal INDEX', () => {
    const { calc } = grid([[2, 20]]);
    expect(calc('=LCM(A1:B1)')).toBe(20);
    expect(calc('=GCD(A1:B1)')).toBe(2);
    expect(calc('=LARGE(A1,1)')).toBe(2);
    expect(calc('=SMALL(B1,1)')).toBe(20);
    expect(calc('=RANK(A1,A1)')).toBe(1);
    expect(calc('=INDEX(A1:B1,2)')).toBe(20);
  });
  it('F22: error literals and apostrophes survive reference adjustment', () => {
    expect(adjustFormulaReferences('=A1+#REF!', 0, 1)).toBe('=A2+#REF!');
    expect(formatAddress({ col: 0, row: 0, absCol: false, absRow: false, sheet: "Bob's" })).toBe("'Bob''s'!A1");
    const { engine, calc } = grid();
    engine.registerSheet("Bob's", grid([[7]]).accessor);
    expect(calc("='Bob''s'!A1")).toBe(7);
  });
  it('F24: grouped Excel compatibility cases', () => {
    const { calc } = grid([[true, 10], [4, 2]]);
    expect(calc('=SUM(A1:A2)')).toBe(4);
    expect(calc('=AVERAGE(A1:A2)')).toBe(4);
    expect(calc('=SUMPRODUCT(A1:A2,B1:B2)')).toBe(8);
    expect(calc('=DATEDIF("2024-01-15","2025-03-20","YM")')).toBe(2);
    expect(calc('=DATEDIF("2024-01-15","2025-03-20","MD")')).toBe(5);
    expect(calc('=DATEDIF("2024-01-15","2025-03-20","YD")')).toBe(64);
    expect(calc('=WEEKDAY("2024-03-01",11)')).toBe(5);
    expect(calc('=YEARFRAC("2024-03-01","2024-03-31",2)')).toBe(30 / 360);
    expect(calc('=CHOOSE("2",10,20)')).toBe(20);
    expect(calc('=SWITCH("A","a",1,2)')).toBe(1);
    expect(calc('="x"&TRUE')).toBe('xTRUE');
    expect(calc('=PROPER("éLan")')).toBe('Élan');
    expect(calc('="x"&(0.1+0.2)')).toBe('x0.3');
    expect(calc('=ISBLANK("")')).toBe(false);
    // A grid cell cleared to '' reads as empty.
    expect(grid([['']]).calc('=ISBLANK(A1)')).toBe(true);
    expect(grid([[new Date(Date.UTC(2024, 2, 1))], [new Date(Date.UTC(2023, 0, 1))]]).calc('=COUNTIF(A1:A2,">"&DATE(2024,1,1))')).toBe(1);
    error(calc('=TIME(-1,0,0)'), '#NUM!');
    error(calc('=REPLACE("abc",0,1,"x")'), '#VALUE!');
  });
  it('F25: TEXT formats dates, currency, literals and sections', () => {
    const { calc } = grid();
    expect(calc('=TEXT(DATE(2024,3,1),"yyyy-mm-dd")')).toBe('2024-03-01');
    expect(calc('=TEXT(1234.5,"$#,##0.00")')).toBe('$1,234.50');
    expect(calc('=TEXT(-12.5,"0.00;(0.00)")')).toBe('(12.50)');
    expect(calc('=TEXT(TIME(14,5,9),"hh:mm:ss")')).toBe('14:05:09');
    expect(calc('=TEXT(7,"000")')).toBe('007');
    expect(calc('=TEXT(7,"""0""0")')).toBe('07');
    expect(calc('=TEXT(-7,"0;;0")')).toBe('');
  });
  it('F26: mixed types order number < text < boolean', () => {
    const { calc } = grid([[0], [null]]);
    expect(calc('=""=0')).toBe(false);
    expect(calc('="10"=10')).toBe(false);
    expect(calc('=TRUE>5')).toBe(true);
    expect(calc('=IF(A1="","blank",A1*2)')).toBe(0);
    expect(calc('=A2=0')).toBe(true);
  });
  it('F27: RATE converges for ordinary long loans', () => {
    const { calc } = grid();
    expect(calc('=RATE(360,-1000,200000)')).toBeCloseTo(0.00365593, 7);
    expect(typeof calc('=RATE(240,-1500,200000)')).toBe('number');
  });
  it('F28: MODE requires repetition', () => error(grid().calc('=MODE(1,2,3)'), '#N/A'));
  it('F29: NETWORKDAYS accepts holidays, duplicates and reversed endpoints', () => {
    const { calc } = grid([['2024-03-06'], ['2024-03-06']]);
    expect(calc('=NETWORKDAYS("2024-03-04","2024-03-08",A1:A2)')).toBe(4);
    expect(calc('=NETWORKDAYS("2024-03-08","2024-03-04",A1:A2)')).toBe(-4);
  });
  it('F30: IFS rejects mismatched logical shapes', () => {
    const { calc } = grid([[1], [2]]);
    for (const f of ['SUMIFS(A1:A6,A1:A3,">0")', 'COUNTIFS(A1:A6,">0",A1:A3,">0")', 'AVERAGEIFS(A1:A6,A1:A3,">0")']) error(calc(`=${f}`), '#VALUE!');
  });
  it('F31: text XLOOKUP next smaller and larger', () => {
    const { calc } = grid([['a', 1], ['b', 2], ['c', 3]]);
    expect(calc('=XLOOKUP("bb",A1:A3,B1:B3,"nf",-1)')).toBe(2);
    expect(calc('=XLOOKUP("bb",A1:A3,B1:B3,"nf",1)')).toBe(3);
  });
});

describe('T4 resource bounds', () => {
  it('F01: date and combinatoric extremes finish with errors', () => {
    const { calc } = grid();
    error(calc('=WORKDAY.INTL("2024-01-01",1,"1111111")'), '#VALUE!');
    error(calc('=WORKDAY("2024-01-01",1e8)'), '#NUM!');
    error(calc('=COMBIN(1e12,5e11)'), '#NUM!');
    error(calc('=PERMUT(1e12,5e11)'), '#NUM!');
    expect(calc('=NETWORKDAYS(DATE(1900,1,1),DATE(9999,12,31))')).toBeGreaterThan(2_000_000);
    expect(toNumber(calc('=WORKDAY("2024-01-05",1)'))).toBe(45299);
    expect(calc('=COMBIN(1000,1)')).toBe(1000);
    expect(calc('=COMBIN(1000,999)')).toBe(1000);
  });
  it('F02: determinant uses pivoted elimination and caps matrix size', () => {
    const data = Array.from({ length: 12 }, (_, r) => Array.from({ length: 12 }, (_, c) => r === c ? 2 : 0));
    const { calc } = grid(data);
    expect(calc('=MDETERM(A1:L12)', 13)).toBe(4096);
    error(calc('=MDETERM(A1:BM65)', 65), '#VALUE!');
    expect(grid([[0, 2], [3, 4]]).calc('=MDETERM(A1:B2)')).toBe(-6);
    expect(grid().calc('=MDETERM(A1:L12)', 13)).toBe(0);
  });
  it('F03: scalar matrix results read only the necessary entries', () => {
    const { engine, accessor } = grid([[1, 2, 3, 4, 5, 6], [0, 1, 0, 7, 8, 9], [0, 0, 1, 10, 11, 12]]);
    let reads = 0;
    const original = accessor.getCellValue;
    accessor.getCellValue = (c, r) => { reads++; return original(c, r); };
    engine.setFormula(10, 0, '=TRANSPOSE(A1:C3)', accessor);
    expect(engine.getValue(10, 0)).toBe(1);
    expect(reads).toBe(1);
    reads = 0;
    engine.setFormula(10, 0, '=MMULT(A1:C3,D1:F3)', accessor);
    expect(engine.getValue(10, 0)).toBe(48);
    expect(reads).toBe(6);
    expect(grid([[2, 0], [0, 4]]).calc('=MINVERSE(A1:B2)')).toBe(0.5);
    error(engine.setFormula(65, 0, '=MINVERSE(A1:BM65)', accessor).updatedCells[0]?.newValue, '#VALUE!');
  });
  it('F08: small range reads never scan unrelated formula row sets', () => {
    const { engine, accessor } = grid([[1], [2]]);
    engine.setFormula(0, 1000, '=9', accessor);
    const index = (engine as unknown as { formulaRowsByCol: Map<number, Set<number>> }).formulaRowsByCol;
    const rows = index.get(0)!;
    rows[Symbol.iterator] = () => { throw new Error('scanned unrelated formula rows'); };
    engine.setFormula(10, 0, '=SUM(A1:A2)', accessor);
    expect(engine.getValue(10, 0)).toBe(3);
  });
  it('F09: million-cell ranges clamp reads and retain blank/index/row semantics', () => {
    const { engine, accessor } = grid([[1], [2]]);
    let reads = 0;
    const original = accessor.getCellValue;
    accessor.getCellValue = (c, r) => { reads++; return original(c, r); };
    engine.setFormula(10, 0, '=SUM(A1:A1000000)', accessor);
    expect(engine.getValue(10, 0)).toBe(3);
    expect(reads).toBe(2);
    engine.setFormula(10, 0, '=COUNTBLANK(A1:A1000000)', accessor);
    expect(engine.getValue(10, 0)).toBe(999998);
    engine.setFormula(10, 0, '=COUNTIF(A1:A1000000,"")', accessor);
    expect(engine.getValue(10, 0)).toBe(999998);
    engine.setFormula(10, 0, '=INDEX(A1:A1000000,1000000)', accessor);
    expect(engine.getValue(10, 0)).toBeNull();
    engine.setFormula(10, 0, '=ROWS(A1:A1000000)', accessor);
    expect(engine.getValue(10, 0)).toBe(1000000);
  });
  it('limits: defaults handle large grids, and hosts can tighten them', () => {
    const rows = Array.from({ length: 200_000 }, (_, r) => r % 10);
    const accessor = { getCellValue: (c: number, r: number) => (c === 0 ? rows[r] : undefined), getRowCount: () => rows.length, getColumnCount: () => 1 };
    const engine = new FormulaEngine();
    engine.setFormula(10, 0, '=SUM(A1:A200000)', accessor);
    expect(engine.getValue(10, 0)).toBe(900_000);
    engine.setFormula(10, 0, '=COUNTIF(A1:A99000,">5")', accessor);
    expect(engine.getValue(10, 0)).toBe(39_600);
    const tight = new FormulaEngine({ limits: { maxRangeCells: 100_000 } });
    tight.setFormula(10, 0, '=SUM(A1:A100001)', accessor);
    error(tight.getValue(10, 0), '#VALUE!');
    tight.setFormula(10, 0, '=SUM(A1:A100000)', accessor);
    expect(tight.getValue(10, 0)).toBe(450_000);
    const lowWork = new FormulaEngine({ limits: { maxWork: 1_000 } });
    lowWork.setFormula(10, 0, '=COUNTIF(A1:A2000,">5")', accessor);
    error(lowWork.getValue(10, 0), '#VALUE!');
  });
  it('F21: long failing numeric strings and overflowing numeric text are bounded', () => {
    const start = performance.now();
    error(toNumber('1'.repeat(40000) + 'x'), '#VALUE!');
    error(toNumber('1'.repeat(20000) + 'x'), '#VALUE!');
    error(toNumber('1e9999'), '#NUM!');
    expect(performance.now() - start).toBeLessThan(500);
  });
  it('F23: deep/oversized formulas do not throw or leave a partial load', () => {
    const { engine, accessor } = grid();
    const deep = '=' + 'A2+'.repeat(200000) + '1';
    expect(() => engine.loadFormulas([
      { col: 0, row: 0, formula: deep },
      { col: 1, row: 0, formula: '=7' },
      { col: 2, row: 0, formula: '=B1+1' },
    ], accessor)).not.toThrow();
    error(engine.getValue(0, 0), '#VALUE!');
    expect(engine.getValue(1, 0)).toBe(7);
    expect(engine.getValue(2, 0)).toBe(8);
    engine.setFormula(0, 0, '=' + '('.repeat(200) + '1' + ')'.repeat(200), accessor);
    error(engine.getValue(0, 0), '#VALUE!');
  });
  it('bounds generated text, wildcard work and non-finite integer inputs', () => {
    const { calc } = grid([['a'.repeat(30000)]]);
    error(calc('=TEXTJOIN(REPT("x",32767),FALSE,A1:A2)'), '#VALUE!');
    error(calc('=SEARCH(REPT("a?",200),A1)'), '#VALUE!');
    error(calc('=GCD(1e400,2)'), '#NUM!');
    error(calc('=SUBSTITUTE(A1,"a",REPT("b",32767))'), '#VALUE!');
  });
});
