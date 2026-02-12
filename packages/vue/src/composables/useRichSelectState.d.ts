import { type Ref } from 'vue';
export interface UseRichSelectStateParams {
    values: unknown[];
    formatValue?: (value: unknown) => string;
    initialValue: unknown;
    onCommit: (value: unknown) => void;
    onCancel: () => void;
}
export interface UseRichSelectStateResult {
    searchText: Ref<string>;
    setSearchText: (text: string) => void;
    filteredValues: Ref<unknown[]>;
    highlightedIndex: Ref<number>;
    handleKeyDown: (e: KeyboardEvent) => void;
    selectValue: (value: unknown) => void;
    getDisplayText: (value: unknown) => string;
}
/**
 * Manages searchable rich select editor state with keyboard navigation.
 */
export declare function useRichSelectState(params: UseRichSelectStateParams): UseRichSelectStateResult;
