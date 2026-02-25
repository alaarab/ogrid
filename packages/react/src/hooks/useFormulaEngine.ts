/**
 * useFormulaEngine — React hook for integrating the formula engine with the grid.
 *
 * Lazily creates a FormulaEngine instance when `formulas` prop is true.
 * Provides accessor bridge between grid data and formula coordinates.
 * Tree-shakeable: if `formulas` is false, no formula code is loaded.
 */

import { useRef, useCallback, useEffect } from 'react';
import {
  FormulaEngine,
  type IGridDataAccessor,
  type IFormulaFunction,
  type IRecalcResult,
  type IAuditEntry,
  type IAuditTrail,
} from '@alaarab/ogrid-core';
import type { IColumnDef } from '@alaarab/ogrid-core';
import { createGridDataAccessor } from '@alaarab/ogrid-core';
import { useLatestRef } from './useLatestRef';

export interface UseFormulaEngineParams<T> {
  /** Enable formula support. */
  formulas?: boolean;
  /** Grid data items. */
  items: T[];
  /** Flat leaf columns (for mapping column index ↔ columnId). */
  flatColumns: IColumnDef<T>[];
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
  /** Whether formula support is active. */
  enabled: boolean;
}

const NOOP_RESULT: UseFormulaEngineResult = {
  getFormulaValue: () => undefined,
  hasFormula: () => false,
  getFormula: () => undefined,
  setFormula: () => {},
  onCellChanged: () => {},
  getPrecedents: () => [],
  getDependents: () => [],
  getAuditTrail: () => null,
  enabled: false,
};

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

  // Refs for stable access in callbacks
  const itemsRef = useLatestRef(items);
  const flatColumnsRef = useLatestRef(flatColumns);
  const onFormulaRecalcRef = useLatestRef(onFormulaRecalc);

  // Lazy engine instance — persists across renders, created once when formulas is enabled
  const engineRef = useRef<FormulaEngine | null>(null);

  // Create or destroy engine based on `formulas` prop
  if (formulas && !engineRef.current) {
    engineRef.current = new FormulaEngine({
      customFunctions: formulaFunctions,
      namedRanges,
    });
  } else if (!formulas && engineRef.current) {
    engineRef.current = null;
  }

  // Register sheet accessors
  useEffect(() => {
    if (!engineRef.current || !sheets) return;
    for (const [name, accessor] of Object.entries(sheets)) {
      engineRef.current.registerSheet(name, accessor);
    }
    return () => {
      if (!engineRef.current || !sheets) return;
      for (const name of Object.keys(sheets)) {
        engineRef.current.unregisterSheet(name);
      }
    };
  }, [sheets]);

  // Create a data accessor that bridges grid data → formula coordinates
  const createAccessor = useCallback(
    (): IGridDataAccessor => createGridDataAccessor(itemsRef.current, flatColumnsRef.current),
    [itemsRef, flatColumnsRef],
  );

  // Load initial formulas on first enable
  const initialLoadedRef = useRef(false);
  useEffect(() => {
    if (formulas && engineRef.current && initialFormulas && !initialLoadedRef.current) {
      initialLoadedRef.current = true;
      const accessor = createAccessor();
      const result = engineRef.current.loadFormulas(initialFormulas, accessor);
      if (result.updatedCells.length > 0) {
        onFormulaRecalcRef.current?.(result);
      }
    }
  }, [formulas, initialFormulas, createAccessor, onFormulaRecalcRef]);

  const getFormulaValue = useCallback((col: number, row: number): unknown => {
    return engineRef.current?.getValue(col, row);
  }, []);

  const hasFormula = useCallback((col: number, row: number): boolean => {
    return engineRef.current?.hasFormula(col, row) ?? false;
  }, []);

  const getFormula = useCallback((col: number, row: number): string | undefined => {
    return engineRef.current?.getFormula(col, row);
  }, []);

  const setFormula = useCallback((col: number, row: number, formula: string | null): void => {
    if (!engineRef.current) return;
    const accessor = createAccessor();
    const result = engineRef.current.setFormula(col, row, formula, accessor);
    if (result.updatedCells.length > 0) {
      onFormulaRecalcRef.current?.(result);
    }
  }, [createAccessor, onFormulaRecalcRef]);

  const onCellChanged = useCallback((col: number, row: number): void => {
    if (!engineRef.current) return;
    const accessor = createAccessor();
    const result = engineRef.current.onCellChanged(col, row, accessor);
    if (result.updatedCells.length > 0) {
      onFormulaRecalcRef.current?.(result);
    }
  }, [createAccessor, onFormulaRecalcRef]);

  const getPrecedents = useCallback((col: number, row: number): IAuditEntry[] => {
    return engineRef.current?.getPrecedents(col, row) ?? [];
  }, []);

  const getDependents = useCallback((col: number, row: number): IAuditEntry[] => {
    return engineRef.current?.getDependents(col, row) ?? [];
  }, []);

  const getAuditTrail = useCallback((col: number, row: number): IAuditTrail | null => {
    return engineRef.current?.getAuditTrail(col, row) ?? null;
  }, []);

  if (!formulas) return NOOP_RESULT;
  return {
    getFormulaValue,
    hasFormula,
    getFormula,
    setFormula,
    onCellChanged,
    getPrecedents,
    getDependents,
    getAuditTrail,
    enabled: true,
  };
}
