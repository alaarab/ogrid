import type { FilterOption } from '@alaarab/ogrid-core';
import { getFilterOptionLabel, getFilterOptionValue } from '@alaarab/ogrid-core';
import type { MultiSelectFilterMode } from '@alaarab/ogrid-core';
/**
 * Multi-select filter state sub-hook for column header filters.
 * Manages temporary selection set, search text, debounced search, filtered options, and select/clear handlers.
 */

import { useState, useCallback, useEffect, useMemo, useRef, type Dispatch, type SetStateAction } from 'react';
import { useDebounce } from './useDebounce';

const SEARCH_DEBOUNCE_MS = 150;
const EMPTY_OPTIONS: string[] = [];

export interface UseMultiSelectFilterStateParams {
  selectedValues?: string[];
  onFilterChange?: (values: string[], mode?: MultiSelectFilterMode) => void;
  /** Applied match mode (`any` when omitted). */
  mode?: MultiSelectFilterMode;
  options?: FilterOption[];
  isFilterOpen: boolean;
}

export interface UseMultiSelectFilterStateResult {
  tempSelected: Set<string>;
  setTempSelected: Dispatch<SetStateAction<Set<string>>>;
  searchText: string;
  setSearchText: (v: string) => void;
  debouncedSearchText: string;
  filteredOptions: FilterOption[];
  /** Match mode chosen in the open popover. */
  tempMode: MultiSelectFilterMode;
  setTempMode: (mode: MultiSelectFilterMode) => void;
  handleCheckboxChange: (option: string, checked: boolean) => void;
  handleSelectAll: () => void;
  handleClearSelection: () => void;
  handleApplyMultiSelect: () => void;
}

export function useMultiSelectFilterState(
  params: UseMultiSelectFilterStateParams
): UseMultiSelectFilterStateResult {
  const { selectedValues, onFilterChange, options, isFilterOpen, mode = 'any' } = params;

  const safeSelectedValues = selectedValues ?? EMPTY_OPTIONS;
  const safeOptions = options ?? EMPTY_OPTIONS;

  const [tempSelected, setTempSelected] = useState<Set<string>>(() => new Set(safeSelectedValues));
  const [searchText, setSearchText] = useState('');
  const [tempMode, setTempMode] = useState<MultiSelectFilterMode>(mode);
  const debouncedSearchText = useDebounce(searchText, SEARCH_DEBOUNCE_MS);

  // Sync temp state only on the closed -> open transition. The parent may pass
  // a fresh `selectedValues` array on any header re-render (e.g. when no filter
  // is applied), and syncing on identity would discard pending checks and the
  // search text while the popover is open.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (isFilterOpen && !wasOpenRef.current) {
      setTempSelected(new Set(safeSelectedValues));
      setTempMode(mode);
      setSearchText('');
    }
    wasOpenRef.current = isFilterOpen;
  }, [isFilterOpen, safeSelectedValues, mode]);

  // Filtered options for multiSelect (search within options)
  const filteredOptions = useMemo(() => {
    const trimmed = debouncedSearchText.trim();
    if (!trimmed) return safeOptions;
    const searchLower = trimmed.toLowerCase();
    return safeOptions.filter((opt) => getFilterOptionLabel(opt).toLowerCase().includes(searchLower));
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
      for (const opt of filteredOptions) next.add(getFilterOptionValue(opt));
      return next;
    });
  }, [filteredOptions]);

  const handleClearSelection = useCallback(() => setTempSelected(new Set()), []);

  const handleApplyMultiSelect = useCallback(() => {
    // `any` is the default: leave it out so existing two-argument handlers see no change.
    if (tempMode === 'any') onFilterChange?.(Array.from(tempSelected));
    else onFilterChange?.(Array.from(tempSelected), tempMode);
  }, [onFilterChange, tempSelected, tempMode]);

  return {
    tempSelected,
    setTempSelected,
    searchText,
    setSearchText,
    debouncedSearchText,
    filteredOptions,
    tempMode,
    setTempMode,
    handleCheckboxChange,
    handleSelectAll,
    handleClearSelection,
    handleApplyMultiSelect,
  };
}
