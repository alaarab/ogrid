import { ref, type Ref } from 'vue';
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
  let history: ICellValueChangedEvent<T>[][] = [];
  let redoStack: ICellValueChangedEvent<T>[][] = [];
  let batch: ICellValueChangedEvent<T>[] | null = null;
  const canUndo = ref(false);
  const canRedo = ref(false);

  const updateFlags = () => {
    canUndo.value = history.length > 0;
    canRedo.value = redoStack.length > 0;
  };

  const wrapped = onCellValueChanged
    ? (event: ICellValueChangedEvent<T>) => {
        if (batch !== null) {
          batch.push(event);
        } else {
          history = [...history, [event]].slice(-maxUndoDepth);
          redoStack = [];
          updateFlags();
        }
        onCellValueChanged(event);
      }
    : undefined;

  const beginBatch = () => {
    batch = [];
  };

  const endBatch = () => {
    const b = batch;
    batch = null;
    if (!b || b.length === 0) return;
    history = [...history, b].slice(-maxUndoDepth);
    redoStack = [];
    updateFlags();
  };

  const undo = () => {
    if (!onCellValueChanged || history.length === 0) return;
    const lastBatch = history[history.length - 1];
    history = history.slice(0, -1);
    redoStack = [...redoStack, lastBatch];
    updateFlags();
    for (let i = lastBatch.length - 1; i >= 0; i--) {
      const ev = lastBatch[i];
      onCellValueChanged({ ...ev, oldValue: ev.newValue, newValue: ev.oldValue });
    }
  };

  const redo = () => {
    if (!onCellValueChanged || redoStack.length === 0) return;
    const nextBatch = redoStack[redoStack.length - 1];
    redoStack = redoStack.slice(0, -1);
    history = [...history, nextBatch];
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
