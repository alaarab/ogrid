import { FormulaEngineService } from '../services/formula-engine.service';
import type { FormulaEngineConfig } from '../services/formula-engine.service';
import type { IColumnDef } from '../types';
import { FormulaError } from '@alaarab/ogrid-core/formula';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

type TestRow = { id: number; a: number; b: number; c: string };

const columns: IColumnDef<TestRow>[] = [
  { columnId: 'a', name: 'A' },
  { columnId: 'b', name: 'B' },
  { columnId: 'c', name: 'C' },
];

const items: TestRow[] = [
  { id: 1, a: 10, b: 20, c: 'hello' },
  { id: 2, a: 30, b: 40, c: 'world' },
  { id: 3, a: 50, b: 60, c: 'test' },
];

/** Builds a configured service with data pre-loaded. Override config as needed. */
function makeService(
  config: Partial<FormulaEngineConfig> = {}
): FormulaEngineService<TestRow> {
  const service = new FormulaEngineService<TestRow>();
  service.setData(items, columns);
  service.configure({ formulas: true, ...config });
  return service;
}

// ==========================================================================
// 1. Basic initialization
// ==========================================================================

describe('FormulaEngineService — basic initialization', () => {
  it('returns enabled()=false when formulas is not provided', () => {
    const service = new FormulaEngineService<TestRow>();
    service.setData(items, columns);
    service.configure({});
    expect(service.enabled()).toBe(false);
  });

  it('returns enabled()=false when formulas is false', () => {
    const service = new FormulaEngineService<TestRow>();
    service.setData(items, columns);
    service.configure({ formulas: false });
    expect(service.enabled()).toBe(false);
  });

  it('all methods return defaults when disabled', () => {
    const service = new FormulaEngineService<TestRow>();
    service.setData(items, columns);
    service.configure({ formulas: false });

    expect(service.hasFormula(0, 0)).toBe(false);
    expect(service.getValue(0, 0)).toBeUndefined();
    expect(service.getFormula(0, 0)).toBeUndefined();
    expect(service.getAllFormulas()).toEqual([]);
    expect(() => service.setFormula(0, 0, '=1')).not.toThrow();
    expect(() => service.onCellChanged(0, 0)).not.toThrow();
  });

  it('returns enabled()=true when formulas is true', () => {
    const service = makeService();
    expect(service.enabled()).toBe(true);
  });
});

// ==========================================================================
// 2. setFormula and getValue
// ==========================================================================

describe('FormulaEngineService — setFormula and getValue', () => {
  it('evaluates a simple arithmetic formula =1+2 to 3', () => {
    const service = makeService();
    service.setFormula(0, 0, '=1+2');
    expect(service.getValue(0, 0)).toBe(3);
  });

  it('evaluates a cell reference =A1 to the value of items[0].a', () => {
    const service = makeService();
    // =A1 → col 0, row 0 → items[0].a = 10
    service.setFormula(1, 0, '=A1');
    expect(service.getValue(1, 0)).toBe(10);
  });

  it('evaluates =SUM(A1:A3)', () => {
    const service = makeService();
    // items[0].a + items[1].a + items[2].a = 10+30+50 = 90
    service.setFormula(2, 0, '=SUM(A1:A3)');
    expect(service.getValue(2, 0)).toBe(90);
  });

  it('clears a formula when set to null', () => {
    const service = makeService();
    service.setFormula(0, 0, '=1+2');
    expect(service.getValue(0, 0)).toBe(3);

    service.setFormula(0, 0, null);
    expect(service.getValue(0, 0)).toBeUndefined();
    expect(service.hasFormula(0, 0)).toBe(false);
  });

  it('returns a FormulaError for an invalid formula', () => {
    const service = makeService();
    service.setFormula(0, 0, '=SUM(A1:A3');
    const value = service.getValue(0, 0);
    expect(value).toBeInstanceOf(FormulaError);
  });
});

// ==========================================================================
// 3. hasFormula and getFormula
// ==========================================================================

