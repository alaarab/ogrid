/**
 * useFormulaBar — React hook for formula bar state.
 *
 * Manages the formula bar text, editing mode, and reference extraction.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { extractFormulaReferences, processFormulaBarCommit, deriveFormulaBarText, type FormulaReference } from '@alaarab/ogrid-core';

export interface UseFormulaBarParams {
  /** Active cell column index (0-based). */
  activeCol: number | null;
  /** Active cell row index (0-based). */
  activeRow: number | null;
  /** Active cell reference string (e.g. "A1"). */
  activeCellRef: string | null;
  /** Get formula string for a cell. */
  getFormula?: (col: number, row: number) => string | undefined;
  /** Get raw display value for a cell. */
  getRawValue?: (col: number, row: number) => unknown;
  /** Set formula for a cell. */
  setFormula?: (col: number, row: number, formula: string | null) => void;
  /** Commit a non-formula value change. */
  onCellValueChanged?: (col: number, row: number, value: unknown) => void;
}

export interface UseFormulaBarResult {
  /** Cell reference string (e.g. "A1"). */
  cellRef: string | null;
  /** Text shown in the formula bar input. */
  formulaText: string;
  /** Whether the formula bar input is being edited. */
  isEditing: boolean;
  /** Update the formula bar input text. */
  onInputChange: (text: string) => void;
  /** Commit the current edit. */
  onCommit: () => void;
  /** Cancel the current edit. */
  onCancel: () => void;
  /** Start editing the formula bar. */
  startEditing: () => void;
  /** References extracted from the current formula text (for highlighting). */
  referencedCells: FormulaReference[];
  /** Whether the formula bar is actively being edited (for click-to-insert-ref guards). */
  isFormulaBarEditing: React.MutableRefObject<boolean>;
}

export function useFormulaBar(params: UseFormulaBarParams): UseFormulaBarResult {
  const { activeCol, activeRow, activeCellRef, getFormula, getRawValue, setFormula, onCellValueChanged } = params;

  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const isFormulaBarEditing = useRef(false);

  // Derive display text from active cell
  const displayText = useMemo(
    () => deriveFormulaBarText(activeCol, activeRow, getFormula, getRawValue),
    [activeCol, activeRow, getFormula, getRawValue],
  );

  // Reset editing when active cell changes
  useEffect(() => {
    setIsEditing(false);
    isFormulaBarEditing.current = false;
  }, [activeCol, activeRow]);

  const startEditing = useCallback(() => {
    setEditText(displayText);
    setIsEditing(true);
    isFormulaBarEditing.current = true;
  }, [displayText]);

  const onInputChange = useCallback((text: string) => {
    setEditText(text);
  }, []);

  const onCommit = useCallback(() => {
    if (activeCol == null || activeRow == null || !setFormula) return;
    processFormulaBarCommit(editText, activeCol, activeRow, setFormula, onCellValueChanged);
    setIsEditing(false);
    isFormulaBarEditing.current = false;
  }, [activeCol, activeRow, editText, setFormula, onCellValueChanged]);

  const onCancel = useCallback(() => {
    setIsEditing(false);
    isFormulaBarEditing.current = false;
    setEditText('');
  }, []);

  // Extract references from current text (for highlighting)
  const currentText = isEditing ? editText : displayText;
  const referencedCells = useMemo(
    () => extractFormulaReferences(currentText),
    [currentText]
  );

  return {
    cellRef: activeCellRef,
    formulaText: isEditing ? editText : displayText,
    isEditing,
    onInputChange,
    onCommit,
    onCancel,
    startEditing,
    referencedCells,
    isFormulaBarEditing,
  };
}
