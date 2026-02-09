/**
 * Headless column header filter state and handlers for Fluent, Material, and Radix.
 * UI packages use this hook and render only presentation (popover, inputs, buttons).
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
import type { ColumnFilterType } from '../types/columnTypes';
import type { UserLike } from '../types/dataGridTypes';
import { useDebounce } from './useDebounce';

const SEARCH_DEBOUNCE_MS = 150;
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
  } = params;

  const safeSelectedValues = selectedValues ?? EMPTY_OPTIONS;
  const safeOptions = options ?? EMPTY_OPTIONS;

  const headerRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const peopleInputRef = useRef<HTMLInputElement | null>(null);
  const peopleSearchTimeoutRef = useRef<number | undefined>(undefined);

  const [isFilterOpen, setFilterOpen] = useState(false);
  const [tempSelected, setTempSelected] = useState<Set<string>>(() => new Set(safeSelectedValues));
  const [tempTextValue, setTempTextValue] = useState(textValue);
  const [searchText, setSearchText] = useState('');
  const debouncedSearchText = useDebounce(searchText, SEARCH_DEBOUNCE_MS);
  const [peopleSuggestions, setPeopleSuggestions] = useState<UserLike[]>([]);
  const [isPeopleLoading, setIsPeopleLoading] = useState(false);
  const [peopleSearchText, setPeopleSearchText] = useState('');
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number } | null>(null);

  // Sync temp state when popover opens; compute position
  useEffect(() => {
    if (isFilterOpen) {
      setTempSelected(new Set(safeSelectedValues));
      setTempTextValue(textValue);
      setSearchText('');
      setPeopleSearchText('');
      setPeopleSuggestions([]);
      const t = setTimeout(() => {
        if (headerRef.current) {
          const rect = headerRef.current.getBoundingClientRect();
          setPopoverPosition({ top: rect.bottom + 4, left: rect.left });
        }
        if (filterType === 'people') {
          setTimeout(() => peopleInputRef.current?.focus(), 50);
        }
      }, 0);
      return () => clearTimeout(t);
    } else {
      setPopoverPosition(null);
    }
  }, [isFilterOpen, filterType, safeSelectedValues, textValue]);

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

  // Filtered options for multiSelect (search within options)
  const filteredOptions = useMemo(() => {
    if (!debouncedSearchText.trim()) return safeOptions;
    const searchLower = debouncedSearchText.toLowerCase().trim();
    return safeOptions.filter((opt) => opt.toLowerCase().includes(searchLower));
  }, [safeOptions, debouncedSearchText]);

  // People search
  useEffect(() => {
    if (!peopleSearch || !isFilterOpen || filterType !== 'people') return;
    if (peopleSearchTimeoutRef.current) window.clearTimeout(peopleSearchTimeoutRef.current);
    if (!peopleSearchText.trim()) {
      setPeopleSuggestions([]);
      return;
    }
    setIsPeopleLoading(true);
    peopleSearchTimeoutRef.current = window.setTimeout(async () => {
      try {
        const results = await peopleSearch(peopleSearchText);
        setPeopleSuggestions(results.slice(0, 10));
      } catch {
        setPeopleSuggestions([]);
      } finally {
        setIsPeopleLoading(false);
      }
    }, 300);
    return () => {
      if (peopleSearchTimeoutRef.current) window.clearTimeout(peopleSearchTimeoutRef.current);
    };
  }, [peopleSearchText, peopleSearch, isFilterOpen, filterType]);

  const handleFilterIconClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setFilterOpen((prev) => !prev);
  }, []);

  const handleSortClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSort?.();
    },
    [onSort]
  );

  const handleCheckboxChange = useCallback((option: string, checked: boolean) => {
    setTempSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(option);
      else next.delete(option);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setTempSelected(new Set(filteredOptions));
  }, [filteredOptions]);

  const handleClearSelection = useCallback(() => setTempSelected(new Set()), []);

  const handleApplyMultiSelect = useCallback(() => {
    onFilterChange?.(Array.from(tempSelected));
    setFilterOpen(false);
  }, [onFilterChange, tempSelected]);

  const handleTextApply = useCallback(() => {
    onTextChange?.(tempTextValue.trim());
    setFilterOpen(false);
  }, [onTextChange, tempTextValue]);

  const handleTextClear = useCallback(() => setTempTextValue(''), []);

  const handleUserSelect = useCallback(
    (user: UserLike) => {
      onUserChange?.(user);
      setFilterOpen(false);
    },
    [onUserChange]
  );

  const handleClearUser = useCallback(() => {
    onUserChange?.(undefined);
    setFilterOpen(false);
  }, [onUserChange]);

  const handlePopoverClick = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);
  const handleInputFocus = useCallback((e: React.FocusEvent) => e.stopPropagation(), []);
  const handleInputMouseDown = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);
  const handleInputClick = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);
  const handleInputKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Escape' && e.key !== 'Esc') e.stopPropagation();
  }, []);

  const hasActiveFilter = useMemo(() => {
    if (filterType === 'multiSelect') return safeSelectedValues.length > 0;
    if (filterType === 'text') return !!textValue.trim();
    if (filterType === 'people') return !!selectedUser;
    return false;
  }, [filterType, safeSelectedValues, textValue, selectedUser]);

  return {
    headerRef,
    popoverRef,
    peopleInputRef,
    isFilterOpen,
    setFilterOpen,
    tempSelected,
    setTempSelected,
    tempTextValue,
    setTempTextValue,
    searchText,
    setSearchText,
    debouncedSearchText,
    filteredOptions,
    peopleSuggestions,
    isPeopleLoading,
    peopleSearchText,
    setPeopleSearchText,
    hasActiveFilter,
    popoverPosition,
    handlers: {
      handleFilterIconClick,
      handleApplyMultiSelect,
      handleTextApply,
      handleTextClear,
      handleUserSelect,
      handleClearUser,
      handleCheckboxChange,
      handleSelectAll,
      handleClearSelection,
      handlePopoverClick,
      handleInputFocus,
      handleInputMouseDown,
      handleInputClick,
      handleInputKeyDown,
      handleSortClick,
    },
  };
}
