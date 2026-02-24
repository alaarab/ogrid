import { ref, computed, type Ref } from 'vue';
import { flattenColumns, DEFAULT_MIN_COLUMN_WIDTH, partitionColumnsForVirtualization } from '@alaarab/ogrid-core';
import type { IOGridDataGridProps, IColumnDef } from '../types';
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

  /** Column virtualization partition (or null when column virtualization is off). */
  columnPartition: Ref<{
    pinnedLeft: IColumnDef<T>[];
    virtualizedUnpinned: IColumnDef<T>[];
    pinnedRight: IColumnDef<T>[];
    leftSpacerWidth: number;
    rightSpacerWidth: number;
  } | null>;

  /** Map from columnId to its global index in visibleCols. */
  globalColIndexMap: Ref<Map<string, number>>;
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

  // Column virtualization inputs
  const columnsVirtEnabled = computed(() => propsRef.value.virtualScroll?.columns === true);
  const columnOverscan = propsRef.value.virtualScroll?.columnOverscan ?? 2;

  // Compute unpinned column widths for column virtualization
  const unpinnedColumnWidths = computed(() => {
    const layout = state.layout.value;
    const { visibleCols, columnSizingOverrides } = layout;
    const pinnedCols = propsRef.value.pinnedColumns ?? {};
    const widths: number[] = [];
    for (const col of visibleCols) {
      if (pinnedCols[col.columnId] || col.pinned) continue;
      const override = columnSizingOverrides[col.columnId];
      widths.push(override ? override.widthPx : (col.defaultWidth ?? col.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH));
    }
    return widths;
  });

  const virtualScroll = useVirtualScroll({
    totalRows: totalRowsRef,
    rowHeight,
    enabled: virtualScrollEnabled,
    overscan,
    columnsEnabled: columnsVirtEnabled,
    columnWidths: unpinnedColumnWidths,
    columnOverscan,
  });

  // Column virtualization partition
  const columnPartition = computed(() => {
    if (!columnsVirtEnabled.value) return null;
    const layout = state.layout.value;
    const cols = layout.visibleCols as IColumnDef<T>[];
    const range = virtualScroll.columnRange.value;
    const pinnedCols = propsRef.value.pinnedColumns;
    return partitionColumnsForVirtualization(cols, range, pinnedCols) as {
      pinnedLeft: IColumnDef<T>[];
      virtualizedUnpinned: IColumnDef<T>[];
      pinnedRight: IColumnDef<T>[];
      leftSpacerWidth: number;
      rightSpacerWidth: number;
    };
  });

  // Global column index map
  const globalColIndexMap = computed(() => {
    const layout = state.layout.value;
    const cols = layout.visibleCols;
    const map = new Map<string, number>();
    for (let i = 0; i < cols.length; i++) {
      map.set(cols[i].columnId, i);
    }
    return map;
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
    columnPartition,
    globalColIndexMap,
  };
}
