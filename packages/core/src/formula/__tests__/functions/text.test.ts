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

describe('Text functions', () => {
  // --- CONCATENATE ---
  describe('CONCATENATE', () => {
    it('should concatenate multiple strings', () => {
      expect(evalFormula('=CONCATENATE("Hello"," ","World")')).toBe('Hello World');
    });

    it('should convert numbers to strings when concatenating', () => {
      expect(evalFormula('=CONCATENATE("Value: ",42)')).toBe('Value: 42');
    });

    it('should concatenate values from a range', () => {
      const data = { '0,0': 'A', '0,1': 'B', '0,2': 'C' };
      const engine = new FormulaEngine();
      const accessor = createAccessor(data);
      engine.setFormula(1, 0, '=CONCATENATE(A1:A3)', accessor);
      expect(engine.getValue(1, 0)).toBe('ABC');
    });
  });

  // --- CONCAT ---
  describe('CONCAT', () => {
    it('should work the same as CONCATENATE (alias)', () => {
      expect(evalFormula('=CONCAT("Hello"," ","World")')).toBe('Hello World');
    });

    it('should convert numbers to strings', () => {
      expect(evalFormula('=CONCAT("Count: ",3)')).toBe('Count: 3');
    });
  });

  // --- UPPER ---
  describe('UPPER', () => {
    it('should convert text to uppercase', () => {
      expect(evalFormula('=UPPER("hello")')).toBe('HELLO');
    });

    it('should handle mixed case', () => {
      expect(evalFormula('=UPPER("Hello World")')).toBe('HELLO WORLD');
    });
  });

  // --- LOWER ---
  describe('LOWER', () => {
    it('should convert text to lowercase', () => {
      expect(evalFormula('=LOWER("HELLO")')).toBe('hello');
    });

    it('should handle mixed case', () => {
      expect(evalFormula('=LOWER("Hello World")')).toBe('hello world');
    });
  });

  // --- TRIM ---
  describe('TRIM', () => {
    it('should remove leading and trailing spaces', () => {
      expect(evalFormula('=TRIM("  hello  ")')).toBe('hello');
    });

    it('should return unchanged text when no extra spaces', () => {
      expect(evalFormula('=TRIM("hello")')).toBe('hello');
    });

    it('should collapse runs of internal spaces to a single space', () => {
      expect(evalFormula('=TRIM("a   b")')).toBe('a b');
      expect(evalFormula('=TRIM("  hello   world  ")')).toBe('hello world');
    });
  });

  // --- LEFT ---
  describe('LEFT', () => {
    it('should return the first character by default', () => {
      expect(evalFormula('=LEFT("Hello")')).toBe('H');
    });

    it('should return the specified number of characters', () => {
      expect(evalFormula('=LEFT("Hello",3)')).toBe('Hel');
    });

    it('should return #VALUE! for negative num_chars', () => {
      const result = evalFormula('=LEFT("Hello",-1)');
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#VALUE!');
    });
  });

  // --- RIGHT ---
  describe('RIGHT', () => {
    it('should return the last character by default', () => {
      expect(evalFormula('=RIGHT("Hello")')).toBe('o');
    });

    it('should return the specified number of characters from the right', () => {
      expect(evalFormula('=RIGHT("Hello",3)')).toBe('llo');
    });

    it('should return #VALUE! for negative num_chars', () => {
      const result = evalFormula('=RIGHT("Hello",-1)');
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#VALUE!');
    });
  });

  // --- MID ---
  describe('MID', () => {
    it('should extract a substring from the middle', () => {
      expect(evalFormula('=MID("Hello World",7,5)')).toBe('World');
    });

    it('should return #VALUE! when start_num is less than 1', () => {
      const result = evalFormula('=MID("Hello",0,3)');
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#VALUE!');
    });

    it('should return #VALUE! when num_chars is negative', () => {
      const result = evalFormula('=MID("Hello",1,-1)');
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#VALUE!');
    });

    it('should handle extracting from position 1', () => {
      expect(evalFormula('=MID("Hello",1,3)')).toBe('Hel');
    });
  });

  // --- LEN ---
  describe('LEN', () => {
    it('should return the length of a string', () => {
      expect(evalFormula('=LEN("Hello")')).toBe(5);
    });

    it('should return 0 for an empty string', () => {
      expect(evalFormula('=LEN("")')).toBe(0);
    });
  });

  // --- SUBSTITUTE ---
  describe('SUBSTITUTE', () => {
    it('should replace all occurrences by default', () => {
      expect(evalFormula('=SUBSTITUTE("banana","a","o")')).toBe('bonono');
    });

    it('should replace only the nth occurrence when instance_num is specified', () => {
      expect(evalFormula('=SUBSTITUTE("banana","a","o",2)')).toBe('banona');
    });

    it('should return original text when old_text is empty', () => {
      expect(evalFormula('=SUBSTITUTE("hello","","x")')).toBe('hello');
    });

    it('should replace at the first occurrence', () => {
      expect(evalFormula('=SUBSTITUTE("banana","a","o",1)')).toBe('bonana');
    });
  });
});
