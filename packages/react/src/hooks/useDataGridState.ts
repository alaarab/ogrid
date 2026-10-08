import { useDataValidation, validationContextFor } from './useDataValidation';
import type { DataValidationState } from './useDataValidation';
import { useValidationRules } from './useValidationRules';
import { useMemo, useCallback, useEffect } from 'react';
import type { RefObject } from 'react';
import { getDataGridStatusBarConfig, computeAggregations, getCellValue, parseValue, resolveMergedCells } from '../utils';
import type { IMergeLayout, IHiddenGaps } from '../utils';
import { isColumnEditable, computeRangeCycleStep, isCoveredCell, isSingleMergeRange } from '@alaarab/ogrid-core';
import type { ICellEditCommitOptions } from '@alaarab/ogrid-core';
import type { HeaderFilterConfigInput, CellRenderDescriptorInput } from '../utils';
import type { RowId, IOGridDataGridProps, IStatusBarProps, IColumnDef, IFormulaCellWriter, IGridEditBridge } from '../types';
import type { UseUndoRedoFormulaCells } from './useUndoRedo';
import { useRowSelection } from './useRowSelection';
import { useCellEditing } from './useCellEditing';
import { useActiveCell } from './useActiveCell';
import { useLatestRef } from './useLatestRef';
import { useDataGridLayout } from './useDataGridLayout';
import { useDataGridEditing } from './useDataGridEditing';
import { useDataGridInteraction } from './useDataGridInteraction';
import { useDataGridContextMenu } from './useDataGridContextMenu';
import { useDataGridFindReplace } from './useDataGridFindReplace';
import type { DataGridFindReplaceState } from './useDataGridFindReplace';
import type { UseVirtualScrollResult } from './useVirtualScroll';

/** `frozenRows` clamped to a whole number of displayed rows. */
function resolveFrozenRowCount(frozenRows: number | undefined, rowCount: number): number {
  if (typeof frozenRows !== 'number' || !Number.isFinite(frozenRows) || frozenRows <= 0) return 0;
  return Math.min(Math.floor(frozenRows), rowCount);
}

/** The grid moves focus itself (roving tabindex in useGridCellFocus). */
const ACTIVE_CELL_OPTIONS = { focus: false } as const;

export interface UseDataGridStateParams<T> {
  props: IOGridDataGridProps<T>;
  wrapperRef: RefObject<HTMLDivElement | null>;
  scrollToIndexRef?: RefObject<UseVirtualScrollResult['scrollToIndex'] | null>;
  onRowReorderKeyDown?: (event: React.KeyboardEvent) => boolean;
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
  /** Where hidden columns sit among the visible ones (`allowHiding`; null when none or off). */
  hiddenColumnGaps: IHiddenGaps<string> | null;
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
    options?: ICellEditCommitOptions
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
  /** Native `paste` handler for the grid wrapper (Ctrl/Cmd+V, Shift+Insert). */
  handleGridPaste: (e: React.ClipboardEvent) => void;
  /** Native `copy` handler for the grid wrapper (Ctrl/Cmd+C). */
  handleGridCopy: (e: React.ClipboardEvent) => void;
  /** Native `cut` handler for the grid wrapper (Ctrl/Cmd+X). */
  handleGridCut: (e: React.ClipboardEvent) => void;
  handleFillHandleMouseDown: (e: React.MouseEvent) => void;
  /** Double-click on the fill handle: fill down to the end of the adjacent data column (Excel). */
  handleFillHandleDoubleClick: (e: React.MouseEvent) => void;
  /** Context menu "Paste values only": pastes computed values, never formulas. */
  handlePasteValues: () => void;
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
  /** Move the current selection to a target cell (Ctrl = copy). No-op without a selection. */
  moveRangeTo: (targetRow: number, targetCol: number, copy: boolean) => void;
  /** Apply pasted/dropped text at a cell through the normal edit path (valueParser, undo, formulas). */
  dropTextAt: (rowIndex: number, colIndex: number, text: string) => void;
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
  /** Merged cells resolved against the displayed rows and visible columns (null when none apply). */
  mergeLayout: IMergeLayout | null;
  /** Frozen top rows, clamped to the displayed row count. */
  frozenRows: number;
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
    handleAddToSort: () => void;
    handleAutosizeThis: () => void;
    handleAutosizeAll: () => void;
    handleInsertColumnLeft: () => void;
    handleInsertColumnRight: () => void;
    handleDeleteColumn: () => void;
    canEditStructure: boolean;
    handleHideColumn: () => void;
    handleUnhideColumns: () => void;
    canHide: boolean;
    canUnhide: boolean;
    canPinLeft: boolean;
    canPinRight: boolean;
    canUnpin: boolean;
    currentSort: 'asc' | 'desc' | null;
    isSortable: boolean;
    isResizable: boolean;
    canAddToSort: boolean;
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
  /** Find & Replace panel state and the Ctrl+F / Ctrl+H handler. */
  findReplace: DataGridFindReplaceState;
  validation: DataValidationState<T> & { rules: import('@alaarab/ogrid-core').IDataValidationRule<T>[]; change: (rules: import('@alaarab/ogrid-core').IDataValidationRule<T>[]) => void; sheetRow: (item: T, displayRow: number) => number };
  /** Record an already-applied change in the grid's undo history (no-op when the host owns undo). */
  recordAction: (action: import('./useUndoRedo').UndoableAction) => void;
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

