/**
 * Tests for formula bar helper utilities:
 * - canInsertReference
 * - insertReferenceAtCursor
 * - handleFormulaBarKeyDown
 * - processFormulaBarCommit
 * - deriveFormulaBarText
 */
import {
  canInsertReference,
  insertReferenceAtCursor,
  handleFormulaBarKeyDown,
  processFormulaBarCommit,
  deriveFormulaBarText,
} from '../formulaBarHelpers';

// ---------------------------------------------------------------------------
// canInsertReference
// ---------------------------------------------------------------------------
describe('canInsertReference', () => {
  it('returns false for non-formula text', () => {
    expect(canInsertReference('hello', 3)).toBe(false);
  });

  it('returns true right after the = sign (cursorPos 1)', () => {
    expect(canInsertReference('=', 1)).toBe(true);
  });

  it('returns true at position 0 (before =)', () => {
    expect(canInsertReference('=SUM(', 0)).toBe(true);
  });

  it('returns true after an operator +', () => {
    expect(canInsertReference('=A1+', 4)).toBe(true);
  });

  it('returns true after an operator -', () => {
    expect(canInsertReference('=A1-', 4)).toBe(true);
  });

  it('returns true after an operator *', () => {
    expect(canInsertReference('=A1*', 4)).toBe(true);
  });

  it('returns true after an operator /', () => {
    expect(canInsertReference('=A1/', 4)).toBe(true);
  });

  it('returns true after opening parenthesis', () => {
    expect(canInsertReference('=SUM(', 5)).toBe(true);
  });

  it('returns true after comma', () => {
    expect(canInsertReference('=SUM(A1,', 8)).toBe(true);
  });

  it('returns true after colon (range operator)', () => {
    expect(canInsertReference('=SUM(A1:', 8)).toBe(true);
  });

  it('returns true after whitespace', () => {
    expect(canInsertReference('=A1+ ', 5)).toBe(true);
  });

  it('returns false in the middle of a cell reference', () => {
    expect(canInsertReference('=A1', 3)).toBe(false);
  });

  it('returns false in the middle of a number', () => {
    expect(canInsertReference('=123', 4)).toBe(false);
  });

  it('returns true after = (equals comparison)', () => {
    expect(canInsertReference('=A1=', 4)).toBe(true);
  });

  it('returns true after < (less than)', () => {
    expect(canInsertReference('=A1<', 4)).toBe(true);
  });

  it('returns true after > (greater than)', () => {
    expect(canInsertReference('=A1>', 4)).toBe(true);
  });

  it('returns true after ^ (exponent)', () => {
    expect(canInsertReference('=A1^', 4)).toBe(true);
  });

  it('returns true after % (percent)', () => {
    expect(canInsertReference('=A1%', 4)).toBe(true);
  });

  it('returns true after & (concatenation)', () => {
    expect(canInsertReference('=A1&', 4)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// insertReferenceAtCursor
// ---------------------------------------------------------------------------
describe('insertReferenceAtCursor', () => {
  it('inserts reference after = at position 1', () => {
    const result = insertReferenceAtCursor('=', 1, 'A1');
    expect(result.text).toBe('=A1');
    expect(result.cursorPos).toBe(3);
  });

  it('inserts reference after operator', () => {
    const result = insertReferenceAtCursor('=A1+', 4, 'B2');
    expect(result.text).toBe('=A1+B2');
    expect(result.cursorPos).toBe(6);
  });

  it('inserts reference after opening paren', () => {
    const result = insertReferenceAtCursor('=SUM(', 5, 'C3');
    expect(result.text).toBe('=SUM(C3');
    expect(result.cursorPos).toBe(7);
  });

  it('inserts reference after comma in function', () => {
    const result = insertReferenceAtCursor('=SUM(A1,', 8, 'B2');
    expect(result.text).toBe('=SUM(A1,B2');
    expect(result.cursorPos).toBe(10);
  });

  it('inserts reference in the middle of a formula preserving trailing text', () => {
    const result = insertReferenceAtCursor('=SUM(+B2)', 5, 'A1');
    expect(result.text).toBe('=SUM(A1+B2)');
    expect(result.cursorPos).toBe(7);
  });

  it('replaces a partial cell reference when not at an insertion point', () => {
    // User typed "=SUM(A" then clicks cell B2
    const result = insertReferenceAtCursor('=SUM(A', 6, 'B2');
    expect(result.text).toBe('=SUM(B2');
    expect(result.cursorPos).toBe(7);
  });

  it('replaces an existing full cell reference', () => {
    // Cursor is right after "A1" in "=A1+B2", clicking should replace A1
    const result = insertReferenceAtCursor('=A1+B2', 3, 'C3');
    expect(result.text).toBe('=C3+B2');
    expect(result.cursorPos).toBe(3);
  });

  it('handles insertion after colon for range end', () => {
    const result = insertReferenceAtCursor('=SUM(A1:', 8, 'A5');
    expect(result.text).toBe('=SUM(A1:A5');
    expect(result.cursorPos).toBe(10);
  });

  it('handles dollar-sign tokens when replacing', () => {
    // Partial $A typed  to  replaces $A with B2
    const result = insertReferenceAtCursor('=SUM($A', 7, 'B2');
    expect(result.text).toBe('=SUM(B2');
    expect(result.cursorPos).toBe(7);
  });

  it('inserts at beginning of empty formula', () => {
    const result = insertReferenceAtCursor('=', 1, 'D4');
    expect(result.text).toBe('=D4');
    expect(result.cursorPos).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// handleFormulaBarKeyDown
// ---------------------------------------------------------------------------
describe('handleFormulaBarKeyDown', () => {
  it('calls onCommit on Enter', () => {
    const preventDefault = jest.fn();
    const onCommit = jest.fn();
    const onCancel = jest.fn();
    handleFormulaBarKeyDown('Enter', preventDefault, onCommit, onCancel);
    expect(preventDefault).toHaveBeenCalled();
    expect(onCommit).toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('calls onCancel on Escape', () => {
    const preventDefault = jest.fn();
    const onCommit = jest.fn();
    const onCancel = jest.fn();
    handleFormulaBarKeyDown('Escape', preventDefault, onCommit, onCancel);
    expect(preventDefault).toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('does nothing on other keys', () => {
    const preventDefault = jest.fn();
    const onCommit = jest.fn();
    const onCancel = jest.fn();
    handleFormulaBarKeyDown('a', preventDefault, onCommit, onCancel);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// processFormulaBarCommit
// ---------------------------------------------------------------------------
describe('processFormulaBarCommit', () => {
  it('sets formula when text starts with =', () => {
    const setFormula = jest.fn();
    const onCellValueChanged = jest.fn();
    processFormulaBarCommit('=SUM(A1:A5)', 2, 3, setFormula, onCellValueChanged);
    expect(setFormula).toHaveBeenCalledWith(2, 3, '=SUM(A1:A5)');
    expect(onCellValueChanged).not.toHaveBeenCalled();
  });

  it('trims whitespace before checking for =', () => {
    const setFormula = jest.fn();
    processFormulaBarCommit('  =A1+B1  ', 0, 0, setFormula);
    expect(setFormula).toHaveBeenCalledWith(0, 0, '=A1+B1');
  });

  it('clears formula and commits plain value when text does not start with =', () => {
    const setFormula = jest.fn();
    const onCellValueChanged = jest.fn();
    processFormulaBarCommit('hello', 1, 2, setFormula, onCellValueChanged);
    expect(setFormula).toHaveBeenCalledWith(1, 2, null);
    expect(onCellValueChanged).toHaveBeenCalledWith(1, 2, 'hello');
  });

  it('works without onCellValueChanged callback', () => {
    const setFormula = jest.fn();
    processFormulaBarCommit('plain text', 0, 0, setFormula);
    expect(setFormula).toHaveBeenCalledWith(0, 0, null);
  });
});

// ---------------------------------------------------------------------------
// deriveFormulaBarText
// ---------------------------------------------------------------------------
describe('deriveFormulaBarText', () => {
  it('returns empty string when col is null', () => {
    expect(deriveFormulaBarText(null, 0)).toBe('');
  });

  it('returns empty string when row is null', () => {
    expect(deriveFormulaBarText(0, null)).toBe('');
  });

  it('returns formula string when cell has a formula', () => {
    const getFormula = jest.fn().mockReturnValue('=SUM(A1:A5)');
    const getRawValue = jest.fn().mockReturnValue(15);
    expect(deriveFormulaBarText(2, 3, getFormula, getRawValue)).toBe('=SUM(A1:A5)');
    expect(getFormula).toHaveBeenCalledWith(2, 3);
    // getRawValue should not be called when formula exists
  });

  it('returns stringified raw value when no formula', () => {
    const getFormula = jest.fn().mockReturnValue(undefined);
    const getRawValue = jest.fn().mockReturnValue(42);
    expect(deriveFormulaBarText(1, 1, getFormula, getRawValue)).toBe('42');
  });

  it('returns empty string when raw value is null', () => {
    const getFormula = jest.fn().mockReturnValue(undefined);
    const getRawValue = jest.fn().mockReturnValue(null);
    expect(deriveFormulaBarText(0, 0, getFormula, getRawValue)).toBe('');
  });

  it('returns empty string when raw value is undefined', () => {
    const getFormula = jest.fn().mockReturnValue(undefined);
    const getRawValue = jest.fn().mockReturnValue(undefined);
    expect(deriveFormulaBarText(0, 0, getFormula, getRawValue)).toBe('');
  });

  it('works without getFormula and getRawValue callbacks', () => {
    expect(deriveFormulaBarText(0, 0)).toBe('');
  });
});
