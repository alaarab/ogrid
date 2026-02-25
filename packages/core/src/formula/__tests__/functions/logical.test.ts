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

describe('Logical functions', () => {
  // --- IF ---
  describe('IF', () => {
    it('should return the true branch when condition is true', () => {
      expect(evalFormula('=IF(TRUE,"yes","no")')).toBe('yes');
    });

    it('should return the false branch when condition is false', () => {
      expect(evalFormula('=IF(FALSE,"yes","no")')).toBe('no');
    });

    it('should return false when no else argument is provided and condition is false', () => {
      expect(evalFormula('=IF(FALSE,"yes")')).toBe(false);
    });

    it('should handle nested IF expressions', () => {
      expect(evalFormula('=IF(FALSE,"a",IF(TRUE,"b","c"))')).toBe('b');
    });

    it('should propagate errors from the condition', () => {
      const data = { '0,0': 0 };
      const engine = new FormulaEngine();
      const accessor = createAccessor(data);
      // Create a cell with an error, then use it as the IF condition
      engine.setFormula(0, 1, '=1/0', accessor);
      engine.setFormula(1, 0, '=IF(A2,"yes","no")', accessor);
      const result = engine.getValue(1, 0);
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#DIV/0!');
    });

    it('should evaluate numeric conditions (non-zero = true)', () => {
      expect(evalFormula('=IF(1,"yes","no")')).toBe('yes');
      expect(evalFormula('=IF(0,"yes","no")')).toBe('no');
    });
  });

  // --- AND ---
  describe('AND', () => {
    it('should return true when all arguments are truthy', () => {
      expect(evalFormula('=AND(TRUE,TRUE,TRUE)')).toBe(true);
    });

    it('should return false when one argument is falsy', () => {
      expect(evalFormula('=AND(TRUE,FALSE,TRUE)')).toBe(false);
    });

    it('should propagate errors', () => {
      const engine = new FormulaEngine();
      const accessor = createAccessor({});
      engine.setFormula(0, 0, '=1/0', accessor);
      engine.setFormula(1, 0, '=AND(TRUE,A1)', accessor);
      const result = engine.getValue(1, 0);
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#DIV/0!');
    });
  });

  // --- OR ---
  describe('OR', () => {
    it('should return false when all arguments are falsy', () => {
      expect(evalFormula('=OR(FALSE,FALSE,FALSE)')).toBe(false);
    });

    it('should return true when at least one argument is truthy', () => {
      expect(evalFormula('=OR(FALSE,TRUE,FALSE)')).toBe(true);
    });

    it('should propagate errors', () => {
      const engine = new FormulaEngine();
      const accessor = createAccessor({});
      engine.setFormula(0, 0, '=1/0', accessor);
      engine.setFormula(1, 0, '=OR(FALSE,A1)', accessor);
      const result = engine.getValue(1, 0);
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#DIV/0!');
    });
  });

  // --- NOT ---
  describe('NOT', () => {
    it('should return false for a truthy value', () => {
      expect(evalFormula('=NOT(TRUE)')).toBe(false);
    });

    it('should return true for a falsy value', () => {
      expect(evalFormula('=NOT(FALSE)')).toBe(true);
    });

    it('should propagate errors', () => {
      const engine = new FormulaEngine();
      const accessor = createAccessor({});
      engine.setFormula(0, 0, '=1/0', accessor);
      engine.setFormula(1, 0, '=NOT(A1)', accessor);
      const result = engine.getValue(1, 0);
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#DIV/0!');
    });
  });

  // --- IFERROR ---
  describe('IFERROR', () => {
    it('should return the value when there is no error', () => {
      expect(evalFormula('=IFERROR(42,"fallback")')).toBe(42);
    });

    it('should return the fallback when there is an error', () => {
      expect(evalFormula('=IFERROR(1/0,"fallback")')).toBe('fallback');
    });
  });
});
