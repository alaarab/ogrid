/**
 * Web Worker script for offloading sort/filter to a background thread.
 *
 * Operates on flat primitives (no IColumnDef references) so it can be
 * serialized into an inline Blob URL. The main thread sends a value matrix
 * and column metadata; the worker applies filters + sort and returns row indices.
 */

import {
  compareSortKeys,
  compareTimestamps,
  toDateTimestamp,
  toSortKey,
  createSortCollator,
  conditionFilterNeedsColumnValues,
  prepareConditionFilter,
  matchConditionFilter,
  compareSortLevels,
} from './sortFilterPrimitives';
import type { ConditionFilterInput, PreparedConditionFilter } from './sortFilterPrimitives';

// --- Worker message types ---

export interface SortFilterRequest {
  type: 'sort-filter';
  requestId: number;
  /** Flat value matrix: values[row][col] */
  values: (string | number | boolean | null)[][];
  /** Displayed text for active text filters, matched in addition to the raw value. */
  textValues?: Record<number, string[]>;
  /** Column metadata (only columns that participate in filter/sort). */
  columnMeta: { type: 'text' | 'numeric' | 'date' | 'boolean'; index: number }[];
  /** Active filters keyed by column index in the values matrix. */
  filters: Record<number,
    | { type: 'text'; value: string }
    | { type: 'multiSelect'; value: string[] }
    | { type: 'date'; value: { from?: string; to?: string } }
    | { type: 'condition'; value: ConditionFilterInput }
  >;
  /** Single-level sort spec (optional). Ignored when `sorts` is set. */
  sort?: { columnIndex: number; direction: 'asc' | 'desc' };
  /** Multi-level sort spec, primary first (optional). */
  sorts?: { columnIndex: number; direction: 'asc' | 'desc' }[];
}

export interface SortFilterResponse {
  type: 'sort-filter-result';
  requestId: number;
  /** Sorted/filtered row indices into the original data array. */
  indices: number[];
}

/**
 * The worker function body. This is stringified into an inline Blob URL
 * by the main-thread wrapper, so it must be fully self-contained.
 */
