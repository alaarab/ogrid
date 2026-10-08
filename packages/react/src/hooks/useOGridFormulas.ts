import * as React from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { getCellValue } from '../utils';
import { useFormulaBar } from './useFormulaBar';
import { useFormulaEngine } from './useFormulaEngine';
import { useLatestRef } from './useLatestRef';
import { useOGridActiveCell } from './useOGridActiveCell';
import { formulasFollowData } from './undoRouting';
import { FormulaBar } from '../components/FormulaBar';
import type { UseFormulaBarResult } from './useFormulaBar';
import type { UseFormulaEngineResult } from './useFormulaEngine';
import type { UseOGridActiveCellState } from './useOGridActiveCell';
import type { UseOGridNameBoxResult } from './useOGridNameBox';
import type { IColumnDef, IFormulaRowMap, IRecalcResult } from '@alaarab/ogrid-core';
import type { IFormulaCellWriter, IOGridProps } from '../types';

export interface UseOGridFormulaBarState {
  formulaBarState: UseFormulaBarResult;
  /** The grid hands its own edit path back through this ref (value parsing, undo, engine notification). */
  formulaCellWriterRef: React.MutableRefObject<IFormulaCellWriter | null>;
  /** Formula bar element, or `undefined` when formulas are off. */
  formulaBarEl: React.ReactNode;
}

/**
 * Formula bar wiring. The active cell's coordinates are sheet coordinates
 * (they come from the name box reference). The lookups depend on the data and
 * `formulaVersion` so the bar's text refreshes when the cell's value or
 * formula changes.
 */
