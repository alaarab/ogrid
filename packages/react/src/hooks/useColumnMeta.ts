/**
 * Shared hook that pre-computes per-column styles and class names for DataGridTable.
 * Extracted from Radix/Fluent/Material DataGridTable to avoid duplication.
 *
 * @param params.addStickyPosition - When true, adds `position: 'sticky'` inline for pinned columns.
 *   This is needed by Fluent UI whose `TableCell` injects atomic `position: relative` via CSS-in-JS,
 *   overriding the shared `.pinnedColLeft { position: sticky }` class. Radix/Material don't need it.
 */

import { useMemo } from 'react';
import { estimateHeaderMinWidth } from '@alaarab/ogrid-core';
import type { IColumnDef } from '../types';

export interface UseColumnMetaParams<T> {
  visibleCols: IColumnDef<T>[];
  getColumnWidth: (col: IColumnDef<T>) => number;
  columnSizingOverrides: Record<string, { widthPx: number }>;
  measuredColumnWidths: Record<string, number>;
  pinnedColumns: Record<string, 'left' | 'right'>;
  leftOffsets: Record<string, number>;
  rightOffsets: Record<string, number>;
  pinnedColLeftClass: string;
  pinnedColRightClass: string;
  /** When true, adds `position: sticky` inline to pinned cells (Fluent-specific). */
  addStickyPosition?: boolean;
}

export interface ColumnMetaResult {
  cellStyles: Record<string, React.CSSProperties>;
  cellClasses: Record<string, string>;
  hdrStyles: Record<string, React.CSSProperties>;
  hdrClasses: Record<string, string>;
}

/**
 * Computes per-column styles and class names once per render, avoiding per-cell object creation.
 */
export function useColumnMeta<T>(params: UseColumnMetaParams<T>): ColumnMetaResult {
  const {
    visibleCols,
    getColumnWidth,
    columnSizingOverrides,
    measuredColumnWidths,
    pinnedColumns,
    leftOffsets,
    rightOffsets,
    pinnedColLeftClass,
    pinnedColRightClass,
    addStickyPosition = false,
  } = params;

  return useMemo(() => {
    const cellStyles: Record<string, React.CSSProperties> = {};
    const cellClasses: Record<string, string> = {};
    const hdrStyles: Record<string, React.CSSProperties> = {};
    const hdrClasses: Record<string, string> = {};

    for (let i = 0; i < visibleCols.length; i++) {
      const col = visibleCols[i];
      const columnWidth = getColumnWidth(col);
      const hasExplicitWidth = !!(columnSizingOverrides[col.columnId] || col.idealWidth != null || col.defaultWidth != null);
      const isPinnedLeft = pinnedColumns[col.columnId] === 'left';
      const isPinnedRight = pinnedColumns[col.columnId] === 'right';
      const isPinned = isPinnedLeft || isPinnedRight;

      const hasResizeOverride = !!columnSizingOverrides[col.columnId];
      const measuredW = measuredColumnWidths[col.columnId];
      const baseMinWidth = col.minWidth ?? estimateHeaderMinWidth(col.name);
      const effectiveMinWidth = hasResizeOverride || hasExplicitWidth
        ? columnWidth
        : Math.max(baseMinWidth, measuredW ?? 0);

      const stickyOverride = addStickyPosition && isPinned ? { position: 'sticky' as const } : undefined;
      // CSS width string (e.g. '100%') lets a column fill remaining space.
      const cssWidth = col.width;

      // Auto-sized columns get width:'0' so the browser distributes remaining
      // table space evenly (each column still respects its min-width).
      const autoWidth = cssWidth ?? (hasExplicitWidth ? columnWidth : 0);
      const autoMaxWidth = cssWidth ? undefined : (hasExplicitWidth ? columnWidth : undefined);

      cellStyles[col.columnId] = {
        minWidth: effectiveMinWidth,
        width: autoWidth,
        maxWidth: autoMaxWidth,
        textAlign: col.type === 'numeric' ? 'right' : col.type === 'boolean' ? 'center' : undefined,
        ...stickyOverride,
        ...(isPinnedLeft && leftOffsets[col.columnId] != null ? { left: leftOffsets[col.columnId] } : undefined),
        ...(isPinnedRight && rightOffsets[col.columnId] != null ? { right: rightOffsets[col.columnId] } : undefined),
      };

      hdrStyles[col.columnId] = {
        minWidth: effectiveMinWidth,
        width: autoWidth,
        maxWidth: autoMaxWidth,
        ...stickyOverride,
        ...(isPinnedLeft && leftOffsets[col.columnId] != null ? { left: leftOffsets[col.columnId] } : undefined),
        ...(isPinnedRight && rightOffsets[col.columnId] != null ? { right: rightOffsets[col.columnId] } : undefined),
      };

      const parts: string[] = [];
      if (isPinnedLeft) parts.push(pinnedColLeftClass);
      if (isPinnedRight) parts.push(pinnedColRightClass);
      const cn = parts.join(' ');
      cellClasses[col.columnId] = cn;
      hdrClasses[col.columnId] = cn;
    }

    return { cellStyles, cellClasses, hdrStyles, hdrClasses };
  }, [visibleCols, getColumnWidth, columnSizingOverrides, measuredColumnWidths, pinnedColumns, leftOffsets, rightOffsets, pinnedColLeftClass, pinnedColRightClass, addStickyPosition]);
}
