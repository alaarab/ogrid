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
}

/**
 * Wraps onCellValueChanged with an undo/redo history stack.
 * Undo reverts the last change; redo reapplies it.
 */
export function useUndoRedo<T>(
  params: UseUndoRedoParams<T>
): UseUndoRedoResult<T> {
  const { onCellValueChanged, maxHistory = 50 } = params;
  const historyRef = useRef<ICellValueChangedEvent<T>[]>([]);
  const redoStackRef = useRef<ICellValueChangedEvent<T>[]>([]);
  const [historyLength, setHistoryLength] = useState(0);
  const [redoLength, setRedoLength] = useState(0);

  const wrapped = useCallback(
    (event: ICellValueChangedEvent<T>) => {
      if (!onCellValueChanged) return;
      historyRef.current = [...historyRef.current, event].slice(-maxHistory);
      redoStackRef.current = [];
      setHistoryLength(historyRef.current.length);
      setRedoLength(0);
      onCellValueChanged(event);
    },
    [onCellValueChanged, maxHistory]
  );

  const undo = useCallback(() => {
    if (!onCellValueChanged || historyRef.current.length === 0) return;
    const last = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    redoStackRef.current = [...redoStackRef.current, last];
    setHistoryLength(historyRef.current.length);
    setRedoLength(redoStackRef.current.length);
    onCellValueChanged({
      ...last,
      oldValue: last.newValue,
      newValue: last.oldValue,
    });
  }, [onCellValueChanged]);

  const redo = useCallback(() => {
    if (!onCellValueChanged || redoStackRef.current.length === 0) return;
    const next = redoStackRef.current[redoStackRef.current.length - 1];
    redoStackRef.current = redoStackRef.current.slice(0, -1);
    historyRef.current = [...historyRef.current, next];
    setRedoLength(redoStackRef.current.length);
    setHistoryLength(historyRef.current.length);
    onCellValueChanged(next);
  }, [onCellValueChanged]);

  return {
    onCellValueChanged: onCellValueChanged ? wrapped : undefined,
    undo,
    redo,
    canUndo: historyLength > 0,
    canRedo: redoLength > 0,
  };
}
