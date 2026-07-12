import { useState, useCallback, useMemo } from 'react';
import {
  mergeFilter,
  deriveFilterOptionsFromData,
  getMultiSelectFilterFields,
} from '../utils';
import { useFilterOptions } from './useFilterOptions';
import { useShallowEqualMemo } from './useShallowEqualMemo';
import type { IFilters, FilterValue, IDataSource } from '../types';
import type { IColumnDef as ICoreColumnDef } from '@alaarab/ogrid-core';

/** Deep-equal check for filter objects (shallow key+value comparison). */
function filtersEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of bKeys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

const EMPTY_LOADING_OPTIONS: Record<string, boolean> = {};
const EMPTY_DATA_SOURCE = { fetchFilterOptions: undefined } as const;

export interface UseOGridFiltersParams<T> {
  controlledFilters?: IFilters;
  /** Initial filters for the uncontrolled case (lazy-initialized). */
  initialFilters?: IFilters;
  onFiltersChange?: (f: IFilters) => void;
  setPage: (p: number) => void;
  columns: ICoreColumnDef<T>[];
  displayData: T[];
  dataSource?: IDataSource<T>;
}

export interface UseOGridFiltersState {
  filters: IFilters;
  setFilters: (f: IFilters) => void;
  handleFilterChange: (key: string, value: FilterValue | undefined) => void;
  stableFilters: IFilters;
  hasActiveFilters: boolean;
  clientFilterOptions: Record<string, string[]>;
  loadingFilterOptions: Record<string, boolean>;
}

/**
 * Manages filter state, filter options (client + server), and stabilized filter reference.
 * Resets to page 1 on filter change.
 */
export function useOGridFilters<T>(params: UseOGridFiltersParams<T>): UseOGridFiltersState {
  const { controlledFilters, initialFilters, onFiltersChange, setPage, columns, displayData, dataSource } = params;

  const [internalFilters, setInternalFilters] = useState<IFilters>(() => initialFilters ?? {});
  const filters = controlledFilters ?? internalFilters;

  const setFilters = useCallback(
    (f: IFilters) => {
      if (controlledFilters === undefined) setInternalFilters(f);
      onFiltersChange?.(f);
      setPage(1);
    },
    [controlledFilters, onFiltersChange, setPage]
  );

  const handleFilterChange = useCallback(
    (key: string, value: FilterValue | undefined) => {
      setFilters(mergeFilter(filters, key, value));
    },
    [filters, setFilters]
  );

  // Stabilize filters via shallow comparison so processClientSideData useMemo
  // doesn't re-run when the filter object reference changes but values are identical.
  const stableFilters = useShallowEqualMemo(
    filters,
    (a, b) => filtersEqual(a as Record<string, unknown>, b as Record<string, unknown>)
  );

  const hasActiveFilters = useMemo(
    () => Object.values(filters).some((v) => v !== undefined),
    [filters]
  );

  // --- Filter options (server or client-derived) ---
  const multiSelectFilterFields = useMemo(
    () => getMultiSelectFilterFields(columns),
    [columns]
  );

  const filterOptionsSource = dataSource ?? EMPTY_DATA_SOURCE;
  const { filterOptions: serverFilterOptions, loadingOptions: loadingFilterOptions } =
    useFilterOptions(filterOptionsSource, multiSelectFilterFields);

  const hasServerFilterOptions = dataSource?.fetchFilterOptions != null;
  const clientFilterOptions = useMemo(() => {
    if (hasServerFilterOptions) return serverFilterOptions;
    return deriveFilterOptionsFromData(displayData, columns);
  }, [hasServerFilterOptions, displayData, columns, serverFilterOptions]);

  return {
    filters,
    setFilters,
    handleFilterChange,
    stableFilters,
    hasActiveFilters,
    clientFilterOptions,
    loadingFilterOptions: dataSource?.fetchFilterOptions ? loadingFilterOptions : EMPTY_LOADING_OPTIONS,
  };
}
