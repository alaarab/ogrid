import { useCallback, useRef, useEffect } from 'react';
import type { IColumnDef } from '../types';

export interface UseColumnResizeParams {
  columnSizingOverrides: Record<string, { widthPx: number }>;
  setColumnSizingOverrides: React.Dispatch<
    React.SetStateAction<Record<string, { widthPx: number }>>
  >;
  minWidth?: number;
  defaultWidth?: number;
}

export interface UseColumnResizeResult<T> {
  handleResizeStart: (e: React.MouseEvent, col: IColumnDef<T>) => void;
  getColumnWidth: (col: IColumnDef<T>) => number;
}

export function useColumnResize<T>({
  columnSizingOverrides,
  setColumnSizingOverrides,
  minWidth = 80,
  defaultWidth = 120,
}: UseColumnResizeParams): UseColumnResizeResult<T> {
  const resizingRef = useRef<{ columnId: string; startX: number; startWidth: number } | null>(null);

  const handleResizeStart = useCallback((e: React.MouseEvent, col: IColumnDef<T>) => {
    e.preventDefault();
    e.stopPropagation();

    const currentWidth = columnSizingOverrides[col.columnId]?.widthPx
      ?? col.idealWidth
      ?? col.defaultWidth
      ?? defaultWidth;

    resizingRef.current = {
      columnId: col.columnId,
      startX: e.clientX,
      startWidth: currentWidth,
    };
  }, [columnSizingOverrides, defaultWidth]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizingRef.current) return;
    const { columnId, startX, startWidth } = resizingRef.current;
    const deltaX = e.clientX - startX;
    const newWidth = Math.max(minWidth, startWidth + deltaX);

    setColumnSizingOverrides((prev) => ({
      ...prev,
      [columnId]: { widthPx: newWidth },
    }));
  }, [setColumnSizingOverrides, minWidth]);

  const handleResizeEnd = useCallback(() => {
    resizingRef.current = null;
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => handleResizeMove(e);
    const handleMouseUp = () => handleResizeEnd();

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleResizeMove, handleResizeEnd]);

  const getColumnWidth = useCallback((col: IColumnDef<T>) => {
    return columnSizingOverrides[col.columnId]?.widthPx
      ?? col.idealWidth
      ?? col.defaultWidth
      ?? defaultWidth;
  }, [columnSizingOverrides, defaultWidth]);

  return { handleResizeStart, getColumnWidth };
}
