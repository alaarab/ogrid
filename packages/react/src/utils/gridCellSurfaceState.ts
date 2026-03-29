import { isInSelectionRange } from '../types';
import type { IActiveCell, ISelectionRange } from '../types';

export interface GridCellSurfaceState {
  isActiveRangeCell: boolean;
  isRangeCell: boolean;
  isCutCell: boolean;
}

/** Frozen flyweight for the common case where a cell has no surface state. */
const NO_STATE: GridCellSurfaceState = Object.freeze({
  isActiveRangeCell: false,
  isRangeCell: false,
  isCutCell: false,
});

export interface GetGridCellSurfaceStateParams {
  rowIndex: number;
  columnIndex: number;
  selectionRange: ISelectionRange | null;
  activeCell: IActiveCell | null;
  cutRange: ISelectionRange | null;
}

export function getGridCellSurfaceState(
  params: GetGridCellSurfaceStateParams
): GridCellSurfaceState {
  const {
    rowIndex,
    columnIndex,
    selectionRange,
    activeCell,
    cutRange,
  } = params;

  const isSingleCellSelection =
    selectionRange != null &&
    selectionRange.startRow === selectionRange.endRow &&
    selectionRange.startCol === selectionRange.endCol;

  const isInMultiCellSelection =
    selectionRange != null &&
    !isSingleCellSelection &&
    isInSelectionRange(selectionRange, rowIndex, columnIndex);

  const isAnchorCell =
    activeCell?.rowIndex === rowIndex &&
    activeCell?.columnIndex === columnIndex;

  const isActiveRangeCell = isInMultiCellSelection && isAnchorCell;
  const isRangeCell = isInMultiCellSelection && !isAnchorCell;
  const isCutCell = cutRange != null && isInSelectionRange(cutRange, rowIndex, columnIndex);

  // Return the frozen flyweight when all flags are false (vast majority of cells).
  if (!isActiveRangeCell && !isRangeCell && !isCutCell) return NO_STATE;

  return { isActiveRangeCell, isRangeCell, isCutCell };
}
