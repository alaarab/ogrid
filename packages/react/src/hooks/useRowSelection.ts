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
  // Shift-click anchor, stored by row id so it survives sort/filter/paging.
  const lastClickedRowIdRef = useRef<RowId | null>(null);

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
        lastClickedRowIdRef.current = rowId;
        return;
      }

      const currentItems = itemsRef.current;
      let next: Set<RowId>;

      // Resolve the anchor's current index; if the row is gone (filtered out,
      // other page) fall back to a plain toggle. Windowed sources pass a sparse
      // array, and findIndex visits its holes, so skip them.
      const anchorId = lastClickedRowIdRef.current;
      const anchorIndex = shiftKey && anchorId != null
        ? currentItems.findIndex((item) => item !== undefined && getRowId(item) === anchorId)
        : -1;
      if (anchorIndex >= 0 && anchorIndex !== rowIndex) {
        next = applyRangeRowSelection(anchorIndex, rowIndex, checked, currentItems, getRowId, selectedRowIdsRef.current);
      } else {
        next = new Set(selectedRowIdsRef.current);
        if (checked) next.add(rowId);
        else next.delete(rowId);
      }

      lastClickedRowIdRef.current = rowId;
      updateSelection(next);
    },
    [rowSelection, getRowId, updateSelection, itemsRef, selectedRowIdsRef]
  );

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      // `items` is the visible page: add/remove only its ids so selections made
      // on other pages survive the header checkbox. forEach (not for...of) skips
      // the holes in a windowed source's sparse loaded-rows array.
      const next = new Set(selectedRowIdsRef.current);
      items.forEach((item) => {
        const id = getRowId(item);
        if (checked) next.add(id);
        else next.delete(id);
      });
      updateSelection(next);
    },
    [items, getRowId, updateSelection, selectedRowIdsRef]
  );

  // Scoped to the visible page: selections that live only on other pages don't
  // make this page's header checkbox indeterminate.
  const { allSelected, someSelected } = useMemo(() => {
    const state = computeRowSelectionState(selectedRowIds, items, getRowId);
    const someSelected = !state.allSelected && items.some((item) => selectedRowIds.has(getRowId(item)));
    return { allSelected: state.allSelected, someSelected };
  }, [items, selectedRowIds, getRowId]);

  return {
    selectedRowIds,
    updateSelection,
    handleRowCheckboxChange,
    handleSelectAll,
    allSelected,
    someSelected,
  };
}
