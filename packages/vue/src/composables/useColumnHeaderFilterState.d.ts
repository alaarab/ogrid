import { type Ref } from 'vue';
import type { ColumnFilterType, IDateFilterValue } from '../types';
import type { UserLike } from '../types';
export interface UseColumnHeaderFilterStateParams {
    filterType: ColumnFilterType;
    isSorted?: boolean;
    isSortedDescending?: boolean;
    onSort?: () => void;
    selectedValues?: string[];
    onFilterChange?: (values: string[]) => void;
    options?: string[];
    isLoadingOptions?: boolean;
    textValue?: string;
    onTextChange?: (value: string) => void;
    selectedUser?: UserLike;
    onUserChange?: (user: UserLike | undefined) => void;
    peopleSearch?: (query: string) => Promise<UserLike[]>;
    dateValue?: IDateFilterValue;
    onDateChange?: (value: IDateFilterValue | undefined) => void;
}
export interface UseColumnHeaderFilterStateResult {
    headerRef: Ref<HTMLDivElement | null>;
    popoverRef: Ref<HTMLDivElement | null>;
    peopleInputRef: Ref<HTMLInputElement | null>;
    isFilterOpen: Ref<boolean>;
    setFilterOpen: (open: boolean) => void;
    tempSelected: Ref<Set<string>>;
    setTempSelected: (v: Set<string>) => void;
    tempTextValue: Ref<string | undefined>;
    setTempTextValue: (v: string) => void;
    searchText: Ref<string>;
    setSearchText: (v: string) => void;
    debouncedSearchText: Ref<string>;
    filteredOptions: Ref<string[]>;
    peopleSuggestions: Ref<UserLike[]>;
    isPeopleLoading: Ref<boolean>;
    peopleSearchText: Ref<string>;
    setPeopleSearchText: (v: string) => void;
    tempDateFrom: Ref<string | undefined>;
    setTempDateFrom: (v: string) => void;
    tempDateTo: Ref<string | undefined>;
    setTempDateTo: (v: string) => void;
    hasActiveFilter: Ref<boolean>;
    popoverPosition: Ref<{
        top: number;
        left: number;
    } | null>;
    handlers: {
        handleFilterIconClick: (e: MouseEvent) => void;
        handleApplyMultiSelect: () => void;
        handleTextApply: () => void;
        handleTextClear: () => void;
        handleUserSelect: (user: UserLike) => void;
        handleClearUser: () => void;
        handleCheckboxChange: (option: string, checked: boolean) => void;
        handleSelectAll: () => void;
        handleClearSelection: () => void;
        handlePopoverClick: (e: MouseEvent) => void;
        handleInputFocus: (e: FocusEvent) => void;
        handleInputMouseDown: (e: MouseEvent) => void;
        handleInputClick: (e: MouseEvent) => void;
        handleInputKeyDown: (e: KeyboardEvent) => void;
        handleDateApply: () => void;
        handleDateClear: () => void;
        handleSortClick: (e: MouseEvent) => void;
    };
}
export declare function useColumnHeaderFilterState(params: UseColumnHeaderFilterStateParams): UseColumnHeaderFilterStateResult;
