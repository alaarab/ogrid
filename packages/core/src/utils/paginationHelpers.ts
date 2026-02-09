/**
 * Shared pagination view model for Fluent, Material, and Radix PaginationControls.
 * UI packages use this and render only presentation.
 */

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
export const MAX_PAGE_BUTTONS = 5;

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
export function getPaginationViewModel(
  currentPage: number,
  pageSize: number,
  totalCount: number,
  options?: { maxPageButtons?: number; pageSizeOptions?: readonly number[] }
): PaginationViewModel | null {
  if (totalCount <= 0) return null;

  const maxPageButtons = options?.maxPageButtons ?? MAX_PAGE_BUTTONS;
  const totalPages = Math.ceil(totalCount / pageSize);

  let pageNumbers: number[];
  let showStartEllipsis: boolean;
  let showEndEllipsis: boolean;

  if (totalPages <= maxPageButtons) {
    pageNumbers = [];
    for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
    showStartEllipsis = false;
    showEndEllipsis = false;
  } else {
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, currentPage + 2);
    if (end - start + 1 < maxPageButtons) {
      if (start === 1) end = Math.min(totalPages, start + maxPageButtons - 1);
      else if (end === totalPages) start = Math.max(1, end - maxPageButtons + 1);
    }
    pageNumbers = [];
    for (let i = start; i <= end; i++) pageNumbers.push(i);
    showStartEllipsis = start > 1;
    showEndEllipsis = end < totalPages;
  }

  const startItem = Math.max(1, (currentPage - 1) * pageSize + 1);
  const endItem = Math.min(currentPage * pageSize, totalCount);

  return {
    totalPages,
    pageNumbers,
    showStartEllipsis,
    showEndEllipsis,
    startItem,
    endItem,
    pageSizeOptions: options?.pageSizeOptions ?? PAGE_SIZE_OPTIONS,
  };
}
