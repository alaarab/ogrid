import { shallowRef, computed, type Ref } from 'vue';
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
      controlledSelectedRows.value = newSelectedIds;
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

    const next = new Set(selectedRowIds.value);
    const currentItems = items.value;

    if (shiftKey && lastClickedRow >= 0 && lastClickedRow !== rowIndex) {
      const start = Math.min(lastClickedRow, rowIndex);
      const end = Math.max(lastClickedRow, rowIndex);
      for (let i = start; i <= end; i++) {
        if (i < currentItems.length) {
          const id = getRowId(currentItems[i]);
          if (checked) next.add(id);
          else next.delete(id);
        }
      }
    } else {
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
    () => items.value.length > 0 && items.value.every((item) => selectedRowIds.value.has(getRowId(item)))
  );

  const someSelected = computed(
    () => !allSelected.value && items.value.some((item) => selectedRowIds.value.has(getRowId(item)))
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
