/**
 * Headless inline cell editor state for Fluent, Material, and Radix InlineCellEditor.
 * UI packages use this hook and render only the framework input (Input, TextField, select, Checkbox).
 */

import { useState, useCallback } from 'react';

export type InlineCellEditorType = 'text' | 'select' | 'checkbox';

export interface UseInlineCellEditorStateParams {
  value: unknown;
  editorType: InlineCellEditorType;
  onCommit: (value: unknown) => void;
  onCancel: () => void;
}

export interface UseInlineCellEditorStateResult {
  localValue: string;
  setLocalValue: (value: string) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  handleBlur: () => void;
  commit: (value: unknown) => void;
  cancel: () => void;
}

/**
 * Returns localValue/setLocalValue (for text), handleKeyDown (Escape cancel, Enter commit for text),
 * handleBlur (commit on blur for text), commit(value), cancel(). UI renders only the input.
 */
export function useInlineCellEditorState(
  params: UseInlineCellEditorStateParams
): UseInlineCellEditorStateResult {
  const { value, editorType, onCommit, onCancel } = params;
  const [localValue, setLocalValue] = useState<string>(
    value !== null && value !== undefined ? String(value) : ''
  );

  const commit = useCallback(
    (v: unknown) => {
      onCommit(v);
    },
    [onCommit]
  );

  const cancel = useCallback(() => {
    onCancel();
  }, [onCancel]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation(); // Don't let the grid handler clear selection on Escape
        cancel();
      }
      if (e.key === 'Enter' && editorType === 'text') {
        e.preventDefault();
        e.stopPropagation(); // Don't let the grid handler re-open an editor
        commit(localValue);
      }
    },
    [cancel, commit, localValue, editorType]
  );

  const handleBlur = useCallback(() => {
    if (editorType === 'text') {
      commit(localValue);
    }
  }, [editorType, localValue, commit]);

  return {
    localValue,
    setLocalValue,
    handleKeyDown,
    handleBlur,
    commit,
    cancel,
  };
}
