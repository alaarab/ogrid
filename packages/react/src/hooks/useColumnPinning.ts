import { useState, useCallback, useRef, useMemo } from 'react';
import type { IColumnDef } from '@alaarab/ogrid-core';
import { columnIdsOf, sameColumnIds } from './columnSetIdentity';
import { reconcilePinned, seedPinned } from './useOGridColumnLayout';

export interface UseColumnPinningParams<T = unknown> {
  columns: IColumnDef<T>[];
  /** Controlled pinned columns state. If provided, component is controlled. */
  pinnedColumns?: Record<string, 'left' | 'right'>;
  /** Displayed columns frozen by count, kept separate from explicit user pins. */
  frozenColumnIds?: string[];
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
    checkboxColumnWidth: number,
    /** Width of the row-number column (0 when absent); it sits between the checkbox and the data columns. */
    rowNumberColumnWidth?: number
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
  const { columns, pinnedColumns: controlledPinnedColumns, onColumnPinned, frozenColumnIds } = params;

  // Initialize internal state from column.pinned definitions
  const [internalPinnedColumns, setInternalPinnedColumns] = useState<Record<string, 'left' | 'right'>>(
    () => seedPinned(columns)
  );

  // Column defs that arrive after mount (async load, a swapped column set) take
  // their pin position from the def; columns already shown keep the user's pins.
  // Adjusted during render so no frame renders the new columns unpinned.
  const [prevColumnIds, setPrevColumnIds] = useState<string[]>(() => columnIdsOf(columns));
  if (!sameColumnIds(prevColumnIds, columns)) {
    setPrevColumnIds(columnIdsOf(columns));
    if (!controlledPinnedColumns) {
      setInternalPinnedColumns((prev) => reconcilePinned(prev, prevColumnIds, columns));
    }
  }

  // Use controlled state if provided, otherwise internal
  const userPins = controlledPinnedColumns ?? internalPinnedColumns;
  const pinnedColumns = useMemo(() => {
    if (!frozenColumnIds?.length) return userPins;
    const next = { ...userPins };
    for (const id of frozenColumnIds) next[id] = 'left';
    return next;
  }, [userPins, frozenColumnIds]);

  // Latest pin state, advanced synchronously by pinColumn/unpinColumn so several
  // calls in one tick build on each other instead of on the same render's value.
  const pinnedColumnsRef = useRef(userPins);
  pinnedColumnsRef.current = userPins;

  const pinColumn = useCallback(
    (columnId: string, side: 'left' | 'right') => {
      const next = { ...pinnedColumnsRef.current, [columnId]: side };
      pinnedColumnsRef.current = next;
      if (!controlledPinnedColumns) setInternalPinnedColumns(next);
      onColumnPinned?.(columnId, side);
    },
    [controlledPinnedColumns, onColumnPinned]
  );

  const unpinColumn = useCallback(
    (columnId: string) => {
      const { [columnId]: _, ...next } = pinnedColumnsRef.current;
      pinnedColumnsRef.current = next;
      if (!controlledPinnedColumns) setInternalPinnedColumns(next);
      onColumnPinned?.(columnId, null);
    },
    [controlledPinnedColumns, onColumnPinned]
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
      checkboxColumnWidth: number,
      rowNumberColumnWidth = 0
    ) => {
      const offsets: Record<string, number> = {};
      let left = (hasCheckboxColumn ? checkboxColumnWidth : 0) + rowNumberColumnWidth;

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
        if (col !== undefined && pinnedColumns[col.columnId] === 'right') {
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