  const { activeCell, setActiveCell: setActiveCellRaw } = useActiveCell(wrapperRef, editingCell, scrollToIndexRef, ACTIVE_CELL_OPTIONS);

  // --- Column structure edits from the header menu ---
  const { structureActions } = props;
  const structureActionsRef = useLatestRef(structureActions);
  const canEditColumnStructure = !!structureActions?.canEditColumns;
  const onInsertColumn = useMemo(
    () => canEditColumnStructure
      ? (columnId: string, side: 'left' | 'right') => structureActionsRef.current?.insertColumnsNear(columnId, side, 1)
      : undefined,
    [canEditColumnStructure, structureActionsRef]
  );
  const onDeleteColumn = useMemo(
    () => canEditColumnStructure
      ? (columnId: string) => structureActionsRef.current?.deleteColumns([columnId])
      : undefined,
    [canEditColumnStructure, structureActionsRef]
  );

  // --- Hide/unhide columns from the header menu (allowHiding) ---
  const { hidingActions } = props;
  const hidingActionsRef = useLatestRef(hidingActions);
  const hidingOn = hidingActions != null;
  const onHideColumns = useMemo(
    () => hidingOn ? (columnIds: string[]) => hidingActionsRef.current?.hideColumns(columnIds) : undefined,
    [hidingOn, hidingActionsRef]
  );
  const onUnhideColumns = useMemo(
    () => hidingOn ? (columnIds: string[]) => hidingActionsRef.current?.unhideColumns(columnIds) : undefined,
    [hidingOn, hidingActionsRef]
  );

  // --- 1. Layout, pinning, header menu ---
  const layoutResult = useDataGridLayout<T>({
    frozenColumns: props.frozenColumns,
    onInsertColumn,
    onDeleteColumn,
    onHideColumns,
    onUnhideColumns,
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
    sortModel: props.sortModel,
    onColumnSort: props.onColumnSort,
    responsiveColumns,
    wrapperRef,
  });

