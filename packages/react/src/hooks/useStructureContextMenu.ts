import { useMemo } from 'react';
import { useLatestRef } from './useLatestRef';
import type { GridContextMenuStructure } from '../components/GridContextMenu';
import type { IColumnDef, IGridStructureActions, ISelectionRange, RowId } from '../types';

export interface UseStructureContextMenuParams<T> {
  /** Structure actions from OGrid; undefined hides the menu section. */
  actions: IGridStructureActions<T> | undefined;
  /** Whether the context menu is open (the section is only built then). */
  open: boolean;
  /** Displayed rows (may be sparse for a windowed source). */
  items: T[];
  visibleCols: IColumnDef<T>[];
  selectionRange: ISelectionRange | null;
  activeCell: { rowIndex: number; columnIndex: number } | null;
  colOffset: number;
  getRowId: (item: T) => RowId;
  /** Clears the cell selection after rows or columns are deleted under it. */
  clearSelection: () => void;
}

/**
 * The structure-edit section of the cell context menu. It acts on the selected
 * rows and columns (the selection range, or the active cell without one), the
 * way a spreadsheet's Insert/Delete commands do.
 */
export function useStructureContextMenu<T>(params: UseStructureContextMenuParams<T>): GridContextMenuStructure | undefined {
  const { actions, open, items, visibleCols, selectionRange, activeCell, colOffset } = params;
  const latest = useLatestRef(params);

  return useMemo(() => {
    if (!actions || !open) return undefined;
    const range = selectionRange
      ? {
        startRow: Math.min(selectionRange.startRow, selectionRange.endRow),
        endRow: Math.max(selectionRange.startRow, selectionRange.endRow),
        startCol: Math.min(selectionRange.startCol, selectionRange.endCol),
        endCol: Math.max(selectionRange.startCol, selectionRange.endCol),
      }
      : activeCell
        ? {
          startRow: activeCell.rowIndex, endRow: activeCell.rowIndex,
          startCol: activeCell.columnIndex - colOffset, endCol: activeCell.columnIndex - colOffset,
        }
        : null;
    const rows: T[] = [];
    const cols: string[] = [];
    if (range) {
      for (let r = range.startRow; r <= range.endRow; r++) {
        const item = items[r];
        if (item !== undefined) rows.push(item);
      }
      for (let c = Math.max(0, range.startCol); c <= range.endCol; c++) {
        const col = visibleCols[c];
        if (col) cols.push(col.columnId);
      }
    }
    const editRows = actions.canInsertRows || actions.canDeleteRows;
    const firstRow = rows[0];
    const lastRow = rows[rows.length - 1];
    const firstCol = cols[0];
    const lastCol = cols[cols.length - 1];
    return {
      rowCount: editRows ? rows.length : 0,
      columnCount: actions.canEditColumns ? cols.length : 0,
      canInsertRows: actions.canInsertRows,
      canDeleteRows: actions.canDeleteRows,
      onAction: (id: string) => {
        const { getRowId, clearSelection } = latest.current;
        switch (id) {
          case 'insertRowAbove':
            if (firstRow !== undefined) actions.insertRowsNear(firstRow, 'above', rows.length);
            break;
          case 'insertRowBelow':
            if (lastRow !== undefined) actions.insertRowsNear(lastRow, 'below', rows.length);
            break;
          case 'deleteRows':
            actions.deleteRows(rows.map(getRowId));
            clearSelection();
            break;
          case 'insertColumnLeft':
            if (firstCol !== undefined) actions.insertColumnsNear(firstCol, 'left', cols.length);
            break;
          case 'insertColumnRight':
            if (lastCol !== undefined) actions.insertColumnsNear(lastCol, 'right', cols.length);
            break;
          case 'deleteColumns':
            actions.deleteColumns(cols);
            clearSelection();
            break;
        }
      },
    };
  }, [actions, open, items, visibleCols, selectionRange, activeCell, colOffset, latest]);
}
