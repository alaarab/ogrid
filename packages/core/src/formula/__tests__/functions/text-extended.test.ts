import { FormulaEngine } from '../../formulaEngine';
import type { IGridDataAccessor } from '../../types';
import { FormulaError } from '../../types';

function createAccessor(data: Record<string, unknown> = {}): IGridDataAccessor {
  return {
    getCellValue: (col: number, row: number) => data[`${col},${row}`] ?? null,
    getRowCount: () => 100,
    getColumnCount: () => 26,
  };
}

function evalFormula(formula: string, data: Record<string, unknown> = {}): unknown {
  const engine = new FormulaEngine();
  const accessor = createAccessor(data);
  engine.setFormula(0, 0, formula, accessor);
  return engine.getValue(0, 0);
}

describe('Text extended functions', () => {
  // --- DOLLAR ---
  describe('DOLLAR', () => {
    it('should format positive number with 2 decimals by default', () => {
      expect(evalFormula('=DOLLAR(1234.567)')).toBe('$1,234.57');
    });

    it('should format with 0 decimals', () => {
      expect(evalFormula('=DOLLAR(1234.5, 0)')).toBe('$1,235');
    });

    it('should format negative number with parentheses', () => {
      expect(evalFormula('=DOLLAR(-1234.5, 2)')).toBe('($1,234.50)');
    });

    it('should add thousands separators', () => {
      expect(evalFormula('=DOLLAR(1000000, 2)')).toBe('$1,000,000.00');
    });

    it('should handle zero', () => {
      expect(evalFormula('=DOLLAR(0)')).toBe('$0.00');
    });

    it('should handle negative decimals (round to nearest 100)', () => {
      const result = evalFormula('=DOLLAR(1234, -2)');
      expect(result).toBe('$1,200');
    });
  });

  // --- FIXED ---
  describe('FIXED', () => {
    it('should format with 2 decimals and commas by default', () => {
      expect(evalFormula('=FIXED(1234.567)')).toBe('1,234.57');
    });

    it('should format with 0 decimals', () => {
      expect(evalFormula('=FIXED(1234.5, 0)')).toBe('1,235');
    });

    it('should format without commas when third arg is true', () => {
      expect(evalFormula('=FIXED(1234.567, 2, TRUE)')).toBe('1234.57');
    });

    it('should format negative number with minus sign', () => {
      expect(evalFormula('=FIXED(-1234.5, 2)')).toBe('-1,234.50');
    });

    it('should handle negative decimals', () => {
      const result = evalFormula('=FIXED(1234, -2)');
      expect(result).toBe('1,200');
    });

    it('should handle zero', () => {
      expect(evalFormula('=FIXED(0, 2)')).toBe('0.00');
    });
  });

  // --- T ---
  describe('T', () => {
    it('should return the string if value is a string', () => {
      const data = { '0,0': 'hello' };
      const engine = new FormulaEngine();
      const accessor = createAccessor(data);
      engine.setFormula(1, 0, '=T(A1)', accessor);
      expect(engine.getValue(1, 0)).toBe('hello');
    });

    it('should return empty string for a number', () => {
      expect(evalFormula('=T(42)')).toBe('');
    });

    it('should return empty string for boolean', () => {
      expect(evalFormula('=T(TRUE)')).toBe('');
    });

    it('should return empty string for null', () => {
      const data = { '0,0': null };
      const engine = new FormulaEngine();
      const accessor = createAccessor(data);
      engine.setFormula(1, 0, '=T(A1)', accessor);
      expect(engine.getValue(1, 0)).toBe('');
    });

    it('should pass through string literal', () => {
      expect(evalFormula('=T("world")')).toBe('world');
    });
  });

  // --- N ---
  describe('N', () => {
    it('should return the number as-is', () => {
      expect(evalFormula('=N(42)')).toBe(42);
    });

    it('should return 1 for TRUE', () => {
      expect(evalFormula('=N(TRUE)')).toBe(1);
    });

    it('should return 0 for FALSE', () => {
      expect(evalFormula('=N(FALSE)')).toBe(0);
    });

    it('should return 0 for a string', () => {
      expect(evalFormula('=N("hello")')).toBe(0);
    });

    it('should return 0 for empty/null', () => {
      const data = { '0,0': null };
      const engine = new FormulaEngine();
      const accessor = createAccessor(data);
      engine.setFormula(1, 0, '=N(A1)', accessor);
      expect(engine.getValue(1, 0)).toBe(0);
    });
  });

  // --- FORMULATEXT ---
  describe('FORMULATEXT', () => {
    it('should return the formula string for a formula cell', () => {
      const engine = new FormulaEngine();
      const accessor = createAccessor();
      engine.setFormula(0, 0, '=SUM(1,2)', accessor);
      engine.setFormula(1, 0, '=FORMULATEXT(A1)', accessor);
      const result = engine.getValue(1, 0);
      expect(result).toBe('=SUM(1,2)');
    });

    it('should return #N/A if cell is not a formula cell', () => {
      const engine = new FormulaEngine();
      const accessor = createAccessor({ '0,0': 42 });
      engine.setFormula(1, 0, '=FORMULATEXT(A1)', accessor);
      const result = engine.getValue(1, 0);
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#N/A');
    });

    it('should return #N/A if argument is not a cell reference', () => {
      const result = evalFormula('=FORMULATEXT(42)');
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#N/A');
    });
  });

  // --- NUMBERVALUE ---
  describe('NUMBERVALUE', () => {
    it('should parse a plain number string', () => {
      expect(evalFormula('=NUMBERVALUE("1234.56")')).toBe(1234.56);
    });

    it('should use custom decimal separator', () => {
      expect(evalFormula('=NUMBERVALUE("1234,56", ",")')).toBe(1234.56);
    });

    it('should remove group separators', () => {
      expect(evalFormula('=NUMBERVALUE("1.234,56", ",", ".")')).toBe(1234.56);
    });

    it('should handle percent suffix', () => {
      expect(evalFormula('=NUMBERVALUE("12.5%")')).toBeCloseTo(0.125, 5);
    });

    it('should return the number as-is if already a number', () => {
      expect(evalFormula('=NUMBERVALUE(42)')).toBe(42);
    });

    it('should return #VALUE! for non-numeric text', () => {
      const result = evalFormula('=NUMBERVALUE("abc")');
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#VALUE!');
    });

    it('should return #VALUE! if separators are the same', () => {
      const result = evalFormula('=NUMBERVALUE("1.234", ".", ".")');
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#VALUE!');
    });
  });

  // --- PHONETIC ---
  describe('PHONETIC', () => {
    it('should return the text as-is (stub)', () => {
      expect(evalFormula('=PHONETIC("hello")')).toBe('hello');
    });

    it('should convert non-string values to string', () => {
      expect(evalFormula('=PHONETIC(42)')).toBe('42');
    });
  });
});

