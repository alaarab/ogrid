import { FormulaEngine } from '../formulaEngine';
import { FormulaError } from '../types';
import type { IGridDataAccessor } from '../types';

/**
 * Create a mock grid data accessor backed by a simple Record.
 * Keys are "col,row" strings, values are cell contents.
 */
function createAccessor(data: Record<string, unknown> = {}): IGridDataAccessor {
  return {
    getCellValue: (col: number, row: number) => data[`${col},${row}`] ?? null,
    getRowCount: () => 100,
    getColumnCount: () => 26,
  };
}

describe('FormulaEngine', () => {
  let engine: FormulaEngine;
  let accessor: IGridDataAccessor;

  beforeEach(() => {
    engine = new FormulaEngine();
    accessor = createAccessor();
  });

  // ---------------------------------------------------------------------------
  // setFormula
  // ---------------------------------------------------------------------------
  describe('setFormula', () => {
    it('sets a simple formula =1+2 and getValue returns 3', () => {
      engine.setFormula(0, 0, '=1+2', accessor);
      expect(engine.getValue(0, 0)).toBe(3);
    });

    it('works with leading = sign', () => {
      engine.setFormula(0, 0, '=5*3', accessor);
      expect(engine.getValue(0, 0)).toBe(15);
    });

    it('works without leading = sign', () => {
      engine.setFormula(0, 0, '5*3', accessor);
      expect(engine.getValue(0, 0)).toBe(15);
    });

    it('clears formula when set to null', () => {
      engine.setFormula(0, 0, '=1+2', accessor);
      expect(engine.getValue(0, 0)).toBe(3);

      engine.setFormula(0, 0, null, accessor);
      expect(engine.getValue(0, 0)).toBeUndefined();
      expect(engine.hasFormula(0, 0)).toBe(false);
    });

    it('clears formula when set to empty string', () => {
      engine.setFormula(0, 0, '=1+2', accessor);
      expect(engine.getValue(0, 0)).toBe(3);

      engine.setFormula(0, 0, '', accessor);
      expect(engine.getValue(0, 0)).toBeUndefined();
      expect(engine.hasFormula(0, 0)).toBe(false);
    });

    it('returns updatedCells with correct oldValue/newValue', () => {
      const result1 = engine.setFormula(0, 0, '=10', accessor);
      expect(result1.updatedCells).toHaveLength(1);
      expect(result1.updatedCells[0]).toMatchObject({
        col: 0,
        row: 0,
        oldValue: undefined,
        newValue: 10,
      });

      const result2 = engine.setFormula(0, 0, '=20', accessor);
      expect(result2.updatedCells).toHaveLength(1);
      expect(result2.updatedCells[0]).toMatchObject({
        col: 0,
        row: 0,
        oldValue: 10,
        newValue: 20,
      });
    });

    it('evaluates a formula referencing a cell via accessor', () => {
      const dataAccessor = createAccessor({ '0,0': 42 });
      engine.setFormula(1, 0, '=A1', dataAccessor);
      expect(engine.getValue(1, 0)).toBe(42);
    });

    it('returns FormulaError #DIV/0! for division by zero', () => {
      engine.setFormula(0, 0, '=1/0', accessor);
      const value = engine.getValue(0, 0);
      expect(value).toBeInstanceOf(FormulaError);
      expect((value as FormulaError).type).toBe('#DIV/0!');
    });

    it('returns FormulaError for parse error (incomplete expression)', () => {
      engine.setFormula(0, 0, '=SUM(', accessor);
      const value = engine.getValue(0, 0);
      expect(value).toBeInstanceOf(FormulaError);
    });
  });

  // ---------------------------------------------------------------------------
  // Circular reference detection
  // ---------------------------------------------------------------------------
  describe('circular reference detection', () => {
    it('detects self-reference: A1=A1', () => {
      engine.setFormula(0, 0, '=A1', accessor);
      const value = engine.getValue(0, 0);
      expect(value).toBeInstanceOf(FormulaError);
      expect((value as FormulaError).type).toBe('#CIRC!');
    });

    it('detects two-cell cycle: A1=B1, B1=A1', () => {
      engine.setFormula(0, 0, '=B1', accessor);
      engine.setFormula(1, 0, '=A1', accessor);
      const value = engine.getValue(1, 0);
      expect(value).toBeInstanceOf(FormulaError);
      expect((value as FormulaError).type).toBe('#CIRC!');
    });

    it('detects three-cell cycle: A1=B1, B1=C1, C1=A1', () => {
      engine.setFormula(0, 0, '=B1', accessor);
      engine.setFormula(1, 0, '=C1', accessor);
      engine.setFormula(2, 0, '=A1', accessor);
      const value = engine.getValue(2, 0);
      expect(value).toBeInstanceOf(FormulaError);
      expect((value as FormulaError).type).toBe('#CIRC!');
    });
  });

  // ---------------------------------------------------------------------------
  // Dependency cascade
  // ---------------------------------------------------------------------------
  describe('dependency cascade', () => {
    it('recalculates dependent when source formula changes', () => {
      // A1 has data value 10 in accessor
      const dataAccessor = createAccessor({ '0,0': 10 });

      // B1 = A1 * 2
      engine.setFormula(1, 0, '=A1*2', dataAccessor);
      expect(engine.getValue(1, 0)).toBe(20);

      // Now change A1 to 5 via a new formula
      engine.setFormula(0, 0, '=5', dataAccessor);
      // B1 should recalculate using engine's value of A1 (5), not accessor (10)
      expect(engine.getValue(1, 0)).toBe(10);
    });

    it('cascades through a chain: A1(data) -> B1=A1+1 -> C1=B1+1', () => {
      const dataAccessor = createAccessor({ '0,0': 10 });

      // B1 = A1 + 1
      engine.setFormula(1, 0, '=A1+1', dataAccessor);
      expect(engine.getValue(1, 0)).toBe(11);

      // C1 = B1 + 1
      engine.setFormula(2, 0, '=B1+1', dataAccessor);
      expect(engine.getValue(2, 0)).toBe(12);

      // Change A1 to a formula returning 20
      engine.setFormula(0, 0, '=20', dataAccessor);
      expect(engine.getValue(0, 0)).toBe(20);
      expect(engine.getValue(1, 0)).toBe(21);
      expect(engine.getValue(2, 0)).toBe(22);
    });

    it('fans out: A1(data) -> B1=A1, C1=A1, both update when A1 changes', () => {
      const dataAccessor = createAccessor({ '0,0': 5 });

      engine.setFormula(1, 0, '=A1', dataAccessor);
      engine.setFormula(2, 0, '=A1', dataAccessor);
      expect(engine.getValue(1, 0)).toBe(5);
      expect(engine.getValue(2, 0)).toBe(5);

      // Change A1 via formula
      engine.setFormula(0, 0, '=100', dataAccessor);
      expect(engine.getValue(1, 0)).toBe(100);
      expect(engine.getValue(2, 0)).toBe(100);
    });
  });

  // ---------------------------------------------------------------------------
  // onCellChanged
  // ---------------------------------------------------------------------------
  describe('onCellChanged', () => {
    it('recalculates dependent formula when a non-formula cell changes', () => {
      // Set up: B1 = A1 * 3, initially A1 = 10
      const currentData: Record<string, unknown> = { '0,0': 10 };
      const dynamicAccessor = createAccessor(currentData);

      engine.setFormula(1, 0, '=A1*3', dynamicAccessor);
      expect(engine.getValue(1, 0)).toBe(30);

      // Simulate A1 changing to 7
      currentData['0,0'] = 7;
      const result = engine.onCellChanged(0, 0, dynamicAccessor);
      expect(engine.getValue(1, 0)).toBe(21);
      expect(result.updatedCells.length).toBeGreaterThan(0);
    });

    it('returns empty updatedCells when cell has no dependents', () => {
      const result = engine.onCellChanged(5, 5, accessor);
      expect(result.updatedCells).toEqual([]);
    });

    it('cascades through multiple levels of dependents', () => {
      const data: Record<string, unknown> = { '0,0': 1 };
      const dynamicAccessor = createAccessor(data);

      // B1 = A1 + 10, C1 = B1 + 10
      engine.setFormula(1, 0, '=A1+10', dynamicAccessor);
      engine.setFormula(2, 0, '=B1+10', dynamicAccessor);
      expect(engine.getValue(1, 0)).toBe(11);
      expect(engine.getValue(2, 0)).toBe(21);

      // Change A1 to 100
      data['0,0'] = 100;
      engine.onCellChanged(0, 0, dynamicAccessor);
      expect(engine.getValue(1, 0)).toBe(110);
      expect(engine.getValue(2, 0)).toBe(120);
    });
  });

  // ---------------------------------------------------------------------------
  // onCellsChanged (batch)
  // ---------------------------------------------------------------------------
  describe('onCellsChanged', () => {
    it('recalculates all dependents when multiple cells change', () => {
      const data: Record<string, unknown> = { '0,0': 10, '1,0': 20 };
      const dynamicAccessor = createAccessor(data);

      // C1 = A1 + B1
      engine.setFormula(2, 0, '=A1+B1', dynamicAccessor);
      expect(engine.getValue(2, 0)).toBe(30);

      // Change both A1 and B1
      data['0,0'] = 100;
      data['1,0'] = 200;
      const result = engine.onCellsChanged(
        [{ col: 0, row: 0 }, { col: 1, row: 0 }],
        dynamicAccessor
      );

      expect(engine.getValue(2, 0)).toBe(300);
      expect(result.updatedCells.length).toBeGreaterThan(0);
    });

    it('returns combined updatedCells for all affected formulas', () => {
      const data: Record<string, unknown> = { '0,0': 1, '1,0': 2 };
      const dynamicAccessor = createAccessor(data);

      // C1 = A1, D1 = B1
      engine.setFormula(2, 0, '=A1', dynamicAccessor);
      engine.setFormula(3, 0, '=B1', dynamicAccessor);

      data['0,0'] = 10;
      data['1,0'] = 20;
      const result = engine.onCellsChanged(
        [{ col: 0, row: 0 }, { col: 1, row: 0 }],
        dynamicAccessor
      );

      expect(engine.getValue(2, 0)).toBe(10);
      expect(engine.getValue(3, 0)).toBe(20);
      // Both C1 and D1 should appear in updatedCells
      const updatedKeys = result.updatedCells.map(c => c.cellKey);
      expect(updatedKeys).toContain('2,0');
      expect(updatedKeys).toContain('3,0');
    });
  });

  // ---------------------------------------------------------------------------
  // getValue / getFormula / hasFormula
  // ---------------------------------------------------------------------------
  describe('getValue / getFormula / hasFormula', () => {
    it('getValue returns the computed value', () => {
      engine.setFormula(0, 0, '=2+3', accessor);
      expect(engine.getValue(0, 0)).toBe(5);
    });

    it('getFormula returns the original formula string', () => {
      engine.setFormula(0, 0, '=2+3', accessor);
      expect(engine.getFormula(0, 0)).toBe('=2+3');
    });

    it('hasFormula returns true for formula cells', () => {
      engine.setFormula(0, 0, '=1', accessor);
      expect(engine.hasFormula(0, 0)).toBe(true);
    });

    it('hasFormula returns false for non-formula cells', () => {
      expect(engine.hasFormula(5, 5)).toBe(false);
    });

    it('getValue returns undefined for non-formula cells', () => {
      expect(engine.getValue(5, 5)).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // registerFunction
  // ---------------------------------------------------------------------------
  describe('registerFunction', () => {
    it('registers a custom function and uses it in a formula', () => {
      engine.registerFunction('DOUBLE', {
        minArgs: 1,
        maxArgs: 1,
        evaluate(args, context, evaluator) {
          const val = evaluator.evaluate(args[0], context);
          if (typeof val === 'number') return val * 2;
          return new FormulaError('#VALUE!', 'DOUBLE requires a number');
        },
      });

      engine.setFormula(0, 0, '=DOUBLE(21)', accessor);
      expect(engine.getValue(0, 0)).toBe(42);
    });

    it('registers a custom function with multiple arguments', () => {
      engine.registerFunction('ADD3', {
        minArgs: 3,
        maxArgs: 3,
        evaluate(args, context, evaluator) {
          let sum = 0;
          for (const arg of args) {
            const val = evaluator.evaluate(arg, context);
            if (typeof val === 'number') sum += val;
            else return new FormulaError('#VALUE!', 'ADD3 requires numbers');
          }
          return sum;
        },
      });

      engine.setFormula(0, 0, '=ADD3(1,2,3)', accessor);
      expect(engine.getValue(0, 0)).toBe(6);
    });
  });

  // ---------------------------------------------------------------------------
  // recalcAll
  // ---------------------------------------------------------------------------
  describe('recalcAll', () => {
    it('recalculates all formulas', () => {
      const data: Record<string, unknown> = { '0,0': 10 };
      const dynamicAccessor = createAccessor(data);

      engine.setFormula(1, 0, '=A1*2', dynamicAccessor);
      engine.setFormula(2, 0, '=A1*3', dynamicAccessor);
      expect(engine.getValue(1, 0)).toBe(20);
      expect(engine.getValue(2, 0)).toBe(30);

      // Silently change data without notifying
      data['0,0'] = 100;

      // recalcAll should pick up the new value
      const result = engine.recalcAll(dynamicAccessor);
      expect(engine.getValue(1, 0)).toBe(200);
      expect(engine.getValue(2, 0)).toBe(300);
      expect(result.updatedCells.length).toBeGreaterThanOrEqual(2);
    });

    it('returns all updated cells', () => {
      engine.setFormula(0, 0, '=1+1', accessor);
      engine.setFormula(1, 0, '=2+2', accessor);

      const result = engine.recalcAll(accessor);
      expect(result.updatedCells.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ---------------------------------------------------------------------------
  // clear
  // ---------------------------------------------------------------------------
  describe('clear', () => {
    it('clears all formulas, values, and dependencies', () => {
      engine.setFormula(0, 0, '=1+1', accessor);
      engine.setFormula(1, 0, '=2+2', accessor);

      engine.clear();

      expect(engine.hasFormula(0, 0)).toBe(false);
      expect(engine.hasFormula(1, 0)).toBe(false);
      expect(engine.getValue(0, 0)).toBeUndefined();
      expect(engine.getValue(1, 0)).toBeUndefined();
      expect(engine.getAllFormulas()).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // getAllFormulas / loadFormulas
  // ---------------------------------------------------------------------------
  describe('getAllFormulas / loadFormulas', () => {
    it('getAllFormulas returns array of {col, row, formula}', () => {
      engine.setFormula(0, 0, '=1+1', accessor);
      engine.setFormula(1, 1, '=2+2', accessor);

      const formulas = engine.getAllFormulas();
      expect(formulas).toHaveLength(2);
      expect(formulas).toContainEqual({ col: 0, row: 0, formula: '=1+1' });
      expect(formulas).toContainEqual({ col: 1, row: 1, formula: '=2+2' });
    });

    it('loadFormulas restores state and recalculates', () => {
      const result = engine.loadFormulas(
        [
          { col: 0, row: 0, formula: '=10+5' },
          { col: 1, row: 0, formula: '=3*7' },
        ],
        accessor
      );

      expect(engine.getValue(0, 0)).toBe(15);
      expect(engine.getValue(1, 0)).toBe(21);
      expect(result.updatedCells.length).toBeGreaterThanOrEqual(2);
    });

    it('round-trips: set formulas -> getAllFormulas -> clear -> loadFormulas -> same values', () => {
      const dataAccessor = createAccessor({ '0,0': 10 });

      engine.setFormula(1, 0, '=A1+5', dataAccessor);
      engine.setFormula(2, 0, '=B1*2', dataAccessor);

      const originalB1 = engine.getValue(1, 0);
      const originalC1 = engine.getValue(2, 0);
      const formulas = engine.getAllFormulas();

      engine.clear();
      expect(engine.getValue(1, 0)).toBeUndefined();

      engine.loadFormulas(formulas, dataAccessor);
      expect(engine.getValue(1, 0)).toBe(originalB1);
      expect(engine.getValue(2, 0)).toBe(originalC1);
    });
  });

  // ---------------------------------------------------------------------------
  // Complex integration tests
  // ---------------------------------------------------------------------------
  describe('complex integration', () => {
    it('SUM over a range with mixed data types', () => {
      const dataAccessor = createAccessor({
        '0,0': 10,
        '0,1': 20,
        '0,2': 30,
        '0,3': 'text', // non-numeric, SUM should treat as 0
        '0,4': null,   // null, SUM should treat as 0
      });

      engine.setFormula(1, 0, '=SUM(A1:A5)', dataAccessor);
      // SUM skips non-numeric values
      expect(engine.getValue(1, 0)).toBe(60);
    });

    it('nested function: =IF(SUM(A1:A3)>10, "big", "small")', () => {
      const dataAccessor = createAccessor({
        '0,0': 5,
        '0,1': 3,
        '0,2': 4,
      });

      // SUM(A1:A3) = 5+3+4 = 12, which is > 10
      engine.setFormula(1, 0, '=IF(SUM(A1:A3)>10, "big", "small")', dataAccessor);
      expect(engine.getValue(1, 0)).toBe('big');
    });

    it('nested function returns "small" when sum is <= 10', () => {
      const dataAccessor = createAccessor({
        '0,0': 1,
        '0,1': 2,
        '0,2': 3,
      });

      // SUM(A1:A3) = 1+2+3 = 6, which is <= 10
      engine.setFormula(1, 0, '=IF(SUM(A1:A3)>10, "big", "small")', dataAccessor);
      expect(engine.getValue(1, 0)).toBe('small');
    });

    it('VLOOKUP referencing a data range', () => {
      // Table: A1:B3
      // A1=1, B1="one"
      // A2=2, B2="two"
      // A3=3, B3="three"
      const dataAccessor = createAccessor({
        '0,0': 1, '1,0': 'one',
        '0,1': 2, '1,1': 'two',
        '0,2': 3, '1,2': 'three',
      });

      // D1 = VLOOKUP(2, A1:B3, 2, FALSE)
      engine.setFormula(3, 0, '=VLOOKUP(2, A1:B3, 2, FALSE)', dataAccessor);
      expect(engine.getValue(3, 0)).toBe('two');
    });

    it('multiple formulas referencing each other in a valid DAG', () => {
      const dataAccessor = createAccessor({ '0,0': 2 });

      // A1 = 2 (data)
      // B1 = A1 + 3 = 5
      engine.setFormula(1, 0, '=A1+3', dataAccessor);
      // C1 = B1 * 2 = 10
      engine.setFormula(2, 0, '=B1*2', dataAccessor);
      // D1 = B1 + C1 = 5 + 10 = 15
      engine.setFormula(3, 0, '=B1+C1', dataAccessor);

      expect(engine.getValue(1, 0)).toBe(5);
      expect(engine.getValue(2, 0)).toBe(10);
      expect(engine.getValue(3, 0)).toBe(15);
    });

    it('string concatenation with & operator', () => {
      const dataAccessor = createAccessor({
        '0,0': 'Hello',
        '1,0': 'World',
      });

      engine.setFormula(2, 0, '=A1&" "&B1', dataAccessor);
      expect(engine.getValue(2, 0)).toBe('Hello World');
    });

    it('comparison operators in formulas', () => {
      engine.setFormula(0, 0, '=10>5', accessor);
      expect(engine.getValue(0, 0)).toBe(true);

      engine.setFormula(1, 0, '=10<5', accessor);
      expect(engine.getValue(1, 0)).toBe(false);
    });

    it('IFERROR handles division by zero gracefully', () => {
      engine.setFormula(0, 0, '=IFERROR(1/0, "N/A")', accessor);
      expect(engine.getValue(0, 0)).toBe('N/A');
    });

    it('unary minus in formulas', () => {
      engine.setFormula(0, 0, '=-5', accessor);
      expect(engine.getValue(0, 0)).toBe(-5);
    });

    it('power operator', () => {
      engine.setFormula(0, 0, '=2^10', accessor);
      expect(engine.getValue(0, 0)).toBe(1024);
    });

    it('formula referencing another formula cell (not just data)', () => {
      engine.setFormula(0, 0, '=10', accessor);
      engine.setFormula(1, 0, '=A1+5', accessor);
      expect(engine.getValue(1, 0)).toBe(15);
    });

    it('overwriting a formula preserves dependencies correctly', () => {
      const data: Record<string, unknown> = { '0,0': 10, '1,0': 20 };
      const dynamicAccessor = createAccessor(data);

      // C1 = A1
      engine.setFormula(2, 0, '=A1', dynamicAccessor);
      expect(engine.getValue(2, 0)).toBe(10);

      // Change C1 to reference B1 instead
      engine.setFormula(2, 0, '=B1', dynamicAccessor);
      expect(engine.getValue(2, 0)).toBe(20);

      // Changing A1 should NOT affect C1 anymore
      data['0,0'] = 999;
      engine.onCellChanged(0, 0, dynamicAccessor);
      expect(engine.getValue(2, 0)).toBe(20);

      // But changing B1 should affect C1
      data['1,0'] = 50;
      engine.onCellChanged(1, 0, dynamicAccessor);
      expect(engine.getValue(2, 0)).toBe(50);
    });

    it('clearing a formula does not break remaining formulas', () => {
      const dataAccessor = createAccessor({ '0,0': 10 });

      engine.setFormula(1, 0, '=A1*2', dataAccessor);
      engine.setFormula(2, 0, '=A1*3', dataAccessor);
      expect(engine.getValue(1, 0)).toBe(20);
      expect(engine.getValue(2, 0)).toBe(30);

      // Clear B1
      engine.setFormula(1, 0, null, dataAccessor);
      expect(engine.hasFormula(1, 0)).toBe(false);

      // C1 should still work
      expect(engine.hasFormula(2, 0)).toBe(true);
      expect(engine.getValue(2, 0)).toBe(30);
    });

    it('boolean literal in formulas', () => {
      engine.setFormula(0, 0, '=TRUE', accessor);
      expect(engine.getValue(0, 0)).toBe(true);

      engine.setFormula(1, 0, '=FALSE', accessor);
      expect(engine.getValue(1, 0)).toBe(false);
    });

    it('string literal in formulas', () => {
      engine.setFormula(0, 0, '="hello"', accessor);
      expect(engine.getValue(0, 0)).toBe('hello');
    });

    it('numeric literal in formulas', () => {
      engine.setFormula(0, 0, '=42', accessor);
      expect(engine.getValue(0, 0)).toBe(42);
    });

    it('arithmetic with negative numbers', () => {
      engine.setFormula(0, 0, '=-3+5', accessor);
      expect(engine.getValue(0, 0)).toBe(2);
    });

    it('subtraction formula', () => {
      engine.setFormula(0, 0, '=10-3', accessor);
      expect(engine.getValue(0, 0)).toBe(7);
    });

    it('multiplication formula', () => {
      engine.setFormula(0, 0, '=4*5', accessor);
      expect(engine.getValue(0, 0)).toBe(20);
    });

    it('division formula', () => {
      engine.setFormula(0, 0, '=20/4', accessor);
      expect(engine.getValue(0, 0)).toBe(5);
    });
  });

  // ---------------------------------------------------------------------------
  // Custom functions via config
  // ---------------------------------------------------------------------------
  describe('custom functions via config', () => {
    it('accepts custom functions via constructor config', () => {
      const customEngine = new FormulaEngine({
        customFunctions: {
          TRIPLE: {
            minArgs: 1,
            maxArgs: 1,
            evaluate(args, context, evaluator) {
              const val = evaluator.evaluate(args[0], context);
              if (typeof val === 'number') return val * 3;
              return new FormulaError('#VALUE!', 'TRIPLE requires a number');
            },
          },
        },
      });

      customEngine.setFormula(0, 0, '=TRIPLE(10)', accessor);
      expect(customEngine.getValue(0, 0)).toBe(30);
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------
  describe('edge cases', () => {
    it('clearing a formula that was never set returns empty updatedCells', () => {
      const result = engine.setFormula(5, 5, null, accessor);
      expect(result.updatedCells).toEqual([]);
    });

    it('clearing a formula returns updatedCells with the old value', () => {
      engine.setFormula(0, 0, '=42', accessor);
      const result = engine.setFormula(0, 0, null, accessor);
      expect(result.updatedCells).toHaveLength(1);
      expect(result.updatedCells[0].oldValue).toBe(42);
      expect(result.updatedCells[0].newValue).toBeUndefined();
    });

    it('unknown function returns #NAME? error', () => {
      engine.setFormula(0, 0, '=NOSUCHFUNC(1)', accessor);
      const value = engine.getValue(0, 0);
      expect(value).toBeInstanceOf(FormulaError);
      expect((value as FormulaError).type).toBe('#NAME?');
    });

    it('cell referencing null data returns null', () => {
      engine.setFormula(0, 0, '=Z99', accessor);
      // Z99 doesn't exist in accessor, returns null
      expect(engine.getValue(0, 0)).toBeNull();
    });

    it('handles deeply nested expressions', () => {
      engine.setFormula(0, 0, '=((1+2)*(3+4))/(5-2)', accessor);
      // (3 * 7) / 3 = 7
      expect(engine.getValue(0, 0)).toBe(7);
    });

    it('recalcAll on empty engine returns empty updatedCells', () => {
      const result = engine.recalcAll(accessor);
      expect(result.updatedCells).toEqual([]);
    });
  });
});
