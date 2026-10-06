import { useCallback, useMemo } from 'react';
import { useLatestRef } from './useLatestRef';
import { parseCellCoords, toggleSingleRowSelection } from './dataGridDerivations';
import type { DelegatedCellHandlers } from '../utils';
import type { IColumnDef, IOGridDataGridProps, RowId } from '../types';
import type {
  DataGridCellInteractionState,
  DataGridContextMenuState,
  DataGridEditingState,
  DataGridRowSelectionState,
} from './useDataGridState';

export interface UseDataGridCellHandlersParams<T> {
  editing: DataGridEditingState<T>;
  interaction: DataGridCellInteractionState;
  ctxMenu: DataGridContextMenuState;
  /** In-memory rows, or a windowed source's loaded rows (sparse, by absolute index). */
  rows: T[];
  getRowId: IOGridDataGridProps<T>['getRowId'];
  visibleCols: IColumnDef<T>[];
  colOffset: number;
  rowSelection: IOGridDataGridProps<T>['rowSelection'];
  updateSelection: DataGridRowSelectionState['updateSelection'];
  selectedRowIds: Set<RowId>;
}

/**
 * The handlers GridRow and renderCellContent receive.
 *
 * Invalidation rules (GridRow's memo depends on them):
 * - `editCallbacks` / `interactionHandlers` change only when one of their
 *   member callbacks does.
 * - `delegatedCellHandlers` never changes: it reads rows, columns and handlers
 *   through refs at event time (zero per-cell closures).
 * - `handleSingleRowClick` changes only with `rowSelection` or `updateSelection`.
 */
export function useDataGridCellHandlers<T>(params: UseDataGridCellHandlersParams<T>) {
  const { editing, interaction, ctxMenu, rows, getRowId, visibleCols, colOffset, rowSelection, updateSelection, selectedRowIds } = params;
  const { commitCellEdit, setEditingCell, setPendingEditorValue, cancelPopoverEdit } = editing;
  const { handleCellMouseDown, setActiveCell, handlePaste } = interaction;
  const { handleCellContextMenu, handleLongPressStart, handleLongPressEnd } = ctxMenu;

  const handlePasteVoid = useCallback(() => { void handlePaste(); }, [handlePaste]);

  const editCallbacks = useMemo(
    () => ({ commitCellEdit, setEditingCell, setPendingEditorValue, cancelPopoverEdit }),
    [commitCellEdit, setEditingCell, setPendingEditorValue, cancelPopoverEdit],
  );
  const interactionHandlers = useMemo(
    () => ({ handleCellMouseDown, setActiveCell, setEditingCell, handleCellContextMenu, handleLongPressStart, handleLongPressEnd }),
    [handleCellMouseDown, setActiveCell, setEditingCell, handleCellContextMenu, handleLongPressStart, handleLongPressEnd],
  );

  // Delegated cell handlers: read row/col from e.currentTarget data attributes at call time.
  const interactionHandlersRef = useLatestRef(interactionHandlers);
  const itemsRef = useLatestRef(rows);
  const getRowIdRef = useLatestRef(getRowId);
  const visibleColsRef = useLatestRef(visibleCols);
  const colOffsetRef = useLatestRef(colOffset);

  const delegatedCellHandlers = useMemo<DelegatedCellHandlers>(() => ({
    onPointerDown: (e: React.PointerEvent) => {
      const cell = parseCellCoords(e.currentTarget as HTMLElement | null);
      if (!cell) return;
      const h = interactionHandlersRef.current;
      h.setEditingCell(null);
      h.handleCellMouseDown(e, cell.row, cell.col);
      h.handleLongPressStart?.(e);
    },
    onClick: (e: React.MouseEvent) => {
      // Shift+click extended the range on pointerdown; the anchor stays active.
      if (e.shiftKey) return;
      const cell = parseCellCoords(e.currentTarget as HTMLElement | null);
      if (!cell) return;
      interactionHandlersRef.current.setActiveCell({ rowIndex: cell.row, columnIndex: cell.col });
    },
    onDoubleClick: (e: React.MouseEvent) => {
      const el = e.currentTarget as HTMLElement | null;
      if (!el?.hasAttribute('data-can-edit')) return;
      const cell = parseCellCoords(el);
      if (!cell) return;
      const dataCol = cell.col - colOffsetRef.current;
      const cols = visibleColsRef.current;
      if (dataCol < 0 || dataCol >= cols.length) return;
      const col = cols[dataCol];
      const item = itemsRef.current[cell.row];
      if (col === undefined || item === undefined) return;
      const rowId = getRowIdRef.current(item);
      interactionHandlersRef.current.setEditingCell({ rowId, columnId: col.columnId });
    },
  }), [interactionHandlersRef, itemsRef, getRowIdRef, visibleColsRef, colOffsetRef]);

  // Stable refs for volatile state (read by renderCellContent and the row click).
  const pendingEditorValueRef = useLatestRef(editing.pendingEditorValue);
  const popoverAnchorElRef = useLatestRef(editing.popoverAnchorEl);
  const selectedRowIdsRef = useLatestRef(selectedRowIds);

  const handleSingleRowClick = useCallback((e: React.MouseEvent<HTMLTableRowElement>) => {
    if (rowSelection !== 'single') return;
    // dataset values are always strings; resolve the real RowId (may be a number) from the items.
    // A windowed source's loaded rows are sparse, and find visits the holes, so skip them.
    const rowIdStr = e.currentTarget.dataset.rowId;
    if (rowIdStr == null) return;
    const getId = getRowIdRef.current;
    const match = itemsRef.current.find((item) => item !== undefined && String(getId(item)) === rowIdStr);
    if (match === undefined) return;
    updateSelection(toggleSingleRowSelection(selectedRowIdsRef.current, getId(match)));
  }, [rowSelection, updateSelection, selectedRowIdsRef, itemsRef, getRowIdRef]);

  return {
    handlePasteVoid, editCallbacks, interactionHandlers, delegatedCellHandlers, handleSingleRowClick,
    pendingEditorValueRef, popoverAnchorElRef, selectedRowIdsRef,
  };
}
