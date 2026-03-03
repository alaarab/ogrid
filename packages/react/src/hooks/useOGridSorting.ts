import { useState, useCallback } from 'react';
import { computeNextSortState } from '../utils';

export interface SortState {
  field: string;
  direction: 'asc' | 'desc';
}

export interface UseOGridSortingParams {
  controlledSort?: SortState;
  defaultSortField: string;
  defaultSortDirection: 'asc' | 'desc';
  onSortChange?: (s: SortState) => void;
  setPage: (p: number) => void;
}

export interface UseOGridSortingState {
  sort: SortState;
  setSort: (s: SortState) => void;
  handleSort: (columnKey: string, direction?: 'asc' | 'desc' | null) => void;
  defaultSortField: string;
  defaultSortDirection: 'asc' | 'desc';
  /**
   * Increments each time the user explicitly changes the sort. Used to snapshot sort at sort-time
   * so that subsequent data edits don't trigger a re-sort (Excel-like behavior).
   */
  sortVersion: number;
}

/**
 * Manages sort state with controlled/uncontrolled dual-mode support.
 * Resets to page 1 on sort change.
 */
export function useOGridSorting(params: UseOGridSortingParams): UseOGridSortingState {
  const { controlledSort, defaultSortField, defaultSortDirection, onSortChange, setPage } = params;

  const [internalSort, setInternalSort] = useState<SortState>({
    field: defaultSortField,
    direction: defaultSortDirection,
  });

  // Tracks how many times the user has explicitly changed the sort.
  // Data fetching depends on this instead of sort.field/direction directly, so that
  // cell edits (which change displayData but not sortVersion) don't trigger a re-sort.
  const [sortVersion, setSortVersion] = useState(0);

  const sort = controlledSort ?? internalSort;

  const setSort = useCallback(
    (s: SortState) => {
      if (controlledSort === undefined) setInternalSort(s);
      onSortChange?.(s);
      setPage(1);
      setSortVersion((v) => v + 1);
    },
    [controlledSort, onSortChange, setPage]
  );

  const handleSort = useCallback(
    (columnKey: string, direction?: 'asc' | 'desc' | null) => {
      setSort(computeNextSortState(sort, columnKey, direction));
    },
    [sort, setSort]
  );

  return { sort, setSort, handleSort, defaultSortField, defaultSortDirection, sortVersion };
}
