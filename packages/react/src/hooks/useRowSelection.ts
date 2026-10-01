import { useState, useCallback, useRef, useMemo } from 'react';
import { useLatestRef } from './useLatestRef';
import { applyRangeRowSelection, computeRowSelectionState } from '../utils';

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

/**
 * Manages row selection state for single or multiple selection modes with shift-click range support.
 * @param params - Items, getRowId, selection mode, controlled state, and selection change callback.
 * @returns Selected row IDs, update function, checkbox handlers, and selection state booleans.
 */
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

  // Read items/callback via refs so a data edit (new items array) or an inline
  // onSelectionChange doesn't recreate these handlers, which every row receives.
  const itemsRef = useLatestRef(items);
  const onSelectionChangeRef = useLatestRef(onSelectionChange);

  const updateSelection = useCallback(
    (newSelectedIds: Set<RowId>) => {
      if (controlledSelectedRows === undefined) {
        setInternalSelectedRows(newSelectedIds);
      }
      onSelectionChangeRef.current?.({
        selectedRowIds: Array.from(newSelectedIds),
        selectedItems: itemsRef.current.filter((item) => newSelectedIds.has(getRowId(item))),
      });
    },
    [controlledSelectedRows, onSelectionChangeRef, itemsRef, getRowId]
  );

  // Read selectedRowIds via ref to avoid recreating this callback on every selection change
  const selectedRowIdsRef = useLatestRef(selectedRowIds);

  const handleRowCheckboxChange = useCallback(
    (rowId: RowId, checked: boolean, rowIndex: number, shiftKey: boolean) => {
      if (rowSelection === 'single') {
        updateSelection(checked ? new Set([rowId]) : new Set());
        lastClickedRowRef.current = rowIndex;
        return;
      }

      const currentItems = itemsRef.current;
      let next: Set<RowId>;

      if (shiftKey && lastClickedRowRef.current >= 0 && lastClickedRowRef.current !== rowIndex) {
        next = applyRangeRowSelection(lastClickedRowRef.current, rowIndex, checked, currentItems, getRowId, selectedRowIdsRef.current);
      } else {
        next = new Set(selectedRowIdsRef.current);
        if (checked) next.add(rowId);
        else next.delete(rowId);
      }

      lastClickedRowRef.current = rowIndex;
      updateSelection(next);
    },
    [rowSelection, getRowId, updateSelection, itemsRef, selectedRowIdsRef]
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

  const { allSelected, someSelected } = useMemo(
    () => computeRowSelectionState(selectedRowIds, items, getRowId),
    [items, selectedRowIds, getRowId]
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
