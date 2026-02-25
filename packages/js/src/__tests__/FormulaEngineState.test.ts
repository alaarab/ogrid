import { FormulaEngineState } from '../state/FormulaEngineState';
import type { FormulaEngineStateOptions } from '../state/FormulaEngineState';
import type { IGridDataAccessor, IRecalcResult } from '@alaarab/ogrid-core';
import { FormulaError } from '@alaarab/ogrid-core';

function createAccessor(data: Record<string, unknown> = {}): IGridDataAccessor {
  return {
    getCellValue: (col: number, row: number) => data[`${col},${row}`] ?? null,
    getRowCount: () => 100,
    getColumnCount: () => 26,
  };
}

describe('FormulaEngineState', () => {
  // ── 1. Initialization ──────────────────────────────────────────────

  describe('Initialization', () => {
    it('returns isEnabled false when formulas option is false', () => {
      const state = new FormulaEngineState({ formulas: false });
      expect(state.isEnabled()).toBe(false);
    });

    it('returns isEnabled true when formulas option is true', () => {
      const state = new FormulaEngineState({ formulas: true });
      expect(state.isEnabled()).toBe(true);
    });

    it('defaults to disabled when no formulas option is provided', () => {
      const state = new FormulaEngineState({});
      expect(state.isEnabled()).toBe(false);
    });
  });

  // ── 2. setFormula and getValue ─────────────────────────────────────

  describe('setFormula and getValue', () => {
    it('sets a formula and getValue returns the computed value', () => {
      const state = new FormulaEngineState({ formulas: true });
      const accessor = createAccessor();

      state.setFormula(0, 0, '=1+2', accessor);

      expect(state.getValue(0, 0)).toBe(3);
    });

    it('evaluates a formula that references other cells via the accessor', () => {
      const state = new FormulaEngineState({ formulas: true });
      // A1 (col 0, row 0) = 10, B1 (col 1, row 0) = 20
      const accessor = createAccessor({ '0,0': 10, '1,0': 20 });

      // Set formula at C1 (col 2, row 0) = A1 + B1
      state.setFormula(2, 0, '=A1+B1', accessor);

      expect(state.getValue(2, 0)).toBe(30);
    });

    it('clears a formula when set to null and getValue returns undefined', () => {
      const state = new FormulaEngineState({ formulas: true });
      const accessor = createAccessor();

      state.setFormula(0, 0, '=5*5', accessor);
      expect(state.getValue(0, 0)).toBe(25);

      state.setFormula(0, 0, null, accessor);
      expect(state.getValue(0, 0)).toBeUndefined();
    });

    it('returns a FormulaError for an invalid formula', () => {
      const state = new FormulaEngineState({ formulas: true });
      const accessor = createAccessor();

      // A self-referencing formula creates a circular reference error
      state.setFormula(0, 0, '=A1', accessor);

      const value = state.getValue(0, 0);
      expect(value).toBeInstanceOf(FormulaError);
      expect((value as FormulaError).type).toBe('#CIRC!');
    });
  });

  // ── 3. hasFormula and getFormula ────────────────────────────────────

  describe('hasFormula and getFormula', () => {
    it('hasFormula returns true for cells with formulas and false otherwise', () => {
      const state = new FormulaEngineState({ formulas: true });
      const accessor = createAccessor();

      expect(state.hasFormula(0, 0)).toBe(false);

      state.setFormula(0, 0, '=1+1', accessor);
      expect(state.hasFormula(0, 0)).toBe(true);

      // Cell without a formula
      expect(state.hasFormula(1, 0)).toBe(false);
    });

    it('getFormula returns the formula string for a formula cell', () => {
      const state = new FormulaEngineState({ formulas: true });
      const accessor = createAccessor();

      state.setFormula(0, 0, '=SUM(1,2,3)', accessor);
      expect(state.getFormula(0, 0)).toBe('=SUM(1,2,3)');

      // Cell without a formula returns undefined
      expect(state.getFormula(1, 0)).toBeUndefined();
    });
  });

  // ── 4. onCellChanged ───────────────────────────────────────────────

  describe('onCellChanged', () => {
    it('recalculates dependent formulas when a referenced cell changes', () => {
      const state = new FormulaEngineState({ formulas: true });
      // A1 = 10
      const data: Record<string, unknown> = { '0,0': 10 };
      const accessor = createAccessor(data);

      // B1 (col 1, row 0) = A1 * 2
      state.setFormula(1, 0, '=A1*2', accessor);
      expect(state.getValue(1, 0)).toBe(20);

      // Change A1 to 50
      data['0,0'] = 50;
      const result = state.onCellChanged(0, 0, createAccessor(data));

      expect(result).toBeDefined();
      expect(result!.updatedCells.length).toBeGreaterThan(0);
      expect(state.getValue(1, 0)).toBe(100);
    });

    it('emits formulaRecalc event when dependents are recalculated', () => {
      const recalcHandler = jest.fn();
      const state = new FormulaEngineState({ formulas: true });
      state.onFormulaRecalc(recalcHandler);

      const data: Record<string, unknown> = { '0,0': 5 };
      const accessor = createAccessor(data);

      // B1 = A1 + 10
      state.setFormula(1, 0, '=A1+10', accessor);
      // Reset after setFormula emitted
      recalcHandler.mockClear();

      // Change A1
      data['0,0'] = 15;
      state.onCellChanged(0, 0, createAccessor(data));

      expect(recalcHandler).toHaveBeenCalledTimes(1);
      const result: IRecalcResult = recalcHandler.mock.calls[0][0];
      expect(result.updatedCells).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ col: 1, row: 0, newValue: 25 }),
        ])
      );
    });
  });

  // ── 5. Events and callbacks ────────────────────────────────────────

  describe('Events and callbacks', () => {
    it('fires the onFormulaRecalc option callback when setFormula triggers recalc', () => {
      const callback = jest.fn();
      const state = new FormulaEngineState({
        formulas: true,
        onFormulaRecalc: callback,
      });
      const accessor = createAccessor();

      state.setFormula(0, 0, '=10+20', accessor);

      expect(callback).toHaveBeenCalledTimes(1);
      const result: IRecalcResult = callback.mock.calls[0][0];
      expect(result.updatedCells).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ col: 0, row: 0, newValue: 30 }),
        ])
      );
    });

    it('fires the formulaRecalc event listener and returns an unsubscribe function', () => {
      const state = new FormulaEngineState({ formulas: true });
      const listener = jest.fn();
      const accessor = createAccessor();

      const unsubscribe = state.onFormulaRecalc(listener);

      state.setFormula(0, 0, '=2+3', accessor);
      expect(listener).toHaveBeenCalledTimes(1);

      // Unsubscribe
      unsubscribe();
      listener.mockClear();

      state.setFormula(1, 0, '=4+5', accessor);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ── 6. destroy ─────────────────────────────────────────────────────

  describe('destroy', () => {
    it('disables the engine and returns defaults after destroy', () => {
      const state = new FormulaEngineState({ formulas: true });
      const accessor = createAccessor();

      state.setFormula(0, 0, '=42', accessor);
      expect(state.isEnabled()).toBe(true);
      expect(state.getValue(0, 0)).toBe(42);

      state.destroy();

      expect(state.isEnabled()).toBe(false);
      expect(state.getValue(0, 0)).toBeUndefined();
      expect(state.hasFormula(0, 0)).toBe(false);
      expect(state.getFormula(0, 0)).toBeUndefined();
    });
  });

  // ── 7. initialize with initialFormulas ─────────────────────────────

  describe('initialize with initialFormulas', () => {
    it('loads initial formulas and evaluates them on initialize', () => {
      const state = new FormulaEngineState({
        formulas: true,
        initialFormulas: [
          { col: 0, row: 0, formula: '=10+5' },
          { col: 1, row: 0, formula: '=3*3' },
        ],
      });

      const accessor = createAccessor();
      state.initialize(accessor);

      expect(state.getValue(0, 0)).toBe(15);
      expect(state.getValue(1, 0)).toBe(9);
      expect(state.hasFormula(0, 0)).toBe(true);
      expect(state.hasFormula(1, 0)).toBe(true);
    });
  });
});
