import { useState, useCallback, useRef, useEffect } from 'react';
import type { RefObject } from 'react';
import type { IColumnDef } from '../types';
import {
  calculateDropTarget,
  reorderColumnArray,
  getPinStateForColumn,
} from '@alaarab/ogrid-core';
import type { ColumnPinState } from '@alaarab/ogrid-core';

export interface UseColumnReorderParams<T> {
  columns: IColumnDef<T>[];
  columnOrder?: string[];
  onColumnOrderChange?: (order: string[]) => void;
  enabled?: boolean;
  /** Pinned column configuration for zone constraints. */
  pinnedColumns?: Record<string, 'left' | 'right'>;
  wrapperRef: RefObject<HTMLElement | null>;
}

export interface UseColumnReorderResult {
  isDragging: boolean;
  dropIndicatorX: number | null;
  handleHeaderMouseDown: (columnId: string, event: React.MouseEvent) => void;
}

/** Width of the resize handle zone on the right edge of each header cell. */
const RESIZE_HANDLE_ZONE = 8;

/**
 * Convert Record<string, 'left' | 'right'> to the { left?, right? } shape core expects.
 */
function toPinnedColumnsShape(
  pinned?: Record<string, 'left' | 'right'>
): { left?: string[]; right?: string[] } | undefined {
  if (!pinned) return undefined;
  const left: string[] = [];
  const right: string[] = [];
  for (const [id, side] of Object.entries(pinned)) {
    if (side === 'left') left.push(id);
    else if (side === 'right') right.push(id);
  }
  if (left.length === 0 && right.length === 0) return undefined;
  return {
    ...(left.length > 0 ? { left } : {}),
    ...(right.length > 0 ? { right } : {}),
  };
}

/**
 * Manages column reorder drag interactions with RAF-throttled updates.
 * @param params - Columns, order, change callback, enabled flag, and wrapper ref.
 * @returns Drag state and mousedown handler for header cells.
 */
export function useColumnReorder<T>(params: UseColumnReorderParams<T>): UseColumnReorderResult {
  const {
    columns,
    columnOrder,
    onColumnOrderChange,
    enabled = true,
    pinnedColumns,
    wrapperRef,
  } = params;

  const [isDragging, setIsDragging] = useState(false);
  const [dropIndicatorX, setDropIndicatorX] = useState<number | null>(null);
  const rafRef = useRef(0);

  // Refs for latest values so the window listeners capture current state
  const columnsRef = useRef(columns);
  columnsRef.current = columns;
  const columnOrderRef = useRef(columnOrder);
  columnOrderRef.current = columnOrder;
  const onColumnOrderChangeRef = useRef(onColumnOrderChange);
  onColumnOrderChangeRef.current = onColumnOrderChange;
  const pinnedColumnsRef = useRef(pinnedColumns);
  pinnedColumnsRef.current = pinnedColumns;

  // Track active drag state for cleanup on unmount
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, []);

  const handleHeaderMouseDown = useCallback(
    (columnId: string, event: React.MouseEvent) => {
      if (!enabled) return;
      if (!onColumnOrderChangeRef.current) return;

      // Gate on left-click only
      if (event.button !== 0) return;

      // Skip if in resize handle zone (right 8px of the header cell)
      const target = event.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      if (event.clientX > rect.right - RESIZE_HANDLE_ZONE) return;

      // Skip column groups — only reorder leaf columns
      const cols = columnsRef.current;
      const colIndex = cols.findIndex((c) => c.columnId === columnId);
      if (colIndex === -1) return;

      event.preventDefault();

      const startX = event.clientX;
      let hasMoved = false;
      let latestDropTargetIndex: number | null = null;

      // Determine pin state of the dragged column
      const pinnedShape = toPinnedColumnsShape(pinnedColumnsRef.current);
      const draggedPinState: ColumnPinState = getPinStateForColumn(columnId, pinnedShape);

      // Lock text selection and set grabbing cursor during drag
      const prevUserSelect = document.body.style.userSelect;
      const prevCursor = document.body.style.cursor;
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';

      const onMove = (moveEvent: MouseEvent) => {
        // Require a small minimum drag distance before activating
        if (!hasMoved && Math.abs(moveEvent.clientX - startX) < 5) return;

        if (!hasMoved) {
          hasMoved = true;
          setIsDragging(true);
        }

        if (rafRef.current) cancelAnimationFrame(rafRef.current);

        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = 0;
          const wrapper = wrapperRef.current;
          if (!wrapper) return;

          const currentOrder =
            columnOrderRef.current ?? columnsRef.current.map((c) => c.columnId);

          const result = calculateDropTarget(
            moveEvent.clientX,
            currentOrder,
            columnId,
            draggedPinState,
            wrapper,
            pinnedShape
          );

          if (result) {
            latestDropTargetIndex = result.targetIndex;
            setDropIndicatorX(result.indicatorX);
          }
        });
      };

      const cleanup = () => {
        window.removeEventListener('mousemove', onMove, true);
        window.removeEventListener('mouseup', onUp, true);
        cleanupRef.current = null;

        // Restore user-select and cursor
        document.body.style.userSelect = prevUserSelect;
        document.body.style.cursor = prevCursor;

        // Cancel pending RAF
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = 0;
        }
      };

      const onUp = () => {
        cleanup();

        if (hasMoved && latestDropTargetIndex != null) {
          const currentOrder =
            columnOrderRef.current ?? columnsRef.current.map((c) => c.columnId);
          const newOrder = reorderColumnArray(currentOrder, columnId, latestDropTargetIndex);
          onColumnOrderChangeRef.current?.(newOrder);
        }

        setIsDragging(false);
        setDropIndicatorX(null);
      };

      window.addEventListener('mousemove', onMove, true);
      window.addEventListener('mouseup', onUp, true);
      cleanupRef.current = cleanup;
    },
    [enabled, wrapperRef]
  );

  return { isDragging, dropIndicatorX, handleHeaderMouseDown };
}
