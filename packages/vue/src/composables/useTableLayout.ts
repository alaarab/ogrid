import { ref, computed, watch, onMounted, onUnmounted, type Ref, type ShallowRef } from 'vue';
import type { IColumnDef } from '../types';
import { CHECKBOX_COLUMN_WIDTH, CELL_PADDING, estimateHeaderMinWidth } from '@alaarab/ogrid-core';

export interface UseTableLayoutParams<T> {
  wrapperRef: Ref<HTMLElement | null> | ShallowRef<HTMLElement | null>;
  visibleCols: Ref<IColumnDef<T>[]>;
  flatColumns: Ref<IColumnDef<T>[]>;
  hasCheckboxCol: Ref<boolean>;
  initialColumnWidths?: Record<string, number>;
  onColumnResized?: (columnId: string, width: number) => void;
}

export interface UseTableLayoutResult {
  containerWidth: Ref<number>;
  minTableWidth: Ref<number>;
  desiredTableWidth: Ref<number>;
  columnSizingOverrides: Ref<Record<string, { widthPx: number }>>;
  setColumnSizingOverrides: (value: Record<string, { widthPx: number }>) => void;
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

  // Container width measurement via ResizeObserver
  const containerWidth = ref<number>(0);
  let resizeObserver: ResizeObserver | undefined;

  const measure = () => {
    const el = wrapperRef.value;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cs = window.getComputedStyle(el);
    const borderX =
      (parseFloat(cs.borderLeftWidth || '0') || 0) +
      (parseFloat(cs.borderRightWidth || '0') || 0);
    containerWidth.value = Math.max(0, rect.width - borderX);
  };

  onMounted(() => {
    const el = wrapperRef.value;
    if (el) {
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(measure);
        resizeObserver.observe(el);
      }
      measure();
    }
  });

  onUnmounted(() => {
    resizeObserver?.disconnect();
  });

  // Column sizing overrides state
  const columnSizingOverrides = ref<Record<string, { widthPx: number }>>((() => {
    if (!initialColumnWidths) return {};
    const result: Record<string, { widthPx: number }> = {};
    for (const [id, width] of Object.entries(initialColumnWidths)) {
      result[id] = { widthPx: width };
    }
    return result;
  })());

  const setColumnSizingOverrides = (value: Record<string, { widthPx: number }>) => {
    columnSizingOverrides.value = value;
  };

  // Minimum table width calculation
  const minTableWidth = computed(() => {
    const checkboxW = hasCheckboxCol.value ? CHECKBOX_COLUMN_WIDTH : 0;
    return visibleCols.value.reduce(
      (sum, c) => sum + (c.minWidth ?? estimateHeaderMinWidth(c.name)) + CELL_PADDING,
      checkboxW
    );
  });

  // Cleanup effect: remove overrides for columns that no longer exist
  watch(flatColumns, (cols) => {
    const colIds = new Set(cols.map((c) => c.columnId));
    const prev = columnSizingOverrides.value;
    const keys = Object.keys(prev);
    const kept = keys.filter((id) => colIds.has(id));
    if (kept.length < keys.length) {
      const next: Record<string, { widthPx: number }> = {};
      for (const id of kept) next[id] = prev[id];
      columnSizingOverrides.value = next;
    }
  });

  // Desired table width calculation
  const desiredTableWidth = computed(() => {
    const checkboxW = hasCheckboxCol.value ? CHECKBOX_COLUMN_WIDTH : 0;
    return visibleCols.value.reduce((sum, c) => {
      const override = columnSizingOverrides.value[c.columnId];
      const headerMin = c.minWidth ?? estimateHeaderMinWidth(c.name);
      const w = override
        ? override.widthPx
        : (c.idealWidth ?? c.defaultWidth ?? headerMin);
      return sum + Math.max(headerMin, w) + CELL_PADDING;
    }, checkboxW);
  });

  return {
    containerWidth,
    minTableWidth,
    desiredTableWidth,
    columnSizingOverrides,
    setColumnSizingOverrides,
    onColumnResized,
  };
}
