import {
  columnLetterToIndex,
  parseCellRef,
  parseRange,
  formatAddress,
  toCellKey,
  fromCellKey,
  adjustFormulaReferences,
} from '../cellAddressUtils';

describe('cellAddressUtils', () => {
  // ---------------------------------------------------------------------------
  // columnLetterToIndex
  // ---------------------------------------------------------------------------
  describe('columnLetterToIndex', () => {
    it('converts A to 0', () => {
      expect(columnLetterToIndex('A')).toBe(0);
    });

    it('converts B to 1', () => {
      expect(columnLetterToIndex('B')).toBe(1);
    });

    it('converts Z to 25', () => {
      expect(columnLetterToIndex('Z')).toBe(25);
    });

    it('converts AA to 26', () => {
      expect(columnLetterToIndex('AA')).toBe(26);
    });

    it('converts AZ to 51', () => {
      expect(columnLetterToIndex('AZ')).toBe(51);
    });

    it('converts BA to 52', () => {
      expect(columnLetterToIndex('BA')).toBe(52);
    });

    it('is case insensitive (lowercase)', () => {
      expect(columnLetterToIndex('a')).toBe(0);
      expect(columnLetterToIndex('aa')).toBe(26);
      expect(columnLetterToIndex('az')).toBe(51);
    });

    it('is case insensitive (mixed case)', () => {
      expect(columnLetterToIndex('aA')).toBe(26);
      expect(columnLetterToIndex('Ab')).toBe(27);
    });
  });

  // ---------------------------------------------------------------------------
  // parseCellRef
  // ---------------------------------------------------------------------------
  describe('parseCellRef', () => {
    it('parses "A1" to relative address {col:0, row:0}', () => {
      expect(parseCellRef('A1')).toEqual({
        col: 0,
        row: 0,
        absCol: false,
        absRow: false,
      });
    });

    it('parses "$A$1" to absolute address {col:0, row:0}', () => {
      expect(parseCellRef('$A$1')).toEqual({
        col: 0,
        row: 0,
        absCol: true,
        absRow: true,
      });
    });

    it('parses "$B2" with absCol only', () => {
      const result = parseCellRef('$B2');
      expect(result).toEqual({
        col: 1,
        row: 1,
        absCol: true,
        absRow: false,
      });
    });

    it('parses "C$3" with absRow only', () => {
      const result = parseCellRef('C$3');
      expect(result).toEqual({
        col: 2,
        row: 2,
        absCol: false,
        absRow: true,
      });
    });

    it('parses "AA100" to {col:26, row:99}', () => {
      const result = parseCellRef('AA100');
      expect(result).toEqual({
        col: 26,
        row: 99,
        absCol: false,
        absRow: false,
      });
    });

    it('returns null for invalid input (empty string)', () => {
      expect(parseCellRef('')).toBeNull();
    });

    it('returns null for invalid input (no digits)', () => {
      expect(parseCellRef('ABC')).toBeNull();
    });

    it('returns null for invalid input (no letters)', () => {
      expect(parseCellRef('123')).toBeNull();
    });

    it('returns null for invalid input (row 0)', () => {
      expect(parseCellRef('A0')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // parseRange
  // ---------------------------------------------------------------------------
  describe('parseRange', () => {
    it('parses "A1:B10" into start and end addresses', () => {
      const result = parseRange('A1:B10');
      expect(result).toEqual({
        start: { col: 0, row: 0, absCol: false, absRow: false },
        end: { col: 1, row: 9, absCol: false, absRow: false },
      });
    });

    it('returns null for invalid range (no colon)', () => {
      expect(parseRange('A1B10')).toBeNull();
    });

    it('returns null for invalid range (bad start)', () => {
      expect(parseRange('123:B10')).toBeNull();
    });

    it('returns null for invalid range (bad end)', () => {
      expect(parseRange('A1:999')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // formatAddress
  // ---------------------------------------------------------------------------
  describe('formatAddress', () => {
    it('formats relative address {col:0, row:0} as "A1"', () => {
      expect(formatAddress({ col: 0, row: 0, absCol: false, absRow: false })).toBe('A1');
    });

    it('formats absolute address {col:0, row:0} as "$A$1"', () => {
      expect(formatAddress({ col: 0, row: 0, absCol: true, absRow: true })).toBe('$A$1');
    });

    it('formats mixed address with absCol as "$B2"', () => {
      expect(formatAddress({ col: 1, row: 1, absCol: true, absRow: false })).toBe('$B2');
    });

    it('formats mixed address with absRow as "C$3"', () => {
      expect(formatAddress({ col: 2, row: 2, absCol: false, absRow: true })).toBe('C$3');
    });
  });

  // ---------------------------------------------------------------------------
  // toCellKey
  // ---------------------------------------------------------------------------
  describe('toCellKey', () => {
    it('converts (0,0) to "0,0"', () => {
      expect(toCellKey(0, 0)).toBe('0,0');
    });

    it('converts (25,99) to "25,99"', () => {
      expect(toCellKey(25, 99)).toBe('25,99');
    });
  });

  // ---------------------------------------------------------------------------
  // fromCellKey
  // ---------------------------------------------------------------------------
  describe('fromCellKey', () => {
    it('parses "0,0" to {col:0, row:0}', () => {
      expect(fromCellKey('0,0')).toEqual({ col: 0, row: 0 });
    });

    it('parses "25,99" to {col:25, row:99}', () => {
      expect(fromCellKey('25,99')).toEqual({ col: 25, row: 99 });
    });
  });

  // ---------------------------------------------------------------------------
  // adjustFormulaReferences
  // ---------------------------------------------------------------------------
  describe('adjustFormulaReferences', () => {
    it('adjusts relative row references: "=A1+B1" with rowDelta=1  to  "=A2+B2"', () => {
      expect(adjustFormulaReferences('=A1+B1', 0, 1)).toBe('=A2+B2');
    });

    it('adjusts relative column reference: "=A1" with colDelta=1  to  "=B1"', () => {
      expect(adjustFormulaReferences('=A1', 1, 0)).toBe('=B1');
    });

    it('preserves absolute row ($): "=A$1" with rowDelta=1  to  "=A$1"', () => {
      expect(adjustFormulaReferences('=A$1', 0, 1)).toBe('=A$1');
    });

    it('preserves absolute col ($): "=$A1" with rowDelta=1  to  "=$A2"', () => {
      expect(adjustFormulaReferences('=$A1', 0, 1)).toBe('=$A2');
    });

    it('preserves fully absolute ($A$1): "=$A$1" with any delta  to  "=$A$1"', () => {
      expect(adjustFormulaReferences('=$A$1', 3, 5)).toBe('=$A$1');
    });

    it('handles mixed references: "=$A1+B$2" with rowDelta=1  to  "=$A2+B$2"', () => {
      expect(adjustFormulaReferences('=$A1+B$2', 0, 1)).toBe('=$A2+B$2');
    });

    it('returns #REF! for out-of-bounds row: "=A1" with rowDelta=-1', () => {
      expect(adjustFormulaReferences('=A1', 0, -1)).toContain('#REF!');
    });

    it('returns #REF! for out-of-bounds col: "=A1" with colDelta=-1', () => {
      expect(adjustFormulaReferences('=A1', -1, 0)).toContain('#REF!');
    });

    it('works with multi-letter columns: "=AA10" with colDelta=1  to  "=AB10"', () => {
      expect(adjustFormulaReferences('=AA10', 1, 0)).toBe('=AB10');
    });

    it('handles ranges: "=SUM(A1:A5)" with rowDelta=1  to  "=SUM(A2:A6)"', () => {
      expect(adjustFormulaReferences('=SUM(A1:A5)', 0, 1)).toBe('=SUM(A2:A6)');
    });

    it('does not adjust when both deltas are zero', () => {
      expect(adjustFormulaReferences('=A1+B2', 0, 0)).toBe('=A1+B2');
    });

    it('adjusts both row and column delta simultaneously', () => {
      expect(adjustFormulaReferences('=B3', 2, 3)).toBe('=D6');
    });
  });
});
