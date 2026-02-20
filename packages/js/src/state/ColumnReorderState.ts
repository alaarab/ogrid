import type { ColumnPinState } from '@alaarab/ogrid-core';
import { calculateDropTarget, reorderColumnArray, getPinStateForColumn } from '@alaarab/ogrid-core';
import { EventEmitter } from './EventEmitter';

interface ColumnReorderEvents extends Record<string, unknown> {
  stateChange: { isDragging: boolean; dropIndicatorX: number | null };
  reorder: { columnOrder: string[] };
}

/**
 * Manages column drag-to-reorder for the vanilla JS grid.
 * Follows the EventEmitter + RAF pattern from FillHandleState/SelectionState.
 */
export class ColumnReorderState {
  private emitter = new EventEmitter<ColumnReorderEvents>();

  private _isDragging = false;
  private _draggedColumnId: string | null = null;
  private _dropIndicatorX: number | null = null;
  private _dropTargetIndex: number | null = null;
  private rafId = 0;

  private columnOrder: string[] = [];
  private pinnedColumns: { left?: string[]; right?: string[] } | undefined;
  private draggedPinState: ColumnPinState = 'unpinned';
  private tableElement: Element | null = null;

  private onMoveBound: (e: MouseEvent) => void;
  private onUpBound: (e: MouseEvent) => void;

  constructor() {
    this.onMoveBound = this.handleMouseMove.bind(this);
    this.onUpBound = this.handleMouseUp.bind(this);
  }

  get isDragging(): boolean {
    return this._isDragging;
  }

  get dropIndicatorX(): number | null {
    return this._dropIndicatorX;
  }

  /**
   * Begin a column drag operation.
   * Called from mousedown on a header cell.
   */
  startDrag(
    columnId: string,
    event: MouseEvent,
    columns: { columnId: string }[],
    columnOrder: string[],
    pinnedColumns: Record<string, 'left' | 'right'> | undefined,
    tableElement: Element
  ): void {
    event.preventDefault();

    this._isDragging = true;
    this._draggedColumnId = columnId;
    this._dropIndicatorX = null;
    this._dropTargetIndex = null;
    this.tableElement = tableElement;

    // Use provided column order, or derive from columns array
    this.columnOrder = columnOrder.length > 0
      ? [...columnOrder]
      : columns.map(c => c.columnId);

    // Convert Record<string, 'left' | 'right'> to { left?: string[]; right?: string[] }
    if (pinnedColumns) {
      const left: string[] = [];
      const right: string[] = [];
      for (const [id, side] of Object.entries(pinnedColumns)) {
        if (side === 'left') left.push(id);
        else if (side === 'right') right.push(id);
      }
      this.pinnedColumns = { left, right };
    } else {
      this.pinnedColumns = undefined;
    }

    this.draggedPinState = getPinStateForColumn(columnId, this.pinnedColumns);

    window.addEventListener('mousemove', this.onMoveBound, { capture: true, passive: true });
    window.addEventListener('mouseup', this.onUpBound, { capture: true, passive: true });

    this.emitter.emit('stateChange', { isDragging: true, dropIndicatorX: null });
  }

  private handleMouseMove(event: MouseEvent): void {
    if (!this._isDragging || !this._draggedColumnId || !this.tableElement) return;

    if (this.rafId) cancelAnimationFrame(this.rafId);

    const mouseX = event.clientX;

    this.rafId = requestAnimationFrame(() => {
      this.rafId = 0;
      if (!this._draggedColumnId || !this.tableElement) return;

      const result = calculateDropTarget({
        mouseX,
        columnOrder: this.columnOrder,
        draggedColumnId: this._draggedColumnId,
        draggedPinState: this.draggedPinState,
        tableElement: this.tableElement,
        pinnedColumns: this.pinnedColumns,
      });

      if (!result) return;

      const prevX = this._dropIndicatorX;
      const prevIdx = this._dropTargetIndex;

      this._dropTargetIndex = result.targetIndex;
      this._dropIndicatorX = result.indicatorX;

      // Only emit if something changed
      if (prevX !== result.indicatorX || prevIdx !== result.targetIndex) {
        this.emitter.emit('stateChange', {
          isDragging: true,
          dropIndicatorX: result.indicatorX,
        });
      }
    });
  }

  private handleMouseUp(): void {
    window.removeEventListener('mousemove', this.onMoveBound, true);
    window.removeEventListener('mouseup', this.onUpBound, true);

    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }

    // Commit reorder if we have a valid drop target that isn't a no-op
    if (
      this._isDragging &&
      this._draggedColumnId &&
      this._dropTargetIndex !== null &&
      this._dropIndicatorX !== null // null indicatorX means no-op (same position)
    ) {
      const newOrder = reorderColumnArray(
        this.columnOrder,
        this._draggedColumnId,
        this._dropTargetIndex
      );
      this.emitter.emit('reorder', { columnOrder: newOrder });
    }

    this._isDragging = false;
    this._draggedColumnId = null;
    this._dropIndicatorX = null;
    this._dropTargetIndex = null;
    this.tableElement = null;

    this.emitter.emit('stateChange', { isDragging: false, dropIndicatorX: null });
  }

  onStateChange(handler: (data: ColumnReorderEvents['stateChange']) => void): () => void {
    this.emitter.on('stateChange', handler);
    return () => this.emitter.off('stateChange', handler);
  }

  onReorder(handler: (data: ColumnReorderEvents['reorder']) => void): () => void {
    this.emitter.on('reorder', handler);
    return () => this.emitter.off('reorder', handler);
  }

  destroy(): void {
    if (this._isDragging) {
      window.removeEventListener('mousemove', this.onMoveBound, true);
      window.removeEventListener('mouseup', this.onUpBound, true);
    }
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.emitter.removeAllListeners();
  }
}
