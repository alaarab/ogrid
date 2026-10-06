import { useMemo, useCallback } from 'react';
import type { RefObject } from 'react';
import type { RowId, IColumnDef } from '../types';
import type { IFillFormulaOptions } from '../utils';
import type { ScrollToRowIndex } from '../utils/scrollCellIntoView';
import { formatCellReference } from '../utils';
import { useCellSelection } from './useCellSelection';
import { useClipboard } from './useClipboard';
import { useKeyboardNavigation } from './useKeyboardNavigation';
import { useFillHandleInternal } from './useFillHandleInternal';
import { useUndoRedo } from './useUndoRedo';
import type { UseUndoRedoFormulaCells } from './useUndoRedo';
import { useLatestRef } from './useLatestRef';
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
  /** Host-managed undo. When supplied, Ctrl+Z / the context menu call this instead of the internal stack. */
  onUndo?: () => void;
  /** Host-managed redo. When supplied, Ctrl+Y / the context menu call this instead of the internal stack. */
  onRedo?: () => void;
  /** Host-managed undo availability; defaults to true when `onUndo` is supplied, else the internal stack. */
  canUndo?: boolean;
  /** Host-managed redo availability; defaults to true when `onRedo` is supplied, else the internal stack. */
  canRedo?: boolean;
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
  /** Virtual grids: scrolls a row into view by index (used by keyboard Shift-extend). */
  scrollToIndexRef?: RefObject<ScrollToRowIndex | null>;
  /** Custom keydown handler  -  called before grid default. preventDefault() suppresses grid handling. */
  onKeyDown?: (event: React.KeyboardEvent) => void;
  /** Called when reading the system clipboard fails on paste. */
  onClipboardError?: (error: unknown) => void;
  /** When true, enables formula-aware clipboard and fill handle. */
  formulas?: boolean;
  /** Flat column list for formula coordinate mapping. */
  flatColumns?: IColumnDef<T>[];
  /** Returns the formula string for a flat column + row. */
  getFormula?: (col: number, row: number) => string | undefined;
  /** Returns true if a flat column + row has a formula. */
  hasFormula?: (col: number, row: number) => boolean;
  /** Sets or clears a formula for a flat column + row. */
  setFormula?: (col: number, row: number, formula: string | null) => void;
  /** Called when a cell is clicked during formula editing to insert a cell reference. */
  onFormulaInsertReference?: (reference: string) => boolean;
  /** Formula engine column of a column id (flat index), or -1. Defaults to the flat column lookup. */
  formulaCol?: (columnId: string) => number;
  /** Formula engine (sheet) row of a displayed row, or -1. Defaults to the display row. */
  formulaRow?: (rowIndex: number) => number;
  /** Formula hooks for the undo history (engine coordinates). */
  formulaCells?: UseUndoRedoFormulaCells<T>;
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
  /**
   * Set or clear a formula by (flat column, display row): mapped to the sheet
   * row and recorded for undo. Undefined when formulas are off.
   */
  setFormula?: (col: number, row: number, formula: string | null) => void;
  hasFormula?: (col: number, row: number) => boolean;
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
    onUndo: onUndoProp,
    onRedo: onRedoProp,
    canUndo: canUndoProp,
    canRedo: canRedoProp,
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
    scrollToIndexRef,
    onKeyDown,
    onClipboardError,
    formulas,
    flatColumns,
    getFormula,
    hasFormula,
    setFormula,
    onFormulaInsertReference,
    formulaCells,
  } = params;

  const onFormulaInsertReferenceRef = useLatestRef(onFormulaInsertReference);
  const visibleColsRef = useLatestRef(visibleCols);
  const formulaColRef = useLatestRef(params.formulaCol);
  const formulaRowRef = useLatestRef(params.formulaRow);

  // Wrap onCellValueChanged with undo/redo tracking
  const undoRedo = useUndoRedo<T>({ onCellValueChanged: onCellValueChangedProp, formulaCells });
  const onCellValueChanged = undoRedo.onCellValueChanged;

  // Host-supplied undo/redo takes over from the internal stack.
  const onUndoPropRef = useLatestRef(onUndoProp);
  const onRedoPropRef = useLatestRef(onRedoProp);
  const hasHostUndo = onUndoProp != null;
  const hasHostRedo = onRedoProp != null;
  const internalUndo = undoRedo.undo;
  const internalRedo = undoRedo.redo;
  const undo = useCallback(
    () => (onUndoPropRef.current ?? internalUndo)(),
    [onUndoPropRef, internalUndo]
  );
  const redo = useCallback(
    () => (onRedoPropRef.current ?? internalRedo)(),
    [onRedoPropRef, internalRedo]
  );
  const canUndo = canUndoProp ?? (hasHostUndo ? true : undoRedo.canUndo);
  const canRedo = canRedoProp ?? (hasHostRedo ? true : undoRedo.canRedo);

  // Formula access for the clipboard, fill handle and editor, which address
  // cells by (flat column, display row): the row is mapped to the sheet row,
  // and writes are recorded for undo.
  const hasFormulaCells = formulaCells != null;
  const undoSetFormula = undoRedo.setFormula;
  const viewFormulas = useMemo(() => {
    if (!formulas) return undefined;
    const toRow = (row: number) => formulaRowRef.current?.(row) ?? row;
    const write = hasFormulaCells ? undoSetFormula : setFormula;
    return {
      getFormula: getFormula && ((col: number, row: number) => {
        const r = toRow(row);
        return r >= 0 ? getFormula(col, r) : undefined;
      }),
      hasFormula: hasFormula && ((col: number, row: number) => {
        const r = toRow(row);
        return r >= 0 && hasFormula(col, r);
      }),
      setFormula: write && ((col: number, row: number, formula: string | null) => {
        const r = toRow(row);
        if (r >= 0) write(col, r, formula);
      }),
    };
  }, [formulas, getFormula, hasFormula, setFormula, hasFormulaCells, undoSetFormula, formulaRowRef]);

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
    activeCell,
  });

  const { handleCopy, handleCut, handleCopyEvent, handleCutEvent, handlePaste, handlePasteEvent, cutRange, copyRange, clearClipboardRanges } = useClipboard({
    items,
    getRowId,
    onClipboardError,
    visibleCols,
    colOffset,
    selectionRange,
    activeCell,
    editable,
    onCellValueChanged,
    beginBatch: undoRedo.beginBatch,
    endBatch: undoRedo.endBatch,
    formulas,
    flatColumns,
    getFormula: viewFormulas?.getFormula,
    hasFormula: viewFormulas?.hasFormula,
    setFormula: viewFormulas?.setFormula,
  });

  const handleCellMouseDown = useCallback(
    (e: React.MouseEvent, rowIndex: number, globalColIndex: number) => {
      if (e.button !== 0) return;

      // When a formula is being edited in the formula bar, clicking a cell inserts
      // its reference (e.g. "A1") into the formula instead of navigating.
      const insertRef = onFormulaInsertReferenceRef.current;
      if (insertRef) {
        const dataColIndex = globalColIndex - colOffset;
        const col = visibleColsRef.current[dataColIndex];
        // The reference names the cell's sheet coordinates, not its place on screen.
        const sheetCol = col ? (formulaColRef.current?.(col.columnId) ?? dataColIndex) : -1;
        const sheetRow = formulaRowRef.current?.(rowIndex) ?? rowIndex;
        if (sheetCol >= 0 && sheetRow >= 0) {
          const ref = formatCellReference(sheetCol, sheetRow + 1);
          if (insertRef(ref)) {
            e.preventDefault();
            return; // Reference inserted  -  skip normal cell selection
          }
        }
      }

      (wrapperRef as RefObject<HTMLDivElement | null>).current?.focus({ preventScroll: true });
      // Clicking another cell keeps a pending cut/copy (Excel behavior), so
      // "cut, click the destination, paste" moves the cells. Escape clears it.
      handleCellMouseDownBase(e, rowIndex, globalColIndex);
    },
    [handleCellMouseDownBase, wrapperRef, onFormulaInsertReferenceRef, colOffset, visibleColsRef, formulaColRef, formulaRowRef]
  );

  const fillFormulaOptions = useMemo<IFillFormulaOptions<T> | undefined>(() => {
    if (!viewFormulas || !flatColumns) return undefined;
    const formulaRow = (row: number) => formulaRowRef.current?.(row) ?? row;
    return { flatColumns, ...viewFormulas, formulaRow };
  }, [viewFormulas, flatColumns, formulaRowRef]);

  const { handleFillHandleMouseDown, fillDown } = useFillHandleInternal({
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
    formulaOptions: fillFormulaOptions,
  });

  const { handleGridKeyDown, handleGridPaste, handleGridCopy, handleGridCut } = useKeyboardNavigation({
    data: { items, visibleCols, colOffset, hasCheckboxCol, visibleColumnCount, getRowId },
    state: { activeCell, selectionRange, editingCell, selectedRowIds },
    handlers: { setActiveCell, setSelectionRange, setEditingCell, handleRowCheckboxChange, handleCopyEvent, handleCutEvent, handlePasteEvent, setContextMenu: setContextMenuPosition, onUndo: undo, onRedo: redo, clearClipboardRanges, beginBatch: undoRedo.beginBatch, endBatch: undoRedo.endBatch },
    features: { editable, onCellValueChanged, rowSelection: rowSelection ?? 'none', wrapperRef, scrollToIndexRef, onKeyDown, fillDown },
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
    handleGridPaste: cellSelection ? handleGridPaste : (NOOP as typeof handleGridPaste),
    handleGridCopy: cellSelection ? handleGridCopy : (NOOP as typeof handleGridCopy),
    handleGridCut: cellSelection ? handleGridCut : (NOOP as typeof handleGridCut),
    handleFillHandleMouseDown: cellSelection ? handleFillHandleMouseDown : (NOOP as typeof handleFillHandleMouseDown),
    handleCopy: cellSelection ? handleCopy : NOOP,
    handleCut: cellSelection ? handleCut : NOOP,
    handlePaste: cellSelection ? handlePaste : (NOOP_ASYNC as typeof handlePaste),
    cutRange: cellSelection ? cutRange : null,
    copyRange: cellSelection ? copyRange : null,
    clearClipboardRanges: cellSelection ? clearClipboardRanges : NOOP,
    canUndo,
    canRedo,
    onUndo: undo,
    onRedo: redo,
    isDragging: cellSelection ? isDragging : false,
  }), [
    cellSelection, activeCell, setActiveCell, selectionRange, setSelectionRange,
    handleCellMouseDown, handleSelectAllCells, hasCellSelection, handleGridKeyDown, handleGridPaste, handleGridCopy, handleGridCut,
    handleFillHandleMouseDown, handleCopy, handleCut, handlePaste, cutRange, copyRange,
    clearClipboardRanges, canUndo, canRedo, undo, redo,
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
    canUndo,
    canRedo,
    setFormula: viewFormulas?.setFormula,
    hasFormula: viewFormulas?.hasFormula,
  };
}
