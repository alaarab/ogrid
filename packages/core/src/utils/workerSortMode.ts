import type { IColumnDef, IFilters } from '../types';

/** Shared row-count threshold used by workerSort='auto'. */
export const DEFAULT_WORKER_SORT_AUTO_THRESHOLD = 5000;

export interface WorkerSortModeOptions<T> {
  columns?: IColumnDef<T>[];
  filters?: IFilters;
  sortBy?: string;
}

/** Resolves whether client-side worker sort should be enabled for the current dataset. */
export function shouldUseWorkerSort<T>(
  workerSort: boolean | 'auto' | undefined,
  rowCount: number,
  options?: WorkerSortModeOptions<T>,
): boolean {
  const requested = workerSort === true || (workerSort === 'auto' && rowCount > DEFAULT_WORKER_SORT_AUTO_THRESHOLD);
  if (!requested) return false;

  if (options?.filters && Object.values(options.filters).some((filter) => filter?.type === 'people')) {
    return false;
  }

  if (options?.sortBy && options.columns) {
    const sortColumn = options.columns.find((column) => column.columnId === options.sortBy);
    if (sortColumn?.compare) {
      return false;
    }
  }

  return true;
}
