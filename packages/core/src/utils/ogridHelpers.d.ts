import type { IColumnDef, IFilters, FilterValue } from '../types';
/** Resolve the filter field key for a column (filterField or columnId). */
export declare function getFilterField<T>(col: IColumnDef<T>): string;
/** Merge a single filter change into a full IFilters object. Strips empty values automatically. */
export declare function mergeFilter(prev: IFilters, key: string, value: FilterValue | undefined): IFilters;
/** Derive filter options for multiSelect columns from client-side data. */
export declare function deriveFilterOptionsFromData<T>(items: T[], columns: IColumnDef<T>[]): Record<string, string[]>;
/** Get list of filter fields that use multiSelect (for useFilterOptions). */
export declare function getMultiSelectFilterFields<T>(columns: IColumnDef<T>[]): string[];
