import type { RefObject } from 'react';
import type { DelegatedCellHandlers } from '../utils';
import type { IOGridDataGridProps, IColumnDef } from '../types';
import type {
  DataGridLayoutState,
  DataGridRowSelectionState,
  DataGridEditingState,
  DataGridCellInteractionState,
  DataGridContextMenuState,
  DataGridViewModelState,
  DataGridPinningState,
} from './useDataGridState';
import type { DataGridFindReplaceState } from './useDataGridFindReplace';
import type { UseColumnResizeResult } from './useColumnResize';
import type { UseColumnReorderResult } from './useColumnReorder';
import type { UseVirtualScrollResult } from './useVirtualScroll';
import type { IVisibleColumnRange, FormulaReference, CellDescriptorCache } from '@alaarab/ogrid-core';
import type { HeaderFilterConfigInput, CellRenderDescriptorInput } from '../utils';
import type { IStatusBarProps, RowId, HeaderRow } from '../types';

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

  // State sub-objects (for framework-specific access)
  layout: DataGridLayoutState<T>;
  rowSel: DataGridRowSelectionState;
  editing: DataGridEditingState<T>;
  interaction: DataGridCellInteractionState;
  ctxMenu: DataGridContextMenuState;
  viewModels: DataGridViewModelState<T>;
  pinning: DataGridPinningState;

  // Column resize
  handleResizeStart: UseColumnResizeResult<T>['handleResizeStart'];
  handleResizeDoubleClick: UseColumnResizeResult<T>['handleResizeDoubleClick'];
  handleResizeFocus: UseColumnResizeResult<T>['handleResizeFocus'];
  handleResizeKeyDown: UseColumnResizeResult<T>['handleResizeKeyDown'];
  getColumnWidth: UseColumnResizeResult<T>['getColumnWidth'];
  getColumnMinWidth: UseColumnResizeResult<T>['getColumnMinWidth'];

  // Column reorder
  isReorderDragging: UseColumnReorderResult['isDragging'];
  dropIndicatorX: UseColumnReorderResult['dropIndicatorX'];
  handleHeaderMouseDown: UseColumnReorderResult['handleHeaderMouseDown'];

  // Virtual scroll
  virtualScrollEnabled: boolean;
  virtualRowHeight: number;
  visibleRange: UseVirtualScrollResult['visibleRange'];
  /** Visible column range for horizontal virtualization (null when disabled). */
  columnRange: IVisibleColumnRange | null;
  /** Callback for horizontal scroll events (column virtualization). */
  onHorizontalScroll?: (scrollLeft: number) => void;

  // Derived from props
  items: T[];
  /** Windowed (lazy) row access, or null/undefined for an in-memory dataset. */
  windowed: IOGridDataGridProps<T>['windowed'];
  columns: IOGridDataGridProps<T>['columns'];
  getRowId: IOGridDataGridProps<T>['getRowId'];
  emptyState: IOGridDataGridProps<T>['emptyState'];
  layoutMode: 'fill' | 'content';
  rowSelection: IOGridDataGridProps<T>['rowSelection'];
  suppressHorizontalScroll: IOGridDataGridProps<T>['suppressHorizontalScroll'];
  stickyHeader: boolean;
  isLoading: boolean;
  loadingMessage: string;
  ariaLabel: string | undefined;
  ariaLabelledBy: string | undefined;
  visibleColumns: IOGridDataGridProps<T>['visibleColumns'];
  columnOrder: IOGridDataGridProps<T>['columnOrder'];
  columnReorder: IOGridDataGridProps<T>['columnReorder'];
  density: 'compact' | 'normal' | 'comfortable';
  rowHeight: number | undefined;
  pinnedColumns: IOGridDataGridProps<T>['pinnedColumns'];
  currentPage: number;
  propPageSize: IOGridDataGridProps<T>['pageSize'];

  // Computed values
  rowNumberOffset: number;
  headerRows: HeaderRow<T>[];
  allowOverflowX: boolean;
  fitToContent: boolean;
  showColumnLetters: boolean;
  showNameBox: boolean;
  /** Header letter per visible column: the letter of its formula (flat) column. */
  columnLetters: string[];
  /** Pointer down on a column letter header: select the whole column (Shift/drag extend). */
  handleColumnHeaderPointerDown: (e: React.PointerEvent, dataColIndex: number) => void;
  /** Pointer down on a row number cell: select the whole row (Shift/drag extend). */
  handleRowHeaderPointerDown: (e: React.PointerEvent, rowIndex: number) => void;
  /** Row-number label per displayed row (its sheet row), when the grid maps rows to sheet rows. */
  rowNumberOf?: (rowIndex: number) => number;
  /** `formulaReferences` translated to visible columns and displayed rows, for the overlay. */
  formulaReferences?: FormulaReference[];

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
    handleLongPressStart: DataGridContextMenuState['handleLongPressStart'];
    handleLongPressEnd: DataGridContextMenuState['handleLongPressEnd'];
  };

  /** Stable delegated handlers for cell interaction (zero per-cell closures). */
  delegatedCellHandlers: DelegatedCellHandlers;

  // Stable refs for volatile state (used in renderCellContent)
  cellDescriptorInputRef: React.MutableRefObject<CellRenderDescriptorInput<T>>;
  /** Per-grid descriptor cache. Eliminates redundant getCellRenderDescriptor allocations for unchanged cells. */
  cellDescriptorCacheRef: React.MutableRefObject<CellDescriptorCache>;
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
  measuredColumnWidths: Record<string, number>;

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
  /** Find & Replace panel state and the Ctrl+F / Ctrl+H handler. */
  findReplace: DataGridFindReplaceState;
}
