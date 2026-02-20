import { useState, useEffect, useCallback, useRef } from 'react';
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

  const [filterOptions, setFilterOptions] = useState<Record<string, string[]>>({});
  const [loadingOptions, setLoadingOptions] = useState<Record<string, boolean>>({});

  const load = useCallback(async (): Promise<void> => {
    const fetcher =
      'fetchFilterOptions' in dataSource && typeof dataSource.fetchFilterOptions === 'function'
        ? dataSource.fetchFilterOptions.bind(dataSource)
        : undefined;

    if (!fetcher) {
      setFilterOptions({});
      setLoadingOptions({});
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
    setLoadingOptions({});
  }, [dataSource, stableFields]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  return { filterOptions, loadingOptions };
}
