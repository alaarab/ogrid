import { ref, type Ref } from 'vue';
import type { RowId } from '../types';

export interface EditingCell {
  rowId: RowId;
  columnId: string;
}

export interface UseCellEditingResult {
  editingCell: Ref<EditingCell | null>;
  setEditingCell: (cell: EditingCell | null) => void;
  pendingEditorValue: Ref<unknown>;
  setPendingEditorValue: (value: unknown) => void;
}

/**
 * Manages cell editing state: which cell is being edited and its pending value.
 */
export function useCellEditing(): UseCellEditingResult {
  const editingCell = ref<EditingCell | null>(null);
  const pendingEditorValue = ref<unknown>(undefined);

  const setEditingCell = (cell: EditingCell | null) => {
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
