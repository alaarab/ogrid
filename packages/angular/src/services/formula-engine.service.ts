/**
 * FormulaEngineService — Angular service for integrating the formula engine with the grid.
 *
 * Lazily creates a FormulaEngine instance when configured with `formulas: true`.
 * Provides an accessor bridge between grid data and formula coordinates.
 * Uses Angular signals for reactive state.
 *
 * Port of React's useFormulaEngine hook.
 */

import { Injectable, signal, computed, DestroyRef, inject } from '@angular/core';
import { createGridDataAccessor } from '@alaarab/ogrid-core';
import type {
  IGridDataAccessor,
  IFormulaFunction,
  IRecalcResult,
  IColumnDef,
  IAuditEntry,
  IAuditTrail,
} from '@alaarab/ogrid-core';
import { FormulaEngine } from '@alaarab/ogrid-core/formula';

export interface FormulaEngineConfig {
  /** Enable formula support. */
  formulas?: boolean;
  /** Initial formulas to load on first configure. */
  initialFormulas?: Array<{ col: number; row: number; formula: string }>;
  /** Custom formula functions to register. */
  formulaFunctions?: Record<string, IFormulaFunction>;
  /** Called when recalculation produces cascading updates. */
  onFormulaRecalc?: (result: IRecalcResult) => void;
  /** Named ranges: name → cell/range reference string. */
  namedRanges?: Record<string, string>;
  /** Sheet accessors for cross-sheet references. */
  sheets?: Record<string, IGridDataAccessor>;
}

/**
 * Per-component injectable service that wraps FormulaEngine from @alaarab/ogrid-core.
 *
 * Not providedIn: 'root' — provide it per component so each grid instance
 * gets its own formula engine.
 */
@Injectable()
export class FormulaEngineService<T = unknown> {
  private destroyRef = inject(DestroyRef);

  // --- Internal state ---
  private engine: FormulaEngine | null = null;
  private initialLoaded = false;
  private onFormulaRecalcFn: ((result: IRecalcResult) => void) | undefined;

  // --- Data references (updated via configure or setData) ---
  private items: T[] = [];
  private flatColumns: IColumnDef<T>[] = [];

  // --- Signals ---

  /** Whether formula support is currently enabled. */
  readonly enabled = signal<boolean>(false);

  /** Last recalculation result, for UI to react to formula changes. */
  readonly lastRecalcResult = signal<IRecalcResult | null>(null);

