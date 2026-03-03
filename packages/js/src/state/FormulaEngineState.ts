import type {
  IGridDataAccessor,
  IFormulaFunction,
  IRecalcResult,
  IAuditEntry,
  IAuditTrail,
} from '@alaarab/ogrid-core';
import { FormulaEngine } from '@alaarab/ogrid-core/formula';
import { EventEmitter } from './EventEmitter';

/** Options for FormulaEngineState. */
export interface FormulaEngineStateOptions {
  /** Enable formula support. Engine is only created when true. */
  formulas?: boolean;
  /** Formulas to load on initialization (requires an accessor via `initialize()`). */
  initialFormulas?: Array<{ col: number; row: number; formula: string }>;
  /** Custom formula functions to register with the engine. */
  formulaFunctions?: Record<string, IFormulaFunction>;
  /** Callback invoked after every recalculation. */
  onFormulaRecalc?: (result: IRecalcResult) => void;
  /** Named ranges: name  to  cell/range reference string. */
  namedRanges?: Record<string, string>;
  /** Sheet accessors for cross-sheet references. */
  sheets?: Record<string, IGridDataAccessor>;
}

/**
 * FormulaEngineState  -  wraps the core `FormulaEngine` for the vanilla JS grid.
 *
 * Follows the same EventEmitter pattern as other JS state classes. The engine
 * is lazily created only when `formulas` is true in the options, keeping the
 * cost at zero for grids that don't use formulas.
 *
 * ## Events
 * - `formulaRecalc`  -  emitted after every recalculation with `IRecalcResult`.
 */
export class FormulaEngineState {
  private emitter = new EventEmitter<{ formulaRecalc: IRecalcResult }>();
  private engine: FormulaEngine | null = null;
  private readonly options: FormulaEngineStateOptions;

  constructor(options: FormulaEngineStateOptions) {
    this.options = options;

    if (options.formulas) {
      this.engine = new FormulaEngine({
        customFunctions: options.formulaFunctions,
        namedRanges: options.namedRanges,
      });
      // Register sheet accessors
      if (options.sheets) {
        for (const [name, accessor] of Object.entries(options.sheets)) {
          this.engine.registerSheet(name, accessor);
        }
      }
    }
  }

  /**
   * Initialize with an accessor  -  loads `initialFormulas` if provided.
   * Must be called after the grid data is available so the accessor is valid.
   */
  initialize(accessor: IGridDataAccessor): void {
    if (!this.engine || !this.options.initialFormulas?.length) return;

    const result = this.engine.loadFormulas(this.options.initialFormulas, accessor);
    if (result.updatedCells.length > 0) {
      this.emitRecalc(result);
    }
  }

  /**
   * Set or clear a formula for a cell. Triggers recalculation of dependents
   * and emits `formulaRecalc`.
   */
  setFormula(
    col: number,
    row: number,
    formula: string | null,
    accessor: IGridDataAccessor
  ): IRecalcResult | undefined {
    if (!this.engine) return undefined;

    const result = this.engine.setFormula(col, row, formula, accessor);
    if (result.updatedCells.length > 0) {
      this.emitRecalc(result);
    }
    return result;
  }

  /**
   * Notify the engine that a non-formula cell's value changed.
   * Triggers recalculation of any formulas that depend on the changed cell.
   */
  onCellChanged(
    col: number,
    row: number,
    accessor: IGridDataAccessor
  ): IRecalcResult | undefined {
    if (!this.engine) return undefined;

    const result = this.engine.onCellChanged(col, row, accessor);
    if (result.updatedCells.length > 0) {
      this.emitRecalc(result);
    }
    return result;
  }

  /** Get the computed value for a formula cell (or undefined if no formula). */
  getValue(col: number, row: number): unknown | undefined {
    return this.engine?.getValue(col, row);
  }

  /** Check if a cell has a formula. */
  hasFormula(col: number, row: number): boolean {
    return this.engine?.hasFormula(col, row) ?? false;
  }

  /** Get the formula string for a cell (or undefined if no formula). */
  getFormula(col: number, row: number): string | undefined {
    return this.engine?.getFormula(col, row);
  }

  /** Whether the formula engine is active. */
  isEnabled(): boolean {
    return this.engine !== null;
  }

  /** Define a named range. */
  defineNamedRange(name: string, ref: string): void {
    this.engine?.defineNamedRange(name, ref);
  }

  /** Remove a named range. */
  removeNamedRange(name: string): void {
    this.engine?.removeNamedRange(name);
  }

  /** Register a sheet accessor for cross-sheet references. */
  registerSheet(name: string, accessor: IGridDataAccessor): void {
    this.engine?.registerSheet(name, accessor);
  }

  /** Unregister a sheet accessor. */
  unregisterSheet(name: string): void {
    this.engine?.unregisterSheet(name);
  }

  /** Get all cells that a cell depends on (deep, transitive). */
  getPrecedents(col: number, row: number): IAuditEntry[] {
    return this.engine?.getPrecedents(col, row) ?? [];
  }

  /** Get all cells that depend on a cell (deep, transitive). */
  getDependents(col: number, row: number): IAuditEntry[] {
    return this.engine?.getDependents(col, row) ?? [];
  }

  /** Get full audit trail for a cell. */
  getAuditTrail(col: number, row: number): IAuditTrail | null {
    return this.engine?.getAuditTrail(col, row) ?? null;
  }

  /** Subscribe to the `formulaRecalc` event. Returns an unsubscribe function. */
  onFormulaRecalc(handler: (result: IRecalcResult) => void): () => void {
    this.emitter.on('formulaRecalc', handler);
    return () => this.emitter.off('formulaRecalc', handler);
  }

  /** Clean up all listeners. */
  destroy(): void {
    this.engine = null;
    this.emitter.removeAllListeners();
  }

  // --- Private ---

  private emitRecalc(result: IRecalcResult): void {
    this.options.onFormulaRecalc?.(result);
    this.emitter.emit('formulaRecalc', result);
  }
}