export function workerBody(): void {
  const ctx = self as unknown as Worker;
  const sortCollator = createSortCollator();

  // toDateTimestamp, toSortKey, compareSortKeys and compareTimestamps come
  // from ./sortFilterPrimitives: imported here for tests, and serialized into
  // the Blob ahead of this body by createSortFilterWorker.

  ctx.onmessage = (e: MessageEvent<SortFilterRequest>) => {
    const msg = e.data;
    if (msg.type !== 'sort-filter') return;

    const { requestId, values, filters, sort } = msg;
    const rowCount = values.length;
    const columnMeta = msg.columnMeta;

    // --- Filtering ---
    let indices: number[] = [];
    const filterEntries = Object.entries(filters);

    if (filterEntries.length === 0) {
      // No filters  -  all rows pass
      indices = new Array(rowCount);
      for (let i = 0; i < rowCount; i++) indices[i] = i;
    } else {
      // Pre-compute expensive filter structures once, outside the row loop.
      // Text filters: pre-trim/lowercase. MultiSelect filters: pre-build Set.
      const prepared = filterEntries.map(([key, filter]) => {
        const colIdx = Number(key);
        if (filter.type === 'text') {
          return { colIdx, type: 'text' as const, trimmed: filter.value.trim().toLowerCase() };
        }
        if (filter.type === 'multiSelect') {
          return { colIdx, type: 'multiSelect' as const, set: new Set(filter.value), empty: filter.value.length === 0 };
        }
        if (filter.type === 'condition') {
          // Top N / average need the whole column (before other filters), like the sync path.
          let columnValues: unknown[] | null = null;
          if (conditionFilterNeedsColumnValues(filter.value)) {
            columnValues = new Array(rowCount);
            for (let r = 0; r < rowCount; r++) columnValues[r] = values[r]?.[colIdx] ?? null;
          }
          return { colIdx, type: 'condition' as const, prepared: prepareConditionFilter(filter.value, columnValues) };
        }
        // Parse boundary timestamps once here; NaN means "no bound".
        return {
          colIdx,
          type: 'date' as const,
          fromTs: filter.value.from ? new Date(filter.value.from + 'T00:00:00Z').getTime() : NaN,
          toTs: filter.value.to ? new Date(filter.value.to + 'T23:59:59.999Z').getTime() : NaN,
        };
      });

      for (let r = 0; r < rowCount; r++) {
        const rowVals = values[r];
        if (rowVals === undefined) continue;
        let pass = true;
        for (let f = 0; f < prepared.length; f++) {
          const pf = prepared[f];
          if (pf === undefined) continue;
          const cellVal = rowVals[pf.colIdx];

          switch (pf.type) {
            case 'text': {
              // Match the raw value or the displayed text, like the sync path.
              if (
                pf.trimmed &&
                !String(cellVal ?? '').toLowerCase().includes(pf.trimmed) &&
                !(msg.textValues?.[pf.colIdx]?.[r] ?? '').toLowerCase().includes(pf.trimmed)
              ) {
                pass = false;
              }
              break;
            }
            case 'multiSelect': {
              // The empty-string option represents all blank cells in both paths.
              if (!pf.empty && !pf.set.has(String(cellVal ?? ''))) {
                pass = false;
              }
              break;
            }
            case 'condition': {
              const prepared: PreparedConditionFilter | null = pf.prepared;
              if (prepared && !matchConditionFilter(prepared, cellVal)) pass = false;
              break;
            }
            case 'date': {
              const ts = toDateTimestamp(cellVal);
              if (Number.isNaN(ts)) { pass = false; break; }
              if (!Number.isNaN(pf.fromTs) && ts < pf.fromTs) { pass = false; break; }
              if (!Number.isNaN(pf.toTs) && ts > pf.toTs) { pass = false; break; }
              break;
            }
          }
          if (!pass) break;
        }
        if (pass) indices.push(r);
      }
    }

    // --- Sorting ---
    // Each level's keys are computed once per row (not per comparison). Rows
    // compare level by level; Array#sort is stable, so full ties keep data order.
    const sortSpecs = msg.sorts ?? (sort ? [sort] : []);
    if (sortSpecs.length > 0) {
      const levels: [(string | number | undefined)[], boolean, number][] = [];
      for (let s = 0; s < sortSpecs.length; s++) {
        const spec = sortSpecs[s];
        if (spec === undefined) continue;
        const columnIndex = spec.columnIndex;
        let isDateSort = false;
        for (let i = 0; i < columnMeta.length; i++) {
          const meta = columnMeta[i];
          if (meta === undefined) continue;
          if (meta.index === columnIndex) {
            isDateSort = meta.type === 'date';
            break;
          }
        }
        // Date columns sort by timestamp like the sync path (lexical order is
        // wrong for non-ISO date strings); null/invalid stay NaN and group first.
        const keys: (string | number | undefined)[] = new Array(rowCount);
        for (let i = 0; i < indices.length; i++) {
          const r = indices[i];
          if (r === undefined) continue;
          const v = values[r]?.[columnIndex] ?? null;
          keys[r] = isDateSort ? toDateTimestamp(v) : toSortKey(v);
        }
        levels.push([keys, isDateSort, spec.direction === 'asc' ? 1 : -1]);
      }
      const first = levels[0];
      if (levels.length === 1 && first) {
        const [keys, isDate, dir] = first;
        indices.sort((a, b) => (isDate
          ? compareTimestamps(keys[a] as number, keys[b] as number)
          : compareSortKeys(keys[a], keys[b], sortCollator)) * dir);
      } else {
        indices.sort((a, b) => compareSortLevels(levels, a, b, sortCollator));
      }
    }

    const response: SortFilterResponse = {
      type: 'sort-filter-result',
      requestId,
      indices,
    };
    ctx.postMessage(response);
  };
}
