import { type Ref } from 'vue';
import type { ICellValueChangedEvent } from '../types';
export interface UseUndoRedoParams<T> {
    onCellValueChanged: ((event: ICellValueChangedEvent<T>) => void) | undefined;
    maxUndoDepth?: number;
}
export interface UseUndoRedoResult<T> {
    onCellValueChanged: ((event: ICellValueChangedEvent<T>) => void) | undefined;
    undo: () => void;
    redo: () => void;
    canUndo: Ref<boolean>;
    canRedo: Ref<boolean>;
    beginBatch: () => void;
    endBatch: () => void;
    maxUndoDepth: number;
}
/**
 * Wraps onCellValueChanged with an undo/redo history stack.
 * Supports batch operations: changes between beginBatch/endBatch are one undo step.
 */
export declare function useUndoRedo<T>(params: UseUndoRedoParams<T>): UseUndoRedoResult<T>;
