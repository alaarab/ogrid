import { useCallback, useMemo, useState } from 'react';
import { useFormulaEngine } from './useFormulaEngine';
import { useOGridActiveCell } from './useOGridActiveCell';
import { useOGridFormulaBar } from './useOGridFormulaBar';
import { formulasFollowData } from './undoRouting';
import type { IColumnDef, IFormulaRowMap, IRecalcResult } from '@alaarab/ogrid-core';
import type { IOGridProps } from '../types';

export type UseOGridFormulasParams<T> = Pick<
  IOGridProps<T>,
  'formulas' | 'initialFormulas' | 'onFormulaRecalc' | 'formulaFunctions' | 'namedRanges' | 'formulaLimits' | 'sheets'
> & {
  sheetItems: T[];
  columns: IColumnDef<T>[];
  formulaRowMap: IFormulaRowMap | undefined;
  /** The host owns undo (`onUndo`); see formulasFollowData. */
  hasHostUndo: boolean;
};

/**
 * Formula engine wiring (opt-in; always bundled, only instantiated when
 * `formulas` is on), the active cell reference, the formula bar, and the
 * formula props DataGridTable receives.
 */
export function useOGridFormulas<T>(params: UseOGridFormulasParams<T>) {
  const {
    formulas, initialFormulas, onFormulaRecalc, formulaFunctions, namedRanges, formulaLimits, sheets,
    sheetItems, columns, formulaRowMap, hasHostUndo,
  } = params;
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
    formulasFromData: formulasFollowData(hasHostUndo),
  });

  const { activeCellRef, activeCellCoords, onActiveCellChange } = useOGridActiveCell();
  const { formulaBarState, formulaCellWriterRef, formulaBarEl } = useOGridFormulaBar({
    formulas,
    engineEnabled: formulaEngine.enabled,
    engineGetFormula: formulaEngine.getFormula,
    formulaVersion,
    sheetItems,
    columns,
    activeCellRef,
    activeCellCoords,
  });

  const dgFormulaProps = useMemo(() => ({
    formulas,
    getFormulaValue: formulaEngine.enabled ? formulaEngine.getFormulaValue : undefined,
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

  return { dgFormulaProps, formulaBarEl, activeCellRef, onActiveCellChange };
}