describe('Info extended functions', () => {
  // --- ISODD ---
  describe('ISODD', () => {
    it('should return TRUE for odd number', () => {
      expect(evalFormula('=ISODD(3)')).toBe(true);
    });

    it('should return FALSE for even number', () => {
      expect(evalFormula('=ISODD(4)')).toBe(false);
    });

    it('should return TRUE for negative odd', () => {
      expect(evalFormula('=ISODD(-3)')).toBe(true);
    });

    it('should return FALSE for negative even', () => {
      expect(evalFormula('=ISODD(-4)')).toBe(false);
    });

    it('should truncate decimal before checking', () => {
      expect(evalFormula('=ISODD(3.9)')).toBe(true); // trunc(3.9)=3 → odd
    });

    it('should return #VALUE! for boolean', () => {
      const result = evalFormula('=ISODD(TRUE)');
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#VALUE!');
    });
  });

  // --- ISEVEN ---
  describe('ISEVEN', () => {
    it('should return TRUE for even number', () => {
      expect(evalFormula('=ISEVEN(4)')).toBe(true);
    });

    it('should return FALSE for odd number', () => {
      expect(evalFormula('=ISEVEN(3)')).toBe(false);
    });

    it('should return TRUE for 0', () => {
      expect(evalFormula('=ISEVEN(0)')).toBe(true);
    });

    it('should truncate decimal before checking', () => {
      expect(evalFormula('=ISEVEN(4.9)')).toBe(true); // trunc(4.9)=4 → even
    });

    it('should return #VALUE! for boolean', () => {
      const result = evalFormula('=ISEVEN(TRUE)');
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#VALUE!');
    });
  });

  // --- ISFORMULA ---
  describe('ISFORMULA', () => {
    it('should return TRUE for a cell with a formula', () => {
      const engine = new FormulaEngine();
      const accessor = createAccessor();
      engine.setFormula(0, 0, '=1+2', accessor);
      engine.setFormula(1, 0, '=ISFORMULA(A1)', accessor);
      expect(engine.getValue(1, 0)).toBe(true);
    });

    it('should return FALSE for a cell without a formula', () => {
      const engine = new FormulaEngine();
      const accessor = createAccessor({ '0,0': 42 });
      engine.setFormula(1, 0, '=ISFORMULA(A1)', accessor);
      expect(engine.getValue(1, 0)).toBe(false);
    });

    it('should return FALSE for a non-cell-ref argument', () => {
      expect(evalFormula('=ISFORMULA(42)')).toBe(false);
    });
  });

  // --- ISLOGICAL ---
  describe('ISLOGICAL', () => {
    it('should return TRUE for TRUE literal', () => {
      expect(evalFormula('=ISLOGICAL(TRUE)')).toBe(true);
    });

    it('should return TRUE for FALSE literal', () => {
      expect(evalFormula('=ISLOGICAL(FALSE)')).toBe(true);
    });

    it('should return FALSE for number', () => {
      expect(evalFormula('=ISLOGICAL(1)')).toBe(false);
    });

    it('should return FALSE for string', () => {
      expect(evalFormula('=ISLOGICAL("TRUE")')).toBe(false);
    });

    it('should return FALSE for error', () => {
      const data = { '0,0': new FormulaError('#VALUE!') };
      const engine = new FormulaEngine();
      const accessor = createAccessor(data);
      engine.setFormula(1, 0, '=ISLOGICAL(A1)', accessor);
      expect(engine.getValue(1, 0)).toBe(false);
    });
  });

  // --- ISNONTEXT ---
  describe('ISNONTEXT', () => {
    it('should return FALSE for string', () => {
      expect(evalFormula('=ISNONTEXT("hello")')).toBe(false);
    });

    it('should return TRUE for number', () => {
      expect(evalFormula('=ISNONTEXT(42)')).toBe(true);
    });

    it('should return TRUE for boolean', () => {
      expect(evalFormula('=ISNONTEXT(TRUE)')).toBe(true);
    });

    it('should return TRUE for error', () => {
      // errors count as non-text
      const data = { '0,0': new FormulaError('#VALUE!') };
      const engine = new FormulaEngine();
      const accessor = createAccessor(data);
      engine.setFormula(1, 0, '=ISNONTEXT(A1)', accessor);
      expect(engine.getValue(1, 0)).toBe(true);
    });

    it('should return TRUE for null/empty cell', () => {
      const data = { '0,0': null };
      const engine = new FormulaEngine();
      const accessor = createAccessor(data);
      engine.setFormula(1, 0, '=ISNONTEXT(A1)', accessor);
      expect(engine.getValue(1, 0)).toBe(true);
    });
  });

  // --- ISREF ---
  describe('ISREF', () => {
    it('should return TRUE for a cell reference', () => {
      const engine = new FormulaEngine();
      const accessor = createAccessor({ '0,0': 42 });
      engine.setFormula(1, 0, '=ISREF(A1)', accessor);
      expect(engine.getValue(1, 0)).toBe(true);
    });

    it('should return TRUE for a range reference', () => {
      const engine = new FormulaEngine();
      const accessor = createAccessor();
      // Put formula in row 5 so A1:B2 range does not include the formula cell
      engine.setFormula(0, 5, '=ISREF(A1:B2)', accessor);
      expect(engine.getValue(0, 5)).toBe(true);
    });

    it('should return FALSE for a number literal', () => {
      expect(evalFormula('=ISREF(42)')).toBe(false);
    });

    it('should return FALSE for a string literal', () => {
      expect(evalFormula('=ISREF("A1")')).toBe(false);
    });
  });
});
