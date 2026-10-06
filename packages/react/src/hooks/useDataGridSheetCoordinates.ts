import { useEffect, useMemo, useRef } from 'react';
import { indexToColumnLetter } from '../utils';
import { mapFormulaReferencesToView, resolveActiveCellReference, toRowNumberLabel } from './dataGridDerivations';
import type { FormulaReference } from '@alaarab/ogrid-core';
import type { IColumnDef, IOGridDataGridProps } from '../types';

export interface UseDataGridSheetCoordinatesResult {
  columnLetters: string[];
  rowNumberOf?: (rowIndex: number) => number;
  formulaReferences?: FormulaReference[];
}

/**
 * Sheet coordinates (column letters, row numbers, name box). Letters, row
 * numbers and the name box name a cell the way formulas do: flat column index
 * (`formulaCol`) and sheet row (`props.formulaRowMap`, see IFormulaRowMap), so
 * "B3" in the name box is the cell a formula's B3 reads.
 */
export function useDataGridSheetCoordinates<T>(
  props: Pick<IOGridDataGridProps<T>, 'formulaRowMap' | 'formulaReferences' | 'items' | 'onActiveCellChange'>,
  visibleCols: IColumnDef<T>[],
  formulaCol: ((columnId: string) => number) | undefined,
  rowNumberOffset: number,
  activeCell: { rowIndex: number; columnIndex: number } | null,
  colOffset: number,
): UseDataGridSheetCoordinatesResult {
  const { formulaRowMap } = props;
  const rowCount = props.items.length;
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
    () => mapFormulaReferencesToView(props.formulaReferences, visibleCols, formulaCol, formulaRowMap, rowCount),
    [props.formulaReferences, visibleCols, formulaCol, formulaRowMap, rowCount]
  );

  // Name box: notify the parent when the active cell changes.
  const onActiveCellChangeRef = useRef(props.onActiveCellChange);
  onActiveCellChangeRef.current = props.onActiveCellChange;
  useEffect(() => {
    onActiveCellChangeRef.current?.(
      resolveActiveCellReference(activeCell, visibleCols, colOffset, formulaCol, formulaRowMap, rowNumberOffset),
    );
  }, [activeCell, rowNumberOffset, colOffset, visibleCols, formulaCol, formulaRowMap]);

  return { columnLetters, rowNumberOf, formulaReferences };
}
