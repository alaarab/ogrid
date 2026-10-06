import type { FilterOption } from '@alaarab/ogrid-core';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLatestRef } from './useLatestRef';
import { useDataSourceVersion } from './useDataSourceVersion';
import type { IDataSource } from '../types/dataGridTypes';

export interface UseFilterOptionsResult {
  filterOptions: Record<string, FilterOption[]>;
  loadingOptions: Record<string, boolean>;
}

/** Accepted data source shapes for useFilterOptions. */
type FilterOptionsSource =
  | IDataSource<unknown>
  | { fetchFilterOptions?: (field: string) => Promise<FilterOption[]> };

/** Shallow-compare two string arrays by value. */
function fieldsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

const EMPTY_FILTER_OPTIONS: Record<string, FilterOption[]> = {};
const EMPTY_LOADING: Record<string, boolean> = {};

/**
 * Load filter options for the given fields from a data source.
 *
 * Accepts `IDataSource<T>` or a plain `{ fetchFilterOptions }` object.
 */
export interface UseFilterOptionsOptions {
  /**
   * Identity of the data source: options reload only when it changes, so the
   * source may be an inline object. When omitted, a new object whose own
   * properties are all identical to the previous one's does not reload.
   */
  dataSourceKey?: string | number;
}

export function useFilterOptions(
  dataSource: FilterOptionsSource,
  fields: string[],
  options?: UseFilterOptionsOptions
): UseFilterOptionsResult {
  // Stabilize the fields array so inline literals (e.g. ['a','b']) don't
  // cause infinite re-render loops via useCallback/useEffect deps.
  const fieldsRef = useRef(fields);
  if (!fieldsEqual(fieldsRef.current, fields)) {
    fieldsRef.current = fields;
  }
  const stableFields = fieldsRef.current;

  // Stabilize dataSource ref so inline objects don't cause infinite re-fetches.
  const dataSourceRef = useLatestRef(dataSource);
  // ...but reload when a memoized dataSource is swapped for another one.
  const dataSourceVersion = useDataSourceVersion(dataSource, options?.dataSourceKey);

  const [filterOptions, setFilterOptions] = useState<Record<string, FilterOption[]>>(EMPTY_FILTER_OPTIONS);
  const [loadingOptions, setLoadingOptions] = useState<Record<string, boolean>>(EMPTY_LOADING);

  // Monotonic id so a slower load for an older dataSource/fields can't overwrite
  // a newer one, and so completions after unmount are ignored.
  const loadRequestIdRef = useRef(0);
  useEffect(
    () => () => {
      loadRequestIdRef.current++;
    },
    []
  );

  // The source version the current options came from: a swapped source must
  // not keep offering the previous source's values while its own load runs.
  const optionsVersionRef = useRef(dataSourceVersion);

  const load = useCallback(async (): Promise<void> => {
    const requestId = ++loadRequestIdRef.current;
    const ds = dataSourceRef.current;
    const fetcher =
      'fetchFilterOptions' in ds && typeof ds.fetchFilterOptions === 'function'
        ? ds.fetchFilterOptions.bind(ds)
        : undefined;

    if (!fetcher) {
      // Use stable references to avoid unnecessary re-renders
      setFilterOptions(EMPTY_FILTER_OPTIONS);
      setLoadingOptions(EMPTY_LOADING);
      return;
    }
    const sourceChanged = optionsVersionRef.current !== dataSourceVersion;
    optionsVersionRef.current = dataSourceVersion;
    // Keep loaded options only for fields that remain, and only from the same source.
    setFilterOptions((prev) => {
      if (sourceChanged) return EMPTY_FILTER_OPTIONS;
      const kept: Record<string, FilterOption[]> = {};
      for (const f of stableFields) {
        const options = prev[f];
        if (options) kept[f] = options;
      }
      return kept;
    });
    const loading: Record<string, boolean> = {};
    stableFields.forEach((f) => { loading[f] = true; });
    setLoadingOptions(loading);

    // Each field shows its options as soon as they arrive; a newer load (or
    // unmount) bumps the request id and discards everything still in flight.
    await Promise.all(
      stableFields.map(async (field) => {
        let options: FilterOption[];
        try {
          options = await fetcher(field);
        } catch {
          options = [];
        }
        if (requestId !== loadRequestIdRef.current) return;
        setFilterOptions((prev) => ({ ...prev, [field]: options }));
        setLoadingOptions((prev) => {
          if (!prev[field]) return prev;
          const { [field]: _done, ...rest } = prev;
          return Object.keys(rest).length > 0 ? rest : EMPTY_LOADING;
        });
      })
    );
  }, [stableFields, dataSourceRef, dataSourceVersion]);

  useEffect(() => {
    load().catch((err) => {
      // load() handles per-field fetch errors internally; this guards against an
      // unexpected throw in load itself. Surface it in dev, stay silent in prod.
      if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
        console.error('[OGrid] filter options load failed', err);
      }
    });
  }, [load]);

  return { filterOptions, loadingOptions };
}
