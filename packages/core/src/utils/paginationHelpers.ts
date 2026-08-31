/**
 * Shared pagination view model for the Radix and Fluent PaginationControls.
 * UI packages use this and render only presentation.
 */

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

/**
 * A page size: a row count, or `'all'` to show every row on a single page.
 * `'all'` is sticky — it resolves against the current filtered total, so the
 * page keeps showing everything when the dataset grows, shrinks, or refilters.
 */
export type PageSize = number | 'all';

/** Ensures the active pageSize is included in the options list, inserting it in sorted order if missing ('all' always sorts last). */
function ensurePageSizeInOptions(pageSize: PageSize, options: readonly PageSize[]): readonly PageSize[] {
  if (options.includes(pageSize)) return options;
  const numbers = options.filter((o): o is number => o !== 'all');
  if (typeof pageSize === 'number') numbers.push(pageSize);
  numbers.sort((a, b) => a - b);
  const hasAll = pageSize === 'all' || options.includes('all');
  return hasAll ? [...numbers, 'all'] : numbers;
}
export const MAX_PAGE_BUTTONS = 5;

export interface PaginationViewModel {
  totalPages: number;
  pageNumbers: number[];
  showStartEllipsis: boolean;
  showEndEllipsis: boolean;
  startItem: number;
  endItem: number;
  pageSizeOptions: readonly PageSize[];
}

/**
 * Returns a view model for pagination UI. Use in the Radix and Fluent PaginationControls
 * so page math lives in one place and components only render.
 */
export function getPaginationViewModel(
  currentPage: number,
  pageSize: PageSize,
  totalCount: number,
  options?: { maxPageButtons?: number; pageSizeOptions?: readonly PageSize[] }
): PaginationViewModel | null {
  if (totalCount <= 0) return null;

  // 'all' means one page holding the entire filtered dataset.
  const effectivePageSize = pageSize === 'all' ? totalCount : pageSize;

  const maxPageButtons = options?.maxPageButtons ?? MAX_PAGE_BUTTONS;
  const totalPages = Math.ceil(totalCount / effectivePageSize);

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

  // Clamp the page into range before computing the item window. Otherwise a
  // stale page (e.g. page 5 after a filter shrinks the data to 3 items) yields a
  // nonsensical range like "41–3 of 3".
  const clampedPage = Math.min(Math.max(1, currentPage), totalPages);
  const startItem = (clampedPage - 1) * effectivePageSize + 1;
  const endItem = Math.min(clampedPage * effectivePageSize, totalCount);

  return {
    totalPages,
    pageNumbers,
    showStartEllipsis,
    showEndEllipsis,
    startItem,
    endItem,
    pageSizeOptions: ensurePageSizeInOptions(pageSize, options?.pageSizeOptions ?? PAGE_SIZE_OPTIONS),
  };
}
