import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { processClientSideData } from '../utils';
import {
  processClientSideDataAsync,
  shouldUseWorkerSort,
  isWindowedDataSource,
  WindowedRowCache,
} from '@alaarab/ogrid-core';
import { useLatestRef } from './useLatestRef';
import { useIdentityVersion } from './useIdentityVersion';
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
  displayData: T[];
  /**
   * Row identity. When `displayData` changes, rows are re-sorted/re-filtered
   * unless every position still holds the same row (by id): that's a cell
   * edit, whose order is preserved. Without it, a new array whose rows are
   * all new objects counts as a replacement.
   */
  getRowId?: (row: T) => unknown;
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

/**
 * True when `next` looks like `prev` after in-place cell edits (same rows at
 * the same positions) rather than a different dataset. Edits keep the snapshot
 * sort order; a different dataset of the same length must be re-sorted and
 * re-filtered.
 */
function isSameRowSet<T>(prev: readonly T[], next: readonly T[], getRowId?: (row: T) => unknown): boolean {
  if (prev === next) return true;
  if (prev.length !== next.length) return false;
  let shared = 0;
  for (let i = 0; i < next.length; i++) {
    const a = prev[i];
    const b = next[i];
    if (a === b) {
      shared++;
      continue;
    }
    if (getRowId && a !== undefined && b !== undefined && getRowId(a) !== getRowId(b)) return false;
  }
  // Without ids: an edit replaces some row objects; a new dataset replaces all.
  return getRowId !== undefined || next.length === 0 || shared > 0;
}

