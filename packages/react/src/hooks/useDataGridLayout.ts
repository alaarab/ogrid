import { useMemo, useState, useLayoutEffect, useCallback } from 'react';
import type { RefObject } from 'react';
import { flattenColumns, computeHiddenGaps, hiddenKeysAround } from '../utils';
import type { RowId, IColumnDef } from '../types';
import { CHECKBOX_COLUMN_WIDTH, ROW_NUMBER_COLUMN_ID, ROW_NUMBER_COLUMN_WIDTH, DEFAULT_MIN_COLUMN_WIDTH, resolveResponsiveConfig, applyResponsiveHiding } from '@alaarab/ogrid-core';
import type { IResponsiveColumnsConfig } from '@alaarab/ogrid-core';
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
  sortModel?: ReadonlyArray<{ field: string; direction: 'asc' | 'desc' }>;
  onColumnSort?: (columnKey: string, direction?: 'asc' | 'desc' | null, options?: { additive?: boolean }) => void;
  responsiveColumns?: boolean | IResponsiveColumnsConfig;
  wrapperRef: RefObject<HTMLDivElement | null>;
  /** Column structure edits for the header menu (omit to hide those items). */
  onInsertColumn?: (columnId: string, side: 'left' | 'right') => void;
  onDeleteColumn?: (columnId: string) => void;
  /** Hide/unhide columns from the header menu (omit to hide those items and the gap markers). */
  onHideColumns?: (columnIds: string[]) => void;
  onUnhideColumns?: (columnIds: string[]) => void;
}

