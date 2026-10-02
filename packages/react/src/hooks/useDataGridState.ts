import { useMemo, useCallback, useEffect } from 'react';
import type { RefObject } from 'react';
import { getDataGridStatusBarConfig, computeAggregations, getCellValue } from '../utils';
import { isColumnEditable } from '@alaarab/ogrid-core';
import type { HeaderFilterConfigInput, CellRenderDescriptorInput } from '../utils';
import type { RowId, IOGridDataGridProps, IStatusBarProps, IColumnDef, IFormulaCellWriter } from '../types';
import type { UseUndoRedoFormulaCells } from './useUndoRedo';
import { useRowSelection } from './useRowSelection';
import { useCellEditing } from './useCellEditing';
import { useActiveCell } from './useActiveCell';
import { useLatestRef } from './useLatestRef';
import { useDataGridLayout } from './useDataGridLayout';
import { useDataGridEditing } from './useDataGridEditing';
import { useDataGridInteraction } from './useDataGridInteraction';
import { useDataGridContextMenu } from './useDataGridContextMenu';
import type { UseVirtualScrollResult } from './useVirtualScroll';

export interface UseDataGridStateParams<T> {
  props: IOGridDataGridProps<T>;
  wrapperRef: RefObject<HTMLDivElement | null>;
  scrollToIndexRef?: RefObject<UseVirtualScrollResult['scrollToIndex'] | null>;
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
  hasRowNumbersCol: boolean;
  rowIndexByRowId: Map<RowId, number>;
  containerWidth: number;
  minTableWidth: number;
  desiredTableWidth: number;
  columnSizingOverrides: Record<string, { widthPx: number }>;
  setColumnSizingOverrides: React.Dispatch<
    React.SetStateAction<Record<string, { widthPx: number }>>
  >;
  onColumnResized?: (columnId: string, width: number) => void;
  /** DOM-measured column widths from the previous layout pass.
   *  UI packages use these as a minWidth floor to prevent columns from
   *  shrinking when new data loads (e.g. during server-side pagination). */
  measuredColumnWidths: Record<string, number>;
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
    globalColIndex: number,
    options?: { skipAdvance?: boolean }
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
  /** True while user is drag-selecting cells (mousedown -> mouseup). */
  isDragging: boolean;
}

/** Context menu position and handlers. */
export interface DataGridContextMenuState {
  menuPosition: { x: number; y: number } | null;
  setMenuPosition: (pos: { x: number; y: number } | null) => void;
  handleCellContextMenu: (e: { clientX: number; clientY: number; preventDefault?: () => void }) => void;
  closeContextMenu: () => void;
  /** Long-press start handler for touch-based context menu. Attach to onPointerDown. */
  handleLongPressStart: (e: React.PointerEvent) => void;
  /** Long-press cancel handler. Attach to onPointerUp/onPointerCancel/onPointerLeave. */
  handleLongPressEnd: () => void;
}

