/**
 * useFormulaEngine — Vue composable for integrating the formula engine with the grid.
 *
 * Lazily creates a FormulaEngine instance when `formulas` ref is true.
 * Provides accessor bridge between grid data and formula coordinates.
 * Tree-shakeable: if `formulas` is false, no formula code is loaded.
 */

import { computed, watch, shallowRef, type Ref } from 'vue';
import {
  FormulaEngine,
  getCellValue,
  type IGridDataAccessor,
  type IFormulaFunction,
  type IRecalcResult,
  type IColumnDef,
  type IAuditEntry,
  type IAuditTrail,
} from '@alaarab/ogrid-core';
import { useLatestRef } from './useLatestRef';

export interface UseFormulaEngineParams<T> {
  /** Enable formula support. */
  formulas?: Ref<boolean>;
  /** Grid data items. */
  items: Ref<T[]>;
  /** Flat leaf columns (for mapping column index <-> columnId). */
  flatColumns: Ref<IColumnDef<T>[]>;
  /** Initial formulas to load. */
  initialFormulas?: Array<{ col: number; row: number; formula: string }>;
  /** Called when recalculation produces cascading updates. */
  onFormulaRecalc?: (result: IRecalcResult) => void;
  /** Custom formula functions. */
  formulaFunctions?: Record<string, IFormulaFunction>;
  /** Named ranges: name → cell/range reference string. */
  namedRanges?: Record<string, string>;
  /** Sheet accessors for cross-sheet references. */
  sheets?: Record<string, IGridDataAccessor>;
}

export interface UseFormulaEngineResult {
  /** Whether formula support is active. */
  enabled: Ref<boolean>;
  /** Get the formula engine's computed value for a cell coordinate. */
  getFormulaValue: (col: number, row: number) => unknown;
  /** Check if a cell has a formula. */
  hasFormula: (col: number, row: number) => boolean;
  /** Get the formula string for a cell. */
  getFormula: (col: number, row: number) => string | undefined;
  /** Set or clear a formula for a cell. Triggers recalculation. */
  setFormula: (col: number, row: number, formula: string | null) => void;
  /** Notify the engine that a non-formula cell value changed. Triggers dependent recalc. */
  onCellChanged: (col: number, row: number) => void;
  /** Get all cells that a cell depends on (deep, transitive). */
  getPrecedents: (col: number, row: number) => IAuditEntry[];
  /** Get all cells that depend on a cell (deep, transitive). */
  getDependents: (col: number, row: number) => IAuditEntry[];
  /** Get full audit trail for a cell. */
  getAuditTrail: (col: number, row: number) => IAuditTrail | null;
}

export function useFormulaEngine<T>(
  params: UseFormulaEngineParams<T>
): UseFormulaEngineResult {
  const {
    formulas,
    items,
    flatColumns,
    initialFormulas,
    onFormulaRecalc,
    formulaFunctions,
    namedRanges,
    sheets,
  } = params;

  // Stable refs for access in callbacks without reactive tracking
  const itemsRef = useLatestRef(items);
  const flatColumnsRef = useLatestRef(flatColumns);
  const onFormulaRecalcRef = useLatestRef(onFormulaRecalc);

  // Lazy engine instance — shallowRef avoids deep-reactivity on the class
  const engineRef = shallowRef<FormulaEngine | null>(null);
  let initialLoaded = false;

  const enabled = computed(() => formulas?.value ?? false);

  /**
   * Create a data accessor that bridges grid data -> formula coordinates.
   * Built fresh on each call so it reads the latest items/columns.
   */
  function createAccessor(): IGridDataAccessor {
    const currentItems = itemsRef.value;
    const currentCols = flatColumnsRef.value;
    return {
      getCellValue: (col: number, row: number): unknown => {
        if (row < 0 || row >= currentItems.length) return null;
        if (col < 0 || col >= currentCols.length) return null;
        return getCellValue(currentItems[row], currentCols[col]);
      },
      getRowCount: () => currentItems.length,
      getColumnCount: () => currentCols.length,
    };
  }

  // Watch the formulas flag to create/destroy engine
  watch(
    enabled,
    (isEnabled) => {
      if (isEnabled && !engineRef.value) {
        engineRef.value = new FormulaEngine({
          customFunctions: formulaFunctions,
          namedRanges,
        });
        // Register sheet accessors
        if (sheets) {
          for (const [name, accessor] of Object.entries(sheets)) {
            engineRef.value.registerSheet(name, accessor);
          }
        }
        // Load initial formulas on first enable
        if (initialFormulas && !initialLoaded) {
          initialLoaded = true;
          const accessor = createAccessor();
          const result = engineRef.value.loadFormulas(initialFormulas, accessor);
          if (result.updatedCells.length > 0) {
            onFormulaRecalcRef.value?.(result);
          }
        }
      } else if (!isEnabled && engineRef.value) {
        engineRef.value = null;
      }
    },
    { immediate: true }
  );

  function getFormulaValue(col: number, row: number): unknown {
    return engineRef.value?.getValue(col, row);
  }

  function hasFormula(col: number, row: number): boolean {
    return engineRef.value?.hasFormula(col, row) ?? false;
  }

  function getFormula(col: number, row: number): string | undefined {
    return engineRef.value?.getFormula(col, row);
  }

  function setFormula(col: number, row: number, formula: string | null): void {
    if (!engineRef.value) return;
    const accessor = createAccessor();
    const result = engineRef.value.setFormula(col, row, formula, accessor);
    if (result.updatedCells.length > 0) {
      onFormulaRecalcRef.value?.(result);
    }
  }

  function onCellChanged(col: number, row: number): void {
    if (!engineRef.value) return;
    const accessor = createAccessor();
    const result = engineRef.value.onCellChanged(col, row, accessor);
    if (result.updatedCells.length > 0) {
      onFormulaRecalcRef.value?.(result);
    }
  }

  function getPrecedents(col: number, row: number): IAuditEntry[] {
    return engineRef.value?.getPrecedents(col, row) ?? [];
  }

  function getDependents(col: number, row: number): IAuditEntry[] {
    return engineRef.value?.getDependents(col, row) ?? [];
  }

  function getAuditTrail(col: number, row: number): IAuditTrail | null {
    return engineRef.value?.getAuditTrail(col, row) ?? null;
  }

  return {
    enabled,
    getFormulaValue,
    hasFormula,
    getFormula,
    setFormula,
    onCellChanged,
    getPrecedents,
    getDependents,
    getAuditTrail,
  };
}
