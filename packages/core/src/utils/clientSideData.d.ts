import type { IColumnDef, IFilters } from '../types';
/**
 * Apply client-side filtering and sorting to data.
 * Extracted from useOGrid for testability and reuse.
 *
 * @param data - The full dataset to process
 * @param columns - Column definitions (used for filtering and sorting)
 * @param filters - Current filter state (discriminated FilterValue union)
 * @param sortBy - Column ID to sort by (optional)
 * @param sortDirection - Sort direction (optional)
 * @returns Filtered and sorted array
 */
export declare function processClientSideData<T>(data: T[], columns: IColumnDef<T>[], filters: IFilters, sortBy?: string, sortDirection?: 'asc' | 'desc'): T[];
