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

describe('Date extended functions', () => {
  // --- DAYS ---
  describe('DAYS', () => {
    it('should return positive days when end > start', () => {
      const result = evalFormula('=DAYS("2024-01-10T00:00:00", "2024-01-01T00:00:00")');
      expect(result).toBe(9);
    });

    it('should return negative days when end < start', () => {
      const result = evalFormula('=DAYS("2024-01-01T00:00:00", "2024-01-10T00:00:00")');
      expect(result).toBe(-9);
    });

    it('should return 0 for same date', () => {
      const result = evalFormula('=DAYS("2024-06-15T00:00:00", "2024-06-15T00:00:00")');
      expect(result).toBe(0);
    });

    it('should handle cross-year difference', () => {
      const result = evalFormula('=DAYS("2025-01-01T00:00:00", "2024-01-01T00:00:00")');
      expect(result).toBe(366); // 2024 is a leap year
    });

    it('should return #VALUE! for invalid date', () => {
      const result = evalFormula('=DAYS("not-a-date", "2024-01-01T00:00:00")');
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#VALUE!');
    });
  });

  // --- DAYS360 ---
  describe('DAYS360', () => {
    it('should compute US method (default)', () => {
      // Jan 1 to Apr 1 = 3 months * 30 = 90
      const result = evalFormula('=DAYS360("2024-01-01T00:00:00", "2024-04-01T00:00:00")');
      expect(result).toBe(90);
    });

    it('should compute US method explicitly false', () => {
      const result = evalFormula('=DAYS360("2024-01-01T00:00:00", "2024-04-01T00:00:00", FALSE)');
      expect(result).toBe(90);
    });

    it('should compute European method (TRUE)', () => {
      const result = evalFormula('=DAYS360("2024-01-31T00:00:00", "2024-03-31T00:00:00", TRUE)');
      // Jan 30 to Mar 30 = 2*30 = 60
      expect(result).toBe(60);
    });

    it('should handle month boundary with 31st day (US)', () => {
      // US: start=Jan 31 → 30; end=Mar 31 → 30 (since start was capped to 30)
      const result = evalFormula('=DAYS360("2024-01-31T00:00:00", "2024-03-31T00:00:00")');
      expect(result).toBe(60);
    });

    it('should return negative for reversed dates', () => {
      const result = evalFormula('=DAYS360("2024-04-01T00:00:00", "2024-01-01T00:00:00")');
      expect(result).toBe(-90);
    });
  });

  // --- ISOWEEKNUM ---
  describe('ISOWEEKNUM', () => {
    it('should return 1 for Jan 1 2024 (Monday)', () => {
      // 2024-01-01 is a Monday, week 1
      const result = evalFormula('=ISOWEEKNUM("2024-01-01T00:00:00")');
      expect(result).toBe(1);
    });

    it('should return correct week for mid-year date', () => {
      // 2024-06-15 (Saturday) → week 24
      const result = evalFormula('=ISOWEEKNUM("2024-06-15T00:00:00")');
      expect(result).toBe(24);
    });

    it('should return 52 or 53 for late December', () => {
      // 2024-12-28 is week 52
      const result = evalFormula('=ISOWEEKNUM("2024-12-28T00:00:00")');
      expect(typeof result).toBe('number');
      expect(result as number).toBeGreaterThanOrEqual(52);
    });

    it('should return #VALUE! for invalid date', () => {
      const result = evalFormula('=ISOWEEKNUM("invalid")');
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#VALUE!');
    });
  });

  // --- YEARFRAC ---
  describe('YEARFRAC', () => {
    it('should compute basis 0 (US 30/360) for half year', () => {
      // 6 months = 180/360 = 0.5
      const result = evalFormula('=YEARFRAC("2024-01-01T00:00:00", "2024-07-01T00:00:00", 0)') as number;
      expect(result).toBeCloseTo(0.5, 5);
    });

    it('should compute basis 1 (actual/actual) for non-leap year', () => {
      // Half of 365 days
      const result = evalFormula('=YEARFRAC("2023-01-01T00:00:00", "2023-07-02T00:00:00", 1)') as number;
      expect(result).toBeCloseTo(0.5, 2);
    });

    it('should compute basis 3 (actual/365) for quarter year', () => {
      // 91 days / 365
      const result = evalFormula('=YEARFRAC("2024-01-01T00:00:00", "2024-04-01T00:00:00", 3)') as number;
      expect(result).toBeCloseTo(91 / 365, 4);
    });

    it('should default to basis 0', () => {
      const result = evalFormula('=YEARFRAC("2024-01-01T00:00:00", "2024-07-01T00:00:00")') as number;
      expect(result).toBeCloseTo(0.5, 5);
    });

    it('should return #VALUE! for invalid basis', () => {
      const result = evalFormula('=YEARFRAC("2024-01-01T00:00:00", "2024-07-01T00:00:00", 2)');
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#VALUE!');
    });
  });

  // --- DATEVALUE ---
  describe('DATEVALUE', () => {
    it('should parse a date string and return a Date', () => {
      const result = evalFormula('=DATEVALUE("2024-06-15")');
      expect(result).toBeInstanceOf(Date);
    });

    it('should strip time component', () => {
      const result = evalFormula('=DATEVALUE("2024-06-15T12:30:00")') as Date;
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
    });

    it('should return #VALUE! for invalid date string', () => {
      const result = evalFormula('=DATEVALUE("not-a-date")');
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#VALUE!');
    });
  });

  // --- TIMEVALUE ---
  describe('TIMEVALUE', () => {
    it('should return 0.5 for noon (12:00:00)', () => {
      const result = evalFormula('=TIMEVALUE("12:00:00")');
      expect(result).toBeCloseTo(0.5, 5);
    });

    it('should return 0 for midnight (00:00:00)', () => {
      const result = evalFormula('=TIMEVALUE("00:00:00")');
      expect(result).toBeCloseTo(0, 5);
    });

    it('should handle HH:MM without seconds', () => {
      const result = evalFormula('=TIMEVALUE("06:00")');
      expect(result).toBeCloseTo(0.25, 5);
    });

    it('should handle PM suffix', () => {
      const result = evalFormula('=TIMEVALUE("6:00:00 PM")');
      expect(result).toBeCloseTo(0.75, 5);
    });

    it('should return #VALUE! for invalid time string', () => {
      const result = evalFormula('=TIMEVALUE("not-a-time")');
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#VALUE!');
    });
  });

  // --- TIME ---
  describe('TIME', () => {
    it('should return 0.5 for 12, 0, 0', () => {
      const result = evalFormula('=TIME(12, 0, 0)');
      expect(result).toBeCloseTo(0.5, 5);
    });

    it('should return 0 for 0, 0, 0', () => {
      const result = evalFormula('=TIME(0, 0, 0)');
      expect(result).toBeCloseTo(0, 5);
    });

    it('should return correct fraction for 6, 30, 0', () => {
      // 6*3600 + 30*60 = 23400 / 86400 = 0.270833...
      const result = evalFormula('=TIME(6, 30, 0)') as number;
      expect(result).toBeCloseTo(23400 / 86400, 5);
    });

    it('should wrap around for hours >= 24', () => {
      // 24h = 86400s mod 86400 = 0
      const result = evalFormula('=TIME(24, 0, 0)');
      expect(result).toBeCloseTo(0, 5);
    });
  });

  // --- WORKDAY ---
  describe('WORKDAY', () => {
    it('should add 1 working day from Friday (skip Saturday)', () => {
      // 2024-01-05 is Friday, +1 workday = Monday 2024-01-08
      const result = evalFormula('=WORKDAY("2024-01-05T00:00:00", 1)') as Date;
      expect(result).toBeInstanceOf(Date);
      expect(result.getDate()).toBe(8);
      expect(result.getMonth()).toBe(0); // January
      expect(result.getFullYear()).toBe(2024);
    });

    it('should add 5 working days from Monday', () => {
      // 2024-01-01 is Monday, +5 workdays = 2024-01-08 (next Monday)
      const result = evalFormula('=WORKDAY("2024-01-01T00:00:00", 5)') as Date;
      expect(result).toBeInstanceOf(Date);
      expect(result.getDay()).toBe(1); // Monday
    });

    it('should subtract working days (negative days)', () => {
      // 2024-01-08 is Monday, -1 workday = Friday 2024-01-05
      const result = evalFormula('=WORKDAY("2024-01-08T00:00:00", -1)') as Date;
      expect(result).toBeInstanceOf(Date);
      expect(result.getDate()).toBe(5);
      expect(result.getDay()).toBe(5); // Friday
    });

    it('should return 0 days = same date', () => {
      const result = evalFormula('=WORKDAY("2024-01-05T00:00:00", 0)') as Date;
      expect(result).toBeInstanceOf(Date);
      expect(result.getDate()).toBe(5);
    });

    it('should return #VALUE! for invalid date', () => {
      const result = evalFormula('=WORKDAY("not-a-date", 5)');
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#VALUE!');
    });
  });

  // --- WORKDAY.INTL ---
  describe('WORKDAY.INTL', () => {
    it('should use default weekend (Sat+Sun) with no weekend arg', () => {
      const result = evalFormula('=WORKDAY.INTL("2024-01-05T00:00:00", 1)') as Date;
      expect(result).toBeInstanceOf(Date);
      expect(result.getDate()).toBe(8); // Monday
    });

    it('should respect custom weekend string "0000011" (Sat+Sun)', () => {
      const result = evalFormula('=WORKDAY.INTL("2024-01-05T00:00:00", 1, "0000011")') as Date;
      expect(result).toBeInstanceOf(Date);
      expect(result.getDate()).toBe(8);
    });

    it('should treat Friday as weekend with "0000100" mask', () => {
      // 2024-01-05 (Friday) — Fri is weekend → +1 skips Fri, counts Mon
      // mask "0000100" = [Mon,Tue,Wed,Thu,Fri,Sat,Sun] → Fri=1 (weekend)
      // Starting 2024-01-05 (Fri), +1 workday → skip Sat(already in mask?), next non-weekend from Fri+1=Sat → Sat not in mask → Sat is a workday
      // Actually mask[4]=1 means Fri is weekend, mask[5]=0 means Sat is workday
      // So +1 from Fri = Sat
      const result = evalFormula('=WORKDAY.INTL("2024-01-05T00:00:00", 1, "0000100")') as Date;
      expect(result).toBeInstanceOf(Date);
      expect(result.getDate()).toBe(6); // Saturday
    });

    it('should work with numeric weekend code 1 (Sat+Sun)', () => {
      const result = evalFormula('=WORKDAY.INTL("2024-01-05T00:00:00", 1, 1)') as Date;
      expect(result).toBeInstanceOf(Date);
      expect(result.getDate()).toBe(8); // Monday
    });

    it('should work with weekend code 11 (Sun only)', () => {
      // code 11 = Sun only; +1 from Fri = Sat (Sat is workday)
      const result = evalFormula('=WORKDAY.INTL("2024-01-05T00:00:00", 1, 11)') as Date;
      expect(result).toBeInstanceOf(Date);
      expect(result.getDate()).toBe(6); // Saturday
    });

    it('should return #VALUE! for invalid weekend number', () => {
      const result = evalFormula('=WORKDAY.INTL("2024-01-05T00:00:00", 1, 99)');
      expect(result).toBeInstanceOf(FormulaError);
      expect((result as FormulaError).type).toBe('#VALUE!');
    });
  });
});
