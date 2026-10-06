/**
 * People filter state sub-hook for column header filters.
 * Manages people search text, suggestions, loading state, input ref, and user select/clear handlers.
 * Includes debounced people search effect.
 */

import { useState, useCallback, useEffect, useRef, type RefObject } from 'react';
import { useLatestRef } from './useLatestRef';
import { PEOPLE_SEARCH_DEBOUNCE_MS } from '@alaarab/ogrid-core';
import type { UserLike } from '../types/dataGridTypes';
import type { ColumnFilterType } from '../types/columnTypes';

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
  const { onUserChange, peopleSearch, isFilterOpen, filterType } = params;

  const peopleInputRef = useRef<HTMLInputElement | null>(null);
  const focusTimeoutRef = useRef<number | undefined>(undefined);
  const peopleSearchTimeoutRef = useRef<number | undefined>(undefined);
  // Monotonic request id so out-of-order responses can't overwrite newer ones.
  const peopleSearchRequestRef = useRef(0);

  const [peopleSuggestions, setPeopleSuggestions] = useState<UserLike[]>([]);
  const [isPeopleLoading, setIsPeopleLoading] = useState(false);
  const [peopleSearchText, setPeopleSearchText] = useState('');

  // Sync temp state when popover opens
  useEffect(() => {
    if (isFilterOpen) {
      setPeopleSearchText('');
      setPeopleSuggestions([]);
      if (filterType === 'people') {
        focusTimeoutRef.current = window.setTimeout(() => peopleInputRef.current?.focus(), 50);
      }
    }
    return () => {
      if (focusTimeoutRef.current) window.clearTimeout(focusTimeoutRef.current);
    };
  }, [isFilterOpen, filterType]);

  // Read through a ref: a host passing an inline function would otherwise
  // restart the search on every render (and the loading-state update below
  // re-renders, so an inline function looped forever, never finishing a search).
  const peopleSearchRef = useLatestRef(peopleSearch);
  const hasPeopleSearch = peopleSearch != null;

  // People search with debounce
  useEffect(() => {
    const search = peopleSearchRef.current;
    if (!hasPeopleSearch || !search || !isFilterOpen || filterType !== 'people') {
      setIsPeopleLoading(false);
      return;
    }
    if (peopleSearchTimeoutRef.current) window.clearTimeout(peopleSearchTimeoutRef.current);
    if (!peopleSearchText.trim()) {
      setPeopleSuggestions([]);
      setIsPeopleLoading(false);
      return;
    }
    const requestId = ++peopleSearchRequestRef.current;
    setIsPeopleLoading(true);
    peopleSearchTimeoutRef.current = window.setTimeout(async () => {
      try {
        const results = await search(peopleSearchText);
        if (requestId !== peopleSearchRequestRef.current) return;
        setPeopleSuggestions(results.slice(0, 10));
      } catch {
        if (requestId !== peopleSearchRequestRef.current) return;
        setPeopleSuggestions([]);
      } finally {
        if (requestId === peopleSearchRequestRef.current) setIsPeopleLoading(false);
      }
    }, PEOPLE_SEARCH_DEBOUNCE_MS);
    return () => {
      if (peopleSearchTimeoutRef.current) window.clearTimeout(peopleSearchTimeoutRef.current);
      // Invalidate any in-flight request when the query, source, or open state changes.
      peopleSearchRequestRef.current++;
    };
  }, [peopleSearchText, hasPeopleSearch, peopleSearchRef, isFilterOpen, filterType]);

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
