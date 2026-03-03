import { renderHook, act } from '@testing-library/react';
import { useFormulaEngine } from '../hooks/useFormulaEngine';
import type { UseFormulaEngineParams } from '../hooks/useFormulaEngine';
import { useDataGridEditing } from '../hooks/useDataGridEditing';
import type { UseDataGridEditingParams } from '../hooks/useDataGridEditing';
import type { IColumnDef } from '@alaarab/ogrid-core';
import type { IColumnDef as IReactColumnDef } from '../types';
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
    formulas: true,
    items,
    flatColumns: columns,
    ...overrides,
  };
}

// ==========================================================================
// 1. Basic initialization
// ==========================================================================

describe('useFormulaEngine  -  basic initialization', () => {
  it('returns enabled=false when formulas is undefined', () => {
    const { result } = renderHook(() =>
      useFormulaEngine(makeParams({ formulas: undefined }))
    );
    expect(result.current.enabled).toBe(false);
  });

  it('returns enabled=false when formulas is false', () => {
    const { result } = renderHook(() =>
      useFormulaEngine(makeParams({ formulas: false }))
    );
    expect(result.current.enabled).toBe(false);
  });

  it('all methods are no-ops when disabled', () => {
    const { result } = renderHook(() =>
      useFormulaEngine(makeParams({ formulas: false }))
    );
    expect(result.current.hasFormula(0, 0)).toBe(false);
    expect(result.current.getFormulaValue(0, 0)).toBeUndefined();
    expect(result.current.getFormula(0, 0)).toBeUndefined();
    // setFormula and onCellChanged should not throw
    expect(() => result.current.setFormula(0, 0, '=1')).not.toThrow();
    expect(() => result.current.onCellChanged(0, 0)).not.toThrow();
  });

  it('returns enabled=true and functional methods when formulas is true', () => {
    const { result } = renderHook(() => useFormulaEngine(makeParams()));
    expect(result.current.enabled).toBe(true);
    expect(typeof result.current.getFormulaValue).toBe('function');
    expect(typeof result.current.hasFormula).toBe('function');
    expect(typeof result.current.getFormula).toBe('function');
    expect(typeof result.current.setFormula).toBe('function');
    expect(typeof result.current.onCellChanged).toBe('function');
  });
});

// ==========================================================================
// 2. setFormula and getValue
// ==========================================================================

describe('useFormulaEngine  -  setFormula and getFormulaValue', () => {
  it('evaluates a simple arithmetic formula =1+2 to 3', () => {
    const { result } = renderHook(() => useFormulaEngine(makeParams()));

    act(() => {
      result.current.setFormula(0, 0, '=1+2');
    });

    expect(result.current.getFormulaValue(0, 0)).toBe(3);
  });

  it('evaluates a cell reference =A1 to the value of items[0].a', () => {
    const { result } = renderHook(() => useFormulaEngine(makeParams()));

    // =A1 refers to col 0, row 0 -> items[0].a = 10
    act(() => {
      result.current.setFormula(1, 0, '=A1');
    });

    expect(result.current.getFormulaValue(1, 0)).toBe(10);
  });

  it('evaluates a SUM over a range =SUM(A1:A3)', () => {
    const { result } = renderHook(() => useFormulaEngine(makeParams()));

    // SUM(A1:A3) = items[0].a + items[1].a + items[2].a = 10+30+50 = 90
    act(() => {
      result.current.setFormula(2, 0, '=SUM(A1:A3)');
    });

    expect(result.current.getFormulaValue(2, 0)).toBe(90);
  });

  it('clears a formula when set to null', () => {
    const { result } = renderHook(() => useFormulaEngine(makeParams()));

    act(() => {
      result.current.setFormula(0, 0, '=1+2');
    });
    expect(result.current.getFormulaValue(0, 0)).toBe(3);

    act(() => {
      result.current.setFormula(0, 0, null);
    });
    expect(result.current.getFormulaValue(0, 0)).toBeUndefined();
    expect(result.current.hasFormula(0, 0)).toBe(false);
  });

  it('returns a FormulaError for an invalid formula', () => {
    const { result } = renderHook(() => useFormulaEngine(makeParams()));

    // An unclosed parenthesis should produce a parse error
    act(() => {
      result.current.setFormula(0, 0, '=SUM(A1:A3');
    });

    const value = result.current.getFormulaValue(0, 0);
    expect(value).toBeInstanceOf(FormulaError);
  });
});

