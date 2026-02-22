import { useMemo, useState, useLayoutEffect, useCallback } from 'react';
import type { RefObject } from 'react';
import { flattenColumns } from '../utils';
import type { RowId, IColumnDef } from '../types';
import { CHECKBOX_COLUMN_WIDTH, DEFAULT_MIN_COLUMN_WIDTH } from '@alaarab/ogrid-core';
import { useTableLayout } from './useTableLayout';
import { useColumnPinning } from './useColumnPinning';
import { useColumnHeaderMenuState } from './useColumnHeaderMenuState';
import { useLatestRef } from './useLatestRef';
import type { DataGridLayoutState, DataGridPinningState } from './useDataGridState';

export interface UseDataGridLayoutParams<T> {
  columns: unknown[];
  items: T[];
  getRowId: (item: T) => RowId;
  visibleColumns?: Set<string>;
  columnOrder?: string[];
  rowSelection?: string;
  showRowNumbers?: boolean;
  initialColumnWidths?: Record<string, number>;
  onColumnResized?: (columnId: string, width: number) => void;
  onAutosizeColumn?: (columnId: string, width: number) => void;
  pinnedColumns?: Record<string, 'left' | 'right'>;
  onColumnPinned?: (columnId: string, side: 'left' | 'right' | null) => void;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  onColumnSort?: (columnKey: string, direction?: 'asc' | 'desc' | null) => void;
  wrapperRef: RefObject<HTMLDivElement | null>;
}

export interface UseDataGridLayoutResult<T> {
  layout: DataGridLayoutState<T>;
  pinning: DataGridPinningState;
  flatColumns: IColumnDef<T>[];
  visibleCols: IColumnDef<T>[];
  visibleColumnCount: number;
  totalColCount: number;
  colOffset: number;
  hasCheckboxCol: boolean;
  hasRowNumbersCol: boolean;
  columnSizingOverrides: Record<string, { widthPx: number }>;
  setColumnSizingOverrides: React.Dispatch<
    React.SetStateAction<Record<string, { widthPx: number }>>
  >;
  handleAutosizeColumn: (columnId: string, width: number) => void;
  stableOnColumnSort: (columnKey: string, direction?: 'asc' | 'desc' | null) => void;
}

/**
 * Manages column layout, visibility, sizing, pinning, and header menu state.
 * Extracted from useDataGridState for modularity.
 */
