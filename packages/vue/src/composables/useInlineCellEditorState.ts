import { ref } from 'vue';
import { formatDateForDisplay, parseUserInputDate, DEFAULT_DATE_FORMAT } from '@alaarab/ogrid-core';
import type { DateFormat } from '@alaarab/ogrid-core';

export type InlineCellEditorType = 'text' | 'select' | 'checkbox' | 'richSelect' | 'date';

export interface UseInlineCellEditorStateParams {
  value: unknown;
  editorType: InlineCellEditorType;
  onCommit: (value: unknown) => void;
  onCancel: () => void;
  /** Date format pattern (e.g. 'MM/DD/YYYY'). Only used when editorType is 'date'. */
  dateFormat?: DateFormat;
  /** Date editor widget type. 'native' uses <input type="date">, 'text' uses text input. */
  dateEditorType?: 'text' | 'native';
}

export interface UseInlineCellEditorStateResult {
  localValue: ReturnType<typeof ref<string>>;
  setLocalValue: (value: string) => void;
  handleKeyDown: (e: KeyboardEvent) => void;
  handleBlur: () => void;
  commit: (value: unknown) => void;
  cancel: () => void;
}

/**
 * Returns localValue/setLocalValue, handleKeyDown, handleBlur, commit, cancel.
 */
export function useInlineCellEditorState(
  params: UseInlineCellEditorStateParams
): UseInlineCellEditorStateResult {
  const { value, editorType, onCommit, onCancel, dateFormat, dateEditorType } = params;
  const resolvedDateFormat = dateFormat ?? DEFAULT_DATE_FORMAT;

  const localValue = ref<string>((() => {
    if (value === null || value === undefined) return '';
    if (editorType === 'date') {
      if (dateEditorType === 'native') {
        // <input type="date"> requires YYYY-MM-DD format
        const str = String(value);
        return str.match(/^\d{4}-\d{2}-\d{2}/) ? str.substring(0, 10) : str;
      }
      // Text editor: format using the configured date format
      return formatDateForDisplay(value, resolvedDateFormat) ?? '';
    }
    return String(value);
  })());

  const setLocalValue = (v: string) => {
    localValue.value = v;
  };

  const commitDateValue = (raw: string) => {
    if (editorType === 'date' && dateEditorType !== 'native') {
      if (!raw || !raw.trim()) {
        onCommit(null);
        return;
      }
      // Parse user-typed date text back to a Date object
      const parsed = parseUserInputDate(raw, resolvedDateFormat);
      if (parsed !== null) {
        // Store as YYYY-MM-DD ISO date string to stay consistent with column data
        const yyyy = parsed.getUTCFullYear().toString().padStart(4, '0');
        const mm = (parsed.getUTCMonth() + 1).toString().padStart(2, '0');
        const dd = parsed.getUTCDate().toString().padStart(2, '0');
        onCommit(`${yyyy}-${mm}-${dd}`);
      } else {
        // Unparseable input: commit null so the cell can handle it
        onCommit(null);
      }
    } else {
      onCommit(raw);
    }
  };

  const commit = (v: unknown) => {
    onCommit(v);
  };

  const cancel = () => {
    onCancel();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cancel();
    }
    if (e.key === 'Enter' && (editorType === 'text' || editorType === 'date')) {
      e.preventDefault();
      e.stopPropagation();
      commitDateValue(localValue.value);
    }
  };

  const handleBlur = () => {
    if (editorType === 'text' || editorType === 'date') {
      commitDateValue(localValue.value);
    }
  };

  return {
    localValue,
    setLocalValue,
    handleKeyDown,
    handleBlur,
    commit,
    cancel,
  };
}
