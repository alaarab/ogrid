/**
 * Headless column header filter state and handlers for Fluent, Material, and Radix.
 * UI packages use this hook and render only presentation (popover, inputs, buttons).
 * Composes 4 sub-hooks for each filter type's state management.
 */

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  type RefObject,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type { ColumnFilterType, IDateFilterValue } from '../types/columnTypes';
import type { UserLike } from '../types/dataGridTypes';
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
  headerRef: RefObject<HTMLDivElement | null>;
  popoverRef: RefObject<HTMLDivElement | null>;
  peopleInputRef: RefObject<HTMLInputElement | null>;
  isFilterOpen: boolean;
  setFilterOpen: (open: boolean) => void;
  tempSelected: Set<string>;
  setTempSelected: Dispatch<SetStateAction<Set<string>>>;
  tempTextValue: string;
  setTempTextValue: (v: string) => void;
  searchText: string;
  setSearchText: (v: string) => void;
  debouncedSearchText: string;
  filteredOptions: string[];
  peopleSuggestions: UserLike[];
  isPeopleLoading: boolean;
  peopleSearchText: string;
  setPeopleSearchText: (v: string) => void;
  tempDateFrom: string;
  setTempDateFrom: (v: string) => void;
  tempDateTo: string;
  setTempDateTo: (v: string) => void;
  hasActiveFilter: boolean;
  popoverPosition: { top: number; left: number } | null;
  handlers: {
    handleFilterIconClick: (e: React.MouseEvent) => void;
    handleApplyMultiSelect: () => void;
    handleTextApply: () => void;
    handleTextClear: () => void;
    handleUserSelect: (user: UserLike) => void;
    handleClearUser: () => void;
    handleCheckboxChange: (option: string, checked: boolean) => void;
    handleSelectAll: () => void;
    handleClearSelection: () => void;
    handlePopoverClick: (e: React.MouseEvent) => void;
    handleInputFocus: (e: React.FocusEvent) => void;
    handleInputMouseDown: (e: React.MouseEvent) => void;
    handleInputClick: (e: React.MouseEvent) => void;
    handleInputKeyDown: (e: React.KeyboardEvent) => void;
    handleDateApply: () => void;
    handleDateClear: () => void;
    handleSortClick: (e: React.MouseEvent) => void;
  };
}

export function useColumnHeaderFilterState(
  params: UseColumnHeaderFilterStateParams
): UseColumnHeaderFilterStateResult {
  const {
    filterType,
    onSort,
    selectedValues,
    onFilterChange,
    options,
    textValue = '',
    onTextChange,
    selectedUser,
    onUserChange,
    peopleSearch,
    dateValue,
    onDateChange,
  } = params;

  const safeSelectedValues = selectedValues ?? EMPTY_OPTIONS;

  // Shared state
  const headerRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [isFilterOpen, setFilterOpen] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number } | null>(null);

  // Compose sub-hooks for each filter type
  const textFilterState = useTextFilterState({
    textValue,
    onTextChange,
    isFilterOpen,
  });

  const multiSelectFilterState = useMultiSelectFilterState({
    selectedValues,
    onFilterChange,
    options,
    isFilterOpen,
  });

  const peopleFilterState = usePeopleFilterState({
    selectedUser,
    onUserChange,
    peopleSearch,
    isFilterOpen,
    filterType,
  });

  const dateFilterState = useDateFilterState({
    dateValue,
    onDateChange,
    isFilterOpen,
  });

  // Close popover resets position
  useEffect(() => {
    if (!isFilterOpen) {
      setPopoverPosition(null);
    }
  }, [isFilterOpen]);

  // Click outside and Escape to close
  useEffect(() => {
    if (!isFilterOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        headerRef.current &&
        !headerRef.current.contains(target)
      ) {
        setFilterOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault();
        e.stopPropagation();
        setFilterOpen(false);
      }
    };
    const timeoutId = setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 0);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isFilterOpen]);

  // Shared handlers
  const handleFilterIconClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setFilterOpen((prev) => {
      if (!prev && headerRef.current) {
        const rect = headerRef.current.getBoundingClientRect();
        setPopoverPosition({ top: rect.bottom + 4, left: rect.left });
      }
      return !prev;
    });
  }, []);

  const handleSortClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSort?.();
    },
    [onSort]
  );

  // Wrap sub-hook handlers to close popover
  const handleApplyMultiSelect = useCallback(() => {
    multiSelectFilterState.handleApplyMultiSelect();
    setFilterOpen(false);
  }, [multiSelectFilterState]);

  const handleTextApply = useCallback(() => {
    textFilterState.handleTextApply();
    setFilterOpen(false);
  }, [textFilterState]);

  const handleUserSelect = useCallback(
    (user: UserLike) => {
      peopleFilterState.handleUserSelect(user);
      setFilterOpen(false);
    },
    [peopleFilterState]
  );

  const handleClearUser = useCallback(() => {
    peopleFilterState.handleClearUser();
    setFilterOpen(false);
  }, [peopleFilterState]);

  const handleDateApply = useCallback(() => {
    dateFilterState.handleDateApply();
    setFilterOpen(false);
  }, [dateFilterState]);

  // Event propagation stoppers
  const handlePopoverClick = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);
  const handleInputFocus = useCallback((e: React.FocusEvent) => e.stopPropagation(), []);
  const handleInputMouseDown = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);
  const handleInputClick = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);
  const handleInputKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Escape' && e.key !== 'Esc') e.stopPropagation();
  }, []);

  // Compute hasActiveFilter from all sub-hooks
  const hasActiveFilter = useMemo(() => {
    if (filterType === 'multiSelect') return safeSelectedValues.length > 0;
    if (filterType === 'text') return !!textValue.trim();
    if (filterType === 'people') return !!selectedUser;
    if (filterType === 'date') return !!(dateValue?.from || dateValue?.to);
    return false;
  }, [filterType, safeSelectedValues, textValue, selectedUser, dateValue]);

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
      handleDateApply,
      handleDateClear: dateFilterState.handleDateClear,
      handleCheckboxChange: multiSelectFilterState.handleCheckboxChange,
      handleSelectAll: multiSelectFilterState.handleSelectAll,
      handleClearSelection: multiSelectFilterState.handleClearSelection,
      handlePopoverClick,
      handleInputFocus,
      handleInputMouseDown,
      handleInputClick,
      handleInputKeyDown,
      handleSortClick,
    },
  };
}
