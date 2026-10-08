/**
 * Main-thread wrapper for the sort/filter Web Worker.
 * Falls back to synchronous processClientSideData when:
 *   - Worker API is unavailable (SSR, jsdom)
 *   - Sort column has a custom `compare` function
 */

import type { IColumnDef, IFilters, ISortModelItem } from '../types';
import { getCellValue } from './cellValue';
import { formatCellValue } from './cellFormatting';
import { getFilterField } from './ogridHelpers';
import { processClientSideData } from './clientSideData';
import { normalizeConditionFilter } from './conditionFilter';
import { normalizeSortModel } from './sortHelpers';
import type { SortFilterRequest, SortFilterResponse } from '../workers/sortFilterWorker';
import { workerBody } from '../workers/sortFilterWorker';
import { SORT_FILTER_PRIMITIVES } from '../workers/sortFilterPrimitives';

/**
 * Worker script: the shared primitives (as function declarations) followed by
 * the self-invoking worker body, which calls them by name.
 */
export function buildWorkerSource(): string {
  const prelude = SORT_FILTER_PRIMITIVES.map((fn) => fn.toString()).join('\n');
  return `${prelude}\n(${workerBody.toString()})()`;
}

let workerInstance: Worker | null = null;
/** Set once the worker errors before ever replying (e.g. CSP blocks blob: workers). */
let workerUnavailable = false;
let requestCounter = 0;
const pendingRequests = new Map<number, {
  resolve: (indices: number[]) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}>();

/**
 * A request that gets no reply within this window is rejected so callers can
 * fall back to the synchronous path instead of waiting forever.
 */
export const WORKER_REQUEST_TIMEOUT_MS = 30_000;

function rejectAllPending(err: Error): void {
  for (const [id, pending] of pendingRequests) {
    clearTimeout(pending.timer);
    pending.reject(err);
    pendingRequests.delete(id);
  }
}

/**
 * Create (or reuse) the sort/filter Web Worker from an inline Blob URL.
 * Returns null if the Worker API is unavailable.
 */
export function createSortFilterWorker(): Worker | null {
  if (workerInstance) return workerInstance;
  if (workerUnavailable) return null;

  if (typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined') {
    return null;
  }

  try {
    const blob = new Blob([buildWorkerSource()], { type: 'application/javascript' });
    let url: string | null = URL.createObjectURL(blob);
    const worker = new Worker(url);
    workerInstance = worker;
    let hasReplied = false;
    // Revoke only once the worker has loaded (first reply or error): revoking
    // before the script fetch completes can fail worker startup in some browsers.
    const releaseUrl = () => {
      if (url) {
        URL.revokeObjectURL(url);
        url = null;
      }
    };

    worker.onmessage = (e: MessageEvent<SortFilterResponse>) => {
      hasReplied = true;
      releaseUrl();
      const { requestId, indices } = e.data;
      const pending = pendingRequests.get(requestId);
      if (pending) {
        clearTimeout(pending.timer);
        pendingRequests.delete(requestId);
        pending.resolve(indices);
      }
    };

    worker.onmessageerror = () => {
      rejectAllPending(new Error('Worker message could not be deserialized'));
    };

    worker.onerror = (err) => {
      releaseUrl();
      if (!hasReplied) {
        // Never worked: stop retrying and use the sync path from now on.
        workerUnavailable = true;
        worker.terminate();
        if (workerInstance === worker) workerInstance = null;
      }
      rejectAllPending(new Error(err.message || 'Worker error'));
    };

    return workerInstance;
  } catch {
    return null;
  }
}

/**
 * Terminate the sort/filter worker and clean up.
 */
export function terminateSortFilterWorker(): void {
  if (workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
  }
  rejectAllPending(new Error('Worker terminated'));
}

/**
 * Build a flat value matrix from data and columns.
 * Each cell is extracted via getCellValue and coerced to a primitive.
 */
export function extractValueMatrix<T>(
  data: T[],
  columns: IColumnDef<T>[],
  /** Column indices to extract; others are left null. Defaults to all. */
  neededColumns?: ReadonlySet<number>,
  /**
   * Column indices read as text (text/multiSelect filters): Date values are
   * sent as String(date), like the sync path, instead of as timestamps.
   */
  stringColumns?: ReadonlySet<number>,
  /** Optional text-filter columns to populate with formatted values during extraction. */
  textValues?: Record<number, string[]>,
): (string | number | boolean | null)[][] {
  const needed = columns.map((_, i) => !neededColumns || neededColumns.has(i));
  const matrix: (string | number | boolean | null)[][] = new Array(data.length);
  for (let r = 0; r < data.length; r++) {
    const row = new Array(columns.length);
    const item = data[r];
    if (item === undefined) {
      row.fill(null);
      matrix[r] = row;
      continue;
    }
    for (let c = 0; c < columns.length; c++) {
      const col = columns[c];
      if (col === undefined) {
        row[c] = null;
        continue;
      }
      if (!needed[c]) {
        row[c] = null;
        continue;
      }
      const val = getCellValue(item, col);
      const textColumn = textValues?.[c];
      if (textColumn) textColumn[r] = formatCellValue(val, item, col) ?? '';
      if (val == null) {
        row[c] = null;
      } else if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
        row[c] = val;
      } else if (val instanceof Date && col.type === 'date' && !stringColumns?.has(c)) {
        row[c] = val.getTime();
      } else {
        row[c] = String(val);
      }
    }
    matrix[r] = row;
  }
  return matrix;
}

