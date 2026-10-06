import { useState, useCallback, useMemo, useRef, type Dispatch, type SetStateAction } from 'react';
import { useLatestRef } from './useLatestRef';
import type { RowId, IRowSelectionChangeEvent } from '../types';

export interface UseOGridRowSelectionParams<T> {
  /** Controlled selected rows (the `selectedRows` prop), if provided. */
  controlledSelectedRows?: Set<RowId>;
  onSelectionChange?: (event: IRowSelectionChangeEvent<T>) => void;
  /** Row identity, used to resolve `selectedItems` for selected ids. */
  getRowId?: (item: T) => RowId;
  /**
   * Every row the grid knows about, in data order: the full client-side data,
   * or the loaded rows of a server-side source. `selectedItems` is resolved
   * against these, so it covers selections on other pages and rows hidden by
   * a filter, not just the visible page.
   */
  knownItems?: readonly T[];
}

export interface UseOGridRowSelectionState<T> {
  effectiveSelectedRows: Set<RowId>;
  handleSelectionChange: (event: IRowSelectionChangeEvent<T>) => void;
  /**
   * Set the selection (uncontrolled: internal state) and fire
   * `onSelectionChange` with `selectedItems` resolved for every id. Used by
   * the imperative API so its events match the grid's own.
   */
  commitSelection: (rowIds: Iterable<RowId>, extraItems?: readonly T[]) => void;
  /** Raw setter consumed by the imperative handle (setSelectedRows / selectAll / etc.). */
  setInternalSelectedRows: Dispatch<SetStateAction<Set<RowId>>>;
}

/**
 * Manages row selection state with controlled/uncontrolled dual-mode support.
 * Internal state is only updated in uncontrolled mode; the change event always fires.
 */
export function useOGridRowSelection<T>(
  params: UseOGridRowSelectionParams<T>
): UseOGridRowSelectionState<T> {
  const { controlledSelectedRows, onSelectionChange, getRowId, knownItems } = params;

  const [internalSelectedRows, setInternalSelectedRows] = useState<Set<RowId>>(new Set());
  // Defensive: a controlled value passed as an array (e.g. from JSON state).
  const effectiveSelectedRows = useMemo(
    () =>
      controlledSelectedRows == null
        ? internalSelectedRows
        : controlledSelectedRows instanceof Set
          ? controlledSelectedRows
          : new Set(controlledSelectedRows as Iterable<RowId>),
    [controlledSelectedRows, internalSelectedRows]
  );

  const knownItemsRef = useLatestRef(knownItems);
  const getRowIdRef = useLatestRef(getRowId);
  // Items of the last emitted selection, so a server-side row selected on a
  // page that is no longer loaded still appears in later events.
  const lastSelectedItemsRef = useRef<Map<RowId, T>>(new Map());

  const resolveItems = useCallback(
    (ids: ReadonlySet<RowId>, extraItems: readonly T[] | undefined): T[] => {
      const rowIdOf = getRowIdRef.current;
      if (!rowIdOf) return extraItems ? extraItems.filter(() => true) : [];
      const found = new Map<RowId, T>();
      const take = (item: T | undefined) => {
        if (item === undefined) return;
        const id = rowIdOf(item);
        if (ids.has(id) && !found.has(id)) found.set(id, item);
      };
      // forEach skips the holes of a windowed source's sparse loaded rows.
      knownItemsRef.current?.forEach(take);
      extraItems?.forEach(take);
      for (const id of ids) {
        if (!found.has(id)) {
          const prev = lastSelectedItemsRef.current.get(id);
          if (prev !== undefined) found.set(id, prev);
        }
      }
      lastSelectedItemsRef.current = found;
      return Array.from(found.values());
    },
    [getRowIdRef, knownItemsRef]
  );

  const isControlled = controlledSelectedRows !== undefined;
  const onSelectionChangeRef = useLatestRef(onSelectionChange);
  const commitSelection = useCallback(
    (rowIds: Iterable<RowId>, extraItems?: readonly T[]) => {
      const ids = new Set(rowIds);
      if (!isControlled) setInternalSelectedRows(ids);
      const listener = onSelectionChangeRef.current;
      if (!listener) {
        resolveItems(ids, extraItems);
        return;
      }
      listener({ selectedRowIds: Array.from(ids), selectedItems: resolveItems(ids, extraItems) });
    },
    [isControlled, onSelectionChangeRef, resolveItems]
  );

  const handleSelectionChange = useCallback(
    (event: IRowSelectionChangeEvent<T>) => commitSelection(event.selectedRowIds, event.selectedItems),
    [commitSelection]
  );

  return { effectiveSelectedRows, handleSelectionChange, commitSelection, setInternalSelectedRows };
}
