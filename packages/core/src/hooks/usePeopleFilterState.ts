/**
 * People filter state sub-hook for column header filters.
 * Manages people search text, suggestions, loading state, input ref, and user select/clear handlers.
 * Includes debounced people search effect.
 */

import { useState, useCallback, useEffect, useRef, type RefObject } from 'react';
import type { UserLike } from '../types/dataGridTypes';
import type { ColumnFilterType } from '../types/columnTypes';

const PEOPLE_SEARCH_DEBOUNCE_MS = 300;

export interface UsePeopleFilterStateParams {
  selectedUser?: UserLike;
  onUserChange?: (user: UserLike | undefined) => void;
  peopleSearch?: (query: string) => Promise<UserLike[]>;
  isFilterOpen: boolean;
  filterType: ColumnFilterType;
}

export interface UsePeopleFilterStateResult {
  peopleSuggestions: UserLike[];
  isPeopleLoading: boolean;
  peopleSearchText: string;
  setPeopleSearchText: (v: string) => void;
  peopleInputRef: RefObject<HTMLInputElement | null>;
  handleUserSelect: (user: UserLike) => void;
  handleClearUser: () => void;
}

export function usePeopleFilterState(
  params: UsePeopleFilterStateParams
): UsePeopleFilterStateResult {
  const { selectedUser, onUserChange, peopleSearch, isFilterOpen, filterType } = params;

  const peopleInputRef = useRef<HTMLInputElement | null>(null);
  const peopleSearchTimeoutRef = useRef<number | undefined>(undefined);

  const [peopleSuggestions, setPeopleSuggestions] = useState<UserLike[]>([]);
  const [isPeopleLoading, setIsPeopleLoading] = useState(false);
  const [peopleSearchText, setPeopleSearchText] = useState('');

  // Sync temp state when popover opens
  useEffect(() => {
    if (isFilterOpen) {
      setPeopleSearchText('');
      setPeopleSuggestions([]);
      if (filterType === 'people') {
        setTimeout(() => peopleInputRef.current?.focus(), 50);
      }
    }
  }, [isFilterOpen, filterType]);

  // People search with debounce
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
    }, PEOPLE_SEARCH_DEBOUNCE_MS);
    return () => {
      if (peopleSearchTimeoutRef.current) window.clearTimeout(peopleSearchTimeoutRef.current);
    };
  }, [peopleSearchText, peopleSearch, isFilterOpen, filterType]);

  const handleUserSelect = useCallback(
    (user: UserLike) => {
      onUserChange?.(user);
    },
    [onUserChange]
  );

  const handleClearUser = useCallback(() => {
    onUserChange?.(undefined);
  }, [onUserChange]);

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