describe('FormulaEngineService — hasFormula and getFormula', () => {
  it('hasFormula returns false for a cell without a formula', () => {
    const service = makeService();
    expect(service.hasFormula(0, 0)).toBe(false);
  });

  it('hasFormula returns true after setting a formula', () => {
    const service = makeService();
    service.setFormula(0, 0, '=1+1');
    expect(service.hasFormula(0, 0)).toBe(true);
  });

  it('getFormula returns the original formula string', () => {
    const service = makeService();
    service.setFormula(0, 0, '=B1+10');
    expect(service.getFormula(0, 0)).toBe('=B1+10');
  });

  it('getFormula returns undefined for a cell without a formula', () => {
    const service = makeService();
    expect(service.getFormula(99, 99)).toBeUndefined();
  });
});

// ==========================================================================
// 4. onCellChanged cascade
// ==========================================================================

describe('FormulaEngineService — onCellChanged cascade', () => {
  it('recalculates a dependent formula when a referenced cell changes', () => {
    const mutableItems: TestRow[] = [
      { id: 1, a: 10, b: 20, c: 'hello' },
      { id: 2, a: 30, b: 40, c: 'world' },
      { id: 3, a: 50, b: 60, c: 'test' },
    ];
    const service = new FormulaEngineService<TestRow>();
    service.setData(mutableItems, columns);
    service.configure({ formulas: true });

    // Formula at (0,0) references B1 = col 1, row 0 → items[0].b = 20 → 20+5=25
    service.setFormula(0, 0, '=B1+5');
    expect(service.getValue(0, 0)).toBe(25);

    // Simulate items[0].b changing from 20 to 100
    mutableItems[0] = { ...mutableItems[0], b: 100 };
    service.setData(mutableItems, columns);

    // Notify the engine that cell (1, 0) changed — col 1 (B), row 0
    service.onCellChanged(1, 0);

    // Formula should recalculate: 100+5=105
    expect(service.getValue(0, 0)).toBe(105);
  });

  it('calls onFormulaRecalc with updatedCells on cascade', () => {
    const mutableItems: TestRow[] = [
      { id: 1, a: 10, b: 20, c: 'hello' },
      { id: 2, a: 30, b: 40, c: 'world' },
      { id: 3, a: 50, b: 60, c: 'test' },
    ];
    const onRecalc = jest.fn();
    const service = new FormulaEngineService<TestRow>();
    service.setData(mutableItems, columns);
    service.configure({ formulas: true, onFormulaRecalc: onRecalc });

    service.setFormula(1, 0, '=A1*2');
    // setFormula triggers initial recalc
    expect(onRecalc).toHaveBeenCalledTimes(1);
    const firstCall = onRecalc.mock.calls[0][0];
    expect(firstCall.updatedCells).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ col: 1, row: 0, newValue: 20 }),
      ])
    );

    onRecalc.mockClear();

    // Change A1
    mutableItems[0] = { ...mutableItems[0], a: 99 };
    service.setData(mutableItems, columns);
    service.onCellChanged(0, 0);

    expect(onRecalc).toHaveBeenCalledTimes(1);
    const cascadeCall = onRecalc.mock.calls[0][0];
    expect(cascadeCall.updatedCells).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ col: 1, row: 0, newValue: 198 }),
      ])
    );
  });

  it('does not call onFormulaRecalc when no dependents exist', () => {
    const onRecalc = jest.fn();
    const service = makeService({ onFormulaRecalc: onRecalc });

    // No formulas set — changing a cell has no dependents
    service.onCellChanged(0, 0);
    expect(onRecalc).not.toHaveBeenCalled();
  });

  it('updates lastRecalcResult signal on cascade', () => {
    const mutableItems: TestRow[] = [
      { id: 1, a: 5, b: 20, c: 'hello' },
    ];
    const service = new FormulaEngineService<TestRow>();
    service.setData(mutableItems, columns);
    service.configure({ formulas: true });

    service.setFormula(1, 0, '=A1+1');
    expect(service.lastRecalcResult()).not.toBeNull();
    expect(service.lastRecalcResult()!.updatedCells).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ col: 1, row: 0, newValue: 6 }),
      ])
    );
  });
});

// ==========================================================================
// 5. initialFormulas
// ==========================================================================

