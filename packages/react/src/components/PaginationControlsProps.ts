/**
 * Shared props interface for PaginationControls across all React UI packages.
 * Each UI package renders its own framework-specific buttons, selects, and layout
 * but shares this common prop shape.
 */

import type { PageSize } from '@alaarab/ogrid-core';

export interface IPaginationControlsProps {
  currentPage: number;
  pageSize: PageSize;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: PageSize) => void;
  pageSizeOptions?: PageSize[];
  entityLabelPlural?: string;
  className?: string;
}
