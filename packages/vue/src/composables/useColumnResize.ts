import { onUnmounted, type Ref } from 'vue';
import { measureColumnContentWidth, ROW_NUMBER_COLUMN_ID, ROW_NUMBER_COLUMN_MIN_WIDTH } from '@alaarab/ogrid-core';
import type { IColumnDef } from '../types';

export interface UseColumnResizeParams {
  columnSizingOverrides: Ref<Record<string, { widthPx: number }>>;
  setColumnSizingOverrides: (value: Record<string, { widthPx: number }>) => void;
  minWidth?: number;
  defaultWidth?: number;
  onColumnResized?: (columnId: string, width: number) => void;
}

export interface UseColumnResizeResult<T> {
  handleResizeStart: (e: PointerEvent, col: IColumnDef<T>) => void;
  handleResizeDoubleClick: (e: PointerEvent, col: IColumnDef<T>) => void;
  getColumnWidth: (col: IColumnDef<T>) => number;
}

/**
 * Manages column resize drag interactions with RAF-throttled state updates.
 */
export function useColumnResize<T>(params: UseColumnResizeParams): UseColumnResizeResult<T> {
  const {
    columnSizingOverrides,
    setColumnSizingOverrides,
    minWidth = 80,
    defaultWidth = 120,
    onColumnResized,
  } = params;

  let rafId = 0;
  let cleanupFn: (() => void) | null = null;

  onUnmounted(() => {
    cleanupFn?.();
    cleanupFn = null;
  });

  const handleResizeStart = (e: PointerEvent, col: IColumnDef<T>) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const columnId = col.columnId;

    const thEl = (e.currentTarget as HTMLElement).parentElement;
    const startWidth = thEl
      ? thEl.getBoundingClientRect().width
      : columnSizingOverrides.value[columnId]?.widthPx
        ?? col.idealWidth
        ?? col.defaultWidth
        ?? defaultWidth;
    let latestWidth = startWidth;

    const prevCursor = document.body.style.cursor;
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const flushWidth = () => {
      setColumnSizingOverrides({
        ...columnSizingOverrides.value,
        [columnId]: { widthPx: latestWidth },
      });
    };

    const effectiveMinWidth = columnId === ROW_NUMBER_COLUMN_ID ? ROW_NUMBER_COLUMN_MIN_WIDTH : minWidth;

    const onMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      latestWidth = Math.max(effectiveMinWidth, startWidth + deltaX);

      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          rafId = 0;
          flushWidth();
        });
      }
    };

    const cleanup = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
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
      flushWidth();
      onColumnResized?.(columnId, latestWidth);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    cleanupFn = cleanup;
  };

  const handleResizeDoubleClick = (e: PointerEvent, col: IColumnDef<T>) => {
    e.preventDefault();
    e.stopPropagation();
    const columnId = col.columnId;
    const thEl = (e.currentTarget as HTMLElement).closest('th') ?? (e.currentTarget as HTMLElement).parentElement;
    const container = thEl?.closest('table')?.parentElement ?? undefined;
    const idealWidth = measureColumnContentWidth(columnId, minWidth, container);
    setColumnSizingOverrides({
      ...columnSizingOverrides.value,
      [columnId]: { widthPx: idealWidth },
    });
    onColumnResized?.(columnId, idealWidth);
  };

  const getColumnWidth = (col: IColumnDef<T>): number => {
    return columnSizingOverrides.value[col.columnId]?.widthPx
      ?? col.idealWidth
      ?? col.defaultWidth
      ?? defaultWidth;
  };

  return { handleResizeStart, handleResizeDoubleClick, getColumnWidth };
}
