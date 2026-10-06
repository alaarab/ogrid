import { useMemo, useRef } from 'react';
import type { IColumnDef } from '../types';
import type { UseVirtualScrollResult } from './useVirtualScroll';
import { useDataGridState } from './useDataGridState';
import { useMiddleClickScroll } from './useMiddleClickScroll';
import { useDataGridSheetCoordinates } from './useDataGridSheetCoordinates';
import { useDataGridColumnControls } from './useDataGridColumnControls';
import { useDataGridVirtualization } from './useDataGridVirtualization';
import { useDataGridCellHandlers } from './useDataGridCellHandlers';
import { useCellDescriptorCache } from './useCellDescriptorCache';
import { resolveAllowOverflowX, resolveRowNumberOffset } from './dataGridDerivations';
import { buildHeaderRows } from '../utils';
import type {
  UseDataGridTableOrchestrationParams,
  UseDataGridTableOrchestrationResult,
} from './useDataGridTableOrchestration.types';

export type {
  UseDataGridTableOrchestrationParams,
  UseDataGridTableOrchestrationResult,
} from './useDataGridTableOrchestration.types';

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
  const scrollToIndexRef = useRef<UseVirtualScrollResult['scrollToIndex'] | null>(null);

  // ── Core state ──────────────────────────────────────────────────────────
  const state = useDataGridState({
    props,
    wrapperRef,
    scrollToIndexRef: props.virtualScroll?.enabled || props.windowed ? scrollToIndexRef : undefined,
  });

  const { layout, rowSelection: rowSel, editing, interaction, contextMenu: ctxMenu, viewModels, pinning } = state;
  const {
    visibleCols: visibleColsTyped, totalColCount, hasCheckboxCol, hasRowNumbersCol, colOffset,
    containerWidth, minTableWidth, desiredTableWidth,
    columnSizingOverrides, setColumnSizingOverrides, measuredColumnWidths,
  } = layout;
  const visibleCols = visibleColsTyped as IColumnDef<T>[];
  const { selectedRowIds, updateSelection, handleRowCheckboxChange, handleSelectAll, allSelected, someSelected } = rowSel;
  const { cellDescriptorInput } = viewModels;

  // ── Props destructuring ─────────────────────────────────────────────────
  const {
    items, windowed, columns, getRowId, emptyState,
    layoutMode = 'fill', rowSelection = 'none', suppressHorizontalScroll,
    stickyHeader = true, isLoading = false, loadingMessage = 'Loading…',
    'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy,
    visibleColumns, columnOrder, columnReorder, rowHeight, density = 'normal', pinnedColumns,
    currentPage = 1, pageSize: propPageSize = 25, showColumnLetters = false, showNameBox = false,
  } = props;

  // ── Layout derivations ──────────────────────────────────────────────────
  const rowNumberOffset = resolveRowNumberOffset(hasRowNumbersCol, !!windowed, currentPage, propPageSize);
  // Build the header from the same ordered, responsive-filtered column list the
  // body renders, so header cells always sit over their own body columns.
  const headerRows = useMemo(() => {
    const ids = visibleCols.map((c) => c.columnId);
    return buildHeaderRows(columns, new Set(ids), ids);
  }, [columns, visibleCols]);
  const allowOverflowX = resolveAllowOverflowX({ suppressHorizontalScroll, containerWidth, minTableWidth, desiredTableWidth });

  // ── Sheet coordinates (column letters, row numbers, name box) ─────────
  const { columnLetters, rowNumberOf, formulaReferences } = useDataGridSheetCoordinates({
    visibleCols, formulaCol: cellDescriptorInput.formulaCol, formulaRowMap: props.formulaRowMap, rowNumberOffset,
    formulaReferences: props.formulaReferences, rowCount: items.length, activeCell: interaction.activeCell,
    colOffset, onActiveCellChange: props.onActiveCellChange,
  });

  // ── Column resize / reorder ────────────────────────────────────────────
  const { resize, reorder } = useDataGridColumnControls<T>({
    columnSizingOverrides, setColumnSizingOverrides, onColumnResized: props.onColumnResized,
    flatColumns: layout.flatColumns as IColumnDef<T>[], columnOrder, onColumnOrderChange: props.onColumnOrderChange,
    columnReorder, pinnedColumns, wrapperRef,
  });

  // ── Virtual scroll ─────────────────────────────────────────────────────
  const { virtualScrollEnabled, virtualRowHeight, visibleRange, columnRange, onHorizontalScroll } = useDataGridVirtualization({
    virtualScroll: props.virtualScroll, windowed, rowHeight, itemCount: items.length, stickyHeader,
    visibleCols, pinnedColumns, getColumnWidth: resize.getColumnWidth, wrapperRef, scrollToIndexRef,
    scrollToRowRef: props.scrollToRowRef,
  });

  useMiddleClickScroll({ wrapperRef });

  // ── Cell handlers (GridRow / renderCellContent inputs) ──────────────────
  const handlers = useDataGridCellHandlers({
    editing, interaction, ctxMenu,
    // Windowed sources read the loaded rows by absolute index (see useDataGridState).
    rows: windowed?.loadedRows ?? items,
    getRowId, visibleCols, colOffset, rowSelection, updateSelection, selectedRowIds,
  });
  const { cellDescriptorInputRef, cellDescriptorCacheRef } = useCellDescriptorCache(cellDescriptorInput, items, visibleCols);

  return {
    wrapperRef, tableContainerRef, lastMouseShiftRef,
    // State sub-objects
    layout, rowSel, editing, interaction, ctxMenu, viewModels, pinning,
    // Column resize / reorder
    handleResizeStart: resize.handleResizeStart,
    handleResizeDoubleClick: resize.handleResizeDoubleClick,
    handleResizeFocus: resize.handleResizeFocus,
    handleResizeKeyDown: resize.handleResizeKeyDown,
    getColumnWidth: resize.getColumnWidth,
    getColumnMinWidth: resize.getColumnMinWidth,
    isReorderDragging: reorder.isDragging,
    dropIndicatorX: reorder.dropIndicatorX,
    handleHeaderMouseDown: reorder.handleHeaderMouseDown,
    // Virtual scroll
    virtualScrollEnabled, virtualRowHeight, visibleRange, columnRange, onHorizontalScroll,
    // Derived from props
    items, windowed, columns, getRowId, emptyState, layoutMode, rowSelection, suppressHorizontalScroll,
    stickyHeader, isLoading, loadingMessage, ariaLabel, ariaLabelledBy, visibleColumns, columnOrder,
    columnReorder, density, rowHeight, pinnedColumns, currentPage, propPageSize,
    // Computed values
    rowNumberOffset, headerRows, allowOverflowX, fitToContent: layoutMode === 'content',
    showColumnLetters, showNameBox, columnLetters, rowNumberOf, formulaReferences,
    // Memoized callback groups and stable refs
    editCallbacks: handlers.editCallbacks,
    interactionHandlers: handlers.interactionHandlers,
    delegatedCellHandlers: handlers.delegatedCellHandlers,
    cellDescriptorInputRef,
    cellDescriptorCacheRef,
    pendingEditorValueRef: handlers.pendingEditorValueRef,
    popoverAnchorElRef: handlers.popoverAnchorElRef,
    selectedRowIdsRef: handlers.selectedRowIdsRef,
    // Convenience handlers
    handleSingleRowClick: handlers.handleSingleRowClick,
    handlePasteVoid: handlers.handlePasteVoid,
    // Layout-derived references
    visibleCols, totalColCount, hasCheckboxCol, hasRowNumbersCol, colOffset, containerWidth, minTableWidth,
    desiredTableWidth, columnSizingOverrides, setColumnSizingOverrides, measuredColumnWidths,
    // Row selection shortcuts
    selectedRowIds, updateSelection, handleRowCheckboxChange, handleSelectAll, allSelected, someSelected,
    // Editing shortcuts
    editingCell: editing.editingCell,
    setPopoverAnchorEl: editing.setPopoverAnchorEl,
    cancelPopoverEdit: editing.cancelPopoverEdit,
    // Interaction shortcuts
    setActiveCell: interaction.setActiveCell,
    selectionRange: interaction.selectionRange,
    hasCellSelection: interaction.hasCellSelection,
    handleGridKeyDown: interaction.handleGridKeyDown,
    handleFillHandleMouseDown: interaction.handleFillHandleMouseDown,
    handleCopy: interaction.handleCopy,
    handleCut: interaction.handleCut,
    cutRange: interaction.cutRange,
    copyRange: interaction.copyRange,
    canUndo: interaction.canUndo,
    canRedo: interaction.canRedo,
    onUndo: interaction.onUndo,
    onRedo: interaction.onRedo,
    isDragging: interaction.isDragging,
    // Context menu shortcuts
    menuPosition: ctxMenu.menuPosition,
    handleCellContextMenu: ctxMenu.handleCellContextMenu,
    closeContextMenu: ctxMenu.closeContextMenu,
    // ViewModel shortcuts
    headerFilterInput: viewModels.headerFilterInput,
    cellDescriptorInput,
    statusBarConfig: viewModels.statusBarConfig,
    showEmptyInGrid: viewModels.showEmptyInGrid,
    onCellError: viewModels.onCellError,
    // Pinning shortcuts
    headerMenu: pinning.headerMenu,
  };
}
