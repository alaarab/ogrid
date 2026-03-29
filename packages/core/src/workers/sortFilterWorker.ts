/**
 * Web Worker script for offloading sort/filter to a background thread.
 *
 * Operates on flat primitives (no IColumnDef references) so it can be
 * serialized into an inline Blob URL. The main thread sends a value matrix
 * and column metadata; the worker applies filters + sort and returns row indices.
 */

// --- Worker message types ---

export interface SortFilterRequest {
  type: 'sort-filter';
  requestId: number;
  /** Flat value matrix: values[row][col] */
  values: (string | number | boolean | null)[][];
  /** Column metadata (only columns that participate in filter/sort). */
  columnMeta: { type: 'text' | 'numeric' | 'date' | 'boolean'; index: number }[];
  /** Active filters keyed by column index in the values matrix. */
  filters: Record<number,
    | { type: 'text'; value: string }
    | { type: 'multiSelect'; value: string[] }
    | { type: 'date'; value: { from?: string; to?: string } }
  >;
  /** Sort spec (optional). */
  sort?: { columnIndex: number; direction: 'asc' | 'desc' };
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

  ctx.onmessage = (e: MessageEvent<SortFilterRequest>) => {
    const msg = e.data;
    if (msg.type !== 'sort-filter') return;

    const { requestId, values, filters, sort } = msg;
    const rowCount = values.length;

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
        return { colIdx, type: 'date' as const, from: filter.value.from, to: filter.value.to };
      });

      for (let r = 0; r < rowCount; r++) {
        let pass = true;
        for (let f = 0; f < prepared.length; f++) {
          const pf = prepared[f];
          const cellVal = values[r][pf.colIdx];

          switch (pf.type) {
            case 'text': {
              if (pf.trimmed && !String(cellVal ?? '').toLowerCase().includes(pf.trimmed)) {
                pass = false;
              }
              break;
            }
            case 'multiSelect': {
              if (!pf.empty && !pf.set.has(String(cellVal ?? ''))) {
                pass = false;
              }
              break;
            }
            case 'date': {
              if (cellVal == null) { pass = false; break; }
              const ts = new Date(String(cellVal)).getTime();
              if (Number.isNaN(ts)) { pass = false; break; }
              if (pf.from) {
                const fromTs = new Date(pf.from + 'T00:00:00').getTime();
                if (ts < fromTs) { pass = false; break; }
              }
              if (pf.to) {
                const toTs = new Date(pf.to + 'T23:59:59.999').getTime();
                if (ts > toTs) { pass = false; break; }
              }
              break;
            }
          }
          if (!pass) break;
        }
        if (pass) indices.push(r);
      }
    }

    // --- Sorting ---
    if (sort) {
      const { columnIndex, direction } = sort;
      const dir = direction === 'asc' ? 1 : -1;

      indices.sort((a, b) => {
        const av = values[a][columnIndex];
        const bv = values[b][columnIndex];
        if (av == null && bv == null) return 0;
        if (av == null) return -1 * dir;
        if (bv == null) return 1 * dir;
        if (typeof av === 'number' && typeof bv === 'number') {
          return av === bv ? 0 : av > bv ? dir : -dir;
        }
        const sa = String(av).toLowerCase();
        const sb = String(bv).toLowerCase();
        return sa === sb ? 0 : sa > sb ? dir : -dir;
      });
    }

    const response: SortFilterResponse = {
      type: 'sort-filter-result',
      requestId,
      indices,
    };
    ctx.postMessage(response);
  };
}
