/**
 * Shared pagination view model for Fluent, Material, and Radix PaginationControls.
 * UI packages use this and render only presentation.
 */
export declare const PAGE_SIZE_OPTIONS: readonly [10, 25, 50, 100];
export declare const MAX_PAGE_BUTTONS = 5;
export interface PaginationViewModel {
    totalPages: number;
    pageNumbers: number[];
    showStartEllipsis: boolean;
    showEndEllipsis: boolean;
    startItem: number;
    endItem: number;
    pageSizeOptions: readonly number[];
}
/**
 * Returns a view model for pagination UI. Use in Fluent/Material/Radix PaginationControls
 * so page math lives in one place and components only render.
 */
export declare function getPaginationViewModel(currentPage: number, pageSize: number, totalCount: number, options?: {
    maxPageButtons?: number;
    pageSizeOptions?: readonly number[];
}): PaginationViewModel | null;
