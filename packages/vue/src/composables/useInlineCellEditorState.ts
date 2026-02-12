import { ref } from 'vue';

export type InlineCellEditorType = 'text' | 'select' | 'checkbox' | 'richSelect' | 'date';

export interface UseInlineCellEditorStateParams {
  value: unknown;
  editorType: InlineCellEditorType;
  onCommit: (value: unknown) => void;
  onCancel: () => void;
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
  const { value, editorType, onCommit, onCancel } = params;
  const localValue = ref<string>(
    value !== null && value !== undefined ? String(value) : ''
  );

  const setLocalValue = (v: string) => {
    localValue.value = v;
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
    if (e.key === 'Enter' && editorType === 'text') {
      e.preventDefault();
      e.stopPropagation();
      commit(localValue.value);
    }
  };

  const handleBlur = () => {
    if (editorType === 'text') {
      commit(localValue.value);
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
