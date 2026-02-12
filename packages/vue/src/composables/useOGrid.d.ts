import { type Ref } from 'vue';
import type { SideBarProps } from '../components/SideBar';
import type { IOGridProps, IOGridDataGridProps, IOGridApi, IFilters, IColumnDefinition } from '../types';
/** Resolved column chooser placement. */
export type ColumnChooserPlacement = 'toolbar' | 'sidebar' | 'none';
/** Pagination state and handlers. */
export interface UseOGridPagination {
    page: number;
    pageSize: number;
    displayTotalCount: number;
    setPage: (p: number) => void;
    setPageSize: (size: number) => void;
    pageSizeOptions?: number[];
    entityLabelPlural: string;
}
/** Column chooser state and handlers. */
export interface UseOGridColumnChooser {
    columns: IColumnDefinition[];
    visibleColumns: Set<string>;
    onVisibilityChange: (columnKey: string, isVisible: boolean) => void;
    placement: ColumnChooserPlacement;
}
/** Layout / chrome configuration. */
export interface UseOGridLayout {
    toolbar: unknown;
    toolbarBelow: unknown;
    className?: string;
    emptyState?: {
        message?: unknown;
        render?: () => unknown;
    };
    sideBarProps: SideBarProps | null;
}
/** Filter state. */
export interface UseOGridFilters {
    hasActiveFilters: boolean;
    setFilters: (f: IFilters) => void;
}
export interface UseOGridResult<T> {
    dataGridProps: Ref<IOGridDataGridProps<T>>;
    pagination: Ref<UseOGridPagination>;
    columnChooser: Ref<UseOGridColumnChooser>;
    layout: Ref<UseOGridLayout>;
    filters: Ref<UseOGridFilters>;
    /** Imperative API object for programmatic grid control. */
    api: Ref<IOGridApi<T>>;
}
/**
 * Top-level orchestration composable for OGrid: manages pagination, sorting, filtering,
 * column visibility, and sidebar.
 */
export declare function useOGrid<T>(props: Ref<IOGridProps<T>>): UseOGridResult<T>;
