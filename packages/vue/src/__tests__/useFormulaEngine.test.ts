import { ref } from 'vue';
import { useFormulaEngine } from '../composables/useFormulaEngine';
import type { UseFormulaEngineParams } from '../composables/useFormulaEngine';
import type { IColumnDef } from '@alaarab/ogrid-core';
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

/** Builds default params for useFormulaEngine. Override as needed. */
function makeParams(
  overrides: Partial<UseFormulaEngineParams<TestRow>> = {}
): UseFormulaEngineParams<TestRow> {
  return {
    formulas: ref(true),
    items: ref(items),
    flatColumns: ref(columns),
    ...overrides,
  };
}

// ==========================================================================
// 1. Basic initialization
// ==========================================================================

describe('useFormulaEngine  -  basic initialization', () => {
  it('returns enabled=false when formulas is undefined', () => {
    const { enabled } = useFormulaEngine(makeParams({ formulas: undefined }));
    expect(enabled.value).toBe(false);
  });

  it('returns enabled=false when formulas ref is false', () => {
    const { enabled } = useFormulaEngine(makeParams({ formulas: ref(false) }));
    expect(enabled.value).toBe(false);
  });

  it('all methods are no-ops when disabled', () => {
    const result = useFormulaEngine(makeParams({ formulas: ref(false) }));

    expect(result.hasFormula(0, 0)).toBe(false);
    expect(result.getFormulaValue(0, 0)).toBeUndefined();
    expect(result.getFormula(0, 0)).toBeUndefined();
    expect(result.getPrecedents(0, 0)).toEqual([]);
    expect(result.getDependents(0, 0)).toEqual([]);
    expect(result.getAuditTrail(0, 0)).toBeNull();
    expect(() => result.setFormula(0, 0, '=1')).not.toThrow();
    expect(() => result.onCellChanged(0, 0)).not.toThrow();
  });

  it('returns enabled=true and functional methods when formulas ref is true', () => {
    const result = useFormulaEngine(makeParams());

    expect(result.enabled.value).toBe(true);
    expect(typeof result.getFormulaValue).toBe('function');
    expect(typeof result.hasFormula).toBe('function');
    expect(typeof result.getFormula).toBe('function');
    expect(typeof result.setFormula).toBe('function');
    expect(typeof result.onCellChanged).toBe('function');
  });
});

// ==========================================================================
// 2. setFormula and getFormulaValue
// ==========================================================================

describe('useFormulaEngine  -  setFormula and getFormulaValue', () => {
  it('evaluates a simple arithmetic formula =1+2 to 3', () => {
    const { setFormula, getFormulaValue } = useFormulaEngine(makeParams());

    setFormula(0, 0, '=1+2');

    expect(getFormulaValue(0, 0)).toBe(3);
  });

  it('evaluates a cell reference =A1 to the value of items[0].a', () => {
    const { setFormula, getFormulaValue } = useFormulaEngine(makeParams());

    // =A1  to  col 0, row 0  to  items[0].a = 10
    setFormula(1, 0, '=A1');

    expect(getFormulaValue(1, 0)).toBe(10);
  });

  it('evaluates =SUM(A1:A3)', () => {
    const { setFormula, getFormulaValue } = useFormulaEngine(makeParams());

    // items[0].a + items[1].a + items[2].a = 10+30+50 = 90
    setFormula(2, 0, '=SUM(A1:A3)');

    expect(getFormulaValue(2, 0)).toBe(90);
  });

  it('clears a formula when set to null', () => {
    const { setFormula, getFormulaValue, hasFormula } = useFormulaEngine(makeParams());

    setFormula(0, 0, '=1+2');
    expect(getFormulaValue(0, 0)).toBe(3);

    setFormula(0, 0, null);
    expect(getFormulaValue(0, 0)).toBeUndefined();
    expect(hasFormula(0, 0)).toBe(false);
  });

  it('returns a FormulaError for an invalid formula', () => {
    const { setFormula, getFormulaValue } = useFormulaEngine(makeParams());

    // Unclosed parenthesis  -  parse error
    setFormula(0, 0, '=SUM(A1:A3');

    const value = getFormulaValue(0, 0);
    expect(value).toBeInstanceOf(FormulaError);
  });
});

// ==========================================================================
// 3. hasFormula and getFormula
// ==========================================================================

describe('useFormulaEngine  -  hasFormula and getFormula', () => {
  it('hasFormula returns false for a cell without a formula', () => {
    const { hasFormula } = useFormulaEngine(makeParams());
    expect(hasFormula(0, 0)).toBe(false);
  });

  it('hasFormula returns true after setting a formula', () => {
    const { setFormula, hasFormula } = useFormulaEngine(makeParams());

    setFormula(0, 0, '=1+1');

    expect(hasFormula(0, 0)).toBe(true);
  });

  it('getFormula returns the original formula string', () => {
    const { setFormula, getFormula } = useFormulaEngine(makeParams());

    setFormula(0, 0, '=B1+10');

    expect(getFormula(0, 0)).toBe('=B1+10');
  });

  it('getFormula returns undefined for cells without a formula', () => {
    const { getFormula } = useFormulaEngine(makeParams());
    expect(getFormula(99, 99)).toBeUndefined();
  });
});

