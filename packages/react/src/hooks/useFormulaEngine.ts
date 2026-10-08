/**
 * useFormulaEngine  -  React hook for integrating the formula engine with the grid.
 *
 * Lazily creates a FormulaEngine instance when `formulas` prop is true.
 * Provides accessor bridge between grid data and formula coordinates.
 * The engine is instantiated only when `formulas` is true, but its code is
 * imported statically, so it is bundled with every grid that uses this hook.
 *
 * Coordinates are sheet coordinates: `col` indexes `flatColumns` and `row`
 * indexes `items` (OGrid passes the full data, not the sorted/filtered page).
 */

import { useRef, useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  createGridDataAccessor,
  getCellValue,
  type IGridDataAccessor,
  type IFormulaFunction,
  type IFormulaLimits,
  type IRecalcResult,
  type IAuditEntry,
  type IAuditTrail,
  type ISpillRange,
} from '@alaarab/ogrid-core';
import type { IColumnDef } from '@alaarab/ogrid-core';
import { FormulaEngine, FormulaError } from '@alaarab/ogrid-core/formula';
import { useLatestRef } from './useLatestRef';

export interface UseFormulaEngineParams<T> {
  /** Enable formula support. */
  formulas?: boolean;
  /** Grid data items. Row N of a formula reference is `items[N]`. */
  items: T[];
  /** Flat leaf columns (for mapping column index ↔ columnId). */
  flatColumns: IColumnDef<T>[];
  /** Initial formulas to load. */
  initialFormulas?: Array<{ col: number; row: number; formula: string }>;
  /** Called when recalculation produces cascading updates. */
  onFormulaRecalc?: (result: IRecalcResult) => void;
  /** Custom formula functions. Memoize the object: a new one rebuilds the engine. */
  formulaFunctions?: Record<string, IFormulaFunction>;
  /** Named ranges: name  to  cell/range reference string. */
  namedRanges?: Record<string, string>;
  /** Per-formula resource limits. Memoize the object: a changed one rebuilds the engine. */
  formulaLimits?: IFormulaLimits;
  /** Sheet accessors for cross-sheet references. Pass a new accessor when a sheet's data changes. */
  sheets?: Record<string, IGridDataAccessor>;
  /** Full local worksheet access, supplementing loaded rows and columns. */
  formulaDataAccessor?: IGridDataAccessor;
  /**
   * Treat a data value that is a string starting with '=' as that cell's
   * formula. Every such cell is loaded when the engine starts, and after that
   * the engine follows the data: a cell whose value changes to formula text
   * gets that formula, and one whose value changes from formula text to
   * anything else loses its formula. OGrid turns this on when the host owns
   * undo (`onUndo`), because the host's history then restores formulas by
   * writing their text back into the data.
   */
  formulasFromData?: boolean;
  /**
   * Whether a sheet row is hidden; SUBTOTAL 101-111 leave hidden rows out.
   * A new function recalculates every formula, so pass a stable one that
   * changes only when the hidden rows (or `items`) do.
   */
  isRowHidden?: (row: number) => boolean;
  /** Merge occupancy in sheet coordinates; every cell in a merge blocks spills. */
  isCellMerged?: (col: number, row: number) => boolean;
}

export interface UseFormulaEngineResult {
  /** Get the formula engine's computed value for a cell coordinate. */
  getFormulaValue: (col: number, row: number) => unknown;
  /** Successful spill containing the cell, including its editable anchor. */
  getSpillRange: (col: number, row: number) => ISpillRange | undefined;
  /** Check if a cell has a formula. */
  hasFormula: (col: number, row: number) => boolean;
  /** Get the formula string for a cell. */
  getFormula: (col: number, row: number) => string | undefined;
  /** Set or clear a formula for a cell. Triggers recalculation. */
  setFormula: (col: number, row: number, formula: string | null) => void;
  /**
   * Notify the engine that a non-formula cell value changed. Dependents
   * recalculate after the next render, against the data that render receives,
   * so they see the new value even when the data owner applies it with setState.
   */
  onCellChanged: (col: number, row: number) => void;
  /** Batch form of `onCellChanged`. */
  onCellsChanged: (cells: ReadonlyArray<{ col: number; row: number }>) => void;
  /** Get all cells that a cell depends on (deep, transitive). */
  getPrecedents: (col: number, row: number) => IAuditEntry[];
  /** Get all cells that depend on a cell (deep, transitive). */
  getDependents: (col: number, row: number) => IAuditEntry[];
  /** Get full audit trail for a cell. */
  getAuditTrail: (col: number, row: number) => IAuditTrail | null;
  /** Every formula the engine holds (sheet coordinates). */
  getAllFormulas: () => Array<{ col: number; row: number; formula: string }>;
  /** Replace every formula with `formulas` and recalculate (structure edits and their undo). */
  loadFormulas: (formulas: Array<{ col: number; row: number; formula: string }>) => void;
  /**
   * An evaluator for formulas stored in no cell (conditional format rules),
   * reading current values; see FormulaEngine.createDetachedEvaluator.
   * Undefined when formulas are off.
   */
  createDetachedEvaluator: (options?: { proposed?: { col: number; row: number; value: unknown; alias?: { sheet: string; col: number; row: number } }; preserveArrays?: boolean }) => ((formula: string, anchor: { col: number; row: number }, cell: { col: number; row: number }) => unknown) | undefined;
  /** Whether formula support is active. */
  enabled: boolean;
}

