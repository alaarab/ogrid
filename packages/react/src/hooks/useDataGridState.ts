import { useMemo, useCallback, useState } from 'react';
import type { RefObject } from 'react';
import { flattenColumns, getDataGridStatusBarConfig, parseValue, computeAggregations } from '../utils';
import type { HeaderFilterConfigInput, CellRenderDescriptorInput } from '../utils';
import type { RowId, IOGridDataGridProps, IStatusBarProps, IColumnDef } from '../types';
import { useRowSelection } from './useRowSelection';
import { useCellEditing } from './useCellEditing';
import { useActiveCell } from './useActiveCell';
import { useCellSelection } from './useCellSelection';
import { useContextMenu } from './useContextMenu';
import { useClipboard } from './useClipboard';
import { useKeyboardNavigation } from './useKeyboardNavigation';
import { useFillHandle } from './useFillHandle';
import { useUndoRedo } from './useUndoRedo';
import { useLatestRef } from './useLatestRef';
import { useTableLayout } from './useTableLayout';

// Stable no-op handlers used when cellSelection is disabled (module-scope = no re-renders)
const NOOP = () => {};
const NOOP_ASYNC = async () => {};
const NOOP_MOUSE = (_e: React.MouseEvent, _r: number, _c: number) => {};
const NOOP_KEY = (_e: React.KeyboardEvent) => {};
const NOOP_CTX = (_e: { clientX: number; clientY: number; preventDefault?: () => void }) => {};

export interface UseDataGridStateParams<T> {
  props: IOGridDataGridProps<T>;
  wrapperRef: RefObject<HTMLDivElement | null>;
}

// --- Grouped sub-interfaces ---

/** Column layout, visibility, and sizing state. */
export interface DataGridLayoutState<T> {
  flatColumns: IColumnDef<T>[];
  visibleCols: IColumnDef<T>[];
  visibleColumnCount: number;
  totalColCount: number;
  colOffset: number;
  hasCheckboxCol: boolean;
  rowIndexByRowId: Map<RowId, number>;
  containerWidth: number;
  minTableWidth: number;
  desiredTableWidth: number;
  columnSizingOverrides: Record<string, { widthPx: number }>;
  setColumnSizingOverrides: React.Dispatch<
    React.SetStateAction<Record<string, { widthPx: number }>>
  >;
  onColumnResized?: (columnId: string, width: number) => void;
}

/** Row selection (checkboxes, single-row click). */
export interface DataGridRowSelectionState {
  selectedRowIds: Set<RowId>;
  updateSelection: (newSelectedIds: Set<RowId>) => void;
  handleRowCheckboxChange: (
    rowId: RowId,
    checked: boolean,
    rowIndex: number,
    shiftKey: boolean
  ) => void;
  handleSelectAll: (checked: boolean) => void;
  allSelected: boolean;
  someSelected: boolean;
}

/** Cell editing, popover editor, and commit/cancel helpers. */
export interface DataGridEditingState<T> {
  editingCell: { rowId: RowId; columnId: string } | null;
  setEditingCell: (cell: { rowId: RowId; columnId: string } | null) => void;
  pendingEditorValue: unknown;
  setPendingEditorValue: (value: unknown) => void;
  commitCellEdit: (
    item: T,
    columnId: string,
    oldValue: unknown,
    newValue: unknown,
    rowIndex: number,
    globalColIndex: number
  ) => void;
  cancelPopoverEdit: () => void;
  popoverAnchorEl: HTMLElement | null;
  setPopoverAnchorEl: React.Dispatch<React.SetStateAction<HTMLElement | null>>;
}

/** Cell selection, active cell, keyboard, clipboard, fill handle, undo/redo. */
export interface DataGridCellInteractionState {
  activeCell: { rowIndex: number; columnIndex: number } | null;
  setActiveCell: (cell: { rowIndex: number; columnIndex: number } | null) => void;
  selectionRange: {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  } | null;
  setSelectionRange: (range: DataGridCellInteractionState['selectionRange']) => void;
  handleCellMouseDown: (
    e: React.MouseEvent,
    rowIndex: number,
    globalColIndex: number
  ) => void;
  handleSelectAllCells: () => void;
  hasCellSelection: boolean;
  handleGridKeyDown: (e: React.KeyboardEvent) => void;
  handleFillHandleMouseDown: (e: React.MouseEvent) => void;
  handleCopy: () => void;
  handleCut: () => void;
  handlePaste: () => Promise<void>;
  cutRange: {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  } | null;
  copyRange: {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  } | null;
  clearClipboardRanges: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  /** True while user is drag-selecting cells (mousedown → mouseup). */
  isDragging: boolean;
}