/**
 * Async version of processClientSideData that offloads to a Web Worker.
 *
 * Falls back to synchronous processing when:
 *   - Worker API is unavailable
 *   - Sort column has a custom `compare` function (not serializable)
 *   - A people filter is active, or there is nothing to filter or sort
 */
export function processClientSideDataAsync<T>(
  data: T[],
  columns: IColumnDef<T>[],
  filters: IFilters,
  sortBy?: string | readonly ISortModelItem[],
  sortDirection?: 'asc' | 'desc'
): Promise<T[]> {
  const sync = () => Promise.resolve(processClientSideData(data, columns, filters, sortBy, sortDirection));
  const sortLevels = normalizeSortModel(sortBy, sortDirection);

  // A sort column with a custom compare isn't serializable to the worker.
  for (const level of sortLevels) {
    if (columns.find((c) => c.columnId === level.field)?.compare) return sync();
  }

  // Only the filtered/sorted columns are sent, packed into a compact matrix
  // (worker column index = position in workerColumns).
  const workerColumns: IColumnDef<T>[] = [];
  const workerColumnOf = (col: IColumnDef<T>): number => {
    const existing = workerColumns.indexOf(col);
    return existing >= 0 ? existing : workerColumns.push(col) - 1;
  };
  // Worker columns read as text: Dates must be String()-ed like the sync path.
  const stringColumns = new Set<number>();

  // Build filter map keyed by worker column index. Empty text/multiSelect
  // filters are no-ops in both paths, so they are not sent.
  const workerFilters: SortFilterRequest['filters'] = {};
  for (const col of columns) {
    const val = filters[getFilterField(col)];
    if (!val) continue;

    switch (val.type) {
      case 'text':
        if (!val.value.trim()) break;
        stringColumns.add(workerColumnOf(col));
        workerFilters[workerColumnOf(col)] = { type: 'text', value: val.value };
        break;
      case 'multiSelect':
        if (val.value.length === 0) break;
        stringColumns.add(workerColumnOf(col));
        workerFilters[workerColumnOf(col)] = { type: 'multiSelect', value: val.value };
        break;
      case 'date':
        workerFilters[workerColumnOf(col)] = { type: 'date', value: { from: val.value.from, to: val.value.to } };
        break;
      case 'condition': {
        const condition = normalizeConditionFilter(val.value);
        if (!condition) break;
        // Text conditions read the column as text, like the sync path's String(value).
        if (condition.kind === 'text') stringColumns.add(workerColumnOf(col));
        workerFilters[workerColumnOf(col)] = { type: 'condition', value: condition };
        break;
      }
      // 'people' filter has a UserLike object  -  fall back to sync
      case 'people':
        return sync();
    }
  }

  // Build sort spec. A sort column that isn't a column def (sync sorts by the
  // raw field) or that is also read as text (it needs both a string and a
  // timestamp) stays on the sync path.
  const sorts: NonNullable<SortFilterRequest['sorts']> = [];
  for (const level of sortLevels) {
    let sortCol: IColumnDef<T> | undefined;
    for (const col of columns) if (col.columnId === level.field) sortCol = col;
    if (!sortCol) return sync();
    const sortColIdx = workerColumnOf(sortCol);
    if (stringColumns.has(sortColIdx) && sortCol.type === 'date') return sync();
    sorts.push({ columnIndex: sortColIdx, direction: level.direction });
  }
  const sort: SortFilterRequest['sort'] = sorts.length === 1 ? sorts[0] : undefined;

  // Nothing to filter or sort: the sync path returns the data as-is.
  if (workerColumns.length === 0) return sync();

  const worker = createSortFilterWorker();
  if (!worker) return sync();

  const columnMeta = workerColumns.map((col, idx) => ({
    type: col.type ?? 'text' as const,
    index: idx,
  }));
  // Active text filters also match the displayed text (keyed by worker column).
  const textValues: Record<number, string[]> = {};
  for (const [key, filter] of Object.entries(workerFilters)) {
    if (filter.type === 'text' && filter.value.trim()) textValues[Number(key)] = new Array(data.length);
  }
  const values = extractValueMatrix(data, workerColumns, undefined, stringColumns, textValues);

  const requestId = ++requestCounter;

  return new Promise<T[]>((resolve, reject) => {
    pendingRequests.set(requestId, {
      resolve: (indices) => {
        const result = new Array<T>(indices.length);
        for (let i = 0; i < indices.length; i++) {
          const idx = indices[i];
          if (idx === undefined) continue;
          const item = data[idx];
          if (item === undefined) continue;
          result[i] = item;
        }
        resolve(result);
      },
      reject,
      timer: setTimeout(() => {
        if (pendingRequests.delete(requestId)) {
          reject(new Error('Worker sort/filter timed out'));
        }
      }, WORKER_REQUEST_TIMEOUT_MS),
    });

    const request: SortFilterRequest = {
      type: 'sort-filter',
      requestId,
      values,
      textValues,
      columnMeta,
      filters: workerFilters,
      sort,
      ...(sorts.length > 1 ? { sorts } : {}),
    };

    worker.postMessage(request);
  });
}
