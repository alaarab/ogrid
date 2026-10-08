import { useMemo, useRef } from 'react';
import type { IColumnDef } from '../types';
import type { UseVirtualScrollResult } from './useVirtualScroll';
import { useDataGridState } from './useDataGridState';
import { useMiddleClickScroll } from './useMiddleClickScroll';
import { useDataGridSheetCoordinates } from './useDataGridSheetCoordinates';
import { useSheetSelection } from './useSheetSelection';
import { useDataGridColumnControls } from './useDataGridColumnControls';
import { useDataGridVirtualization } from './useDataGridVirtualization';
import { useCellDescriptorCache, useDataGridCellHandlers } from './useDataGridCellHandlers';
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
  const allowOverflowX = resolveAllowOverflowX(suppressHorizontalScroll, containerWidth, minTableWidth, desiredTableWidth);

  // ── Feature slices (effect order matters: keep this sequence) ──────────
  const { columnLetters, rowNumberOf, formulaReferences } = useDataGridSheetCoordinates(
    props, visibleCols, cellDescriptorInput.formulaCol, rowNumberOffset, interaction.activeCell, colOffset,
  );
  const { handleColumnHeaderPointerDown, handleRowHeaderPointerDown } = useSheetSelection<T>({
    wrapperRef, visibleCols, colOffset, rowCount: props.windowed?.loadedRows?.length ?? items.length,
    activeCell: interaction.activeCell, setActiveCell: interaction.setActiveCell, setSelectionRange: interaction.setSelectionRange,
    formulaCol: cellDescriptorInput.formulaCol, formulaRowMap: props.formulaRowMap, rowNumberOffset,
    cellNavigatorRef: props.cellNavigatorRef,
  });
  const { resize, reorder } = useDataGridColumnControls(props, layout, wrapperRef);
  const { virtualScrollEnabled, virtualRowHeight, visibleRange, columnRange, onHorizontalScroll } = useDataGridVirtualization(
    props, stickyHeader, visibleCols, resize.getColumnWidth, wrapperRef, scrollToIndexRef,
  );
  useMiddleClickScroll({ wrapperRef });
  const handlers = useDataGridCellHandlers(props, state, visibleCols, colOffset);
  const { cellDescriptorInputRef, cellDescriptorCacheRef } = useCellDescriptorCache(cellDescriptorInput, items, visibleCols);

  const { handleResizeStart, handleResizeDoubleClick, handleResizeFocus, handleResizeKeyDown, getColumnWidth, getColumnMinWidth } = resize;
  const { isDragging: isReorderDragging, dropIndicatorX, handleHeaderMouseDown } = reorder;
  const {
    editCallbacks, interactionHandlers, delegatedCellHandlers, handleSingleRowClick, handlePasteVoid,
    pendingEditorValueRef, popoverAnchorElRef, selectedRowIdsRef,
  } = handlers;
  const { editingCell, setPopoverAnchorEl, cancelPopoverEdit } = editing;
  const {
    setActiveCell, selectionRange, hasCellSelection, handleGridKeyDown, handleFillHandleMouseDown,
    handleCopy, handleCut, cutRange, copyRange, canUndo, canRedo, onUndo, onRedo, isDragging,
  } = interaction;
  const { menuPosition, handleCellContextMenu, closeContextMenu } = ctxMenu;
  const { headerFilterInput, statusBarConfig, showEmptyInGrid, onCellError } = viewModels;

  return {
    wrapperRef, tableContainerRef, lastMouseShiftRef,
    layout, rowSel, editing, interaction, ctxMenu, viewModels, pinning,
    handleResizeStart, handleResizeDoubleClick, handleResizeFocus, handleResizeKeyDown, getColumnWidth, getColumnMinWidth,
    isReorderDragging, dropIndicatorX, handleHeaderMouseDown,
    virtualScrollEnabled, virtualRowHeight, visibleRange, columnRange, onHorizontalScroll,
    items, windowed, columns, getRowId, emptyState, layoutMode, rowSelection, suppressHorizontalScroll,
    stickyHeader, isLoading, loadingMessage, ariaLabel, ariaLabelledBy, visibleColumns, columnOrder,
    columnReorder, density, rowHeight, pinnedColumns, currentPage, propPageSize,
    rowNumberOffset, headerRows, allowOverflowX, fitToContent: layoutMode === 'content',
    showColumnLetters, showNameBox, columnLetters, rowNumberOf, formulaReferences,
    handleColumnHeaderPointerDown, handleRowHeaderPointerDown,
    editCallbacks, interactionHandlers, delegatedCellHandlers,
    cellDescriptorInputRef, cellDescriptorCacheRef, pendingEditorValueRef, popoverAnchorElRef, selectedRowIdsRef,
    handleSingleRowClick, handlePasteVoid,
    visibleCols, totalColCount, hasCheckboxCol, hasRowNumbersCol, colOffset, containerWidth, minTableWidth,
    desiredTableWidth, columnSizingOverrides, setColumnSizingOverrides, measuredColumnWidths,
    selectedRowIds, updateSelection, handleRowCheckboxChange, handleSelectAll, allSelected, someSelected,
    editingCell, setPopoverAnchorEl, cancelPopoverEdit,
    setActiveCell, selectionRange, hasCellSelection, handleGridKeyDown, handleFillHandleMouseDown,
    handleCopy, handleCut, cutRange, copyRange, canUndo, canRedo, onUndo, onRedo, isDragging,
    menuPosition, handleCellContextMenu, closeContextMenu,
    headerFilterInput, cellDescriptorInput, statusBarConfig, showEmptyInGrid, onCellError,
    headerMenu: pinning.headerMenu,
    findReplace: state.findReplace,
  };
}
