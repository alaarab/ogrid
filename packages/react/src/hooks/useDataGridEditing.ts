import { useMemo, useCallback, useState, useEffect } from 'react';
import type { ICellEditCommitOptions } from '@alaarab/ogrid-core';
import { parseValue } from '../utils';
import type { RowId, IColumnDef } from '../types';
import { useLatestRef } from './useLatestRef';
import type { DataGridEditingState } from './useDataGridState';

export interface UseDataGridEditingParams<T> {
  editingCell: { rowId: RowId; columnId: string } | null;
  setEditingCell: (cell: { rowId: RowId; columnId: string } | null) => void;
  pendingEditorValue: unknown;
  setPendingEditorValue: (value: unknown) => void;
  visibleCols: IColumnDef<T>[];
  itemsLength: number;
  onCellValueChanged?: (event: {
    item: T;
    columnId: string;
    oldValue: unknown;
    newValue: unknown;
    rowIndex: number;
  }) => void;
  setActiveCell: (cell: { rowIndex: number; columnIndex: number } | null) => void;
  setSelectionRange: (range: { startRow: number; startCol: number; endRow: number; endCol: number } | null) => void;
  colOffset: number;
  /** Formula integration: set a formula for a cell (flat column index, display row). */
  setFormula?: (col: number, row: number, formula: string | null) => void;
  /** Formula integration: notify a non-formula cell changed. */
  onFormulaCellChanged?: (col: number, row: number) => void;
  /** Whether formula support is enabled. */
  formulas?: boolean;
  /** Formula presence at a flat column and display row. */
  hasFormula?: (col: number, row: number) => boolean;
  /** All flat columns (for mapping columnId  to  column index). */
  flatColumns?: IColumnDef<T>[];
  /** Row the active cell moves to after an Enter commit (default rowIndex + 1). */
  rowBelow?: (rowIndex: number, dataColIndex: number) => number;
  /** Row the active cell moves to after a Shift+Enter commit (default rowIndex - 1). */
  rowAbove?: (rowIndex: number, dataColIndex: number) => number;
  /**
   * Next cell inside the current multi-cell selection after an Enter /
   * Shift+Enter commit, or null when the cell isn't inside one. The selection
   * is kept (Excel).
   */
  stepInSelection?: (rowIndex: number, dataColIndex: number, move: 'down' | 'up') => { rowIndex: number; dataColIndex: number } | null;
}

export interface UseDataGridEditingResult<T> {
  editing: DataGridEditingState<T>;
}

/**
 * True when committing `newValue` would not change the cell: identical values,
 * an empty cell left empty (undefined/null -> '' or null), or, for untyped
 * columns only, the text editor's string form of an unchanged primitive
 * (5 -> '5'). Typed columns or columns with a valueParser still commit
 * '5' over 5, since that may be a deliberate coercion.
 */
function isUnchangedEdit(newValue: unknown, oldValue: unknown, untyped: boolean): boolean {
  if (Object.is(newValue, oldValue)) return true;
  if (oldValue == null) return newValue == null || newValue === '';
  if (!untyped || typeof newValue !== 'string') return false;
  return (typeof oldValue === 'number' || typeof oldValue === 'boolean') && String(oldValue) === newValue;
}

/**
 * Manages cell editing commit/cancel logic and popover editor state.
 * Extracted from useDataGridState for modularity.
 *
 * The editingCell/setEditingCell/pendingEditorValue/setPendingEditorValue are
 * passed in from useCellEditing() (called at the orchestrator level) to avoid
 * circular dependencies with useDataGridInteraction.
 */
