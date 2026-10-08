import { describe, expect, it } from 'bun:test';
import { FormulaEngine } from '../../formulaEngine';
import type { IFormulaEngineConfig, IGridDataAccessor } from '../../types';
import { FormulaError } from '../../types';

function createAccessor(data: Record<string, unknown> = {}): IGridDataAccessor {
  return {
    getCellValue: (col: number, row: number) => data[`${col},${row}`] ?? null,
    getRowCount: () => 100,
    getColumnCount: () => 26,
  };
}

/** Evaluate a formula in Z100, clear of the data it reads. Data keys are "col,row" (0-based). */
function evalFormula(formula: string, data: Record<string, unknown> = {}, config?: IFormulaEngineConfig): unknown {
  const engine = new FormulaEngine(config);
  engine.setFormula(25, 99, formula, createAccessor(data));
  return engine.getValue(25, 99);
}

function errorType(value: unknown): string | undefined {
  return value instanceof FormulaError ? value.type : undefined;
}

/** Column A (col 0) from rows 1..n. */
function columnA(...values: unknown[]): Record<string, unknown> {
  return Object.fromEntries(values.map((value, row) => [`0,${row}`, value]));
}

function column(col: number, values: unknown[]): Record<string, unknown> {
  return Object.fromEntries(values.map((value, row) => [`${col},${row}`, value]));
}

describe('MAXIFS / MINIFS', () => {
  const data = { ...columnA(10, 20, 30, 40, 'x'), ...column(1, ['a', 'b', 'a', 'b', 'a']), ...column(2, [1, 1, 2, 2, 2]) };

  it('returns the max/min of matching numbers', () => {
    expect(evalFormula('=MAXIFS(A1:A5,B1:B5,"a")', data)).toBe(30);
    expect(evalFormula('=MINIFS(A1:A5,B1:B5,"b")', data)).toBe(20);
  });

  it('supports comparison, wildcard and multiple criteria', () => {
    expect(evalFormula('=MAXIFS(A1:A5,A1:A5,"<35")', data)).toBe(30);
    expect(evalFormula('=MINIFS(A1:A5,B1:B5,"<>a")', data)).toBe(20);
    expect(evalFormula('=MAXIFS(A1:A5,B1:B5,"?")', data)).toBe(40);
    expect(evalFormula('=MAXIFS(A1:A5,B1:B5,"a",C1:C5,1)', data)).toBe(10);
  });

  it('ignores text in the target range and returns 0 when nothing matches', () => {
    expect(evalFormula('=MAXIFS(A1:A5,B1:B5,"z")', data)).toBe(0);
    expect(evalFormula('=MINIFS(A5:A5,B5:B5,"a")', data)).toBe(0);
  });

  it('rejects mismatched range shapes and missing criteria', () => {
    expect(errorType(evalFormula('=MAXIFS(A1:A5,B1:B4,"a")', data))).toBe('#VALUE!');
    expect(errorType(evalFormula('=MINIFS(A1:A5,B1:B5,"a",C1:C5)', data))).toBe('#VALUE!');
  });

  it('propagates an error criteria', () => {
    expect(errorType(evalFormula('=MAXIFS(A1:A5,B1:B5,1/0)', data))).toBe('#DIV/0!');
  });
});