export function useOGridDataFetching<T>(params: UseOGridDataFetchingParams<T>): UseOGridDataFetchingState<T> {
  const {
    isServerSide, dataSource, displayData, getRowId, columns, stableFilters,
    sort, sortVersion, page, pageSize, paginate = true, onError, onFirstDataRendered, workerSort,
  } = params;

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

  // --- Stable sorted order (index-based) ---
  // We store the sorted order as indices into `displayData` (at sort time). When data changes
  // due to cell edits (sortVersion unchanged), we reuse the same indices to look up updated
  // row objects - preserving order without re-sorting. When sort/filters change (sortVersion
  // increments or filters/columns change), we rebuild the index array.
  //
  // Index-based approach is safe for cell edits: the edited row is at the same position in
  // displayData, so the same index points to the (possibly mutated or replaced) row object.
  // Rows are only moved when the user explicitly sorts.
  const sortedIndicesRef = useRef<number[] | null>(null);
  const prevSortVersionRef = useRef(-1); // -1 forces initial build
  const prevFiltersRef = useRef<IFilters | null>(null);
  const prevColumnsRef = useRef<ICoreColumnDef<T>[] | null>(null);
  const prevDataRef = useRef<T[] | null>(null);
  const prevSortFieldRef = useRef<string | null>(null);
  const prevSortDirectionRef = useRef<'asc' | 'desc' | null>(null);

  // Detect when a full re-sort is needed.
  // sort.field/direction are checked alongside sortVersion so controlled-sort
  // changes (host swaps the `sort` prop without going through `setSort`) still
  // invalidate the cached sorted indices.
  const needsResort =
    sortVersion !== prevSortVersionRef.current ||
    stableFilters !== prevFiltersRef.current ||
    columns !== prevColumnsRef.current ||
    prevDataRef.current === null ||
    !isSameRowSet(prevDataRef.current, displayData, getRowIdRef.current) ||
    sort.field !== prevSortFieldRef.current ||
    sort.direction !== prevSortDirectionRef.current;

  if (needsResort) {
    prevSortVersionRef.current = sortVersion;
    prevFiltersRef.current = stableFilters;
    prevColumnsRef.current = columns;
    prevSortFieldRef.current = sort.field;
    prevSortDirectionRef.current = sort.direction;
    sortedIndicesRef.current = null; // will be built in memo
  }
  prevDataRef.current = displayData;

  // --- Client-side filtering & sorting (sync path) ---
  // biome-ignore lint/correctness/useExhaustiveDependencies: sortVersion is a deliberate invalidation trigger — it is consumed via needsResort/sortedIndicesRef above, so the memo must recompute when it bumps even though it is not read inside
  const clientItemsAndTotal = useMemo(() => {
    if (!isClientSide || useWorker) return null;

    let orderedRows: T[];

    if (sortedIndicesRef.current === null) {
      // Full re-sort: run processClientSideData to get sorted rows, then derive indices.
      // We compute sorted rows against the current displayData and store their positions
      // (indices in displayData) so subsequent edits can look up updated row objects.
      const sorted = processClientSideData(
        displayData, columns, stableFilters, sort.field, sort.direction
      );
      // Build a lookup: row object → index in displayData.
      // This handles filtering correctly: filtered-in rows are a subset of displayData.
      const indexMap = new Map<T, number>();
      for (let i = 0; i < displayData.length; i++) {
        const row = displayData[i];
        if (row !== undefined) indexMap.set(row, i);
      }
      const indices = sorted.map((row) => {
        const idx = indexMap.get(row);
        return idx !== undefined ? idx : -1;
      }).filter((idx) => idx !== -1);
      sortedIndicesRef.current = indices;
      orderedRows = sorted;
    } else {
      // Data values changed (cell edit) but sort order is preserved.
      // Look up current row objects using stored indices.
      orderedRows = sortedIndicesRef.current.map((idx) => displayData[idx]).filter((r) => r !== undefined);
    }

    const total = orderedRows.length;
    // Full-dataset virtualization (paginate=false): return every row so the
    // grid virtual-scrolls the whole dataset instead of a single page.
    if (!paginate) {
      return { items: orderedRows, totalCount: total, all: orderedRows };
    }
    return { items: pageWindow(orderedRows, page, pageSize), totalCount: total, all: orderedRows };
    // Note: sortVersion is implicitly tracked via needsResort / sortedIndicesRef.current === null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClientSide, useWorker, displayData, columns, stableFilters, sortVersion, sort.field, sort.direction, page, pageSize, paginate]);

  // Stabilize callback refs so inline dataSource/onError don't cause infinite re-fetches.
  const dataSourceRef = useLatestRef(dataSource);
  // Bumps when a (memoized) dataSource is replaced, so swapping backends
  // refetches and rebuilds the windowed cache. Inline objects bump it at most once.
  const dataSourceVersion = useIdentityVersion(dataSource);
  const onErrorRef = useLatestRef(onError);

  // --- Client-side filtering & sorting (async worker path) ---
  const [asyncItems, setAsyncItems] = useState<{ items: T[]; totalCount: number; all: T[] } | null>(null);
  const asyncIdRef = useRef(0);
  const asyncSortedIndicesRef = useRef<number[] | null>(null);
  const asyncPrevSortVersionRef = useRef(-1);
  const asyncPrevFiltersRef = useRef<IFilters | null>(null);
  const asyncPrevColumnsRef = useRef<ICoreColumnDef<T>[] | null>(null);
  const asyncPrevDataRef = useRef<T[] | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: getRowIdRef.current is a latest-value ref read on purpose; depending on it would re-run the worker effect for inline getRowId functions
  useEffect(() => {
    if (!isClientSide || !useWorker) {
      setAsyncItems(null);
      return;
    }

    const needsResortAsync =
      sortVersion !== asyncPrevSortVersionRef.current ||
      stableFilters !== asyncPrevFiltersRef.current ||
      columns !== asyncPrevColumnsRef.current ||
      asyncPrevDataRef.current === null ||
      !isSameRowSet(asyncPrevDataRef.current, displayData, getRowIdRef.current);
    asyncPrevDataRef.current = displayData;

    if (needsResortAsync) {
      asyncPrevSortVersionRef.current = sortVersion;
      asyncPrevFiltersRef.current = stableFilters;
      asyncPrevColumnsRef.current = columns;
      asyncSortedIndicesRef.current = null;
    }

    const id = ++asyncIdRef.current;

    if (asyncSortedIndicesRef.current === null) {
      const commitRows = (rows: T[]) => {
        const indexMap = new Map<T, number>();
        for (let i = 0; i < displayData.length; i++) {
          const row = displayData[i];
          if (row !== undefined) indexMap.set(row, i);
        }
        const indices = rows.map((row) => {
          const idx = indexMap.get(row);
          return idx !== undefined ? idx : -1;
        }).filter((idx) => idx !== -1);
        asyncSortedIndicesRef.current = indices;
        const total = rows.length;
        if (!paginate) {
          setAsyncItems({ items: rows, totalCount: total, all: rows });
          return;
        }
        setAsyncItems({ items: pageWindow(rows, page, pageSize), totalCount: total, all: rows });
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
        commitRows(rows as T[]);
      }).catch((err) => {
        if (id !== asyncIdRef.current) return; // stale
        // Worker failed at runtime: report and fall back to synchronous
        // processing so the grid still updates instead of keeping stale rows.
        onErrorRef.current?.(err);
        commitRows(processClientSideData(displayData, columns, stableFilters, sort.field, sort.direction));
      });
    } else {
      // Preserve order: look up updated rows by stored indices.
      const orderedRows = asyncSortedIndicesRef.current.map((idx) => displayData[idx]).filter((r) => r !== undefined);
      const total = orderedRows.length;
      if (!paginate) {
        setAsyncItems({ items: orderedRows, totalCount: total, all: orderedRows });
      } else {
        setAsyncItems({ items: pageWindow(orderedRows, page, pageSize), totalCount: total, all: orderedRows });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClientSide, useWorker, displayData, columns, stableFilters, sortVersion, sort.field, sort.direction, page, pageSize, paginate, onErrorRef]);

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
        setWindowedRowCount(cache.getRowCount() ?? 0);
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

  // Re-fetch the row count whenever sort or filters change.
  //
  // Depend on a content key, not `stableFilters` identity. Not every caller
  // guarantees a referentially stable filters object across renders; keying the
  // effect on identity would re-run it every render, and each run calls
  // `cache.setContext` -> `invalidate` -> `onChange` -> `setWindowedTick`,
  // producing an infinite render loop. A content string only changes when the
  // filters actually change.
  const windowedFiltersKey = JSON.stringify(stableFilters);
  // biome-ignore lint/correctness/useExhaustiveDependencies: stableFilters is intentionally tracked via its content key windowedFiltersKey (see note above) to avoid an identity-driven render loop; isWindowed and refreshCounter are deliberate re-run triggers
  useEffect(() => {
    const cache = windowedCacheRef.current;
    if (!cache) return;
    cache.setContext({
      sort: { field: sort.field, direction: sort.direction },
      filters: stableFilters,
    });
    // stableFilters is read but intentionally excluded from deps in favour of
    // windowedFiltersKey (its content-stable string form).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWindowed, sort.field, sort.direction, windowedFiltersKey, refreshCounter]);

  const requestWindow = useCallback((start: number, end: number) => {
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
    return {
      rowCount: windowedRowCount,
      getRow: getWindowedRow,
      requestWindow,
      retryRow: retryWindowedRow,
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

  return {
    displayItems,
    allFilteredItems,
    displayTotalCount,
    serverLoading,
    refreshData: () => setRefreshCounter((prev) => prev + 1),
    windowed,
  };
}
