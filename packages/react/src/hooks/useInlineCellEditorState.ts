/**
 * Headless inline cell editor state for Fluent, Material, and Radix InlineCellEditor.
 * UI packages use this hook and render only the framework input (Input, TextField, select, Checkbox).
 */

import { useState, useCallback } from 'react';
import { formatDateForDisplay, parseUserInputDate, DEFAULT_DATE_FORMAT } from '@alaarab/ogrid-core';

export type InlineCellEditorType = 'text' | 'select' | 'checkbox' | 'richSelect' | 'date';

export interface UseInlineCellEditorStateParams {
  value: unknown;
  editorType: InlineCellEditorType;
  onCommit: (value: unknown) => void;
  onCancel: () => void;
  /** Date display/input format (e.g. 'MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'). */
  dateFormat?: string;
  /** Editor widget type: 'text' (default, Excel-style) or 'native' (browser <input type="date">). */
  dateEditorType?: 'text' | 'native';
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
 * Convert a parsed Date back to a YYYY-MM-DD string for storage.
 * When the user clears the field, returns an empty string.
 * When the date is invalid/null, returns the raw input string (caller decides).
 */
function commitDateValue(localValue: string, dateFormat: string): string {
  if (localValue === '') return '';
  const parsed = parseUserInputDate(localValue, dateFormat);
  if (parsed === null) {
    // Invalid input: return the raw string so the caller can decide
    return localValue;
  }
  // Store as YYYY-MM-DD (ISO date without time component)
  return parsed.toISOString().substring(0, 10);
}

/**
 * Returns localValue/setLocalValue (for text), handleKeyDown (Escape cancel, Enter commit for text),
 * handleBlur (commit on blur for text), commit(value), cancel(). UI renders only the input.
 */
export function useInlineCellEditorState(
  params: UseInlineCellEditorStateParams
): UseInlineCellEditorStateResult {
  const { value, editorType, onCommit, onCancel, dateFormat, dateEditorType } = params;
  const effectiveDateFormat = dateFormat ?? DEFAULT_DATE_FORMAT;

  const [localValue, setLocalValue] = useState<string>(() => {
    if (value === null || value === undefined) return '';
    if (editorType === 'date') {
      const str = String(value);
      if (dateEditorType === 'native') {
        // Native <input type="date"> requires YYYY-MM-DD
        return str.match(/^\d{4}-\d{2}-\d{2}/) ? str.substring(0, 10) : str;
      }
      // Text editor: format the stored value for display using configured format
      const formatted = formatDateForDisplay(str, effectiveDateFormat);
      return formatted ?? str;
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
        if (editorType === 'date' && dateEditorType !== 'native') {
          onCommit(commitDateValue(localValue, effectiveDateFormat));
        } else {
          onCommit(localValue);
        }
      }
    },
    [onCancel, onCommit, localValue, editorType, effectiveDateFormat, dateEditorType]
  );

  const handleBlur = useCallback(() => {
    if (editorType === 'text') {
      onCommit(localValue);
    } else if (editorType === 'date') {
      if (dateEditorType === 'native') {
        onCommit(localValue);
      } else {
        onCommit(commitDateValue(localValue, effectiveDateFormat));
      }
    }
  }, [editorType, localValue, onCommit, effectiveDateFormat, dateEditorType]);

  return {
    localValue,
    setLocalValue,
    handleKeyDown,
    handleBlur,
    commit: onCommit,
    cancel: onCancel,
  };
}
