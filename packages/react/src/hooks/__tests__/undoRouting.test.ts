import { describe, it, expect } from 'bun:test';
import { formulasFollowData, resolveUndoAvailability, usesHostFormulaHistory } from '../undoRouting';

describe('usesHostFormulaHistory', () => {
  it('routes formula history to the host only when the host owns undo and formulas are on', () => {
    expect(usesHostFormulaHistory(true, true)).toBe(true);
    expect(usesHostFormulaHistory(true, false)).toBe(false);
    expect(usesHostFormulaHistory(false, true)).toBe(false);
    expect(usesHostFormulaHistory(false, false)).toBe(false);
  });
});

describe('formulasFollowData', () => {
  it('makes the engine follow formula text in the data under host-owned undo', () => {
    expect(formulasFollowData(true)).toBe(true);
  });

  it('keeps the engine as the source of truth with the internal stack', () => {
    expect(formulasFollowData(false)).toBe(false);
  });
});

describe('resolveUndoAvailability', () => {
  it('lets an explicit host flag win over everything', () => {
    expect(resolveUndoAvailability(false, true, true)).toBe(false);
    expect(resolveUndoAvailability(true, false, false)).toBe(true);
  });

  it('assumes a host handler without a flag is available', () => {
    expect(resolveUndoAvailability(undefined, true, false)).toBe(true);
  });

  it('falls back to the internal stack without a host handler', () => {
    expect(resolveUndoAvailability(undefined, false, false)).toBe(false);
    expect(resolveUndoAvailability(undefined, false, true)).toBe(true);
  });
});