describe('SUBTOTAL', () => {
  const data = columnA(2, 4, 'x', 6);

  it('maps function_num 1-11 to the aggregate functions', () => {
    expect(evalFormula('=SUBTOTAL(1,A1:A4)', data)).toBe(4);
    expect(evalFormula('=SUBTOTAL(2,A1:A4)', data)).toBe(3);
    expect(evalFormula('=SUBTOTAL(3,A1:A4)', data)).toBe(4);
    expect(evalFormula('=SUBTOTAL(4,A1:A4)', data)).toBe(6);
    expect(evalFormula('=SUBTOTAL(5,A1:A4)', data)).toBe(2);
    expect(evalFormula('=SUBTOTAL(6,A1:A4)', data)).toBe(48);
    expect(evalFormula('=SUBTOTAL(7,A1:A4)', data)).toBe(2);
    expect(evalFormula('=SUBTOTAL(8,A1:A4)', data)).toBeCloseTo(Math.sqrt(8 / 3), 10);
    expect(evalFormula('=SUBTOTAL(9,A1:A4)', data)).toBe(12);
    expect(evalFormula('=SUBTOTAL(10,A1:A4)', data)).toBe(4);
    expect(evalFormula('=SUBTOTAL(11,A1:A4)', data)).toBeCloseTo(8 / 3, 10);
  });

  it('treats 101-111 like 1-11 and sums several references', () => {
    expect(evalFormula('=SUBTOTAL(109,A1:A4)', data)).toBe(12);
    expect(evalFormula('=SUBTOTAL(109,A1:A2,A4)', data)).toBe(12);
  });

  it('rejects invalid function numbers and non-reference arguments', () => {
    expect(errorType(evalFormula('=SUBTOTAL(12,A1:A4)', data))).toBe('#VALUE!');
    expect(errorType(evalFormula('=SUBTOTAL(0,A1:A4)', data))).toBe('#VALUE!');
    expect(errorType(evalFormula('=SUBTOTAL(100,A1:A4)', data))).toBe('#VALUE!');
    expect(errorType(evalFormula('=SUBTOTAL(9,1,2)', data))).toBe('#VALUE!');
  });

  it('101-111 skip rows the accessor reports hidden; 1-11 still count them', () => {
    const hidden = new Set([1, 3]);
    const accessor: IGridDataAccessor = { ...createAccessor(columnA(2, 4, 'x', 6)), isRowHidden: (row) => hidden.has(row) };
    const engine = new FormulaEngine();
    engine.setFormula(1, 0, '=SUBTOTAL(109,A1:A4)', accessor);
    engine.setFormula(1, 1, '=SUBTOTAL(9,A1:A4)', accessor);
    engine.setFormula(1, 2, '=SUBTOTAL(102,A1:A4)', accessor);
    engine.setFormula(1, 3, '=SUBTOTAL(109,A2)', accessor);
    expect(engine.getValue(1, 0)).toBe(2);
    expect(engine.getValue(1, 1)).toBe(12);
    expect(engine.getValue(1, 2)).toBe(1);
    expect(engine.getValue(1, 3)).toBe(0);
    hidden.clear();
    engine.recalcAll(accessor);
    expect(engine.getValue(1, 0)).toBe(12);
  });

  it('skips cells holding their own SUBTOTAL so nested subtotals are not double counted', () => {
    const accessor = createAccessor(columnA(1, 2, null, 4));
    const engine = new FormulaEngine();
    engine.setFormula(0, 2, '=SUBTOTAL(9,A1:A2)', accessor);
    engine.setFormula(1, 0, '=SUBTOTAL(9,A1:A4)', accessor);
    engine.setFormula(1, 1, '=SUM(A1:A4)', accessor);
    expect(engine.getValue(0, 2)).toBe(3);
    expect(engine.getValue(1, 0)).toBe(7);
    expect(engine.getValue(1, 1)).toBe(10);
  });
});

describe('LOOKUP', () => {
  const data = { ...columnA(1, 3, 5, 7), ...column(1, ['a', 'b', 'c', 'd']) };

  it('vector form returns the result at the largest value <= lookup_value', () => {
    expect(evalFormula('=LOOKUP(4,A1:A4,B1:B4)', data)).toBe('b');
    expect(evalFormula('=LOOKUP(7,A1:A4,B1:B4)', data)).toBe('d');
    expect(evalFormula('=LOOKUP(100,A1:A4)', data)).toBe(7);
  });

  it('matches text case-insensitively', () => {
    expect(evalFormula('=LOOKUP("C",B1:B4,A1:A4)', data)).toBe(5);
  });

  it('returns #N/A when lookup_value is below every value', () => {
    expect(errorType(evalFormula('=LOOKUP(0,A1:A4,B1:B4)', data))).toBe('#N/A');
  });

  it('finds the last number with the big-number idiom, skipping text', () => {
    expect(evalFormula('=LOOKUP(9.99E+307,A1:A6)', { ...columnA(4, 'x', 9, 'y', 2, 'z') })).toBe(2);
  });

  it('array form searches the first column and returns the last column', () => {
    expect(evalFormula('=LOOKUP(5,A1:B4)', data)).toBe('c');
  });

  it('array form wider than tall searches the first row and returns the last row', () => {
    const wide = { '0,0': 1, '1,0': 2, '2,0': 3, '0,1': 'x', '1,1': 'y', '2,1': 'z' };
    expect(evalFormula('=LOOKUP(2.5,A1:C2)', wide)).toBe('y');
  });

  it('rejects a non-reference lookup_vector', () => {
    expect(errorType(evalFormula('=LOOKUP(1,5)', data))).toBe('#VALUE!');
  });
});

