import { useState, useCallback, type Dispatch, type SetStateAction } from 'react';
import { computeNextSortState } from '../utils';
import { columnIdsOf, sameColumnIds } from './columnSetIdentity';

const EMPTY_COLUMNS: ReadonlyArray<{ columnId: string }> = [];

export interface SortState {
  field: string;
  direction: 'asc' | 'desc';
}

export interface UseOGridSortingParams {
  controlledSort?: SortState;
  defaultSortField: string;
  defaultSortDirection: 'asc' | 'desc';
  /**
   * Memoized flat columns (only `columnId` is read here). Optional: without it
   * the hook cannot tell that the sort field has stopped naming a real column,
   * so it never re-seeds.
   */
  columns?: ReadonlyArray<{ columnId: string }>;
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
  /**
   * Raw setter for the uncontrolled sort. Writes state without notifying
   * `onSortChange` or resetting the page, so callers restoring a previously
   * captured sort (sheet-scoped state) don't report it back as a user sort.
   */
  setInternalSort: Dispatch<SetStateAction<SortState>>;
}

/**
 * Manages sort state with controlled/uncontrolled dual-mode support.
 * Resets to page 1 on sort change.
 */
export function useOGridSorting(params: UseOGridSortingParams): UseOGridSortingState {
  const {
    controlledSort,
    defaultSortField,
    defaultSortDirection,
    columns = EMPTY_COLUMNS,
    onSortChange,
    setPage,
  } = params;

  const [internalSort, setInternalSort] = useState<SortState>({
    field: defaultSortField,
    direction: defaultSortDirection,
  });

  // Tracks how many times the user has explicitly changed the sort.
  // Data fetching depends on this instead of sort.field/direction directly, so that
  // cell edits (which change displayData but not sortVersion) don't trigger a re-sort.
  const [sortVersion, setSortVersion] = useState(0);

  // The default sort field is derived from the columns, so it is wrong whenever
  // the grid mounted against a different column set than the one it now renders:
  // columns that load asynchronously seed the field from an empty array, and a
  // sheet switch leaves it pointing at a column that no longer exists. Either way
  // the grid silently stops sorting, because a field with no matching column
  // sorts every row on `undefined`. Re-seed during render (React's "adjust state
  // when props change" pattern) so no frame renders in that state.
  //
  // Only while the user has not sorted themselves  -  an explicit sort is their
  // choice to keep, even if the column it names is temporarily absent.
  const [prevColumnIds, setPrevColumnIds] = useState<string[]>(() => columnIdsOf(columns));
  if (!sameColumnIds(prevColumnIds, columns)) {
    setPrevColumnIds(columnIdsOf(columns));
    const fieldExists = columns.some((c) => c.columnId === internalSort.field);
    if (controlledSort === undefined && sortVersion === 0 && !fieldExists) {
      setInternalSort({ field: defaultSortField, direction: defaultSortDirection });
    }
  }

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

  return {
    sort,
    setSort,
    handleSort,
    defaultSortField,
    defaultSortDirection,
    sortVersion,
    setInternalSort,
  };
}
