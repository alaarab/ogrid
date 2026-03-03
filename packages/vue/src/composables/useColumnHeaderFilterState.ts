import { ref, computed, watch, onUnmounted, type Ref } from 'vue';
import type { ColumnFilterType, IDateFilterValue } from '../types';
import type { UserLike } from '../types';
import { useTextFilterState } from './useTextFilterState';
import { useMultiSelectFilterState } from './useMultiSelectFilterState';
import { usePeopleFilterState } from './usePeopleFilterState';
import { useDateFilterState } from './useDateFilterState';

const EMPTY_OPTIONS: string[] = [];

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
  popoverPosition: Ref<{ top: number; left: number } | null>;
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

export function useColumnHeaderFilterState(
  params: UseColumnHeaderFilterStateParams
): UseColumnHeaderFilterStateResult {
  const {
    filterType,
    onSort,
  } = params;

  // Access params.selectedValues as a getter so hasActiveFilter tracks the reactive prop
  // (when params is Vue's reactive props object, this is reactive; plain objects are snapshots)
  const safeSelectedValues = () => params.selectedValues ?? EMPTY_OPTIONS;

  // Shared state
  const headerRef = ref<HTMLDivElement | null>(null);
  const popoverRef = ref<HTMLDivElement | null>(null);
  const isFilterOpen = ref(false);
  const popoverPosition = ref<{ top: number; left: number } | null>(null);

  const setFilterOpen = (open: boolean) => {
    isFilterOpen.value = open;
  };

  // Compose sub-hooks  -  pass the ref directly so Vue's reactivity system
  // can properly track dependencies (instead of a getter function wrapper)
  const textFilterState = useTextFilterState({
    textValue: params.textValue,
    onTextChange: params.onTextChange,
    isFilterOpen,
  });

  const multiSelectFilterState = useMultiSelectFilterState({
    selectedValues: params.selectedValues,
    onFilterChange: params.onFilterChange,
    options: params.options,
    isFilterOpen,
  });

  const peopleFilterState = usePeopleFilterState({
    selectedUser: params.selectedUser,
    onUserChange: params.onUserChange,
    peopleSearch: params.peopleSearch,
    isFilterOpen,
    filterType,
  });

  const dateFilterState = useDateFilterState({
    dateValue: params.dateValue,
    onDateChange: params.onDateChange,
    isFilterOpen,
  });

  // Close popover resets position
  watch(isFilterOpen, (open) => {
    if (!open) {
      popoverPosition.value = null;
    }
  });

  // Click outside and Escape to close
  let clickOutsideHandler: ((e: MouseEvent) => void) | null = null;
  let keyDownHandler: ((e: KeyboardEvent) => void) | null = null;
  let clickOutsideTimeout: ReturnType<typeof setTimeout> | undefined;

  const setupListeners = () => {
    cleanupListeners();
    clickOutsideHandler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.value && !popoverRef.value.contains(target) &&
        headerRef.value && !headerRef.value.contains(target)
      ) {
        isFilterOpen.value = false;
      }
    };
    keyDownHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault();
        e.stopPropagation();
        isFilterOpen.value = false;
      }
    };
    clickOutsideTimeout = setTimeout(() => { if (clickOutsideHandler) document.addEventListener('mousedown', clickOutsideHandler); }, 0);
    document.addEventListener('keydown', keyDownHandler, true);
  };

  const cleanupListeners = () => {
    if (clickOutsideTimeout) clearTimeout(clickOutsideTimeout);
    if (clickOutsideHandler) document.removeEventListener('mousedown', clickOutsideHandler);
    if (keyDownHandler) document.removeEventListener('keydown', keyDownHandler, true);
    clickOutsideHandler = null;
    keyDownHandler = null;
  };

  watch(isFilterOpen, (open) => {
    if (open) setupListeners();
    else cleanupListeners();
  });

  onUnmounted(() => cleanupListeners());

  // Shared handlers
  const handleFilterIconClick = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!isFilterOpen.value && headerRef.value) {
      const rect = headerRef.value.getBoundingClientRect();
      popoverPosition.value = { top: rect.bottom + 4, left: rect.left };
    }
    isFilterOpen.value = !isFilterOpen.value;
  };

  const handleSortClick = (e: MouseEvent) => {
    e.stopPropagation();
    onSort?.();
  };

  const handleApplyMultiSelect = () => {
    multiSelectFilterState.handleApplyMultiSelect();
    isFilterOpen.value = false;
  };

  const handleTextApply = () => {
    textFilterState.handleTextApply();
    isFilterOpen.value = false;
  };

  const handleUserSelect = (user: UserLike) => {
    peopleFilterState.handleUserSelect(user);
    isFilterOpen.value = false;
  };

  const handleClearUser = () => {
    peopleFilterState.handleClearUser();
    isFilterOpen.value = false;
  };

  const handleDateApply = () => {
    dateFilterState.handleDateApply();
    isFilterOpen.value = false;
  };

  const handlePopoverClick = (e: MouseEvent) => e.stopPropagation();
  const handleInputFocus = (e: FocusEvent) => e.stopPropagation();
  const handleInputMouseDown = (e: MouseEvent) => e.stopPropagation();
  const handleInputClick = (e: MouseEvent) => e.stopPropagation();
  const handleInputKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' && e.key !== 'Esc') e.stopPropagation();
  };

  const hasActiveFilter = computed(() => {
    if (filterType === 'multiSelect') return safeSelectedValues().length > 0;
    if (filterType === 'text') return !!(params.textValue ?? '').trim();
    if (filterType === 'people') return !!params.selectedUser;
    if (filterType === 'date') return !!(params.dateValue?.from || params.dateValue?.to);
    return false;
  });

  return {
    headerRef,
    popoverRef,
    peopleInputRef: peopleFilterState.peopleInputRef,
    isFilterOpen,
    setFilterOpen,
    tempSelected: multiSelectFilterState.tempSelected,
    setTempSelected: multiSelectFilterState.setTempSelected,
    tempTextValue: textFilterState.tempTextValue,
    setTempTextValue: textFilterState.setTempTextValue,
    searchText: multiSelectFilterState.searchText,
    setSearchText: multiSelectFilterState.setSearchText,
    debouncedSearchText: multiSelectFilterState.debouncedSearchText,
    filteredOptions: multiSelectFilterState.filteredOptions,
    peopleSuggestions: peopleFilterState.peopleSuggestions,
    isPeopleLoading: peopleFilterState.isPeopleLoading,
    peopleSearchText: peopleFilterState.peopleSearchText,
    setPeopleSearchText: peopleFilterState.setPeopleSearchText,
    tempDateFrom: dateFilterState.tempDateFrom,
    setTempDateFrom: dateFilterState.setTempDateFrom,
    tempDateTo: dateFilterState.tempDateTo,
    setTempDateTo: dateFilterState.setTempDateTo,
    hasActiveFilter,
    popoverPosition,
    handlers: {
      handleFilterIconClick,
      handleApplyMultiSelect,
      handleTextApply,
      handleTextClear: textFilterState.handleTextClear,
      handleUserSelect,
      handleClearUser,
      handleCheckboxChange: multiSelectFilterState.handleCheckboxChange,
      handleSelectAll: multiSelectFilterState.handleSelectAll,
      handleClearSelection: multiSelectFilterState.handleClearSelection,
      handlePopoverClick,
      handleInputFocus,
      handleInputMouseDown,
      handleInputClick,
      handleInputKeyDown,
      handleDateApply,
      handleDateClear: dateFilterState.handleDateClear,
      handleSortClick,
    },
  };
}