const NOOP_RESULT: UseFormulaEngineResult = {
  getFormulaValue: () => undefined,
  getSpillRange: () => undefined,
  hasFormula: () => false,
  getFormula: () => undefined,
  setFormula: () => {},
  onCellChanged: () => {},
  onCellsChanged: () => {},
  getPrecedents: () => [],
  getDependents: () => [],
  getAuditTrail: () => null,
  getAllFormulas: () => [],
  loadFormulas: () => {},
  createDetachedEvaluator: () => undefined,
  enabled: false,
};

const NO_SHEETS: Record<string, IGridDataAccessor> = {};

function shallowEqual(a: object | undefined, b: object | undefined): boolean {
  if (a === b) return true;
  const ra = a as Record<string, unknown> | undefined;
  const rb = b as Record<string, unknown> | undefined;
  const aKeys = Object.keys(ra ?? {});
  if (aKeys.length !== Object.keys(rb ?? {}).length) return false;
  for (const key of aKeys) {
    if (ra?.[key] !== rb?.[key]) return false;
  }
  return true;
}

function isFormulaText(value: unknown): value is string {
  return typeof value === 'string' && value.length > 1 && value.startsWith('=');
}

/** Above this many formula changes in one data update, reload the engine in bulk. */
const BULK_ADOPT_THRESHOLD = 32;

/**
 * Bring the engine's formulas in line with the formula text in `items`.
 * With `prevItems`, only rows whose object changed are compared cell by cell;
 * without it (a fresh engine) every cell is scanned.
 */
