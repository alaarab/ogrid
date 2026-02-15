/**
 * Edge case tests for selection range helper utilities.
 * Covers normalizeSelectionRange, isInSelectionRange boundary conditions, range intersections.
 */
import { normalizeSelectionRange, isInSelectionRange, type ISelectionRange } from '../dataGridTypes';

describe('Selection Range Helpers - Edge Cases', () => {
  describe('normalizeSelectionRange', () => {
    it('should handle already-normalized range (start < end)', () => {
      const range: ISelectionRange = {
        startRow: 0,
        endRow: 5,
        startCol: 0,
        endCol: 3,
      };

      const normalized = normalizeSelectionRange(range);

      expect(normalized).toEqual({
        startRow: 0,
        endRow: 5,
        startCol: 0,
        endCol: 3,
      });
    });

    it('should normalize reversed row range (end < start)', () => {
      const range: ISelectionRange = {
        startRow: 5,
        endRow: 0,
        startCol: 0,
        endCol: 3,
      };

      const normalized = normalizeSelectionRange(range);

      expect(normalized).toEqual({
        startRow: 0,
        endRow: 5,
        startCol: 0,
        endCol: 3,
      });
    });

    it('should normalize reversed column range (end < start)', () => {
      const range: ISelectionRange = {
        startRow: 0,
        endRow: 5,
        startCol: 3,
        endCol: 0,
      };

      const normalized = normalizeSelectionRange(range);

      expect(normalized).toEqual({
        startRow: 0,
        endRow: 5,
        startCol: 0,
        endCol: 3,
      });
    });

    it('should normalize both rows and columns reversed', () => {
      const range: ISelectionRange = {
        startRow: 10,
        endRow: 5,
        startCol: 8,
        endCol: 2,
      };

      const normalized = normalizeSelectionRange(range);

      expect(normalized).toEqual({
        startRow: 5,
        endRow: 10,
        startCol: 2,
        endCol: 8,
      });
    });

    it('should handle single cell range (start === end)', () => {
      const range: ISelectionRange = {
        startRow: 3,
        endRow: 3,
        startCol: 2,
        endCol: 2,
      };

      const normalized = normalizeSelectionRange(range);

      expect(normalized).toEqual({
        startRow: 3,
        endRow: 3,
        startCol: 2,
        endCol: 2,
      });
    });

    it('should handle negative indices', () => {
      const range: ISelectionRange = {
        startRow: -5,
        endRow: -10,
        startCol: -2,
        endCol: -8,
      };

      const normalized = normalizeSelectionRange(range);

      expect(normalized).toEqual({
        startRow: -10,
        endRow: -5,
        startCol: -8,
        endCol: -2,
      });
    });

    it('should handle mix of negative and positive indices', () => {
      const range: ISelectionRange = {
        startRow: -3,
        endRow: 5,
        startCol: -1,
        endCol: 4,
      };

      const normalized = normalizeSelectionRange(range);

      expect(normalized).toEqual({
        startRow: -3,
        endRow: 5,
        startCol: -1,
        endCol: 4,
      });
    });

    it('should handle zero indices', () => {
      const range: ISelectionRange = {
        startRow: 0,
        endRow: 0,
        startCol: 0,
        endCol: 0,
      };

      const normalized = normalizeSelectionRange(range);

      expect(normalized).toEqual({
        startRow: 0,
        endRow: 0,
        startCol: 0,
        endCol: 0,
      });
    });

    it('should handle very large indices', () => {
      const range: ISelectionRange = {
        startRow: 1000000,
        endRow: 500000,
        startCol: 10000,
        endCol: 5000,
      };

      const normalized = normalizeSelectionRange(range);

      expect(normalized).toEqual({
        startRow: 500000,
        endRow: 1000000,
        startCol: 5000,
        endCol: 10000,
      });
    });
  });

  describe('isInSelectionRange - Basic Cases', () => {
    const normalRange: ISelectionRange = {
      startRow: 2,
      endRow: 5,
      startCol: 1,
      endCol: 4,
    };

    it('should return true for cell at start corner', () => {
      expect(isInSelectionRange(normalRange, 2, 1)).toBe(true);
    });

    it('should return true for cell at end corner', () => {
      expect(isInSelectionRange(normalRange, 5, 4)).toBe(true);
    });

    it('should return true for cell in middle', () => {
      expect(isInSelectionRange(normalRange, 3, 2)).toBe(true);
    });

    it('should return false for cell above range', () => {
      expect(isInSelectionRange(normalRange, 1, 2)).toBe(false);
    });

    it('should return false for cell below range', () => {
      expect(isInSelectionRange(normalRange, 6, 2)).toBe(false);
    });

    it('should return false for cell left of range', () => {
      expect(isInSelectionRange(normalRange, 3, 0)).toBe(false);
    });

    it('should return false for cell right of range', () => {
      expect(isInSelectionRange(normalRange, 3, 5)).toBe(false);
    });
  });

  describe('isInSelectionRange - Boundary Conditions', () => {
    it('should handle reversed range correctly', () => {
      const reversedRange: ISelectionRange = {
        startRow: 5,
        endRow: 2,
        startCol: 4,
        endCol: 1,
      };

      // isInSelectionRange normalizes internally
      expect(isInSelectionRange(reversedRange, 2, 1)).toBe(true); // Start corner
      expect(isInSelectionRange(reversedRange, 5, 4)).toBe(true); // End corner
      expect(isInSelectionRange(reversedRange, 3, 2)).toBe(true); // Middle
      expect(isInSelectionRange(reversedRange, 1, 2)).toBe(false); // Outside
    });

    it('should handle single cell range', () => {
      const singleCell: ISelectionRange = {
        startRow: 3,
        endRow: 3,
        startCol: 2,
        endCol: 2,
      };

      expect(isInSelectionRange(singleCell, 3, 2)).toBe(true);
      expect(isInSelectionRange(singleCell, 3, 1)).toBe(false);
      expect(isInSelectionRange(singleCell, 2, 2)).toBe(false);
    });

    it('should handle single row range', () => {
      const singleRow: ISelectionRange = {
        startRow: 3,
        endRow: 3,
        startCol: 1,
        endCol: 5,
      };

      expect(isInSelectionRange(singleRow, 3, 1)).toBe(true);
      expect(isInSelectionRange(singleRow, 3, 3)).toBe(true);
      expect(isInSelectionRange(singleRow, 3, 5)).toBe(true);
      expect(isInSelectionRange(singleRow, 2, 3)).toBe(false);
      expect(isInSelectionRange(singleRow, 4, 3)).toBe(false);
    });

    it('should handle single column range', () => {
      const singleCol: ISelectionRange = {
        startRow: 1,
        endRow: 5,
        startCol: 3,
        endCol: 3,
      };

      expect(isInSelectionRange(singleCol, 1, 3)).toBe(true);
      expect(isInSelectionRange(singleCol, 3, 3)).toBe(true);
      expect(isInSelectionRange(singleCol, 5, 3)).toBe(true);
      expect(isInSelectionRange(singleCol, 3, 2)).toBe(false);
      expect(isInSelectionRange(singleCol, 3, 4)).toBe(false);
    });

    it('should handle range starting at (0, 0)', () => {
      const fromOrigin: ISelectionRange = {
        startRow: 0,
        endRow: 2,
        startCol: 0,
        endCol: 2,
      };

      expect(isInSelectionRange(fromOrigin, 0, 0)).toBe(true);
      expect(isInSelectionRange(fromOrigin, 1, 1)).toBe(true);
      expect(isInSelectionRange(fromOrigin, 2, 2)).toBe(true);
      expect(isInSelectionRange(fromOrigin, -1, 0)).toBe(false);
      expect(isInSelectionRange(fromOrigin, 0, -1)).toBe(false);
    });

    it('should handle negative indices in range', () => {
      const negativeRange: ISelectionRange = {
        startRow: -5,
        endRow: -2,
        startCol: -3,
        endCol: -1,
      };

      expect(isInSelectionRange(negativeRange, -5, -3)).toBe(true);
      expect(isInSelectionRange(negativeRange, -3, -2)).toBe(true);
      expect(isInSelectionRange(negativeRange, -2, -1)).toBe(true);
      expect(isInSelectionRange(negativeRange, -6, -2)).toBe(false);
      expect(isInSelectionRange(negativeRange, -3, 0)).toBe(false);
    });

    it('should handle very large range', () => {
      const largeRange: ISelectionRange = {
        startRow: 0,
        endRow: 1000000,
        startCol: 0,
        endCol: 10000,
      };

      expect(isInSelectionRange(largeRange, 0, 0)).toBe(true);
      expect(isInSelectionRange(largeRange, 500000, 5000)).toBe(true);
      expect(isInSelectionRange(largeRange, 1000000, 10000)).toBe(true);
      expect(isInSelectionRange(largeRange, 1000001, 5000)).toBe(false);
    });
  });

  describe('isInSelectionRange - Edge Cases on Boundaries', () => {
    const range: ISelectionRange = {
      startRow: 10,
      endRow: 20,
      startCol: 5,
      endCol: 15,
    };

    it('should return true exactly at min row', () => {
      expect(isInSelectionRange(range, 10, 10)).toBe(true);
    });

    it('should return true exactly at max row', () => {
      expect(isInSelectionRange(range, 20, 10)).toBe(true);
    });

    it('should return true exactly at min col', () => {
      expect(isInSelectionRange(range, 15, 5)).toBe(true);
    });

    it('should return true exactly at max col', () => {
      expect(isInSelectionRange(range, 15, 15)).toBe(true);
    });

    it('should return false one row below min', () => {
      expect(isInSelectionRange(range, 9, 10)).toBe(false);
    });

    it('should return false one row above max', () => {
      expect(isInSelectionRange(range, 21, 10)).toBe(false);
    });

    it('should return false one col left of min', () => {
      expect(isInSelectionRange(range, 15, 4)).toBe(false);
    });

    it('should return false one col right of max', () => {
      expect(isInSelectionRange(range, 15, 16)).toBe(false);
    });

    it('should return true at all four corners', () => {
      expect(isInSelectionRange(range, 10, 5)).toBe(true); // Top-left
      expect(isInSelectionRange(range, 10, 15)).toBe(true); // Top-right
      expect(isInSelectionRange(range, 20, 5)).toBe(true); // Bottom-left
      expect(isInSelectionRange(range, 20, 15)).toBe(true); // Bottom-right
    });

    it('should return false at diagonal corners outside range', () => {
      expect(isInSelectionRange(range, 9, 4)).toBe(false); // Above top-left
      expect(isInSelectionRange(range, 9, 16)).toBe(false); // Above top-right
      expect(isInSelectionRange(range, 21, 4)).toBe(false); // Below bottom-left
      expect(isInSelectionRange(range, 21, 16)).toBe(false); // Below bottom-right
    });
  });

  describe('Integration: normalize + isInSelectionRange', () => {
    it('should work correctly when range is normalized first', () => {
      const reversedRange: ISelectionRange = {
        startRow: 10,
        endRow: 5,
        startCol: 8,
        endCol: 2,
      };

      const normalized = normalizeSelectionRange(reversedRange);

      // After normalization: startRow=5, endRow=10, startCol=2, endCol=8
      expect(isInSelectionRange(normalized, 5, 2)).toBe(true); // Top-left
      expect(isInSelectionRange(normalized, 10, 8)).toBe(true); // Bottom-right
      expect(isInSelectionRange(normalized, 7, 5)).toBe(true); // Middle
      expect(isInSelectionRange(normalized, 4, 5)).toBe(false); // Outside
    });

    it('should produce same result whether normalized first or not', () => {
      const reversedRange: ISelectionRange = {
        startRow: 8,
        endRow: 3,
        startCol: 6,
        endCol: 1,
      };

      const normalized = normalizeSelectionRange(reversedRange);

      // isInSelectionRange handles non-normalized ranges internally
      expect(isInSelectionRange(reversedRange, 5, 3)).toBe(
        isInSelectionRange(normalized, 5, 3)
      );
      expect(isInSelectionRange(reversedRange, 3, 1)).toBe(
        isInSelectionRange(normalized, 3, 1)
      );
      expect(isInSelectionRange(reversedRange, 8, 6)).toBe(
        isInSelectionRange(normalized, 8, 6)
      );
    });
  });
});
