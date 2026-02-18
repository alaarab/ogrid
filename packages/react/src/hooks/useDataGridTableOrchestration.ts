import { useCallback, useRef, useMemo } from 'react';
import type { RefObject } from 'react';
import type { IOGridDataGridProps, IColumnDef } from '../types';
import type {
  UseDataGridStateResult,
  DataGridLayoutState,
  DataGridRowSelectionState,
  DataGridEditingState,
  DataGridCellInteractionState,
  DataGridContextMenuState,
  DataGridViewModelState,
  DataGridPinningState,
} from './useDataGridState';
import type { UseColumnResizeResult } from './useColumnResize';
import type { UseColumnReorderResult } from './useColumnReorder';
import type { UseVirtualScrollResult } from './useVirtualScroll';
import type { HeaderFilterConfigInput, CellRenderDescriptorInput } from '../utils';
import type { IStatusBarProps, RowId, HeaderRow } from '../types';
import { useDataGridState } from './useDataGridState';
import { useColumnResize } from './useColumnResize';
import { useColumnReorder } from './useColumnReorder';
import { useVirtualScroll } from './useVirtualScroll';
import { useLatestRef } from './useLatestRef';
import { buildHeaderRows } from '../utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Parameters for the orchestration hook. */
export interface UseDataGridTableOrchestrationParams<T> {
  props: IOGridDataGridProps<T>;
}

/** Everything the framework-specific view layer needs to render. */
export interface UseDataGridTableOrchestrationResult<T> {
  // Refs
  wrapperRef: RefObject<HTMLDivElement | null>;
  tableContainerRef: RefObject<HTMLDivElement | null>;
  lastMouseShiftRef: React.MutableRefObject<boolean>;

  // Full state sub-objects (for framework-specific access)
  state: UseDataGridStateResult<T>;
  layout: DataGridLayoutState<T>;
  rowSel: DataGridRowSelectionState;
  editing: DataGridEditingState<T>;
  interaction: DataGridCellInteractionState;
  ctxMenu: DataGridContextMenuState;
  viewModels: DataGridViewModelState<T>;
  pinning: DataGridPinningState;

  // Column resize
  handleResizeStart: UseColumnResizeResult<T>['handleResizeStart'];
  getColumnWidth: UseColumnResizeResult<T>['getColumnWidth'];

  // Column reorder
  isReorderDragging: UseColumnReorderResult['isDragging'];
  dropIndicatorX: UseColumnReorderResult['dropIndicatorX'];
  handleHeaderMouseDown: UseColumnReorderResult['handleHeaderMouseDown'];

  // Virtual scroll
  virtualScrollEnabled: boolean;
  virtualRowHeight: number;
  visibleRange: UseVirtualScrollResult['visibleRange'];

  // Derived from props
  items: T[];
  columns: IOGridDataGridProps<T>['columns'];
  getRowId: IOGridDataGridProps<T>['getRowId'];
  emptyState: IOGridDataGridProps<T>['emptyState'];
  layoutMode: 'fill' | 'content';
  rowSelection: IOGridDataGridProps<T>['rowSelection'];
  freezeRows: IOGridDataGridProps<T>['freezeRows'];
  freezeCols: IOGridDataGridProps<T>['freezeCols'];
  suppressHorizontalScroll: IOGridDataGridProps<T>['suppressHorizontalScroll'];
  isLoading: boolean;
  loadingMessage: string;
  ariaLabel: string | undefined;
  ariaLabelledBy: string | undefined;
  visibleColumns: IOGridDataGridProps<T>['visibleColumns'];
  columnOrder: IOGridDataGridProps<T>['columnOrder'];
  columnReorder: IOGridDataGridProps<T>['columnReorder'];
  density: 'compact' | 'normal' | 'comfortable';
  pinnedColumns: IOGridDataGridProps<T>['pinnedColumns'];
  currentPage: number;
  propPageSize: number;

  // Computed values
  rowNumberOffset: number;
  headerRows: HeaderRow<T>[];
  allowOverflowX: boolean;
  fitToContent: boolean;

