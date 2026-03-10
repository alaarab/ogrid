import { isInSelectionRange } from '../types';
import type { IActiveCell, ISelectionRange } from '../types';

export interface GridCellSurfaceState {
  isActiveRangeCell: boolean;
  isRangeCell: boolean;
  isCutCell: boolean;
}

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

  return {
    isActiveRangeCell: isInMultiCellSelection && isAnchorCell,
    isRangeCell: isInMultiCellSelection && !isAnchorCell,
    isCutCell:
      cutRange != null && isInSelectionRange(cutRange, rowIndex, columnIndex),
  };
}
