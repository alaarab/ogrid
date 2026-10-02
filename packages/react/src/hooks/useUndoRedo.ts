import { useCallback, useEffect, useRef, useState } from 'react';
import { UndoRedoStack } from '../utils';
import { useLatestRef } from './useLatestRef';
import type { ICellValueChangedEvent } from '../types';

/** Formula engine hooks for useUndoRedo. Coordinates are formula engine (sheet) coordinates. */
export interface UseUndoRedoFormulaCells<T> {
  /** The formula engine cell a value change writes to, or null when it has none. */
  cellOf: (event: ICellValueChangedEvent<T>) => { col: number; row: number } | null;
  getFormula: (col: number, row: number) => string | undefined;
  setFormula: (col: number, row: number, formula: string | null) => void;
  /** Tells the engine a plain value changed, so formulas reading it recalculate. */
  onCellChanged?: (col: number, row: number) => void;
}

export interface UseUndoRedoParams<T> {
  onCellValueChanged: ((event: ICellValueChangedEvent<T>) => void) | undefined;
  maxUndoDepth?: number;
  /**
   * Formula integration. When set, writing a plain value over a formula cell
   * clears its formula, formula changes made through the returned `setFormula`
   * are undoable, and every value change (including undo/redo) notifies the engine.
   */
  formulaCells?: UseUndoRedoFormulaCells<T>;
}

export interface UseUndoRedoResult<T> {
  onCellValueChanged: ((event: ICellValueChangedEvent<T>) => void) | undefined;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Start a batch  -  all changes until endBatch() are grouped as one undo step. */
  beginBatch: () => void;
  /** End a batch  -  commits the accumulated changes as a single undo entry. */
  endBatch: () => void;
  /** Drop all undo/redo history (e.g. when the host replaces the dataset). */
  clear: () => void;
  /** The configured maximum undo stack depth. */
  maxUndoDepth: number;
  /** Set or clear a formula (engine coordinates) as an undoable change. No-op without `formulaCells`. */
  setFormula: (col: number, row: number, formula: string | null) => void;
}

type UndoEntry<T> =
  | { kind: 'value'; event: ICellValueChangedEvent<T>; cell: { col: number; row: number } | null }
  | { kind: 'formula'; col: number; row: number; oldFormula: string | null; newFormula: string | null };

/**
 * Wraps onCellValueChanged with an undo/redo history stack.
 * Supports batch operations: changes between beginBatch/endBatch are one undo step.
 */
export function useUndoRedo<T>(
  params: UseUndoRedoParams<T>
): UseUndoRedoResult<T> {
  const { onCellValueChanged, maxUndoDepth = 100 } = params;
  const onCellValueChangedRef = useLatestRef(onCellValueChanged);
  const formulaCellsRef = useLatestRef(params.formulaCells);
  const stackRef = useRef<UndoRedoStack<UndoEntry<T>> | null>(null);
  if (stackRef.current === null) {
    stackRef.current = new UndoRedoStack<UndoEntry<T>>(maxUndoDepth);
  }
  const [historyLength, setHistoryLength] = useState(0);
  const [redoLength, setRedoLength] = useState(0);

  // Rebuild the stack when the configured depth changes after mount.
  useEffect(() => {
    if (stackRef.current && stackRef.current.maxDepth !== maxUndoDepth) {
      stackRef.current = new UndoRedoStack<UndoEntry<T>>(maxUndoDepth);
      setHistoryLength(0);
      setRedoLength(0);
    }
  }, [maxUndoDepth]);

  const getStack = useCallback(() => {
    const s = stackRef.current;
    if (!s) throw new Error('UndoRedoStack not initialized');
    return s;
  }, []);

  const syncLengths = useCallback(() => {
    const stack = getStack();
    if (stack.isBatching) return;
    setHistoryLength(stack.historyLength);
    setRedoLength(stack.redoLength);
  }, [getStack]);

  const wrapped = useCallback(
    (event: ICellValueChangedEvent<T>) => {
      if (!onCellValueChangedRef.current) return;
      const formulaCells = formulaCellsRef.current;
      const cell = formulaCells?.cellOf(event) ?? null;
      const entries: UndoEntry<T>[] = [];
      // A plain value written over a formula replaces the formula.
      const oldFormula = cell ? formulaCells?.getFormula(cell.col, cell.row) : undefined;
      if (cell && oldFormula !== undefined) {
        entries.push({ kind: 'formula', col: cell.col, row: cell.row, oldFormula, newFormula: null });
        formulaCells?.setFormula(cell.col, cell.row, null);
      }
      entries.push({ kind: 'value', event, cell });
      getStack().push(entries);
      syncLengths();
      onCellValueChangedRef.current(event);
      if (cell) formulaCells?.onCellChanged?.(cell.col, cell.row);
    },
    [getStack, syncLengths, onCellValueChangedRef, formulaCellsRef]
  );

  const setFormula = useCallback(
    (col: number, row: number, formula: string | null) => {
      const formulaCells = formulaCellsRef.current;
      if (!formulaCells) return;
      const oldFormula = formulaCells.getFormula(col, row) || null;
      const newFormula = formula || null;
      if (oldFormula === newFormula) return;
      getStack().record({ kind: 'formula', col, row, oldFormula, newFormula });
      syncLengths();
      formulaCells.setFormula(col, row, newFormula);
    },
    [getStack, syncLengths, formulaCellsRef]
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

  /** Re-apply one entry forwards (redo) or backwards (undo), bypassing the history. */
  const apply = useCallback(
    (entry: UndoEntry<T>, backwards: boolean) => {
      const formulaCells = formulaCellsRef.current;
      if (entry.kind === 'formula') {
        formulaCells?.setFormula(entry.col, entry.row, backwards ? entry.oldFormula : entry.newFormula);
        return;
      }
      const ev = entry.event;
      onCellValueChangedRef.current?.(backwards ? { ...ev, oldValue: ev.newValue, newValue: ev.oldValue } : ev);
      if (entry.cell) formulaCells?.onCellChanged?.(entry.cell.col, entry.cell.row);
    },
    [onCellValueChangedRef, formulaCellsRef]
  );

  const undo = useCallback(() => {
    if (!onCellValueChangedRef.current && !formulaCellsRef.current) return;
    const stack = getStack();
    const lastBatch = stack.undo();
    if (!lastBatch) return;
    setHistoryLength(stack.historyLength);
    setRedoLength(stack.redoLength);
    for (let i = lastBatch.length - 1; i >= 0; i--) {
      const entry = lastBatch[i];
      if (entry !== undefined) apply(entry, true);
    }
  }, [getStack, apply, onCellValueChangedRef, formulaCellsRef]);

  const redo = useCallback(() => {
    if (!onCellValueChangedRef.current && !formulaCellsRef.current) return;
    const stack = getStack();
    const nextBatch = stack.redo();
    if (!nextBatch) return;
    setHistoryLength(stack.historyLength);
    setRedoLength(stack.redoLength);
    for (const entry of nextBatch) apply(entry, false);
  }, [getStack, apply, onCellValueChangedRef, formulaCellsRef]);

  const clear = useCallback(() => {
    const stack = getStack();
    stack.clear();
    setHistoryLength(0);
    setRedoLength(0);
  }, [getStack]);

  return {
    onCellValueChanged: onCellValueChanged ? wrapped : undefined,
    undo,
    redo,
    canUndo: historyLength > 0,
    canRedo: redoLength > 0,
    beginBatch,
    endBatch,
    clear,
    maxUndoDepth,
    setFormula,
  };
}
