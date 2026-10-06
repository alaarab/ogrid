import * as React from 'react';
import { useCallback, useMemo, useRef } from 'react';
import { getCellValue } from '../utils';
import { useFormulaBar } from './useFormulaBar';
import { useLatestRef } from './useLatestRef';
import { FormulaBar } from '../components/FormulaBar';
import type { UseFormulaBarResult } from './useFormulaBar';
import type { IColumnDef } from '@alaarab/ogrid-core';
import type { IFormulaCellWriter } from '../types';

export interface UseOGridFormulaBarParams<T> {
  formulas: boolean | undefined;
  engineEnabled: boolean;
  engineGetFormula: (col: number, row: number) => string | undefined;
  /** Bumped on every recalc or formula edit; refreshes the bar's text. */
  formulaVersion: number;
  sheetItems: T[];
  columns: IColumnDef<T>[];
  activeCellRef: string | null;
  activeCellCoords: { col: number; row: number } | null;
}

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
export function useOGridFormulaBar<T>(params: UseOGridFormulaBarParams<T>): UseOGridFormulaBarState {
  const { formulas, engineEnabled, engineGetFormula, formulaVersion, sheetItems, columns, activeCellRef, activeCellCoords } = params;
  const getRawValue = useCallback((col: number, row: number): unknown => {
    const item = sheetItems[row];
    const colDef = columns[col];
    if (item === undefined || colDef === undefined) return undefined;
    return getCellValue(item, colDef);
  }, [sheetItems, columns]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: formulaVersion is the deliberate trigger — a recalc or formula edit must refresh the bar's text
  const getFormulaForBar = useCallback(
    (col: number, row: number) => engineGetFormula(col, row),
    [engineGetFormula, formulaVersion]
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

  const formulaBarEl = useMemo(() => {
    if (!formulas) return undefined;
    return React.createElement(FormulaBar, {
      cellRef: formulaBarState.cellRef,
      formulaText: formulaBarState.formulaText,
      isEditing: formulaBarState.isEditing,
      onInputChange: formulaBarState.onInputChange,
      onCommit: formulaBarState.onCommit,
      onCancel: formulaBarState.onCancel,
      startEditing: startFormulaBarEditing,
      inputRef: formulaBarState.inputRef,
    });
  }, [formulas, formulaBarState.cellRef, formulaBarState.formulaText, formulaBarState.isEditing, formulaBarState.onInputChange, formulaBarState.onCommit, formulaBarState.onCancel, startFormulaBarEditing, formulaBarState.inputRef]);

  return { formulaBarState, formulaCellWriterRef, formulaBarEl };
}
