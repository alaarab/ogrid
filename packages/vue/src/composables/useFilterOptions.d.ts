import { type Ref } from 'vue';
import type { IDataSource } from '../types';
export interface UseFilterOptionsResult {
    filterOptions: Ref<Record<string, string[]>>;
    loadingOptions: Ref<Record<string, boolean>>;
}
/** Accepted data source shapes for useFilterOptions. */
type FilterOptionsSource = IDataSource<unknown> | {
    fetchFilterOptions?: (field: string) => Promise<string[]>;
};
/**
 * Load filter options for the given fields from a data source.
 */
export declare function useFilterOptions(dataSource: Ref<FilterOptionsSource>, fields: Ref<string[]>): UseFilterOptionsResult;
export {};
