import { cycleReferenceAtCaret, parseSheetReference } from '../sheetReferences';
import { computeRangeCycleStep } from '../keyboardNavigation';

describe('cycleReferenceAtCaret (F4)', () => {
  const press = (text: string, caret = text.length) => cycleReferenceAtCaret(text, caret)?.text ?? null;

  it('cycles A1 -> $A$1 -> A$1 -> $A1 -> A1', () => {
    expect(press('=A1')).toBe('=$A$1');
    expect(press('=$A$1')).toBe('=A$1');
    expect(press('=A$1')).toBe('=$A1');
    expect(press('=$A1')).toBe('=A1');
  });

  it('targets the reference under the caret, else the nearest one before it', () => {
    // Caret inside B2.
    expect(press('=A1+B2+C3', 5)).toBe('=A1+$B$2+C3');
    // Caret touching the start of a reference picks it.
    expect(press('=A1+B2', 4)).toBe('=A1+$B$2');
    // Caret between references: the one before it.
    expect(press('=A1 + B2', 4)).toBe('=$A$1 + B2');
    // Caret before any reference.
    expect(cycleReferenceAtCaret('=A1', 0)).toBeNull();
  });

  it('returns the changed span so the caret can follow it', () => {
    expect(cycleReferenceAtCaret('=SUM(A1)+1', 6)).toEqual({ text: '=SUM($A$1)+1', start: 5, end: 9 });
  });

  it('moves both ends of a range together', () => {
    expect(press('=SUM(A1:B10)', 8)).toBe('=SUM($A$1:$B$10)');
    expect(press('=SUM($A$1:B10)', 8)).toBe('=SUM(A$1:B$10)');
  });

  it('ignores function names, identifiers and string literals', () => {
    expect(press('=LOG10(4)')).toBeNull();
    expect(press('="A1"')).toBeNull();
    expect(press('=my_A1')).toBeNull();
    expect(press('=Sheet2!B3')).toBe('=Sheet2!$B$3');
  });

  it('returns null when there is no reference', () => {
    expect(press('=1+2')).toBeNull();
    expect(press('')).toBeNull();
  });
});

describe('parseSheetReference (name box)', () => {
  it('parses a cell, a range (normalized) and $ markers', () => {
    expect(parseSheetReference('B3')).toEqual({ startCol: 1, endCol: 1, startRow: 2, endRow: 2 });
    expect(parseSheetReference(' c5:a1 ')).toEqual({ startCol: 0, endCol: 2, startRow: 0, endRow: 4 });
    expect(parseSheetReference('$A$1:$B$2')).toEqual({ startCol: 0, endCol: 1, startRow: 0, endRow: 1 });
  });

  it('parses whole columns and whole rows', () => {
    expect(parseSheetReference('B:D')).toEqual({ startCol: 1, endCol: 3 });
    expect(parseSheetReference('C')).toEqual({ startCol: 2, endCol: 2 });
    expect(parseSheetReference('4:2')).toEqual({ startRow: 1, endRow: 3 });
  });

  it('resolves defined names case-insensitively before references', () => {
    const names = { Revenue: 'B2:B10', Top: '$A$1' };
    expect(parseSheetReference('revenue', names)).toEqual({ startCol: 1, endCol: 1, startRow: 1, endRow: 9 });
    expect(parseSheetReference('TOP', names)).toEqual({ startCol: 0, endCol: 0, startRow: 0, endRow: 0 });
  });

  it('rejects invalid input', () => {
    expect(parseSheetReference('')).toBeNull();
    expect(parseSheetReference('A0')).toBeNull();
    expect(parseSheetReference('hello world')).toBeNull();
    expect(parseSheetReference('Sheet2!A1')).toBeNull();
    expect(parseSheetReference('ABCD1')).toBeNull();
    expect(parseSheetReference('0:3')).toBeNull();
  });
});

describe('computeRangeCycleStep (Enter/Tab inside a selection)', () => {
  const range = { startRow: 0, startCol: 0, endRow: 1, endCol: 1 };

  it('Enter walks down a column, then to the top of the next, then wraps', () => {
    expect(computeRangeCycleStep(range, 0, 0, 'down')).toEqual({ rowIndex: 1, dataColIndex: 0 });
    expect(computeRangeCycleStep(range, 1, 0, 'down')).toEqual({ rowIndex: 0, dataColIndex: 1 });
    expect(computeRangeCycleStep(range, 1, 1, 'down')).toEqual({ rowIndex: 0, dataColIndex: 0 });
  });

  it('Tab walks across a row, then to the next row, then wraps', () => {
    expect(computeRangeCycleStep(range, 0, 0, 'right')).toEqual({ rowIndex: 0, dataColIndex: 1 });
    expect(computeRangeCycleStep(range, 0, 1, 'right')).toEqual({ rowIndex: 1, dataColIndex: 0 });
    expect(computeRangeCycleStep(range, 1, 1, 'right')).toEqual({ rowIndex: 0, dataColIndex: 0 });
  });

  it('Shift reverses both walks', () => {
    expect(computeRangeCycleStep(range, 0, 0, 'up')).toEqual({ rowIndex: 1, dataColIndex: 1 });
    expect(computeRangeCycleStep(range, 0, 1, 'up')).toEqual({ rowIndex: 1, dataColIndex: 0 });
    expect(computeRangeCycleStep(range, 0, 0, 'left')).toEqual({ rowIndex: 1, dataColIndex: 1 });
  });

  it('skips cells a merge covers', () => {
    // Row 0 cols 0-1 merged: (0,1) is covered.
    const covered = (r: number, c: number) => r === 0 && c === 1;
    expect(computeRangeCycleStep(range, 0, 0, 'right', covered)).toEqual({ rowIndex: 1, dataColIndex: 0 });
  });

  it('enters the range at its first cell when the position is outside it', () => {
    expect(computeRangeCycleStep(range, 5, 5, 'down')).toEqual({ rowIndex: 0, dataColIndex: 0 });
    expect(computeRangeCycleStep(range, 5, 5, 'up')).toEqual({ rowIndex: 1, dataColIndex: 1 });
  });
});
