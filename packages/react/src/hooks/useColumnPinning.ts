import { useState, useCallback, useMemo } from 'react';
import type { IColumnDef } from '@alaarab/ogrid-core';

export interface UseColumnPinningParams<T = unknown> {
  columns: IColumnDef<T>[];
  /** Controlled pinned columns state. If provided, component is controlled. */
  pinnedColumns?: Record<string, 'left' | 'right'>;
  /** Called when user pins/unpins a column via UI. */
  onColumnPinned?: (columnId: string, pinned: 'left' | 'right' | null) => void;
}

export interface UseColumnPinningResult {
  /** Current pinned columns (controlled or internal). */
  pinnedColumns: Record<string, 'left' | 'right'>;
  /** Pin a column to left or right. */
  pinColumn: (columnId: string, side: 'left' | 'right') => void;
  /** Unpin a column. */
  unpinColumn: (columnId: string) => void;
  /** Check if a column is pinned and which side. */
  isPinned: (columnId: string) => 'left' | 'right' | undefined;
  /** Compute sticky left offsets for pinned columns. */
  computeLeftOffsets: (
    visibleCols: { columnId: string }[],
    columnWidths: Record<string, number>,
    defaultWidth: number,
    hasCheckboxColumn: boolean,
    checkboxColumnWidth: number
  ) => Record<string, number>;
  /** Compute sticky right offsets for pinned columns. */
  computeRightOffsets: (
    visibleCols: { columnId: string }[],
    columnWidths: Record<string, number>,
    defaultWidth: number
  ) => Record<string, number>;
}

/**
 * Manages column pinning state (left/right sticky positioning).
 * Supports controlled and uncontrolled modes.
 * Initializes from column.pinned definitions and pinnedColumns prop.
 */
export function useColumnPinning<T = unknown>(params: UseColumnPinningParams<T>): UseColumnPinningResult {
  const { columns, pinnedColumns: controlledPinnedColumns, onColumnPinned } = params;

  // Initialize internal state from column.pinned definitions
  const initialPinnedColumns = useMemo(() => {
    const initial: Record<string, 'left' | 'right'> = {};
    for (const col of columns) {
      if (col.pinned) {
        initial[col.columnId] = col.pinned;
      }
    }
    return initial;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount

  const [internalPinnedColumns, setInternalPinnedColumns] = useState<Record<string, 'left' | 'right'>>(
    initialPinnedColumns
  );

  // Use controlled state if provided, otherwise internal
  const pinnedColumns = controlledPinnedColumns ?? internalPinnedColumns;

  const pinColumn = useCallback(
    (columnId: string, side: 'left' | 'right') => {
      const next = { ...pinnedColumns, [columnId]: side };
      setInternalPinnedColumns(next);
      onColumnPinned?.(columnId, side);
    },
    [pinnedColumns, onColumnPinned]
  );

  const unpinColumn = useCallback(
    (columnId: string) => {
      const next = { ...pinnedColumns };
      delete next[columnId];
      setInternalPinnedColumns(next);
      onColumnPinned?.(columnId, null);
    },
    [pinnedColumns, onColumnPinned]
  );

  const isPinned = useCallback(
    (columnId: string) => {
      return pinnedColumns[columnId];
    },
    [pinnedColumns]
  );

  const computeLeftOffsets = useCallback(
    (
      visibleCols: { columnId: string }[],
      columnWidths: Record<string, number>,
      defaultWidth: number,
      hasCheckboxColumn: boolean,
      checkboxColumnWidth: number
    ) => {
      const offsets: Record<string, number> = {};
      let left = hasCheckboxColumn ? checkboxColumnWidth : 0;

      for (const col of visibleCols) {
        if (pinnedColumns[col.columnId] === 'left') {
          offsets[col.columnId] = left;
          left += columnWidths[col.columnId] ?? defaultWidth;
        }
      }
      return offsets;
    },
    [pinnedColumns]
  );

  const computeRightOffsets = useCallback(
    (
      visibleCols: { columnId: string }[],
      columnWidths: Record<string, number>,
      defaultWidth: number
    ) => {
      const offsets: Record<string, number> = {};
      let right = 0;

      for (let i = visibleCols.length - 1; i >= 0; i--) {
        const col = visibleCols[i];
        if (pinnedColumns[col.columnId] === 'right') {
          offsets[col.columnId] = right;
          right += columnWidths[col.columnId] ?? defaultWidth;
        }
      }
      return offsets;
    },
    [pinnedColumns]
  );

  return {
    pinnedColumns,
    pinColumn,
    unpinColumn,
    isPinned,
    computeLeftOffsets,
    computeRightOffsets,
  };
}
