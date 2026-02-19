import { ref, type Ref } from 'vue';
import { UndoRedoStack } from '@alaarab/ogrid-core';
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
export function useUndoRedo<T>(
  params: UseUndoRedoParams<T>
): UseUndoRedoResult<T> {
  const { onCellValueChanged, maxUndoDepth = 100 } = params;
  const stack = new UndoRedoStack<ICellValueChangedEvent<T>>(maxUndoDepth);
  const canUndo = ref(false);
  const canRedo = ref(false);

  const updateFlags = () => {
    canUndo.value = stack.canUndo;
    canRedo.value = stack.canRedo;
  };

  const wrapped = onCellValueChanged
    ? (event: ICellValueChangedEvent<T>) => {
        stack.record(event);
        if (!stack.isBatching) {
          updateFlags();
        }
        onCellValueChanged(event);
      }
    : undefined;

  const beginBatch = () => {
    stack.beginBatch();
  };

  const endBatch = () => {
    stack.endBatch();
    updateFlags();
  };

  const undo = () => {
    if (!onCellValueChanged) return;
    const lastBatch = stack.undo();
    if (!lastBatch) return;
    updateFlags();
    for (let i = lastBatch.length - 1; i >= 0; i--) {
      const ev = lastBatch[i];
      onCellValueChanged({ ...ev, oldValue: ev.newValue, newValue: ev.oldValue });
    }
  };

  const redo = () => {
    if (!onCellValueChanged) return;
    const nextBatch = stack.redo();
    if (!nextBatch) return;
    updateFlags();
    for (const ev of nextBatch) {
      onCellValueChanged(ev);
    }
  };

  return {
    onCellValueChanged: wrapped,
    undo,
    redo,
    canUndo,
    canRedo,
    beginBatch,
    endBatch,
    maxUndoDepth,
  };
}
