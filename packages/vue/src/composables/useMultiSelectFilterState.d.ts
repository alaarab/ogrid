import { type Ref } from 'vue';
export interface UseMultiSelectFilterStateParams {
    selectedValues?: string[];
    onFilterChange?: (values: string[]) => void;
    options?: string[];
    isFilterOpen: () => boolean;
}
export interface UseMultiSelectFilterStateResult {
    tempSelected: Ref<Set<string>>;
    setTempSelected: (v: Set<string>) => void;
    searchText: Ref<string>;
    setSearchText: (v: string) => void;
    debouncedSearchText: Ref<string>;
    filteredOptions: Ref<string[]>;
    handleCheckboxChange: (option: string, checked: boolean) => void;
    handleSelectAll: () => void;
    handleClearSelection: () => void;
    handleApplyMultiSelect: () => void;
}
export declare function useMultiSelectFilterState(params: UseMultiSelectFilterStateParams): UseMultiSelectFilterStateResult;
