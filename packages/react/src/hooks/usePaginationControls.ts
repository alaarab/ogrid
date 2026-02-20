import { useMemo } from 'react';
import { getPaginationViewModel } from '../utils';

export interface UsePaginationControlsProps {
  currentPage: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
  entityLabelPlural?: string;
}

export interface UsePaginationControlsResult {
  labelPlural: string;
  vm: ReturnType<typeof getPaginationViewModel>;
  handlePageSizeChange: (pageSize: number) => void;
}

/**
 * Shared pagination controls logic for React UI packages.
 * Computes pagination view model and provides standardized handlers.
 */
export function usePaginationControls(props: UsePaginationControlsProps): UsePaginationControlsResult {
  const { currentPage, pageSize, totalCount, onPageSizeChange, pageSizeOptions, entityLabelPlural } = props;

  const labelPlural = entityLabelPlural ?? 'items';

  const vm = useMemo(
    () => getPaginationViewModel(currentPage, pageSize, totalCount, pageSizeOptions ? { pageSizeOptions } : undefined),
    [currentPage, pageSize, totalCount, pageSizeOptions]
  );

  return {
    labelPlural,
    vm,
    handlePageSizeChange: onPageSizeChange,
  };
}
