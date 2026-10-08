import { useMemo } from 'react';
import { hiddenKeysInSpan } from '../utils';
import { useLatestRef } from './useLatestRef';
import type { IHiddenGaps } from '../utils';
import type { GridContextMenuHiding } from '../components/GridContextMenu';
import type { IColumnDef, IGridHidingActions, ISelectionRange, RowId } from '../types';

export interface UseHidingContextMenuParams<T> {
  /** Hiding actions from OGrid; undefined hides the menu section. */
  actions: IGridHidingActions | undefined;
  /** Whether the context menu is open (the section is only built then). */
  open: boolean;
  /** Displayed rows. */
  items: T[];
  visibleCols: IColumnDef<T>[];
  /** Where hidden columns sit among the visible ones. */
  columnGaps: IHiddenGaps<string> | null;
  selectionRange: ISelectionRange | null;
  activeCell: { rowIndex: number; columnIndex: number } | null;
  colOffset: number;
  getRowId: (item: T) => RowId;
  /** Clears the cell selection after rows or columns are hidden under it. */
  clearSelection: () => void;
}

/**
 * The hide/unhide section of the cell context menu. "Hide rows" acts on the
 * selected rows; the column items show for a whole-column (every displayed
 * row) or multi-column selection. "Unhide" shows when hidden rows or columns
 * sit inside the selection (select across the gap, as in Excel).
 */
export function useHidingContextMenu<T>(params: UseHidingContextMenuParams<T>): GridContextMenuHiding | undefined {
  const { actions, open, items, visibleCols, columnGaps, selectionRange, activeCell, colOffset } = params;
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
    if (!range) return undefined;
    const { getRowId } = latest.current;

    const rowIds: RowId[] = [];
    for (let r = range.startRow; r <= range.endRow; r++) {
      const item = items[r];
      if (item !== undefined) rowIds.push(getRowId(item));
    }
    const rowGaps = actions.hiddenRowGaps;
    const rowsToUnhide = actions.unhideRows && rowGaps
      ? hiddenKeysInSpan(rowGaps, items.map(getRowId), range.startRow, range.endRow)
      : [];

    const startCol = Math.max(0, range.startCol);
    const endCol = Math.min(visibleCols.length - 1, range.endCol);
    const selectedCols = visibleCols.slice(startCol, endCol + 1);
    // Column items need a whole-column or multi-column selection.
    const wholeColumns = items.length > 0 && range.startRow <= 0 && range.endRow >= items.length - 1;
    const columnsMode = selectedCols.length > 1 || (selectedCols.length === 1 && wholeColumns);
    // Required columns stay; at least one column must remain visible.
    const colsToHide = columnsMode ? selectedCols.filter((c) => c.required !== true).map((c) => c.columnId) : [];
    const canHideCols = colsToHide.length > 0 && colsToHide.length < visibleCols.length;
    const colsToUnhide = columnsMode && columnGaps
      ? hiddenKeysInSpan(columnGaps, visibleCols.map((c) => c.columnId), startCol, endCol)
      : [];

    return {
      rowCount: actions.hideRows ? rowIds.length : 0,
      columnCount: canHideCols ? colsToHide.length : 0,
      canUnhideRows: rowsToUnhide.length > 0,
      canUnhideColumns: colsToUnhide.length > 0,
      onAction: (id: string) => {
        const { clearSelection } = latest.current;
        switch (id) {
          case 'hideRows':
            actions.hideRows?.(rowIds);
            clearSelection();
            break;
          case 'unhideRows':
            actions.unhideRows?.(rowsToUnhide);
            break;
          case 'hideColumns':
            actions.hideColumns(colsToHide);
            clearSelection();
            break;
          case 'unhideColumns':
            actions.unhideColumns(colsToUnhide);
            break;
        }
      },
    };
  }, [actions, open, items, visibleCols, columnGaps, selectionRange, activeCell, colOffset, latest]);
}