// ==========================================================================
// 3. hasFormula and getFormula
// ==========================================================================

describe('useFormulaEngine  -  hasFormula and getFormula', () => {
  it('hasFormula returns false for a cell without a formula', () => {
    const { result } = renderHook(() => useFormulaEngine(makeParams()));
    expect(result.current.hasFormula(0, 0)).toBe(false);
  });

  it('hasFormula returns true after setting a formula', () => {
    const { result } = renderHook(() => useFormulaEngine(makeParams()));

    act(() => {
      result.current.setFormula(0, 0, '=1+1');
    });

    expect(result.current.hasFormula(0, 0)).toBe(true);
  });

  it('getFormula returns the original formula string', () => {
    const { result } = renderHook(() => useFormulaEngine(makeParams()));

    act(() => {
      result.current.setFormula(0, 0, '=B1+10');
    });

    expect(result.current.getFormula(0, 0)).toBe('=B1+10');
  });
});

// ==========================================================================
// 4. onCellChanged cascade
// ==========================================================================

describe('useFormulaEngine  -  onCellChanged cascade', () => {
  it('recalculates a dependent formula when a referenced cell changes', () => {
    // We need mutable data so the accessor picks up the new value.
    const mutableItems: TestRow[] = [
      { id: 1, a: 10, b: 20, c: 'hello' },
      { id: 2, a: 30, b: 40, c: 'world' },
      { id: 3, a: 50, b: 60, c: 'test' },
    ];

    const { result, rerender } = renderHook(
      (props: UseFormulaEngineParams<TestRow>) => useFormulaEngine(props),
      { initialProps: makeParams({ items: mutableItems }) }
    );

    // Formula at (0,0) references B1 = col 1, row 0 -> items[0].b = 20
    // So formula evaluates to 20 + 5 = 25
    act(() => {
      result.current.setFormula(0, 0, '=B1+5');
    });
    expect(result.current.getFormulaValue(0, 0)).toBe(25);

    // Simulate items[0].b changing from 20 to 100
    mutableItems[0] = { ...mutableItems[0], b: 100 };
    rerender(makeParams({ items: mutableItems }));

    // Notify the engine that cell (1, 0) changed  -  col 1 (B), row 0
    act(() => {
      result.current.onCellChanged(1, 0);
    });

    // Formula should recalculate: 100 + 5 = 105
    expect(result.current.getFormulaValue(0, 0)).toBe(105);
  });

  it('calls onFormulaRecalc with updatedCells on cascade', () => {
    const mutableItems: TestRow[] = [
      { id: 1, a: 10, b: 20, c: 'hello' },
      { id: 2, a: 30, b: 40, c: 'world' },
      { id: 3, a: 50, b: 60, c: 'test' },
    ];

    const onRecalc = jest.fn();

    const { result, rerender } = renderHook(
      (props: UseFormulaEngineParams<TestRow>) => useFormulaEngine(props),
      {
        initialProps: makeParams({
          items: mutableItems,
          onFormulaRecalc: onRecalc,
        }),
      }
    );

    // Set a formula that references A1
    act(() => {
      result.current.setFormula(1, 0, '=A1*2');
    });

    // The setFormula call itself triggers onRecalc with the initial evaluation
    expect(onRecalc).toHaveBeenCalledTimes(1);
    const firstResult = onRecalc.mock.calls[0][0];
    expect(firstResult.updatedCells).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ col: 1, row: 0, newValue: 20 }),
      ])
    );

    onRecalc.mockClear();

    // Change the referenced cell
    mutableItems[0] = { ...mutableItems[0], a: 99 };
    rerender(
      makeParams({ items: mutableItems, onFormulaRecalc: onRecalc })
    );

    act(() => {
      result.current.onCellChanged(0, 0);
    });

    // onRecalc should fire with the recalculated formula
    expect(onRecalc).toHaveBeenCalledTimes(1);
    const cascadeResult = onRecalc.mock.calls[0][0];
    expect(cascadeResult.updatedCells).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ col: 1, row: 0, newValue: 198 }),
      ])
    );
  });

  it('does not call onFormulaRecalc when no dependents exist', () => {
    const onRecalc = jest.fn();
    const { result } = renderHook(() =>
      useFormulaEngine(makeParams({ onFormulaRecalc: onRecalc }))
    );

    // No formulas set, so changing any cell has no dependents
    act(() => {
      result.current.onCellChanged(0, 0);
    });

    expect(onRecalc).not.toHaveBeenCalled();
  });
});

