import { useCallback, useRef, useState } from 'react';
import type { ICellValueChangedEvent } from '../types';

export interface UseUndoRedoParams<T> {
  onCellValueChanged: ((event: ICellValueChangedEvent<T>) => void) | undefined;
  maxHistory?: number;
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
}

/**
 * Wraps onCellValueChanged with an undo/redo history stack.
 * Supports batch operations: changes between beginBatch/endBatch are one undo step.
 */
export function useUndoRedo<T>(
  params: UseUndoRedoParams<T>
): UseUndoRedoResult<T> {
  const { onCellValueChanged, maxHistory = 50 } = params;
  // Each history entry is an array of events (batch). Single edits are [event].
  const historyRef = useRef<ICellValueChangedEvent<T>[][]>([]);
  const redoStackRef = useRef<ICellValueChangedEvent<T>[][]>([]);
  const batchRef = useRef<ICellValueChangedEvent<T>[] | null>(null);
  const [historyLength, setHistoryLength] = useState(0);
  const [redoLength, setRedoLength] = useState(0);

  const wrapped = useCallback(
    (event: ICellValueChangedEvent<T>) => {
      if (!onCellValueChanged) return;
      if (batchRef.current !== null) {
        // Accumulate into the current batch — don't push to history yet
        batchRef.current.push(event);
      } else {
        historyRef.current = [...historyRef.current, [event]].slice(-maxHistory);
        redoStackRef.current = [];
        setHistoryLength(historyRef.current.length);
        setRedoLength(0);
      }
      onCellValueChanged(event);
    },
    [onCellValueChanged, maxHistory]
  );

  const beginBatch = useCallback(() => {
    batchRef.current = [];
  }, []);

  const endBatch = useCallback(() => {
    const batch = batchRef.current;
    batchRef.current = null;
    if (!batch || batch.length === 0) return;
    historyRef.current = [...historyRef.current, batch].slice(-maxHistory);
    redoStackRef.current = [];
    setHistoryLength(historyRef.current.length);
    setRedoLength(0);
  }, [maxHistory]);

  const undo = useCallback(() => {
    if (!onCellValueChanged || historyRef.current.length === 0) return;
    const lastBatch = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    redoStackRef.current = [...redoStackRef.current, lastBatch];
    setHistoryLength(historyRef.current.length);
    setRedoLength(redoStackRef.current.length);
    // Revert in reverse order so multi-cell undo is applied correctly
    for (let i = lastBatch.length - 1; i >= 0; i--) {
      const ev = lastBatch[i];
      onCellValueChanged({
        ...ev,
        oldValue: ev.newValue,
        newValue: ev.oldValue,
      });
    }
  }, [onCellValueChanged]);

  const redo = useCallback(() => {
    if (!onCellValueChanged || redoStackRef.current.length === 0) return;
    const nextBatch = redoStackRef.current[redoStackRef.current.length - 1];
    redoStackRef.current = redoStackRef.current.slice(0, -1);
    historyRef.current = [...historyRef.current, nextBatch];
    setRedoLength(redoStackRef.current.length);
    setHistoryLength(historyRef.current.length);
    // Replay in original order
    for (const ev of nextBatch) {
      onCellValueChanged(ev);
    }
  }, [onCellValueChanged]);

  return {
    onCellValueChanged: onCellValueChanged ? wrapped : undefined,
    undo,
    redo,
    canUndo: historyLength > 0,
    canRedo: redoLength > 0,
    beginBatch,
    endBatch,
  };
}
