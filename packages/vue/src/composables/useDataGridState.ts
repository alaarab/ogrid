import { ref, shallowRef, computed, watch, nextTick, triggerRef, type Ref, type ShallowRef } from 'vue';
import { flattenColumns, getDataGridStatusBarConfig, parseValue, computeAggregations, CHECKBOX_COLUMN_WIDTH, DEFAULT_MIN_COLUMN_WIDTH } from '@alaarab/ogrid-core';
import type { RowId, IOGridDataGridProps, IStatusBarProps, IColumnDef } from '../types';
import type { HeaderFilterConfigInput, CellRenderDescriptorInput } from '../utils';
import { useRowSelection } from './useRowSelection';
import { useCellEditing } from './useCellEditing';
import { useActiveCell } from './useActiveCell';
import { useCellSelection } from './useCellSelection';
import { useContextMenu } from './useContextMenu';
import { useClipboard } from './useClipboard';
import { useKeyboardNavigation } from './useKeyboardNavigation';
import { useFillHandle } from './useFillHandle';
import { useUndoRedo } from './useUndoRedo';
import { useTableLayout } from './useTableLayout';
import { useColumnPinning } from './useColumnPinning';
import { useColumnHeaderMenuState } from './useColumnHeaderMenuState';

// Stable no-op handlers
const NOOP = () => {};
const NOOP_ASYNC = async () => {};
const NOOP_MOUSE = (_e: MouseEvent, _r: number, _c: number) => {};
const NOOP_KEY = (_e: KeyboardEvent) => {};
const NOOP_CTX = (_e: { clientX: number; clientY: number; preventDefault?: () => void }) => {};

export interface UseDataGridStateParams<T> {
  props: Ref<IOGridDataGridProps<T>>;
  wrapperRef: Ref<HTMLDivElement | null> | ShallowRef<HTMLDivElement | null>;
}

// --- Grouped sub-interfaces ---

export interface DataGridLayoutState<T> {
  flatColumns: IColumnDef<T>[];
  visibleCols: IColumnDef<T>[];
  visibleColumnCount: number;
  totalColCount: number;
  colOffset: number;
  hasCheckboxCol: boolean;
  hasRowNumbersCol: boolean;
  rowIndexByRowId: Map<RowId, number>;
  containerWidth: number;
  minTableWidth: number;
  desiredTableWidth: number;
  columnSizingOverrides: Record<string, { widthPx: number }>;
  setColumnSizingOverrides: (value: Record<string, { widthPx: number }>) => void;
  onColumnResized?: (columnId: string, width: number) => void;
  /** DOM-measured column widths from the previous layout pass.
   *  UI packages use these as a minWidth floor to prevent columns from
   *  shrinking when new data loads (e.g. during server-side pagination). */
  measuredColumnWidths: Record<string, number>;
  stickyHeader: boolean;
}

export interface DataGridRowSelectionState {
  selectedRowIds: Set<RowId>;
  updateSelection: (newSelectedIds: Set<RowId>) => void;
  handleRowCheckboxChange: (rowId: RowId, checked: boolean, rowIndex: number, shiftKey: boolean) => void;
  handleSelectAll: (checked: boolean) => void;
  allSelected: boolean;
  someSelected: boolean;
}

export interface DataGridEditingState<T> {
  editingCell: { rowId: RowId; columnId: string } | null;
  setEditingCell: (cell: { rowId: RowId; columnId: string } | null) => void;
  pendingEditorValue: unknown;
  setPendingEditorValue: (value: unknown) => void;
  commitCellEdit: (item: T, columnId: string, oldValue: unknown, newValue: unknown, rowIndex: number, globalColIndex: number) => void;
  cancelPopoverEdit: () => void;
  popoverAnchorEl: HTMLElement | null;
  setPopoverAnchorEl: (el: HTMLElement | null) => void;
}

export interface DataGridCellInteractionState {
  activeCell: { rowIndex: number; columnIndex: number } | null;
  setActiveCell: (cell: { rowIndex: number; columnIndex: number } | null) => void;
  selectionRange: { startRow: number; startCol: number; endRow: number; endCol: number } | null;
  setSelectionRange: (range: DataGridCellInteractionState['selectionRange']) => void;
  handleCellMouseDown: (e: MouseEvent, rowIndex: number, globalColIndex: number) => void;
  handleSelectAllCells: () => void;
  hasCellSelection: boolean;
  handleGridKeyDown: (e: KeyboardEvent) => void;
  handleFillHandleMouseDown: (e: MouseEvent) => void;
  handleCopy: () => void;
  handleCut: () => void;
  handlePaste: () => Promise<void>;
  cutRange: { startRow: number; startCol: number; endRow: number; endCol: number } | null;
  copyRange: { startRow: number; startCol: number; endRow: number; endCol: number } | null;
  clearClipboardRanges: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  isDragging: boolean;
}

