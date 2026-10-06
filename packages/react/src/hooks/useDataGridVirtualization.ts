import { useEffect, useLayoutEffect, useMemo } from 'react';
import { useVirtualScroll } from './useVirtualScroll';
import { collectUnpinnedColumnWidths, resolveVirtualScrollSettings } from './dataGridDerivations';
import type { MutableRefObject, RefObject } from 'react';
import type { UseVirtualScrollResult } from './useVirtualScroll';
import type { IColumnDef, IOGridDataGridProps } from '../types';

/**
 * Row (and optional column) virtualization, the imperative scroll hooks, and
 * window fetching for a windowed data source.
 */
export function useDataGridVirtualization<T>(
  props: Pick<IOGridDataGridProps<T>, 'virtualScroll' | 'windowed' | 'rowHeight' | 'items' | 'pinnedColumns' | 'scrollToRowRef'>,
  stickyHeader: boolean,
  visibleCols: IColumnDef<T>[],
  getColumnWidth: (col: IColumnDef<T>) => number,
  wrapperRef: RefObject<HTMLDivElement | null>,
  /** Filled with the current scrollToIndex every render (keyboard navigation reads it). */
  scrollToIndexRef: MutableRefObject<UseVirtualScrollResult['scrollToIndex'] | null>,
) {
  const { virtualScroll, windowed, pinnedColumns, scrollToRowRef } = props;
  const settings = resolveVirtualScrollSettings(virtualScroll, windowed ? windowed.rowCount : null, props.rowHeight, props.items.length);
  const columnVirtualization = settings.columnVirtualization;

  // Unpinned column widths for horizontal virtualization.
  const unpinnedColumnWidths = useMemo(
    () => (columnVirtualization ? collectUnpinnedColumnWidths(visibleCols, pinnedColumns, getColumnWidth) : undefined),
    [columnVirtualization, visibleCols, pinnedColumns, getColumnWidth]
  );

  const { visibleRange, columnRange, onHorizontalScroll, scrollToIndex } = useVirtualScroll({
    totalRows: settings.totalRows,
    rowHeight: settings.rowHeight,
    enabled: settings.enabled,
    overscan: virtualScroll?.overscan,
    threshold: settings.threshold,
    containerRef: wrapperRef,
    stickyHeader,
    columnVirtualization,
    columnWidths: unpinnedColumnWidths,
    columnOverscan: virtualScroll?.columnOverscan,
  });
  scrollToIndexRef.current = scrollToIndex;

  useLayoutEffect(() => {
    if (!scrollToRowRef) return;
    scrollToRowRef.current = (index, options) => scrollToIndex(index, options?.align ?? 'start');
    return () => { scrollToRowRef.current = null; };
  }, [scrollToRowRef, scrollToIndex]);

  // Fetch the visible window from a windowed data source as the viewport moves.
  // `getRow` only reads cache; `requestWindow` is what drives the background
  // fetches, so it must be called whenever the visible range changes.
  const requestWindow = windowed?.requestWindow;
  useEffect(() => {
    if (!requestWindow) return;
    if (visibleRange.endIndex < visibleRange.startIndex) return;
    requestWindow(visibleRange.startIndex, visibleRange.endIndex + 1);
  }, [requestWindow, visibleRange.startIndex, visibleRange.endIndex]);

  return {
    virtualScrollEnabled: settings.enabled,
    virtualRowHeight: settings.rowHeight,
    visibleRange,
    columnRange,
    onHorizontalScroll,
  };
}