  /** Number of formulas currently registered. */
  readonly formulaCount = computed(() => {
    // Re-read lastRecalcResult to ensure reactivity when formulas change
    this.lastRecalcResult();
    return this.engine?.getAllFormulas().length ?? 0;
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.engine?.clear();
      this.engine = null;
    });
  }

  /**
   * Configure the formula engine. Call this when the grid component initializes.
   *
   * Lazily creates the FormulaEngine only when `formulas: true`.
   */
  configure(options: FormulaEngineConfig): void {
    const { formulas, initialFormulas, formulaFunctions, onFormulaRecalc, namedRanges, sheets } = options;

    this.onFormulaRecalcFn = onFormulaRecalc;

    if (formulas && !this.engine) {
      // Create engine lazily
      this.engine = new FormulaEngine({
        customFunctions: formulaFunctions,
        namedRanges,
      });
      // Register sheet accessors
      if (sheets) {
        for (const [name, accessor] of Object.entries(sheets)) {
          this.engine.registerSheet(name, accessor);
        }
      }
      this.enabled.set(true);
    } else if (!formulas && this.engine) {
      // Tear down engine
      this.engine.clear();
      this.engine = null;
      this.enabled.set(false);
      this.lastRecalcResult.set(null);
      this.initialLoaded = false;
    }

    // Load initial formulas once
    if (formulas && this.engine && initialFormulas && !this.initialLoaded) {
      this.initialLoaded = true;
      const accessor = this.createAccessor();
      const result = this.engine.loadFormulas(initialFormulas, accessor);
      if (result.updatedCells.length > 0) {
        this.lastRecalcResult.set(result);
        this.onFormulaRecalcFn?.(result);
      }
    }
  }

  /**
   * Update the data references used by the accessor bridge.
   * Call this whenever the grid's items or columns change.
   */
  setData(items: T[], flatColumns: IColumnDef<T>[]): void {
    this.items = items;
    this.flatColumns = flatColumns;
  }

  /**
   * Set or clear a formula for a cell. Triggers recalculation of dependents.
   */
  setFormula(col: number, row: number, formula: string | null, accessor?: IGridDataAccessor): void {
    if (!this.engine) return;
    const acc = accessor ?? this.createAccessor();
    const result = this.engine.setFormula(col, row, formula, acc);
    if (result.updatedCells.length > 0) {
      this.lastRecalcResult.set(result);
      this.onFormulaRecalcFn?.(result);
    }
  }

  /**
   * Notify the engine that a non-formula cell's value changed.
   * Triggers recalculation of any formulas that depend on this cell.
   */
  onCellChanged(col: number, row: number, accessor?: IGridDataAccessor): void {
    if (!this.engine) return;
    const acc = accessor ?? this.createAccessor();
    const result = this.engine.onCellChanged(col, row, acc);
    if (result.updatedCells.length > 0) {
      this.lastRecalcResult.set(result);
      this.onFormulaRecalcFn?.(result);
    }
  }

  /**
   * Get the formula engine's computed value for a cell coordinate.
   */
  getValue(col: number, row: number): unknown | undefined {
    return this.engine?.getValue(col, row);
  }

  /**
   * Check if a cell has a formula.
   */
  hasFormula(col: number, row: number): boolean {
    return this.engine?.hasFormula(col, row) ?? false;
  }

  /**
   * Get the formula string for a cell.
   */
  getFormula(col: number, row: number): string | undefined {
    return this.engine?.getFormula(col, row);
  }

  /**
   * Trigger a full recalculation of all formulas.
   */
  recalcAll(accessor?: IGridDataAccessor): void {
    if (!this.engine) return;
    const acc = accessor ?? this.createAccessor();
    const result = this.engine.recalcAll(acc);
    if (result.updatedCells.length > 0) {
      this.lastRecalcResult.set(result);
      this.onFormulaRecalcFn?.(result);
    }
  }

  /**
   * Get all formulas for serialization.
   */
  getAllFormulas(): Array<{ col: number; row: number; formula: string }> {
    return this.engine?.getAllFormulas() ?? [];
  }

  /**
   * Register a custom function at runtime.
   */
  registerFunction(name: string, fn: IFormulaFunction): void {
    this.engine?.registerFunction(name, fn);
  }

  /**
   * Clear all formulas and cached values.
   */
  clear(): void {
    this.engine?.clear();
    this.lastRecalcResult.set(null);
  }

  /**
   * Define a named range.
   */
  defineNamedRange(name: string, ref: string): void {
    this.engine?.defineNamedRange(name, ref);
  }

  /**
   * Remove a named range.
   */
  removeNamedRange(name: string): void {
    this.engine?.removeNamedRange(name);
  }

  /**
   * Register a sheet accessor for cross-sheet references.
   */
  registerSheet(name: string, accessor: IGridDataAccessor): void {
    this.engine?.registerSheet(name, accessor);
  }

  /**
   * Unregister a sheet accessor.
   */
  unregisterSheet(name: string): void {
    this.engine?.unregisterSheet(name);
  }

  /**
   * Get all cells that a cell depends on (deep, transitive).
   */
  getPrecedents(col: number, row: number): IAuditEntry[] {
    return this.engine?.getPrecedents(col, row) ?? [];
  }

  /**
   * Get all cells that depend on a cell (deep, transitive).
   */
  getDependents(col: number, row: number): IAuditEntry[] {
    return this.engine?.getDependents(col, row) ?? [];
  }

  /**
   * Get full audit trail for a cell.
   */
  getAuditTrail(col: number, row: number): IAuditTrail | null {
    return this.engine?.getAuditTrail(col, row) ?? null;
  }

  // --- Private helpers ---

  /** Create a data accessor that bridges grid data to formula coordinates. */
  private createAccessor(): IGridDataAccessor {
    return createGridDataAccessor(this.items, this.flatColumns);
  }
}
