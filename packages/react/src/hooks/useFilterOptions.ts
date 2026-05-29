import { useState, useEffect, useCallback, useRef } from 'react';
import { useLatestRef } from './useLatestRef';
import type { IDataSource } from '../types/dataGridTypes';

export interface UseFilterOptionsResult {
  filterOptions: Record<string, string[]>;
  loadingOptions: Record<string, boolean>;
}

/** Accepted data source shapes for useFilterOptions. */
type FilterOptionsSource =
  | IDataSource<unknown>
  | { fetchFilterOptions?: (field: string) => Promise<string[]> };

/** Shallow-compare two string arrays by value. */
function fieldsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

const EMPTY_FILTER_OPTIONS: Record<string, string[]> = {};
const EMPTY_LOADING: Record<string, boolean> = {};

/**
 * Load filter options for the given fields from a data source.
 *
 * Accepts `IDataSource<T>` or a plain `{ fetchFilterOptions }` object.
 */
export function useFilterOptions(
  dataSource: FilterOptionsSource,
  fields: string[]
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

  const [filterOptions, setFilterOptions] = useState<Record<string, string[]>>(EMPTY_FILTER_OPTIONS);
  const [loadingOptions, setLoadingOptions] = useState<Record<string, boolean>>(EMPTY_LOADING);

  const load = useCallback(async (): Promise<void> => {
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
    const loading: Record<string, boolean> = {};
    stableFields.forEach((f) => { loading[f] = true; });
    setLoadingOptions(loading);

    const results: Record<string, string[]> = {};
    await Promise.all(
      stableFields.map(async (field) => {
        try {
          results[field] = await fetcher(field);
        } catch {
          results[field] = [];
        }
      })
    );

    setFilterOptions(results);
    setLoadingOptions(EMPTY_LOADING);
  }, [stableFields, dataSourceRef]);

  useEffect(() => {
    load().catch((err) => {
      // load() handles per-field fetch errors internally; this guards against an
      // unexpected throw in load itself. Surface it in dev, stay silent in prod.
      if (process.env.NODE_ENV !== 'production') {
        console.error('[OGrid] filter options load failed', err);
      }
    });
  }, [load]);

  return { filterOptions, loadingOptions };
}
