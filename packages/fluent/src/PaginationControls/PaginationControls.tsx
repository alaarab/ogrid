import * as React from 'react';
import { useMemo, useCallback } from 'react';
import { Button, Select } from '@fluentui/react-components';
import type { SelectOnChangeData } from '@fluentui/react-components';
import {
  ChevronLeftRegular,
  ChevronRightRegular,
  ChevronDoubleLeftRegular,
  ChevronDoubleRightRegular,
} from '@fluentui/react-icons';
import { getPaginationViewModel } from '@alaarab/ogrid-core';
import styles from './PaginationControls.module.scss';

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

export const PaginationControls: React.FC<IPaginationControlsProps> = React.memo((props) => {
  const { currentPage, pageSize, totalCount, onPageChange, onPageSizeChange, pageSizeOptions, entityLabelPlural, className } = props;
  const labelPlural = entityLabelPlural ?? 'items';

  const vm = useMemo(
    () => getPaginationViewModel(currentPage, pageSize, totalCount, pageSizeOptions ? { pageSizeOptions } : undefined),
    [currentPage, pageSize, totalCount, pageSizeOptions]
  );

  const handlePageSizeChange = useCallback(
    (_e: React.ChangeEvent<HTMLSelectElement>, data: SelectOnChangeData) => {
      onPageSizeChange(Number(data.value));
    },
    [onPageSizeChange]
  );

  if (!vm) {
    return null;
  }

  const { pageNumbers, showStartEllipsis, showEndEllipsis, totalPages, startItem, endItem } = vm;

  return (
    <div className={`${styles.pagination} ${className || ''}`} role="navigation" aria-label="Pagination">
      <div className={styles.paginationInfo}>
        Showing {startItem} to {endItem} of {totalCount.toLocaleString()} {labelPlural}
      </div>

      <div className={styles.paginationControls}>
        <Button appearance="outline" shape="circular" size="small" icon={<ChevronDoubleLeftRegular />} onClick={() => onPageChange(1)} disabled={currentPage === 1} aria-label="First page" className={styles.navBtn} />
        <Button appearance="outline" shape="circular" size="small" icon={<ChevronLeftRegular />} onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} aria-label="Previous page" className={styles.navBtn} />

        <div className={styles.pageNumbers}>
          {showStartEllipsis && (
            <>
              <Button appearance="outline" size="small" shape="rounded" onClick={() => onPageChange(1)} aria-label="Page 1" className={styles.pageBtn}>1</Button>
              <span className={styles.ellipsis} aria-hidden>…</span>
            </>
          )}
          {pageNumbers.map((pageNum) => (
            <Button
              key={pageNum}
              appearance={currentPage === pageNum ? 'primary' : 'outline'}
              size="small"
              shape="rounded"
              onClick={() => onPageChange(pageNum)}
              aria-label={`Page ${pageNum}`}
              aria-current={currentPage === pageNum ? 'page' : undefined}
              className={styles.pageBtn}
            >
              {pageNum}
            </Button>
          ))}
          {showEndEllipsis && (
            <>
              <span className={styles.ellipsis} aria-hidden>…</span>
              <Button appearance="outline" size="small" shape="rounded" onClick={() => onPageChange(totalPages)} aria-label={`Page ${totalPages}`} className={styles.pageBtn}>{totalPages}</Button>
            </>
          )}
        </div>

        <Button appearance="outline" shape="circular" size="small" icon={<ChevronRightRegular />} onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages} aria-label="Next page" className={styles.navBtn} />
        <Button appearance="outline" shape="circular" size="small" icon={<ChevronDoubleRightRegular />} onClick={() => onPageChange(totalPages)} disabled={currentPage >= totalPages} aria-label="Last page" className={styles.navBtn} />
      </div>

      <div className={styles.pageSizeSelector}>
        <span className={styles.pageSizeLabel}>Rows</span>
        <Select value={String(pageSize)} onChange={handlePageSizeChange} size="small" appearance="outline" aria-label="Rows per page" className={styles.pageSizeSelect}>
          {vm.pageSizeOptions.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </Select>
      </div>
    </div>
  );
});
