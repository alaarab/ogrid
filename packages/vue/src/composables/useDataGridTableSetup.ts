import { ref, computed, type Ref } from 'vue';
import { flattenColumns } from '@alaarab/ogrid-core';
import type { IOGridDataGridProps } from '../types';
import { useDataGridState, type UseDataGridStateResult } from './useDataGridState';
import { useColumnResize, type UseColumnResizeResult } from './useColumnResize';
import { useColumnReorder, type UseColumnReorderResult } from './useColumnReorder';
import { useVirtualScroll, type UseVirtualScrollResult } from './useVirtualScroll';

export interface UseDataGridTableSetupParams<T> {
  /** Computed ref wrapping the gridProps passed to the DataGridTable component. */
  props: Ref<IOGridDataGridProps<T>>;
}

export interface UseDataGridTableSetupResult<T> {
  /** Ref to the scrollable wrapper div. Must be bound to the outermost scroll container. */
  wrapperRef: Ref<HTMLDivElement | null>;
  /** Ref to the inner container div wrapping the table. */
  tableContainerRef: Ref<HTMLDivElement | null>;
  /** Ref to the <table> element. Used by column reorder for hit-testing. */
  tableRef: Ref<HTMLElement | null>;
  /** Tracks whether the last mousedown had shiftKey (for shift-click row selection). */
  lastMouseShift: Ref<boolean>;

  /** Full DataGridState result (layout, rowSelection, editing, interaction, contextMenu, viewModels). */
  state: UseDataGridStateResult<T>;

  /** Column reorder state and handler. */
  columnReorder: UseColumnReorderResult;

  /** Virtual scroll state (containerRef, visibleRange, totalHeight, scrollToRow). */
  virtualScroll: UseVirtualScrollResult;
  /** Computed ref indicating whether virtual scrolling is enabled. */
  virtualScrollEnabled: Ref<boolean>;

  /** Column resize handlers (handleResizeStart, getColumnWidth). */
  columnResize: UseColumnResizeResult<T>;
}

/**
 * Shared setup composable for Vue DataGridTable components.
 *
 * Encapsulates the common setup logic used by all Vue UI DataGridTable implementations
 * (Vuetify, PrimeVue, Radix). Each UI package only needs to handle its own template/render
 * function and framework-specific component bindings.
 */
export function useDataGridTableSetup<T>(
  params: UseDataGridTableSetupParams<T>
): UseDataGridTableSetupResult<T> {
  const { props: propsRef } = params;

  // --- Shared refs ---
  const wrapperRef = ref<HTMLDivElement | null>(null);
  const tableContainerRef = ref<HTMLDivElement | null>(null);
  const tableRef = ref<HTMLElement | null>(null);
  const lastMouseShift = ref(false);

  // --- Core state ---
  const state = useDataGridState<T>({ props: propsRef, wrapperRef });

  // --- Column reorder ---
  const columnOrderRef = computed(() => {
    const p = propsRef.value;
    if (p.columnOrder) return p.columnOrder;
    return flattenColumns(p.columns)
      .filter(c => p.visibleColumns?.has(c.columnId) ?? true)
      .map(c => c.columnId);
  });
  const onColumnOrderChangeRef = computed(() => propsRef.value.onColumnOrderChange);

  const columnReorder = useColumnReorder({
    columnOrder: columnOrderRef,
    onColumnOrderChange: onColumnOrderChangeRef,
    tableRef,
  });

  // --- Virtual scrolling ---
  const virtualScrollEnabled = computed(() => propsRef.value.virtualScroll?.enabled ?? false);
  const totalRowsRef = computed(() => propsRef.value.items.length);
  const rowHeight = propsRef.value.virtualScroll?.rowHeight ?? 36;
  const overscan = propsRef.value.virtualScroll?.overscan ?? 5;

  const virtualScroll = useVirtualScroll({
    totalRows: totalRowsRef,
    rowHeight,
    enabled: virtualScrollEnabled,
    overscan,
  });

  // --- Column resize ---
  const columnSizingOverridesRef = computed(() => state.layout.value.columnSizingOverrides);
  const columnResize = useColumnResize<T>({
    columnSizingOverrides: columnSizingOverridesRef,
    setColumnSizingOverrides: (v: Record<string, { widthPx: number }>) =>
      state.layout.value.setColumnSizingOverrides(v),
  });

  return {
    wrapperRef,
    tableContainerRef,
    tableRef,
    lastMouseShift,
    state,
    columnReorder,
    virtualScroll,
    virtualScrollEnabled,
    columnResize,
  };
}
