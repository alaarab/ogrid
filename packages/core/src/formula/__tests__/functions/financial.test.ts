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

// Helper to round to N decimal places for floating-point comparison
function round(n: unknown, decimals = 6): number {
  if (typeof n !== 'number') throw new Error(`Expected number, got ${typeof n}: ${n}`);
  return Math.round(n * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

describe('Financial functions', () => {
  // --- PMT ---
  describe('PMT', () => {
    it('should calculate monthly loan payment', () => {
      // Monthly rate=0.004167 (≈5%/12), 60 periods, PV=10000
      const result = evalFormula('=PMT(0.004167, 60, 10000)');
      // Excel gives approximately -188.7123
      expect(round(result)).toBeCloseTo(-188.712, 2);
    });

    it('should calculate payment with zero interest rate', () => {
      // rate=0, nper=12, pv=1200 => payment = -100
      const result = evalFormula('=PMT(0, 12, 1200)');
      expect(result).toBe(-100);
    });

    it('should calculate payment with fv', () => {
      // rate=0.05, nper=5, pv=0, fv=-10000 => saving payment
      const result = evalFormula('=PMT(0.05, 5, 0, -10000)');
      expect(round(result)).toBeCloseTo(1809.748, 2);
    });

    it('should calculate payment with type=1 (payments at beginning)', () => {
      const r1 = evalFormula('=PMT(0.004167, 60, 10000, 0, 0)') as number;
      const r2 = evalFormula('=PMT(0.004167, 60, 10000, 0, 1)') as number;
      // Type=1 payments are slightly smaller (less interest)
      expect(r2).toBeGreaterThan(r1); // both negative; |type=1| < |type=0|
    });

    it('should return #NUM! when nper is 0', () => {
      const result = evalFormula('=PMT(0.05, 0, 10000)');
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#NUM!');
    });
  });

  // --- FV ---
  describe('FV', () => {
    it('should calculate future value of investment', () => {
      // rate=0.05/12, nper=60, pmt=-100, pv=0
      // Use cell for rate to keep precision
      const data = { '0,0': 0.05 / 12 };
      const result = evalFormula('=FV(A1, 60, -100)', data);
      expect(result as number).toBeCloseTo(6800.61, 0);
    });

    it('should calculate future value with zero rate', () => {
      // rate=0, nper=12, pmt=-100, pv=0 => FV = 1200
      const result = evalFormula('=FV(0, 12, -100)');
      expect(result).toBeCloseTo(1200, 5);
    });

    it('should calculate future value with pv', () => {
      // rate=0.05, nper=1, pmt=0, pv=-1000 => FV = 1050
      const result = evalFormula('=FV(0.05, 1, 0, -1000)');
      expect(round(result)).toBeCloseTo(1050, 4);
    });

    it('should handle type=1 (payments at beginning)', () => {
      const data = { '0,0': 0.05 / 12 };
      const r0 = evalFormula('=FV(A1, 12, -100, 0, 0)', data) as number;
      const r1 = evalFormula('=FV(A1, 12, -100, 0, 1)', data) as number;
      // Type=1 accumulates more
      expect(r1).toBeGreaterThan(r0);
    });
  });

  // --- PV ---
  describe('PV', () => {
    it('should calculate present value of annuity', () => {
      // rate=0.05/12, nper=60, pmt=-188.71 => PV ≈ 10000
      const data = { '0,0': 0.05 / 12 };
      const result = evalFormula('=PV(A1, 60, -188.71)', data);
      expect(round(result as number, 0)).toBeCloseTo(10000, 0);
    });

    it('should calculate present value with zero rate', () => {
      // rate=0, nper=12, pmt=-100 => PV = 1200
      const result = evalFormula('=PV(0, 12, -100)');
      expect(result).toBeCloseTo(1200, 5);
    });

    it('should calculate present value with fv', () => {
      // rate=0.05, nper=1, pmt=0, fv=-1050 => PV = 1000
      const result = evalFormula('=PV(0.05, 1, 0, -1050)');
      expect(round(result)).toBeCloseTo(1000, 4);
    });
  });

  // --- NPER ---
  describe('NPER', () => {
    it('should calculate number of periods', () => {
      // rate=0.05/12, pmt=-188.71, pv=10000 => nper ≈ 60
      const data = { '0,0': 0.05 / 12 };
      const result = evalFormula('=NPER(A1, -188.71, 10000)', data);
      expect(round(result as number, 1)).toBeCloseTo(60, 0);
    });

    it('should calculate nper with zero rate', () => {
      // rate=0, pmt=-100, pv=1200 => nper = 12
      const result = evalFormula('=NPER(0, -100, 1200)');
      expect(result).toBe(12);
    });

    it('should return negative nper when cash flows can be repaid in less than one period', () => {
      // rate=0.05, pmt=100, pv=100 => nper = log(100/105)/log(1.05) ≈ -1 (valid negative result)
      const result = evalFormula('=NPER(0.05, 100, 100)');
      expect(typeof result).toBe('number');
      expect(result as number).toBeLessThan(0);
    });

    it('should return #NUM! when pmt=0 and rate=0 (indeterminate)', () => {
      const result = evalFormula('=NPER(0, 0, 1000)');
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#NUM!');
    });
  });

  // --- RATE ---
  describe('RATE', () => {
    it('should calculate interest rate', () => {
      // nper=60, pmt=-188.71, pv=10000 => rate ≈ 0.004167 (≈5%/12)
      const result = evalFormula('=RATE(60, -188.71, 10000)');
      expect(round(result as number, 6)).toBeCloseTo(0.004167, 4);
    });

    it('should calculate rate for a simple case', () => {
      // nper=1, pmt=0, pv=-1000, fv=1050 => rate = 0.05
      const result = evalFormula('=RATE(1, 0, -1000, 1050)');
      expect(round(result as number, 4)).toBeCloseTo(0.05, 4);
    });

    it('should handle custom guess', () => {
      const result = evalFormula('=RATE(60, -188.71, 10000, 0, 0, 0.05)');
      expect(round(result as number, 6)).toBeCloseTo(0.004167, 4);
    });

    it('should return #NUM! when it does not converge (pmt and pv same direction)', () => {
      // Both positive: no valid rate for sum to zero
      const result = evalFormula('=RATE(10, 1000, 1000)');
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#NUM!');
    });
  });

  // --- NPV ---
  describe('NPV', () => {
    it('should calculate net present value', () => {
      // rate=0.1, values=-1000, 300, 400, 500
      // NPV(0.1, -1000, 300, 400, 500) = -1000/1.1 + 300/1.21 + 400/1.331 + 500/1.4641
      // = -909.09 + 247.93 + 300.53 + 341.51 = -19.12
      const result = evalFormula('=NPV(0.1, -1000, 300, 400, 500)');
      expect(round(result as number, 2)).toBeCloseTo(-19.12, 1);
    });

    it('should handle all positive cash flows', () => {
      // NPV(0.1, 100, 200) = 100/1.1 + 200/1.21 = 90.909 + 165.289 = 256.198
      const result = evalFormula('=NPV(0.1, 100, 200)');
      expect(round(result as number, 3)).toBeCloseTo(256.198, 2);
    });

    it('should handle zero rate', () => {
      // NPV(0, 100, 200, 300) = 100 + 200 + 300 = 600
      const result = evalFormula('=NPV(0, 100, 200, 300)');
      expect(result).toBe(600);
    });
  });

  // --- IRR ---
  describe('IRR', () => {
    it('should calculate internal rate of return', () => {
      // IRR(-1000, 300, 400, 500) ≈ 8.9%
      // Verified: -1000 + 300/(1.089) + 400/(1.089)^2 + 500/(1.089)^3 ≈ 0
      const data: Record<string, unknown> = {
        '0,0': -1000,
        '0,1': 300,
        '0,2': 400,
        '0,3': 500,
      };
      const result = evalFormula('=IRR(A1:A4)', data);
      expect(round(result as number, 3)).toBeCloseTo(0.089, 2);
    });

    it('should calculate IRR for a simple two-period case', () => {
      // IRR(-100, 110) = 10%
      const data: Record<string, unknown> = {
        '0,0': -100,
        '0,1': 110,
      };
      const result = evalFormula('=IRR(A1:A2)', data);
      expect(round(result as number, 4)).toBeCloseTo(0.1, 4);
    });

    it('should return #NUM! when no values', () => {
      const data: Record<string, unknown> = {};
      // Empty range
      const result = evalFormula('=IRR(A1:A1)', data);
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#NUM!');
    });
  });

  // --- SLN ---
  describe('SLN', () => {
    it('should calculate straight-line depreciation', () => {
      // cost=10000, salvage=1000, life=9 => SLN = 1000
      const result = evalFormula('=SLN(10000, 1000, 9)');
      expect(result).toBe(1000);
    });

    it('should calculate SLN with zero salvage', () => {
      // cost=5000, salvage=0, life=5 => SLN = 1000
      const result = evalFormula('=SLN(5000, 0, 5)');
      expect(result).toBe(1000);
    });

    it('should return #DIV/0! when life is 0', () => {
      const result = evalFormula('=SLN(10000, 1000, 0)');
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#DIV/0!');
    });

    it('should handle fractional life', () => {
      // cost=1000, salvage=0, life=2.5 => SLN = 400
      const result = evalFormula('=SLN(1000, 0, 2.5)');
      expect(result).toBe(400);
    });
  });
});
