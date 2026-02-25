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

describe('Date functions', () => {
  // --- TODAY ---
  describe('TODAY', () => {
    it('should return a Date object', () => {
      const result = evalFormula('=TODAY()');
      expect(result).toBeInstanceOf(Date);
    });

    it('should return a date with no time component', () => {
      const result = evalFormula('=TODAY()') as Date;
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });

    it('should return today\'s date', () => {
      const result = evalFormula('=TODAY()') as Date;
      const now = new Date();
      expect(result.getFullYear()).toBe(now.getFullYear());
      expect(result.getMonth()).toBe(now.getMonth());
      expect(result.getDate()).toBe(now.getDate());
    });
  });

  // --- NOW ---
  describe('NOW', () => {
    it('should return a Date object', () => {
      const result = evalFormula('=NOW()');
      expect(result).toBeInstanceOf(Date);
    });

    it('should return a date close to the current time', () => {
      const before = Date.now();
      const result = evalFormula('=NOW()') as Date;
      const after = Date.now();
      expect(result.getTime()).toBeGreaterThanOrEqual(before);
      expect(result.getTime()).toBeLessThanOrEqual(after);
    });
  });

  // --- YEAR ---
  describe('YEAR', () => {
    it('should extract the year from a date string', () => {
      // Use date-time format to avoid UTC-vs-local timezone ambiguity
      const data = { '0,0': '2024-06-15T00:00:00' };
      const engine = new FormulaEngine();
      const accessor = createAccessor(data);
      engine.setFormula(1, 0, '=YEAR(A1)', accessor);
      expect(engine.getValue(1, 0)).toBe(2024);
    });

    it('should return #VALUE! for an invalid date', () => {
      const data = { '0,0': 'not-a-date' };
      const engine = new FormulaEngine();
      const accessor = createAccessor(data);
      engine.setFormula(1, 0, '=YEAR(A1)', accessor);
      const result = engine.getValue(1, 0);
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#VALUE!');
    });
  });

  // --- MONTH ---
  describe('MONTH', () => {
    it('should extract the month (1-12) from a date string', () => {
      // Use date-time format to avoid UTC-vs-local timezone ambiguity
      const data = { '0,0': '2024-06-15T00:00:00' };
      const engine = new FormulaEngine();
      const accessor = createAccessor(data);
      engine.setFormula(1, 0, '=MONTH(A1)', accessor);
      expect(engine.getValue(1, 0)).toBe(6);
    });

    it('should return #VALUE! for an invalid date', () => {
      const data = { '0,0': 'xyz' };
      const engine = new FormulaEngine();
      const accessor = createAccessor(data);
      engine.setFormula(1, 0, '=MONTH(A1)', accessor);
      const result = engine.getValue(1, 0);
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#VALUE!');
    });
  });

  // --- DAY ---
  describe('DAY', () => {
    it('should extract the day (1-31) from a date string', () => {
      // Use date-time format to avoid UTC-vs-local timezone ambiguity
      const data = { '0,0': '2024-06-15T00:00:00' };
      const engine = new FormulaEngine();
      const accessor = createAccessor(data);
      engine.setFormula(1, 0, '=DAY(A1)', accessor);
      expect(engine.getValue(1, 0)).toBe(15);
    });

    it('should return #VALUE! for an invalid date', () => {
      const data = { '0,0': 'abc' };
      const engine = new FormulaEngine();
      const accessor = createAccessor(data);
      engine.setFormula(1, 0, '=DAY(A1)', accessor);
      const result = engine.getValue(1, 0);
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#VALUE!');
    });
  });
});
