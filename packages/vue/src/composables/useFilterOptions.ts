import { ref, watch, computed, type Ref } from 'vue';
import type { IDataSource } from '../types';

export interface UseFilterOptionsResult {
  filterOptions: Ref<Record<string, string[]>>;
  loadingOptions: Ref<Record<string, boolean>>;
}

/** Accepted data source shapes for useFilterOptions. */
type FilterOptionsSource =
  | IDataSource<unknown>
  | { fetchFilterOptions?: (field: string) => Promise<string[]> };

/**
 * Load filter options for the given fields from a data source.
 */
export function useFilterOptions(
  dataSource: Ref<FilterOptionsSource>,
  fields: Ref<string[]>
): UseFilterOptionsResult {
  const filterOptions = ref<Record<string, string[]>>({});
  const loadingOptions = ref<Record<string, boolean>>({});

  const fieldsKey = computed(() => [...fields.value].sort().join(','));

  const load = async (): Promise<void> => {
    const ds = dataSource.value;
    const currentFields = fields.value;
    const fetcher =
      'fetchFilterOptions' in ds && typeof ds.fetchFilterOptions === 'function'
        ? ds.fetchFilterOptions.bind(ds)
        : undefined;

    if (!fetcher) {
      filterOptions.value = {};
      loadingOptions.value = {};
      return;
    }
    const loading: Record<string, boolean> = {};
    currentFields.forEach((f) => { loading[f] = true; });
    loadingOptions.value = loading;

    const results: Record<string, string[]> = {};
    await Promise.all(
      currentFields.map(async (field) => {
        try {
          results[field] = await fetcher(field);
        } catch {
          results[field] = [];
        }
      })
    );

    filterOptions.value = results;
    loadingOptions.value = {};
  };

  watch([dataSource, fieldsKey], () => {
    load().catch(() => {});
  }, { immediate: true });

  return { filterOptions, loadingOptions };
}