describe('FormulaEngineService — initialFormulas', () => {
  it('loads initial formulas on configure', () => {
    const service = makeService({
      initialFormulas: [{ col: 0, row: 0, formula: '=1+1' }],
    });

    expect(service.hasFormula(0, 0)).toBe(true);
    expect(service.getFormula(0, 0)).toBe('=1+1');
  });

  it('evaluates initial formulas correctly', () => {
    const service = makeService({
      // A2 + A3 = items[1].a + items[2].a = 30+50 = 80
      initialFormulas: [{ col: 0, row: 0, formula: '=A2+A3' }],
    });

    expect(service.getValue(0, 0)).toBe(80);
  });

  it('calls onFormulaRecalc with initial load results', () => {
    const onRecalc = jest.fn();
    makeService({
      initialFormulas: [{ col: 0, row: 0, formula: '=10*3' }],
      onFormulaRecalc: onRecalc,
    });

    expect(onRecalc).toHaveBeenCalledTimes(1);
    expect(onRecalc.mock.calls[0][0].updatedCells).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ col: 0, row: 0, newValue: 30 }),
      ])
    );
  });

  it('only loads initial formulas once (not on re-configure)', () => {
    const onRecalc = jest.fn();
    const service = new FormulaEngineService<TestRow>();
    service.setData(items, columns);
    service.configure({
      formulas: true,
      initialFormulas: [{ col: 0, row: 0, formula: '=2+2' }],
      onFormulaRecalc: onRecalc,
    });
    expect(onRecalc).toHaveBeenCalledTimes(1);

    // Calling configure again does not reload initial formulas
    onRecalc.mockClear();
    service.configure({
      formulas: true,
      initialFormulas: [{ col: 0, row: 0, formula: '=2+2' }],
      onFormulaRecalc: onRecalc,
    });
    expect(onRecalc).not.toHaveBeenCalled();
  });
});

// ==========================================================================
// 6. Custom formula functions
// ==========================================================================

describe('FormulaEngineService — custom formulaFunctions', () => {
  it('makes a custom function available via config', () => {
    const service = makeService({
      formulaFunctions: {
        DOUBLE: {
          minArgs: 1,
          maxArgs: 1,
          evaluate(args: unknown[], ctx: unknown, evaluator: { evaluate: (n: unknown, c: unknown) => unknown }) {
            return (evaluator.evaluate(args[0], ctx) as number) * 2;
          },
        },
      },
    });

    service.setFormula(0, 0, '=DOUBLE(5)');
    expect(service.getValue(0, 0)).toBe(10);
  });

  it('registerFunction adds a function at runtime', () => {
    const service = makeService();

    service.registerFunction('TRIPLE', {
      minArgs: 1,
      maxArgs: 1,
      evaluate(args: unknown[], ctx: unknown, evaluator: { evaluate: (n: unknown, c: unknown) => unknown }) {
        return (evaluator.evaluate(args[0], ctx) as number) * 3;
      },
    });

    // =TRIPLE(A2) → items[1].a = 30 → 30*3 = 90
    service.setFormula(0, 0, '=TRIPLE(A2)');
    expect(service.getValue(0, 0)).toBe(90);
  });
});

// ==========================================================================
// 7. Lifecycle — configure toggle, clear, recalcAll
// ==========================================================================

describe('FormulaEngineService — lifecycle', () => {
  it('toggling formulas off resets enabled to false', () => {
    const service = makeService();
    expect(service.enabled()).toBe(true);

    service.setFormula(0, 0, '=1+1');
    expect(service.getValue(0, 0)).toBe(2);

    service.configure({ formulas: false });
    expect(service.enabled()).toBe(false);
    expect(service.getValue(0, 0)).toBeUndefined();
    expect(service.hasFormula(0, 0)).toBe(false);
  });

  it('re-enabling formulas creates a new engine (previous formulas lost)', () => {
    const service = makeService();
    service.setFormula(0, 0, '=42');
    expect(service.getValue(0, 0)).toBe(42);

    service.configure({ formulas: false });
    service.configure({ formulas: true });

    expect(service.enabled()).toBe(true);
    // New engine — old formula is gone
    expect(service.hasFormula(0, 0)).toBe(false);
    expect(service.getValue(0, 0)).toBeUndefined();
  });

  it('clear removes all formulas', () => {
    const service = makeService();
    service.setFormula(0, 0, '=1+1');
    service.setFormula(1, 0, '=2+2');
    expect(service.hasFormula(0, 0)).toBe(true);
    expect(service.hasFormula(1, 0)).toBe(true);

    service.clear();

    expect(service.getValue(0, 0)).toBeUndefined();
    expect(service.getValue(1, 0)).toBeUndefined();
    expect(service.lastRecalcResult()).toBeNull();
  });

  it('supports multiple formula cells', () => {
    const service = makeService();
    service.setFormula(0, 0, '=1+1');   // 2
    service.setFormula(1, 0, '=2+3');   // 5
    service.setFormula(2, 1, '=A1+B1'); // 2 + 5 = 7

    expect(service.getValue(0, 0)).toBe(2);
    expect(service.getValue(1, 0)).toBe(5);
    expect(service.getValue(2, 1)).toBe(7);
  });

  it('getAllFormulas returns all registered formulas', () => {
    const service = makeService();
    service.setFormula(0, 0, '=1+1');
    service.setFormula(1, 0, '=2+2');

    const all = service.getAllFormulas();
    expect(all.length).toBe(2);
    expect(all).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ col: 0, row: 0, formula: '=1+1' }),
        expect.objectContaining({ col: 1, row: 0, formula: '=2+2' }),
      ])
    );
  });
});

