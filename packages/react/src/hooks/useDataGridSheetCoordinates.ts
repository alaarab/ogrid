import { useEffect, useMemo, useRef } from 'react';
import { indexToColumnLetter } from '../utils';
import { mapFormulaReferencesToView, resolveActiveCellReference, toRowNumberLabel } from './dataGridDerivations';
import type { FormulaReference, IFormulaRowMap } from '@alaarab/ogrid-core';
import type { IColumnDef } from '../types';

export interface UseDataGridSheetCoordinatesParams<T> {
  visibleCols: IColumnDef<T>[];
  /** Flat (formula) column index of a column id, when the grid maps columns. */
  formulaCol: ((columnId: string) => number) | undefined;
  formulaRowMap: IFormulaRowMap | undefined;
  rowNumberOffset: number;
  /** References in sheet coordinates (from the formula bar). */
  formulaReferences: FormulaReference[] | undefined;
  rowCount: number;
  activeCell: { rowIndex: number; columnIndex: number } | null;
  colOffset: number;
  onActiveCellChange: ((ref: string | null) => void) | undefined;
}

export interface UseDataGridSheetCoordinatesResult {
  columnLetters: string[];
  rowNumberOf?: (rowIndex: number) => number;
  formulaReferences?: FormulaReference[];
}

/**
 * Sheet coordinates (column letters, row numbers, name box). Letters, row
 * numbers and the name box name a cell the way formulas do: flat column index
 * and sheet row (see IFormulaRowMap), so "B3" in the name box is the cell a
 * formula's B3 reads.
 */
export function useDataGridSheetCoordinates<T>(params: UseDataGridSheetCoordinatesParams<T>): UseDataGridSheetCoordinatesResult {
  const { visibleCols, formulaCol, formulaRowMap, rowNumberOffset, rowCount, activeCell, colOffset, onActiveCellChange } = params;
  const columnLetters = useMemo(
    () => visibleCols.map((c, i) => indexToColumnLetter(formulaCol ? Math.max(0, formulaCol(c.columnId)) : i)),
    [visibleCols, formulaCol]
  );
  // Identity changes only with the row map or the page offset: it is a GridRow input.
  const rowNumberOf = useMemo(() => {
    if (!formulaRowMap) return undefined;
    return (rowIndex: number) => toRowNumberLabel(formulaRowMap, rowNumberOffset, rowIndex);
  }, [formulaRowMap, rowNumberOffset]);
  const formulaReferences = useMemo(
    () => mapFormulaReferencesToView(params.formulaReferences, visibleCols, formulaCol, formulaRowMap, rowCount),
    [params.formulaReferences, visibleCols, formulaCol, formulaRowMap, rowCount]
  );

  // Name box: notify the parent when the active cell changes.
  const onActiveCellChangeRef = useRef(onActiveCellChange);
  onActiveCellChangeRef.current = onActiveCellChange;
  useEffect(() => {
    if (!onActiveCellChangeRef.current) return;
    onActiveCellChangeRef.current(resolveActiveCellReference({
      activeCell, visibleCols, colOffset, formulaCol, formulaRowMap, rowNumberOffset,
    }));
  }, [activeCell, rowNumberOffset, colOffset, visibleCols, formulaCol, formulaRowMap]);

  return { columnLetters, rowNumberOf, formulaReferences };
}
