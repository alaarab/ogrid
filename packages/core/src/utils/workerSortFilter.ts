/**
 * Main-thread wrapper for the sort/filter Web Worker.
 * Falls back to synchronous processClientSideData when:
 *   - Worker API is unavailable (SSR, jsdom)
 *   - Sort column has a custom `compare` function
 */

import type { IColumnDef, IFilters } from '../types';
import { getCellValue } from './cellValue';
import { getFilterField } from './ogridHelpers';
import { processClientSideData } from './clientSideData';
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
      if (val == null) {
        row[c] = null;
      } else if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
        row[c] = val;
      } else if (val instanceof Date && col.type === 'date') {
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
 */
export function processClientSideDataAsync<T>(
  data: T[],
  columns: IColumnDef<T>[],
  filters: IFilters,
  sortBy?: string,
  sortDirection?: 'asc' | 'desc'
): Promise<T[]> {
  // Check if sort column has custom compare (not serializable to worker)
  if (sortBy) {
    const sortCol = columns.find(c => c.columnId === sortBy);
    if (sortCol?.compare) {
      return Promise.resolve(processClientSideData(data, columns, filters, sortBy, sortDirection));
    }
  }

  const worker = createSortFilterWorker();
  if (!worker) {
    return Promise.resolve(processClientSideData(data, columns, filters, sortBy, sortDirection));
  }

  // Build column index map and value matrix
  const columnIndexMap = new Map<string, number>();
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    if (col === undefined) continue;
    columnIndexMap.set(col.columnId, i);
  }

  // Build column metadata
  const columnMeta = columns.map((col, idx) => ({
    type: col.type ?? 'text' as const,
    index: idx,
  }));

  // Build filter map keyed by column index
  const workerFilters: SortFilterRequest['filters'] = {};
  for (const col of columns) {
    const filterKey = getFilterField(col);
    const val = filters[filterKey];
    if (!val) continue;
    const colIdx = columnIndexMap.get(col.columnId);
    if (colIdx === undefined) continue;

    switch (val.type) {
      case 'text':
        workerFilters[colIdx] = { type: 'text', value: val.value };
        break;
      case 'multiSelect':
        workerFilters[colIdx] = { type: 'multiSelect', value: val.value };
        break;
      case 'date':
        workerFilters[colIdx] = { type: 'date', value: { from: val.value.from, to: val.value.to } };
        break;
      // 'people' filter has a UserLike object  -  fall back to sync
      case 'people':
        return Promise.resolve(processClientSideData(data, columns, filters, sortBy, sortDirection));
    }
  }

  // Build sort spec
  let sort: SortFilterRequest['sort'];
  if (sortBy) {
    const sortColIdx = columnIndexMap.get(sortBy);
    if (sortColIdx !== undefined) {
      sort = { columnIndex: sortColIdx, direction: sortDirection ?? 'asc' };
    }
  }

  // Only filtered/sorted columns are read by the worker; skip the rest.
  const neededColumns = new Set<number>(Object.keys(workerFilters).map(Number));
  if (sort) neededColumns.add(sort.columnIndex);
  const values = extractValueMatrix(data, columns, neededColumns);

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
      columnMeta,
      filters: workerFilters,
      sort,
    };

    worker.postMessage(request);
  });
}
