import { type Ref, type ShallowRef } from 'vue';
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
export declare function useCellEditing(params?: UseCellEditingParams): UseCellEditingResult;
