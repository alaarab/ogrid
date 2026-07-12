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

let workerInstance: Worker | null = null;
let requestCounter = 0;
const pendingRequests = new Map<number, {
  resolve: (indices: number[]) => void;
  reject: (err: Error) => void;
}>();

/**
 * Create (or reuse) the sort/filter Web Worker from an inline Blob URL.
 * Returns null if the Worker API is unavailable.
 */
export function createSortFilterWorker(): Worker | null {
  if (workerInstance) return workerInstance;

  if (typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined') {
    return null;
  }

  try {
    const fnStr = workerBody.toString();
    const blob = new Blob(
      [`(${fnStr})()`],
      { type: 'application/javascript' }
    );
    const url = URL.createObjectURL(blob);
    workerInstance = new Worker(url);
    URL.revokeObjectURL(url);

    workerInstance.onmessage = (e: MessageEvent<SortFilterResponse>) => {
      const { requestId, indices } = e.data;
      const pending = pendingRequests.get(requestId);
      if (pending) {
        pendingRequests.delete(requestId);
        pending.resolve(indices);
      }
    };

    workerInstance.onerror = (err) => {
      // Reject all pending requests
      for (const [id, pending] of pendingRequests) {
        pending.reject(new Error(err.message || 'Worker error'));
        pendingRequests.delete(id);
      }
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
  // Reject any pending requests
  for (const [id, pending] of pendingRequests) {
    pending.reject(new Error('Worker terminated'));
    pendingRequests.delete(id);
  }
}

/**
 * Build a flat value matrix from data and columns.
 * Each cell is extracted via getCellValue and coerced to a primitive.
 */
export function extractValueMatrix<T>(
  data: T[],
  columns: IColumnDef<T>[]
): (string | number | boolean | null)[][] {
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
      const val = getCellValue(item, col);
      if (val == null) {
        row[c] = null;
      } else if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
        row[c] = val;
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

  const values = extractValueMatrix(data, columns);

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
