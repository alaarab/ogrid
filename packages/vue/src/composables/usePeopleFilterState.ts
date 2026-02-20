import { ref, watch, onUnmounted, type Ref } from 'vue';
import type { UserLike } from '../types';
import type { ColumnFilterType } from '../types';

const PEOPLE_SEARCH_DEBOUNCE_MS = 300;

export interface UsePeopleFilterStateParams {
  selectedUser?: UserLike;
  onUserChange?: (user: UserLike | undefined) => void;
  peopleSearch?: (query: string) => Promise<UserLike[]>;
  isFilterOpen: Ref<boolean>;
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

export function usePeopleFilterState(
  params: UsePeopleFilterStateParams
): UsePeopleFilterStateResult {
  const { onUserChange, filterType } = params;

  const peopleInputRef = ref<HTMLInputElement | null>(null);
  let peopleSearchTimeout: ReturnType<typeof setTimeout> | undefined;

  const peopleSuggestions = ref<UserLike[]>([]);
  const isPeopleLoading = ref(false);
  const peopleSearchText = ref('');

  const setPeopleSearchText = (v: string) => {
    peopleSearchText.value = v;
  };

  // Sync temp state when popover opens
  watch(params.isFilterOpen, (open) => {
    if (open) {
      peopleSearchText.value = '';
      peopleSuggestions.value = [];
      if (filterType === 'people') {
        setTimeout(() => peopleInputRef.value?.focus(), 50);
      }
    }
  });

  // People search with debounce
  watch(
    [peopleSearchText, () => params.peopleSearch, params.isFilterOpen],
    ([searchText, search, isOpen]) => {
      if (peopleSearchTimeout) clearTimeout(peopleSearchTimeout);
      if (!search || !isOpen || filterType !== 'people') return;
      if (!(searchText as string).trim()) {
        peopleSuggestions.value = [];
        return;
      }
      isPeopleLoading.value = true;
      peopleSearchTimeout = setTimeout(async () => {
        try {
          const results = await (search as (q: string) => Promise<UserLike[]>)(searchText as string);
          peopleSuggestions.value = results.slice(0, 10);
        } catch {
          peopleSuggestions.value = [];
        } finally {
          isPeopleLoading.value = false;
        }
      }, PEOPLE_SEARCH_DEBOUNCE_MS);
    }
  );

  onUnmounted(() => {
    if (peopleSearchTimeout) clearTimeout(peopleSearchTimeout);
  });

  const handleUserSelect = (user: UserLike) => {
    onUserChange?.(user);
  };

  const handleClearUser = () => {
    onUserChange?.(undefined);
  };

  return {
    peopleSuggestions,
    isPeopleLoading,
    peopleSearchText,
    setPeopleSearchText,
    peopleInputRef,
    handleUserSelect,
    handleClearUser,
  };
}