/** View model inputs and derived display state. */
export interface DataGridViewModelState<T> {
  headerFilterInput: HeaderFilterConfigInput;
  cellDescriptorInput: CellRenderDescriptorInput<T>;
  statusBarConfig: IStatusBarProps | null;
  showEmptyInGrid: boolean;
  onCellError?: (error: Error, errorInfo: React.ErrorInfo) => void;
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

/** Grouped result from useDataGridState. */
export interface UseDataGridStateResult<T> {
  layout: DataGridLayoutState<T>;
  rowSelection: DataGridRowSelectionState;
  editing: DataGridEditingState<T>;
  interaction: DataGridCellInteractionState;
  contextMenu: DataGridContextMenuState;
  viewModels: DataGridViewModelState<T>;
  pinning: DataGridPinningState;
}

/**
 * Single orchestration hook for DataGridTable. Takes grid props and wrapper ref,
 * returns all derived state and handlers so Fluent/Material/Radix can be thin view layers.
 *
 * Internally delegates to focused sub-hooks:
 * - useDataGridLayout -- column layout, sizing, pinning, header menu
 * - useDataGridEditing -- cell editing commit/cancel, popover editor
 * - useDataGridInteraction -- cell selection, keyboard nav, clipboard, fill handle, undo/redo
 * - useDataGridContextMenu -- context menu state
 */
export function useDataGridState<T>(
  params: UseDataGridStateParams<T>
): UseDataGridStateResult<T> {
  const { props, wrapperRef, scrollToIndexRef } = params;
  const {
    items,
    columns,
    getRowId,
    visibleColumns,
    columnOrder,
    rowSelection = 'none',
    selectedRows: controlledSelectedRows,
    onSelectionChange,
    showRowNumbers,
    statusBar,
    emptyState,
    editable,
    cellSelection: cellSelectionProp,
    onCellValueChanged: onCellValueChangedProp,
    initialColumnWidths,
    onColumnResized,
    onAutosizeColumn,
    pinnedColumns,
    onColumnPinned,
    responsiveColumns,
    onCellError,
    onClipboardError,
    onKeyDown,
  } = props;

  const cellSelection = cellSelectionProp !== false;

  // A windowed (lazy) source keeps `items` empty; index-based interaction
  // (navigation, clipboard, fill, editing, row selection) reads its loaded
  // rows, a sparse array of length rowCount, instead.
  const windowedRows = props.windowed?.loadedRows;
  const rowItems = windowedRows ?? items;

  // --- Shared state hooks (called at orchestrator level to break circular deps) ---
  const {
    editingCell,
    setEditingCell,
    pendingEditorValue,
    setPendingEditorValue,
  } = useCellEditing();

  const { activeCell, setActiveCell } = useActiveCell(wrapperRef, editingCell, scrollToIndexRef);

  // --- 1. Layout, pinning, header menu ---
  const layoutResult = useDataGridLayout<T>({
    columns,
    items,
    getRowId,
    visibleColumns,
    columnOrder,
    rowSelection,
    showRowNumbers,
    initialColumnWidths,
    onColumnResized,
    onAutosizeColumn,
    pinnedColumns,
    onColumnPinned,
    sortBy: props.sortBy,
    sortDirection: props.sortDirection,
    onColumnSort: props.onColumnSort,
    responsiveColumns,
    wrapperRef,
  });

  const {
    visibleCols,
    visibleColumnCount,
    colOffset,
    hasCheckboxCol,
  } = layoutResult;
  const flatColumns = layoutResult.layout.flatColumns;

  // --- Formula coordinates ---
  // The formula engine is keyed by flat column index + sheet row (see
  // IFormulaRowMap); the grid works in visible columns and displayed rows.
  // These two functions are the one place that translates between them.
  const { formulaRowMap } = props;
  const flatColIndexById = useMemo(
    () => new Map(flatColumns.map((c, i) => [c.columnId, i] as const)),
    [flatColumns]
  );
  const formulaCol = useCallback((columnId: string) => flatColIndexById.get(columnId) ?? -1, [flatColIndexById]);
  const formulaRow = useCallback(
    (rowIndex: number) => (formulaRowMap ? formulaRowMap.toSheetRow(rowIndex) : rowIndex),
    [formulaRowMap]
  );
  // Every value change goes through the undo wrapper, which uses these to clear
  // a formula the value overwrites, record formula changes, and notify the engine.
  const { formulas: formulasOn, getFormula, setFormula, onFormulaCellChanged } = props;
  const formulaCells = useMemo<UseUndoRedoFormulaCells<T> | undefined>(() => {
    if (!formulasOn || !getFormula || !setFormula) return undefined;
    return {
      cellOf: (event) => {
        const col = formulaCol(event.columnId);
        const row = formulaRow(event.rowIndex);
        return col >= 0 && row >= 0 ? { col, row } : null;
      },
      getFormula,
      setFormula,
      onCellChanged: onFormulaCellChanged,
    };
  }, [formulasOn, getFormula, setFormula, onFormulaCellChanged, formulaCol, formulaRow]);

  // --- 2. Row selection ---
  const rowSelectionResult = useRowSelection({
    items: rowItems,
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
  } = rowSelectionResult;
  // The header checkbox selects the loaded rows of a windowed source, so it
  // reads as "all selected" once every loaded row is (the count-based check
  // in useRowSelection compares against the full rowCount).
  const windowedAllSelected = useMemo(() => {
    if (!windowedRows || selectedRowIds.size === 0) return null;
    // Object.values skips the holes without walking the whole (sparse) length.
    const loaded = Object.values(windowedRows);
    return loaded.length > 0 && loaded.every((row) => selectedRowIds.has(getRowId(row)));
  }, [windowedRows, selectedRowIds, getRowId]);
  const allSelected = windowedAllSelected ?? rowSelectionResult.allSelected;
  const someSelected = windowedAllSelected != null ? !windowedAllSelected : rowSelectionResult.someSelected;

  // --- 3. Context menu ---
  const contextMenuResult = useDataGridContextMenu({ cellSelection });
  const { setContextMenuPosition } = contextMenuResult;

  // --- 4. Interaction (selection, keyboard, clipboard, fill handle, undo/redo) ---
  const interactionResult = useDataGridInteraction<T>({
    items: rowItems,
    visibleCols,
    colOffset,
    hasCheckboxCol,
    visibleColumnCount,
    getRowId,
    editable,
    onCellValueChangedProp,
    onUndo: props.onUndo,
    onRedo: props.onRedo,
    canUndo: props.canUndo,
    canRedo: props.canRedo,
    cellSelection,
    rowSelection,
    selectedRowIds,
    editingCell,
    setEditingCell,
    activeCell,
    setActiveCell,
    handleRowCheckboxChange,
    setContextMenuPosition,
    wrapperRef,
    onKeyDown,
    onClipboardError,
    formulas: props.formulas,
    flatColumns,
    getFormula: props.getFormula,
    hasFormula: props.hasFormula,
    setFormula: props.setFormula,
    onFormulaInsertReference: props.onFormulaInsertReference,
    formulaCol,
    formulaRow,
    formulaCells,
  });

  const {
    selectionRange,
    setSelectionRange,
    cutRange,
    copyRange,
    isDragging,
    onCellValueChanged,
  } = interactionResult;

  // --- 5. Editing (commit/cancel logic) ---
  const editingResult = useDataGridEditing<T>({
    editingCell,
    setEditingCell,
    pendingEditorValue,
    setPendingEditorValue,
    visibleCols,
    itemsLength: rowItems.length,
    onCellValueChanged,
    setActiveCell,
    setSelectionRange,
    colOffset,
    // Mapped to sheet rows and recorded for undo; plain values notify the
    // engine through the undo wrapper, so only the legacy path passes this.
    setFormula: interactionResult.setFormula,
    onFormulaCellChanged: formulaCells ? undefined : props.onFormulaCellChanged,
    formulas: props.formulas,
    flatColumns,
  });

  // --- Formula bar writer: sheet cell -> the grid's normal edit path ---
  const { formulaCellWriterRef, editable: editableProp } = props;
  const writerStateRef = useLatestRef({
    items, visibleCols, flatColumns, formulaRowMap, colOffset, editable: editableProp,
    onCellValueChanged, commitCellEdit: editingResult.editing.commitCellEdit,
  });
  const formulaCellWriter = useMemo<IFormulaCellWriter>(() => {
    const resolve = (col: number, row: number) => {
      const st = writerStateRef.current;
      const colDef = st.flatColumns[col];
      const displayRow = st.formulaRowMap ? st.formulaRowMap.toDisplayRow(row) : row;
      if (!colDef || displayRow < 0 || displayRow >= st.items.length) return null;
      const item = st.items[displayRow] as T;
      const editableCell = st.editable !== false && !!st.onCellValueChanged && isColumnEditable(colDef, item);
      return editableCell ? { st, colDef, item, displayRow } : null;
    };
    return {
      canEdit: (col, row) => resolve(col, row) !== null,
      write: (col, row, text) => {
        const cell = resolve(col, row);
        if (!cell) return false;
        const { st, colDef, item, displayRow } = cell;
        const visibleIdx = st.visibleCols.findIndex((c) => c.columnId === colDef.columnId);
        st.commitCellEdit(item, colDef.columnId, getCellValue(item, colDef), text, displayRow, visibleIdx + st.colOffset, { skipAdvance: true });
        return true;
      },
    };
  }, [writerStateRef]);
  useEffect(() => {
    if (!formulaCellWriterRef) return;
    formulaCellWriterRef.current = formulaCellWriter;
    return () => {
      if (formulaCellWriterRef.current === formulaCellWriter) formulaCellWriterRef.current = null;
    };
  }, [formulaCellWriterRef, formulaCellWriter]);

  // --- 6. View models ---
  const {
    sortBy,
    sortDirection,
    filters,
    onFilterChange,
    filterOptions,
    loadingFilterOptions,
    peopleSearch,
  } = props;

  const hasPeopleSearch = !!peopleSearch;
  const onFilterChangeRef = useLatestRef(onFilterChange);
  const peopleSearchRef = useLatestRef(peopleSearch);

  const stableOnFilterChange = useCallback(
    (...args: Parameters<NonNullable<typeof onFilterChange>>) => onFilterChangeRef.current?.(...args),
    [onFilterChangeRef]
  );
  const stablePeopleSearch = useCallback(
    (...args: Parameters<NonNullable<typeof peopleSearch>>) => peopleSearchRef.current?.(...args) ?? Promise.resolve([]),
    [peopleSearchRef]
  );

  const headerFilterInput: HeaderFilterConfigInput = useMemo(
    () => ({
      sortBy,
      sortDirection,
      onColumnSort: layoutResult.stableOnColumnSort,
      filters,
      onFilterChange: stableOnFilterChange,
      filterOptions,
      loadingFilterOptions,
      peopleSearch: hasPeopleSearch ? stablePeopleSearch : undefined,
    }),
    [
      sortBy,
      sortDirection,
      layoutResult.stableOnColumnSort,
      filters,
      stableOnFilterChange,
      filterOptions,
      loadingFilterOptions,
      hasPeopleSearch, stablePeopleSearch,
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
      itemsLength: rowItems.length,
      getRowId,
      editable,
      onCellValueChanged,
      isDragging: cellSelection ? isDragging : false,
      formulaCol,
      formulaRow,
      getFormulaValue: props.getFormulaValue,
      hasFormula: props.hasFormula,
      getFormula: props.getFormula,
      formulaVersion: props.formulaVersion,
    }),
    [
      editingCell,
      activeCell,
      selectionRange,
      cutRange,
      copyRange,
      colOffset,
      rowItems.length,
      getRowId,
      editable,
      onCellValueChanged,
      cellSelection,
      isDragging,
      formulaCol,
      formulaRow,
      props.getFormulaValue,
      props.hasFormula,
      props.getFormula,
      props.formulaVersion,
    ]
  );

  // Only the status bar shows aggregations; skip scanning the selection without one.
  // This also matters for windowed sources, whose rows array is re-created as every block loads.
  const hasStatusBar = !!statusBar;
  const aggregation = useMemo(
    () => (hasStatusBar ? computeAggregations(rowItems, visibleCols, cellSelection ? selectionRange : null) : null),
    [hasStatusBar, rowItems, visibleCols, selectionRange, cellSelection]
  );

  const statusBarConfig = useMemo(
    () => {
      const base = getDataGridStatusBarConfig(
        statusBar as boolean | IStatusBarProps | undefined,
        rowItems.length,
        selectedRowIds.size
      );
      if (!base) return null;
      return { ...base, aggregation: aggregation ?? undefined };
    },
    [statusBar, rowItems.length, selectedRowIds.size, aggregation]
  );

  // A windowed (lazy) data source keeps `items` empty by design — rows are read
  // by index — so an empty `items` array there does not mean "no results".
  const showEmptyInGrid =
    items.length === 0 && !props.windowed && !!emptyState && !props.isLoading;

  // --- Memoize remaining sub-objects ---

  const rowSelectionState = useMemo<DataGridRowSelectionState>(() => ({
    selectedRowIds, updateSelection, handleRowCheckboxChange,
    handleSelectAll, allSelected, someSelected,
  }), [selectedRowIds, updateSelection, handleRowCheckboxChange, handleSelectAll, allSelected, someSelected]);

  const viewModelsState = useMemo<DataGridViewModelState<T>>(() => ({
    headerFilterInput, cellDescriptorInput, statusBarConfig, showEmptyInGrid, onCellError,
  }), [headerFilterInput, cellDescriptorInput, statusBarConfig, showEmptyInGrid, onCellError]);

  return {
    layout: layoutResult.layout,
    rowSelection: rowSelectionState,
    editing: editingResult.editing,
    interaction: interactionResult.interaction,
    contextMenu: contextMenuResult.contextMenu,
    viewModels: viewModelsState,
    pinning: layoutResult.pinning,
  };
}
