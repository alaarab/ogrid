import { useMemo, useCallback } from 'react';
import type { RefObject } from 'react';
import type { RowId, IColumnDef, ICellValueChangedEvent } from '../types';
import type { IFillFormulaOptions } from '../utils';
import type { ScrollToRowIndex } from '../utils/scrollCellIntoView';
import { formatCellReference, getCellValue, expandRangeToMerges, isCoveredCell } from '../utils';
import type { IMergeLayout } from '../utils';
import type { ISelectionRange } from '../types';
import { applyPastedValues, moveCellRange, normalizeSelectionRange, parseTsvClipboard } from '@alaarab/ogrid-core';
import { useCellSelection } from './useCellSelection';
import { useClipboard } from './useClipboard';
import { useKeyboardNavigation } from './useKeyboardNavigation';
import { useFillHandleInternal } from './useFillHandleInternal';
import { useUndoRedo } from './useUndoRedo';
import type { UseUndoRedoFormulaCells, UndoableAction } from './useUndoRedo';
import { useLatestRef } from './useLatestRef';
import { cellFocusOptions } from './useGridCellFocus';
import { resolveUndoAvailability, usesHostFormulaHistory } from './undoRouting';
import type { DataGridCellInteractionState } from './useDataGridState';

// Stable no-op handlers used when cellSelection is disabled (module-scope = no re-renders)
const NOOP = () => {};
const NOOP_ASYNC = async () => {};
const NOOP_MOUSE = (_e: React.MouseEvent, _r: number, _c: number) => {};
const NOOP_KEY = (_e: React.KeyboardEvent) => {};
const NOOP_MOVE_RANGE = (_row: number, _col: number, _copy: boolean) => {};

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
  /** From useCellEditing: seeds the editor a typed character opens (type-to-replace). */
  setPendingEditorValue?: (value: unknown) => void;
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
  /** Optional row reorder shortcut, routed through keyboard isolation/interception. */
  onRowReorderKeyDown?: (event: React.KeyboardEvent) => boolean;
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
  /** Computed value of a formula cell (flat column + sheet row), for "paste values only". */
  getFormulaValue?: (col: number, row: number) => unknown;
  /** Called when a cell is clicked during formula editing to insert a cell reference. */
  onFormulaInsertReference?: (reference: string) => boolean;
  /** Formula engine column of a column id (flat index), or -1. Defaults to the flat column lookup. */
  formulaCol?: (columnId: string) => number;
  /** Formula engine (sheet) row of a displayed row, or -1. Defaults to the display row. */
  formulaRow?: (rowIndex: number) => number;
  /** Formula hooks for the undo history (engine coordinates). */
  formulaCells?: UseUndoRedoFormulaCells<T>;
  /** Merged cells in the current view: selection grows to whole merges, copy/paste and keys treat each as one cell. */
  mergeLayout?: IMergeLayout | null;
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
  /**
   * Set or clear a formula by (flat column, sheet row), recorded for undo like
   * an edit. `displayRow` is the displayed row (-1 when it is not displayed).
   */
  writeSheetFormula?: (col: number, sheetRow: number, formula: string | null, displayRow: number) => void;
  /** Group the following changes into one undo step until endBatch(). */
  beginBatch: () => void;
  endBatch: () => void;
  /**
   * Record an already-applied change (structure edit) in the grid's undo
   * history. No-op when the host owns undo (`onUndo`), whose history the grid can't write to.
   */
  recordAction: (action: UndoableAction) => void;
  /** Formula of a cell by (flat column, display row). Undefined when formulas are off. */
  getFormula?: (col: number, row: number) => string | undefined;
}

/**
 * Pointer down on a cell: bring focus into the grid before the active cell
 * changes. A cell that already holds focus keeps it, and the clicked cell takes
 * it when it is already the tab stop (no re-render follows to move it there);
 * otherwise the wrapper holds focus until useGridCellFocus moves it to the new
 * active cell after the render.
 */