  // Memoized callback groups (for renderCellContent)
  editCallbacks: {
    commitCellEdit: DataGridEditingState<T>['commitCellEdit'];
    setEditingCell: DataGridEditingState<T>['setEditingCell'];
    setPendingEditorValue: DataGridEditingState<T>['setPendingEditorValue'];
    cancelPopoverEdit: DataGridEditingState<T>['cancelPopoverEdit'];
  };
  interactionHandlers: {
    handleCellMouseDown: DataGridCellInteractionState['handleCellMouseDown'];
    setActiveCell: DataGridCellInteractionState['setActiveCell'];
    setEditingCell: DataGridEditingState<T>['setEditingCell'];
    handleCellContextMenu: DataGridContextMenuState['handleCellContextMenu'];
  };

  // Stable refs for volatile state (used in renderCellContent)
  cellDescriptorInputRef: React.MutableRefObject<CellRenderDescriptorInput<T>>;
  pendingEditorValueRef: React.MutableRefObject<unknown>;
  popoverAnchorElRef: React.MutableRefObject<HTMLElement | null>;
  selectedRowIdsRef: React.MutableRefObject<Set<RowId>>;

  // Convenience handlers
  handleSingleRowClick: (e: React.MouseEvent<HTMLTableRowElement>) => void;
  handlePasteVoid: () => void;

  // Layout-derived references
  visibleCols: IColumnDef<T>[];
  totalColCount: number;
  hasCheckboxCol: boolean;
  hasRowNumbersCol: boolean;
  colOffset: number;
  containerWidth: number;
  minTableWidth: number;
  desiredTableWidth: number;
  columnSizingOverrides: Record<string, { widthPx: number }>;
  setColumnSizingOverrides: React.Dispatch<React.SetStateAction<Record<string, { widthPx: number }>>>;

  // Row selection shortcuts
  selectedRowIds: Set<RowId>;
  updateSelection: DataGridRowSelectionState['updateSelection'];
  handleRowCheckboxChange: DataGridRowSelectionState['handleRowCheckboxChange'];
  handleSelectAll: DataGridRowSelectionState['handleSelectAll'];
  allSelected: boolean;
  someSelected: boolean;

  // Editing shortcuts
  editingCell: DataGridEditingState<T>['editingCell'];
  setPopoverAnchorEl: DataGridEditingState<T>['setPopoverAnchorEl'];
  cancelPopoverEdit: DataGridEditingState<T>['cancelPopoverEdit'];

  // Interaction shortcuts
  setActiveCell: DataGridCellInteractionState['setActiveCell'];
  selectionRange: DataGridCellInteractionState['selectionRange'];
  hasCellSelection: boolean;
  handleGridKeyDown: DataGridCellInteractionState['handleGridKeyDown'];
  handleFillHandleMouseDown: DataGridCellInteractionState['handleFillHandleMouseDown'];
  handleCopy: DataGridCellInteractionState['handleCopy'];
  handleCut: DataGridCellInteractionState['handleCut'];
  cutRange: DataGridCellInteractionState['cutRange'];
  copyRange: DataGridCellInteractionState['copyRange'];
  canUndo: boolean;
  canRedo: boolean;
  onUndo: DataGridCellInteractionState['onUndo'];
  onRedo: DataGridCellInteractionState['onRedo'];
  isDragging: boolean;

  // Context menu shortcuts
  menuPosition: DataGridContextMenuState['menuPosition'];
  handleCellContextMenu: DataGridContextMenuState['handleCellContextMenu'];
  closeContextMenu: DataGridContextMenuState['closeContextMenu'];

  // ViewModel shortcuts
  headerFilterInput: HeaderFilterConfigInput;
  cellDescriptorInput: CellRenderDescriptorInput<T>;
  statusBarConfig: IStatusBarProps | null;
  showEmptyInGrid: boolean;
  onCellError: DataGridViewModelState<T>['onCellError'];