// ==========================================================================
// 4. onCellChanged cascade
// ==========================================================================

describe('useFormulaEngine  -  onCellChanged cascade', () => {
  it('recalculates a dependent formula when a referenced cell changes', () => {
    const mutableItems = ref<TestRow[]>([
      { id: 1, a: 10, b: 20, c: 'hello' },
      { id: 2, a: 30, b: 40, c: 'world' },
      { id: 3, a: 50, b: 60, c: 'test' },
    ]);

    const { setFormula, getFormulaValue, onCellChanged } = useFormulaEngine(
      makeParams({ items: mutableItems })
    );

    // Formula at (0,0) references B1 = col 1, row 0  to  items[0].b = 20  to  20+5=25
    setFormula(0, 0, '=B1+5');
    expect(getFormulaValue(0, 0)).toBe(25);

    // Simulate items[0].b changing from 20 to 100
    mutableItems.value = [
      { id: 1, a: 10, b: 100, c: 'hello' },
      ...mutableItems.value.slice(1),
    ];

    // Notify the engine that cell (1, 0) changed  -  col 1 (B), row 0
    onCellChanged(1, 0);

    // Formula recalculates: 100+5=105
    expect(getFormulaValue(0, 0)).toBe(105);
  });

  it('calls onFormulaRecalc with updatedCells on cascade', () => {
    const mutableItems = ref<TestRow[]>([
      { id: 1, a: 10, b: 20, c: 'hello' },
      { id: 2, a: 30, b: 40, c: 'world' },
      { id: 3, a: 50, b: 60, c: 'test' },
    ]);

    const onRecalc = jest.fn();
    const { setFormula, onCellChanged } = useFormulaEngine(
      makeParams({ items: mutableItems, onFormulaRecalc: onRecalc })
    );

    setFormula(1, 0, '=A1*2');
    // Initial setFormula triggers recalc
    expect(onRecalc).toHaveBeenCalledTimes(1);
    const firstCall = onRecalc.mock.calls[0][0];
    expect(firstCall.updatedCells).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ col: 1, row: 0, newValue: 20 }),
      ])
    );

    onRecalc.mockClear();

    // Change A1
    mutableItems.value = [
      { id: 1, a: 99, b: 20, c: 'hello' },
      ...mutableItems.value.slice(1),
    ];
    onCellChanged(0, 0);

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
    const { onCellChanged } = useFormulaEngine(
      makeParams({ onFormulaRecalc: onRecalc })
    );

    // No formulas set  -  no dependents to recalculate
    onCellChanged(0, 0);

    expect(onRecalc).not.toHaveBeenCalled();
  });
});

// ==========================================================================
// 5. initialFormulas
// ==========================================================================

describe('useFormulaEngine  -  initialFormulas', () => {
  it('loads initial formulas on first enable', () => {
    const { hasFormula, getFormula } = useFormulaEngine(
      makeParams({ initialFormulas: [{ col: 0, row: 0, formula: '=1+1' }] })
    );

    expect(hasFormula(0, 0)).toBe(true);
    expect(getFormula(0, 0)).toBe('=1+1');
  });

  it('evaluates initial formulas correctly', () => {
    const { getFormulaValue } = useFormulaEngine(
      makeParams({
        // A2 + A3 = items[1].a + items[2].a = 30+50 = 80
        initialFormulas: [{ col: 0, row: 0, formula: '=A2+A3' }],
      })
    );

    expect(getFormulaValue(0, 0)).toBe(80);
  });

  it('calls onFormulaRecalc with initial load results', () => {
    const onRecalc = jest.fn();
    useFormulaEngine(
      makeParams({
        initialFormulas: [{ col: 0, row: 0, formula: '=10*3' }],
        onFormulaRecalc: onRecalc,
      })
    );

    expect(onRecalc).toHaveBeenCalledTimes(1);
    expect(onRecalc.mock.calls[0][0].updatedCells).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ col: 0, row: 0, newValue: 30 }),
      ])
    );
  });
});

// ==========================================================================
// 6. Custom formulaFunctions
// ==========================================================================

