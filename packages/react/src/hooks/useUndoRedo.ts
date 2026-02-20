import { useCallback, useRef, useState } from 'react';
import { UndoRedoStack } from '../utils';
import type { ICellValueChangedEvent } from '../types';

export interface UseUndoRedoParams<T> {
  onCellValueChanged: ((event: ICellValueChangedEvent<T>) => void) | undefined;
  maxUndoDepth?: number;
}

export interface UseUndoRedoResult<T> {
  onCellValueChanged: ((event: ICellValueChangedEvent<T>) => void) | undefined;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Start a batch — all changes until endBatch() are grouped as one undo step. */
  beginBatch: () => void;
  /** End a batch — commits the accumulated changes as a single undo entry. */
  endBatch: () => void;
  /** The configured maximum undo stack depth. */
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
  const stackRef = useRef<UndoRedoStack<ICellValueChangedEvent<T>> | null>(null);
  if (stackRef.current === null) {
    stackRef.current = new UndoRedoStack<ICellValueChangedEvent<T>>(maxUndoDepth);
  }
  const [historyLength, setHistoryLength] = useState(0);
  const [redoLength, setRedoLength] = useState(0);

  const getStack = useCallback(() => {
    const s = stackRef.current;
    if (!s) throw new Error('UndoRedoStack not initialized');
    return s;
  }, []);

  const wrapped = useCallback(
    (event: ICellValueChangedEvent<T>) => {
      if (!onCellValueChanged) return;
      const stack = getStack();
      stack.record(event);
      if (!stack.isBatching) {
        setHistoryLength(stack.historyLength);
        setRedoLength(stack.redoLength);
      }
      onCellValueChanged(event);
    },
    [onCellValueChanged, getStack]
  );

  const beginBatch = useCallback(() => {
    getStack().beginBatch();
  }, [getStack]);

  const endBatch = useCallback(() => {
    const stack = getStack();
    stack.endBatch();
    setHistoryLength(stack.historyLength);
    setRedoLength(stack.redoLength);
  }, [getStack]);

  const undo = useCallback(() => {
    if (!onCellValueChanged) return;
    const stack = getStack();
    const lastBatch = stack.undo();
    if (!lastBatch) return;
    setHistoryLength(stack.historyLength);
    setRedoLength(stack.redoLength);
    // Revert in reverse order so multi-cell undo is applied correctly
    for (let i = lastBatch.length - 1; i >= 0; i--) {
      const ev = lastBatch[i];
      onCellValueChanged({
        ...ev,
        oldValue: ev.newValue,
        newValue: ev.oldValue,
      });
    }
  }, [onCellValueChanged, getStack]);

  const redo = useCallback(() => {
    if (!onCellValueChanged) return;
    const stack = getStack();
    const nextBatch = stack.redo();
    if (!nextBatch) return;
    setHistoryLength(stack.historyLength);
    setRedoLength(stack.redoLength);
    // Replay in original order
    for (const ev of nextBatch) {
      onCellValueChanged(ev);
    }
  }, [onCellValueChanged, getStack]);

  return {
    onCellValueChanged: onCellValueChanged ? wrapped : undefined,
    undo,
    redo,
    canUndo: historyLength > 0,
    canRedo: redoLength > 0,
    beginBatch,
    endBatch,
    maxUndoDepth,
  };
}