/** Columns in display order: `columnOrder` first, then the rest in definition order. */
function orderColumns<C extends { columnId: string }>(cols: C[], columnOrder: string[] | undefined): C[] {
  if (!columnOrder?.length) return cols;
  const orderMap = new Map<string, number>();
  for (let i = 0; i < columnOrder.length; i++) {
    const id = columnOrder[i];
    if (id !== undefined) orderMap.set(id, i);
  }
  return [...cols].sort((a, b) => {
    const ia = orderMap.get(a.columnId) ?? -1;
    const ib = orderMap.get(b.columnId) ?? -1;
    if (ia === -1 && ib === -1) return 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
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
  stableOnColumnSort: (columnKey: string, direction?: 'asc' | 'desc' | null, options?: { additive?: boolean }) => void;
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
    sortModel,
    onColumnSort,
    responsiveColumns,
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

  const responsiveConfig = useMemo(
    () => resolveResponsiveConfig(responsiveColumns),
    [responsiveColumns],
  );

  // First pass: user-visible columns (before responsive hiding)
  const userVisibleCols = useMemo(() => {
    const filtered = visibleColumns
      ? flatColumns.filter((c) => visibleColumns.has(c.columnId))
      : flatColumns;
    return orderColumns(filtered, columnOrder);
  }, [flatColumns, visibleColumns, columnOrder]);

  // Where user-hidden columns sit among the visible ones (allowHiding): gap
  // markers in the header and "Unhide columns" read this.
  const { onHideColumns, onUnhideColumns } = params;
  const hidingColumns = onUnhideColumns != null;
  const hiddenColumnGaps = useMemo(() => {
    if (!hidingColumns || !visibleColumns) return null;
    const ordered = orderColumns(flatColumns, columnOrder).map((c) => c.columnId);
    const gaps = computeHiddenGaps(ordered, (id) => !visibleColumns.has(id));
    return gaps.before.size > 0 || gaps.after.length > 0 ? gaps : null;
  }, [hidingColumns, flatColumns, visibleColumns, columnOrder]);
  const userVisibleIds = useMemo(() => userVisibleCols.map((c) => c.columnId), [userVisibleCols]);
  const getHiddenColumnsAround = useCallback(
    (columnId: string) => (hiddenColumnGaps ? hiddenKeysAround(hiddenColumnGaps, userVisibleIds, columnId) : []),
    [hiddenColumnGaps, userVisibleIds]
  );
  const onHideColumn = useMemo(
    () => onHideColumns ? (columnId: string) => onHideColumns([columnId]) : undefined,
    [onHideColumns]
  );
  const canHideColumn = useCallback(
    (columnId: string) => userVisibleCols.length > 1 && flatColumns.find((c) => c.columnId === columnId)?.required !== true,
    [userVisibleCols.length, flatColumns]
  );

  const hasCheckboxCol = rowSelection === 'multiple';
  const hasRowNumbersCol = !!showRowNumbers;

  const rowIndexByRowId = useMemo(() => {
    const m = new Map<RowId, number>();
    items.forEach((item, idx) => {
      m.set(getRowId(item), idx);
    });
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
    visibleCols: userVisibleCols,
    flatColumns,
    hasCheckboxCol,
    initialColumnWidths,
    onColumnResized,
  });

  // Second pass: apply responsive column hiding based on measured container width
  const visibleCols = useMemo(
    () => applyResponsiveHiding(userVisibleCols, containerWidth, responsiveConfig) as IColumnDef<T>[],
    [userVisibleCols, containerWidth, responsiveConfig],
  );

  const visibleColumnCount = visibleCols.length;
  const specialColsCount = (hasCheckboxCol ? 1 : 0) + (hasRowNumbersCol ? 1 : 0);
  const totalColCount = visibleColumnCount + specialColsCount;
  const colOffset = specialColsCount;

  const pinningResult = useColumnPinning({
    columns: flatColumns,
    pinnedColumns,
    onColumnPinned,
  });

  // Measure actual column widths from the DOM for accurate pinning offsets.
  // Use a serialized key of overrides to prevent re-running on every object reference change
  // during rapid resize drags. Only re-measure when the actual override VALUES change.
  const overridesKey = useMemo(() => {
    const entries = Object.entries(columnSizingOverrides);
    if (entries.length === 0) return '';
    return entries.map(([id, v]) => `${id}:${Math.round(v.widthPx)}`).join(',');
  }, [columnSizingOverrides]);

  const [measuredColumnWidths, setMeasuredColumnWidths] = useState<Record<string, number>>({});

  // Auto-width columns use their measured width as min-width, and that width
  // includes the fill-layout share of the old container. When the container
  // narrows, drop the measurements so columns fall back to their base
  // min-width, then re-measure at the new size. Only a shrink resets: growing
  // never leaves a column too wide, and keeping the ratchet otherwise avoids
  // width jitter as rows scroll in and out.
  const [measuredAtWidth, setMeasuredAtWidth] = useState(containerWidth);
  const [measureEpoch, setMeasureEpoch] = useState(0);
  if (containerWidth !== measuredAtWidth) {
    setMeasuredAtWidth(containerWidth);
    if (containerWidth < measuredAtWidth) {
      setMeasuredColumnWidths({});
      setMeasureEpoch((n) => n + 1);
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: visibleCols, overridesKey and measureEpoch are deliberate re-measure triggers (see note below) — the effect reads the DOM, not these values
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
  // Note: containerWidth intentionally excluded  -  it's already reflected in
  // DOM offsetWidth values. Including it creates a loop: ResizeObserver  to 
  // setContainerWidth  to  useLayoutEffect  to  setMeasuredColumnWidths  to  re-render
  //  to  ResizeObserver  to  ...
  // overridesKey is a serialized string so the effect only re-runs when values actually change,
  // not on every new object reference during rapid resize. measureEpoch bumps only when the
  // container shrinks (see above).
  }, [visibleCols, overridesKey, measureEpoch, wrapperRef]);

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

  // The row-number column sits between the checkbox and the first data column, so
  // left-pinned offsets must start after it.
  const rowNumberWidth = hasRowNumbersCol
    ? (columnSizingOverrides[ROW_NUMBER_COLUMN_ID]?.widthPx ?? ROW_NUMBER_COLUMN_WIDTH)
    : 0;
  // Depend on the memoized compute functions, not the pinning result object
  // (a new literal every render), so offsets and columnMeta stay stable.
  const { computeLeftOffsets, computeRightOffsets } = pinningResult;
  const leftOffsets = useMemo(
    () => computeLeftOffsets(visibleCols, columnWidthMap, DEFAULT_MIN_COLUMN_WIDTH, hasCheckboxCol, CHECKBOX_COLUMN_WIDTH, rowNumberWidth),
    [computeLeftOffsets, visibleCols, columnWidthMap, hasCheckboxCol, rowNumberWidth]
  );

  const rightOffsets = useMemo(
    () => computeRightOffsets(visibleCols, columnWidthMap, DEFAULT_MIN_COLUMN_WIDTH),
    [computeRightOffsets, visibleCols, columnWidthMap]
  );

  // Stabilize onColumnSort via ref
  const onColumnSortRef = useLatestRef(onColumnSort);
  const stableOnColumnSort = useCallback(
    (columnKey: string, direction?: 'asc' | 'desc' | null, options?: { additive?: boolean }) =>
      options ? onColumnSortRef.current?.(columnKey, direction, options) : onColumnSortRef.current?.(columnKey, direction),
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
    wrapperRef,
    pinnedColumns: pinningResult.pinnedColumns,
    onPinColumn: pinningResult.pinColumn,
    onUnpinColumn: pinningResult.unpinColumn,
    sortBy,
    sortDirection: sortDirection ?? 'asc',
    sortModel,
    onColumnSort: stableOnColumnSort,
    onColumnResized,
    onAutosizeColumn: handleAutosizeColumn,
    columns: flatColumns,
    onInsertColumn: params.onInsertColumn,
    onDeleteColumn: params.onDeleteColumn,
    onHideColumn,
    canHideColumn,
    getHiddenColumnsAround: hidingColumns ? getHiddenColumnsAround : undefined,
    onUnhideColumns,
  });

  // Memoize layout sub-object
  const layoutState = useMemo<DataGridLayoutState<T>>(() => ({
    flatColumns, visibleCols, visibleColumnCount, totalColCount, colOffset,
    hasCheckboxCol, hasRowNumbersCol, rowIndexByRowId, containerWidth, minTableWidth,
    desiredTableWidth, columnSizingOverrides, setColumnSizingOverrides, onColumnResized,
    measuredColumnWidths, hiddenColumnGaps,
  }), [
    flatColumns, visibleCols, visibleColumnCount, totalColCount, colOffset,
    hasCheckboxCol, hasRowNumbersCol, rowIndexByRowId, containerWidth, minTableWidth,
    desiredTableWidth, columnSizingOverrides, setColumnSizingOverrides, onColumnResized,
    measuredColumnWidths, hiddenColumnGaps,
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
