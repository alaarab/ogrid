/**
 * Headless inline cell editor state for Fluent, Material, and Radix InlineCellEditor.
 * UI packages use this hook and render only the framework input (Input, TextField, select, Checkbox).
 */

import { useState, useCallback } from 'react';

export type InlineCellEditorType = 'text' | 'select' | 'checkbox' | 'richSelect' | 'date';

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
  const [localValue, setLocalValue] = useState<string>(() => {
    if (value === null || value === undefined) return '';
    if (editorType === 'date') {
      const str = String(value);
      // Extract YYYY-MM-DD so <input type="date"> recognises the value
      return str.match(/^\d{4}-\d{2}-\d{2}/) ? str.substring(0, 10) : str;
    }
    return String(value);
  });

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation(); // Don't let the grid handler clear selection on Escape
        onCancel();
      }
      if (e.key === 'Enter' && (editorType === 'text' || editorType === 'date')) {
        e.preventDefault();
        e.stopPropagation(); // Don't let the grid handler re-open an editor
        onCommit(localValue);
      }
    },
    [onCancel, onCommit, localValue, editorType]
  );

  const handleBlur = useCallback(() => {
    if (editorType === 'text' || editorType === 'date') {
      onCommit(localValue);
    }
  }, [editorType, localValue, onCommit]);

  return {
    localValue,
    setLocalValue,
    handleKeyDown,
    handleBlur,
    commit: onCommit,
    cancel: onCancel,
  };
}
