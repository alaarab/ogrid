import { ref, computed, type Ref } from 'vue';
import type { IColumnDef } from '../types';

export interface UseColumnPinningParams<T = unknown> {
  columns: Ref<IColumnDef<T>[]>;
  /** Controlled pinned columns state. If provided, component is controlled. */
  pinnedColumns?: Ref<Record<string, 'left' | 'right'> | undefined>;
  /** Called when user pins/unpins a column via UI. */
  onColumnPinned?: (columnId: string, pinned: 'left' | 'right' | null) => void;
}

export interface UseColumnPinningResult {
  /** Current pinned columns (controlled or internal). */
  pinnedColumns: Ref<Record<string, 'left' | 'right'>>;
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

  // Initialize internal state from column.pinned definitions (only on mount)
  const initialPinnedColumns: Record<string, 'left' | 'right'> = {};
  for (const col of columns.value) {
    if (col.pinned) {
      initialPinnedColumns[col.columnId] = col.pinned;
    }
  }

  const internalPinnedColumns = ref<Record<string, 'left' | 'right'>>(initialPinnedColumns);

  // Use controlled state if provided, otherwise internal
  const pinnedColumns = computed(() => controlledPinnedColumns?.value ?? internalPinnedColumns.value);

  const pinColumn = (columnId: string, side: 'left' | 'right') => {
    const next = { ...pinnedColumns.value, [columnId]: side };
    internalPinnedColumns.value = next;
    onColumnPinned?.(columnId, side);
  };

  const unpinColumn = (columnId: string) => {
    const { [columnId]: _removed, ...next } = pinnedColumns.value;
    void _removed;
    internalPinnedColumns.value = next;
    onColumnPinned?.(columnId, null);
  };

  const isPinned = (columnId: string): 'left' | 'right' | undefined => {
    return pinnedColumns.value[columnId];
  };

  const computeLeftOffsets = (
    visibleCols: { columnId: string }[],
    columnWidths: Record<string, number>,
    defaultWidth: number,
    hasCheckboxColumn: boolean,
    checkboxColumnWidth: number
  ): Record<string, number> => {
    const offsets: Record<string, number> = {};
    let left = hasCheckboxColumn ? checkboxColumnWidth : 0;

    for (const col of visibleCols) {
      if (pinnedColumns.value[col.columnId] === 'left') {
        offsets[col.columnId] = left;
        left += columnWidths[col.columnId] ?? defaultWidth;
      }
    }
    return offsets;
  };

  const computeRightOffsets = (
    visibleCols: { columnId: string }[],
    columnWidths: Record<string, number>,
    defaultWidth: number
  ): Record<string, number> => {
    const offsets: Record<string, number> = {};
    let right = 0;

    for (let i = visibleCols.length - 1; i >= 0; i--) {
      const col = visibleCols[i];
      if (pinnedColumns.value[col.columnId] === 'right') {
        offsets[col.columnId] = right;
        right += columnWidths[col.columnId] ?? defaultWidth;
      }
    }
    return offsets;
  };

  return {
    pinnedColumns,
    pinColumn,
    unpinColumn,
    isPinned,
    computeLeftOffsets,
    computeRightOffsets,
  };
}