  const {
    visibleCols: rawVisibleCols,
    visibleColumnCount,
    colOffset,
    hasCheckboxCol,
  } = layoutResult;
  const rawFlatColumns = layoutResult.layout.flatColumns;
  const { getSpillRange, getFormulaValue, formulaVersion } = props;
  // All grid edit paths (typing, paste, fill, Delete, Find/Replace and the bar)
  // use these columns, so one editability rule protects spilled children.
  // biome-ignore lint/correctness/useExhaustiveDependencies: formulaVersion refreshes the column identities and all memoized rows after spill resize/recalc
  const protectedColumns = useMemo(() => {
    if (!getSpillRange || !getFormulaValue) return null;
    const rowByItem = new Map<T, number>();
    rowItems.forEach((item, row) => { rowByItem.set(item, props.formulaRowMap?.toSheetRow(row) ?? row); });
    return new Map(rawFlatColumns.map((column, col) => {
      const spillAt = (item: T) => getSpillRange(col, rowByItem.get(item) ?? -1);
      const child = (item: T) => {
        const spill = spillAt(item);
        return !!spill && (spill.anchorCol !== col || spill.anchorRow !== rowByItem.get(item));
      };
      return [column.columnId, {
        ...column,
        editable: (item: T) => !child(item) && isColumnEditable(column, item),
        valueGetter: (item: T) => child(item) ? getFormulaValue(col, rowByItem.get(item) ?? -1) : getCellValue(item, column),
      } as IColumnDef<T>] as const;
    }));
  }, [rawFlatColumns, rowItems, props.formulaRowMap, getSpillRange, getFormulaValue, formulaVersion]);
  const flatColumns = useMemo(() => protectedColumns ? rawFlatColumns.map(c => protectedColumns.get(c.columnId) ?? c) : rawFlatColumns, [rawFlatColumns, protectedColumns]);
  const visibleCols = useMemo(() => protectedColumns ? rawVisibleCols.map(c => protectedColumns.get(c.columnId) ?? c) : rawVisibleCols, [rawVisibleCols, protectedColumns]);

  const resolvedLayout = useMemo(() => protectedColumns ? { ...layoutResult.layout, flatColumns, visibleCols } : layoutResult.layout, [layoutResult.layout, protectedColumns, flatColumns, visibleCols]);

  // --- Frozen rows and merged cells (resolved against the displayed rows) ---
  const frozenRows = resolveFrozenRowCount(props.frozenRows, rowItems.length);
  const { mergedCells } = props;
  const { rowIndexByRowId } = layoutResult.layout;
  const livePinned = layoutResult.pinning.pinnedColumns;
  // A windowed source holds only some rows, so merges (which need whole spans) are off there.
  const isWindowed = props.windowed != null;
  const mergeLayout = useMemo<IMergeLayout | null>(() => {
    if (!mergedCells || mergedCells.length === 0 || isWindowed) return null;
    const pinnedSide = new Map<string, 'left' | 'right' | undefined>();
    for (const c of visibleCols) pinnedSide.set(c.columnId, livePinned[c.columnId] ?? c.pinned);
    return resolveMergedCells({
      mergedCells,
      rowIndexOf: (id) => rowIndexByRowId.get(id),
      rowCount: items.length,
      columnIds: visibleCols.map((c) => c.columnId),
      pinnedSideOf: (id) => pinnedSide.get(id),
      frozenRows,
    });
  }, [mergedCells, isWindowed, rowIndexByRowId, items.length, visibleCols, livePinned, frozenRows]);
  const mergeLayoutRef = useLatestRef(mergeLayout);
  const colOffsetRef = useLatestRef(colOffset);
  // The active cell of a merged block is always its anchor (top-left) cell.
  const setActiveCell = useCallback((cell: { rowIndex: number; columnIndex: number } | null) => {
    const layout = mergeLayoutRef.current;
    const off = colOffsetRef.current;
    if (cell && layout && cell.columnIndex >= off) {
      const m = layout.mergeAt(cell.rowIndex, cell.columnIndex - off);
      if (m && (m.startRow !== cell.rowIndex || m.startCol + off !== cell.columnIndex)) {
        setActiveCellRaw({ rowIndex: m.startRow, columnIndex: m.startCol + off });
        return;
      }
    }
    setActiveCellRaw(cell);
  }, [mergeLayoutRef, colOffsetRef, setActiveCellRaw]);
  // Enter-commit moves below the whole merged block.
  const rowBelow = useCallback((rowIndex: number, dataCol: number) => {
    const m = mergeLayoutRef.current?.mergeAt(rowIndex, dataCol);
    return (m ? m.endRow : rowIndex) + 1;
  }, [mergeLayoutRef]);

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