// ==========================================================================
// 8. Audit trail — getPrecedents, getDependents, getAuditTrail
// ==========================================================================

describe('FormulaEngineService — audit trail', () => {
  it('getPrecedents returns cells that a formula depends on', () => {
    const service = makeService();
    // C1 = A1 + B1 → depends on A1 and B1
    service.setFormula(2, 0, '=A1+B1');

    const precedents = service.getPrecedents(2, 0);
    expect(precedents.length).toBeGreaterThan(0);
    expect(precedents.some((p) => p.col === 0 && p.row === 0)).toBe(true); // A1
    expect(precedents.some((p) => p.col === 1 && p.row === 0)).toBe(true); // B1
  });

  it('getDependents returns formulas that reference a cell', () => {
    const service = makeService();
    // C1 = A1 + B1 → A1 is a dependency of C1
    service.setFormula(2, 0, '=A1+B1');

    const dependents = service.getDependents(0, 0); // dependents of A1
    expect(dependents.some((d) => d.col === 2 && d.row === 0)).toBe(true); // C1
  });

  it('getPrecedents returns empty array for non-formula cells', () => {
    const service = makeService();
    expect(service.getPrecedents(0, 0)).toEqual([]);
  });

  it('getDependents returns empty array when no formulas reference the cell', () => {
    const service = makeService();
    expect(service.getDependents(99, 99)).toEqual([]);
  });

  it('getAuditTrail returns null when engine is disabled', () => {
    const service = new FormulaEngineService<TestRow>();
    service.setData(items, columns);
    service.configure({ formulas: false });
    expect(service.getAuditTrail(0, 0)).toBeNull();
  });

  it('getAuditTrail returns a trail with undefined formula for non-formula cells', () => {
    const service = makeService();
    const trail = service.getAuditTrail(0, 0);
    expect(trail).not.toBeNull();
    expect(trail!.target.formula).toBeUndefined();
    expect(trail!.precedents).toEqual([]);
  });

  it('getAuditTrail returns an audit trail with formula for formula cells', () => {
    const service = makeService();
    service.setFormula(2, 0, '=A1+B1');

    const trail = service.getAuditTrail(2, 0);
    expect(trail).not.toBeNull();
    expect(trail!.target.formula).toBe('=A1+B1');
  });
});

// ==========================================================================
// 9. Named ranges and sheet registration
// ==========================================================================

describe('FormulaEngineService — named ranges', () => {
  it('defineNamedRange makes a named range usable in formulas', () => {
    const service = makeService();
    // Name 'Revenue' to refer to A1
    service.defineNamedRange('Revenue', 'A1');
    service.setFormula(2, 0, '=Revenue+5');

    // A1 = items[0].a = 10 → 10+5=15
    expect(service.getValue(2, 0)).toBe(15);
  });

  it('removeNamedRange clears the named range', () => {
    const service = makeService();
    service.defineNamedRange('MyRange', 'A1');
    service.removeNamedRange('MyRange');

    // After removal, the formula using it should error
    service.setFormula(0, 0, '=MyRange+1');
    expect(service.getValue(0, 0)).toBeInstanceOf(FormulaError);
  });
});