export interface DataGridContextMenuState {
  menuPosition: { x: number; y: number } | null;
  setMenuPosition: (pos: { x: number; y: number } | null) => void;
  handleCellContextMenu: (e: { clientX: number; clientY: number; preventDefault?: () => void }) => void;
  closeContextMenu: () => void;
}

export interface DataGridViewModelState<T> {
  headerFilterInput: HeaderFilterConfigInput;
  cellDescriptorInput: CellRenderDescriptorInput<T>;
  statusBarConfig: IStatusBarProps | null;
  showEmptyInGrid: boolean;
  onCellError?: (error: Error, info: unknown) => void;
}

/** Column pinning state and column header menu. */
export interface DataGridPinningState {
  pinnedColumns: Record<string, 'left' | 'right'>;
  pinColumn: (columnId: string, side: 'left' | 'right') => void;
  unpinColumn: (columnId: string) => void;
  isPinned: (columnId: string) => 'left' | 'right' | undefined;
  leftOffsets: Record<string, number>;
  rightOffsets: Record<string, number>;
  headerMenu: {
    isOpen: boolean;
    openForColumn: string | null;
    anchorElement: HTMLElement | null;
    open: (columnId: string, anchorEl: HTMLElement) => void;
    close: () => void;
    handlePinLeft: () => void;
    handlePinRight: () => void;
    handleUnpin: () => void;
    handleSortAsc: () => void;
    handleSortDesc: () => void;
    handleClearSort: () => void;
    handleAutosizeThis: () => void;
    handleAutosizeAll: () => void;
    canPinLeft: boolean;
    canPinRight: boolean;
    canUnpin: boolean;
    currentSort: 'asc' | 'desc' | null;
    isSortable: boolean;
    isResizable: boolean;
  };
}

export interface UseDataGridStateResult<T> {
  layout: Ref<DataGridLayoutState<T>>;
  rowSelection: Ref<DataGridRowSelectionState>;
  editing: Ref<DataGridEditingState<T>>;
  interaction: Ref<DataGridCellInteractionState>;
  contextMenu: Ref<DataGridContextMenuState>;
  viewModels: Ref<DataGridViewModelState<T>>;
  pinning: Ref<DataGridPinningState>;
}

/**
 * Single orchestration composable for DataGridTable. Takes grid props and wrapper ref,
 * returns all derived state and handlers so UI packages can be thin view layers.
 */
