import { shallowRef, ref, type Ref, type ShallowRef } from 'vue';
import type { RowId } from '../types';

export interface EditingCell {
  rowId: RowId;
  columnId: string;
}

export interface UseCellEditingParams {
  scrollToRow?: (index: number, align?: 'start' | 'center' | 'end') => void;
  getRowIndex?: (rowId: RowId) => number;
}

export interface UseCellEditingResult {
  editingCell: ShallowRef<EditingCell | null>;
  setEditingCell: (cell: EditingCell | null) => void;
  pendingEditorValue: Ref<unknown>;
  setPendingEditorValue: (value: unknown) => void;
}

/**
 * Manages cell editing state: which cell is being edited and its pending value.
 * Optionally scrolls to the cell's row before opening the editor when virtual scrolling is active.
 */
export function useCellEditing(params?: UseCellEditingParams): UseCellEditingResult {
  const editingCell = shallowRef<EditingCell | null>(null);
  const pendingEditorValue = ref<unknown>(undefined);

  const setEditingCell = (cell: EditingCell | null) => {
    if (cell && params?.scrollToRow && params?.getRowIndex) {
      const rowIndex = params.getRowIndex(cell.rowId);
      if (rowIndex >= 0) {
        params.scrollToRow(rowIndex, 'center');
      }
    }
    editingCell.value = cell;
  };

  const setPendingEditorValue = (value: unknown) => {
    pendingEditorValue.value = value;
  };

  return {
    editingCell,
    setEditingCell,
    pendingEditorValue,
    setPendingEditorValue,
  };
}
