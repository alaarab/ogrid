import { useState, useEffect, useMemo } from 'react';
import type { RefObject } from 'react';
import type { IColumnDef } from '../types';
import { CHECKBOX_COLUMN_WIDTH, DEFAULT_MIN_COLUMN_WIDTH, CELL_PADDING } from '@alaarab/ogrid-core';

export interface UseTableLayoutParams<T> {
  wrapperRef: RefObject<HTMLDivElement | null>;
  visibleCols: IColumnDef<T>[];
  flatColumns: IColumnDef<T>[];
  hasCheckboxCol: boolean;
  initialColumnWidths?: Record<string, number>;
  onColumnResized?: (columnId: string, width: number) => void;
}

export interface UseTableLayoutResult {
  containerWidth: number;
  minTableWidth: number;
  desiredTableWidth: number;
  columnSizingOverrides: Record<string, { widthPx: number }>;
  setColumnSizingOverrides: React.Dispatch<
    React.SetStateAction<Record<string, { widthPx: number }>>
  >;
  onColumnResized?: (columnId: string, width: number) => void;
}

/**
 * Manages table layout: container width measurement, column sizing overrides,
 * min/desired table width calculations.
 */
export function useTableLayout<T>(
  params: UseTableLayoutParams<T>
): UseTableLayoutResult {
  const {
    wrapperRef,
    visibleCols,
    flatColumns,
    hasCheckboxCol,
    initialColumnWidths,
    onColumnResized,
  } = params;

  // --- Container width measurement via ResizeObserver ---
  const [containerWidth, setContainerWidth] = useState<number>(0);
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const cs = window.getComputedStyle(el);
      const borderX =
        (parseFloat(cs.borderLeftWidth || '0') || 0) +
        (parseFloat(cs.borderRightWidth || '0') || 0);
      setContainerWidth(Math.max(0, rect.width - borderX));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [wrapperRef]);

  // --- Column sizing overrides state ---
  const [columnSizingOverrides, setColumnSizingOverrides] = useState<
    Record<string, { widthPx: number }>
  >(() => {
    if (!initialColumnWidths) return {};
    const result: Record<string, { widthPx: number }> = {};
    for (const [id, width] of Object.entries(initialColumnWidths)) {
      result[id] = { widthPx: width };
    }
    return result;
  });

  // --- Minimum table width calculation ---
  const minTableWidth = useMemo(() => {
    const checkboxW = hasCheckboxCol ? CHECKBOX_COLUMN_WIDTH : 0;
    return visibleCols.reduce(
      (sum, c) => sum + (c.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH) + CELL_PADDING,
      checkboxW
    );
  }, [visibleCols, hasCheckboxCol]);

  // --- Cleanup effect: remove overrides for columns that no longer exist ---
  useEffect(() => {
    const colIds = new Set(flatColumns.map((c) => c.columnId));
    setColumnSizingOverrides((prev) => {
      const kept = Object.fromEntries(
        Object.entries(prev).filter(([id]) => colIds.has(id))
      );
      return Object.keys(kept).length !== Object.keys(prev).length ? kept : prev;
    });
  }, [flatColumns]);

  // --- Desired table width calculation ---
  const desiredTableWidth = useMemo(() => {
    const checkboxW = hasCheckboxCol ? CHECKBOX_COLUMN_WIDTH : 0;
    return visibleCols.reduce((sum, c) => {
      const override = columnSizingOverrides[c.columnId];
      const w = override
        ? override.widthPx
        : (c.idealWidth ?? c.defaultWidth ?? c.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH);
      return sum + Math.max(c.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH, w) + CELL_PADDING;
    }, checkboxW);
  }, [visibleCols, columnSizingOverrides, hasCheckboxCol]);

  return {
    containerWidth,
    minTableWidth,
    desiredTableWidth,
    columnSizingOverrides,
    setColumnSizingOverrides,
    onColumnResized,
  };
}
