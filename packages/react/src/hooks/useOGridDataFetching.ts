import { useState, useEffect, useRef, useMemo } from 'react';
import { processClientSideData } from '../utils';
import { processClientSideDataAsync } from '@alaarab/ogrid-core';
import { useLatestRef } from './useLatestRef';
import type { IFilters, IDataSource } from '../types';
import type { IColumnDef as ICoreColumnDef } from '@alaarab/ogrid-core';

export interface UseOGridDataFetchingParams<T> {
  isServerSide: boolean;
  dataSource?: IDataSource<T>;
  displayData: T[];
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
  pageSize: number;
  onError?: (err: unknown) => void;
  onFirstDataRendered?: () => void;
  /** Worker sort mode: true=always, 'auto'=when data > 5000 rows, false=sync. */
  workerSort?: boolean | 'auto';
}

export interface UseOGridDataFetchingState<T> {
  displayItems: T[];
  displayTotalCount: number;
  serverLoading: boolean;
  refreshData: () => void;
}

/**
 * Manages data fetching (server-side) and client-side filtering/sorting/pagination.
 * Fires onFirstDataRendered once when items first appear.
 *
 * Sort behavior: sorting is applied as a snapshot when the user explicitly sorts
 * (sortVersion increments). Subsequent data edits preserve row order rather than
 * re-sorting - matching Excel behavior where edited rows stay in place.
 */
export function useOGridDataFetching<T>(params: UseOGridDataFetchingParams<T>): UseOGridDataFetchingState<T> {
  const {
    isServerSide, dataSource, displayData, columns, stableFilters,
    sort, sortVersion, page, pageSize, onError, onFirstDataRendered, workerSort,
  } = params;

  const isClientSide = !isServerSide;

  // Determine if worker sort should be used
  const useWorker = workerSort === true || (workerSort === 'auto' && displayData.length > 5000);

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
  const prevDataLengthRef = useRef(-1);

  // Detect when a full re-sort is needed.
  const needsResort =
    sortVersion !== prevSortVersionRef.current ||
    stableFilters !== prevFiltersRef.current ||
    columns !== prevColumnsRef.current ||
    displayData.length !== prevDataLengthRef.current; // row count changed (add/remove)

  if (needsResort) {
    prevSortVersionRef.current = sortVersion;
    prevFiltersRef.current = stableFilters;
    prevColumnsRef.current = columns;
    prevDataLengthRef.current = displayData.length;
    sortedIndicesRef.current = null; // will be built in memo
  }

  // --- Client-side filtering & sorting (sync path) ---
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
        indexMap.set(displayData[i], i);
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
    const start = (page - 1) * pageSize;
    const paged = orderedRows.slice(start, start + pageSize);
    return { items: paged, totalCount: total };
    // Note: sortVersion is implicitly tracked via needsResort / sortedIndicesRef.current === null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClientSide, useWorker, displayData, columns, stableFilters, sortVersion, page, pageSize]);

  // --- Client-side filtering & sorting (async worker path) ---
  const [asyncItems, setAsyncItems] = useState<{ items: T[]; totalCount: number } | null>(null);
  const asyncIdRef = useRef(0);
  const asyncSortedIndicesRef = useRef<number[] | null>(null);
  const asyncPrevSortVersionRef = useRef(-1);
  const asyncPrevFiltersRef = useRef<IFilters | null>(null);
  const asyncPrevColumnsRef = useRef<ICoreColumnDef<T>[] | null>(null);
  const asyncPrevDataLengthRef = useRef(-1);

  useEffect(() => {
    if (!isClientSide || !useWorker) {
      setAsyncItems(null);
      return;
    }

    const needsResortAsync =
      sortVersion !== asyncPrevSortVersionRef.current ||
      stableFilters !== asyncPrevFiltersRef.current ||
      columns !== asyncPrevColumnsRef.current ||
      displayData.length !== asyncPrevDataLengthRef.current;

    if (needsResortAsync) {
      asyncPrevSortVersionRef.current = sortVersion;
      asyncPrevFiltersRef.current = stableFilters;
      asyncPrevColumnsRef.current = columns;
      asyncPrevDataLengthRef.current = displayData.length;
      asyncSortedIndicesRef.current = null;
    }

    const id = ++asyncIdRef.current;

    if (asyncSortedIndicesRef.current === null) {
      // Full re-sort via worker.
      processClientSideDataAsync(
        displayData,
        columns as Parameters<typeof processClientSideDataAsync>[1],
        stableFilters,
        sort.field,
        sort.direction,
      ).then((rows) => {
        if (id !== asyncIdRef.current) return; // stale
        const indexMap = new Map<T, number>();
        for (let i = 0; i < displayData.length; i++) {
          indexMap.set(displayData[i], i);
        }
        const indices = (rows as T[]).map((row) => {
          const idx = indexMap.get(row);
          return idx !== undefined ? idx : -1;
        }).filter((idx) => idx !== -1);
        asyncSortedIndicesRef.current = indices;
        const total = rows.length;
        const start = (page - 1) * pageSize;
        const paged = rows.slice(start, start + pageSize) as T[];
        setAsyncItems({ items: paged, totalCount: total });
      });
    } else {
      // Preserve order: look up updated rows by stored indices.
      const orderedRows = asyncSortedIndicesRef.current.map((idx) => displayData[idx]).filter((r) => r !== undefined);
      const total = orderedRows.length;
      const start = (page - 1) * pageSize;
      const paged = orderedRows.slice(start, start + pageSize);
      setAsyncItems({ items: paged, totalCount: total });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClientSide, useWorker, displayData, columns, stableFilters, sortVersion, page, pageSize]);

  // --- Server-side data fetching ---
  const [serverItems, setServerItems] = useState<T[]>([]);
  const [serverTotalCount, setServerTotalCount] = useState(0);
  const [serverLoading, setServerLoading] = useState(true);
  const fetchIdRef = useRef(0);
  const [refreshCounter, setRefreshCounter] = useState(0);

  // Stabilize callback refs so inline dataSource/onError don't cause infinite re-fetches.
  const dataSourceRef = useLatestRef(dataSource);
  const onErrorRef = useLatestRef(onError);

  useEffect(() => {
    if (!isServerSide || !dataSourceRef.current) {
      if (!isServerSide) setServerLoading(false);
      return;
    }
    const ds = dataSourceRef.current;
    const id = ++fetchIdRef.current;
    setServerLoading(true);
    ds
      .fetchPage({
        page, pageSize,
        sort: { field: sort.field, direction: sort.direction },
        filters: stableFilters,
      })
      .then((res) => {
        if (id !== fetchIdRef.current) return;
        setServerItems(res.items);
        setServerTotalCount(res.totalCount);
      })
      .catch((err) => {
        if (id !== fetchIdRef.current) return;
        onErrorRef.current?.(err);
        setServerItems([]);
        setServerTotalCount(0);
      })
      .finally(() => {
        if (id === fetchIdRef.current) setServerLoading(false);
      });
  }, [isServerSide, page, pageSize, sort.field, sort.direction, stableFilters, refreshCounter, dataSourceRef, onErrorRef]);

  const clientResult = clientItemsAndTotal ?? asyncItems;
  const displayItems = isClientSide && clientResult ? clientResult.items : serverItems;
  const displayTotalCount = isClientSide && clientResult ? clientResult.totalCount : serverTotalCount;

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
    displayTotalCount,
    serverLoading,
    refreshData: () => setRefreshCounter((prev) => prev + 1),
  };
}
