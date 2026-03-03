/**
 * useFormulaBar  -  Vue composable for formula bar state.
 *
 * Manages the formula bar text, editing mode, and reference extraction.
 */

import { ref, computed, watch, type Ref } from 'vue';
import { extractFormulaReferences, processFormulaBarCommit, deriveFormulaBarText, type FormulaReference } from '@alaarab/ogrid-core/formula';

export interface UseFormulaBarParams {
  /** Active cell column index (0-based). */
  activeCol: Ref<number | null>;
  /** Active cell row index (0-based). */
  activeRow: Ref<number | null>;
  /** Active cell reference string (e.g. "A1"). */
  activeCellRef: Ref<string | null>;
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
  cellRef: Ref<string | null>;
  /** Text shown in the formula bar input. */
  formulaText: Ref<string>;
  /** Whether the formula bar input is being edited. */
  isEditing: Ref<boolean>;
  /** Update the formula bar input text. */
  onInputChange: (text: string) => void;
  /** Commit the current edit. */
  onCommit: () => void;
  /** Cancel the current edit. */
  onCancel: () => void;
  /** Start editing the formula bar. */
  startEditing: () => void;
  /** References extracted from the current formula text (for highlighting). */
  referencedCells: Ref<FormulaReference[]>;
  /** Whether the formula bar is actively being edited (for click-to-insert-ref guards). */
  isFormulaBarEditing: Ref<boolean>;
}

export function useFormulaBar(params: UseFormulaBarParams): UseFormulaBarResult {
  const { activeCol, activeRow, activeCellRef, getFormula, getRawValue, setFormula, onCellValueChanged } = params;

  const isEditing = ref(false);
  const editText = ref('');
  const isFormulaBarEditing = ref(false);

  // Derive display text from active cell
  const displayText = computed(() =>
    deriveFormulaBarText(activeCol.value, activeRow.value, getFormula, getRawValue),
  );

  // Reset editing when active cell changes
  watch([activeCol, activeRow], () => {
    isEditing.value = false;
    isFormulaBarEditing.value = false;
  });

  const startEditing = () => {
    editText.value = displayText.value;
    isEditing.value = true;
    isFormulaBarEditing.value = true;
  };

  const onInputChange = (text: string) => {
    editText.value = text;
  };

  const onCommit = () => {
    const col = activeCol.value;
    const row = activeRow.value;
    if (col == null || row == null || !setFormula) return;
    processFormulaBarCommit(editText.value, col, row, setFormula, onCellValueChanged);
    isEditing.value = false;
    isFormulaBarEditing.value = false;
  };

  const onCancel = () => {
    isEditing.value = false;
    isFormulaBarEditing.value = false;
    editText.value = '';
  };

  // The text currently shown (edit text when editing, display text otherwise)
  const formulaText = computed(() => isEditing.value ? editText.value : displayText.value);

  // Extract references from current text (for highlighting)
  const referencedCells = computed(() => extractFormulaReferences(formulaText.value));

  return {
    cellRef: activeCellRef,
    formulaText,
    isEditing,
    onInputChange,
    onCommit,
    onCancel,
    startEditing,
    referencedCells,
    isFormulaBarEditing,
  };
}
