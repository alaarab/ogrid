import { useCallback, useEffect, useRef, useState } from 'react';
import { useLatestRef } from './useLatestRef';
import type { RowId } from '../types';

/** Smallest height a row can be dragged to, in pixels. */
export const MIN_ROW_HEIGHT = 20;

export interface UseRowResizeParams {
  /** Whether rows can be resized (row numbers shown, fixed-height virtualization off). */
  enabled: boolean;
  /** Controlled heights by row id. When set, the grid shows these and only reports drags. */
  rowHeights?: Record<string, number>;
  /** Called when a drag ends with the row's new height. */
  onRowResized?: (rowId: RowId, height: number) => void;
}

export interface UseRowResizeResult {
  /** Height override for a row (live while dragging), or undefined for the default height. */
  getRowHeight: (rowId: RowId) => number | undefined;
  /** Pointer-down handler for a row's resize handle; undefined when resizing is off. */
  onRowResizeStart: ((e: React.PointerEvent, rowId: RowId) => void) | undefined;
}

/**
 * Per-row resizing from the row-number gutter (Excel's row-boundary drag).
 * Heights are kept by row id, so they follow the record through sort, filter
 * and paging. Uncontrolled unless `rowHeights` is passed.
 */
export function useRowResize(params: UseRowResizeParams): UseRowResizeResult {
  const { enabled, rowHeights } = params;
  const [internalHeights, setInternalHeights] = useState<Record<string, number>>({});
  const [drag, setDrag] = useState<{ rowId: RowId; height: number } | null>(null);
  const latest = useLatestRef(params);
  const cleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanupRef.current?.(), []);

  const heights = rowHeights ?? internalHeights;
  const getRowHeight = useCallback(
    (rowId: RowId): number | undefined => (drag && drag.rowId === rowId ? drag.height : heights[String(rowId)]),
    [drag, heights]
  );

  const onRowResizeStart = useCallback((e: React.PointerEvent, rowId: RowId) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    cleanupRef.current?.();
    const row = (e.currentTarget as HTMLElement).closest('tr');
    const startHeight = row?.getBoundingClientRect().height ?? 0;
    const startY = e.clientY;
    let height: number | null = null;
    const onMove = (ev: PointerEvent) => {
      height = Math.max(MIN_ROW_HEIGHT, Math.round(startHeight + ev.clientY - startY));
      setDrag({ rowId, height });
    };
    const finish = () => {
      cleanupRef.current?.();
      setDrag(null);
      if (height === null) return;
      const final = height;
      if (latest.current.rowHeights === undefined) {
        setInternalHeights((prev) => ({ ...prev, [String(rowId)]: final }));
      }
      latest.current.onRowResized?.(rowId, final);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', finish);
    document.addEventListener('pointercancel', finish);
    cleanupRef.current = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', finish);
      document.removeEventListener('pointercancel', finish);
      cleanupRef.current = null;
    };
  }, [latest]);

  return { getRowHeight, onRowResizeStart: enabled ? onRowResizeStart : undefined };
}
