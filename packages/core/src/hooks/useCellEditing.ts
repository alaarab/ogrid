import { useState } from 'react';
import type { RowId } from '../types';

export interface EditingCell {
  rowId: RowId;
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

