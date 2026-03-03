import {
  clampRating,
  getStarFill,
  getRatingFromPosition,
  DEFAULT_MAX_STARS,
} from '../rating/rating-utils';

describe('rating-utils', () => {
  describe('clampRating', () => {
    it('returns the value unchanged when within [0, maxStars]', () => {
      expect(clampRating(3, 5)).toBe(3);
      expect(clampRating(0, 5)).toBe(0);
      expect(clampRating(5, 5)).toBe(5);
    });

    it('clamps below 0 to 0', () => {
      expect(clampRating(-1, 5)).toBe(0);
      expect(clampRating(-100, 5)).toBe(0);
    });

    it('clamps above maxStars to maxStars', () => {
      expect(clampRating(6, 5)).toBe(5);
      expect(clampRating(100, 5)).toBe(5);
    });

    it('uses DEFAULT_MAX_STARS when maxStars is omitted', () => {
      expect(clampRating(4)).toBe(4);
      expect(clampRating(10)).toBe(DEFAULT_MAX_STARS);
    });

    it('handles half-star values correctly', () => {
      expect(clampRating(2.5, 5)).toBe(2.5);
      expect(clampRating(5.5, 5)).toBe(5);
    });
  });

  describe('getStarFill', () => {
    it('returns "full" when rating >= starIndex + 1', () => {
      expect(getStarFill(0, 1)).toBe('full');
      expect(getStarFill(0, 2)).toBe('full');
      expect(getStarFill(2, 3)).toBe('full');
      expect(getStarFill(4, 5)).toBe('full');
    });

    it('returns "half" when allowHalf and rating >= starIndex + 0.5 but < starIndex + 1', () => {
      expect(getStarFill(0, 0.5, true)).toBe('half');
      expect(getStarFill(1, 1.5, true)).toBe('half');
      expect(getStarFill(2, 2.5, true)).toBe('half');
      expect(getStarFill(4, 4.5, true)).toBe('half');
    });

    it('returns "empty" when rating does not reach star threshold', () => {
      expect(getStarFill(0, 0)).toBe('empty');
      // starIndex=1, rating=1: 1 >= 1+1=2 is false; 1 >= 1+0.5 is true but allowHalf=false → empty
      expect(getStarFill(1, 1)).toBe('empty');
      expect(getStarFill(2, 0)).toBe('empty');
      // starIndex=3, rating=2.5 with allowHalf: 2.5 < 3+0.5=3.5 and < 3+1=4 → empty
      expect(getStarFill(3, 2.5, true)).toBe('empty');
    });

    it('returns "empty" for half-star position when allowHalf is false', () => {
      expect(getStarFill(0, 0.5, false)).toBe('empty');
      expect(getStarFill(1, 1.5, false)).toBe('empty');
      expect(getStarFill(2, 2.5, false)).toBe('empty');
    });

    it('defaults allowHalf to false', () => {
      // Without allowHalf, a 0.5 rating on star 0 should be empty
      expect(getStarFill(0, 0.5)).toBe('empty');
    });
  });

  describe('getRatingFromPosition', () => {
    it('returns starIndex + 1 when clicking right half (allowHalf=false)', () => {
      expect(getRatingFromPosition(0, 20, 30, false)).toBe(1);
      expect(getRatingFromPosition(2, 20, 30, false)).toBe(3);
      expect(getRatingFromPosition(4, 25, 30, false)).toBe(5);
    });

    it('returns starIndex + 0.5 when clicking left half with allowHalf', () => {
      expect(getRatingFromPosition(0, 10, 30, true)).toBe(0.5);
      expect(getRatingFromPosition(2, 10, 30, true)).toBe(2.5);
      expect(getRatingFromPosition(4, 5, 30, true)).toBe(4.5);
    });

    it('returns starIndex + 1 when clicking right half with allowHalf', () => {
      expect(getRatingFromPosition(0, 20, 30, true)).toBe(1);
      expect(getRatingFromPosition(2, 20, 30, true)).toBe(3);
    });

    it('always returns full star when allowHalf is false regardless of position', () => {
      expect(getRatingFromPosition(1, 1, 30, false)).toBe(2); // left half, no half allowed
      expect(getRatingFromPosition(1, 25, 30, false)).toBe(2); // right half
    });

    it('uses offsetX exactly at midpoint boundary', () => {
      // offsetX < starWidth/2 → half; offsetX >= starWidth/2 → full
      // starWidth = 30, mid = 15
      expect(getRatingFromPosition(0, 14, 30, true)).toBe(0.5); // just before mid
      expect(getRatingFromPosition(0, 15, 30, true)).toBe(1); // exactly at mid → full
      expect(getRatingFromPosition(0, 16, 30, true)).toBe(1); // just after mid
    });

    it('defaults allowHalf to false', () => {
      expect(getRatingFromPosition(2, 5, 30)).toBe(3);
    });
  });
});