describe('XMATCH', () => {
  const data = { ...columnA(1, 3, 5, 7), ...column(1, ['apple', 'Banana', 'cherry', 'banana']) };

  it('exact match by default', () => {
    expect(evalFormula('=XMATCH(5,A1:A4)', data)).toBe(3);
    expect(evalFormula('=XMATCH("BANANA",B1:B4)', data)).toBe(2);
    expect(errorType(evalFormula('=XMATCH(4,A1:A4)', data))).toBe('#N/A');
  });

  it('match_mode -1 and 1 find the next smaller / larger item', () => {
    expect(evalFormula('=XMATCH(4,A1:A4,-1)', data)).toBe(2);
    expect(evalFormula('=XMATCH(4,A1:A4,1)', data)).toBe(3);
    expect(errorType(evalFormula('=XMATCH(8,A1:A4,1)', data))).toBe('#N/A');
    expect(errorType(evalFormula('=XMATCH(0,A1:A4,-1)', data))).toBe('#N/A');
  });

  it('next smaller/larger does not require sorted data', () => {
    expect(evalFormula('=XMATCH(4,A1:A3,-1)', columnA(5, 1, 3))).toBe(3);
    expect(evalFormula('=XMATCH(2,A1:A3,1)', columnA(5, 1, 3))).toBe(3);
  });

  it('match_mode 2 uses wildcards; other modes treat * literally', () => {
    expect(evalFormula('=XMATCH("ch*",B1:B4,2)', data)).toBe(3);
    expect(evalFormula('=XMATCH("?pple",B1:B4,2)', data)).toBe(1);
    expect(errorType(evalFormula('=XMATCH("ch*",B1:B4)', data))).toBe('#N/A');
  });

  it('search_mode -1 searches from the end', () => {
    expect(evalFormula('=XMATCH("banana",B1:B4,0,-1)', data)).toBe(4);
    expect(evalFormula('=XMATCH("banana",B1:B4,0,2)', data)).toBe(2);
  });

  it('works on a horizontal range', () => {
    expect(evalFormula('=XMATCH(30,A1:C1)', { '0,0': 10, '1,0': 20, '2,0': 30 })).toBe(3);
  });

  it('rejects invalid modes and 2D arrays', () => {
    expect(errorType(evalFormula('=XMATCH(5,A1:A4,3)', data))).toBe('#VALUE!');
    expect(errorType(evalFormula('=XMATCH(5,A1:A4,0,0)', data))).toBe('#VALUE!');
    expect(errorType(evalFormula('=XMATCH(5,A1:B4)', data))).toBe('#VALUE!');
  });
});

