import { useCallback, useEffect, useRef } from 'react';
import type { IColumnDef } from '../types';
import { useLatestRef } from './useLatestRef';

export interface UseColumnResizeParams {
  columnSizingOverrides: Record<string, { widthPx: number }>;
  setColumnSizingOverrides: React.Dispatch<
    React.SetStateAction<Record<string, { widthPx: number }>>
  >;
  minWidth?: number;
  defaultWidth?: number;
  /** Called when a column resize completes (mouseup). */
  onColumnResized?: (columnId: string, width: number) => void;
}

export interface UseColumnResizeResult<T> {
  handleResizeStart: (e: React.MouseEvent, col: IColumnDef<T>) => void;
  getColumnWidth: (col: IColumnDef<T>) => number;
}

/**
 * Manages column resize drag interactions with RAF-throttled state updates.
 * @param params - Sizing overrides, setter, min/default widths, and resize callback.
 * @returns Resize start handler and column width getter.
 */
export function useColumnResize<T>({
  columnSizingOverrides,
  setColumnSizingOverrides,
  minWidth = 80,
  defaultWidth = 120,
  onColumnResized,
}: UseColumnResizeParams): UseColumnResizeResult<T> {
  const rafRef = useRef(0);
  const onColumnResizedRef = useRef(onColumnResized);
  onColumnResizedRef.current = onColumnResized;
  const columnSizingOverridesRef = useLatestRef(columnSizingOverrides);

  // Track active drag listeners so we can clean up on unmount
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, []);

  const handleResizeStart = useCallback((e: React.MouseEvent, col: IColumnDef<T>) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const columnId = col.columnId;

    // Measure the actual rendered width from the DOM. With table-layout: auto,
    // the browser may have auto-sized the column wider than the config values.
    // The resize handle is a direct child of <th>, so parentElement is the header cell.
    const thEl = (e.currentTarget as HTMLElement).parentElement;
    const startWidth = thEl
      ? thEl.getBoundingClientRect().width
      : columnSizingOverridesRef.current[columnId]?.widthPx
        ?? col.idealWidth
        ?? col.defaultWidth
        ?? defaultWidth;
    let latestWidth = startWidth;

    // Lock cursor and prevent text selection during drag
    const prevCursor = document.body.style.cursor;
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const flushWidth = () => {
      setColumnSizingOverrides((prev) => ({
        ...prev,
        [columnId]: { widthPx: latestWidth },
      }));
    };

    const onMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      latestWidth = Math.max(minWidth, startWidth + deltaX);

      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = 0;
          flushWidth();
        });
      }
    };

    const cleanup = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      cleanupRef.current = null;

      // Restore cursor and user-select
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevUserSelect;

      // Cancel pending RAF and flush final width synchronously
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };

    const onUp = () => {
      cleanup();
      flushWidth();

      if (onColumnResizedRef.current) {
        onColumnResizedRef.current(columnId, latestWidth);
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    cleanupRef.current = cleanup;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultWidth, minWidth, setColumnSizingOverrides]); // columnSizingOverrides read via ref

  const getColumnWidth = useCallback((col: IColumnDef<T>) => {
    return columnSizingOverrides[col.columnId]?.widthPx
      ?? col.idealWidth
      ?? col.defaultWidth
      ?? defaultWidth;
  }, [columnSizingOverrides, defaultWidth]);

  return { handleResizeStart, getColumnWidth };
}