  // Pinning shortcuts
  headerMenu: DataGridPinningState['headerMenu'];
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Shared orchestration hook for DataGridTable.
 *
 * Encapsulates all state management and computation that is identical across
 * Radix, Fluent, and Material DataGridTable implementations. Each UI package
 * calls this hook, then renders its own framework-specific JSX using the
 * returned values.
 */
export function useDataGridTableOrchestration<T>(
  params: UseDataGridTableOrchestrationParams<T>,
): UseDataGridTableOrchestrationResult<T> {
  const { props } = params;

  // ── Refs ────────────────────────────────────────────────────────────────
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const lastMouseShiftRef = useRef(false);

  // ── Core state ──────────────────────────────────────────────────────────
  const state = useDataGridState({ props, wrapperRef });

  const { layout, rowSelection: rowSel, editing, interaction, contextMenu: ctxMenu, viewModels, pinning } = state;
  const {
    visibleCols: visibleColsTyped, totalColCount, hasCheckboxCol, hasRowNumbersCol, colOffset,
    containerWidth, minTableWidth, desiredTableWidth,
    columnSizingOverrides, setColumnSizingOverrides,
  } = layout;
  const visibleCols = visibleColsTyped as IColumnDef<T>[];

  const { selectedRowIds, updateSelection, handleRowCheckboxChange, handleSelectAll, allSelected, someSelected } = rowSel;
  const { editingCell, setEditingCell, pendingEditorValue, setPendingEditorValue, commitCellEdit, cancelPopoverEdit, popoverAnchorEl, setPopoverAnchorEl } = editing;
  const { setActiveCell, handleCellMouseDown, selectionRange, hasCellSelection, handleGridKeyDown, handleFillHandleMouseDown, handleCopy, handleCut, handlePaste, cutRange, copyRange, canUndo, canRedo, onUndo, onRedo, isDragging } = interaction;
  const { menuPosition, handleCellContextMenu, closeContextMenu } = ctxMenu;
  const { headerFilterInput, cellDescriptorInput, statusBarConfig, showEmptyInGrid, onCellError } = viewModels;
  const { headerMenu } = pinning;

  const handlePasteVoid = useCallback(() => { void handlePaste(); }, [handlePaste]);

  // ── Props destructuring ─────────────────────────────────────────────────
  const {
    items,
    columns,
    getRowId,
    emptyState,
    layoutMode = 'fill',
    rowSelection = 'none',
    freezeRows,
    freezeCols,
    suppressHorizontalScroll,
    isLoading = false,
    loadingMessage = 'Loading\u2026',
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    visibleColumns,
    columnOrder,
    onColumnOrderChange,
    columnReorder,
    virtualScroll,
    density = 'normal',
    pinnedColumns,
    currentPage = 1,
    pageSize: propPageSize = 25,
  } = props;

  // ── Derived values ──────────────────────────────────────────────────────
  const rowNumberOffset = hasRowNumbersCol ? (currentPage - 1) * propPageSize : 0;
  const headerRows = useMemo(() => buildHeaderRows(columns, visibleColumns), [columns, visibleColumns]);
  const allowOverflowX = !suppressHorizontalScroll && containerWidth > 0 && (minTableWidth > containerWidth || desiredTableWidth > containerWidth);
  const fitToContent = layoutMode === 'content';

  // ── Column resize ──────────────────────────────────────────────────────
  const { handleResizeStart, getColumnWidth } = useColumnResize<T>({
    columnSizingOverrides,
    setColumnSizingOverrides,
  });

  // ── Column reorder ─────────────────────────────────────────────────────
  const { isDragging: isReorderDragging, dropIndicatorX, handleHeaderMouseDown } = useColumnReorder<T>({
    columns: visibleCols,
    columnOrder,
    onColumnOrderChange,
    enabled: columnReorder === true,
    pinnedColumns,
    wrapperRef,
  });

  // ── Virtual scroll ─────────────────────────────────────────────────────
  const virtualScrollEnabled = virtualScroll?.enabled === true;
  const virtualRowHeight = virtualScroll?.rowHeight ?? 36;
  const { visibleRange } = useVirtualScroll({
    totalRows: items.length,
    rowHeight: virtualRowHeight,
    enabled: virtualScrollEnabled,
    overscan: virtualScroll?.overscan,
    containerRef: wrapperRef,
  });

  // ── Memoized callback groups ───────────────────────────────────────────
  const editCallbacks = useMemo(
    () => ({ commitCellEdit, setEditingCell, setPendingEditorValue, cancelPopoverEdit }),
    [commitCellEdit, setEditingCell, setPendingEditorValue, cancelPopoverEdit],
  );
  const interactionHandlers = useMemo(
    () => ({ handleCellMouseDown, setActiveCell, setEditingCell, handleCellContextMenu }),
    [handleCellMouseDown, setActiveCell, setEditingCell, handleCellContextMenu],
  );

  // ── Stable refs for volatile state ─────────────────────────────────────
  const cellDescriptorInputRef = useLatestRef(cellDescriptorInput);
  const pendingEditorValueRef = useLatestRef(pendingEditorValue);
  const popoverAnchorElRef = useLatestRef(popoverAnchorEl);
  const selectedRowIdsRef = useLatestRef(selectedRowIds);

  // ── Stable row-click handler ───────────────────────────────────────────
  const handleSingleRowClick = useCallback((e: React.MouseEvent<HTMLTableRowElement>) => {
    if (rowSelection !== 'single') return;
    const rowId = e.currentTarget.dataset.rowId;
    if (!rowId) return;
    const ids = selectedRowIdsRef.current;
    updateSelection(ids.has(rowId) ? new Set() : new Set([rowId]));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- selectedRowIdsRef is a stable ref
  }, [rowSelection, updateSelection]);

  // ── Return ─────────────────────────────────────────────────────────────
  return {
    // Refs
    wrapperRef,
    tableContainerRef,
    lastMouseShiftRef,

    // Full state sub-objects
    state,
    layout,
    rowSel,
    editing,
    interaction,
    ctxMenu,
    viewModels,
    pinning,

    // Column resize
    handleResizeStart,
    getColumnWidth,

    // Column reorder
    isReorderDragging,
    dropIndicatorX,
    handleHeaderMouseDown,

    // Virtual scroll
    virtualScrollEnabled,
    virtualRowHeight,
    visibleRange,

    // Derived from props
    items,
    columns,
    getRowId,
    emptyState,
    layoutMode,
    rowSelection,
    freezeRows,
    freezeCols,
    suppressHorizontalScroll,
    isLoading,
    loadingMessage,
    ariaLabel,
    ariaLabelledBy,
    visibleColumns,
    columnOrder,
    columnReorder,
    density,
    pinnedColumns,
    currentPage,
    propPageSize,

    // Computed values
    rowNumberOffset,
    headerRows,
    allowOverflowX,
    fitToContent,

    // Memoized callback groups
    editCallbacks,
    interactionHandlers,

    // Stable refs for volatile state
    cellDescriptorInputRef,
    pendingEditorValueRef,
    popoverAnchorElRef,
    selectedRowIdsRef,

    // Convenience handlers
    handleSingleRowClick,
    handlePasteVoid,

    // Layout-derived references
    visibleCols,
    totalColCount,
    hasCheckboxCol,
    hasRowNumbersCol,
    colOffset,
    containerWidth,
    minTableWidth,
    desiredTableWidth,
    columnSizingOverrides,
    setColumnSizingOverrides,

    // Row selection shortcuts
    selectedRowIds,
    updateSelection,
    handleRowCheckboxChange,
    handleSelectAll,
    allSelected,
    someSelected,

    // Editing shortcuts
    editingCell,
    setPopoverAnchorEl,
    cancelPopoverEdit,

    // Interaction shortcuts
    setActiveCell,
    selectionRange,
    hasCellSelection,
    handleGridKeyDown,
    handleFillHandleMouseDown,
    handleCopy,
    handleCut,
    cutRange,
    copyRange,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    isDragging,

    // Context menu shortcuts
    menuPosition,
    handleCellContextMenu,
    closeContextMenu,

    // ViewModel shortcuts
    headerFilterInput,
    cellDescriptorInput,
    statusBarConfig,
    showEmptyInGrid,
    onCellError,

    // Pinning shortcuts
    headerMenu,
  };
}
