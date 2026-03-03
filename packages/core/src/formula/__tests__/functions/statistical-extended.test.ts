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
  engine.setFormula(5, 0, formula, accessor);
  return engine.getValue(5, 0);
}

// A1:A5 = 2, 4, 4, 4, 5, 5, 7, 9  (8 values, classic std dev example)
const stdData: Record<string, unknown> = {
  '0,0': 2,
  '0,1': 4,
  '0,2': 4,
  '0,3': 4,
  '0,4': 5,
  '0,5': 5,
  '0,6': 7,
  '0,7': 9,
};

describe('Statistical Extended functions', () => {
  // --- STDEV / STDEV.S ---
  describe('STDEV / STDEV.S', () => {
    it('should calculate sample standard deviation', () => {
      // mean = (2+4+4+4+5+5+7+9)/8 = 5, sum sq = 32, stdev.s = sqrt(32/7) ≈ 2.1381
      const result = evalFormula('=STDEV(A1:A8)', stdData);
      expect(result as number).toBeCloseTo(2.1381, 3);
    });

    it('STDEV.S should equal STDEV', () => {
      const r1 = evalFormula('=STDEV(A1:A8)', stdData);
      const r2 = evalFormula('=STDEV.S(A1:A8)', stdData);
      expect(r1).toBe(r2);
    });

    it('should work with inline values', () => {
      const result = evalFormula('=STDEV(2, 4, 4, 4, 5, 5, 7, 9)');
      expect(result as number).toBeCloseTo(2.1381, 3);
    });

    it('should return #DIV/0! with fewer than 2 values', () => {
      const result = evalFormula('=STDEV(5)');
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#DIV/0!');
    });
  });

  // --- STDEVP / STDEV.P ---
  describe('STDEVP / STDEV.P', () => {
    it('should calculate population standard deviation', () => {
      // mean = 5, sum sq = 32, stdev.p = sqrt(32/8) = sqrt(4) = 2
      const result = evalFormula('=STDEVP(A1:A8)', stdData);
      expect(result as number).toBeCloseTo(2, 5);
    });

    it('STDEV.P should equal STDEVP', () => {
      const r1 = evalFormula('=STDEVP(A1:A8)', stdData);
      const r2 = evalFormula('=STDEV.P(A1:A8)', stdData);
      expect(r1).toBe(r2);
    });

    it('should handle single value (returns 0)', () => {
      const result = evalFormula('=STDEVP(5)');
      expect(result).toBe(0);
    });

    it('should return #DIV/0! with no numeric values', () => {
      const result = evalFormula('=STDEVP("text")');
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#DIV/0!');
    });
  });

  // --- VAR / VAR.S ---
  describe('VAR / VAR.S', () => {
    it('should calculate sample variance', () => {
      // variance.s = 32/7 ≈ 4.5714
      const result = evalFormula('=VAR(A1:A8)', stdData);
      expect(result as number).toBeCloseTo(4.5714, 3);
    });

    it('VAR.S should equal VAR', () => {
      const r1 = evalFormula('=VAR(A1:A8)', stdData);
      const r2 = evalFormula('=VAR.S(A1:A8)', stdData);
      expect(r1).toBe(r2);
    });

    it('should return #DIV/0! with fewer than 2 values', () => {
      const result = evalFormula('=VAR(5)');
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#DIV/0!');
    });
  });

  // --- VARP / VAR.P ---
  describe('VARP / VAR.P', () => {
    it('should calculate population variance', () => {
      // variance.p = 32/8 = 4
      const result = evalFormula('=VARP(A1:A8)', stdData);
      expect(result as number).toBeCloseTo(4, 5);
    });

    it('VAR.P should equal VARP', () => {
      const r1 = evalFormula('=VARP(A1:A8)', stdData);
      const r2 = evalFormula('=VAR.P(A1:A8)', stdData);
      expect(r1).toBe(r2);
    });
  });

  // --- CORREL ---
  describe('CORREL', () => {
    // A1:A3 = 1, 2, 3, B1:B3 = 1, 2, 3 => perfect positive correlation
    const corrData: Record<string, unknown> = {
      '0,0': 1, '1,0': 1,
      '0,1': 2, '1,1': 2,
      '0,2': 3, '1,2': 3,
    };

    it('should return 1 for perfectly correlated arrays', () => {
      const result = evalFormula('=CORREL(A1:A3, B1:B3)', corrData);
      expect(result as number).toBeCloseTo(1, 5);
    });

    it('should return -1 for perfectly negatively correlated arrays', () => {
      const negData: Record<string, unknown> = {
        '0,0': 1, '1,0': 3,
        '0,1': 2, '1,1': 2,
        '0,2': 3, '1,2': 1,
      };
      const result = evalFormula('=CORREL(A1:A3, B1:B3)', negData);
      expect(result as number).toBeCloseTo(-1, 5);
    });

    it('should calculate partial correlation', () => {
      // A=[2,4,4,4,5,5,7,9], B=[1,2,3,4,5,6,7,8] => strong positive
      const mixData: Record<string, unknown> = {
        '0,0': 2, '1,0': 1,
        '0,1': 4, '1,1': 2,
        '0,2': 4, '1,2': 3,
        '0,3': 4, '1,3': 4,
        '0,4': 5, '1,4': 5,
        '0,5': 5, '1,5': 6,
        '0,6': 7, '1,6': 7,
        '0,7': 9, '1,7': 8,
      };
      const result = evalFormula('=CORREL(A1:A8, B1:B8)', mixData);
      expect(result as number).toBeGreaterThan(0.9);
      expect(result as number).toBeLessThanOrEqual(1);
    });

    it('should return #N/A when arrays have different lengths', () => {
      const data: Record<string, unknown> = {
        '0,0': 1, '1,0': 1,
        '0,1': 2, '1,1': 2,
        '0,2': 3,
      };
      const result = evalFormula('=CORREL(A1:A3, B1:B2)', data);
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#N/A');
    });

    it('should return #DIV/0! when fewer than 2 pairs', () => {
      const data: Record<string, unknown> = { '0,0': 1, '1,0': 2 };
      const result = evalFormula('=CORREL(A1:A1, B1:B1)', data);
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#DIV/0!');
    });
  });

  // --- PERCENTILE / PERCENTILE.INC ---
  describe('PERCENTILE / PERCENTILE.INC', () => {
    const pctData: Record<string, unknown> = {
      '0,0': 1,
      '0,1': 2,
      '0,2': 3,
      '0,3': 4,
      '0,4': 5,
    };

    it('should calculate 50th percentile (median)', () => {
      const result = evalFormula('=PERCENTILE(A1:A5, 0.5)', pctData);
      expect(result).toBe(3);
    });

    it('should calculate 0th percentile (minimum)', () => {
      const result = evalFormula('=PERCENTILE(A1:A5, 0)', pctData);
      expect(result).toBe(1);
    });

    it('should calculate 100th percentile (maximum)', () => {
      const result = evalFormula('=PERCENTILE(A1:A5, 1)', pctData);
      expect(result).toBe(5);
    });

    it('should interpolate between values', () => {
      // 25th percentile of [1,2,3,4,5] = 1 + 0.25*(5-1) = 2
      const result = evalFormula('=PERCENTILE(A1:A5, 0.25)', pctData);
      expect(result).toBe(2);
    });

    it('PERCENTILE.INC should equal PERCENTILE', () => {
      const r1 = evalFormula('=PERCENTILE(A1:A5, 0.75)', pctData);
      const r2 = evalFormula('=PERCENTILE.INC(A1:A5, 0.75)', pctData);
      expect(r1).toBe(r2);
    });

    it('should return #NUM! when k is out of range', () => {
      const result = evalFormula('=PERCENTILE(A1:A5, 1.5)', pctData);
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#NUM!');
    });
  });

  // --- QUARTILE / QUARTILE.INC ---
  describe('QUARTILE / QUARTILE.INC', () => {
    const quartData: Record<string, unknown> = {
      '0,0': 1,
      '0,1': 2,
      '0,2': 3,
      '0,3': 4,
      '0,4': 5,
    };

    it('should calculate Q1 (25th percentile)', () => {
      const result = evalFormula('=QUARTILE(A1:A5, 1)', quartData);
      expect(result).toBe(2);
    });

    it('should calculate Q2 (median)', () => {
      const result = evalFormula('=QUARTILE(A1:A5, 2)', quartData);
      expect(result).toBe(3);
    });

    it('should calculate Q3 (75th percentile)', () => {
      const result = evalFormula('=QUARTILE(A1:A5, 3)', quartData);
      expect(result).toBe(4);
    });

    it('QUARTILE.INC should equal QUARTILE', () => {
      const r1 = evalFormula('=QUARTILE(A1:A5, 1)', quartData);
      const r2 = evalFormula('=QUARTILE.INC(A1:A5, 1)', quartData);
      expect(r1).toBe(r2);
    });

    it('should return #NUM! when quart is out of range', () => {
      const result = evalFormula('=QUARTILE(A1:A5, 5)', quartData);
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#NUM!');
    });
  });

  // --- MODE / MODE.SNGL ---
  describe('MODE / MODE.SNGL', () => {
    it('should return the most frequent value', () => {
      // 4 appears 3 times in stdData
      const result = evalFormula('=MODE(A1:A8)', stdData);
      expect(result).toBe(4);
    });

    it('should return first mode on tie', () => {
      // [1, 2, 2, 3, 3]  -  2 appears first
      const tieData: Record<string, unknown> = {
        '0,0': 1,
        '0,1': 2,
        '0,2': 2,
        '0,3': 3,
        '0,4': 3,
      };
      const result = evalFormula('=MODE(A1:A5)', tieData);
      expect(result).toBe(2);
    });

    it('MODE.SNGL should equal MODE', () => {
      const r1 = evalFormula('=MODE(A1:A8)', stdData);
      const r2 = evalFormula('=MODE.SNGL(A1:A8)', stdData);
      expect(r1).toBe(r2);
    });

    it('should work with inline values', () => {
      const result = evalFormula('=MODE(1, 2, 2, 3)');
      expect(result).toBe(2);
    });

    it('should return #N/A when no numeric values', () => {
      const result = evalFormula('=MODE("a")');
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#N/A');
    });
  });

  // --- GEOMEAN ---
  describe('GEOMEAN', () => {
    it('should calculate geometric mean of two numbers', () => {
      // geomean(2, 8) = sqrt(16) = 4
      const result = evalFormula('=GEOMEAN(2, 8)');
      expect(result as number).toBeCloseTo(4, 5);
    });

    it('should calculate geometric mean of multiple values', () => {
      // geomean(1, 2, 4) = (8)^(1/3) = 2
      const result = evalFormula('=GEOMEAN(1, 2, 4)');
      expect(result as number).toBeCloseTo(2, 5);
    });

    it('should return #NUM! for non-positive values', () => {
      const result = evalFormula('=GEOMEAN(1, 0, 4)');
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#NUM!');
    });

    it('should return #NUM! for negative values', () => {
      const result = evalFormula('=GEOMEAN(-1, 4)');
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#NUM!');
    });

    it('should handle range input', () => {
      const data: Record<string, unknown> = {
        '0,0': 2,
        '0,1': 8,
      };
      const result = evalFormula('=GEOMEAN(A1:A2)', data);
      expect(result as number).toBeCloseTo(4, 5);
    });
  });

  // --- HARMEAN ---
  describe('HARMEAN', () => {
    it('should calculate harmonic mean', () => {
      // harmean(1, 4) = 2 / (1/1 + 1/4) = 2 / 1.25 = 1.6
      const result = evalFormula('=HARMEAN(1, 4)');
      expect(result as number).toBeCloseTo(1.6, 5);
    });

    it('should calculate harmonic mean of equal values', () => {
      // harmean(3, 3, 3) = 3
      const result = evalFormula('=HARMEAN(3, 3, 3)');
      expect(result as number).toBeCloseTo(3, 5);
    });

    it('should return #NUM! for non-positive values', () => {
      const result = evalFormula('=HARMEAN(1, 0, 3)');
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#NUM!');
    });

    it('should return #NUM! for negative values', () => {
      const result = evalFormula('=HARMEAN(-2, 4)');
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#NUM!');
    });

    it('should handle range input', () => {
      const data: Record<string, unknown> = {
        '0,0': 1,
        '0,1': 4,
      };
      const result = evalFormula('=HARMEAN(A1:A2)', data);
      expect(result as number).toBeCloseTo(1.6, 5);
    });
  });
});
