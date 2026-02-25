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

// Stats test data:
// A1=10, A2=20, A3=30, A4=40, A5=50
// B1="yes", B2="no", B3="yes", B4="no", B5="yes"
const statsData: Record<string, unknown> = {
  '0,0': 10, '1,0': 'yes',
  '0,1': 20, '1,1': 'no',
  '0,2': 30, '1,2': 'yes',
  '0,3': 40, '1,3': 'no',
  '0,4': 50, '1,4': 'yes',
};

// Use col 2 (C) or col 3 (D) for formula placement to avoid overlap with data
function evalFormula(formula: string, data: Record<string, unknown> = {}): unknown {
  const engine = new FormulaEngine();
  const accessor = createAccessor(data);
  engine.setFormula(3, 0, formula, accessor);
  return engine.getValue(3, 0);
}

describe('Stats functions', () => {
  // --- SUMIF ---
  describe('SUMIF', () => {
    it('should sum values where criteria matches (string equality)', () => {
      // Sum A1:A5 where B1:B5 = "yes" => 10+30+50 = 90
      const result = evalFormula('=SUMIF(B1:B5,"yes",A1:A5)', statsData);
      expect(result).toBe(90);
    });

    it('should sum values with a numeric operator criteria (">20")', () => {
      // Sum A1:A5 where A1:A5 > 20 => 30+40+50 = 120
      const result = evalFormula('=SUMIF(A1:A5,">20")', statsData);
      expect(result).toBe(120);
    });

    it('should use criteria range as sum range when sum_range is omitted', () => {
      // SUMIF(A1:A5, ">30") -- criteria range = sum range, so sum values > 30 => 40+50 = 90
      const result = evalFormula('=SUMIF(A1:A5,">30")', statsData);
      expect(result).toBe(90);
    });

    it('should handle ">=", "<=", "<>" operators', () => {
      // Sum A1:A5 where A1:A5 >= 30 => 30+40+50 = 120
      const result = evalFormula('=SUMIF(A1:A5,">=30")', statsData);
      expect(result).toBe(120);
    });

    it('should return 0 when no criteria match for sum', () => {
      // Sum A1:A5 where B1:B5 = "maybe" => none match => 0
      const result = evalFormula('=SUMIF(B1:B5,"maybe",A1:A5)', statsData);
      expect(result).toBe(0);
    });
  });

  // --- COUNTIF ---
  describe('COUNTIF', () => {
    it('should count cells matching criteria', () => {
      // Count B1:B5 where = "yes" => 3
      const result = evalFormula('=COUNTIF(B1:B5,"yes")', statsData);
      expect(result).toBe(3);
    });

    it('should count with "<>" operator', () => {
      // Count B1:B5 where <> "no" => 3 (the "yes" cells)
      const result = evalFormula('=COUNTIF(B1:B5,"<>no")', statsData);
      expect(result).toBe(3);
    });

    it('should count numeric values with operators', () => {
      // Count A1:A5 where > 25 => 3 (30, 40, 50)
      const result = evalFormula('=COUNTIF(A1:A5,">25")', statsData);
      expect(result).toBe(3);
    });

    it('should return 0 when no cells match', () => {
      const result = evalFormula('=COUNTIF(B1:B5,"maybe")', statsData);
      expect(result).toBe(0);
    });

    it('should count exact numeric match', () => {
      // Count A1:A5 where = 30 => 1
      const result = evalFormula('=COUNTIF(A1:A5,30)', statsData);
      expect(result).toBe(1);
    });
  });

  // --- AVERAGEIF ---
  describe('AVERAGEIF', () => {
    it('should average values where criteria matches', () => {
      // Average A1:A5 where B1:B5 = "yes" => (10+30+50)/3 = 30
      const result = evalFormula('=AVERAGEIF(B1:B5,"yes",A1:A5)', statsData);
      expect(result).toBe(30);
    });

    it('should return #DIV/0! when no criteria match', () => {
      const result = evalFormula('=AVERAGEIF(B1:B5,"maybe",A1:A5)', statsData);
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#DIV/0!');
    });

    it('should average with numeric operator criteria', () => {
      // Average A1:A5 where A1:A5 > 20 => (30+40+50)/3 = 40
      const result = evalFormula('=AVERAGEIF(A1:A5,">20")', statsData);
      expect(result).toBe(40);
    });

    it('should use criteria range as average range when avg_range is omitted', () => {
      // AVERAGEIF(A1:A5, "<=30") -- average of values <= 30 => (10+20+30)/3 = 20
      const result = evalFormula('=AVERAGEIF(A1:A5,"<=30")', statsData);
      expect(result).toBe(20);
    });

    it('should handle case-insensitive string matching', () => {
      // "YES" should match "yes" case-insensitively
      const result = evalFormula('=AVERAGEIF(B1:B5,"YES",A1:A5)', statsData);
      expect(result).toBe(30);
    });
  });
});
