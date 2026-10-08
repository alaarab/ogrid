/**
 * Headless inline cell editor state for Fluent, Material, and Radix InlineCellEditor.
 * UI packages use this hook and render only the framework input (Input, TextField, select, Checkbox).
 */

import { useState, useCallback, useRef } from 'react';
import { formatDateForDisplay, parseUserInputDate, DEFAULT_DATE_FORMAT, cycleReferenceAtCaret } from '@alaarab/ogrid-core';

export type InlineCellEditorType = 'text' | 'select' | 'checkbox' | 'richSelect' | 'date';

/** Where the active cell goes after the editor commits: Enter moves down, Shift+Enter up. */
export interface InlineCellEditorCommitOptions {
  move?: 'down' | 'up';
}

export interface UseInlineCellEditorStateParams {
  value: unknown;
  editorType: InlineCellEditorType;
  onCommit: (value: unknown, options?: InlineCellEditorCommitOptions) => void;
  onCancel: () => void;
  /**
   * Text that replaces the cell's value when the editor opens: the character
   * typed on a selected cell (type-to-replace). Text and date editors only.
   */
  initialText?: string;
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
  commit: (value: unknown, options?: InlineCellEditorCommitOptions) => void;
  cancel: () => void;
  /**
   * Caret position to restore after Alt+Enter inserted a line break (the text
   * editor may switch from an input to a textarea). The editor reads and
   * clears it after rendering; while set, a blur doesn't commit.
   */
  pendingCaretRef: { current: number | null };
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
 * Returns localValue/setLocalValue (for text), handleKeyDown (Escape cancel, Enter/Tab commit for text),
 * handleBlur (commit on blur for text), commit(value), cancel(). UI renders only the input.
 */
export function useInlineCellEditorState(
  params: UseInlineCellEditorStateParams
): UseInlineCellEditorStateResult {
  const { value, editorType, onCommit, onCancel, dateFormat, dateEditorType, initialText } = params;
  const effectiveDateFormat = dateFormat ?? DEFAULT_DATE_FORMAT;

  const [localValue, setLocalValue] = useState<string>(() => {
    if (initialText !== undefined && (editorType === 'text' || editorType === 'date')) return initialText;
    if (value === null || value === undefined) return '';
    if (editorType === 'date') {
      const str = String(value);
      // Native <input type="date"> requires YYYY-MM-DD; both editors use UTC calendar fields.
      const formatted = formatDateForDisplay(value, dateEditorType === 'native' ? DEFAULT_DATE_FORMAT : effectiveDateFormat);
      return formatted ?? str;
    }
    return String(value);
  });

  // Set once Escape/Enter has cancelled or committed, so a blur that follows
  // (focus moving as the editor closes) doesn't commit a second time or
  // commit a cancelled edit.
  const settledRef = useRef(false);
  const pendingCaretRef = useRef<number | null>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation(); // Don't let the grid handler clear selection on Escape
        settledRef.current = true;
        onCancel();
      }
      // F4 in a formula cycles the reference at the caret: A1 -> $A$1 -> A$1 -> $A1 (Excel).
      if (e.key === 'F4' && editorType === 'text' && localValue.startsWith('=')) {
        e.preventDefault();
        const input = e.target as HTMLInputElement;
        const caret = typeof input.selectionStart === 'number' ? input.selectionStart : localValue.length;
        const next = cycleReferenceAtCaret(localValue, caret);
        if (next) {
          // Write the DOM first so React sees an unchanged value and keeps the caret.
          if (typeof input.setSelectionRange === 'function') {
            input.value = next.text;
            input.setSelectionRange(next.end, next.end);
          }
          settledRef.current = false;
          setLocalValue(next.text);
        }
        return;
      }
      // Alt+Enter (Option+Enter on macOS) starts a new line in the cell, as in Excel.
      if (e.key === 'Enter' && e.altKey && editorType === 'text') {
        e.preventDefault();
        e.stopPropagation();
        const field = e.target as HTMLInputElement | HTMLTextAreaElement;
        const start = typeof field.selectionStart === 'number' ? field.selectionStart : localValue.length;
        const end = typeof field.selectionEnd === 'number' ? field.selectionEnd : start;
        pendingCaretRef.current = start + 1;
        settledRef.current = false;
        setLocalValue(`${localValue.slice(0, start)}\n${localValue.slice(end)}`);
        return;
      }
      if ((e.key === 'Enter' || e.key === 'Tab') && (editorType === 'text' || editorType === 'date')) {
        e.preventDefault();
        // Enter stops here so the grid doesn't re-open an editor; Tab bubbles on
        // so the grid can move to the next cell after this commit.
        if (e.key === 'Enter') e.stopPropagation();
        settledRef.current = true;
        // Shift+Enter commits and moves up. Tab's move belongs to the grid, which handles Tab after this.
        const committed = editorType === 'date' && dateEditorType !== 'native'
          ? commitDateValue(localValue, effectiveDateFormat)
          : localValue;
        if (e.key === 'Enter') onCommit(committed, { move: e.shiftKey ? 'up' : 'down' });
        else onCommit(committed);
      }
    },
    [onCancel, onCommit, localValue, editorType, effectiveDateFormat, dateEditorType]
  );

  const handleBlur = useCallback(() => {
    // The input is being swapped for a textarea after Alt+Enter, not left.
    if (settledRef.current || pendingCaretRef.current != null) return;
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

  // Typing again means a new edit, in case the editor instance is reused.
  const setLocalValueAndReopen = useCallback((next: string) => {
    settledRef.current = false;
    setLocalValue(next);
  }, []);

  return {
    localValue,
    setLocalValue: setLocalValueAndReopen,
    handleKeyDown,
    handleBlur,
    commit: onCommit,
    cancel: onCancel,
    pendingCaretRef,
  };
}
