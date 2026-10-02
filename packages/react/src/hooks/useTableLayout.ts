import { useState, useEffect, useMemo } from 'react';
import type { RefObject } from 'react';
import type { IColumnDef } from '../types';
import { CHECKBOX_COLUMN_WIDTH, CELL_PADDING, ROW_NUMBER_COLUMN_ID, estimateHeaderMinWidth } from '@alaarab/ogrid-core';

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

function toSizingOverrides(widths: Record<string, number> | undefined): Record<string, { widthPx: number }> {
  const result: Record<string, { widthPx: number }> = {};
  if (!widths) return result;
  for (const [id, width] of Object.entries(widths)) {
    result[id] = { widthPx: width };
  }
  return result;
}

function sameWidths(a: Record<string, number> | undefined, b: Record<string, number> | undefined): boolean {
  const aKeys = Object.keys(a ?? {});
  if (aKeys.length !== Object.keys(b ?? {}).length) return false;
  return aKeys.every((id) => a?.[id] === b?.[id]);
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

  // --- Container width measurement via ResizeObserver (rAF-throttled) ---
  const [containerWidth, setContainerWidth] = useState<number>(0);
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    let rafId = 0;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const cs = window.getComputedStyle(el);
      const borderX =
        (parseFloat(cs.borderLeftWidth || '0') || 0) +
        (parseFloat(cs.borderRightWidth || '0') || 0);
      const next = Math.round(Math.max(0, rect.width - borderX));
      // Round to integer to prevent sub-pixel oscillation that causes
      // infinite re-render loops during column resize.
      setContainerWidth((prev) => (prev === next ? prev : next));
    };
    const throttledMeasure = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        measure();
      });
    };
    const ro = new ResizeObserver(throttledMeasure);
    ro.observe(el);
    measure(); // initial synchronous measurement
    return () => { ro.disconnect(); if (rafId) cancelAnimationFrame(rafId); };
  }, [wrapperRef]);

  // --- Column sizing overrides state ---
  const [columnSizingOverrides, setColumnSizingOverrides] = useState<
    Record<string, { widthPx: number }>
  >(() => toSizingOverrides(initialColumnWidths));

  // Later changes to initialColumnWidths (applyColumnState, a per-sheet width
  // restore) replace the rendered widths. A change that only echoes back widths
  // this grid already holds (a resize it just reported through onColumnResized)
  // is ignored, so the widths locked at the start of a drag survive. Adjusted
  // during render so the grid never commits a frame with the previous widths.
  const [prevInitialColumnWidths, setPrevInitialColumnWidths] = useState(initialColumnWidths);
  if (initialColumnWidths !== prevInitialColumnWidths && !sameWidths(initialColumnWidths, prevInitialColumnWidths)) {
    setPrevInitialColumnWidths(initialColumnWidths);
    const next = initialColumnWidths ?? {};
    const prev = prevInitialColumnWidths ?? {};
    const isEcho = Object.keys({ ...prev, ...next }).every(
      (id) => next[id] === prev[id] || (next[id] !== undefined && next[id] === columnSizingOverrides[id]?.widthPx)
    );
    if (!isEcho) {
      const rowNumberOverride = columnSizingOverrides[ROW_NUMBER_COLUMN_ID];
      setColumnSizingOverrides({
        ...toSizingOverrides(next),
        ...(rowNumberOverride ? { [ROW_NUMBER_COLUMN_ID]: rowNumberOverride } : undefined),
      });
    }
  }

  // --- Minimum table width calculation ---
  const minTableWidth = useMemo(() => {
    const checkboxW = hasCheckboxCol ? CHECKBOX_COLUMN_WIDTH : 0;
    return visibleCols.reduce(
      (sum, c) => sum + (c.minWidth ?? estimateHeaderMinWidth(c.name)) + CELL_PADDING,
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
      const headerMin = c.minWidth ?? estimateHeaderMinWidth(c.name);
      const w = override
        ? override.widthPx
        : (c.idealWidth ?? c.defaultWidth ?? headerMin);
      return sum + Math.max(headerMin, w) + CELL_PADDING;
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
