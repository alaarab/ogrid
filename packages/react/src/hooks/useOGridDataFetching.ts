import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { processClientSideData } from '../utils';
import {
  processClientSideDataAsync,
  shouldUseWorkerSort,
  isWindowedDataSource,
  WindowedRowCache,
} from '@alaarab/ogrid-core';
import { useLatestRef } from './useLatestRef';
import { useDataSourceVersion } from './useDataSourceVersion';
import { applySnapshot, createResortTracker, createSnapshot, trackResort } from './rowOrderSnapshot';
import type { ResortInputs, ResortTracker, RowOrderSnapshot } from './rowOrderSnapshot';
import type { IFilters, IDataSource, WindowedDataState } from '../types';
import type { IColumnDef as ICoreColumnDef, WindowedRow, PageSize } from '@alaarab/ogrid-core';

/** One page of rows; `'all'` yields the entire (filtered, sorted) dataset. */
function pageWindow<T>(rows: T[], page: number, pageSize: PageSize): T[] {
  if (pageSize === 'all') return rows;
  const start = (page - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

// WindowedDataState is defined alongside IOGridDataGridProps in ../types (the
// grid consumes it as a prop). Re-exported here so existing imports from this
// module keep resolving.
export type { WindowedDataState } from '../types';

export interface UseOGridDataFetchingParams<T> {
  isServerSide: boolean;
  dataSource?: IDataSource<T>;
  /**
   * When set, the data source counts as replaced (refetch, new windowed cache)
   * only when this key changes, so an inline `dataSource` object never
   * refetches on re-render. When omitted, a source whose own properties are
   * all identical to the previous render's is the same source.
   */
  dataSourceKey?: string | number;
  displayData: T[];
  /**
   * Row identity. When `displayData` changes, rows are re-sorted/re-filtered
   * unless it looks like an edit, whose order is preserved: some row objects
   * are unchanged (immutable updates touch only the edited rows) or
   * `editVersionRef` moved since the last data change. With `getRowId` the
   * snapshot is kept by id, so inserts and deletes keep the order too: rows
   * still present stay in place, removed rows drop out, and new rows that pass
   * the current filters are appended at the end in source order. Without it,
   * the snapshot is positional and any length change re-sorts.
   */
  getRowId?: (row: T) => unknown;
  /**
   * Bumped by the caller whenever the grid emits an edit. When the host then
   * replaces every row object (immutable bulk edit, single-row data) with ids
   * unchanged, it's still treated as an edit and keeps its order.
   */
  editVersionRef?: { readonly current: number };
  columns: ICoreColumnDef<T>[];
  stableFilters: IFilters;
  sort: { field: string; direction: 'asc' | 'desc' };
  /**
   * Increments when the user explicitly changes the sort (not on data edits).
   * Used to apply sort as a snapshot: re-sort only on explicit sort actions,
   * not on every cell edit - matching Excel behavior.
   */
  sortVersion: number;
  page: number;
  pageSize: PageSize;
  /**
   * Whether client-side results are paginated (default: true).
   *
   * When `false`, the client-side path skips the page slice: `displayItems` is
   * the full sorted/filtered dataset and `displayTotalCount` is its full count.
   * This is the full-dataset virtualization mode — the grid virtual-scrolls the
   * entire dataset instead of one page. Ignored in server-side mode, where the
   * `dataSource` always controls windowing.
   */
  paginate?: boolean;
  onError?: (err: unknown) => void;
  onFirstDataRendered?: () => void;
  /** Worker sort mode: true=always, 'auto'=when data > 5000 rows, false=sync. */
  workerSort?: boolean | 'auto';
}

export interface UseOGridDataFetchingState<T> {
  /**
   * Client-side only: every filtered + sorted row, before the page slice.
   * Empty in server-side mode (the full set isn't loaded).
   */
  allFilteredItems: T[];
  displayItems: T[];
  displayTotalCount: number;
  serverLoading: boolean;
  /** True while worker-sort mode is waiting for its first result (no rows to show yet). */
  workerPending: boolean;
  refreshData: () => void;
  /**
   * Windowed (lazy) data-source accessors. Populated only when `dataSource`
   * implements the windowed contract (`getRowCount` + `getRows`); otherwise
   * `windowed` is `null`. The virtualized render path reads `getRow(index)`
   * for each visible row and calls `requestWindow(start, end)` as the viewport
   * moves. In windowed mode `displayItems` stays empty and `displayTotalCount`
   * mirrors `windowed.rowCount`.
   */
  windowed: WindowedDataState<T> | null;
}

/**
 * Manages data fetching (server-side) and client-side filtering/sorting/pagination.
 * Fires onFirstDataRendered once when items first appear.
 *
 * Sort behavior: sorting is applied as a snapshot when the user explicitly sorts
 * (sortVersion increments). Subsequent data edits preserve row order rather than
 * re-sorting - matching Excel behavior where edited rows stay in place.
 */
const EMPTY_ROWS: readonly unknown[] = Object.freeze([]);

export function useOGridDataFetching<T>(params: UseOGridDataFetchingParams<T>): UseOGridDataFetchingState<T> {
  const {
    isServerSide, dataSource, dataSourceKey, displayData, getRowId, columns, stableFilters,
    sort, sortVersion, page, pageSize, paginate = true, onError, onFirstDataRendered, workerSort,
    editVersionRef,
  } = params;
  const editVersion = editVersionRef?.current ?? 0;

  const isClientSide = !isServerSide;
  // Held in a ref: callers may pass an inline getRowId, which must not
  // retrigger the worker effect on every render.
  const getRowIdRef = useLatestRef(getRowId);

  // Determine if worker sort should be used
  const useWorker = shouldUseWorkerSort(workerSort, displayData.length, {
    columns,
    filters: stableFilters,
    sortBy: sort.field,
  });

  // --- Stable sorted order (snapshot) ---
  // The sorted + filtered order is kept as a snapshot (see rowOrderSnapshot.ts):
  // row ids when `getRowId` is provided, positions into `displayData` otherwise.
  // When data changes because of edits (sortVersion unchanged), the snapshot is
  // re-applied to the new row objects - preserving order without re-sorting;
  // by id, inserts and deletes keep that order as well. When sort/filters/columns
  // change (sortVersion increments or filters/columns change), the snapshot is
  // rebuilt from a full re-sort. Rows only move when the user explicitly sorts.
  const snapshotRef = useRef<RowOrderSnapshot<T> | null>(null);
  const resortTrackerRef = useRef<ResortTracker<T>>(createResortTracker<T>());
  const resortInputs: ResortInputs = {
    sortVersion, filters: stableFilters, columns, sortField: sort.field, sortDirection: sort.direction,
  };
  // Full re-sort due (see trackResort): the snapshot is dropped and rebuilt in the memo below.
  if (trackResort(resortTrackerRef.current, resortInputs, displayData, editVersion, snapshotRef.current, getRowIdRef.current)) {
    snapshotRef.current = null;
  }

  // Current filters only (no sort): applied to rows inserted since the snapshot
  // was taken, so a new row that doesn't match stays hidden.
  const filterRows = useCallback(
    (rows: T[]) => processClientSideData(rows, columns, stableFilters),
    [columns, stableFilters],
  );

  // --- Client-side filtering & sorting (sync path) ---
  // biome-ignore lint/correctness/useExhaustiveDependencies: sortVersion is a deliberate invalidation trigger — it is consumed via trackResort/snapshotRef above, so the memo must recompute when it bumps even though it is not read inside
  const clientItemsAndTotal = useMemo(() => {
    if (!isClientSide || useWorker) return null;

    // Data changed (edit, insert, delete) but the sort order is preserved:
    // re-apply the snapshot to the current row objects. `null` means the
    // snapshot was invalidated above or can't be applied (duplicate ids, a
    // replaced dataset) and a full re-sort is due.
    const snapshot = snapshotRef.current;
    const applied = snapshot ? applySnapshot(snapshot, displayData, getRowIdRef.current, filterRows) : null;
    let orderedRows: T[];
    if (applied) {
      snapshotRef.current = applied.snapshot;
      orderedRows = applied.rows;
    } else {
      // Full re-sort against the current displayData; the snapshot remembers
      // the resulting order so later edits can look up the updated rows.
      orderedRows = processClientSideData(displayData, columns, stableFilters, sort.field, sort.direction);
      snapshotRef.current = createSnapshot(displayData, orderedRows, getRowIdRef.current);
    }

    const total = orderedRows.length;
    // Full-dataset virtualization (paginate=false): return every row so the
    // grid virtual-scrolls the whole dataset instead of a single page.
    if (!paginate) {
      return { items: orderedRows, totalCount: total, all: orderedRows };
    }
    return { items: pageWindow(orderedRows, page, pageSize), totalCount: total, all: orderedRows };
    // Note: sortVersion is implicitly tracked via trackResort / snapshotRef.current === null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClientSide, useWorker, displayData, columns, stableFilters, sortVersion, sort.field, sort.direction, page, pageSize, paginate, filterRows, getRowIdRef]);

  // Stabilize callback refs so inline dataSource/onError don't cause infinite re-fetches.
  const dataSourceRef = useLatestRef(dataSource);
  // Changes when the dataSource is replaced (or dataSourceKey changes), so
  // swapping backends refetches and rebuilds the windowed cache. An inline
  // object with the same methods is not a swap (see useDataSourceVersion).
  const dataSourceVersion = useDataSourceVersion(dataSource, dataSourceKey);
  const onErrorRef = useLatestRef(onError);

  // --- Client-side filtering & sorting (async worker path) ---
  const [asyncItems, setAsyncItems] = useState<{ items: T[]; totalCount: number; all: T[] } | null>(null);
  const asyncIdRef = useRef(0);
  const asyncSnapshotRef = useRef<RowOrderSnapshot<T> | null>(null);
  const asyncResortTrackerRef = useRef<ResortTracker<T>>(createResortTracker<T>());

  // biome-ignore lint/correctness/useExhaustiveDependencies: getRowIdRef.current and editVersionRef.current are latest-value refs read on purpose; depending on them would re-run the worker effect for inline getRowId functions and on every edit
  useEffect(() => {
    if (!isClientSide || !useWorker) {
      setAsyncItems(null);
      return;
    }

    const asyncInputs: ResortInputs = {
      sortVersion, filters: stableFilters, columns, sortField: sort.field, sortDirection: sort.direction,
    };
    if (trackResort(asyncResortTrackerRef.current, asyncInputs, displayData, editVersionRef?.current ?? 0, asyncSnapshotRef.current, getRowIdRef.current)) {
      asyncSnapshotRef.current = null;
    }

    const id = ++asyncIdRef.current;

    const commitRows = (rows: T[]) => {
      const total = rows.length;
      if (!paginate) {
        setAsyncItems({ items: rows, totalCount: total, all: rows });
        return;
      }
      setAsyncItems({ items: pageWindow(rows, page, pageSize), totalCount: total, all: rows });
    };

    // Preserve order: re-apply the snapshot to the current row objects (sync,
    // O(n) by id or position - no worker round trip needed). `null` means a
    // full re-sort is due (invalidated above, duplicate ids, replaced dataset).
    const snapshot = asyncSnapshotRef.current;
    const applied = snapshot ? applySnapshot(snapshot, displayData, getRowIdRef.current, filterRows) : null;
    if (applied) {
      asyncSnapshotRef.current = applied.snapshot;
      commitRows(applied.rows);
    } else {
      const commitSorted = (rows: T[]) => {
        asyncSnapshotRef.current = createSnapshot(displayData, rows, getRowIdRef.current);
        commitRows(rows);
      };

      // Full re-sort via worker.
      processClientSideDataAsync(
        displayData,
        columns as Parameters<typeof processClientSideDataAsync>[1],
        stableFilters,
        sort.field,
        sort.direction,
      ).then((rows) => {
        if (id !== asyncIdRef.current) return; // stale
        commitSorted(rows as T[]);
      }).catch((err) => {
        if (id !== asyncIdRef.current) return; // stale
        // Worker failed at runtime: report and fall back to synchronous
        // processing so the grid still updates instead of keeping stale rows.
        onErrorRef.current?.(err);
        commitSorted(processClientSideData(displayData, columns, stableFilters, sort.field, sort.direction));
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClientSide, useWorker, displayData, columns, stableFilters, sortVersion, sort.field, sort.direction, page, pageSize, paginate, onErrorRef, filterRows]);

  // --- Server-side data fetching ---
  const [serverItems, setServerItems] = useState<T[]>([]);
  const [serverTotalCount, setServerTotalCount] = useState(0);
  const [serverLoading, setServerLoading] = useState(true);
  const fetchIdRef = useRef(0);
  const [refreshCounter, setRefreshCounter] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshCounter and dataSourceVersion are deliberate re-fetch triggers (bumped by the imperative refresh API); it is not read inside the effect
  useEffect(() => {
    const ds = dataSourceRef.current;
    // A windowed data source (getRowCount + getRows) is driven by the
    // windowed-cache path below, not this page-based fetch effect. A source
    // with no `fetchPage` at all also skips this effect. In either case the
    // page-based path stays idle and clears its loading flag.
    const fetchPage = ds && !isWindowedDataSource(ds) && typeof ds.fetchPage === 'function'
      ? ds.fetchPage.bind(ds)
      : null;
    if (!isServerSide || !fetchPage) {
      setServerLoading(false);
      return;
    }
    const id = ++fetchIdRef.current;
    const controller = new AbortController();
    setServerLoading(true);
    fetchPage({
        // IFetchParams is numeric; 'all' asks the source for everything.
        page, pageSize: pageSize === 'all' ? Number.MAX_SAFE_INTEGER : pageSize,
        sort: { field: sort.field, direction: sort.direction },
        filters: stableFilters,
        signal: controller.signal,
      })
      .then((res) => {
        if (id !== fetchIdRef.current || controller.signal.aborted) return;
        setServerItems(res.items);
        setServerTotalCount(res.totalCount);
      })
      .catch((err) => {
        if (id !== fetchIdRef.current || controller.signal.aborted) return;
        onErrorRef.current?.(err);
        setServerItems([]);
        setServerTotalCount(0);
      })
      .finally(() => {
        if (id === fetchIdRef.current && !controller.signal.aborted) setServerLoading(false);
      });
    return () => {
      controller.abort();
    };
  }, [isServerSide, page, pageSize, sort.field, sort.direction, stableFilters, refreshCounter, dataSourceVersion, dataSourceRef, onErrorRef]);

  // --- Windowed (lazy) data source ---
  // When the data source implements the windowed contract (getRowCount +
  // getRows), the grid fetches only the visible row window on demand instead
  // of whole pages. A WindowedRowCache holds fetched rows, dedupes in-flight
  // fetches, and serves loading placeholders; `windowedTick` forces a re-render
  // when the cache changes so the virtualized render path re-reads its rows.
  const isWindowed = isServerSide && isWindowedDataSource(dataSource);
  const [windowedTick, setWindowedTick] = useState(0);
  const [windowedRowCount, setWindowedRowCount] = useState(0);
  const windowedCacheRef = useRef<WindowedRowCache<T> | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: isWindowed and dataSourceVersion are deliberate triggers so the cache is re-created when the data-source mode or identity changes (see note below); the effect reads the source via dataSourceRef instead
  useEffect(() => {
    const ds = dataSourceRef.current;
    if (!isServerSide || !isWindowedDataSource(ds)) {
      windowedCacheRef.current?.dispose();
      windowedCacheRef.current = null;
      return;
    }
    const cache = new WindowedRowCache<T>({
      dataSource: ds,
      onChange: () => {
        // The count is unknown between an invalidate and the new total: keep
        // the previous one so the grid doesn't collapse (and lose its scroll
        // position) while the recount is in flight.
        const count = cache.getRowCount();
        if (count !== undefined) setWindowedRowCount(count);
        setWindowedTick((t) => t + 1);
      },
    });
    windowedCacheRef.current = cache;
    return () => {
      cache.dispose();
      if (windowedCacheRef.current === cache) windowedCacheRef.current = null;
    };
    // Re-create the cache only when the data source identity or mode changes.
  }, [isServerSide, isWindowed, dataSourceVersion, dataSourceRef]);

  // Re-fetch the row count whenever sort or filters change, on refresh, and
  // for a freshly created cache (dataSource swap), then re-request the window
  // the grid last asked for: setContext drops every cached row, and the
  // grid's own requestWindow effect only re-runs when the visible range moves.
  //
  // Depend on a content key, not `stableFilters` identity. Not every caller
  // guarantees a referentially stable filters object across renders; keying the
  // effect on identity would re-run it every render, and each run calls
  // `cache.setContext` -> `invalidate` -> `onChange` -> `setWindowedTick`,
  // producing an infinite render loop. A content string only changes when the
  // filters actually change.
  const windowedFiltersKey = JSON.stringify(stableFilters);
  const lastWindowRef = useRef<{ start: number; end: number } | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: stableFilters is intentionally tracked via its content key windowedFiltersKey (see note above) to avoid an identity-driven render loop; isWindowed, refreshCounter and dataSourceVersion are deliberate re-run triggers (this effect runs after the cache-creation effect above, so a swapped source gets the current context)
  useEffect(() => {
    const cache = windowedCacheRef.current;
    if (!cache) return;
    cache.setContext({
      sort: { field: sort.field, direction: sort.direction },
      filters: stableFilters,
    });
    const last = lastWindowRef.current;
    if (last) cache.ensureRange(last.start, last.end);
    // stableFilters is read but intentionally excluded from deps in favour of
    // windowedFiltersKey (its content-stable string form).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWindowed, sort.field, sort.direction, windowedFiltersKey, refreshCounter, dataSourceVersion]);

  const requestWindow = useCallback((start: number, end: number) => {
    lastWindowRef.current = { start, end };
    windowedCacheRef.current?.ensureRange(start, end);
  }, []);
  const getWindowedRow = useCallback(
    (index: number): WindowedRow<T> =>
      windowedCacheRef.current?.getRow(index) ?? { status: 'loading' },
    []
  );
  const retryWindowedRow = useCallback((index: number) => {
    windowedCacheRef.current?.retry(index);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: windowedTick is a deliberate invalidation trigger so consumers re-read cached rows after a fetch resolves; it is not read inside the memo
  const windowed = useMemo<WindowedDataState<T> | null>(() => {
    if (!isWindowed) return null;
    // Sparse, index-addressed snapshot of the loaded rows (holes where rows
    // are still loading). Keyboard navigation, clipboard, editing and row
    // selection read rows by absolute index, so they work over this window.
    const loadedRows: T[] = [];
    loadedRows.length = windowedRowCount;
    windowedCacheRef.current?.forEachLoadedRow((row, index) => {
      if (index < windowedRowCount) loadedRows[index] = row;
    });
    return {
      rowCount: windowedRowCount,
      getRow: getWindowedRow,
      requestWindow,
      retryRow: retryWindowedRow,
      loadedRows,
    };
    // windowedTick is a dependency so consumers re-read rows after a fetch resolves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWindowed, windowedRowCount, windowedTick, getWindowedRow, requestWindow, retryWindowedRow]);

  const clientResult = clientItemsAndTotal ?? asyncItems;
  const displayItems = isClientSide && clientResult ? clientResult.items : serverItems;
  const allFilteredItems = isClientSide && clientResult ? clientResult.all : EMPTY_ROWS as T[];
  const displayTotalCount = isWindowed
    ? windowedRowCount
    : isClientSide && clientResult
      ? clientResult.totalCount
      : serverTotalCount;

  // Fire onFirstDataRendered once when the grid first has data
  const onFirstDataRenderedRef = useLatestRef(onFirstDataRendered);
  const firstDataRenderedRef = useRef(false);
  useEffect(() => {
    if (!firstDataRenderedRef.current && displayItems.length > 0) {
      firstDataRenderedRef.current = true;
      onFirstDataRenderedRef.current?.();
    }
  }, [displayItems.length, onFirstDataRenderedRef]);

  const refreshData = useCallback(() => setRefreshCounter((prev) => prev + 1), []);

  return {
    displayItems,
    allFilteredItems,
    displayTotalCount,
    serverLoading,
    workerPending: isClientSide && useWorker && clientResult === null,
    refreshData,
    windowed,
  };
}