describe('WEEKNUM', () => {
  it('defaults to weeks starting Sunday, week 1 holding January 1', () => {
    expect(evalFormula('=WEEKNUM(DATE(2024,1,1))')).toBe(1);
    expect(evalFormula('=WEEKNUM(DATE(2024,1,7))')).toBe(2);
    expect(evalFormula('=WEEKNUM(DATE(2024,12,31))')).toBe(53);
    expect(evalFormula('=WEEKNUM("2023-01-08")')).toBe(2);
  });

  it('return_type picks the first day of the week', () => {
    expect(evalFormula('=WEEKNUM(DATE(2024,1,7),2)')).toBe(1);
    expect(evalFormula('=WEEKNUM(DATE(2024,1,7),11)')).toBe(1);
    expect(evalFormula('=WEEKNUM(DATE(2024,1,7),17)')).toBe(2);
    // Jan 1 2024 is a Monday; with weeks starting Wednesday, Wed Jan 3 starts week 2.
    expect(evalFormula('=WEEKNUM(DATE(2024,1,2),13)')).toBe(1);
    expect(evalFormula('=WEEKNUM(DATE(2024,1,3),13)')).toBe(2);
  });

  it('return_type 21 is the ISO week number', () => {
    expect(evalFormula('=WEEKNUM(DATE(2021,1,1),21)')).toBe(53);
    expect(evalFormula('=WEEKNUM(DATE(2021,1,4),21)')).toBe(1);
  });

  it('rejects an invalid return_type and invalid dates', () => {
    expect(errorType(evalFormula('=WEEKNUM(DATE(2024,1,1),3)'))).toBe('#NUM!');
    expect(errorType(evalFormula('=WEEKNUM("not a date")'))).toBe('#VALUE!');
  });
});

describe('ISERR', () => {
  it('is TRUE for errors other than #N/A', () => {
    expect(evalFormula('=ISERR(1/0)')).toBe(true);
    expect(evalFormula('=ISERR(#VALUE!)')).toBe(true);
    expect(evalFormula('=ISERR(#N/A)')).toBe(false);
    expect(evalFormula('=ISERR(1)')).toBe(false);
    expect(evalFormula('=ISERR("text")')).toBe(false);
  });
});

describe('LOG10 and trigonometry', () => {
  it('LOG10', () => {
    expect(evalFormula('=LOG10(1000)')).toBe(3);
    expect(evalFormula('=LOG10(0.01)')).toBe(-2);
    expect(errorType(evalFormula('=LOG10(0)'))).toBe('#NUM!');
    expect(errorType(evalFormula('=LOG10("x")'))).toBe('#VALUE!');
  });

  it('SIN, COS, TAN', () => {
    expect(evalFormula('=SIN(PI()/2)')).toBe(1);
    expect(evalFormula('=COS(0)')).toBe(1);
    expect(evalFormula('=TAN(PI()/4)') as number).toBeCloseTo(1, 12);
    expect(evalFormula('=SIN(A1)', columnA(null))).toBe(0);
    expect(errorType(evalFormula('=SIN(2^27)'))).toBe('#NUM!');
    expect(errorType(evalFormula('=COS("x")'))).toBe('#VALUE!');
  });

  it('ASIN, ACOS, ATAN with domain errors', () => {
    expect(evalFormula('=ASIN(1)')).toBe(Math.PI / 2);
    expect(evalFormula('=ACOS(-1)')).toBe(Math.PI);
    expect(evalFormula('=ATAN(1)')).toBe(Math.PI / 4);
    expect(errorType(evalFormula('=ASIN(2)'))).toBe('#NUM!');
    expect(errorType(evalFormula('=ACOS(-1.5)'))).toBe('#NUM!');
  });

  it('ATAN2 takes x first', () => {
    expect(evalFormula('=ATAN2(1,1)')).toBe(Math.PI / 4);
    expect(evalFormula('=ATAN2(-1,0)')).toBe(Math.PI);
    expect(evalFormula('=ATAN2(0,1)')).toBe(Math.PI / 2);
    expect(errorType(evalFormula('=ATAN2(0,0)'))).toBe('#DIV/0!');
  });

  it('RADIANS and DEGREES', () => {
    expect(evalFormula('=RADIANS(180)')).toBe(Math.PI);
    expect(evalFormula('=DEGREES(PI())')).toBe(180);
    expect(evalFormula('=DEGREES(RADIANS(45))') as number).toBeCloseTo(45, 12);
  });
});