function focusGridForPointer(wrapper: HTMLElement | null, e: React.MouseEvent): void {
  if (!wrapper) return;
  const focused = document.activeElement;
  if (focused && focused.tagName === 'TD' && focused.hasAttribute('tabindex') && wrapper.contains(focused)) return;
  const cell = (e.currentTarget as Element | null)?.closest?.('td');
  if (!e.shiftKey && cell instanceof HTMLElement && cell.tabIndex === 0 && wrapper.contains(cell)) {
    cell.focus(cellFocusOptions(true));
    return;
  }
  wrapper.focus(cellFocusOptions(true));
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
    getFormulaValue,
    onFormulaInsertReference,
    formulaCells,
  } = params;

  const onFormulaInsertReferenceRef = useLatestRef(onFormulaInsertReference);
  const mergeLayout = params.mergeLayout ?? null;
  const mergeLayoutRef = useLatestRef(mergeLayout);
  const expandRange = useCallback(
    (range: ISelectionRange) => expandRangeToMerges(range, mergeLayoutRef.current),
    [mergeLayoutRef]
  );
  const isCoveredMergeCell = useCallback(
    (row: number, col: number) => isCoveredCell(mergeLayoutRef.current, row, col),
    [mergeLayoutRef]
  );
  const visibleColsRef = useLatestRef(visibleCols);
  const formulaColRef = useLatestRef(params.formulaCol);
  const formulaRowRef = useLatestRef(params.formulaRow);

  // Host-supplied undo/redo takes over from the internal stack.
  const onUndoPropRef = useLatestRef(onUndoProp);
  const onRedoPropRef = useLatestRef(onRedoProp);
  const hasHostUndo = onUndoProp != null;
  const hasHostRedo = onRedoProp != null;

  // With host-owned undo the host's history is the only one, so formula
  // changes must reach it too: every formula write is emitted as a value
  // change whose value is the formula text, and a value written over a formula
  // reports the formula as its old value. Undoing then writes the formula text
  // back into the host's data, and the engine (OGrid's formulasFromData)
  // follows the data. The internal stack records nothing in this mode.
  const hostFormulaHistory = usesHostFormulaHistory(hasHostUndo, formulaCells != null);

  // Wrap onCellValueChanged with undo/redo tracking
  const undoRedo = useUndoRedo<T>({
    onCellValueChanged: hostFormulaHistory ? undefined : onCellValueChangedProp,
    formulaCells: hostFormulaHistory ? undefined : formulaCells,
  });
  const onCellValueChangedPropRef = useLatestRef(onCellValueChangedProp);
  const formulaCellsRef = useLatestRef(formulaCells);
  const hasCellValueChangedProp = onCellValueChangedProp != null;
  const hostValueChanged = useMemo(() => {
    if (!hostFormulaHistory || !hasCellValueChangedProp) return undefined;
    return (event: ICellValueChangedEvent<T>) => {
      const fc = formulaCellsRef.current;
      const cell = fc?.cellOf(event) ?? null;
      const oldFormula = cell ? fc?.getFormula(cell.col, cell.row) : undefined;
      if (cell && oldFormula !== undefined) fc?.setFormula(cell.col, cell.row, null);
      onCellValueChangedPropRef.current?.(oldFormula !== undefined ? { ...event, oldValue: oldFormula } : event);
      if (cell) fc?.onCellChanged?.(cell.col, cell.row);
    };
  }, [hostFormulaHistory, hasCellValueChangedProp, formulaCellsRef, onCellValueChangedPropRef]);
  const onCellValueChanged = hostValueChanged ?? undoRedo.onCellValueChanged;
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
  const canUndo = resolveUndoAvailability(canUndoProp, hasHostUndo, undoRedo.canUndo);
  const canRedo = resolveUndoAvailability(canRedoProp, hasHostRedo, undoRedo.canRedo);

  // Formula access for the clipboard, fill handle and editor, which address
  // cells by (flat column, display row): the row is mapped to the sheet row,
  // and writes are recorded for undo.
  const hasFormulaCells = formulaCells != null;
  const undoSetFormula = undoRedo.setFormula;
  const itemsRef = useLatestRef(items);
  const flatColumnsRef = useLatestRef(flatColumns);
  // Host-owned history: write the formula and emit it as a value change (see above).
  const hostSetFormula = useCallback((col: number, row: number, formula: string | null, displayRow: number) => {
    const fc = formulaCellsRef.current;
    if (!fc) return;
    const oldFormula = fc.getFormula(col, row) || null;
    const newFormula = formula || null;
    if (oldFormula === newFormula) return;
    const item = itemsRef.current[displayRow];
    const colDef = flatColumnsRef.current?.[col];
    if (item === undefined || !colDef) return;
    const raw = getCellValue<T>(item, colDef);
    // Clearing a formula leaves the cell's plain value (never stale formula text).
    const plain = typeof raw === 'string' && raw.startsWith('=') ? '' : raw;
    onCellValueChangedPropRef.current?.({
      item,
      columnId: colDef.columnId,
      rowIndex: displayRow,
      oldValue: oldFormula ?? plain,
      newValue: newFormula ?? plain,
    });
    // Let the host invalidate its previous output before publishing the new
    // formula's result; document edits and their cache snapshots stay atomic.
    fc.setFormula(col, row, newFormula);
  }, [formulaCellsRef, itemsRef, flatColumnsRef, onCellValueChangedPropRef]);
  const writeSheetFormula = useMemo(() => {
    if (!formulas) return undefined;
    return hostFormulaHistory
      ? hostSetFormula
      : hasFormulaCells ? (col: number, r: number, formula: string | null) => undoSetFormula(col, r, formula)
      : setFormula ? (col: number, r: number, formula: string | null) => setFormula(col, r, formula)
      : undefined;
  }, [formulas, hostFormulaHistory, hostSetFormula, hasFormulaCells, undoSetFormula, setFormula]);
  const internalRecordAction = undoRedo.recordAction;
  const recordAction = useCallback(
    (action: UndoableAction) => {
      if (!hasHostUndo) internalRecordAction(action);
    },
    [hasHostUndo, internalRecordAction]
  );
  const viewFormulas = useMemo(() => {
    if (!formulas) return undefined;
    const toRow = (row: number) => formulaRowRef.current?.(row) ?? row;
    const write = hostFormulaHistory
      ? (col: number, r: number, formula: string | null, displayRow: number) => hostSetFormula(col, r, formula, displayRow)
      : hasFormulaCells ? undoSetFormula : setFormula;
    return {
      getFormula: getFormula && ((col: number, row: number) => {
        const r = toRow(row);
        return r >= 0 ? getFormula(col, r) : undefined;
      }),
      hasFormula: hasFormula && ((col: number, row: number) => {
        const r = toRow(row);
        return r >= 0 && hasFormula(col, r);
      }),
      getFormulaValue: getFormulaValue && ((col: number, row: number) => {
        const r = toRow(row);
        return r >= 0 ? getFormulaValue(col, r) : undefined;
      }),
      setFormula: write && ((col: number, row: number, formula: string | null) => {
        const r = toRow(row);
        if (r >= 0) write(col, r, formula, row);
      }),
    };
  }, [formulas, getFormula, hasFormula, getFormulaValue, setFormula, hasFormulaCells, undoSetFormula, formulaRowRef, hostFormulaHistory, hostSetFormula]);

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
    expandRange,
  });

  const formulaRowForClipboard = useCallback((row: number) => formulaRowRef.current?.(row) ?? row, [formulaRowRef]);
  const {
    handleCopy, handleCut, handleCopyEvent, handleCutEvent, handlePaste, handlePasteEvent,
    handlePasteValues: handlePasteValuesAsync, armPasteValues, cutRange, copyRange, clearClipboardRanges,
  } = useClipboard({
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
    getFormulaValue: viewFormulas?.getFormulaValue,
    formulaRow: formulaRowForClipboard,
    isCoveredCell: isCoveredMergeCell,
  });
  const handlePasteValues = useCallback(() => { void handlePasteValuesAsync(); }, [handlePasteValuesAsync]);

  // ── Drag-and-drop edit routing ──────────────────────────────────────────
  // Range move and default cell drop produce the same `ICellValueChangedEvent`s
  // as cut/paste, so they reuse valueParser, formula shifting and undo here.
  const flatColIndexById = useMemo(
    () => (flatColumns ? new Map(flatColumns.map((c, i) => [c.columnId, i] as const)) : null),
    [flatColumns],
  );
  const moveFormulaOptions = useMemo(() => {
    if (!viewFormulas || !flatColumns) return undefined;
    return {
      colOffset,
      flatColumns,
      getFormula: viewFormulas.getFormula,
      hasFormula: viewFormulas.hasFormula,
      setFormula: viewFormulas.setFormula,
      formulaRow: (row: number) => formulaRowRef.current?.(row) ?? row,
    };
  }, [viewFormulas, flatColumns, colOffset, formulaRowRef]);
  const moveFormulaSource = useMemo(() => {
    if (!moveFormulaOptions || !selectionRange || !flatColIndexById) return undefined;
    const norm = normalizeSelectionRange(selectionRange);
    const sheetRows: number[] = [];
    const flatCols: number[] = [];
    for (let r = norm.startRow; r <= norm.endRow; r++) sheetRows.push(moveFormulaOptions.formulaRow(r));
    for (let c = norm.startCol; c <= norm.endCol; c++) {
      const col = visibleCols[c];
      flatCols.push(col ? (flatColIndexById.get(col.columnId) ?? -1) : -1);
    }
    return { sheetRows, flatCols };
  }, [moveFormulaOptions, selectionRange, visibleCols, flatColIndexById]);

  const applyDragEdits = useCallback(
    (generate: () => ICellValueChangedEvent<T>[]) => {
      if (!editable) return;
      undoRedo.beginBatch();
      try {
        // Generation may write formulas; those and all value changes share
        // one history entry even if a parser or consumer callback throws.
        for (const event of generate()) onCellValueChanged?.(event);
      } finally {
        undoRedo.endBatch();
      }
    },
    [editable, onCellValueChanged, undoRedo.beginBatch, undoRedo.endBatch],
  );

  const moveRangeTo = useCallback(
    (targetRow: number, targetCol: number, copy: boolean) => {
      if (!selectionRange) return;
      applyDragEdits(() => moveCellRange({
        items, visibleCols, source: selectionRange, targetRow, targetCol, copy,
        formulaOptions: moveFormulaOptions, formulaSource: moveFormulaSource,
        isCoveredCell: isCoveredMergeCell,
      }));
    },
    [selectionRange, items, visibleCols, moveFormulaOptions, moveFormulaSource, isCoveredMergeCell, applyDragEdits],
  );

  const dropTextAt = useCallback(
    (rowIndex: number, colIndex: number, text: string) => {
      applyDragEdits(() => applyPastedValues(
        parseTsvClipboard(text), rowIndex, colIndex, items, visibleCols,
        moveFormulaOptions && {
          colOffset: moveFormulaOptions.colOffset,
          flatColumns: moveFormulaOptions.flatColumns,
          setFormula: moveFormulaOptions.setFormula,
          formulaRow: moveFormulaOptions.formulaRow,
        },
        isCoveredMergeCell,
      ));
    },
    [items, visibleCols, moveFormulaOptions, isCoveredMergeCell, applyDragEdits],
  );

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

      focusGridForPointer(wrapperRef.current, e);
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

  const { handleFillHandleMouseDown, handleFillHandleDoubleClick, fillDown, fillRight } = useFillHandleInternal({
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
    isCoveredCell: isCoveredMergeCell,
  });

  const { handleGridKeyDown, handleGridPaste, handleGridCopy, handleGridCut } = useKeyboardNavigation({
    data: { items, visibleCols, colOffset, hasCheckboxCol, visibleColumnCount, getRowId, mergeLayout },
    state: { activeCell, selectionRange, editingCell, selectedRowIds },
    handlers: { setActiveCell, setSelectionRange, setEditingCell, handleRowCheckboxChange, handleCopyEvent, handleCutEvent, handlePasteEvent, armPasteValues, setContextMenu: setContextMenuPosition, onUndo: undo, onRedo: redo, clearClipboardRanges, beginBatch: undoRedo.beginBatch, endBatch: undoRedo.endBatch, setPendingEditorValue: params.setPendingEditorValue },
    features: { editable, onCellValueChanged, rowSelection: rowSelection ?? 'none', wrapperRef, scrollToIndexRef, onKeyDown, onRowReorderKeyDown: params.onRowReorderKeyDown, fillDown, fillRight },
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
    handleFillHandleDoubleClick: cellSelection ? handleFillHandleDoubleClick : (NOOP as typeof handleFillHandleDoubleClick),
    handlePasteValues: cellSelection ? handlePasteValues : NOOP,
    handleCopy: cellSelection ? handleCopy : NOOP,
    handleCut: cellSelection ? handleCut : NOOP,
    handlePaste: cellSelection ? handlePaste : (NOOP_ASYNC as typeof handlePaste),
    cutRange: cellSelection ? cutRange : null,
    copyRange: cellSelection ? copyRange : null,
    clearClipboardRanges: cellSelection ? clearClipboardRanges : NOOP,
    moveRangeTo: cellSelection ? moveRangeTo : (NOOP_MOVE_RANGE as typeof moveRangeTo),
    dropTextAt,
    canUndo,
    canRedo,
    onUndo: undo,
    onRedo: redo,
    isDragging: cellSelection ? isDragging : false,
  }), [
    cellSelection, activeCell, setActiveCell, selectionRange, setSelectionRange,
    handleCellMouseDown, handleSelectAllCells, hasCellSelection, handleGridKeyDown, handleGridPaste, handleGridCopy, handleGridCut,
    handleFillHandleMouseDown, handleFillHandleDoubleClick, handlePasteValues, handleCopy, handleCut, handlePaste, cutRange, copyRange,
    clearClipboardRanges, moveRangeTo, dropTextAt, canUndo, canRedo, undo, redo,
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
    writeSheetFormula,
    beginBatch: undoRedo.beginBatch,
    endBatch: undoRedo.endBatch,
    recordAction,
    getFormula: viewFormulas?.getFormula,
  };
}
