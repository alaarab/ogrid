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
// Uses cell D1 (col=3, row=0) to avoid overlap with table data in A1:C3
function evalFormula(formula: string, data: Record<string, unknown> = {}): unknown {
  const engine = new FormulaEngine();
  const accessor = createAccessor(data);
  engine.setFormula(3, 0, formula, accessor);
  return engine.getValue(3, 0);
}

// Table data for lookup tests:
// A1=1, B1="Apple",  C1=10
// A2=2, B2="Banana", C2=20
// A3=3, B3="Cherry", C3=30
const tableData: Record<string, unknown> = {
  '0,0': 1,   '1,0': 'Apple',  '2,0': 10,
  '0,1': 2,   '1,1': 'Banana', '2,1': 20,
  '0,2': 3,   '1,2': 'Cherry', '2,2': 30,
};

describe('Lookup functions', () => {
  // --- VLOOKUP ---
  describe('VLOOKUP', () => {
    it('should find an exact match (FALSE)', () => {
      const result = evalFormula('=VLOOKUP(2,A1:C3,2,FALSE)', tableData);
      expect(result).toBe('Banana');
    });

    it('should return the value from the specified column', () => {
      const result = evalFormula('=VLOOKUP(1,A1:C3,3,FALSE)', tableData);
      expect(result).toBe(10);
    });

    it('should find an approximate match (TRUE) on sorted data', () => {
      // Lookup 2.5 in sorted first column [1,2,3] -- largest value <= 2.5 is 2 (row 2)
      const result = evalFormula('=VLOOKUP(2.5,A1:C3,2,TRUE)', tableData);
      expect(result).toBe('Banana');
    });

    it('should return #REF! when col_index exceeds table columns', () => {
      const result = evalFormula('=VLOOKUP(1,A1:C3,5,FALSE)', tableData);
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#REF!');
    });

    it('should return #N/A when no exact match is found', () => {
      const result = evalFormula('=VLOOKUP(99,A1:C3,2,FALSE)', tableData);
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#N/A');
    });

    it('should perform case-insensitive string matching', () => {
      // Lookup "BANANA" (uppercase) in B column used as first column
      const stringData: Record<string, unknown> = {
        '1,0': 'Apple',  '2,0': 10,
        '1,1': 'Banana', '2,1': 20,
        '1,2': 'Cherry', '2,2': 30,
      };
      const result = evalFormula('=VLOOKUP("BANANA",B1:C3,2,FALSE)', stringData);
      expect(result).toBe(20);
    });

    it('should default to approximate match when 4th arg omitted', () => {
      // VLOOKUP with 3 args defaults to range_lookup=TRUE (approximate)
      const result = evalFormula('=VLOOKUP(2,A1:C3,2)', tableData);
      expect(result).toBe('Banana');
    });

    it('should return #N/A for approximate match when lookup value is smaller than all values', () => {
      const result = evalFormula('=VLOOKUP(0,A1:C3,2,TRUE)', tableData);
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#N/A');
    });
  });

  // --- INDEX ---
  describe('INDEX', () => {
    it('should return the value at (row, col) in a range', () => {
      const result = evalFormula('=INDEX(A1:C3,2,2)', tableData);
      expect(result).toBe('Banana');
    });

    it('should return the value from the first column when col is omitted', () => {
      const result = evalFormula('=INDEX(A1:C3,3)', tableData);
      expect(result).toBe(3);
    });

    it('should return #REF! when row is out of bounds', () => {
      const result = evalFormula('=INDEX(A1:C3,5,1)', tableData);
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#REF!');
    });

    it('should return #REF! when column is out of bounds', () => {
      const result = evalFormula('=INDEX(A1:C3,1,5)', tableData);
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#REF!');
    });

    it('should return the correct value at position (1,1)', () => {
      const result = evalFormula('=INDEX(A1:C3,1,1)', tableData);
      expect(result).toBe(1);
    });

    it('should return the value at position (3,3)', () => {
      const result = evalFormula('=INDEX(A1:C3,3,3)', tableData);
      expect(result).toBe(30);
    });
  });

  // --- MATCH ---
  describe('MATCH', () => {
    it('should find an exact match (match_type 0)', () => {
      const result = evalFormula('=MATCH(2,A1:A3,0)', tableData);
      expect(result).toBe(2);
    });

    it('should find a sorted ascending match (match_type 1)', () => {
      // Data in A1:A3 is [1,2,3]. Looking for largest <= 2.5 => row 2
      const result = evalFormula('=MATCH(2.5,A1:A3,1)', tableData);
      expect(result).toBe(2);
    });

    it('should find a sorted descending match (match_type -1)', () => {
      // Create descending data: A1=30, A2=20, A3=10
      const descData: Record<string, unknown> = {
        '0,0': 30, '0,1': 20, '0,2': 10,
      };
      // Looking for smallest >= 15 => 20 at position 2
      const result = evalFormula('=MATCH(15,A1:A3,-1)', descData);
      expect(result).toBe(2);
    });

    it('should return #N/A when no match is found (exact match)', () => {
      const result = evalFormula('=MATCH(99,A1:A3,0)', tableData);
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#N/A');
    });

    it('should perform case-insensitive string matching (exact)', () => {
      const stringData: Record<string, unknown> = {
        '1,0': 'Apple', '1,1': 'Banana', '1,2': 'Cherry',
      };
      const result = evalFormula('=MATCH("banana",B1:B3,0)', stringData);
      expect(result).toBe(2);
    });

    it('should default match_type to 1 when omitted', () => {
      // Looking for 3 in sorted [1,2,3] with match_type=1 => position 3
      const result = evalFormula('=MATCH(3,A1:A3)', tableData);
      expect(result).toBe(3);
    });
  });
});
