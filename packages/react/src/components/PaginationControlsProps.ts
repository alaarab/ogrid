/**
 * Shared props interface for PaginationControls across all React UI packages.
 * Each UI package renders its own framework-specific buttons, selects, and layout
 * but shares this common prop shape.
 */

export interface IPaginationControlsProps {
  currentPage: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
  entityLabelPlural?: string;
  className?: string;
}
