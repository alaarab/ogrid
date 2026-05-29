import { useState, useCallback, type Dispatch, type SetStateAction } from 'react';
import { flattenColumns } from '../utils';
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

/**
 * Manages column layout state: order (controlled/uncontrolled), width overrides,
 * and pin positions. The pinned state is seeded once from the raw column defs.
 */
export function useOGridColumnLayout<T>(
  params: UseOGridColumnLayoutParams<T>
): UseOGridColumnLayoutState {
  const { columnsProp, controlledColumnOrder, onColumnResized, onColumnPinned } = params;

  const [internalColumnOrder, setInternalColumnOrder] = useState<string[] | undefined>(undefined);
  const effectiveColumnOrder = controlledColumnOrder ?? internalColumnOrder;
  const [columnWidthOverrides, setColumnWidthOverrides] = useState<Record<string, number>>({});
  const [pinnedOverrides, setPinnedOverrides] = useState<Record<string, 'left' | 'right'>>(() => {
    const initial: Record<string, 'left' | 'right'> = {};
    for (const col of flattenColumns(columnsProp)) {
      if (col.pinned) initial[col.columnId] = col.pinned;
    }
    return initial;
  });

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
