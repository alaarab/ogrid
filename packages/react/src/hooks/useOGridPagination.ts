import { useState, useCallback, type Dispatch, type SetStateAction } from 'react';

export interface UseOGridPaginationParams {
  controlledPage?: number;
  controlledPageSize?: number;
  defaultPageSize: number;
  /** Initial page for the uncontrolled case (lazy-initialized; default 1). */
  initialPage?: number;
  onPageChange?: (p: number) => void;
  onPageSizeChange?: (size: number) => void;
}

export interface UseOGridPaginationState {
  page: number;
  pageSize: number;
  setPage: (p: number) => void;
  setPageSize: (size: number) => void;
  /**
   * Raw setter for the uncontrolled page. Writes state without notifying
   * `onPageChange`, so callers restoring a previously captured page
   * (sheet-scoped state) don't report it back as a user page change.
   */
  setInternalPage: Dispatch<SetStateAction<number>>;
}

/**
 * Manages pagination state with controlled/uncontrolled dual-mode support.
 * Resets to page 1 when page size changes.
 */
export function useOGridPagination(params: UseOGridPaginationParams): UseOGridPaginationState {
  const { controlledPage, controlledPageSize, defaultPageSize, initialPage, onPageChange, onPageSizeChange } = params;

  const [internalPage, setInternalPage] = useState(() => initialPage ?? 1);
  const [internalPageSize, setInternalPageSize] = useState(defaultPageSize);

  const page = controlledPage ?? internalPage;
  const pageSize = controlledPageSize ?? internalPageSize;

  const setPage = useCallback(
    (p: number) => {
      if (controlledPage === undefined) setInternalPage(p);
      onPageChange?.(p);
    },
    [controlledPage, onPageChange]
  );

  const setPageSize = useCallback(
    (size: number) => {
      if (controlledPageSize === undefined) setInternalPageSize(size);
      onPageSizeChange?.(size);
      setPage(1);
    },
    [controlledPageSize, onPageSizeChange, setPage]
  );

  return { page, pageSize, setPage, setPageSize, setInternalPage };
}
