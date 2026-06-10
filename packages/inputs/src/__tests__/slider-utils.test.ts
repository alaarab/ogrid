import {
  clampValue,
  snapToStep,
  getPercentage,
  getValueFromOffset,
  DEFAULT_MIN,
  DEFAULT_MAX,
} from '../slider/slider-utils';

describe('slider-utils', () => {
  describe('clampValue', () => {
    it('returns value unchanged when within [min, max]', () => {
      expect(clampValue(50, 0, 100)).toBe(50);
      expect(clampValue(0, 0, 100)).toBe(0);
      expect(clampValue(100, 0, 100)).toBe(100);
    });

    it('clamps below min to min', () => {
      expect(clampValue(-1, 0, 100)).toBe(0);
      expect(clampValue(-999, 0, 100)).toBe(0);
      expect(clampValue(4, 5, 100)).toBe(5);
    });

    it('clamps above max to max', () => {
      expect(clampValue(101, 0, 100)).toBe(100);
      expect(clampValue(999, 0, 100)).toBe(100);
      expect(clampValue(11, 0, 10)).toBe(10);
    });

    it('uses DEFAULT_MIN and DEFAULT_MAX when args omitted', () => {
      expect(clampValue(50)).toBe(50);
      expect(clampValue(-1)).toBe(DEFAULT_MIN);
      expect(clampValue(200)).toBe(DEFAULT_MAX);
    });

    it('handles non-zero min ranges', () => {
      expect(clampValue(25, 20, 30)).toBe(25);
      expect(clampValue(15, 20, 30)).toBe(20);
      expect(clampValue(35, 20, 30)).toBe(30);
    });
  });

  describe('snapToStep', () => {
    it('returns the exact value when it falls on a step boundary', () => {
      expect(snapToStep(0, 0, 5)).toBe(0);
      expect(snapToStep(5, 0, 5)).toBe(5);
      expect(snapToStep(10, 0, 5)).toBe(10);
    });

    it('rounds to nearest step when between steps', () => {
      expect(snapToStep(3, 0, 5)).toBe(5); // 3 is closer to 5 than 0
      expect(snapToStep(2, 0, 5)).toBe(0); // 2 is closer to 0 than 5
      expect(snapToStep(7, 0, 5)).toBe(5); // 7 rounds to 5
    });

    it('returns value unchanged when step is 0', () => {
      expect(snapToStep(3.7, 0, 0)).toBe(3.7);
      expect(snapToStep(99, 0, 0)).toBe(99);
    });

    it('uses DEFAULT_MIN and DEFAULT_STEP when args omitted', () => {
      expect(snapToStep(50)).toBe(50); // step=1 so exact
      expect(snapToStep(50.4)).toBe(50); // rounds down
      expect(snapToStep(50.6)).toBe(51); // rounds up
    });

    it('respects non-zero min for step alignment', () => {
      // step=5, min=10: valid values are 10, 15, 20, 25...
      expect(snapToStep(12, 10, 5)).toBe(10); // closer to 10
      expect(snapToStep(13, 10, 5)).toBe(15); // closer to 15
    });

    it('handles step=1 (default)', () => {
      expect(snapToStep(5.5, 0, 1)).toBe(6);
      expect(snapToStep(5.4, 0, 1)).toBe(5);
    });
  });

  describe('getPercentage', () => {
    it('returns 0% for the minimum value', () => {
      expect(getPercentage(0, 0, 100)).toBe(0);
      expect(getPercentage(20, 20, 80)).toBe(0);
    });

    it('returns 100% for the maximum value', () => {
      expect(getPercentage(100, 0, 100)).toBe(100);
      expect(getPercentage(80, 20, 80)).toBe(100);
    });

    it('returns 50% for the midpoint', () => {
      expect(getPercentage(50, 0, 100)).toBe(50);
      expect(getPercentage(50, 0, 100)).toBe(50);
      expect(getPercentage(5, 0, 10)).toBe(50);
    });

    it('returns 0 when min equals max (edge case)', () => {
      expect(getPercentage(5, 5, 5)).toBe(0);
      expect(getPercentage(100, 100, 100)).toBe(0);
    });

    it('uses DEFAULT_MIN and DEFAULT_MAX when args omitted', () => {
      expect(getPercentage(50)).toBe(50);
      expect(getPercentage(0)).toBe(0);
      expect(getPercentage(100)).toBe(100);
    });

    it('returns values between 0 and 100 for intermediate values', () => {
      expect(getPercentage(25, 0, 100)).toBe(25);
      expect(getPercentage(75, 0, 100)).toBe(75);
      expect(getPercentage(1, 0, 4)).toBe(25);
    });
  });

  describe('getValueFromOffset', () => {
    it('returns min for offset at beginning of track (0)', () => {
      expect(getValueFromOffset(0, 300, 0, 100, 1)).toBe(0);
      expect(getValueFromOffset(0, 300, 10, 50, 1)).toBe(10);
    });

    it('returns max for offset at end of track (equal to trackWidth)', () => {
      expect(getValueFromOffset(300, 300, 0, 100, 1)).toBe(100);
      expect(getValueFromOffset(300, 300, 10, 50, 1)).toBe(50);
    });

    it('returns midpoint value for offset at middle of track', () => {
      expect(getValueFromOffset(150, 300, 0, 100, 1)).toBe(50);
    });

    it('snaps to step increments', () => {
      // Track is 300px wide, range 0-100, step=10
      // offset=155  to  ratio ~0.517  to  raw ~51.7  to  snapped to 50
      expect(getValueFromOffset(155, 300, 0, 100, 10)).toBe(50);
      // offset=175  to  ratio ~0.583  to  raw ~58.3  to  snapped to 60
      expect(getValueFromOffset(175, 300, 0, 100, 10)).toBe(60);
    });

    it('clamps negative offset to min', () => {
      expect(getValueFromOffset(-50, 300, 0, 100, 1)).toBe(0);
    });

    it('clamps offset beyond trackWidth to max', () => {
      expect(getValueFromOffset(400, 300, 0, 100, 1)).toBe(100);
    });

    it('uses default args when omitted', () => {
      // DEFAULT_MIN=0, DEFAULT_MAX=100, DEFAULT_STEP=1
      expect(getValueFromOffset(0, 300)).toBe(0);
      expect(getValueFromOffset(300, 300)).toBe(100);
    });
  });
});
