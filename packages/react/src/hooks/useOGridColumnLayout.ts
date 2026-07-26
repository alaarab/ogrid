import { useState, useCallback, useMemo, type Dispatch, type SetStateAction } from 'react';
import { flattenColumns } from '../utils';
import { columnIdsOf, sameColumnIds } from './columnSetIdentity';
import type { IColumnDef, IColumnGroupDef } from '../types';

export interface UseOGridColumnLayoutParams<T> {
  /** Raw (possibly grouped) columns — used to seed the initial pinned state. */
  columnsProp: (IColumnDef<T> | IColumnGroupDef<T>)[];
  /** Controlled column order (the `columnOrder` prop), if provided. */
  controlledColumnOrder?: string[];
  onColumnResized?: (columnId: string, width: number) => void;
  onColumnPinned?: (columnId: string, pinned: 'left' | 'right' | null) => void;
}

export interface UseOGridColumnLayoutState {
  effectiveColumnOrder: string[] | undefined;
  columnWidthOverrides: Record<string, number>;
  pinnedOverrides: Record<string, 'left' | 'right'>;
  handleColumnResized: (columnId: string, width: number) => void;
  handleColumnPinned: (columnId: string, pinned: 'left' | 'right' | null) => void;
  // Raw setters consumed by the imperative handle (applyColumnState / setColumnOrder).
  setInternalColumnOrder: Dispatch<SetStateAction<string[] | undefined>>;
  setColumnWidthOverrides: Dispatch<SetStateAction<Record<string, number>>>;
  setPinnedOverrides: Dispatch<SetStateAction<Record<string, 'left' | 'right'>>>;
}

type PinnedMap = Record<string, 'left' | 'right'>;

/** Pin positions declared by the column defs themselves. */
function seedPinned(columns: ReadonlyArray<{ columnId: string; pinned?: 'left' | 'right' }>): PinnedMap {
  const initial: PinnedMap = {};
  for (const col of columns) {
    if (col.pinned) initial[col.columnId] = col.pinned;
  }
  return initial;
}

/**
 * Reconcile pin positions against a new column set.
 *
 * Columns the grid has already shown keep whatever the user pinned them to;
 * columns new to the grid take the pin position from their def. Ids that are
 * gone are dropped, so a pin never leaks onto an unrelated column that happens
 * to reuse the id, and the map cannot grow without bound.
 */
function reconcilePinned(
  prevPinned: PinnedMap,
  prevColumnIds: readonly string[],
  columns: ReadonlyArray<{ columnId: string; pinned?: 'left' | 'right' }>
): PinnedMap {
  const known = new Set(prevColumnIds);
  const next: PinnedMap = {};
  for (const col of columns) {
    const pinned = known.has(col.columnId) ? prevPinned[col.columnId] : col.pinned;
    if (pinned) next[col.columnId] = pinned;
  }
  return next;
}

/**
 * Manages column layout state: order (controlled/uncontrolled), width overrides,
 * and pin positions. Pin positions are seeded from the raw column defs and
 * re-reconciled whenever the column set changes.
 */
export function useOGridColumnLayout<T>(
  params: UseOGridColumnLayoutParams<T>
): UseOGridColumnLayoutState {
  const { columnsProp, controlledColumnOrder, onColumnResized, onColumnPinned } = params;

  const flatColumns = useMemo(() => flattenColumns(columnsProp), [columnsProp]);

  const [internalColumnOrder, setInternalColumnOrder] = useState<string[] | undefined>(undefined);
  const effectiveColumnOrder = controlledColumnOrder ?? internalColumnOrder;
  const [columnWidthOverrides, setColumnWidthOverrides] = useState<Record<string, number>>({});
  const [pinnedOverrides, setPinnedOverrides] = useState<PinnedMap>(() => seedPinned(flatColumns));

  // Seeding pin positions only at mount loses every `pinned` def that arrives
  // later: columns loaded asynchronously mount against an empty array, and a
  // sheet switch brings in a whole new set of defs. In both cases the columns
  // silently render unpinned. Reconcile during render (React's "adjust state
  // when props change" pattern) rather than in an effect, so the grid never
  // commits a frame with the previous column set's pin positions.
  const [prevColumnIds, setPrevColumnIds] = useState<string[]>(() => columnIdsOf(flatColumns));
  if (!sameColumnIds(prevColumnIds, flatColumns)) {
    setPrevColumnIds(columnIdsOf(flatColumns));
    setPinnedOverrides((prev) => reconcilePinned(prev, prevColumnIds, flatColumns));
  }

  const handleColumnResized = useCallback(
    (columnId: string, width: number) => {
      setColumnWidthOverrides((prev) => ({ ...prev, [columnId]: width }));
      onColumnResized?.(columnId, width);
    },
    [onColumnResized]
  );

  const handleColumnPinned = useCallback(
    (columnId: string, pinned: 'left' | 'right' | null) => {
      setPinnedOverrides((prev) => {
        if (pinned === null) {
          const { [columnId]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [columnId]: pinned };
      });
      onColumnPinned?.(columnId, pinned);
    },
    [onColumnPinned]
  );

  return {
    effectiveColumnOrder,
    columnWidthOverrides,
    pinnedOverrides,
    handleColumnResized,
    handleColumnPinned,
    setInternalColumnOrder,
    setColumnWidthOverrides,
    setPinnedOverrides,
  };
}
