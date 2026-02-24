import { indexToColumnLetter, formatCellReference } from '../cellReference';

describe('indexToColumnLetter', () => {
  it('converts single-letter indices (A–Z)', () => {
    expect(indexToColumnLetter(0)).toBe('A');
    expect(indexToColumnLetter(1)).toBe('B');
    expect(indexToColumnLetter(12)).toBe('M');
    expect(indexToColumnLetter(25)).toBe('Z');
  });

  it('converts double-letter indices (AA–ZZ)', () => {
    expect(indexToColumnLetter(26)).toBe('AA');
    expect(indexToColumnLetter(27)).toBe('AB');
    expect(indexToColumnLetter(51)).toBe('AZ');
    expect(indexToColumnLetter(52)).toBe('BA');
    expect(indexToColumnLetter(701)).toBe('ZZ');
  });

  it('converts triple-letter indices', () => {
    expect(indexToColumnLetter(702)).toBe('AAA');
    expect(indexToColumnLetter(703)).toBe('AAB');
  });
});

describe('formatCellReference', () => {
  it('formats A1-style references', () => {
    expect(formatCellReference(0, 1)).toBe('A1');
    expect(formatCellReference(2, 15)).toBe('C15');
    expect(formatCellReference(25, 42)).toBe('Z42');
  });

  it('handles double-letter columns', () => {
    expect(formatCellReference(26, 100)).toBe('AA100');
    expect(formatCellReference(27, 1)).toBe('AB1');
  });
});