function adoptDataFormulas<T>(
  engine: FormulaEngine,
  prevItems: T[] | null,
  items: T[],
  flatColumns: IColumnDef<T>[],
  accessor: IGridDataAccessor,
): IRecalcResult {
  const set: Array<{ col: number; row: number; formula: string | null }> = [];
  for (let row = 0; row < items.length; row++) {
    const item = items[row];
    if (item === undefined) continue;
    const prevItem = prevItems ? prevItems[row] : undefined;
    if (prevItems && prevItem === item) continue;
    for (let col = 0; col < flatColumns.length; col++) {
      const colDef = flatColumns[col];
      if (colDef === undefined) continue;
      const value = getCellValue(item, colDef);
      if (isFormulaText(value)) {
        if (engine.getFormula(col, row) !== value) set.push({ col, row, formula: value });
      } else if (
        prevItem !== undefined &&
        isFormulaText(getCellValue(prevItem, colDef)) &&
        engine.hasFormula(col, row)
      ) {
        set.push({ col, row, formula: null });
      }
    }
  }
  if (set.length === 0) return { updatedCells: [] };
  if (set.length > BULK_ADOPT_THRESHOLD) {
    const merged = new Map<string, { col: number; row: number; formula: string }>();
    for (const f of engine.getAllFormulas()) merged.set(`${f.col}:${f.row}`, f);
    for (const f of set) {
      const key = `${f.col}:${f.row}`;
      if (f.formula === null) merged.delete(key);
      else merged.set(key, { col: f.col, row: f.row, formula: f.formula });
    }
    return engine.loadFormulas(Array.from(merged.values()), accessor);
  }
  const updatedCells: IRecalcResult['updatedCells'] = [];
  let result: IRecalcResult = { updatedCells };
  for (const f of set) {
    const oldValue = engine.getValue(f.col, f.row);
    result = engine.setFormula(f.col, f.row, f.formula, accessor);
    updatedCells.push(...result.updatedCells);
    // A different formula may have the same result. The document still needs
    // its current cache after invalidating the previous formula's output.
    if (f.formula && !result.updatedCells.some(cell => cell.col === f.col && cell.row === f.row)) {
      updatedCells.push({ cellKey: `${f.col},${f.row}`, col: f.col, row: f.row, oldValue, newValue: engine.getValue(f.col, f.row) });
    }
  }
  return { ...result, updatedCells };
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a instanceof FormulaError && b instanceof FormulaError) return a.type === b.type;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return false;
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
    formulaLimits,
    sheets,
    formulasFromData = false,
    isRowHidden,
    isCellMerged,
    formulaDataAccessor,
  } = params;

  // Refs for stable access in callbacks
  const itemsRef = useLatestRef(items);
  const flatColumnsRef = useLatestRef(flatColumns);
  const onFormulaRecalcRef = useLatestRef(onFormulaRecalc);
  const isRowHiddenRef = useLatestRef(isRowHidden);
  const isCellMergedRef = useLatestRef(isCellMerged);
  const formulaDataAccessorRef = useLatestRef(formulaDataAccessor);

  // Lazy engine instance  -  persists across renders, created once when formulas is enabled
  const engineRef = useRef<FormulaEngine | null>(null);
  // Settings the engine was built with: functions and named ranges are read at parse time.
  const engineSettingsRef = useRef<{
    formulaFunctions?: Record<string, IFormulaFunction>;
    namedRanges?: Record<string, string>;
    formulaLimits?: IFormulaLimits;
  }>({});

  // Create or destroy engine based on `formulas` prop
  if (formulas && !engineRef.current) {
    engineRef.current = new FormulaEngine({
      customFunctions: formulaFunctions,
      namedRanges,
      limits: formulaLimits,
    });
    engineSettingsRef.current = { formulaFunctions, namedRanges, formulaLimits };
  } else if (!formulas && engineRef.current) {
    engineRef.current = null;
  }
  const engine = engineRef.current;

  // Create a data accessor that bridges grid data  to  formula coordinates
  const createAccessor = useCallback(
    (): IGridDataAccessor => {
      const accessor = createGridDataAccessor(itemsRef.current, flatColumnsRef.current);
      const full = formulaDataAccessorRef.current;
      return {
        ...accessor,
        getCellValue: (col, row) => row < itemsRef.current.length && col < flatColumnsRef.current.length
          ? accessor.getCellValue(col, row) : full?.getCellValue(col, row),
        getRowCount: () => Math.max(accessor.getRowCount(), full?.getRowCount() ?? 0),
        getColumnCount: () => Math.max(accessor.getColumnCount(), full?.getColumnCount() ?? 0),
        isCellOccupied: full?.isCellOccupied,
        isRowHidden: isRowHiddenRef.current,
        isCellMerged: (col, row) => !!(isCellMergedRef.current?.(col, row) || full?.isCellMerged?.(col, row)),
      };
    },
    [itemsRef, flatColumnsRef, isRowHiddenRef, isCellMergedRef, formulaDataAccessorRef],
  );

  const reportedSpillsRef = useRef<ISpillRange[]>([]);
  const report = useCallback((result: IRecalcResult): void => {
    const previous = reportedSpillsRef.current;
    const next = result.spillRanges;
    const spillsChanged = next !== undefined && (previous.length !== next.length || next.some((range, i) => {
      const old = previous[i];
      return !old || old.anchorCol !== range.anchorCol || old.anchorRow !== range.anchorRow || old.endCol !== range.endCol || old.endRow !== range.endRow;
    }));
    if (next) reportedSpillsRef.current = next;
    if (result.updatedCells.length > 0 || spillsChanged) onFormulaRecalcRef.current?.(result);
  }, [onFormulaRecalcRef]);

  // Register sheet accessors. Tracks which engine they were registered on, so a
  // new engine (formulas toggled off and on, or rebuilt below) gets them too.
  const registeredSheetsRef = useRef<Record<string, IGridDataAccessor>>(NO_SHEETS);
  const sheetsEngineRef = useRef<FormulaEngine | null>(null);
  useLayoutEffect(() => {
    if (!engine) return;
    const prev = sheetsEngineRef.current === engine ? registeredSheetsRef.current : NO_SHEETS;
    const next = sheets ?? NO_SHEETS;
    sheetsEngineRef.current = engine;
    registeredSheetsRef.current = next;
    const changed: string[] = [];
    for (const name of Object.keys(prev)) {
      if (!(name in next)) {
        engine.unregisterSheet(name);
        changed.push(name);
      }
    }
    for (const [name, accessor] of Object.entries(next)) {
      if (prev[name] !== accessor) {
        engine.registerSheet(name, accessor);
        changed.push(name);
      }
    }
    // Formulas reading an added, replaced or removed sheet must recalculate.
    if (changed.length === 0) return;
    const accessor = createAccessor();
    const updatedCells: IRecalcResult['updatedCells'] = [];
    let result: IRecalcResult = { updatedCells };
    for (const name of changed) {
      result = engine.onSheetChanged(name, accessor);
      updatedCells.push(...result.updatedCells);
    }
    report({ ...result, updatedCells });
  }, [engine, sheets, createAccessor, report]);

  // Load initial formulas once per engine (so again after formulas are toggled off and on)
  const initialLoadedEngineRef = useRef<FormulaEngine | null>(null);
  useLayoutEffect(() => {
    if (!engine || !initialFormulas || initialLoadedEngineRef.current === engine) return;
    initialLoadedEngineRef.current = engine;
    report(engine.loadFormulas(initialFormulas, createAccessor()));
  }, [engine, initialFormulas, createAccessor, report]);

  // New custom functions, named ranges or limits: rebuild the engine and re-parse
  // every formula against them, keeping the formulas and registered sheets.
  useLayoutEffect(() => {
    const current = engineRef.current;
    if (!current) return;
    const applied = engineSettingsRef.current;
    if (
      shallowEqual(applied.formulaFunctions, formulaFunctions) &&
      shallowEqual(applied.namedRanges, namedRanges) &&
      shallowEqual(applied.formulaLimits, formulaLimits)
    ) return;
    const next = new FormulaEngine({ customFunctions: formulaFunctions, namedRanges, limits: formulaLimits });
    engineSettingsRef.current = { formulaFunctions, namedRanges, formulaLimits };
    for (const [name, accessor] of Object.entries(registeredSheetsRef.current)) next.registerSheet(name, accessor);
    if (sheetsEngineRef.current === current) sheetsEngineRef.current = next;
    if (initialLoadedEngineRef.current === current) initialLoadedEngineRef.current = next;
    engineRef.current = next;
    const result = next.loadFormulas(current.getAllFormulas(), createAccessor());
    // A fresh engine cannot report children that belonged only to its
    // predecessor. Include them so serializers clear caches after a resize.
    const reported = new Set(result.updatedCells.map(cell => cell.cellKey));
    for (const formula of current.getAllFormulas()) {
      const spill = current.getSpillRange(formula.col, formula.row);
      if (!spill) continue;
      for (let row = spill.anchorRow; row <= spill.endRow; row++) for (let col = spill.anchorCol; col <= spill.endCol; col++) {
        const cellKey = `${col},${row}`;
        if (!reported.has(cellKey)) result.updatedCells.push({ cellKey, col, row, oldValue: current.getValue(col, row), newValue: next.getValue(col, row) });
      }
    }
    // Report only the cells whose value differs from the old engine's.
    report({
      ...result,
      updatedCells: result.updatedCells
        .map((c) => ({ ...c, oldValue: current.getValue(c.col, c.row) }))
        .filter((c) => !sameValue(c.oldValue, c.newValue)),
    });
  }, [formulaFunctions, namedRanges, formulaLimits, createAccessor, report]);

  // --- Dependent recalculation ---
  // A consumer's onCellValueChanged usually applies the value with setState, so
  // recalculating inside the event handler reads the pre-edit data. Notifications
  // are queued and flushed after the next render instead, and a new `items` array
  // (an edit, undo, or external update) recalculates every formula against it.
  const pendingCellsRef = useRef<Array<{ col: number; row: number }>>([]);
  const [pendingTick, setPendingTick] = useState(0);
  const syncedItemsRef = useRef(items);
  const syncedColumnsRef = useRef(flatColumns);
  const syncedHiddenRef = useRef(isRowHidden);
  const syncedMergedRef = useRef(isCellMerged);
  // Engine whose formulas were last brought in line with the data (formulasFromData).
  const dataFormulasEngineRef = useRef<FormulaEngine | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: pendingTick is the deliberate trigger that flushes queued notifications; engine re-runs it when formulas are switched on so formulasFromData loads the data's formulas
  useLayoutEffect(() => {
    const prevItems = syncedItemsRef.current;
    const columnsChanged = syncedColumnsRef.current !== flatColumns;
    // Hidden rows changing re-evaluates SUBTOTAL 101-111 like a data change.
    const hiddenChanged = syncedHiddenRef.current !== isRowHidden;
    const dataChanged = prevItems !== items || columnsChanged || hiddenChanged || syncedMergedRef.current !== isCellMerged;
    syncedItemsRef.current = items;
    syncedColumnsRef.current = flatColumns;
    syncedHiddenRef.current = isRowHidden;
    syncedMergedRef.current = isCellMerged;
    const pending = pendingCellsRef.current;
    pendingCellsRef.current = [];
    const current = engineRef.current;
    if (!current) return;
    let adopted: IRecalcResult = { updatedCells: [] };
    if (formulasFromData) {
      const fresh = dataFormulasEngineRef.current !== current;
      dataFormulasEngineRef.current = current;
      if (fresh || dataChanged) {
        adopted = adoptDataFormulas(current, fresh || columnsChanged ? null : prevItems, items, flatColumns, createAccessor());
        if (!dataChanged) report(adopted);
      }
    } else {
      dataFormulasEngineRef.current = null;
    }
    if (dataChanged) {
      const result = current.recalcAll(createAccessor());
      // Adopted formulas already changed their values, so the recalc alone would not report them.
      report({ ...result, updatedCells: [...adopted.updatedCells, ...result.updatedCells.filter((c) => !sameValue(c.oldValue, c.newValue))] });
    } else if (pending.length > 0) {
      report(current.onCellsChanged(pending, createAccessor()));
    }
  }, [items, flatColumns, pendingTick, createAccessor, report, formulasFromData, engine, isRowHidden, isCellMerged]);

  const getFormulaValue = useCallback((col: number, row: number): unknown => {
    return engineRef.current?.getValue(col, row);
  }, []);

  const getSpillRange = useCallback((col: number, row: number) => engineRef.current?.getSpillRange(col, row), []);

  const hasFormula = useCallback((col: number, row: number): boolean => {
    return engineRef.current?.hasFormula(col, row) ?? false;
  }, []);

  const getFormula = useCallback((col: number, row: number): string | undefined => {
    return engineRef.current?.getFormula(col, row);
  }, []);

  const setFormula = useCallback((col: number, row: number, formula: string | null): void => {
    if (!engineRef.current) return;
    report(engineRef.current.setFormula(col, row, formula, createAccessor()));
  }, [createAccessor, report]);

  const onCellsChanged = useCallback((cells: ReadonlyArray<{ col: number; row: number }>): void => {
    if (!engineRef.current || cells.length === 0) return;
    for (const cell of cells) pendingCellsRef.current.push({ col: cell.col, row: cell.row });
    setPendingTick((t) => t + 1);
  }, []);

  const onCellChanged = useCallback((col: number, row: number): void => {
    onCellsChanged([{ col, row }]);
  }, [onCellsChanged]);

  const getPrecedents = useCallback((col: number, row: number): IAuditEntry[] => {
    return engineRef.current?.getPrecedents(col, row) ?? [];
  }, []);

  const getDependents = useCallback((col: number, row: number): IAuditEntry[] => {
    return engineRef.current?.getDependents(col, row) ?? [];
  }, []);

  const getAuditTrail = useCallback((col: number, row: number): IAuditTrail | null => {
    return engineRef.current?.getAuditTrail(col, row) ?? null;
  }, []);

  const getAllFormulas = useCallback(
    (): Array<{ col: number; row: number; formula: string }> => engineRef.current?.getAllFormulas() ?? [],
    []
  );

  const loadFormulas = useCallback((list: Array<{ col: number; row: number; formula: string }>): void => {
    if (!engineRef.current) return;
    report(engineRef.current.loadFormulas(list, createAccessor()));
  }, [createAccessor, report]);

  const createDetachedEvaluator = useCallback(
    (options?: { proposed?: { col: number; row: number; value: unknown; alias?: { sheet: string; col: number; row: number } }; preserveArrays?: boolean }) => engineRef.current?.createDetachedEvaluator(createAccessor(), options),
    [createAccessor]
  );

  // Memoized so consumers' memos keyed on the result don't rebuild every render.
  const result = useMemo<UseFormulaEngineResult>(() => ({
    getFormulaValue,
    hasFormula,
    getSpillRange,
    getFormula,
    setFormula,
    onCellChanged,
    onCellsChanged,
    getPrecedents,
    getDependents,
    getAuditTrail,
    getAllFormulas,
    loadFormulas,
    createDetachedEvaluator,
    enabled: true,
  }), [getFormulaValue, hasFormula, getSpillRange, getFormula, setFormula, onCellChanged, onCellsChanged, getPrecedents, getDependents, getAuditTrail, getAllFormulas, loadFormulas, createDetachedEvaluator]);

  return formulas ? result : NOOP_RESULT;
}
