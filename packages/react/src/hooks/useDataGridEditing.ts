import { useMemo, useCallback, useState } from 'react';
import { parseValue } from '../utils';
import type { RowId, IColumnDef } from '../types';
import { useLatestRef } from './useLatestRef';
import type { DataGridEditingState } from './useDataGridState';

export interface UseDataGridEditingParams<T> {
  editingCell: { rowId: RowId; columnId: string } | null;
  setEditingCell: (cell: { rowId: RowId; columnId: string } | null) => void;
  pendingEditorValue: unknown;
  setPendingEditorValue: (value: unknown) => void;
  visibleCols: IColumnDef<T>[];
  itemsLength: number;
  onCellValueChanged?: (event: {
    item: T;
    columnId: string;
    oldValue: unknown;
    newValue: unknown;
    rowIndex: number;
  }) => void;
  setActiveCell: (cell: { rowIndex: number; columnIndex: number } | null) => void;
  setSelectionRange: (range: { startRow: number; startCol: number; endRow: number; endCol: number } | null) => void;
  colOffset: number;
}

export interface UseDataGridEditingResult<T> {
  editing: DataGridEditingState<T>;
}

/**
 * Manages cell editing commit/cancel logic and popover editor state.
 * Extracted from useDataGridState for modularity.
 *
 * The editingCell/setEditingCell/pendingEditorValue/setPendingEditorValue are
 * passed in from useCellEditing() (called at the orchestrator level) to avoid
 * circular dependencies with useDataGridInteraction.
 */
export function useDataGridEditing<T>(
  params: UseDataGridEditingParams<T>
): UseDataGridEditingResult<T> {
  const {
    editingCell,
    setEditingCell,
    pendingEditorValue,
    setPendingEditorValue,
    onCellValueChanged,
    setActiveCell,
    setSelectionRange,
    colOffset,
  } = params;

  const [popoverAnchorEl, setPopoverAnchorEl] = useState<HTMLElement | null>(null);

  const visibleColsRef = useLatestRef(params.visibleCols);
  const itemsLengthRef = useLatestRef(params.itemsLength);
  const onCellValueChangedRef = useLatestRef(onCellValueChanged);

  const commitCellEdit = useCallback(
    (
      item: T,
      columnId: string,
      oldValue: unknown,
      newValue: unknown,
      rowIndex: number,
      globalColIndex: number
    ) => {
      // Validate via valueParser before committing
      const col = visibleColsRef.current.find((c) => c.columnId === columnId);
      if (col) {
        const result = parseValue(newValue, oldValue, item, col);
        if (!result.valid) {
          // Reject -- cancel the edit
          setEditingCell(null);
          setPopoverAnchorEl(null);
          setPendingEditorValue(undefined);
          return;
        }
        newValue = result.value;
      }

      onCellValueChangedRef.current?.({
        item,
        columnId,
        oldValue,
        newValue,
        rowIndex,
      });
      setEditingCell(null);
      setPopoverAnchorEl(null);
      setPendingEditorValue(undefined);
      // Advance to next row for inline editors
      if (rowIndex < itemsLengthRef.current - 1) {
        const newRow = rowIndex + 1;
        const localCol = globalColIndex - colOffset;
        setActiveCell({ rowIndex: newRow, columnIndex: globalColIndex });
        setSelectionRange({ startRow: newRow, startCol: localCol, endRow: newRow, endCol: localCol });
      }
    },
    [setEditingCell, setPendingEditorValue, setActiveCell, setSelectionRange, colOffset, visibleColsRef, itemsLengthRef, onCellValueChangedRef]
  );

  const cancelPopoverEdit = useCallback(() => {
    setEditingCell(null);
    setPopoverAnchorEl(null);
    setPendingEditorValue(undefined);
  }, [setEditingCell, setPendingEditorValue]);

  const editingState = useMemo<DataGridEditingState<T>>(() => ({
    editingCell, setEditingCell, pendingEditorValue, setPendingEditorValue,
    commitCellEdit, cancelPopoverEdit, popoverAnchorEl, setPopoverAnchorEl,
  }), [editingCell, setEditingCell, pendingEditorValue, setPendingEditorValue, commitCellEdit, cancelPopoverEdit, popoverAnchorEl, setPopoverAnchorEl]);

  return { editing: editingState };
}