export function useDataGridLayout<T>(
  params: UseDataGridLayoutParams<T>
): UseDataGridLayoutResult<T> {
  const {
    columns,
    items,
    getRowId,
    visibleColumns,
    columnOrder,
    rowSelection = 'none',
    showRowNumbers,
    initialColumnWidths,
    onColumnResized,
    onAutosizeColumn,
    pinnedColumns,
    onColumnPinned,
    sortBy,
    sortDirection,
    onColumnSort,
    wrapperRef,
  } = params;

  // Cast is safe: input columns are React.IColumnDef instances; flattenColumns only extracts leaves.
  const flatColumnsRaw = useMemo(() => flattenColumns(columns as (IColumnDef<T>)[]) as IColumnDef<T>[], [columns]);

  // Apply runtime pin overrides (from applyColumnState or programmatic changes)
  const flatColumns = useMemo(() => {
    if (!pinnedColumns || Object.keys(pinnedColumns).length === 0) return flatColumnsRaw;
    return flatColumnsRaw.map((col) => {
      const override = pinnedColumns[col.columnId];
      if (override && col.pinned !== override) {
        return { ...col, pinned: override };
      }
      return col;
    });
  }, [flatColumnsRaw, pinnedColumns]);

  const visibleCols = useMemo(() => {
    const filtered = visibleColumns
      ? flatColumns.filter((c) => visibleColumns.has(c.columnId))
      : flatColumns;
    if (!columnOrder?.length) return filtered;
    const orderMap = new Map<string, number>();
    for (let i = 0; i < columnOrder.length; i++) {
      orderMap.set(columnOrder[i], i);
    }
    return [...filtered].sort((a, b) => {
      const ia = orderMap.get(a.columnId) ?? -1;
      const ib = orderMap.get(b.columnId) ?? -1;
      if (ia === -1 && ib === -1) return 0;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }, [flatColumns, visibleColumns, columnOrder]);

  const visibleColumnCount = visibleCols.length;
  const hasCheckboxCol = rowSelection === 'multiple';
  const hasRowNumbersCol = !!showRowNumbers;
  const specialColsCount = (hasCheckboxCol ? 1 : 0) + (hasRowNumbersCol ? 1 : 0);
  const totalColCount = visibleColumnCount + specialColsCount;
  const colOffset = specialColsCount;

  const rowIndexByRowId = useMemo(() => {
    const m = new Map<RowId, number>();
    items.forEach((item, idx) => m.set(getRowId(item), idx));
    return m;
  }, [items, getRowId]);

  const {
    containerWidth,
    minTableWidth,
    desiredTableWidth,
    columnSizingOverrides,
    setColumnSizingOverrides,
  } = useTableLayout({
    wrapperRef,
    visibleCols,
    flatColumns,
    hasCheckboxCol,
    initialColumnWidths,
    onColumnResized,
  });

  const pinningResult = useColumnPinning({
    columns: flatColumns,
    pinnedColumns,
    onColumnPinned,
  });

  // Measure actual column widths from the DOM for accurate pinning offsets.
  const [measuredColumnWidths, setMeasuredColumnWidths] = useState<Record<string, number>>({});
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const headerCells = wrapper.querySelectorAll<HTMLElement>('th[data-column-id]');
    if (headerCells.length === 0) return;
    const measured: Record<string, number> = {};
    headerCells.forEach((cell) => {
      const colId = cell.getAttribute('data-column-id');
      if (colId) measured[colId] = cell.offsetWidth;
    });
    setMeasuredColumnWidths((prev) => {
      for (const key in measured) {
        if (prev[key] !== measured[key]) return measured;
      }
      if (Object.keys(prev).length !== Object.keys(measured).length) return measured;
      return prev;
    });
  // Note: containerWidth intentionally excluded — it's already reflected in
  // DOM offsetWidth values. Including it creates a loop: ResizeObserver →
  // setContainerWidth → useLayoutEffect → setMeasuredColumnWidths → re-render
  // → ResizeObserver → ...
  }, [visibleCols, columnSizingOverrides, wrapperRef]);

  // Build column width map for pinning offset computation
  const columnWidthMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const col of visibleCols) {
      const override = columnSizingOverrides[col.columnId];
      map[col.columnId] = override
        ? override.widthPx
        : (measuredColumnWidths[col.columnId] ?? col.idealWidth ?? col.defaultWidth ?? col.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH);
    }
    return map;
  }, [visibleCols, columnSizingOverrides, measuredColumnWidths]);

  const leftOffsets = useMemo(
    () => pinningResult.computeLeftOffsets(visibleCols, columnWidthMap, DEFAULT_MIN_COLUMN_WIDTH, hasCheckboxCol, CHECKBOX_COLUMN_WIDTH),
    [pinningResult, visibleCols, columnWidthMap, hasCheckboxCol]
  );

  const rightOffsets = useMemo(
    () => pinningResult.computeRightOffsets(visibleCols, columnWidthMap, DEFAULT_MIN_COLUMN_WIDTH),
    [pinningResult, visibleCols, columnWidthMap]
  );

  // Stabilize onColumnSort via ref
  const onColumnSortRef = useLatestRef(onColumnSort);
  const stableOnColumnSort = useCallback(
    (columnKey: string, direction?: 'asc' | 'desc' | null) => onColumnSortRef.current?.(columnKey, direction),
    [onColumnSortRef]
  );

  // Autosize callback
  const handleAutosizeColumn = useCallback(
    (columnId: string, width: number) => {
      setColumnSizingOverrides((prev) => ({ ...prev, [columnId]: { widthPx: width } }));
      (onAutosizeColumn ?? onColumnResized)?.(columnId, width);
    },
    [setColumnSizingOverrides, onAutosizeColumn, onColumnResized]
  );

  const headerMenuResult = useColumnHeaderMenuState({
    pinnedColumns: pinningResult.pinnedColumns,
    onPinColumn: pinningResult.pinColumn,
    onUnpinColumn: pinningResult.unpinColumn,
    sortBy,
    sortDirection: sortDirection ?? 'asc',
    onColumnSort: stableOnColumnSort,
    onColumnResized,
    onAutosizeColumn: handleAutosizeColumn,
    columns: flatColumns,
  });

  // Memoize layout sub-object
  const layoutState = useMemo<DataGridLayoutState<T>>(() => ({
    flatColumns, visibleCols, visibleColumnCount, totalColCount, colOffset,
    hasCheckboxCol, hasRowNumbersCol, rowIndexByRowId, containerWidth, minTableWidth,
    desiredTableWidth, columnSizingOverrides, setColumnSizingOverrides, onColumnResized,
    measuredColumnWidths,
  }), [
    flatColumns, visibleCols, visibleColumnCount, totalColCount, colOffset,
    hasCheckboxCol, hasRowNumbersCol, rowIndexByRowId, containerWidth, minTableWidth,
    desiredTableWidth, columnSizingOverrides, setColumnSizingOverrides, onColumnResized,
    measuredColumnWidths,
  ]);

  // Memoize pinning sub-object
  const pinningState = useMemo<DataGridPinningState>(() => ({
    pinnedColumns: pinningResult.pinnedColumns,
    pinColumn: pinningResult.pinColumn,
    unpinColumn: pinningResult.unpinColumn,
    isPinned: pinningResult.isPinned,
    leftOffsets,
    rightOffsets,
    headerMenu: headerMenuResult,
  }), [
    pinningResult.pinnedColumns, pinningResult.pinColumn, pinningResult.unpinColumn,
    pinningResult.isPinned, leftOffsets, rightOffsets,
    headerMenuResult,
  ]);

  return {
    layout: layoutState,
    pinning: pinningState,
    flatColumns,
    visibleCols,
    visibleColumnCount,
    totalColCount,
    colOffset,
    hasCheckboxCol,
    hasRowNumbersCol,
    columnSizingOverrides,
    setColumnSizingOverrides,
    handleAutosizeColumn,
    stableOnColumnSort,
  };
}
