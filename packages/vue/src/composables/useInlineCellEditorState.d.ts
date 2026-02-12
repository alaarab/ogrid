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
export declare function useInlineCellEditorState(params: UseInlineCellEditorStateParams): UseInlineCellEditorStateResult;
