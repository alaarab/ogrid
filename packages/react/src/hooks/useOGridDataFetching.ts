import { useState, useEffect, useRef, useMemo } from 'react';
import { processClientSideData } from '../utils';
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
  page: number;
  pageSize: number;
  onError?: (err: unknown) => void;
  onFirstDataRendered?: () => void;
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
 */
export function useOGridDataFetching<T>(params: UseOGridDataFetchingParams<T>): UseOGridDataFetchingState<T> {
  const {
    isServerSide, dataSource, displayData, columns, stableFilters,
    sort, page, pageSize, onError, onFirstDataRendered,
  } = params;

  const isClientSide = !isServerSide;

  // --- Client-side filtering & sorting ---
  const clientItemsAndTotal = useMemo(() => {
    if (!isClientSide) return null;
    const rows = processClientSideData(
      displayData, columns, stableFilters, sort.field, sort.direction
    );
    const total = rows.length;
    const start = (page - 1) * pageSize;
    const paged = rows.slice(start, start + pageSize);
    return { items: paged, totalCount: total };
  }, [isClientSide, displayData, columns, stableFilters, sort.field, sort.direction, page, pageSize]);

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

  const displayItems = isClientSide && clientItemsAndTotal ? clientItemsAndTotal.items : serverItems;
  const displayTotalCount = isClientSide && clientItemsAndTotal ? clientItemsAndTotal.totalCount : serverTotalCount;

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
