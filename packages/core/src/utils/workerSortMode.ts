import type { IColumnDef, IFilters, ISortModelItem } from '../types';

/** Shared row-count threshold used by workerSort='auto'. */
export const DEFAULT_WORKER_SORT_AUTO_THRESHOLD = 5000;

export interface WorkerSortModeOptions<T> {
  columns?: IColumnDef<T>[];
  filters?: IFilters;
  sortBy?: string;
  /** Multi-level sort; every level is checked for a custom `compare`. */
  sortModel?: readonly ISortModelItem[];
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

  if (options?.columns) {
    const fields = options.sortModel ? options.sortModel.map((level) => level.field) : [];
    if (options.sortBy) fields.push(options.sortBy);
    for (const field of fields) {
      if (options.columns.find((column) => column.columnId === field)?.compare) return false;
    }
  }

  return true;
}