describe('SUMSQ', () => {
  it('sums squares of direct arguments, coercing TRUE and numeric text', () => {
    expect(evalFormula('=SUMSQ(3,4)')).toBe(25);
    expect(evalFormula('=SUMSQ("2",TRUE)')).toBe(5);
    expect(errorType(evalFormula('=SUMSQ("x")'))).toBe('#VALUE!');
  });

  it('reads only numbers from references and propagates errors', () => {
    expect(evalFormula('=SUMSQ(A1:A4)', columnA(1, 'x', true, 3))).toBe(10);
    expect(evalFormula('=SUMSQ(A1)', columnA('5'))).toBe(0);
    expect(errorType(evalFormula('=SUMSQ(A1:A2)', columnA(1, new FormulaError('#NUM!'))))).toBe('#NUM!');
  });
});

describe('EVEN / ODD', () => {
  it('EVEN rounds away from zero to an even integer', () => {
    expect(evalFormula('=EVEN(1.5)')).toBe(2);
    expect(evalFormula('=EVEN(3)')).toBe(4);
    expect(evalFormula('=EVEN(2)')).toBe(2);
    expect(evalFormula('=EVEN(-1)')).toBe(-2);
    expect(evalFormula('=EVEN(0)')).toBe(0);
  });

  it('ODD rounds away from zero to an odd integer', () => {
    expect(evalFormula('=ODD(1.5)')).toBe(3);
    expect(evalFormula('=ODD(3)')).toBe(3);
    expect(evalFormula('=ODD(2)')).toBe(3);
    expect(evalFormula('=ODD(-1)')).toBe(-1);
    expect(evalFormula('=ODD(-2.5)')).toBe(-3);
    expect(evalFormula('=ODD(0)')).toBe(1);
  });

  it('rejects non-numeric text', () => {
    expect(errorType(evalFormula('=EVEN("x")'))).toBe('#VALUE!');
    expect(errorType(evalFormula('=ODD("x")'))).toBe('#VALUE!');
  });
});

describe('CEILING.MATH / FLOOR.MATH', () => {
  it('CEILING.MATH', () => {
    expect(evalFormula('=CEILING.MATH(4.3)')).toBe(5);
    expect(evalFormula('=CEILING.MATH(24.3,5)')).toBe(25);
    expect(evalFormula('=CEILING.MATH(6.7,-2)')).toBe(8);
    expect(evalFormula('=CEILING.MATH(-4.3)')).toBe(-4);
    expect(evalFormula('=CEILING.MATH(-4.3,1,1)')).toBe(-5);
    expect(evalFormula('=CEILING.MATH(-0.5)')).toBe(0);
    expect(evalFormula('=CEILING.MATH(5,0)')).toBe(0);
  });

  it('FLOOR.MATH', () => {
    expect(evalFormula('=FLOOR.MATH(4.7)')).toBe(4);
    expect(evalFormula('=FLOOR.MATH(24.3,5)')).toBe(20);
    expect(evalFormula('=FLOOR.MATH(-4.3)')).toBe(-5);
    expect(evalFormula('=FLOOR.MATH(-4.3,1,1)')).toBe(-4);
    expect(evalFormula('=FLOOR.MATH(0.3,0.1)')).toBe(0.3);
  });

  it('rejects non-numeric arguments', () => {
    expect(errorType(evalFormula('=CEILING.MATH("x")'))).toBe('#VALUE!');
    expect(errorType(evalFormula('=FLOOR.MATH(1,"x")'))).toBe('#VALUE!');
  });
});

