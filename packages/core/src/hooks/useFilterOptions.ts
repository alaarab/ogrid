import { useState, useEffect, useCallback } from 'react';
import type { IDataSource } from '../types/dataGridTypes';

export interface UseFilterOptionsResult {
  filterOptions: Record<string, string[]>;
  loadingOptions: Record<string, boolean>;
}

/** Accepted data source shapes for useFilterOptions. */
type FilterOptionsSource =
  | IDataSource<unknown>
  | { fetchFilterOptions?: (field: string) => Promise<string[]> };

/**
 * Load filter options for the given fields from a data source.
 *
 * Accepts `IDataSource<T>` or a plain `{ fetchFilterOptions }` object.
 */
export function useFilterOptions(
  dataSource: FilterOptionsSource,
  fields: string[]
): UseFilterOptionsResult {
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
    fields.forEach((f) => { loading[f] = true; });
    setLoadingOptions(loading);

    const results: Record<string, string[]> = {};
    await Promise.all(
      fields.map(async (field) => {
        try {
          results[field] = await fetcher(field);
        } catch (e) {
          console.error(`Error loading filter options for ${field}:`, e);
          results[field] = [];
        }
      })
    );

    setFilterOptions(results);
    setLoadingOptions({});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSource, fields.slice().sort().join(',')]);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  return { filterOptions, loadingOptions };
}