export function useDataGridEditing<T>(
  params: UseDataGridEditingParams<T>
): UseDataGridEditingResult<T> {
  const {
    editingCell,
    setEditingCell,
    pendingEditorValue,
    setPendingEditorValue,
    onCellValueChanged,
    setActiveCell,
    setSelectionRange,
    colOffset,
    setFormula,
    onFormulaCellChanged,
    formulas,
    flatColumns,
  } = params;

  const [popoverAnchorEl, setPopoverAnchorEl] = useState<HTMLElement | null>(null);

  const visibleColsRef = useLatestRef(params.visibleCols);
  const itemsLengthRef = useLatestRef(params.itemsLength);
  const onCellValueChangedRef = useLatestRef(onCellValueChanged);
  const hasFormulaRef = useLatestRef(params.hasFormula);
  const setFormulaRef = useLatestRef(setFormula);
  const onFormulaCellChangedRef = useLatestRef(onFormulaCellChanged);
  const flatColumnsRef = useLatestRef(flatColumns);

  const rowBelowRef = useLatestRef(params.rowBelow);
  const rowAboveRef = useLatestRef(params.rowAbove);
  const stepInSelectionRef = useLatestRef(params.stepInSelection);
  // Enter-commit moves to the cell below (below the whole block for a merged
  // cell), Shift+Enter to the cell above; inside a multi-cell selection both
  // step through the selection and keep it.
  const advance = useCallback((rowIndex: number, globalColIndex: number, move: 'down' | 'up' = 'down') => {
    const localCol = globalColIndex - colOffset;
    const inRange = stepInSelectionRef.current?.(rowIndex, localCol, move);
    if (inRange) {
      setActiveCell({ rowIndex: inRange.rowIndex, columnIndex: inRange.dataColIndex + colOffset });
      return;
    }
    let newRow: number;
    if (move === 'up') {
      newRow = rowAboveRef.current ? rowAboveRef.current(rowIndex, localCol) : rowIndex - 1;
      if (newRow >= rowIndex || newRow < 0) return;
    } else {
      newRow = rowBelowRef.current ? rowBelowRef.current(rowIndex, localCol) : rowIndex + 1;
      if (newRow <= rowIndex || newRow > itemsLengthRef.current - 1) return;
    }
    setActiveCell({ rowIndex: newRow, columnIndex: globalColIndex });
    setSelectionRange({ startRow: newRow, startCol: localCol, endRow: newRow, endCol: localCol });
  }, [colOffset, rowBelowRef, rowAboveRef, stepInSelectionRef, itemsLengthRef, setActiveCell, setSelectionRange]);

  // Type-to-replace seeds the editor through pendingEditorValue; clear it once
  // no cell is being edited so the next F2/Enter opens with the cell's value.
  useEffect(() => {
    if (editingCell == null) setPendingEditorValue(undefined);
  }, [editingCell, setPendingEditorValue]);

  const commitCellEdit = useCallback(
    (
      item: T,
      columnId: string,
      oldValue: unknown,
      newValue: unknown,
      rowIndex: number,
      globalColIndex: number,
      options?: ICellEditCommitOptions
    ) => {
      // --- Formula detection ---
      if (formulas && typeof newValue === 'string' && newValue.startsWith('=') && setFormulaRef.current) {
        // Find column index in flat columns array
        const cols = flatColumnsRef.current;
        const colIndex = cols ? cols.findIndex((c) => c.columnId === columnId) : -1;
        if (colIndex >= 0) {
          setFormulaRef.current(colIndex, rowIndex, newValue);
          setEditingCell(null);
          setPopoverAnchorEl(null);
          setPendingEditorValue(undefined);
          // Advance to next row
          if (!options?.skipAdvance) advance(rowIndex, globalColIndex, options?.move);
          return;
        }
      }

      // --- Normal (non-formula) value commit ---
      // Validate via valueParser before committing
      const col = visibleColsRef.current.find((c) => c.columnId === columnId);
      if (col) {
        const result = parseValue(newValue, oldValue, item, col);
        if (!result.valid) {
          // Reject -- cancel the edit
          setEditingCell(null);
          setPopoverAnchorEl(null);
          setPendingEditorValue(undefined);
          return;
        }
        newValue = result.value;
      }

      // Unchanged value: close the editor without an edit event or undo entry.
      const formulaCol = flatColumnsRef.current?.findIndex((c) => c.columnId === columnId) ?? -1;
      const replacesFormula = formulas && formulaCol >= 0 && hasFormulaRef.current?.(formulaCol, rowIndex);
      if (!replacesFormula && isUnchangedEdit(newValue, oldValue, !col || (col.type == null && col.valueParser == null))) {
        setEditingCell(null);
        setPopoverAnchorEl(null);
        setPendingEditorValue(undefined);
        if (!options?.skipAdvance) advance(rowIndex, globalColIndex, options?.move);
        return;
      }

      onCellValueChangedRef.current?.({
        item,
        columnId,
        oldValue,
        newValue,
        rowIndex,
      });

      // Notify formula engine that a non-formula cell changed (for dependency cascade)
      if (formulas && onFormulaCellChangedRef.current && flatColumnsRef.current) {
        const colIndex = flatColumnsRef.current.findIndex((c) => c.columnId === columnId);
        if (colIndex >= 0) {
          onFormulaCellChangedRef.current(colIndex, rowIndex);
        }
      }

      setEditingCell(null);
      setPopoverAnchorEl(null);
      setPendingEditorValue(undefined);
      // Advance to next row for inline editors (skip for checkbox — toggling shouldn't move selection)
      if (!options?.skipAdvance) advance(rowIndex, globalColIndex, options?.move);
    },
    [formulas, setEditingCell, setPendingEditorValue, advance, visibleColsRef, onCellValueChangedRef, setFormulaRef, onFormulaCellChangedRef, flatColumnsRef, hasFormulaRef]
  );

  const cancelPopoverEdit = useCallback(() => {
    setEditingCell(null);
    setPopoverAnchorEl(null);
    setPendingEditorValue(undefined);
  }, [setEditingCell, setPendingEditorValue]);

  const editingState = useMemo<DataGridEditingState<T>>(() => ({
    editingCell, setEditingCell, pendingEditorValue, setPendingEditorValue,
    commitCellEdit, cancelPopoverEdit, popoverAnchorEl, setPopoverAnchorEl,
  }), [editingCell, setEditingCell, pendingEditorValue, setPendingEditorValue, commitCellEdit, cancelPopoverEdit, popoverAnchorEl]);

  return { editing: editingState };
}