  const validationRules = useValidationRules(props.dataValidations, props.onDataValidationsChange);
  const validationContext = useMemo(() => validationContextFor(props.validationContext, rowItems, flatColumns), [props.validationContext, rowItems, flatColumns]);
  const validationOn = validationRules.rules.length > 0 || props.allowValidationEditing;
  const sheetIndex = useMemo(() => {
    const map = new Map<RowId, number>();
    if (validationOn) validationContext.items.forEach((item, row) => { if (item !== undefined) map.set(getRowId(item), row); });
    return map;
  }, [validationOn, validationContext.items, getRowId]);
  const validationSheetRow = useCallback((item: T, displayRow: number) => sheetIndex.get(getRowId(item)) ?? formulaRow(displayRow), [sheetIndex, getRowId, formulaRow]);
  const validation = useDataValidation({ rules: validationRules.rules, context: validationContext, sheetRow: validationSheetRow, onValidationFail: props.onValidationFail });

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
    validationGuard: validation.guard,
    onUndo: props.onUndo,
    onRedo: props.onRedo,
    canUndo: props.canUndo,
    canRedo: props.canRedo,
    cellSelection,
    rowSelection,
    selectedRowIds,
    editingCell,
    setEditingCell,
    setPendingEditorValue,
    activeCell,
    setActiveCell,
    handleRowCheckboxChange,
    setContextMenuPosition,
    wrapperRef,
    scrollToIndexRef,
    onKeyDown,
    onRowReorderKeyDown: params.onRowReorderKeyDown,
    onClipboardError,
    formulas: props.formulas,
    flatColumns,
    getFormula: props.getFormula,
    hasFormula: props.hasFormula,
    setFormula: props.setFormula,
    getFormulaValue: props.getFormulaValue,
    onFormulaInsertReference: props.onFormulaInsertReference,
    formulaCol,
    formulaRow,
    formulaCells,
    mergeLayout,
  });

  const {
    selectionRange,
    setSelectionRange,
    cutRange,
    copyRange,
    isDragging,
    onCellValueChanged,
  } = interactionResult;

  // Shift+Enter-commit moves above the whole merged block.
  const rowAbove = useCallback((rowIndex: number, dataCol: number) => {
    const m = mergeLayoutRef.current?.mergeAt(rowIndex, dataCol);
    return (m ? m.startRow : rowIndex) - 1;
  }, [mergeLayoutRef]);
  // Enter-commit inside a multi-cell selection steps through it (Excel) and keeps it.
  const selectionRangeRef = useLatestRef(selectionRange);
  const stepInSelection = useCallback((rowIndex: number, dataCol: number, move: 'down' | 'up') => {
    const range = selectionRangeRef.current;
    const layout = mergeLayoutRef.current;
    if (!range) return null;
    const single = (range.startRow === range.endRow && range.startCol === range.endCol) || isSingleMergeRange(range, layout);
    const r0 = Math.min(range.startRow, range.endRow);
    const r1 = Math.max(range.startRow, range.endRow);
    const c0 = Math.min(range.startCol, range.endCol);
    const c1 = Math.max(range.startCol, range.endCol);
    if (single || rowIndex < r0 || rowIndex > r1 || dataCol < c0 || dataCol > c1) return null;
    return computeRangeCycleStep(range, rowIndex, dataCol, move, (r, c) => isCoveredCell(layout, r, c));
  }, [selectionRangeRef, mergeLayoutRef]);

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
    hasFormula: interactionResult.hasFormula,
    onFormulaCellChanged: formulaCells ? undefined : props.onFormulaCellChanged,
    formulas: props.formulas,
    flatColumns,
    rowBelow,
    rowAbove,
    stepInSelection,
  });

  // --- Find & Replace (Ctrl+F / Ctrl+H) ---
  const findReplace = useDataGridFindReplace<T>({
    enabled: !!props.findReplace && cellSelection,
    items: rowItems,
    findRows: props.findRows,
    onFindPageChange: props.onFindPageChange,
    currentPage: props.currentPage ?? 1,
    pageSize: props.pageSize,
    visibleCols,
    colOffset,
    getRowId,
    activeCell,
    setActiveCell,
    selectionRange,
    setSelectionRange,
    editingCell,
    editable,
    onCellValueChanged,
    beginBatch: interactionResult.beginBatch,
    endBatch: interactionResult.endBatch,
    getFormula: interactionResult.getFormula,
    setFormula: interactionResult.setFormula,
    getFormulaValue: props.getFormulaValue,
    formulaCol,
    formulaRow,
    mergeLayout,
    wrapperRef,
  });

  // --- Formula bar writer: sheet cell -> the grid's normal edit path ---
  const { formulaCellWriterRef, editable: editableProp } = props;
  const writerStateRef = useLatestRef({
    items: rowItems, visibleCols, flatColumns, formulaRowMap, colOffset, editable: editableProp,
    onCellValueChanged, commitCellEdit: editingResult.editing.commitCellEdit,
  });
  const formulaCellWriter = useMemo<IFormulaCellWriter>(() => {
    const resolve = (col: number, row: number) => {
      const st = writerStateRef.current;
      const colDef = st.flatColumns[col];
      const displayRow = st.formulaRowMap ? st.formulaRowMap.toDisplayRow(row) : row;
      if (!colDef || displayRow < 0 || displayRow >= st.items.length) return null;
      const item = st.items[displayRow];
      if (item === undefined) return null;
      const editableCell = st.editable !== false && !!st.onCellValueChanged && isColumnEditable<T>(colDef, item);
      return editableCell ? { st, colDef, item, displayRow } : null;
    };
    return {
      canEdit: (col, row) => resolve(col, row) !== null,
      write: (col, row, text) => {
        const cell = resolve(col, row);
        if (!cell) return false;
        const { st, colDef, item, displayRow } = cell;
        const visibleIdx = st.visibleCols.findIndex((c) => c.columnId === colDef.columnId);
        st.commitCellEdit(item, colDef.columnId, getCellValue<T>(item, colDef), text, displayRow, visibleIdx + st.colOffset, { skipAdvance: true });
        return true;
      },
      focusActiveCell: () => {
        const wrapper = wrapperRef.current;
        if (!wrapper) return;
        // The roving tab stop is the active cell; the wrapper stands in while it isn't rendered.
        const cell = wrapper.querySelector<HTMLElement>('tbody td[tabindex="0"]');
        (cell ?? wrapper).focus({ preventScroll: true });
      },
    };
  }, [writerStateRef, wrapperRef]);
  useEffect(() => {
    if (!formulaCellWriterRef) return;
    formulaCellWriterRef.current = formulaCellWriter;
    return () => {
      if (formulaCellWriterRef.current === formulaCellWriter) formulaCellWriterRef.current = null;
    };
  }, [formulaCellWriterRef, formulaCellWriter]);

  // --- Edit bridge: OGrid's setCellValue and structure edits use the grid's edit path and undo history ---
  const { gridEditBridgeRef } = props;
  const bridgeStateRef = useLatestRef({
    flatColumns, rowIndexByRowId: layoutResult.layout.rowIndexByRowId, getRowId, formulas: props.formulas,
    getFormula: props.getFormula, getSpillRange: props.getSpillRange, onCellValueChanged, formulaRow,
    writeSheetFormula: interactionResult.writeSheetFormula,
    beginBatch: interactionResult.beginBatch, endBatch: interactionResult.endBatch,
    recordAction: interactionResult.recordAction,
    guard: validation.guard,
    rawOnCellValueChanged: interactionResult.rawOnCellValueChanged,
    rawWriteSheetFormula: interactionResult.rawWriteSheetFormula,
  });
  const gridEditBridge = useMemo<IGridEditBridge<T>>(() => ({
    setCellValue: (item, columnId, value, sheetRowHint) => {
      const st = bridgeStateRef.current;
      const col = st.flatColumns.findIndex((c) => c.columnId === columnId);
      const colDef = st.flatColumns[col];
      if (!colDef) return false;
      const displayRow = st.rowIndexByRowId.get(st.getRowId(item)) ?? -1;
      const sheetRow = sheetRowHint >= 0 ? sheetRowHint : displayRow >= 0 ? st.formulaRow(displayRow) : -1;
      const spill = st.getSpillRange?.(col, sheetRow);
      if (spill && (spill.anchorCol !== col || spill.anchorRow !== sheetRow)) return false;
      if (st.formulas && typeof value === 'string' && value.length > 1 && value.startsWith('=')) {
        if (sheetRow < 0 || !st.writeSheetFormula) return false;
        return st.guard({ item, columnId, oldValue: getCellValue<T>(item, colDef), newValue: value, rowIndex: displayRow }, () => st.rawWriteSheetFormula?.(col, sheetRow, value, displayRow), true, sheetRow);
      }
      const oldValue = getCellValue<T>(item, colDef);
      const parsed = parseValue(value, oldValue, item, colDef);
      if (!parsed.valid) return false;
      const hasFormulaThere = !!st.formulas && sheetRow >= 0 && st.getFormula?.(col, sheetRow) !== undefined;
      if (!hasFormulaThere && Object.is(parsed.value, oldValue)) return true;
      const event = { item, columnId, oldValue, newValue: parsed.value, rowIndex: displayRow };
      return st.guard(event, () => {
        if (displayRow < 0 && hasFormulaThere) {
          st.beginBatch();
          try {
            st.rawWriteSheetFormula?.(col, sheetRow, null, displayRow);
            st.rawOnCellValueChanged?.(event);
          } finally { st.endBatch(); }
        } else st.rawOnCellValueChanged?.(event);
      }, true, sheetRow);
    },
    recordUndoable: (action) => bridgeStateRef.current.recordAction(action),
  }), [bridgeStateRef]);
  useEffect(() => {
    if (!gridEditBridgeRef) return;
    gridEditBridgeRef.current = gridEditBridge;
    return () => {
      if (gridEditBridgeRef.current === gridEditBridge) gridEditBridgeRef.current = null;
    };
  }, [gridEditBridgeRef, gridEditBridge]);

  // --- 6. View models ---
  const {
    sortBy,
    sortDirection,
    sortModel,
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
      sortModel,
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
      sortModel,
      layoutResult.stableOnColumnSort,
      filters,
      stableOnFilterChange,
      filterOptions,
      loadingFilterOptions,
      hasPeopleSearch, stablePeopleSearch,
    ]
  );

  const activeSpillCol = activeCell ? formulaCol(visibleCols[activeCell.columnIndex - colOffset]?.columnId ?? '') : -1;
  const activeSpillRow = activeCell ? formulaRow(activeCell.rowIndex) : -1;
  const activeSpillRange = props.getSpillRange?.(activeSpillCol, activeSpillRow);
  const cellDescriptorInput: CellRenderDescriptorInput<T> = useMemo(
    () => ({
      activeSpillRange,
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
      mergeLayout,
    }),
    [
      activeSpillRange,
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
      mergeLayout,
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
    headerFilterInput, cellDescriptorInput, statusBarConfig, showEmptyInGrid, onCellError, mergeLayout, frozenRows,
  }), [headerFilterInput, cellDescriptorInput, statusBarConfig, showEmptyInGrid, onCellError, mergeLayout, frozenRows]);

  return {
    layout: resolvedLayout,
    rowSelection: rowSelectionState,
    editing: editingResult.editing,
    interaction: interactionResult.interaction,
    contextMenu: contextMenuResult.contextMenu,
    viewModels: viewModelsState,
    pinning: layoutResult.pinning,
    findReplace,
    validation: { ...validation, ...validationRules, sheetRow: validationSheetRow },
    recordAction: interactionResult.recordAction,
  };
}
