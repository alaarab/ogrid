/**
 * Multi-select filter state sub-hook for column header filters.
 * Manages temporary selection set, search text, debounced search, filtered options, and select/clear handlers.
 */

import { useState, useCallback, useEffect, useMemo, type Dispatch, type SetStateAction } from 'react';
import { useDebounce } from './useDebounce';

const SEARCH_DEBOUNCE_MS = 150;
const EMPTY_OPTIONS: string[] = [];

export interface UseMultiSelectFilterStateParams {
  selectedValues?: string[];
  onFilterChange?: (values: string[]) => void;
  options?: string[];
  isFilterOpen: boolean;
}

export interface UseMultiSelectFilterStateResult {
  tempSelected: Set<string>;
  setTempSelected: Dispatch<SetStateAction<Set<string>>>;
  searchText: string;
  setSearchText: (v: string) => void;
  debouncedSearchText: string;
  filteredOptions: string[];
  handleCheckboxChange: (option: string, checked: boolean) => void;
  handleSelectAll: () => void;
  handleClearSelection: () => void;
  handleApplyMultiSelect: () => void;
}

export function useMultiSelectFilterState(
  params: UseMultiSelectFilterStateParams
): UseMultiSelectFilterStateResult {
  const { selectedValues, onFilterChange, options, isFilterOpen } = params;

  const safeSelectedValues = selectedValues ?? EMPTY_OPTIONS;
  const safeOptions = options ?? EMPTY_OPTIONS;

  const [tempSelected, setTempSelected] = useState<Set<string>>(() => new Set(safeSelectedValues));
  const [searchText, setSearchText] = useState('');
  const debouncedSearchText = useDebounce(searchText, SEARCH_DEBOUNCE_MS);

  // Sync temp state when popover opens
  useEffect(() => {
    if (isFilterOpen) {
      setTempSelected(new Set(safeSelectedValues));
      setSearchText('');
    }
  }, [isFilterOpen, safeSelectedValues]);

  // Filtered options for multiSelect (search within options)
  const filteredOptions = useMemo(() => {
    const trimmed = debouncedSearchText.trim();
    if (!trimmed) return safeOptions;
    const searchLower = trimmed.toLowerCase();
    return safeOptions.filter((opt) => opt.toLowerCase().includes(searchLower));
  }, [safeOptions, debouncedSearchText]);

  const handleCheckboxChange = useCallback((option: string, checked: boolean) => {
    setTempSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(option);
      else next.delete(option);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setTempSelected((prev) => {
      const next = new Set(prev);
      for (const opt of filteredOptions) next.add(opt);
      return next;
    });
  }, [filteredOptions]);

  const handleClearSelection = useCallback(() => setTempSelected(new Set()), []);

  const handleApplyMultiSelect = useCallback(() => {
    onFilterChange?.(Array.from(tempSelected));
  }, [onFilterChange, tempSelected]);

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
