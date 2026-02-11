import type { RowId, RowSelectionMode, IRowSelectionChangeEvent } from '@alaarab/ogrid-core';
import { EventEmitter } from './EventEmitter';

interface RowSelectionEvents<T> extends Record<string, unknown> {
  rowSelectionChange: IRowSelectionChangeEvent<T>;
}

/**
 * Manages row selection state for single or multiple selection modes with shift-click range support.
 * Vanilla JS equivalent of React's `useRowSelection` hook.
 */
export class RowSelectionState<T> {
  private emitter = new EventEmitter<RowSelectionEvents<T>>();
  private _selectedRowIds = new Set<RowId>();
  private _rowSelection: RowSelectionMode;
  private _lastClickedRow = -1;
  private _getRowId: (item: T) => RowId;

  constructor(
    rowSelection: RowSelectionMode,
    getRowId: (item: T) => RowId
  ) {
    this._rowSelection = rowSelection;
    this._getRowId = getRowId;
  }

  get selectedRowIds(): Set<RowId> {
    return this._selectedRowIds;
  }

  get rowSelection(): RowSelectionMode {
    return this._rowSelection;
  }

  updateSelection(newSelectedIds: Set<RowId>, items: T[]): void {
    this._selectedRowIds = newSelectedIds;
    this.emitter.emit('rowSelectionChange', {
      selectedRowIds: Array.from(newSelectedIds),
      selectedItems: items.filter((item) => newSelectedIds.has(this._getRowId(item))),
    });
  }

  handleRowCheckboxChange(
    rowId: RowId,
    checked: boolean,
    rowIndex: number,
    shiftKey: boolean,
    items: T[]
  ): void {
    if (this._rowSelection === 'single') {
      this.updateSelection(checked ? new Set([rowId]) : new Set(), items);
      this._lastClickedRow = rowIndex;
      return;
    }

    const next = new Set(this._selectedRowIds);

    if (shiftKey && this._lastClickedRow >= 0 && this._lastClickedRow !== rowIndex) {
      const start = Math.min(this._lastClickedRow, rowIndex);
      const end = Math.max(this._lastClickedRow, rowIndex);
      for (let i = start; i <= end; i++) {
        if (i < items.length) {
          const id = this._getRowId(items[i]);
          if (checked) next.add(id);
          else next.delete(id);
        }
      }
    } else {
      if (checked) next.add(rowId);
      else next.delete(rowId);
    }

    this._lastClickedRow = rowIndex;
    this.updateSelection(next, items);
  }

  handleSelectAll(checked: boolean, items: T[]): void {
    if (checked) {
      this.updateSelection(new Set(items.map((item) => this._getRowId(item))), items);
    } else {
      this.updateSelection(new Set(), items);
    }
  }

  isAllSelected(items: T[]): boolean {
    return items.length > 0 && items.every((item) => this._selectedRowIds.has(this._getRowId(item)));
  }

  isSomeSelected(items: T[]): boolean {
    const allSelected = this.isAllSelected(items);
    return !allSelected && items.some((item) => this._selectedRowIds.has(this._getRowId(item)));
  }

  getSelectedRows(items: T[]): T[] {
    return items.filter((item) => this._selectedRowIds.has(this._getRowId(item)));
  }

  onRowSelectionChange(handler: (data: IRowSelectionChangeEvent<T>) => void): () => void {
    this.emitter.on('rowSelectionChange', handler);
    return () => this.emitter.off('rowSelectionChange', handler);
  }

  destroy(): void {
    this.emitter.removeAllListeners();
  }
}
