import { type Ref } from 'vue';
import type { UserLike } from '../types';
import type { ColumnFilterType } from '../types';
export interface UsePeopleFilterStateParams {
    selectedUser?: UserLike;
    onUserChange?: (user: UserLike | undefined) => void;
    peopleSearch?: (query: string) => Promise<UserLike[]>;
    isFilterOpen: () => boolean;
    filterType: ColumnFilterType;
}
export interface UsePeopleFilterStateResult {
    peopleSuggestions: Ref<UserLike[]>;
    isPeopleLoading: Ref<boolean>;
    peopleSearchText: Ref<string>;
    setPeopleSearchText: (v: string) => void;
    peopleInputRef: Ref<HTMLInputElement | null>;
    handleUserSelect: (user: UserLike) => void;
    handleClearUser: () => void;
}
export declare function usePeopleFilterState(params: UsePeopleFilterStateParams): UsePeopleFilterStateResult;
