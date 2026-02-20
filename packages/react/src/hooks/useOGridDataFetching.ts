import { useState, useEffect, useRef, useMemo } from 'react';
import { processClientSideData } from '../utils';
import type { IFilters, IDataSource } from '../types';
import type { IColumnDef as ICoreColumnDef } from '@alaarab/ogrid-core';

export interface UseOGridDataFetchingParams<T> {
  isServerSide: boolean;
  dataSource?: IDataSource<T>;
  displayData: T[];
  columns: ICoreColumnDef<T>[];
  stableFilters: IFilters;
  filters: IFilters;
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
    filters, sort, page, pageSize, onError, onFirstDataRendered,
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

  useEffect(() => {
    if (!isServerSide || !dataSource) {
      if (!isServerSide) setServerLoading(false);
      return;
    }
    const id = ++fetchIdRef.current;
    setServerLoading(true);
    dataSource
      .fetchPage({
        page, pageSize,
        sort: { field: sort.field, direction: sort.direction },
        filters,
      })
      .then((res) => {
        if (id !== fetchIdRef.current) return;
        setServerItems(res.items);
        setServerTotalCount(res.totalCount);
      })
      .catch((err) => {
        if (id !== fetchIdRef.current) return;
        onError?.(err);
        setServerItems([]);
        setServerTotalCount(0);
      })
      .finally(() => {
        if (id === fetchIdRef.current) setServerLoading(false);
      });
  }, [isServerSide, dataSource, page, pageSize, sort.field, sort.direction, filters, onError, refreshCounter]);

  const displayItems = isClientSide && clientItemsAndTotal ? clientItemsAndTotal.items : serverItems;
  const displayTotalCount = isClientSide && clientItemsAndTotal ? clientItemsAndTotal.totalCount : serverTotalCount;

  // Fire onFirstDataRendered once when the grid first has data
  const firstDataRenderedRef = useRef(false);
  useEffect(() => {
    if (!firstDataRenderedRef.current && displayItems.length > 0) {
      firstDataRenderedRef.current = true;
      onFirstDataRendered?.();
    }
  }, [displayItems.length, onFirstDataRendered]);

  return {
    displayItems,
    displayTotalCount,
    serverLoading,
    refreshData: () => setRefreshCounter((prev) => prev + 1),
  };
}
