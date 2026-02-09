import { useState, useCallback, useRef, useMemo } from 'react';
import type { RowId, RowSelectionMode, IRowSelectionChangeEvent } from '../types';

export interface UseRowSelectionParams<T> {
  items: T[];
  getRowId: (item: T) => RowId;
  rowSelection: RowSelectionMode;
  controlledSelectedRows: Set<RowId> | undefined;
  onSelectionChange: ((event: IRowSelectionChangeEvent<T>) => void) | undefined;
}

export interface UseRowSelectionResult {
  selectedRowIds: Set<RowId>;
  updateSelection: (newSelectedIds: Set<RowId>) => void;
  handleRowCheckboxChange: (rowId: RowId, checked: boolean, rowIndex: number, shiftKey: boolean) => void;
  handleSelectAll: (checked: boolean) => void;
  allSelected: boolean;
  someSelected: boolean;
}

export function useRowSelection<T>(params: UseRowSelectionParams<T>): UseRowSelectionResult {
  const {
    items,
    getRowId,
    rowSelection,
    controlledSelectedRows,
    onSelectionChange,
  } = params;

  const [internalSelectedRows, setInternalSelectedRows] = useState<Set<RowId>>(new Set());
  const lastClickedRowRef = useRef<number>(-1);

  // Defensive: convert to Set if caller passes an array (e.g. from JSON state)
  const selectedRowIds: Set<RowId> = useMemo(
    () =>
      controlledSelectedRows != null
        ? controlledSelectedRows instanceof Set
          ? controlledSelectedRows
          : new Set(controlledSelectedRows as Iterable<RowId>)
        : internalSelectedRows,
    [controlledSelectedRows, internalSelectedRows]
  );

  const updateSelection = useCallback(
    (newSelectedIds: Set<RowId>) => {
      if (controlledSelectedRows === undefined) {
        setInternalSelectedRows(newSelectedIds);
      }
      onSelectionChange?.({
        selectedRowIds: Array.from(newSelectedIds),
        selectedItems: items.filter((item) => newSelectedIds.has(getRowId(item))),
      });
    },
    [controlledSelectedRows, onSelectionChange, items, getRowId]
  );

  const handleRowCheckboxChange = useCallback(
    (rowId: RowId, checked: boolean, rowIndex: number, shiftKey: boolean) => {
      if (rowSelection === 'single') {
        updateSelection(checked ? new Set([rowId]) : new Set());
        lastClickedRowRef.current = rowIndex;
        return;
      }

      const next = new Set(selectedRowIds);

      if (shiftKey && lastClickedRowRef.current >= 0 && lastClickedRowRef.current !== rowIndex) {
        const start = Math.min(lastClickedRowRef.current, rowIndex);
        const end = Math.max(lastClickedRowRef.current, rowIndex);
        for (let i = start; i <= end; i++) {
          if (i < items.length) {
            const id = getRowId(items[i]);
            if (checked) next.add(id);
            else next.delete(id);
          }
        }
      } else {
        if (checked) next.add(rowId);
        else next.delete(rowId);
      }

      lastClickedRowRef.current = rowIndex;
      updateSelection(next);
    },
    [rowSelection, selectedRowIds, items, getRowId, updateSelection]
  );

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        updateSelection(new Set(items.map((item) => getRowId(item))));
      } else {
        updateSelection(new Set());
      }
    },
    [items, getRowId, updateSelection]
  );

  const allSelected = items.length > 0 && items.every((item) => selectedRowIds.has(getRowId(item)));
  const someSelected = !allSelected && items.some((item) => selectedRowIds.has(getRowId(item)));

  return {
    selectedRowIds,
    updateSelection,
    handleRowCheckboxChange,
    handleSelectAll,
    allSelected,
    someSelected,
  };
}
