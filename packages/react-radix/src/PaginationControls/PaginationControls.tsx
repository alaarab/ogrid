import * as React from 'react';
import type { IPaginationControlsProps } from '@alaarab/ogrid-react';
import { usePaginationControls } from '@alaarab/ogrid-react';
import styles from './PaginationControls.module.scss';

export type { IPaginationControlsProps };

function ChevronLeft(): React.ReactElement {
  return <span aria-hidden>‹</span>;
}
function ChevronRight(): React.ReactElement {
  return <span aria-hidden>›</span>;
}
function ChevronDoubleLeft(): React.ReactElement {
  return <span aria-hidden>«</span>;
}
function ChevronDoubleRight(): React.ReactElement {
  return <span aria-hidden>»</span>;
}

export const PaginationControls: React.FC<IPaginationControlsProps> = React.memo((props) => {
  const { currentPage, pageSize, totalCount, onPageChange, onPageSizeChange, pageSizeOptions, entityLabelPlural, className } = props;

  const { labelPlural, vm, handlePageSizeChange } = usePaginationControls({
    currentPage,
    pageSize,
    totalCount,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions,
    entityLabelPlural,
  });

  const handlePageSizeChangeEvent = (e: React.ChangeEvent<HTMLSelectElement>) => {
    handlePageSizeChange(Number(e.target.value));
  };

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
        <button
          type="button"
          className={styles.navBtn}
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          aria-label="First page"
        >
          <ChevronDoubleLeft />
        </button>
        <button
          type="button"
          className={styles.navBtn}
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Previous page"
        >
          <ChevronLeft />
        </button>

        <div className={styles.pageNumbers}>
          {showStartEllipsis && (
            <>
              <button
                type="button"
                className={styles.pageBtn}
                onClick={() => onPageChange(1)}
                aria-label="Page 1"
              >
                1
              </button>
              <span className={styles.ellipsis} aria-hidden>
                …
              </span>
            </>
          )}
          {pageNumbers.map((pageNum) => (
            <button
              key={pageNum}
              type="button"
              className={`${styles.pageBtn} ${currentPage === pageNum ? styles.active : ''}`}
              onClick={() => onPageChange(pageNum)}
              aria-label={`Page ${pageNum}`}
              aria-current={currentPage === pageNum ? 'page' : undefined}
            >
              {pageNum}
            </button>
          ))}
          {showEndEllipsis && (
            <>
              <span className={styles.ellipsis} aria-hidden>
                …
              </span>
              <button
                type="button"
                className={styles.pageBtn}
                onClick={() => onPageChange(totalPages)}
                aria-label={`Page ${totalPages}`}
              >
                {totalPages}
              </button>
            </>
          )}
        </div>

        <button
          type="button"
          className={styles.navBtn}
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight />
        </button>
        <button
          type="button"
          className={styles.navBtn}
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage >= totalPages}
          aria-label="Last page"
        >
          <ChevronDoubleRight />
        </button>
      </div>

      <div className={styles.pageSizeSelector}>
        <span className={styles.pageSizeLabel}>Rows</span>
        <select
          className={styles.pageSizeSelect}
          value={String(pageSize)}
          onChange={handlePageSizeChangeEvent}
          aria-label="Rows per page"
        >
          {vm.pageSizeOptions.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
});

PaginationControls.displayName = 'PaginationControls';
