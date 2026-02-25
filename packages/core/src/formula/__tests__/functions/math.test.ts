import { FormulaEngine } from '../../formulaEngine';
import type { IGridDataAccessor } from '../../types';
import { FormulaError } from '../../types';

// Helper to create a simple grid accessor with cell values
function createAccessor(data: Record<string, unknown> = {}): IGridDataAccessor {
  return {
    getCellValue: (col: number, row: number) => data[`${col},${row}`] ?? null,
    getRowCount: () => 100,
    getColumnCount: () => 26,
  };
}

// Helper to set a formula and get the computed value
function evalFormula(formula: string, data: Record<string, unknown> = {}): unknown {
  const engine = new FormulaEngine();
  const accessor = createAccessor(data);
  engine.setFormula(0, 0, formula, accessor);
  return engine.getValue(0, 0);
}

describe('Math functions', () => {
  // --- SUM ---
  describe('SUM', () => {
    it('should sum a single value', () => {
      expect(evalFormula('=SUM(5)')).toBe(5);
    });

    it('should sum multiple values', () => {
      expect(evalFormula('=SUM(1,2,3)')).toBe(6);
    });

    it('should sum a range of cells', () => {
      const data = { '0,0': 10, '0,1': 20, '0,2': 30 };
      // Formula is placed at 0,0 but references A1:A3 which is col 0 rows 0-2
      // We need to place the formula in a different cell to avoid self-reference
      const engine = new FormulaEngine();
      const accessor = createAccessor(data);
      engine.setFormula(1, 0, '=SUM(A1:A3)', accessor);
      expect(engine.getValue(1, 0)).toBe(60);
    });

    it('should ignore strings in a range', () => {
      expect(evalFormula('=SUM(1,"hello",3)')).toBe(4);
    });

    it('should treat booleans as 1/0', () => {
      expect(evalFormula('=SUM(1,TRUE,FALSE)')).toBe(2);
    });

    it('should treat empty/null cells as 0', () => {
      const data = { '0,0': 10 }; // A2 and A3 are null
      const engine = new FormulaEngine();
      const accessor = createAccessor(data);
      engine.setFormula(1, 0, '=SUM(A1:A3)', accessor);
      expect(engine.getValue(1, 0)).toBe(10);
    });

    it('should propagate errors', () => {
      const data = { '0,0': 10 };
      const engine = new FormulaEngine();
      const accessor = createAccessor(data);
      // Set a formula that produces an error in a cell, then SUM over it
      engine.setFormula(0, 1, '=1/0', accessor);
      engine.setFormula(1, 0, '=SUM(A1:A2)', accessor);
      const result = engine.getValue(1, 0);
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#DIV/0!');
    });
  });

  // --- AVERAGE ---
  describe('AVERAGE', () => {
    it('should compute the average of numbers', () => {
      expect(evalFormula('=AVERAGE(10,20,30)')).toBe(20);
    });

    it('should return #DIV/0! when no numeric values exist', () => {
      const result = evalFormula('=AVERAGE("a","b")');
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#DIV/0!');
    });

    it('should treat booleans as 1/0', () => {
      expect(evalFormula('=AVERAGE(TRUE,FALSE)')).toBe(0.5);
    });
  });

  // --- MIN ---
  describe('MIN', () => {
    it('should return the minimum number', () => {
      expect(evalFormula('=MIN(5,3,8,1)')).toBe(1);
    });

    it('should return 0 when no numbers are provided', () => {
      expect(evalFormula('=MIN("a","b")')).toBe(0);
    });

    it('should handle negative numbers', () => {
      expect(evalFormula('=MIN(-5,3,-8,1)')).toBe(-8);
    });
  });

  // --- MAX ---
  describe('MAX', () => {
    it('should return the maximum number', () => {
      expect(evalFormula('=MAX(5,3,8,1)')).toBe(8);
    });

    it('should return 0 when no numbers are provided', () => {
      expect(evalFormula('=MAX("a","b")')).toBe(0);
    });

    it('should handle negative numbers', () => {
      expect(evalFormula('=MAX(-5,-3,-8,-1)')).toBe(-1);
    });
  });

  // --- COUNT ---
  describe('COUNT', () => {
    it('should count only numbers', () => {
      expect(evalFormula('=COUNT(1,2,3)')).toBe(3);
    });

    it('should ignore strings and null values', () => {
      const data = { '0,0': 10, '0,1': 'hello', '0,2': 30 };
      const engine = new FormulaEngine();
      const accessor = createAccessor(data);
      engine.setFormula(1, 0, '=COUNT(A1:A3)', accessor);
      expect(engine.getValue(1, 0)).toBe(2);
    });
  });

  // --- COUNTA ---
  describe('COUNTA', () => {
    it('should count non-empty/non-null values', () => {
      expect(evalFormula('=COUNTA(1,"hello",TRUE)')).toBe(3);
    });

    it('should not count empty strings', () => {
      expect(evalFormula('=COUNTA("",1)')).toBe(1);
    });

    it('should not count null cells', () => {
      const data = { '0,0': 10, '0,2': 30 }; // A2 is null
      const engine = new FormulaEngine();
      const accessor = createAccessor(data);
      engine.setFormula(1, 0, '=COUNTA(A1:A3)', accessor);
      expect(engine.getValue(1, 0)).toBe(2);
    });
  });

  // --- ROUND ---
  describe('ROUND', () => {
    it('should round to 2 decimal places', () => {
      expect(evalFormula('=ROUND(3.14159,2)')).toBe(3.14);
    });

    it('should round to 0 decimal places', () => {
      expect(evalFormula('=ROUND(3.7,0)')).toBe(4);
    });
  });

  // --- ABS ---
  describe('ABS', () => {
    it('should return the absolute value of a positive number', () => {
      expect(evalFormula('=ABS(5)')).toBe(5);
    });

    it('should return the absolute value of a negative number', () => {
      expect(evalFormula('=ABS(-5)')).toBe(5);
    });

    it('should return 0 for zero', () => {
      expect(evalFormula('=ABS(0)')).toBe(0);
    });
  });

  // --- CEILING ---
  describe('CEILING', () => {
    it('should round up to the nearest significance', () => {
      expect(evalFormula('=CEILING(4.2,1)')).toBe(5);
    });

    it('should return 0 when significance is 0', () => {
      expect(evalFormula('=CEILING(4.2,0)')).toBe(0);
    });

    it('should round up to the nearest multiple', () => {
      expect(evalFormula('=CEILING(4.2,5)')).toBe(5);
    });
  });

  // --- FLOOR ---
  describe('FLOOR', () => {
    it('should round down to the nearest significance', () => {
      expect(evalFormula('=FLOOR(4.8,1)')).toBe(4);
    });

    it('should return 0 when significance is 0', () => {
      expect(evalFormula('=FLOOR(4.8,0)')).toBe(0);
    });

    it('should round down to the nearest multiple', () => {
      expect(evalFormula('=FLOOR(14,5)')).toBe(10);
    });
  });

  // --- MOD ---
  describe('MOD', () => {
    it('should return the remainder', () => {
      expect(evalFormula('=MOD(10,3)')).toBe(1);
    });

    it('should return #DIV/0! when divisor is zero', () => {
      const result = evalFormula('=MOD(10,0)');
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#DIV/0!');
    });
  });

  // --- POWER ---
  describe('POWER', () => {
    it('should compute the power', () => {
      expect(evalFormula('=POWER(2,3)')).toBe(8);
    });

    it('should compute the square root using 0.5 exponent', () => {
      expect(evalFormula('=POWER(9,0.5)')).toBe(3);
    });
  });

  // --- SQRT ---
  describe('SQRT', () => {
    it('should compute the square root', () => {
      expect(evalFormula('=SQRT(16)')).toBe(4);
    });

    it('should return #VALUE! for negative numbers', () => {
      const result = evalFormula('=SQRT(-4)');
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#VALUE!');
    });
  });
});