describe('NETWORKDAYS.INTL', () => {
  it('defaults to a Saturday/Sunday weekend like NETWORKDAYS', () => {
    expect(evalFormula('=NETWORKDAYS.INTL(DATE(2024,1,1),DATE(2024,1,31))')).toBe(23);
    expect(evalFormula('=NETWORKDAYS.INTL(DATE(2024,1,31),DATE(2024,1,1))')).toBe(-23);
  });

  it('accepts weekend codes and Mon-Sun masks', () => {
    expect(evalFormula('=NETWORKDAYS.INTL(DATE(2024,1,1),DATE(2024,1,31),11)')).toBe(27);
    expect(evalFormula('=NETWORKDAYS.INTL(DATE(2024,1,1),DATE(2024,1,31),7)')).toBe(23);
    expect(evalFormula('=NETWORKDAYS.INTL(DATE(2024,1,1),DATE(2024,1,7),"1010100")')).toBe(4);
    expect(evalFormula('=NETWORKDAYS.INTL(DATE(2024,1,1),DATE(2024,1,7),"1111111")')).toBe(0);
  });

  it('subtracts holidays that fall on working days', () => {
    const holidays = columnA('2024-01-01', '2024-01-06');
    expect(evalFormula('=NETWORKDAYS.INTL(DATE(2024,1,1),DATE(2024,1,31),1,A1:A2)', holidays)).toBe(22);
  });

  it('rejects invalid weekend arguments', () => {
    expect(errorType(evalFormula('=NETWORKDAYS.INTL(DATE(2024,1,1),DATE(2024,1,31),99)'))).toBe('#NUM!');
    expect(errorType(evalFormula('=NETWORKDAYS.INTL(DATE(2024,1,1),DATE(2024,1,31),"0011")'))).toBe('#VALUE!');
    expect(errorType(evalFormula('=NETWORKDAYS.INTL("x",DATE(2024,1,31))'))).toBe('#VALUE!');
  });
});

describe('TEXTSPLIT', () => {
  it('displays the first element at the spill anchor', () => {
    expect(evalFormula('=TEXTSPLIT("a,b,c",",")')).toBe('a');
    expect(evalFormula('=TEXTSPLIT("x;y,z",",",";")')).toBe('x');
    expect(evalFormula('=TEXTSPLIT("abc",",")')).toBe('abc');
  });

  it('ignore_empty skips leading empty parts', () => {
    expect(evalFormula('=TEXTSPLIT(",b",",",";",FALSE)')).toBe('');
    expect(evalFormula('=TEXTSPLIT(",b",",",";",TRUE)')).toBe('b');
    expect(evalFormula('=TEXTSPLIT(";x,y",",",";",TRUE)')).toBe('x');
    expect(errorType(evalFormula('=TEXTSPLIT(",,",",",";",TRUE)'))).toBe('#CALC!');
  });

  it('match_mode 1 matches delimiters case-insensitively', () => {
    expect(evalFormula('=TEXTSPLIT("aXb","x")')).toBe('aXb');
    expect(evalFormula('=TEXTSPLIT("aXb","x",";",FALSE,1)')).toBe('a');
  });

  it('rejects an empty delimiter and propagates errors', () => {
    expect(errorType(evalFormula('=TEXTSPLIT("abc","")'))).toBe('#VALUE!');
    expect(errorType(evalFormula('=TEXTSPLIT(1/0,",")'))).toBe('#DIV/0!');
  });
});

describe('TEXTBEFORE / TEXTAFTER', () => {
  it('splits at the nth delimiter', () => {
    expect(evalFormula('=TEXTBEFORE("Red riding hood"," ")')).toBe('Red');
    expect(evalFormula('=TEXTBEFORE("a-b-c","-",2)')).toBe('a-b');
    expect(evalFormula('=TEXTAFTER("a-b-c","-")')).toBe('b-c');
    expect(evalFormula('=TEXTAFTER("a-b-c","-",2)')).toBe('c');
  });

  it('negative instance_num counts from the end', () => {
    expect(evalFormula('=TEXTBEFORE("a-b-c","-",-1)')).toBe('a-b');
    expect(evalFormula('=TEXTAFTER("a-b-c","-",-1)')).toBe('c');
    expect(evalFormula('=TEXTAFTER("a-b-c","-",-2)')).toBe('b-c');
  });

  it('returns #N/A or if_not_found when the delimiter is missing', () => {
    expect(errorType(evalFormula('=TEXTBEFORE("abc","-")'))).toBe('#N/A');
    expect(errorType(evalFormula('=TEXTAFTER("a-b","-",3)'))).toBe('#N/A');
    expect(evalFormula('=TEXTAFTER("abc","-",1,0,0,"none")')).toBe('none');
  });

  it('match_mode 1 is case-insensitive', () => {
    expect(errorType(evalFormula('=TEXTAFTER("aXb","x")'))).toBe('#N/A');
    expect(evalFormula('=TEXTAFTER("aXb","x",1,1)')).toBe('b');
  });

  it('match_end treats the end (or start) of the text as a delimiter', () => {
    expect(evalFormula('=TEXTBEFORE("abc","-",1,0,1)')).toBe('abc');
    expect(evalFormula('=TEXTAFTER("abc","-",-1,0,1)')).toBe('abc');
    expect(evalFormula('=TEXTBEFORE("a-b","-",2,0,1)')).toBe('a-b');
  });

  it('an empty delimiter matches at the start (or end for negative instances)', () => {
    expect(evalFormula('=TEXTBEFORE("abc","")')).toBe('');
    expect(evalFormula('=TEXTAFTER("abc","")')).toBe('abc');
    expect(evalFormula('=TEXTBEFORE("abc","",-1)')).toBe('abc');
    expect(evalFormula('=TEXTAFTER("abc","",-1)')).toBe('');
  });

  it('rejects instance_num 0 or longer than the text', () => {
    expect(errorType(evalFormula('=TEXTBEFORE("a-b","-",0)'))).toBe('#VALUE!');
    expect(errorType(evalFormula('=TEXTAFTER("a-b","-",4)'))).toBe('#VALUE!');
    expect(errorType(evalFormula('=TEXTAFTER("a-b","-",1,2)'))).toBe('#VALUE!');
  });
});

