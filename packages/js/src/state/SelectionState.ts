import type { IActiveCell, ISelectionRange, RowId } from '@alaarab/ogrid-core';
import { EventEmitter } from './EventEmitter';

interface SelectionStateEvents extends Record<string, unknown> {
  selectionChange: { activeCell: IActiveCell | null; selectionRange: ISelectionRange | null };
  rowSelectionChange: { selectedRowIds: Set<RowId> };
}

/** Compares two selection ranges by value to avoid redundant RAF work. */
function rangesEqual(a: ISelectionRange | null, b: ISelectionRange | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.startRow === b.startRow && a.endRow === b.endRow &&
         a.startCol === b.startCol && a.endCol === b.endCol;
}

export class SelectionState {
  private emitter = new EventEmitter<SelectionStateEvents>();
  private _activeCell: IActiveCell | null = null;
  private _selectionRange: ISelectionRange | null = null;
  private _selectedRowIds = new Set<RowId>();
  private _isDragging = false;
  private dragStartCell: IActiveCell | null = null;
  private rafHandle: number | null = null;
  private pendingRange: ISelectionRange | null = null;

  get activeCell(): IActiveCell | null {
    return this._activeCell;
  }

  get selectionRange(): ISelectionRange | null {
    return this._selectionRange;
  }

  get selectedRowIds(): Set<RowId> {
    return this._selectedRowIds;
  }

  get isDragging(): boolean {
    return this._isDragging;
  }

  /** Get the current drag range (used during drag for DOM attribute updates). */
  getDragRange(): ISelectionRange | null {
    return this.pendingRange;
  }

  setActiveCell(cell: IActiveCell | null): void {
    this._activeCell = cell;
    this._selectionRange = cell != null
      ? { startRow: cell.rowIndex, startCol: cell.columnIndex, endRow: cell.rowIndex, endCol: cell.columnIndex }
      : null;
    this.emitter.emit('selectionChange', { activeCell: cell, selectionRange: this._selectionRange });
  }

  setSelectionRange(range: ISelectionRange | null): void {
    this._selectionRange = range;
    this.emitter.emit('selectionChange', { activeCell: this._activeCell, selectionRange: range });
  }

  clearSelection(): void {
    this._activeCell = null;
    this._selectionRange = null;
    this.emitter.emit('selectionChange', { activeCell: null, selectionRange: null });
  }

  startDrag(rowIndex: number, colIndex: number): void {
    this._isDragging = true;
    this.dragStartCell = { rowIndex, columnIndex: colIndex };
    this._activeCell = { rowIndex, columnIndex: colIndex };
    this._selectionRange = { startRow: rowIndex, startCol: colIndex, endRow: rowIndex, endCol: colIndex };
  }

  updateDrag(rowIndex: number, colIndex: number, applyFn: (range: ISelectionRange) => void): void {
    if (!this._isDragging || !this.dragStartCell) return;

    const newRange: ISelectionRange = {
      startRow: this.dragStartCell.rowIndex,
      startCol: this.dragStartCell.columnIndex,
      endRow: rowIndex,
      endCol: colIndex,
    };

    // Skip RAF if range hasn't changed (deduplication optimization)
    if (rangesEqual(this.pendingRange, newRange)) return;

    this.pendingRange = newRange;

    if (this.rafHandle === null) {
      this.rafHandle = requestAnimationFrame(() => {
        if (this.pendingRange) {
          applyFn(this.pendingRange);
        }
        this.rafHandle = null;
      });
    }
  }

  endDrag(): void {
    if (this.rafHandle !== null) {
      // Flush pending RAF synchronously before ending drag (critical for jsdom tests)
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    if (this.pendingRange) {
      this._selectionRange = this.pendingRange;
      this.pendingRange = null;
      this.emitter.emit('selectionChange', { activeCell: this._activeCell, selectionRange: this._selectionRange });
    }
    this._isDragging = false;
    this.dragStartCell = null;
  }

  setSelectedRowIds(ids: Set<RowId>): void {
    this._selectedRowIds = ids;
    this.emitter.emit('rowSelectionChange', { selectedRowIds: ids });
  }

  onSelectionChange(handler: (data: SelectionStateEvents['selectionChange']) => void): () => void {
    this.emitter.on('selectionChange', handler);
    return () => this.emitter.off('selectionChange', handler);
  }

  onRowSelectionChange(handler: (data: SelectionStateEvents['rowSelectionChange']) => void): () => void {
    this.emitter.on('rowSelectionChange', handler);
    return () => this.emitter.off('rowSelectionChange', handler);
  }

  destroy(): void {
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
    }
    this.emitter.removeAllListeners();
  }
}
