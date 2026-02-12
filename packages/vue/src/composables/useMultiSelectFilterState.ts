import { ref, computed, watch, type Ref } from 'vue';
import { useDebounce } from './useDebounce';

const SEARCH_DEBOUNCE_MS = 150;
const EMPTY_OPTIONS: string[] = [];

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

export function useMultiSelectFilterState(
  params: UseMultiSelectFilterStateParams
): UseMultiSelectFilterStateResult {
  const { onFilterChange } = params;

  const tempSelected = ref<Set<string>>(new Set(params.selectedValues ?? EMPTY_OPTIONS));
  const searchText = ref('');
  const debouncedSearchText = useDebounce(searchText, SEARCH_DEBOUNCE_MS);

  // Sync temp state when popover opens
  watch(() => params.isFilterOpen(), (open) => {
    if (open) {
      tempSelected.value = new Set(params.selectedValues ?? EMPTY_OPTIONS);
      searchText.value = '';
    }
  });

  const filteredOptions = computed(() => {
    const safeOptions = params.options ?? EMPTY_OPTIONS;
    if (!debouncedSearchText.value.trim()) return safeOptions;
    const searchLower = debouncedSearchText.value.toLowerCase().trim();
    return safeOptions.filter((opt) => opt.toLowerCase().includes(searchLower));
  });

  const setTempSelected = (v: Set<string>) => {
    tempSelected.value = v;
  };

  const setSearchText = (v: string) => {
    searchText.value = v;
  };

  const handleCheckboxChange = (option: string, checked: boolean) => {
    const next = new Set(tempSelected.value);
    if (checked) next.add(option);
    else next.delete(option);
    tempSelected.value = next;
  };

  const handleSelectAll = () => {
    tempSelected.value = new Set(filteredOptions.value);
  };

  const handleClearSelection = () => {
    tempSelected.value = new Set();
  };

  const handleApplyMultiSelect = () => {
    onFilterChange?.(Array.from(tempSelected.value));
  };

  return {
    tempSelected,
    setTempSelected,
    searchText,
    setSearchText,
    debouncedSearchText,
    filteredOptions,
    handleCheckboxChange,
    handleSelectAll,
    handleClearSelection,
    handleApplyMultiSelect,
  };
}
