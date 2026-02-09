import { useState } from 'react';

export interface EditingCell {
  rowId: string;
  columnId: string;
}

export interface UseCellEditingResult {
  editingCell: EditingCell | null;
  setEditingCell: (cell: EditingCell | null) => void;
  pendingEditorValue: unknown;
  setPendingEditorValue: (value: unknown) => void;
}

export function useCellEditing(): UseCellEditingResult {
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [pendingEditorValue, setPendingEditorValue] = useState<unknown>(undefined);

  return {
    editingCell,
    setEditingCell,
    pendingEditorValue,
    setPendingEditorValue,
  };
}

