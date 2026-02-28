import { Injectable, signal, DestroyRef, inject } from '@angular/core';
import { reorderColumnArray } from '@alaarab/ogrid-core';
import type { IColumnDef } from '../types';

/** Width of the resize handle zone on the right edge of each header cell. */
const RESIZE_HANDLE_ZONE = 8;

/**
 * Manages column reorder drag interactions with RAF-throttled updates.
 * Angular signals-based port of React's useColumnReorder hook.
 */
@Injectable()
export class ColumnReorderService<T> {
  private destroyRef = inject(DestroyRef);

  // --- Input signals (set by consuming component) ---
  readonly columns = signal<IColumnDef<T>[]>([]);
  readonly columnOrder = signal<string[] | undefined>(undefined);
  readonly onColumnOrderChange = signal<((order: string[]) => void) | undefined>(undefined);
  readonly enabled = signal<boolean>(true);
  readonly wrapperEl = signal<HTMLElement | null>(null);

  // --- Internal state ---
  readonly isDragging = signal<boolean>(false);
  readonly dropIndicatorX = signal<number | null>(null);

  // Imperative drag tracking (not reactive)
  private rafId = 0;
  private cleanupFn: (() => void) | null = null;

  // Refs for latest values (captured in closure)
  private latestDropTargetIndex: number | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.cleanupFn) {
        this.cleanupFn();
        this.cleanupFn = null;
      }
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = 0;
      }
    });
  }

  /**
   * Call this from the header cell's mousedown handler.
   * @param columnId - The column being dragged
   * @param event - The native MouseEvent
   */
  handleHeaderMouseDown(columnId: string, event: PointerEvent): void {
    if (!this.enabled()) return;
    if (!this.onColumnOrderChange()) return;

    // Gate on left-click only
    if (event.button !== 0) return;

    // Skip if in resize handle zone (right 8px of the header cell)
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    if (event.clientX > rect.right - RESIZE_HANDLE_ZONE) return;

    // Skip column groups — only reorder leaf columns
    const cols = this.columns();
    const colIndex = cols.findIndex((c) => c.columnId === columnId);
    if (colIndex === -1) return;

    event.preventDefault();

    const startX = event.clientX;
    let hasMoved = false;
    this.latestDropTargetIndex = null;

    // Lock text selection during drag
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';

    const onMove = (moveEvent: PointerEvent) => {
      // Require a small minimum drag distance before activating
      if (!hasMoved && Math.abs(moveEvent.clientX - startX) < 5) return;

      if (!hasMoved) {
        hasMoved = true;
        this.isDragging.set(true);
      }

      if (this.rafId) cancelAnimationFrame(this.rafId);

      this.rafId = requestAnimationFrame(() => {
        this.rafId = 0;
        const wrapper = this.wrapperEl();
        if (!wrapper) return;

        const headerCells = wrapper.querySelectorAll<HTMLElement>('th[data-column-id]');
        const rects: Array<{ columnId: string; left: number; right: number; centerX: number }> = [];

        for (let i = 0; i < headerCells.length; i++) {
          const th = headerCells[i];
          const id = th.getAttribute('data-column-id');
          if (!id) continue;
          const thRect = th.getBoundingClientRect();
          rects.push({
            columnId: id,
            left: thRect.left,
            right: thRect.right,
            centerX: thRect.left + thRect.width / 2,
          });
        }

        const result = this.calculateDrop(columnId, moveEvent.clientX, rects);
        this.latestDropTargetIndex = result.dropIndex;
        this.dropIndicatorX.set(result.indicatorX);
      });
    };

    const cleanup = () => {
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      this.cleanupFn = null;

      // Restore user-select
      document.body.style.userSelect = prevUserSelect;

      // Cancel pending RAF
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = 0;
      }
    };

    const onUp = () => {
      cleanup();

      if (hasMoved && this.latestDropTargetIndex != null) {
        const currentOrder =
          this.columnOrder() ?? this.columns().map((c) => c.columnId);
        const newOrder = reorderColumnArray(currentOrder, columnId, this.latestDropTargetIndex);
        this.onColumnOrderChange()?.(newOrder);
      }

      this.isDragging.set(false);
      this.dropIndicatorX.set(null);
    };

    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    this.cleanupFn = cleanup;
  }

  /**
   * Calculate drop target from mouse position and header cell rects.
   * Same logic as React's useColumnReorder inline calculation.
   */
  private calculateDrop(
    draggedColumnId: string,
    mouseX: number,
    rects: Array<{ columnId: string; left: number; right: number; centerX: number }>,
  ): { dropIndex: number | null; indicatorX: number | null } {
    if (rects.length === 0) {
      return { dropIndex: null, indicatorX: null };
    }

    const order = this.columnOrder() ?? this.columns().map((c) => c.columnId);
    const currentIndex = order.indexOf(draggedColumnId);

    // Find which column the mouse is closest to
    let bestIndex = 0;
    let indicatorX: number | null = null;

    if (mouseX <= rects[0].centerX) {
      // Before the first column
      bestIndex = 0;
      indicatorX = rects[0].left;
    } else if (mouseX >= rects[rects.length - 1].centerX) {
      // After the last column
      bestIndex = rects.length;
      indicatorX = rects[rects.length - 1].right;
    } else {
      for (let i = 0; i < rects.length - 1; i++) {
        if (mouseX >= rects[i].centerX && mouseX < rects[i + 1].centerX) {
          bestIndex = i + 1;
          indicatorX = rects[i].right;
          break;
        }
      }
    }

    // Map visual index back to order array index
    const targetOrderIndex = bestIndex < rects.length
      ? order.indexOf(rects[bestIndex]?.columnId ?? '')
      : order.length;

    // Check if this is a no-op (dropping at same position)
    if (currentIndex === targetOrderIndex || currentIndex + 1 === targetOrderIndex) {
      return { dropIndex: targetOrderIndex, indicatorX: null };
    }

    return { dropIndex: targetOrderIndex, indicatorX };
  }
}
