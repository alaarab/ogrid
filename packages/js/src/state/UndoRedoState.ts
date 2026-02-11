import type { ICellValueChangedEvent } from '@alaarab/ogrid-core';
import { EventEmitter } from './EventEmitter';

interface UndoRedoStateEvents extends Record<string, unknown> {
  stackChange: { canUndo: boolean; canRedo: boolean };
}

export class UndoRedoState<T> {
  private emitter = new EventEmitter<UndoRedoStateEvents>();
  private historyStack: ICellValueChangedEvent<T>[][] = [];
  private redoStack: ICellValueChangedEvent<T>[][] = [];
  private batch: ICellValueChangedEvent<T>[] | null = null;
  private maxUndoDepth: number;
  private wrappedCallback: ((event: ICellValueChangedEvent<T>) => void) | undefined;

  constructor(
    private onCellValueChanged: ((event: ICellValueChangedEvent<T>) => void) | undefined,
    maxUndoDepth = 100
  ) {
    this.maxUndoDepth = maxUndoDepth;
    if (onCellValueChanged) {
      this.wrappedCallback = (event: ICellValueChangedEvent<T>) => {
        if (this.batch !== null) {
          this.batch.push(event);
        } else {
          this.historyStack = [...this.historyStack, [event]].slice(-this.maxUndoDepth);
          this.redoStack = [];
          this.emitStackChange();
        }
        onCellValueChanged(event);
      };
    }
  }

  get canUndo(): boolean {
    return this.historyStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  getWrappedCallback(): ((event: ICellValueChangedEvent<T>) => void) | undefined {
    return this.wrappedCallback;
  }

  beginBatch(): void {
    this.batch = [];
  }

  endBatch(): void {
    const currentBatch = this.batch;
    this.batch = null;
    if (!currentBatch || currentBatch.length === 0) return;
    this.historyStack = [...this.historyStack, currentBatch].slice(-this.maxUndoDepth);
    this.redoStack = [];
    this.emitStackChange();
  }

  undo(): void {
    if (!this.onCellValueChanged || this.historyStack.length === 0) return;
    const lastBatch = this.historyStack[this.historyStack.length - 1];
    this.historyStack = this.historyStack.slice(0, -1);
    this.redoStack = [...this.redoStack, lastBatch];
    this.emitStackChange();
    for (let i = lastBatch.length - 1; i >= 0; i--) {
      const ev = lastBatch[i];
      this.onCellValueChanged({
        ...ev,
        oldValue: ev.newValue,
        newValue: ev.oldValue,
      });
    }
  }

  redo(): void {
    if (!this.onCellValueChanged || this.redoStack.length === 0) return;
    const nextBatch = this.redoStack[this.redoStack.length - 1];
    this.redoStack = this.redoStack.slice(0, -1);
    this.historyStack = [...this.historyStack, nextBatch];
    this.emitStackChange();
    for (const ev of nextBatch) {
      this.onCellValueChanged(ev);
    }
  }

  private emitStackChange(): void {
    this.emitter.emit('stackChange', { canUndo: this.canUndo, canRedo: this.canRedo });
  }

  onStackChange(handler: (data: UndoRedoStateEvents['stackChange']) => void): () => void {
    this.emitter.on('stackChange', handler);
    return () => this.emitter.off('stackChange', handler);
  }

  destroy(): void {
    this.emitter.removeAllListeners();
  }
}