export function useDataGridState<T>(
  params: UseDataGridStateParams<T>
): UseDataGridStateResult<T> {
  const { props, wrapperRef } = params;

  // --- Reactive refs for props consumed by sub-composables ---
  // Only properties that sub-composables need as Ref<...> get their own computed.
  // Everything else is read directly from props.value at the point of use to
  // avoid unnecessary intermediate reactive layers.
  const items = computed(() => props.value.items);
  const getRowId = props.value.getRowId; // stable function reference, no reactivity needed
  const rowSelectionProp = computed(() => props.value.rowSelection ?? 'none');
  const controlledSelectedRows = computed(() => props.value.selectedRows);
  const editableProp = computed(() => props.value.editable);
  const cellSelection = computed(() => props.value.cellSelection !== false);
  const pinnedColumnsProp = computed(() => props.value.pinnedColumns);

  // Undo/redo wrapping
  const undoRedo = useUndoRedo<T>({ onCellValueChanged: props.value.onCellValueChanged });
  const onCellValueChanged = computed(() => undoRedo.onCellValueChanged);

  /**
   * Core's flattenColumns returns IColumnDef<unknown>[] because the generic T
   * cannot be propagated through the group-flattening algorithm. At this call
   * site the input is IColumnDef<T>[] (via columnsProp), so the output is
   * guaranteed to be IColumnDef<T>[] — the cast is safe.
   */
  const flatColumnsRaw = computed(() => flattenColumns(props.value.columns) as IColumnDef<T>[]);

  const flatColumns = computed(() => {
    const pinned = pinnedColumnsProp.value;
    if (!pinned || Object.keys(pinned).length === 0) return flatColumnsRaw.value;
    return flatColumnsRaw.value.map((col) => {
      const override = pinned[col.columnId];
      if (override && col.pinned !== override) return { ...col, pinned: override };
      return col;
    });
  });

  const visibleCols = computed(() => {
    const vis = props.value.visibleColumns;
    const order = props.value.columnOrder;
    const filtered = vis ? flatColumns.value.filter((c) => vis.has(c.columnId)) : flatColumns.value;
    if (!order?.length) return filtered;
    // Build index map for O(1) lookup instead of repeated O(n) indexOf
    const orderMap = new Map<string, number>();
    for (let i = 0; i < order.length; i++) {
      orderMap.set(order[i], i);
    }
    return [...filtered].sort((a, b) => {
      const ia = orderMap.get(a.columnId) ?? -1;
      const ib = orderMap.get(b.columnId) ?? -1;
      if (ia === -1 && ib === -1) return 0;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  });

  const visibleColumnCount = computed(() => visibleCols.value.length);
  const hasCheckboxCol = computed(() => rowSelectionProp.value === 'multiple');
  const hasRowNumbersCol = computed(() => !!props.value.showRowNumbers);
  const specialColsCount = computed(() => (hasCheckboxCol.value ? 1 : 0) + (hasRowNumbersCol.value ? 1 : 0));
  const totalColCount = computed(() => visibleColumnCount.value + specialColsCount.value);
  const colOffset = specialColsCount; // reactive computed ref instead of snapshot

  // shallowRef + mutate-in-place + triggerRef: the Map is mutated (clear/set)
  // rather than replaced, so Vue's shallow reactivity doesn't detect the change.
  // triggerRef forces dependents to re-evaluate after the in-place mutation.
  const rowIndexByRowId = shallowRef(new Map<RowId, number>());
  watch(items, (newItems) => {
    const m = rowIndexByRowId.value;
    m.clear();
    newItems.forEach((item, idx) => m.set(getRowId(item), idx));
    triggerRef(rowIndexByRowId);
  }, { immediate: true });

  const rowSelectionResult = useRowSelection({
    items,
    getRowId,
    rowSelection: rowSelectionProp,
    controlledSelectedRows,
    onSelectionChange: props.value.onSelectionChange,
  });

  const { editingCell, setEditingCell, pendingEditorValue, setPendingEditorValue } = useCellEditing();
  const { activeCell, setActiveCell } = useActiveCell(wrapperRef, editingCell);

  const rowCount = computed(() => items.value.length);
  const visColCount = computed(() => visibleCols.value.length);

  const {
    selectionRange,
    setSelectionRange,
    handleCellMouseDown: handleCellMouseDownBase,
    handleSelectAllCells,
    isDragging,
  } = useCellSelection({
    colOffset,
    rowCount,
    visibleColCount: visColCount,
    setActiveCell,
    wrapperRef,
  });

  const { contextMenuPosition, setContextMenuPosition, handleCellContextMenu, closeContextMenu } = useContextMenu();

  const { handleCopy, handleCut, handlePaste, cutRange, copyRange, clearClipboardRanges } = useClipboard({
    items,
    visibleCols,
    colOffset,
    selectionRange,
    activeCell,
    editable: editableProp,
    onCellValueChanged,
    beginBatch: undoRedo.beginBatch,
    endBatch: undoRedo.endBatch,
  });

  const handleCellMouseDown = (e: MouseEvent, rowIndex: number, globalColIndex: number) => {
    if (e.button !== 0) return;
    wrapperRef.value?.focus({ preventScroll: true });
    clearClipboardRanges();
    handleCellMouseDownBase(e, rowIndex, globalColIndex);
  };

  const { handleGridKeyDown } = useKeyboardNavigation({
    data: { items, visibleCols, colOffset, hasCheckboxCol, visibleColumnCount, getRowId },
    state: { activeCell, selectionRange, editingCell, selectedRowIds: rowSelectionResult.selectedRowIds },
    handlers: {
      setActiveCell, setSelectionRange, setEditingCell,
      handleRowCheckboxChange: rowSelectionResult.handleRowCheckboxChange,
      handleCopy, handleCut, handlePaste,
      setContextMenu: setContextMenuPosition,
      onUndo: undoRedo.undo,
      onRedo: undoRedo.redo,
      clearClipboardRanges,
    },
    features: {
      editable: editableProp,
      onCellValueChanged,
      rowSelection: rowSelectionProp,
      wrapperRef,
    },
  });

  const { handleFillHandleMouseDown } = useFillHandle({
    items,
    visibleCols,
    editable: editableProp,
    onCellValueChanged,
    selectionRange,
    setSelectionRange,
    setActiveCell,
    colOffset,
    wrapperRef,
    beginBatch: undoRedo.beginBatch,
    endBatch: undoRedo.endBatch,
  });

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
    initialColumnWidths: props.value.initialColumnWidths,
    onColumnResized: (columnId: string, width: number) => props.value.onColumnResized?.(columnId, width),
  });

  // --- Column pinning ---
  const pinningResult = useColumnPinning({
    columns: flatColumns,
    pinnedColumns: pinnedColumnsProp,
    onColumnPinned: props.value.onColumnPinned,
  });

  // Autosize callback — updates internal column sizing state + notifies external listener
  const handleAutosizeColumn = (columnId: string, width: number) => {
    setColumnSizingOverrides({ ...columnSizingOverrides.value, [columnId]: { widthPx: width } });
    props.value.onColumnResized?.(columnId, width);
  };

  const headerMenuResult = useColumnHeaderMenuState({
    columns: flatColumns,
    pinnedColumns: pinningResult.pinnedColumns,
    onPinColumn: pinningResult.pinColumn,
    onUnpinColumn: pinningResult.unpinColumn,
    onSort: props.value.onColumnSort,
    onColumnResized: props.value.onColumnResized,
    onAutosizeColumn: handleAutosizeColumn,
    sortBy: computed(() => props.value.sortBy),
    sortDirection: computed(() => props.value.sortDirection),
  });

  // Measure actual column widths from the DOM after layout changes.
  // Used as a minWidth floor to prevent columns from shrinking when new data
  // loads (e.g. during server-side pagination transitions).
  // nextTick() defers measurement to after Vue has flushed its DOM updates,
  // ensuring header cells reflect the latest column layout before we read widths.
  const measuredColumnWidths = ref<Record<string, number>>({});

  watch(
    [visibleCols, containerWidth, columnSizingOverrides],
    () => {
      void nextTick(() => {
        const wrapper = wrapperRef.value;
        if (!wrapper) return;
        const headerCells = wrapper.querySelectorAll<HTMLElement>('th[data-column-id]');
        if (headerCells.length === 0) return;
        const measured: Record<string, number> = {};
        headerCells.forEach((cell) => {
          const colId = cell.getAttribute('data-column-id');
          if (colId) measured[colId] = cell.offsetWidth;
        });
        // Only update if widths actually changed to avoid reactive loops
        const prev = measuredColumnWidths.value;
        const keys = Object.keys(measured);
        let changed = keys.length !== Object.keys(prev).length;
        if (!changed) {
          for (const key of keys) {
            if (prev[key] !== measured[key]) { changed = true; break; }
          }
        }
        if (changed) measuredColumnWidths.value = measured;
      });
    },
    { flush: 'post' }
  );

  // Build column width map for pinning offset computation
  const columnWidthMap = computed(() => {
    const map: Record<string, number> = {};
    for (const col of visibleCols.value) {
      const override = columnSizingOverrides.value[col.columnId];
      map[col.columnId] = override
        ? override.widthPx
        : (col.idealWidth ?? col.defaultWidth ?? col.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH);
    }
    return map;
  });

  const leftOffsets = computed(() =>
    pinningResult.computeLeftOffsets(visibleCols.value, columnWidthMap.value, DEFAULT_MIN_COLUMN_WIDTH, hasCheckboxCol.value, CHECKBOX_COLUMN_WIDTH)
  );

  const rightOffsets = computed(() =>
    pinningResult.computeRightOffsets(visibleCols.value, columnWidthMap.value, DEFAULT_MIN_COLUMN_WIDTH)
  );

  const aggregation = computed(() =>
    computeAggregations(items.value, visibleCols.value, cellSelection.value ? selectionRange.value : null)
  );

  const statusBarConfig = computed(() => {
    const base = getDataGridStatusBarConfig(
      props.value.statusBar as boolean | IStatusBarProps | undefined,
      items.value.length,
      rowSelectionResult.selectedRowIds.value.size
    );
    if (!base) return null;
    return { ...base, aggregation: aggregation.value ?? undefined };
  });

  const showEmptyInGrid = computed(() => items.value.length === 0 && !!props.value.emptyState && !props.value.isLoading);
  const hasCellSelection = computed(() => selectionRange.value != null || activeCell.value != null);

  // --- View-model inputs ---
  const headerFilterInput = computed<HeaderFilterConfigInput>(() => ({
    sortBy: props.value.sortBy,
    sortDirection: props.value.sortDirection,
    onColumnSort: props.value.onColumnSort,
    filters: props.value.filters,
    onFilterChange: props.value.onFilterChange,
    filterOptions: props.value.filterOptions,
    loadingFilterOptions: props.value.loadingFilterOptions,
    peopleSearch: props.value.peopleSearch,
  }));

  const cellDescriptorInput = computed<CellRenderDescriptorInput<T>>(() => ({
    editingCell: editingCell.value,
    activeCell: cellSelection.value ? activeCell.value : null,
    selectionRange: cellSelection.value ? selectionRange.value : null,
    cutRange: cellSelection.value ? cutRange.value : null,
    copyRange: cellSelection.value ? copyRange.value : null,
    colOffset: colOffset.value,
    itemsLength: items.value.length,
    getRowId,
    editable: editableProp.value,
    onCellValueChanged: onCellValueChanged.value,
    isDragging: cellSelection.value ? isDragging.value : false,
  }));

  // --- Cell edit helpers ---
  const popoverAnchorEl = ref<HTMLElement | null>(null);

  const setPopoverAnchorEl = (el: HTMLElement | null) => {
    popoverAnchorEl.value = el;
  };

  const commitCellEdit = (
    item: T,
    columnId: string,
    oldValue: unknown,
    newValue: unknown,
    rowIndex: number,
    globalColIndex: number
  ) => {
    const col = visibleCols.value.find((c) => c.columnId === columnId);
    if (col) {
      const result = parseValue(newValue, oldValue, item, col);
      if (!result.valid) {
        setEditingCell(null);
        setPopoverAnchorEl(null);
        setPendingEditorValue(undefined);
        return;
      }
      newValue = result.value;
    }

    onCellValueChanged.value?.({
      item,
      columnId,
      oldValue,
      newValue,
      rowIndex,
    });
    setEditingCell(null);
    setPopoverAnchorEl(null);
    setPendingEditorValue(undefined);
    if (rowIndex < items.value.length - 1) {
      const newRow = rowIndex + 1;
      const localCol = globalColIndex - colOffset.value;
      setActiveCell({ rowIndex: newRow, columnIndex: globalColIndex });
      setSelectionRange({ startRow: newRow, startCol: localCol, endRow: newRow, endCol: localCol });
    }
  };

  const cancelPopoverEdit = () => {
    setEditingCell(null);
    setPopoverAnchorEl(null);
    setPendingEditorValue(undefined);
  };

  // --- Memoize each sub-object ---

  const layoutState = computed<DataGridLayoutState<T>>(() => ({
    flatColumns: flatColumns.value,
    visibleCols: visibleCols.value,
    visibleColumnCount: visibleColumnCount.value,
    totalColCount: totalColCount.value,
    colOffset: colOffset.value,
    hasCheckboxCol: hasCheckboxCol.value,
    hasRowNumbersCol: hasRowNumbersCol.value,
    rowIndexByRowId: rowIndexByRowId.value,
    containerWidth: containerWidth.value,
    minTableWidth: minTableWidth.value,
    desiredTableWidth: desiredTableWidth.value,
    columnSizingOverrides: columnSizingOverrides.value,
    setColumnSizingOverrides,
    onColumnResized: props.value.onColumnResized,
    measuredColumnWidths: measuredColumnWidths.value,
    stickyHeader: props.value.stickyHeader ?? true,
  }));

  const rowSelectionState = computed<DataGridRowSelectionState>(() => ({
    selectedRowIds: rowSelectionResult.selectedRowIds.value,
    updateSelection: rowSelectionResult.updateSelection,
    handleRowCheckboxChange: rowSelectionResult.handleRowCheckboxChange,
    handleSelectAll: rowSelectionResult.handleSelectAll,
    allSelected: rowSelectionResult.allSelected.value,
    someSelected: rowSelectionResult.someSelected.value,
  }));

  const editingState = computed<DataGridEditingState<T>>(() => ({
    editingCell: editingCell.value,
    setEditingCell,
    pendingEditorValue: pendingEditorValue.value,
    setPendingEditorValue,
    commitCellEdit,
    cancelPopoverEdit,
    popoverAnchorEl: popoverAnchorEl.value,
    setPopoverAnchorEl,
  }));

  const interactionState = computed<DataGridCellInteractionState>(() => ({
    activeCell: cellSelection.value ? activeCell.value : null,
    setActiveCell: cellSelection.value ? setActiveCell : (NOOP as typeof setActiveCell),
    selectionRange: cellSelection.value ? selectionRange.value : null,
    setSelectionRange: cellSelection.value ? setSelectionRange : (NOOP as typeof setSelectionRange),
    handleCellMouseDown: cellSelection.value ? handleCellMouseDown : (NOOP_MOUSE as typeof handleCellMouseDown),
    handleSelectAllCells: cellSelection.value ? handleSelectAllCells : NOOP,
    hasCellSelection: cellSelection.value ? hasCellSelection.value : false,
    handleGridKeyDown: cellSelection.value ? handleGridKeyDown : (NOOP_KEY as typeof handleGridKeyDown),
    handleFillHandleMouseDown: cellSelection.value ? handleFillHandleMouseDown : (NOOP as typeof handleFillHandleMouseDown),
    handleCopy: cellSelection.value ? handleCopy : NOOP,
    handleCut: cellSelection.value ? handleCut : NOOP,
    handlePaste: cellSelection.value ? handlePaste : (NOOP_ASYNC as typeof handlePaste),
    cutRange: cellSelection.value ? cutRange.value : null,
    copyRange: cellSelection.value ? copyRange.value : null,
    clearClipboardRanges: cellSelection.value ? clearClipboardRanges : NOOP,
    canUndo: undoRedo.canUndo.value,
    canRedo: undoRedo.canRedo.value,
    onUndo: undoRedo.undo,
    onRedo: undoRedo.redo,
    isDragging: cellSelection.value ? isDragging.value : false,
  }));

  const contextMenuState = computed<DataGridContextMenuState>(() => ({
    menuPosition: cellSelection.value ? contextMenuPosition.value : null,
    setMenuPosition: cellSelection.value ? setContextMenuPosition : (NOOP as typeof setContextMenuPosition),
    handleCellContextMenu: cellSelection.value ? handleCellContextMenu : (NOOP_CTX as typeof handleCellContextMenu),
    closeContextMenu: cellSelection.value ? closeContextMenu : NOOP,
  }));

  const viewModelsState = computed<DataGridViewModelState<T>>(() => ({
    headerFilterInput: headerFilterInput.value,
    cellDescriptorInput: cellDescriptorInput.value,
    statusBarConfig: statusBarConfig.value,
    showEmptyInGrid: showEmptyInGrid.value,
    onCellError: props.value.onCellError,
  }));

  const pinningState = computed<DataGridPinningState>(() => ({
    pinnedColumns: pinningResult.pinnedColumns.value,
    pinColumn: pinningResult.pinColumn,
    unpinColumn: pinningResult.unpinColumn,
    isPinned: pinningResult.isPinned,
    leftOffsets: leftOffsets.value,
    rightOffsets: rightOffsets.value,
    headerMenu: {
      isOpen: headerMenuResult.isOpen.value,
      openForColumn: headerMenuResult.openForColumn.value,
      anchorElement: headerMenuResult.anchorElement.value,
      open: headerMenuResult.open,
      close: headerMenuResult.close,
      handlePinLeft: headerMenuResult.handlePinLeft,
      handlePinRight: headerMenuResult.handlePinRight,
      handleUnpin: headerMenuResult.handleUnpin,
      handleSortAsc: headerMenuResult.handleSortAsc,
      handleSortDesc: headerMenuResult.handleSortDesc,
      handleClearSort: headerMenuResult.handleClearSort,
      handleAutosizeThis: headerMenuResult.handleAutosizeThis,
      handleAutosizeAll: headerMenuResult.handleAutosizeAll,
      canPinLeft: headerMenuResult.canPinLeft.value,
      canPinRight: headerMenuResult.canPinRight.value,
      canUnpin: headerMenuResult.canUnpin.value,
      currentSort: headerMenuResult.currentSort.value,
      isSortable: headerMenuResult.isSortable.value,
      isResizable: headerMenuResult.isResizable.value,
    },
  }));

  return {
    layout: layoutState,
    rowSelection: rowSelectionState,
    editing: editingState,
    interaction: interactionState,
    contextMenu: contextMenuState,
    viewModels: viewModelsState,
    pinning: pinningState,
  };
}
