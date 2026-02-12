import { ref } from 'vue';
export interface UseTextFilterStateParams {
    textValue?: string;
    onTextChange?: (value: string) => void;
    isFilterOpen: () => boolean;
}
export interface UseTextFilterStateResult {
    tempTextValue: ReturnType<typeof ref<string>>;
    setTempTextValue: (v: string) => void;
    handleTextApply: () => void;
    handleTextClear: () => void;
}
export declare function useTextFilterState(params: UseTextFilterStateParams): UseTextFilterStateResult;
