import type { ICellValueChangedEvent } from '@alaarab/ogrid-core';
import { UndoRedoStack } from '@alaarab/ogrid-core';
import { EventEmitter } from './EventEmitter';

interface UndoRedoStateEvents extends Record<string, unknown> {
  stackChange: { canUndo: boolean; canRedo: boolean };
}

export class UndoRedoState<T> {
  private emitter = new EventEmitter<UndoRedoStateEvents>();
  private stack: UndoRedoStack<ICellValueChangedEvent<T>>;
  private wrappedCallback: ((event: ICellValueChangedEvent<T>) => void) | undefined;

  constructor(
    private onCellValueChanged: ((event: ICellValueChangedEvent<T>) => void) | undefined,
    maxUndoDepth = 100
  ) {
    this.stack = new UndoRedoStack<ICellValueChangedEvent<T>>(maxUndoDepth);
    if (onCellValueChanged) {
      this.wrappedCallback = (event: ICellValueChangedEvent<T>) => {
        this.stack.record(event);
        if (!this.stack.isBatching) {
          this.emitStackChange();
        }
        onCellValueChanged(event);
      };
    }
  }

  get canUndo(): boolean {
    return this.stack.canUndo;
  }

  get canRedo(): boolean {
    return this.stack.canRedo;
  }

  getWrappedCallback(): ((event: ICellValueChangedEvent<T>) => void) | undefined {
    return this.wrappedCallback;
  }

  beginBatch(): void {
    this.stack.beginBatch();
  }

  endBatch(): void {
    this.stack.endBatch();
    this.emitStackChange();
  }

  undo(): void {
    if (!this.onCellValueChanged) return;
    const lastBatch = this.stack.undo();
    if (!lastBatch) return;
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
    if (!this.onCellValueChanged) return;
    const nextBatch = this.stack.redo();
    if (!nextBatch) return;
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