// ==========================================================================
// 5. initialFormulas
// ==========================================================================

describe('useFormulaEngine  -  initialFormulas', () => {
  it('loads initial formulas on first render', () => {
    const initial = [{ col: 0, row: 0, formula: '=1+1' }];

    const { result } = renderHook(() =>
      useFormulaEngine(makeParams({ initialFormulas: initial }))
    );

    expect(result.current.hasFormula(0, 0)).toBe(true);
    expect(result.current.getFormula(0, 0)).toBe('=1+1');
  });

  it('evaluates initial formulas correctly', () => {
    const initial = [
      { col: 0, row: 0, formula: '=A2+A3' }, // items[1].a + items[2].a = 30+50 = 80
    ];

    const { result } = renderHook(() =>
      useFormulaEngine(makeParams({ initialFormulas: initial }))
    );

    expect(result.current.getFormulaValue(0, 0)).toBe(80);
  });

  it('calls onFormulaRecalc with initial load results', () => {
    const onRecalc = jest.fn();
    const initial = [{ col: 0, row: 0, formula: '=10*3' }];

    renderHook(() =>
      useFormulaEngine(
        makeParams({ initialFormulas: initial, onFormulaRecalc: onRecalc })
      )
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
// 6. formulaFunctions
// ==========================================================================

describe('useFormulaEngine  -  custom formulaFunctions', () => {
  it('makes a custom function available in formulas', () => {
    const customFunctions = {
      DOUBLE: {
        minArgs: 1,
        maxArgs: 1,
        evaluate(args: unknown[], ctx: unknown, evaluator: { evaluate: (node: unknown, ctx: unknown) => unknown }) {
          const val = evaluator.evaluate(args[0], ctx);
          return (val as number) * 2;
        },
      },
    };

    const { result } = renderHook(() =>
      useFormulaEngine(makeParams({ formulaFunctions: customFunctions }))
    );

    act(() => {
      result.current.setFormula(0, 0, '=DOUBLE(5)');
    });

    expect(result.current.getFormulaValue(0, 0)).toBe(10);
  });

  it('custom function receives correct cell-reference arguments', () => {
    const customFunctions = {
      TRIPLE: {
        minArgs: 1,
        maxArgs: 1,
        evaluate(args: unknown[], ctx: unknown, evaluator: { evaluate: (node: unknown, ctx: unknown) => unknown }) {
          const val = evaluator.evaluate(args[0], ctx);
          return (val as number) * 3;
        },
      },
    };

    const { result } = renderHook(() =>
      useFormulaEngine(makeParams({ formulaFunctions: customFunctions }))
    );

    // =TRIPLE(A2) -> items[1].a = 30 -> 30 * 3 = 90
    act(() => {
      result.current.setFormula(0, 0, '=TRIPLE(A2)');
    });

    expect(result.current.getFormulaValue(0, 0)).toBe(90);
  });
});

// ==========================================================================
// 7. Lifecycle
// ==========================================================================

describe('useFormulaEngine  -  lifecycle', () => {
  it('toggling formulas off resets enabled to false', () => {
    const { result, rerender } = renderHook(
      (props: UseFormulaEngineParams<TestRow>) => useFormulaEngine(props),
      { initialProps: makeParams({ formulas: true }) }
    );

    expect(result.current.enabled).toBe(true);

    // Set a formula first to confirm engine is active
    act(() => {
      result.current.setFormula(0, 0, '=1+1');
    });
    expect(result.current.getFormulaValue(0, 0)).toBe(2);

    // Toggle off
    rerender(makeParams({ formulas: false }));
    expect(result.current.enabled).toBe(false);
    // No-op methods should be returned
    expect(result.current.hasFormula(0, 0)).toBe(false);
  });

  it('re-enabling formulas creates a new engine (previous formulas are lost)', () => {
    const { result, rerender } = renderHook(
      (props: UseFormulaEngineParams<TestRow>) => useFormulaEngine(props),
      { initialProps: makeParams({ formulas: true }) }
    );

    act(() => {
      result.current.setFormula(0, 0, '=42');
    });
    expect(result.current.getFormulaValue(0, 0)).toBe(42);

    // Toggle off, then back on
    rerender(makeParams({ formulas: false }));
    rerender(makeParams({ formulas: true }));

    expect(result.current.enabled).toBe(true);
    // The old formula should be gone  -  new engine is empty
    expect(result.current.hasFormula(0, 0)).toBe(false);
    expect(result.current.getFormulaValue(0, 0)).toBeUndefined();
  });

  it('supports multiple formula sets across different cells', () => {
    const { result } = renderHook(() => useFormulaEngine(makeParams()));

    act(() => {
      result.current.setFormula(0, 0, '=1+1'); // (0,0) = 2
      result.current.setFormula(1, 0, '=2+3'); // (1,0) = 5
      // A1 resolves to formula value at (0,0)=2, B1 resolves to formula value at (1,0)=5
      result.current.setFormula(2, 1, '=A1+B1'); // (2,1) = 2 + 5 = 7
    });

    expect(result.current.getFormulaValue(0, 0)).toBe(2);
    expect(result.current.getFormulaValue(1, 0)).toBe(5);
    expect(result.current.getFormulaValue(2, 1)).toBe(7);
    expect(result.current.hasFormula(0, 0)).toBe(true);
    expect(result.current.hasFormula(1, 0)).toBe(true);
    expect(result.current.hasFormula(2, 1)).toBe(true);
  });
});

// ==========================================================================
// 8. Edit lifecycle integration (useDataGridEditing)
// ==========================================================================

describe('useDataGridEditing  -  formula integration', () => {
  // Cast columns to React's extended IColumnDef for useDataGridEditing compatibility
  const reactColumns = columns as unknown as IReactColumnDef<TestRow>[];

  function makeEditingParams(
    overrides: Partial<UseDataGridEditingParams<TestRow>> = {}
  ): UseDataGridEditingParams<TestRow> {
    return {
      editingCell: { rowId: 'r1', columnId: 'a' },
      setEditingCell: jest.fn(),
      pendingEditorValue: undefined,
      setPendingEditorValue: jest.fn(),
      visibleCols: reactColumns,
      itemsLength: items.length,
      onCellValueChanged: jest.fn(),
      setActiveCell: jest.fn(),
      setSelectionRange: jest.fn(),
      colOffset: 0,
      setFormula: jest.fn(),
      onFormulaCellChanged: jest.fn(),
      formulas: true,
      flatColumns: reactColumns,
      ...overrides,
    };
  }

  it('calls setFormula when commitCellEdit receives a value starting with "="', () => {
    const params = makeEditingParams();
    const { result } = renderHook(() => useDataGridEditing<TestRow>(params));

    act(() => {
      result.current.editing.commitCellEdit(
        items[0],   // item
        'a',        // columnId
        10,         // oldValue
        '=B1+5',   // newValue  -  starts with '='
        0,          // rowIndex
        0           // globalColIndex
      );
    });

    // setFormula should be called with (colIndex for 'a' = 0, rowIndex = 0, formula)
    expect(params.setFormula).toHaveBeenCalledWith(0, 0, '=B1+5');
    // onCellValueChanged should NOT be called  -  this is a formula, not a normal edit
    expect(params.onCellValueChanged).not.toHaveBeenCalled();
    // Editing should be cleared
    expect(params.setEditingCell).toHaveBeenCalledWith(null);
  });

  it('calls onCellValueChanged and onFormulaCellChanged for normal (non-formula) values', () => {
    const params = makeEditingParams();
    const { result } = renderHook(() => useDataGridEditing<TestRow>(params));

    act(() => {
      result.current.editing.commitCellEdit(
        items[0],   // item
        'a',        // columnId
        10,         // oldValue
        99,         // newValue  -  not a formula
        0,          // rowIndex
        0           // globalColIndex
      );
    });

    // Normal value: onCellValueChanged should be called
    expect(params.onCellValueChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        item: items[0],
        columnId: 'a',
        oldValue: 10,
        newValue: 99,
        rowIndex: 0,
      })
    );
    // Formula cell changed notification should also fire (for dependency cascade)
    expect(params.onFormulaCellChanged).toHaveBeenCalledWith(0, 0);
    // setFormula should NOT be called
    expect(params.setFormula).not.toHaveBeenCalled();
  });
});