describe('useFormulaEngine  -  custom formulaFunctions', () => {
  it('makes a custom function available in formulas', () => {
    const { setFormula, getFormulaValue } = useFormulaEngine(
      makeParams({
        formulaFunctions: {
          DOUBLE: {
            minArgs: 1,
            maxArgs: 1,
            evaluate(args: unknown[], ctx: unknown, evaluator: { evaluate: (n: unknown, c: unknown) => unknown }) {
              return (evaluator.evaluate(args[0], ctx) as number) * 2;
            },
          },
        },
      })
    );

    setFormula(0, 0, '=DOUBLE(5)');
    expect(getFormulaValue(0, 0)).toBe(10);
  });

  it('custom function receives correct cell-reference arguments', () => {
    const { setFormula, getFormulaValue } = useFormulaEngine(
      makeParams({
        formulaFunctions: {
          TRIPLE: {
            minArgs: 1,
            maxArgs: 1,
            evaluate(args: unknown[], ctx: unknown, evaluator: { evaluate: (n: unknown, c: unknown) => unknown }) {
              return (evaluator.evaluate(args[0], ctx) as number) * 3;
            },
          },
        },
      })
    );

    // =TRIPLE(A2)  to  items[1].a = 30  to  30*3 = 90
    setFormula(0, 0, '=TRIPLE(A2)');
    expect(getFormulaValue(0, 0)).toBe(90);
  });
});

// ==========================================================================
// 7. Lifecycle
// ==========================================================================

describe('useFormulaEngine  -  lifecycle', () => {
  it('disabled composable all methods return safe defaults', () => {
    const result = useFormulaEngine(makeParams({ formulas: ref(false) }));

    expect(result.enabled.value).toBe(false);
    expect(result.hasFormula(0, 0)).toBe(false);
    expect(result.getFormulaValue(0, 0)).toBeUndefined();
    expect(result.getFormula(0, 0)).toBeUndefined();
  });

  it('supports multiple formula cells in one composable', () => {
    const { setFormula, getFormulaValue, hasFormula } = useFormulaEngine(makeParams());

    setFormula(0, 0, '=1+1');   // 2
    setFormula(1, 0, '=2+3');   // 5
    setFormula(2, 1, '=A1+B1'); // 2 + 5 = 7

    expect(getFormulaValue(0, 0)).toBe(2);
    expect(getFormulaValue(1, 0)).toBe(5);
    expect(getFormulaValue(2, 1)).toBe(7);
    expect(hasFormula(0, 0)).toBe(true);
    expect(hasFormula(1, 0)).toBe(true);
    expect(hasFormula(2, 1)).toBe(true);
  });

  it('separate composable instances maintain independent state', () => {
    const a = useFormulaEngine(makeParams());
    const b = useFormulaEngine(makeParams());

    a.setFormula(0, 0, '=100');
    b.setFormula(0, 0, '=999');

    expect(a.getFormulaValue(0, 0)).toBe(100);
    expect(b.getFormulaValue(0, 0)).toBe(999);
  });
});

// ==========================================================================
// 8. Audit trail  -  getPrecedents, getDependents, getAuditTrail
// ==========================================================================

describe('useFormulaEngine  -  audit trail', () => {
  it('getPrecedents returns cells that a formula depends on', () => {
    const { setFormula, getPrecedents } = useFormulaEngine(makeParams());

    // C1 = A1 + B1  to  depends on A1 and B1
    setFormula(2, 0, '=A1+B1');

    const precedents = getPrecedents(2, 0);
    expect(precedents.length).toBeGreaterThan(0);
    expect(precedents.some((p) => p.col === 0 && p.row === 0)).toBe(true); // A1
    expect(precedents.some((p) => p.col === 1 && p.row === 0)).toBe(true); // B1
  });

  it('getDependents returns formula cells that reference a given cell', () => {
    const { setFormula, getDependents } = useFormulaEngine(makeParams());

    setFormula(2, 0, '=A1+B1');

    // A1's dependents should include C1
    const dependents = getDependents(0, 0);
    expect(dependents.some((d) => d.col === 2 && d.row === 0)).toBe(true);
  });

  it('getPrecedents returns empty array when no formula is set', () => {
    const { getPrecedents } = useFormulaEngine(makeParams());
    expect(getPrecedents(0, 0)).toEqual([]);
  });

  it('getDependents returns empty array when no formula references the cell', () => {
    const { getDependents } = useFormulaEngine(makeParams());
    expect(getDependents(99, 99)).toEqual([]);
  });

  it('getAuditTrail returns null when engine is disabled', () => {
    const { getAuditTrail } = useFormulaEngine(makeParams({ formulas: ref(false) }));
    expect(getAuditTrail(0, 0)).toBeNull();
  });

  it('getAuditTrail returns a trail with undefined formula for non-formula cells', () => {
    const { getAuditTrail } = useFormulaEngine(makeParams());
    const trail = getAuditTrail(0, 0);
    expect(trail).not.toBeNull();
    expect(trail!.target.formula).toBeUndefined();
    expect(trail!.precedents).toEqual([]);
  });

  it('getAuditTrail returns an audit trail with formula for formula cells', () => {
    const { setFormula, getAuditTrail } = useFormulaEngine(makeParams());

    setFormula(2, 0, '=A1+B1');

    const trail = getAuditTrail(2, 0);
    expect(trail).not.toBeNull();
    expect(trail!.target.formula).toBe('=A1+B1');
  });
});
