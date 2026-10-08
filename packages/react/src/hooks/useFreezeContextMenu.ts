import { useMemo } from 'react';
import type { GridContextMenuFreeze } from '../components/GridContextMenu';
import type { IGridFreezeActions } from '../types';

export interface UseFreezeContextMenuParams {
  /** Freeze state/actions from OGrid; undefined hides the menu section. */
  actions: IGridFreezeActions | undefined;
  /** Whether the context menu is open (the section is only built then). */
  open: boolean;
  activeCell: { rowIndex: number; columnIndex: number } | null;
  selectionRange: { startRow: number; endRow: number; startCol: number; endCol: number } | null;
  /** Number of special columns (checkbox / row numbers) before the data columns. */
  colOffset: number;
}

/**
 * The freeze-panes section of the cell context menu. Freeze panes freezes the
 * rows above and columns left of the active cell (or the selection's
 * top-left), like Excel's View → Freeze Panes.
 */
export function useFreezeContextMenu(params: UseFreezeContextMenuParams): GridContextMenuFreeze | undefined {
  const { actions, open, activeCell, selectionRange, colOffset } = params;

  return useMemo(() => {
    if (!actions || !open) return undefined;
    const range = selectionRange ?? (activeCell
      ? { startRow: activeCell.rowIndex, endRow: activeCell.rowIndex, startCol: activeCell.columnIndex, endCol: activeCell.columnIndex }
      : null);
    const rowsAbove = range ? Math.max(0, Math.min(range.startRow, range.endRow)) : 0;
    const columnsLeft = range ? Math.max(0, Math.min(range.startCol, range.endCol) - colOffset) : 0;
    return {
      frozenRows: actions.frozenRows,
      frozenColumns: actions.frozenColumns,
      rowsAbove,
      columnsLeft,
      onAction: (id: string) => {
        switch (id) {
          case 'freezePanes':
            actions.setFreeze(rowsAbove, columnsLeft);
            break;
          case 'freezeTopRow':
            actions.setFreeze(1, 0);
            break;
          case 'freezeFirstColumn':
            actions.setFreeze(0, 1);
            break;
          case 'unfreezePanes':
            actions.setFreeze(0, 0);
            break;
        }
      },
    };
  }, [actions, open, activeCell, selectionRange, colOffset]);
}
