import { useMemo, useCallback } from 'react';
import type { RefObject } from 'react';
import type { RowId, IColumnDef } from '../types';
import { useCellSelection } from './useCellSelection';
import { useClipboard } from './useClipboard';
import { useKeyboardNavigation } from './useKeyboardNavigation';
import { useFillHandle } from './useFillHandle';
import { useUndoRedo } from './useUndoRedo';
import type { DataGridCellInteractionState } from './useDataGridState';

// Stable no-op handlers used when cellSelection is disabled (module-scope = no re-renders)
const NOOP = () => {};
const NOOP_ASYNC = async () => {};
const NOOP_MOUSE = (_e: React.MouseEvent, _r: number, _c: number) => {};
const NOOP_KEY = (_e: React.KeyboardEvent) => {};

export interface UseDataGridInteractionParams<T> {
  items: T[];
  visibleCols: IColumnDef<T>[];
  colOffset: number;
  hasCheckboxCol: boolean;
  visibleColumnCount: number;
  getRowId: (item: T) => RowId;
  editable?: boolean;
  onCellValueChangedProp?: (event: {
    item: T;
    columnId: string;
    oldValue: unknown;
    newValue: unknown;
    rowIndex: number;
  }) => void;
  cellSelection: boolean;
  rowSelection?: 'none' | 'single' | 'multiple';
  selectedRowIds: Set<RowId>;
  /** From useCellEditing (called at orchestrator level). */
  editingCell: { rowId: RowId; columnId: string } | null;
  /** From useCellEditing (called at orchestrator level). */
  setEditingCell: (cell: { rowId: RowId; columnId: string } | null) => void;
  /** From useActiveCell (called at orchestrator level). */
  activeCell: { rowIndex: number; columnIndex: number } | null;
  /** From useActiveCell (called at orchestrator level). */
  setActiveCell: (cell: { rowIndex: number; columnIndex: number } | null) => void;
  handleRowCheckboxChange: (
    rowId: RowId,
    checked: boolean,
    rowIndex: number,
    shiftKey: boolean
  ) => void;
  setContextMenuPosition: (pos: { x: number; y: number } | null) => void;
  wrapperRef: RefObject<HTMLDivElement | null>;
}

export interface UseDataGridInteractionResult<T> {
  interaction: DataGridCellInteractionState;
  selectionRange: {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  } | null;
  setSelectionRange: (range: {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  } | null) => void;
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
  isDragging: boolean;
  /** The undo/redo wrapper around onCellValueChanged. Consumers need this for editing. */
  onCellValueChanged: ((event: {
    item: T;
    columnId: string;
    oldValue: unknown;
    newValue: unknown;
    rowIndex: number;
  }) => void) | undefined;
  canUndo: boolean;
  canRedo: boolean;
}

/**
 * Manages cell selection, keyboard navigation, clipboard, fill handle, and undo/redo.
 * Extracted from useDataGridState for modularity.
 *
 * activeCell/setActiveCell and editingCell/setEditingCell are passed in from the
 * orchestrator level to avoid circular dependencies with useDataGridEditing.
 */
export function useDataGridInteraction<T>(
  params: UseDataGridInteractionParams<T>
): UseDataGridInteractionResult<T> {
  const {
    items,
    visibleCols,
    colOffset,
    hasCheckboxCol,
    visibleColumnCount,
    getRowId,
    editable,
    onCellValueChangedProp,
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
  } = params;

  // Wrap onCellValueChanged with undo/redo tracking
  const undoRedo = useUndoRedo<T>({ onCellValueChanged: onCellValueChangedProp });
  const onCellValueChanged = undoRedo.onCellValueChanged;

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
    [handleCellMouseDownBase, clearClipboardRanges, wrapperRef]
  );

  const { handleGridKeyDown } = useKeyboardNavigation({
    data: { items, visibleCols, colOffset, hasCheckboxCol, visibleColumnCount, getRowId },
    state: { activeCell, selectionRange, editingCell, selectedRowIds },
    handlers: { setActiveCell, setSelectionRange, setEditingCell, handleRowCheckboxChange, handleCopy, handleCut, handlePaste, setContextMenu: setContextMenuPosition, onUndo: undoRedo.undo, onRedo: undoRedo.redo, clearClipboardRanges },
    features: { editable, onCellValueChanged, rowSelection: rowSelection ?? 'none', wrapperRef },
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

  const hasCellSelection = selectionRange != null || activeCell != null;

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

  return {
    interaction: interactionState,
    selectionRange,
    setSelectionRange,
    cutRange,
    copyRange,
    clearClipboardRanges,
    isDragging,
    onCellValueChanged,
    canUndo: undoRedo.canUndo,
    canRedo: undoRedo.canRedo,
  };
}
