import type { FilterOption } from '@alaarab/ogrid-core';
import { useState, useCallback, useMemo, type Dispatch, type SetStateAction } from 'react';
import {
  mergeFilter,
  deriveFilterOptionsFromData,
  getMultiSelectFilterFields,
} from '../utils';
import { useFilterOptions } from './useFilterOptions';
import { useShallowEqualMemo } from './useShallowEqualMemo';
import type { IFilters, FilterValue, IDataSource } from '../types';
import type { IColumnDef as ICoreColumnDef } from '@alaarab/ogrid-core';

/** Structural equality for filter values (`{ type, value }` objects, arrays, dates, user objects). */
function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (!valuesEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) return false;
  }
  return true;
}

/** Deep-equal check for filter objects, so inline controlled filters don't churn identity. */
function filtersEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  return valuesEqual(a, b);
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
  /** See IOGridServerProps.dataSourceKey: filter options reload only when it changes. */
  dataSourceKey?: string | number;
}

export interface UseOGridFiltersState {
  filters: IFilters;
  setFilters: (f: IFilters) => void;
  handleFilterChange: (key: string, value: FilterValue | undefined) => void;
  stableFilters: IFilters;
  hasActiveFilters: boolean;
  clientFilterOptions: Record<string, FilterOption[]>;
  loadingFilterOptions: Record<string, boolean>;
  /**
   * Raw setter for the uncontrolled filters. Writes state without notifying
   * `onFiltersChange` or resetting the page, so callers restoring previously
   * captured filters (sheet-scoped state) don't report them back as a user edit.
   */
  setInternalFilters: Dispatch<SetStateAction<IFilters>>;
}

/**
 * Manages filter state, filter options (client + server), and stabilized filter reference.
 * Resets to page 1 on filter change.
 */
export function useOGridFilters<T>(params: UseOGridFiltersParams<T>): UseOGridFiltersState {
  const { controlledFilters, initialFilters, onFiltersChange, setPage, columns, displayData, dataSource, dataSourceKey } = params;

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
    useFilterOptions(filterOptionsSource, multiSelectFilterFields, { dataSourceKey });

  const hasServerFilterOptions = dataSource?.fetchFilterOptions != null;
  const clientFilterOptions = useMemo(() => {
    const options: Record<string, FilterOption[]> = {
      ...(hasServerFilterOptions ? serverFilterOptions : deriveFilterOptionsFromData(displayData, columns)),
    };
    for (const column of columns) {
      if (column.filterable?.type === 'multiSelect' && column.filterable.options !== undefined) {
        options[column.filterable.filterField ?? column.columnId] = column.filterable.options;
      }
    }
    return options;
  }, [hasServerFilterOptions, displayData, columns, serverFilterOptions]);

  return {
    filters,
    setFilters,
    handleFilterChange,
    stableFilters,
    hasActiveFilters,
    clientFilterOptions,
    loadingFilterOptions: dataSource?.fetchFilterOptions ? loadingFilterOptions : EMPTY_LOADING_OPTIONS,
    setInternalFilters,
  };
}
