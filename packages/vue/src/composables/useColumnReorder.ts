import { ref, onUnmounted, type Ref } from 'vue';
import {
  calculateDropTarget,
  reorderColumnArray,
  getPinStateForColumn,
} from '@alaarab/ogrid-core';
import type { ColumnPinState } from '@alaarab/ogrid-core';

export interface UseColumnReorderParams {
  columnOrder: Ref<string[]>;
  onColumnOrderChange: Ref<((order: string[]) => void) | undefined>;
  tableRef: Ref<HTMLElement | null>;
  pinnedColumns?: Ref<{ left?: string[]; right?: string[] } | undefined>;
}

export interface UseColumnReorderResult {
  isDragging: Ref<boolean>;
  dropIndicatorX: Ref<number | null>;
  handleHeaderMouseDown: (columnId: string, event: MouseEvent) => void;
}

/** Width of the resize handle zone on the right edge of each header cell. */
const RESIZE_HANDLE_ZONE = 8;

/** Minimum drag distance (px) before activating reorder to prevent accidental drags on click. */
const MIN_DRAG_DISTANCE = 5;

/**
 * Manages column reordering via drag-and-drop on header cells.
 * Uses RAF-throttled mouse tracking and core's calculateDropTarget/reorderColumnArray.
 */
export function useColumnReorder(params: UseColumnReorderParams): UseColumnReorderResult {
  const { columnOrder, onColumnOrderChange, tableRef, pinnedColumns } = params;

  const isDragging = ref(false);
  const dropIndicatorX = ref<number | null>(null);

  let draggedColumnId: string | null = null;
  let draggedPinState: ColumnPinState = 'unpinned';
  let rafId = 0;
  let cleanupFn: (() => void) | null = null;

  onUnmounted(() => {
    cleanupFn?.();
    cleanupFn = null;
  });

  const handleHeaderMouseDown = (columnId: string, event: MouseEvent) => {
    if (event.button !== 0) return;

    // Skip if in resize handle zone (right 8px of the header cell)
    const th = (event.target as HTMLElement).closest('th');
    if (th) {
      const rect = th.getBoundingClientRect();
      if (event.clientX > rect.right - RESIZE_HANDLE_ZONE) return;
    }

    event.preventDefault();

    const table = tableRef.value;
    if (!table) return;
    if (!onColumnOrderChange.value) return;

    draggedColumnId = columnId;
    draggedPinState = getPinStateForColumn(
      columnId,
      pinnedColumns?.value
    );
    dropIndicatorX.value = null;

    const startX = event.clientX;
    let hasMoved = false;
    let latestMouseX = event.clientX;
    let targetIndex = -1;

    const prevCursor = document.body.style.cursor;
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';

    const onMove = (moveEvent: MouseEvent) => {
      // Require minimum drag distance before activating
      if (!hasMoved && Math.abs(moveEvent.clientX - startX) < MIN_DRAG_DISTANCE) return;

      if (!hasMoved) {
        hasMoved = true;
        isDragging.value = true;
      }

      latestMouseX = moveEvent.clientX;

      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          rafId = 0;
          const tableEl = tableRef.value;
          if (!tableEl || !draggedColumnId) return;

          const result = calculateDropTarget({
            mouseX: latestMouseX,
            columnOrder: columnOrder.value,
            draggedColumnId,
            draggedPinState,
            tableElement: tableEl,
            pinnedColumns: pinnedColumns?.value,
          });

          if (result) {
            targetIndex = result.targetIndex;
            dropIndicatorX.value = result.indicatorX;
          } else {
            dropIndicatorX.value = null;
          }
        });
      }
    };

    const cleanup = () => {
      window.removeEventListener('mousemove', onMove, true);
      window.removeEventListener('mouseup', onUp, true);
      cleanupFn = null;

      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevUserSelect;

      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };

    const onUp = () => {
      cleanup();

      if (hasMoved && draggedColumnId && targetIndex >= 0 && onColumnOrderChange.value) {
        const newOrder = reorderColumnArray(
          columnOrder.value,
          draggedColumnId,
          targetIndex
        );
        onColumnOrderChange.value(newOrder);
      }

      draggedColumnId = null;
      isDragging.value = false;
      dropIndicatorX.value = null;
      targetIndex = -1;
    };

    window.addEventListener('mousemove', onMove, true);
    window.addEventListener('mouseup', onUp, true);
    cleanupFn = cleanup;
  };

  return { isDragging, dropIndicatorX, handleHeaderMouseDown };
}
