import { useState, useCallback, useMemo, type Dispatch, type SetStateAction } from 'react';
import { computeNextSortModel, normalizeSortModel, sortModelKey } from '@alaarab/ogrid-core';
import type { ISortModelItem } from '@alaarab/ogrid-core';
import { columnIdsOf, sameColumnIds } from './columnSetIdentity';

const EMPTY_COLUMNS: ReadonlyArray<{ columnId: string }> = [];

export interface SortState {
  field: string;
  direction: 'asc' | 'desc';
}

/** Options for a sort request from a header click or the column menu. */
export interface SortRequestOptions {
  /** Add or cycle a sort level instead of replacing the sort (Shift+click, "Add to sort"). */
  additive?: boolean;
}

export interface UseOGridSortingParams {
  controlledSort?: SortState;
  /** Controlled multi-level sort. Takes precedence over `controlledSort`. */
  controlledSortModel?: ISortModelItem[];
  defaultSortField: string;
  defaultSortDirection: 'asc' | 'desc';
  /** Initial multi-level sort (uncontrolled). Takes precedence over `defaultSortField`. */
  defaultSortModel?: ISortModelItem[];
  /**
   * Memoized flat columns (only `columnId` is read here). Optional: without it
   * the hook cannot tell that the sort field has stopped naming a real column,
   * so it never re-seeds.
   */
  columns?: ReadonlyArray<{ columnId: string }>;
  onSortChange?: (s: SortState) => void;
  onSortModelChange?: (model: ISortModelItem[]) => void;
  setPage: (p: number) => void;
}

export interface UseOGridSortingState {
  /** Primary sort level (`{ field: '' }` when unsorted). */
  sort: SortState;
  /** Every sort level, primary first. */
  sortModel: ISortModelItem[];
  setSort: (s: SortState) => void;
  setSortModel: (model: ISortModelItem[]) => void;
  handleSort: (columnKey: string, direction?: 'asc' | 'desc' | null, options?: SortRequestOptions) => void;
  /** Restore the default sort (`defaultSortModel`, else `defaultSortField`/`defaultSortDirection`). */
  resetSort: () => void;
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
  /** Raw (non-notifying) setter for the uncontrolled multi-level sort. */
  setInternalSortModel: Dispatch<SetStateAction<ISortModelItem[]>>;
}

function toModel(sort: SortState): ISortModelItem[] {
  return sort.field ? [{ field: sort.field, direction: sort.direction }] : [];
}

/**
 * Manages sort state with controlled/uncontrolled dual-mode support.
 * The state is a list of sort levels; `sort` is its primary level, kept for
 * the single-sort API. Resets to page 1 on sort change.
 */
export function useOGridSorting(params: UseOGridSortingParams): UseOGridSortingState {
  const {
    controlledSort,
    controlledSortModel,
    defaultSortField,
    defaultSortDirection,
    defaultSortModel,
    columns = EMPTY_COLUMNS,
    onSortChange,
    onSortModelChange,
    setPage,
  } = params;

  const initialModel = (): ISortModelItem[] =>
    defaultSortModel !== undefined ? normalizeSortModel(defaultSortModel) : toModel({ field: defaultSortField, direction: defaultSortDirection });

  const [internalModel, setInternalModel] = useState<ISortModelItem[]>(initialModel);
  // Direction reported for an empty (unsorted) model, so `sort` keeps the shape
  // it had before multi-level sorting: `{ field: '', direction }`.
  const [emptyDirection, setEmptyDirection] = useState<'asc' | 'desc'>(defaultSortDirection);

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
    const primaryField = internalModel[0]?.field ?? '';
    const fieldExists = columns.some((c) => c.columnId === primaryField);
    if (controlledSort === undefined && controlledSortModel === undefined && sortVersion === 0 && !fieldExists) {
      setInternalModel(initialModel());
      setEmptyDirection(defaultSortDirection);
    }
  }

  const isControlled = controlledSortModel !== undefined || controlledSort !== undefined;
  const rawModel = controlledSortModel !== undefined
    ? controlledSortModel
    : controlledSort !== undefined
      ? toModel(controlledSort)
      : internalModel;
  // Identity follows content, so inline controlled props don't churn dependents.
  const modelKey = sortModelKey(rawModel);
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on content (modelKey), not the identity of rawModel
  const sortModel = useMemo(() => normalizeSortModel(rawModel), [modelKey]);

  const primary = sortModel[0];
  const sortField = primary?.field ?? controlledSort?.field ?? '';
  const sortDirection = primary?.direction ?? controlledSort?.direction ?? emptyDirection;
  const derivedSort = useMemo<SortState>(() => ({ field: sortField, direction: sortDirection }), [sortField, sortDirection]);
  // A controlled single `sort` is returned as-is (same identity), like before multi-level sorting.
  const sort = controlledSortModel === undefined && controlledSort !== undefined ? controlledSort : derivedSort;

  const commit = useCallback(
    (model: ISortModelItem[], reported: SortState) => {
      if (!isControlled) {
        setInternalModel(model);
        if (model.length === 0) setEmptyDirection(reported.direction);
      }
      onSortModelChange?.(model);
      onSortChange?.(reported);
      setPage(1);
      setSortVersion((v) => v + 1);
    },
    [isControlled, onSortChange, onSortModelChange, setPage]
  );

  const setSort = useCallback((s: SortState) => commit(toModel(s), s), [commit]);

  const setSortModel = useCallback(
    (model: ISortModelItem[]) => {
      const next = normalizeSortModel(model);
      commit(next, next[0] ?? { field: '', direction: 'asc' });
    },
    [commit]
  );

  const handleSort = useCallback(
    (columnKey: string, direction?: 'asc' | 'desc' | null, options?: SortRequestOptions) => {
      setSortModel(computeNextSortModel(sortModel, columnKey, direction, options));
    },
    [sortModel, setSortModel]
  );

  const defaultModelKey = defaultSortModel ? sortModelKey(defaultSortModel) : undefined;
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the default model's content (defaultModelKey)
  const resetSort = useCallback(() => {
    if (defaultSortModel !== undefined) setSortModel(defaultSortModel);
    else setSort({ field: defaultSortField, direction: defaultSortDirection });
  }, [defaultModelKey, defaultSortField, defaultSortDirection, setSort, setSortModel]);

  const setInternalSort = useCallback<Dispatch<SetStateAction<SortState>>>(
    (action) => {
      setInternalModel((prev) => {
        const prevSort: SortState = prev[0] ?? { field: '', direction: 'asc' };
        const next = typeof action === 'function' ? action(prevSort) : action;
        if (!next.field) setEmptyDirection(next.direction);
        return toModel(next);
      });
    },
    []
  );

  return {
    sort,
    sortModel,
    setSort,
    setSortModel,
    handleSort,
    resetSort,
    defaultSortField,
    defaultSortDirection,
    sortVersion,
    setInternalSort,
    setInternalSortModel: setInternalModel,
  };
}
