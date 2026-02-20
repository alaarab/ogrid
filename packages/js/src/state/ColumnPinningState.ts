import type { IColumnDef } from '@alaarab/ogrid-core';
import { ROW_NUMBER_COLUMN_WIDTH } from '@alaarab/ogrid-core';
import { EventEmitter } from './EventEmitter';

interface ColumnPinningEvents extends Record<string, unknown> {
  pinningChange: { pinnedColumns: Record<string, 'left' | 'right'> };
}

/**
 * Manages column pinning state — tracks which columns are pinned left/right.
 * Computes sticky offsets for the renderer.
 */
export class ColumnPinningState {
  private emitter = new EventEmitter<ColumnPinningEvents>();
  private _pinnedColumns: Record<string, 'left' | 'right'> = {};

  constructor(
    pinnedColumns?: Record<string, 'left' | 'right'>,
    columns?: IColumnDef[]
  ) {
    // Initialize from explicit pinnedColumns prop
    if (pinnedColumns) {
      this._pinnedColumns = { ...pinnedColumns };
    }
    // Also pick up pinned from column definitions
    if (columns) {
      for (const col of columns) {
        if (col.pinned && !(col.columnId in this._pinnedColumns)) {
          this._pinnedColumns[col.columnId] = col.pinned;
        }
      }
    }
  }

  get pinnedColumns(): Record<string, 'left' | 'right'> {
    return this._pinnedColumns;
  }

  pinColumn(columnId: string, side: 'left' | 'right'): void {
    this._pinnedColumns = { ...this._pinnedColumns, [columnId]: side };
    this.emitter.emit('pinningChange', { pinnedColumns: this._pinnedColumns });
  }

  unpinColumn(columnId: string): void {
    const { [columnId]: _, ...next } = this._pinnedColumns;
    this._pinnedColumns = next;
    this.emitter.emit('pinningChange', { pinnedColumns: this._pinnedColumns });
  }

  isPinned(columnId: string): 'left' | 'right' | undefined {
    return this._pinnedColumns[columnId];
  }

  /**
   * Compute sticky left offsets for left-pinned columns.
   * Returns a map of columnId -> left offset in pixels.
   */
  computeLeftOffsets(
    visibleCols: { columnId: string }[],
    columnWidths: Record<string, number>,
    defaultWidth: number,
    hasCheckboxColumn: boolean,
    checkboxColumnWidth: number,
    hasRowNumbersColumn?: boolean
  ): Record<string, number> {
    const offsets: Record<string, number> = {};
    let left = 0;
    if (hasCheckboxColumn) left += checkboxColumnWidth;
    if (hasRowNumbersColumn) left += ROW_NUMBER_COLUMN_WIDTH;

    for (const col of visibleCols) {
      if (this._pinnedColumns[col.columnId] === 'left') {
        offsets[col.columnId] = left;
        left += columnWidths[col.columnId] ?? defaultWidth;
      }
    }
    return offsets;
  }

  /**
   * Compute sticky right offsets for right-pinned columns.
   * Returns a map of columnId -> right offset in pixels.
   */
  computeRightOffsets(
    visibleCols: { columnId: string }[],
    columnWidths: Record<string, number>,
    defaultWidth: number
  ): Record<string, number> {
    const offsets: Record<string, number> = {};
    let right = 0;

    // Walk right-pinned columns from the end
    for (let i = visibleCols.length - 1; i >= 0; i--) {
      const col = visibleCols[i];
      if (this._pinnedColumns[col.columnId] === 'right') {
        offsets[col.columnId] = right;
        right += columnWidths[col.columnId] ?? defaultWidth;
      }
    }
    return offsets;
  }

  onPinningChange(handler: (data: ColumnPinningEvents['pinningChange']) => void): () => void {
    this.emitter.on('pinningChange', handler);
    return () => this.emitter.off('pinningChange', handler);
  }

  destroy(): void {
    this.emitter.removeAllListeners();
  }
}
