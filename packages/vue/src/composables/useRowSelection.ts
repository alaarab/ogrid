import { shallowRef, computed, isReadonly, type Ref } from 'vue';
import { applyRangeRowSelection, computeRowSelectionState } from '@alaarab/ogrid-core';
import type { RowId, RowSelectionMode, IRowSelectionChangeEvent } from '../types';

export interface UseRowSelectionParams<T> {
  items: Ref<T[]>;
  getRowId: (item: T) => RowId;
  rowSelection: Ref<RowSelectionMode>;
  controlledSelectedRows: Ref<Set<RowId> | undefined>;
  onSelectionChange: ((event: IRowSelectionChangeEvent<T>) => void) | undefined;
}

export interface UseRowSelectionResult {
  selectedRowIds: Ref<Set<RowId>>;
  updateSelection: (newSelectedIds: Set<RowId>) => void;
  handleRowCheckboxChange: (rowId: RowId, checked: boolean, rowIndex: number, shiftKey: boolean) => void;
  handleSelectAll: (checked: boolean) => void;
  allSelected: Ref<boolean>;
  someSelected: Ref<boolean>;
}

/**
 * Manages row selection state for single or multiple selection modes with shift-click range support.
 */
export function useRowSelection<T>(params: UseRowSelectionParams<T>): UseRowSelectionResult {
  const {
    items,
    getRowId,
    rowSelection,
    controlledSelectedRows,
    onSelectionChange,
  } = params;

  const internalSelectedRows = shallowRef<Set<RowId>>(new Set());
  let lastClickedRow = -1;

  const selectedRowIds = computed<Set<RowId>>(() => {
    const controlled = controlledSelectedRows.value;
    if (controlled != null) {
      return controlled instanceof Set
        ? controlled
        : new Set(controlled as Iterable<RowId>);
    }
    return internalSelectedRows.value;
  });

  const updateSelection = (newSelectedIds: Set<RowId>) => {
    if (controlledSelectedRows.value !== undefined) {
      // In controlled mode: only fire the callback. The parent is responsible for
      // updating its selectedRows prop in response. Only write if the ref is writable
      // (plain ref in tests), not if it's a readonly computed ref from useDataGridState.
      if (!isReadonly(controlledSelectedRows)) {
        (controlledSelectedRows as Ref<Set<RowId>>).value = newSelectedIds;
      }
    } else {
      internalSelectedRows.value = newSelectedIds;
    }
    onSelectionChange?.({
      selectedRowIds: Array.from(newSelectedIds),
      selectedItems: items.value.filter((item) => newSelectedIds.has(getRowId(item))),
    });
  };

  const handleRowCheckboxChange = (rowId: RowId, checked: boolean, rowIndex: number, shiftKey: boolean) => {
    if (rowSelection.value === 'single') {
      updateSelection(checked ? new Set([rowId]) : new Set());
      lastClickedRow = rowIndex;
      return;
    }

    const currentItems = items.value;
    let next: Set<RowId>;

    if (shiftKey && lastClickedRow >= 0 && lastClickedRow !== rowIndex) {
      next = applyRangeRowSelection(lastClickedRow, rowIndex, checked, currentItems, getRowId, selectedRowIds.value);
    } else {
      next = new Set(selectedRowIds.value);
      if (checked) next.add(rowId);
      else next.delete(rowId);
    }

    lastClickedRow = rowIndex;
    updateSelection(next);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      updateSelection(new Set(items.value.map((item) => getRowId(item))));
    } else {
      updateSelection(new Set());
    }
  };

  const allSelected = computed(
    () => computeRowSelectionState(selectedRowIds.value, items.value, getRowId).allSelected
  );

  const someSelected = computed(
    () => computeRowSelectionState(selectedRowIds.value, items.value, getRowId).someSelected
  );

  return {
    selectedRowIds,
    updateSelection,
    handleRowCheckboxChange,
    handleSelectAll,
    allSelected,
    someSelected,
  };
}