export function useOGridFormulaBar<T>(
  formulas: boolean | undefined,
  engine: Pick<UseFormulaEngineResult, 'enabled' | 'getFormula' | 'getSpillRange'>,
  /** Bumped on every recalc or formula edit; refreshes the bar's text. */
  formulaVersion: number,
  sheetItems: T[],
  columns: IColumnDef<T>[],
  activeCell: Pick<UseOGridActiveCellState, 'activeCellRef' | 'activeCellCoords'>,
  /** Name box navigation; without it the formula bar's name box is read-only. */
  onNameBoxNavigate?: (text: string) => boolean,
): UseOGridFormulaBarState {
  const engineEnabled = engine.enabled;
  const engineGetFormula = engine.getFormula;
  const engineGetSpillRange = engine.getSpillRange;
  const { activeCellRef, activeCellCoords } = activeCell;
  const getRawValue = useCallback((col: number, row: number): unknown => {
    const item = sheetItems[row];
    const colDef = columns[col];
    if (item === undefined || colDef === undefined) return undefined;
    return getCellValue(item, colDef);
  }, [sheetItems, columns]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: formulaVersion is the deliberate trigger — a recalc or formula edit must refresh the bar's text
  const getFormulaForBar = useCallback(
    (col: number, row: number) => {
      const spill = engineGetSpillRange?.(col, row);
      return engineGetFormula(spill?.anchorCol ?? col, spill?.anchorRow ?? row);
    },
    [engineGetFormula, engineGetSpillRange, formulaVersion]
  );
  // Commits go through the grid's own edit path, which the grid hands back through this ref.
  const formulaCellWriterRef = useRef<IFormulaCellWriter | null>(null);
  const writeFromBar = useCallback((col: number, row: number, formula: string | null) => {
    // A null formula comes paired with a plain-value commit, and writing that
    // value clears the formula, so there is nothing to do for it here.
    if (formula !== null) formulaCellWriterRef.current?.write(col, row, formula);
  }, []);
  const writeValueFromBar = useCallback((col: number, row: number, value: unknown) => {
    formulaCellWriterRef.current?.write(col, row, value == null ? '' : String(value));
  }, []);

  const formulaBarState = useFormulaBar({
    activeCol: activeCellCoords?.col ?? null,
    activeRow: activeCellCoords?.row ?? null,
    activeCellRef,
    getFormula: engineEnabled ? getFormulaForBar : undefined,
    getRawValue,
    setFormula: engineEnabled ? writeFromBar : undefined,
    onCellValueChanged: writeValueFromBar,
  });
  // The bar only enters edit mode on a cell the grid lets the user edit.
  const activeCellCoordsRef = useLatestRef(activeCellCoords);
  const barStartEditing = formulaBarState.startEditing;
  const startFormulaBarEditing = useCallback(() => {
    const coords = activeCellCoordsRef.current;
    if (coords && formulaCellWriterRef.current?.canEdit(coords.col, coords.row)) barStartEditing();
  }, [activeCellCoordsRef, barStartEditing]);

  // Enter / Escape in the bar hand focus back to the active cell, as an inline editor does.
  const returnFocusToGrid = useCallback(() => formulaCellWriterRef.current?.focusActiveCell?.(), []);

  const activeSpill = activeCellCoords && engineGetSpillRange?.(activeCellCoords.col, activeCellCoords.row);
  const spillChild = !!activeSpill && (activeSpill.anchorCol !== activeCellCoords?.col || activeSpill.anchorRow !== activeCellCoords?.row);
  const formulaBarEl = useMemo(() => {
    if (!formulas) return undefined;
    return React.createElement(FormulaBar, {
      cellRef: formulaBarState.cellRef,
      spillChild,
      formulaText: formulaBarState.formulaText,
      isEditing: formulaBarState.isEditing,
      onInputChange: formulaBarState.onInputChange,
      onCommit: formulaBarState.onCommit,
      onCancel: formulaBarState.onCancel,
      startEditing: startFormulaBarEditing,
      inputRef: formulaBarState.inputRef,
      onReturnFocus: returnFocusToGrid,
      onNameBoxNavigate,
    });
  }, [formulas, spillChild, formulaBarState.cellRef, formulaBarState.formulaText, formulaBarState.isEditing, formulaBarState.onInputChange, formulaBarState.onCommit, formulaBarState.onCancel, startFormulaBarEditing, formulaBarState.inputRef, returnFocusToGrid, onNameBoxNavigate]);

  return { formulaBarState, formulaCellWriterRef, formulaBarEl };
}

/**
 * Formula engine wiring (opt-in; always bundled, only instantiated when
 * `formulas` is on), the active cell reference, the formula bar, and the
 * formula props DataGridTable receives. A host that owns undo (`onUndo`)
 * makes the engine follow formula text in the data (see formulasFollowData).
 */
export function useOGridFormulas<T>(
  props: Pick<
    IOGridProps<T>,
    'formulas' | 'initialFormulas' | 'onFormulaRecalc' | 'formulaFunctions' | 'namedRanges' | 'formulaLimits' | 'sheets' | 'onUndo' | 'mergedCells' | 'getRowId' | 'formulaDataAccessor'
  >,
  sheetItems: T[],
  columns: IColumnDef<T>[],
  formulaRowMap: IFormulaRowMap | undefined,
  nameBox?: Pick<UseOGridNameBoxResult, 'navigate'>,
  /** Whether a sheet row is hidden (SUBTOTAL 101-111). */
  isRowHidden?: (row: number) => boolean,
) {
  const { formulas, initialFormulas, onFormulaRecalc, formulaFunctions, namedRanges, formulaLimits, sheets } = props;
  const { mergedCells, getRowId } = props;
  const isCellMerged = useMemo(() => {
    if (!formulas || !mergedCells?.length) return undefined;
    const rows = new Map(sheetItems.map((item, row) => [getRowId(item), row]));
    const cols = new Map(columns.map((column, col) => [column.columnId, col]));
    const bounds = mergedCells.map(merge => ({
      row: rows.get(merge.rowId) ?? -1, col: cols.get(merge.columnId) ?? -1,
      rows: merge.rowSpan ?? 1, cols: merge.colSpan ?? 1,
    })).filter(b => b.row >= 0 && b.col >= 0);
    return (col: number, row: number) => bounds.some(b => row >= b.row && row < b.row + b.rows && col >= b.col && col < b.col + b.cols);
  }, [formulas, mergedCells, getRowId, sheetItems, columns]);
  const [formulaVersion, setFormulaVersion] = useState(0);
  const wrappedOnFormulaRecalc = useCallback((result: IRecalcResult) => {
    setFormulaVersion(v => v + 1);
    onFormulaRecalc?.(result);
  }, [onFormulaRecalc]);
  const formulaEngine = useFormulaEngine({
    formulas,
    items: sheetItems,
    flatColumns: columns,
    initialFormulas,
    onFormulaRecalc: wrappedOnFormulaRecalc,
    formulaFunctions,
    namedRanges,
    formulaLimits,
    sheets,
    formulasFromData: formulasFollowData(props.onUndo != null),
    isRowHidden,
    isCellMerged,
    formulaDataAccessor: props.formulaDataAccessor,
  });

  const activeCell = useOGridActiveCell();
  const { formulaBarState, formulaCellWriterRef, formulaBarEl } = useOGridFormulaBar(
    formulas, formulaEngine, formulaVersion, sheetItems, columns, activeCell, nameBox?.navigate,
  );

  const dgFormulaProps = useMemo(() => ({
    formulas,
    getFormulaValue: formulaEngine.enabled ? formulaEngine.getFormulaValue : undefined,
    getSpillRange: formulaEngine.enabled ? formulaEngine.getSpillRange : undefined,
    hasFormula: formulaEngine.enabled ? formulaEngine.hasFormula : undefined,
    getFormula: formulaEngine.enabled ? formulaEngine.getFormula : undefined,
    setFormula: formulaEngine.enabled ? formulaEngine.setFormula : undefined,
    onFormulaCellChanged: formulaEngine.enabled ? formulaEngine.onCellChanged : undefined,
    getPrecedents: formulaEngine.enabled ? formulaEngine.getPrecedents : undefined,
    getDependents: formulaEngine.enabled ? formulaEngine.getDependents : undefined,
    getAuditTrail: formulaEngine.enabled ? formulaEngine.getAuditTrail : undefined,
    formulaVersion,
    formulaReferences: formulaBarState.referencedCells.length > 0 ? formulaBarState.referencedCells : undefined,
    onFormulaInsertReference: formulaBarState.insertReference,
    formulaRowMap,
    formulaCellWriterRef: formulas ? formulaCellWriterRef : undefined,
  }), [formulas, formulaEngine, formulaVersion, formulaBarState.referencedCells, formulaBarState.insertReference, formulaRowMap, formulaCellWriterRef]);

  return {
    dgFormulaProps, formulaBarEl, activeCellRef: activeCell.activeCellRef, onActiveCellChange: activeCell.onActiveCellChange,
    formulaEngine,
    /** True when the engine follows formula text in the data (host-owned undo), so structure edits must not move it. */
    formulasFollowData: formulasFollowData(props.onUndo != null),
  };
}