describe('LET', () => {
  it('binds names for the calculation', () => {
    expect(evalFormula('=LET(x,2,x*3)')).toBe(6);
    expect(evalFormula('=LET(x,2,y,x+1,x*y)')).toBe(6);
    expect(evalFormula('=let(Rate,0.5,RATE*10)')).toBe(5);
  });

  it('binds references, so range functions still see a range', () => {
    const data = columnA(1, 2, 3);
    expect(evalFormula('=LET(r,A1:A3,SUM(r)+COUNT(r))', data)).toBe(9);
    expect(evalFormula('=LET(c,A2,c*10)', data)).toBe(20);
  });

  it('recalculates when a referenced cell changes', () => {
    const data: Record<string, unknown> = columnA(1, 2, 3);
    const accessor = createAccessor(data);
    const engine = new FormulaEngine();
    engine.setFormula(1, 0, '=LET(r,A1:A3,SUM(r))', accessor);
    expect(engine.getValue(1, 0)).toBe(6);
    data['0,0'] = 10;
    engine.onCellChanged(0, 0, accessor);
    expect(engine.getValue(1, 0)).toBe(15);
  });

  it('nested LETs shadow outer names, and a value sees the outer binding', () => {
    expect(evalFormula('=LET(x,1,LET(x,x+1,x*10))')).toBe(20);
    expect(evalFormula('=LET(x,1,LET(y,2,x+y))')).toBe(3);
    expect(evalFormula('=LET(x,1,LET(x,5,x)+x)')).toBe(6);
  });

  it('LET names shadow named ranges', () => {
    const value = evalFormula('=LET(total,7,total)', columnA(100), { namedRanges: { total: 'A1' } });
    expect(value).toBe(7);
    expect(evalFormula('=total+1', columnA(100), { namedRanges: { total: 'A1' } })).toBe(101);
  });

  it('an error bound to an unused name does not surface', () => {
    expect(evalFormula('=LET(x,1/0,5)')).toBe(5);
    expect(errorType(evalFormula('=LET(x,1/0,x+1)'))).toBe('#DIV/0!');
  });

  it('a name is not visible in its own value or outside the LET', () => {
    expect(errorType(evalFormula('=LET(x,x+1,x)'))).toBe('#NAME?');
    expect(errorType(evalFormula('=LET(x,1,x)+x'))).toBe('#NAME?');
  });

  it('rejects malformed calls', () => {
    expect(errorType(evalFormula('=LET(x,1)'))).toBe('#VALUE!');
    expect(evalFormula('=LET(x,1,y,2)')).toBeInstanceOf(FormulaError);
    expect(evalFormula('=LET(1,2,3)')).toBeInstanceOf(FormulaError);
  });
});