/** Context menu position and handlers. */
export interface DataGridContextMenuState {
  menuPosition: { x: number; y: number } | null;
  setMenuPosition: (pos: { x: number; y: number } | null) => void;
  handleCellContextMenu: (e: { clientX: number; clientY: number; preventDefault?: () => void }) => void;
  closeContextMenu: () => void;
}

/** View model inputs and derived display state. */
export interface DataGridViewModelState<T> {
  headerFilterInput: HeaderFilterConfigInput;
  cellDescriptorInput: CellRenderDescriptorInput<T>;
  statusBarConfig: IStatusBarProps | null;
  showEmptyInGrid: boolean;
  onCellError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

/** Grouped result from useDataGridState. */
export interface UseDataGridStateResult<T> {
  layout: DataGridLayoutState<T>;
  rowSelection: DataGridRowSelectionState;
  editing: DataGridEditingState<T>;
  interaction: DataGridCellInteractionState;
  contextMenu: DataGridContextMenuState;
  viewModels: DataGridViewModelState<T>;
}

/**
 * Single orchestration hook for DataGridTable. Takes grid props and wrapper ref,
 * returns all derived state and handlers so Fluent/Material/Radix can be thin view layers.
 */
export function useDataGridState<T>(
  params: UseDataGridStateParams<T>
): UseDataGridStateResult<T> {
  const { props, wrapperRef } = params;
  const {
    items,
    columns,
    getRowId,
    visibleColumns,
    columnOrder,
    rowSelection = 'none',
    selectedRows: controlledSelectedRows,
    onSelectionChange,
    statusBar,
    emptyState,
    editable,
    cellSelection: cellSelectionProp,
    onCellValueChanged: onCellValueChangedProp,
    initialColumnWidths,
    onColumnResized,
    pinnedColumns,
    onCellError,
  } = props;

  const cellSelection = cellSelectionProp !== false;

  // Wrap onCellValueChanged with undo/redo tracking — all edits are recorded automatically
  const undoRedo = useUndoRedo<T>({ onCellValueChanged: onCellValueChangedProp });
  const onCellValueChanged = undoRedo.onCellValueChanged;

  // Cast is safe: input columns are React.IColumnDef instances; flattenColumns only extracts leaves.
  const flatColumnsRaw = useMemo(() => flattenColumns(columns) as IColumnDef<T>[], [columns]);

  // Apply runtime pin overrides (from applyColumnState or programmatic changes)
  const flatColumns = useMemo(() => {
    if (!pinnedColumns || Object.keys(pinnedColumns).length === 0) return flatColumnsRaw;
    return flatColumnsRaw.map((col) => {
      const override = pinnedColumns[col.columnId];
      if (override && col.pinned !== override) {
        return { ...col, pinned: override };
      }
      // If col was pinned by definition but not in overrides, keep original
      return col;
    });
  }, [flatColumnsRaw, pinnedColumns]);

  const visibleCols = useMemo(() => {
    const filtered = visibleColumns
      ? flatColumns.filter((c) => visibleColumns.has(c.columnId))
      : flatColumns;
    if (!columnOrder?.length) return filtered;
    return [...filtered].sort((a, b) => {
      const ia = columnOrder.indexOf(a.columnId);
      const ib = columnOrder.indexOf(b.columnId);
      if (ia === -1 && ib === -1) return 0;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }, [flatColumns, visibleColumns, columnOrder]);

  const visibleColumnCount = visibleCols.length;
  const hasCheckboxCol = rowSelection === 'multiple';
  const totalColCount = visibleColumnCount + (hasCheckboxCol ? 1 : 0);
  const colOffset = hasCheckboxCol ? 1 : 0;

  const rowIndexByRowId = useMemo(() => {
    const m = new Map<RowId, number>();
    items.forEach((item, idx) => m.set(getRowId(item), idx));
    return m;
  }, [items, getRowId]);

  const rowSelectionResult = useRowSelection({
    items,
    getRowId,
    rowSelection,
    controlledSelectedRows,
    onSelectionChange,
  });

  const {
    selectedRowIds,
    updateSelection,
    handleRowCheckboxChange,
    handleSelectAll,
    allSelected,
    someSelected,
  } = rowSelectionResult;

  const {
    editingCell,
    setEditingCell,
    pendingEditorValue,
    setPendingEditorValue,
  } = useCellEditing();

  const { activeCell, setActiveCell } = useActiveCell(wrapperRef, editingCell);

  const {
    selectionRange,
    setSelectionRange,
    handleCellMouseDown: handleCellMouseDownBase,
    handleSelectAllCells,
    isDragging,
  } = useCellSelection({
    colOffset,
    rowCount: items.length,
    visibleColCount: visibleCols.length,
    setActiveCell,
    wrapperRef,
  });

  const { contextMenuPosition, setContextMenuPosition, handleCellContextMenu, closeContextMenu } =
    useContextMenu();

  const { handleCopy, handleCut, handlePaste, cutRange, copyRange, clearClipboardRanges } = useClipboard({
    items,
    visibleCols,
    colOffset,
    selectionRange,
    activeCell,
    editable,
    onCellValueChanged,
    beginBatch: undoRedo.beginBatch,
    endBatch: undoRedo.endBatch,
  });

  const handleCellMouseDown = useCallback(
    (e: React.MouseEvent, rowIndex: number, globalColIndex: number) => {
      if (e.button !== 0) return;
      (wrapperRef as RefObject<HTMLDivElement | null>).current?.focus({ preventScroll: true });
      clearClipboardRanges();
      handleCellMouseDownBase(e, rowIndex, globalColIndex);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [handleCellMouseDownBase, clearClipboardRanges] // wrapperRef excluded — refs are stable
  );

  const { handleGridKeyDown } = useKeyboardNavigation({
    data: { items, visibleCols, colOffset, hasCheckboxCol, visibleColumnCount, getRowId },
    state: { activeCell, selectionRange, editingCell, selectedRowIds },
    handlers: { setActiveCell, setSelectionRange, setEditingCell, handleRowCheckboxChange, handleCopy, handleCut, handlePaste, setContextMenu: setContextMenuPosition, onUndo: undoRedo.undo, onRedo: undoRedo.redo, clearClipboardRanges },
    features: { editable, onCellValueChanged, rowSelection, wrapperRef },
  });

  const { handleFillHandleMouseDown } = useFillHandle({
    items,
    visibleCols,
    editable,
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
    initialColumnWidths,
    onColumnResized,
  });

  const aggregation = useMemo(
    () => computeAggregations(items, visibleCols, cellSelection ? selectionRange : null),
    [items, visibleCols, selectionRange, cellSelection]
  );

  const statusBarConfig = useMemo(
    () => {
      const base = getDataGridStatusBarConfig(
        statusBar as boolean | IStatusBarProps | undefined,
        items.length,
        selectedRowIds.size
      );
      if (!base) return null;
      return { ...base, aggregation: aggregation ?? undefined };
    },
    [statusBar, items.length, selectedRowIds.size, aggregation]
  );

  const showEmptyInGrid = items.length === 0 && !!emptyState && !props.isLoading;
  const hasCellSelection = selectionRange != null || activeCell != null;

  // --- View-model inputs (shared across all 3 DataGridTables) ---

  const {
    sortBy,
    sortDirection,
    onColumnSort,
    filters,
    onFilterChange,
    filterOptions,
    loadingFilterOptions,
    peopleSearch,
  } = props;

  // Stabilize callbacks via refs — headerFilterInput only re-creates when data changes,
  // not when callback identities change (which happens on unrelated state updates).
  const onColumnSortRef = useLatestRef(onColumnSort);
  const onFilterChangeRef = useLatestRef(onFilterChange);
  const peopleSearchRef = useLatestRef(peopleSearch);

  // Stable callback wrappers that delegate to refs
  const stableOnColumnSort = useCallback(
    (columnKey: string) => onColumnSortRef.current?.(columnKey),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const stableOnFilterChange = useCallback(
    (...args: Parameters<NonNullable<typeof onFilterChange>>) => onFilterChangeRef.current?.(...args),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const stablePeopleSearch = useCallback(
    (...args: Parameters<NonNullable<typeof peopleSearch>>) => peopleSearchRef.current?.(...args) ?? Promise.resolve([]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const headerFilterInput: HeaderFilterConfigInput = useMemo(
    () => ({
      sortBy,
      sortDirection,
      onColumnSort: stableOnColumnSort,
      filters,
      onFilterChange: stableOnFilterChange,
      filterOptions,
      loadingFilterOptions,
      peopleSearch: peopleSearch ? stablePeopleSearch : undefined,
    }),
    [
      sortBy,
      sortDirection,
      stableOnColumnSort,
      filters,
      stableOnFilterChange,
      filterOptions,
      loadingFilterOptions,
      peopleSearch, stablePeopleSearch,
    ]
  );

  const cellDescriptorInput: CellRenderDescriptorInput<T> = useMemo(
    () => ({
      editingCell,
      activeCell: cellSelection ? activeCell : null,
      selectionRange: cellSelection ? selectionRange : null,
      cutRange: cellSelection ? cutRange : null,
      copyRange: cellSelection ? copyRange : null,
      colOffset,
      itemsLength: items.length,
      getRowId,
      editable,
      onCellValueChanged,
      isDragging: cellSelection ? isDragging : false,
    }),
    [
      editingCell,
      activeCell,
      selectionRange,
      cutRange,
      copyRange,
      colOffset,
      items.length,
      getRowId,
      editable,
      onCellValueChanged,
      cellSelection,
      isDragging,
    ]
  );

  // --- Cell edit helpers ---

  const [popoverAnchorEl, setPopoverAnchorEl] = useState<HTMLElement | null>(null);

  const visibleColsRef = useLatestRef(visibleCols);
  const itemsLengthRef = useLatestRef(items.length);

  const commitCellEdit = useCallback(
    (
      item: T,
      columnId: string,
      oldValue: unknown,
      newValue: unknown,
      rowIndex: number,
      globalColIndex: number
    ) => {
      // Validate via valueParser before committing
      const col = visibleColsRef.current.find((c) => c.columnId === columnId);
      if (col) {
        const result = parseValue(newValue, oldValue, item, col);
        if (!result.valid) {
          // Reject — cancel the edit
          setEditingCell(null);
          setPopoverAnchorEl(null);
          setPendingEditorValue(undefined);
          return;
        }
        newValue = result.value;
      }

      onCellValueChanged?.({
        item,
        columnId,
        oldValue,
        newValue,
        rowIndex,
      });
      setEditingCell(null);
      setPopoverAnchorEl(null);
      setPendingEditorValue(undefined);
      // Advance to next row for inline editors
      if (rowIndex < itemsLengthRef.current - 1) {
        setActiveCell({ rowIndex: rowIndex + 1, columnIndex: globalColIndex });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onCellValueChanged, setEditingCell, setPendingEditorValue, setActiveCell]
  );

  const cancelPopoverEdit = useCallback(() => {
    setEditingCell(null);
    setPopoverAnchorEl(null);
    setPendingEditorValue(undefined);
  }, [setEditingCell, setPendingEditorValue]);

  // --- Memoize each sub-object so downstream consumers only re-render when their slice changes ---

  const layoutState = useMemo<DataGridLayoutState<T>>(() => ({
    flatColumns, visibleCols, visibleColumnCount, totalColCount, colOffset,
    hasCheckboxCol, rowIndexByRowId, containerWidth, minTableWidth,
    desiredTableWidth, columnSizingOverrides, setColumnSizingOverrides, onColumnResized,
  }), [
    flatColumns, visibleCols, visibleColumnCount, totalColCount, colOffset,
    hasCheckboxCol, rowIndexByRowId, containerWidth, minTableWidth,
    desiredTableWidth, columnSizingOverrides, setColumnSizingOverrides, onColumnResized,
  ]);

  const rowSelectionState = useMemo<DataGridRowSelectionState>(() => ({
    selectedRowIds, updateSelection, handleRowCheckboxChange,
    handleSelectAll, allSelected, someSelected,
  }), [selectedRowIds, updateSelection, handleRowCheckboxChange, handleSelectAll, allSelected, someSelected]);

  const editingState = useMemo<DataGridEditingState<T>>(() => ({
    editingCell, setEditingCell, pendingEditorValue, setPendingEditorValue,
    commitCellEdit, cancelPopoverEdit, popoverAnchorEl, setPopoverAnchorEl,
  }), [editingCell, setEditingCell, pendingEditorValue, setPendingEditorValue, commitCellEdit, cancelPopoverEdit, popoverAnchorEl, setPopoverAnchorEl]);

  const interactionState = useMemo<DataGridCellInteractionState>(() => ({
    activeCell: cellSelection ? activeCell : null,
    setActiveCell: cellSelection ? setActiveCell : (NOOP as typeof setActiveCell),
    selectionRange: cellSelection ? selectionRange : null,
    setSelectionRange: cellSelection ? setSelectionRange : (NOOP as typeof setSelectionRange),
    handleCellMouseDown: cellSelection ? handleCellMouseDown : (NOOP_MOUSE as typeof handleCellMouseDown),
    handleSelectAllCells: cellSelection ? handleSelectAllCells : NOOP,
    hasCellSelection: cellSelection ? hasCellSelection : false,
    handleGridKeyDown: cellSelection ? handleGridKeyDown : (NOOP_KEY as typeof handleGridKeyDown),
    handleFillHandleMouseDown: cellSelection ? handleFillHandleMouseDown : (NOOP as typeof handleFillHandleMouseDown),
    handleCopy: cellSelection ? handleCopy : NOOP,
    handleCut: cellSelection ? handleCut : NOOP,
    handlePaste: cellSelection ? handlePaste : (NOOP_ASYNC as typeof handlePaste),
    cutRange: cellSelection ? cutRange : null,
    copyRange: cellSelection ? copyRange : null,
    clearClipboardRanges: cellSelection ? clearClipboardRanges : NOOP,
    canUndo: undoRedo.canUndo,
    canRedo: undoRedo.canRedo,
    onUndo: undoRedo.undo,
    onRedo: undoRedo.redo,
    isDragging: cellSelection ? isDragging : false,
  }), [
    cellSelection, activeCell, setActiveCell, selectionRange, setSelectionRange,
    handleCellMouseDown, handleSelectAllCells, hasCellSelection, handleGridKeyDown,
    handleFillHandleMouseDown, handleCopy, handleCut, handlePaste, cutRange, copyRange,
    clearClipboardRanges, undoRedo.canUndo, undoRedo.canRedo, undoRedo.undo, undoRedo.redo,
    isDragging,
  ]);

  const contextMenuState = useMemo<DataGridContextMenuState>(() => ({
    menuPosition: cellSelection ? contextMenuPosition : null,
    setMenuPosition: cellSelection ? setContextMenuPosition : (NOOP as typeof setContextMenuPosition),
    handleCellContextMenu: cellSelection ? handleCellContextMenu : (NOOP_CTX as typeof handleCellContextMenu),
    closeContextMenu: cellSelection ? closeContextMenu : NOOP,
  }), [cellSelection, contextMenuPosition, setContextMenuPosition, handleCellContextMenu, closeContextMenu]);

  const viewModelsState = useMemo<DataGridViewModelState<T>>(() => ({
    headerFilterInput, cellDescriptorInput, statusBarConfig, showEmptyInGrid, onCellError,
  }), [headerFilterInput, cellDescriptorInput, statusBarConfig, showEmptyInGrid, onCellError]);

  return {
    layout: layoutState,
    rowSelection: rowSelectionState,
    editing: editingState,
    interaction: interactionState,
    contextMenu: contextMenuState,
    viewModels: viewModelsState,
  };
}
