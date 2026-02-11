import { DEFAULT_MIN_COLUMN_WIDTH } from '@alaarab/ogrid-core';
import { EventEmitter } from './EventEmitter';

interface ColumnResizeStateEvents extends Record<string, unknown> {
  columnWidthChange: { columnId: string; widthPx: number };
}

export class ColumnResizeState {
  private emitter = new EventEmitter<ColumnResizeStateEvents>();
  private columnWidths = new Map<string, number>();
  private isResizing = false;
  private resizeColumnId: string | null = null;
  private resizeStartX = 0;
  private resizeStartWidth = 0;

  getColumnWidth(columnId: string): number | undefined {
    return this.columnWidths.get(columnId);
  }

  getAllColumnWidths(): Record<string, number> {
    const result: Record<string, number> = {};
    this.columnWidths.forEach((width, id) => {
      result[id] = width;
    });
    return result;
  }

  startResize(columnId: string, clientX: number, currentWidth: number): void {
    this.isResizing = true;
    this.resizeColumnId = columnId;
    this.resizeStartX = clientX;
    this.resizeStartWidth = currentWidth;
  }

  updateResize(clientX: number): number | null {
    if (!this.isResizing || !this.resizeColumnId) return null;
    const delta = clientX - this.resizeStartX;
    const newWidth = Math.max(DEFAULT_MIN_COLUMN_WIDTH, this.resizeStartWidth + delta);
    return newWidth;
  }

  endResize(clientX: number): void {
    if (!this.isResizing || !this.resizeColumnId) return;
    const delta = clientX - this.resizeStartX;
    const newWidth = Math.max(DEFAULT_MIN_COLUMN_WIDTH, this.resizeStartWidth + delta);
    this.columnWidths.set(this.resizeColumnId, newWidth);
    this.emitter.emit('columnWidthChange', { columnId: this.resizeColumnId, widthPx: newWidth });
    this.isResizing = false;
    this.resizeColumnId = null;
  }

  onColumnWidthChange(handler: (data: ColumnResizeStateEvents['columnWidthChange']) => void): () => void {
    this.emitter.on('columnWidthChange', handler);
    return () => this.emitter.off('columnWidthChange', handler);
  }

  destroy(): void {
    this.emitter.removeAllListeners();
  }
}
