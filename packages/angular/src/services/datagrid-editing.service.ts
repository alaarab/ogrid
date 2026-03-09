import { signal } from '@angular/core';
import {
  parseValue,
} from '@alaarab/ogrid-core';
import type {
  RowId,
  IActiveCell,
  ICellValueChangedEvent,
} from '../types';
import type { IColumnDef as IAngularColumnDef } from '../types';

type IColumnDef<T> = IAngularColumnDef<T>;

/**
 * Manages cell editing state, inline/popover editor, and commit/cancel logic.
 * Extracted from DataGridStateService for modularity.
 *
 * Not @Injectable  -  instantiated and owned by DataGridStateService.
 */
export class DataGridEditingHelper<T> {
  readonly editingCellSig = signal<{ rowId: RowId; columnId: string } | null>(null);
  readonly pendingEditorValueSig = signal<unknown>(undefined);
  readonly popoverAnchorElSig = signal<HTMLElement | null>(null);

  /** Injected dependencies */
  private getVisibleCols: () => IColumnDef<T>[];
  private getItems: () => T[];
  private getWrappedOnCellValueChanged: () => ((event: ICellValueChangedEvent<T>) => void) | undefined;
  private setActiveCellFn: (cell: IActiveCell | null) => void;
  private setSelectionRangeFn: (range: { startRow: number; startCol: number; endRow: number; endCol: number } | null) => void;
  private getColOffset: () => number;

  constructor(
    getVisibleCols: () => IColumnDef<T>[],
    getItems: () => T[],
    getWrappedOnCellValueChanged: () => ((event: ICellValueChangedEvent<T>) => void) | undefined,
    setActiveCellFn: (cell: IActiveCell | null) => void,
    setSelectionRangeFn: (range: { startRow: number; startCol: number; endRow: number; endCol: number } | null) => void,
    getColOffset: () => number
  ) {
    this.getVisibleCols = getVisibleCols;
    this.getItems = getItems;
    this.getWrappedOnCellValueChanged = getWrappedOnCellValueChanged;
    this.setActiveCellFn = setActiveCellFn;
    this.setSelectionRangeFn = setSelectionRangeFn;
    this.getColOffset = getColOffset;
  }

  setEditingCell(cell: { rowId: RowId; columnId: string } | null): void {
    this.editingCellSig.set(cell);
  }

  setPendingEditorValue(value: unknown): void {
    this.pendingEditorValueSig.set(value);
  }

  commitCellEdit(
    item: T,
    columnId: string,
    oldValue: unknown,
    newValue: unknown,
    rowIndex: number,
    globalColIndex: number,
    options?: { skipAdvance?: boolean },
  ): void {
    const col = this.getVisibleCols().find((c) => c.columnId === columnId);
    if (col) {
      const result = parseValue(newValue, oldValue, item, col);
      if (!result.valid) {
        this.editingCellSig.set(null);
        this.popoverAnchorElSig.set(null);
        this.pendingEditorValueSig.set(undefined);
        return;
      }
      newValue = result.value;
    }

    this.editingCellSig.set(null);
    this.popoverAnchorElSig.set(null);
    this.pendingEditorValueSig.set(undefined);
    if (!Object.is(newValue, oldValue)) {
      const onCellValueChanged = this.getWrappedOnCellValueChanged();
      onCellValueChanged?.({ item, columnId, oldValue, newValue, rowIndex });
    }

    const items = this.getItems();
    if (!options?.skipAdvance && rowIndex < items.length - 1) {
      const newRow = rowIndex + 1;
      const localCol = globalColIndex - this.getColOffset();
      this.setActiveCellFn({ rowIndex: newRow, columnIndex: globalColIndex });
      this.setSelectionRangeFn({ startRow: newRow, startCol: localCol, endRow: newRow, endCol: localCol });
    }
  }

  cancelPopoverEdit(): void {
    this.editingCellSig.set(null);
    this.popoverAnchorElSig.set(null);
    this.pendingEditorValueSig.set(undefined);
  }
}
