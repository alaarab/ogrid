import type {
  IColumnDef,
  IColumnGroupDef,
} from '../types/columnTypes';
import type {
  RowId,
  IFilters,
  OGridOptions,
  IJsOGridApi,
} from '../types/gridTypes';
import type {
  IGridColumnState,
  FilterValue,
  IDataSource,
} from '@alaarab/ogrid-core';
import {
  flattenColumns,
  processClientSideData,
  exportToCsv as coreExportToCsv,
  getCellValue,
  deriveFilterOptionsFromData,
  mergeFilter,
  validateColumns,
  validateRowIds,
} from '@alaarab/ogrid-core';
import { EventEmitter } from './EventEmitter';

interface StateChangeEvent {
  type: 'data' | 'sort' | 'filter' | 'page' | 'columns' | 'loading';
}

export class GridState<T> {
  private emitter = new EventEmitter<{ stateChange: StateChangeEvent }>();

  private _data: T[] = [];
  private _page: number;
  private _pageSize: number;
  private _sort: { field: string; direction: 'asc' | 'desc' } | undefined;
  private _filters: IFilters = {};
  private _visibleColumns: Set<string>;
  private _isLoading = false;
  private _columns: IColumnDef<T>[];
  private _allColumns: (IColumnDef<T> | IColumnGroupDef<T>)[];
  private _getRowId: (item: T) => RowId;

  // Server-side data source
  private _dataSource: IDataSource<T> | undefined;
  private _serverItems: T[] = [];
  private _serverTotalCount = 0;
  private _fetchId = 0; // Guards against stale fetch responses
  private _abortController: AbortController | null = null; // Cancels in-flight fetch requests
  private _onError?: (error: unknown) => void;
  private _onFirstDataRendered?: () => void;
  private _firstDataRendered = false;
  private _rowHeight?: number;
  private _ariaLabel?: string;
  private _stickyHeader: boolean;
  private _fullScreen: boolean;

  // Filter options for client-side data (used by sidebar filters panel & header filter popovers)
  private _filterOptions: Record<string, string[]> = {};

  // Column display order (array of columnIds)
  private _columnOrder: string[] = [];

  // Dirty-flag memoization for visibleColumnDefs getter
  private _visibleColsCache: IColumnDef<T>[] | null = null;
  private _visibleColsDirty = true;

  constructor(options: OGridOptions<T>) {
    this._allColumns = options.columns;
    this._columns = flattenColumns(options.columns as unknown as Parameters<typeof flattenColumns>[0]) as IColumnDef<T>[];
    this._getRowId = options.getRowId;
    this._data = options.data ?? [];
    this._dataSource = options.dataSource;
    this._page = options.page ?? 1;
    this._pageSize = options.pageSize ?? 20;
    this._sort = options.sort;
    this._filters = options.filters ?? {};
    this._visibleColumns = options.visibleColumns ?? new Set(this._columns.map(c => c.columnId));
    this._columnOrder = this._columns.map(c => c.columnId);
    this._onError = options.onError;
    this._onFirstDataRendered = options.onFirstDataRendered;
    this._rowHeight = options.rowHeight;
    this._ariaLabel = options.ariaLabel;
    this._stickyHeader = options.stickyHeader ?? true;
    this._fullScreen = options.fullScreen ?? false;

    // Derive initial filter options for client-side data
    if (!this._dataSource) {
      this._filterOptions = deriveFilterOptionsFromData(
        this._data,
        this._columns as unknown as Parameters<typeof deriveFilterOptionsFromData>[1]
      );
    }

    // Runtime validation — runs once at construction
    validateColumns(this._columns as Parameters<typeof validateColumns>[0]);
    if (!this._dataSource && this._data.length > 0) {
      validateRowIds(this._data, this._getRowId as (item: T) => import('@alaarab/ogrid-core').RowId);
      this._firstDataRendered = true;
    }

    // If server-side, trigger initial fetch
    if (this._dataSource) {
      this._isLoading = true;
      this.fetchServerData();
    }
  }

  // --- Getters ---

  get data(): T[] { return this._data; }
  get page(): number { return this._page; }
  get pageSize(): number { return this._pageSize; }
  get sort(): { field: string; direction: 'asc' | 'desc' } | undefined { return this._sort; }
  get filters(): IFilters { return this._filters; }
  get visibleColumns(): Set<string> { return this._visibleColumns; }
  get isLoading(): boolean { return this._isLoading; }
  get columns(): IColumnDef<T>[] { return this._columns; }
  get allColumns(): (IColumnDef<T> | IColumnGroupDef<T>)[] { return this._allColumns; }
  get getRowId(): (item: T) => RowId { return this._getRowId; }
  get isServerSide(): boolean { return this._dataSource != null; }
  get stickyHeader(): boolean { return this._stickyHeader; }
  get fullScreen(): boolean { return this._fullScreen; }
  get filterOptions(): Record<string, string[]> { return this._filterOptions; }
  get columnOrder(): string[] { return this._columnOrder; }
  get rowHeight(): number | undefined { return this._rowHeight; }
  get ariaLabel(): string | undefined { return this._ariaLabel; }

  /** Get the visible columns in display order (respects column reorder). Memoized via dirty flag. */
  get visibleColumnDefs(): IColumnDef<T>[] {
    if (!this._visibleColsDirty && this._visibleColsCache) return this._visibleColsCache;
    const visible = this._columns.filter(c => this._visibleColumns.has(c.columnId));
    if (this._columnOrder.length === 0) {
      this._visibleColsCache = visible;
    } else {
      const orderMap = new Map(this._columnOrder.map((id, idx) => [id, idx]));
      this._visibleColsCache = [...visible].sort((a, b) => {
        const ai = orderMap.get(a.columnId) ?? Infinity;
        const bi = orderMap.get(b.columnId) ?? Infinity;
        return ai - bi;
      });
    }
    this._visibleColsDirty = false;
    return this._visibleColsCache;
  }

  /** Get processed (sorted, filtered, paginated) items for current page. */
  getProcessedItems(): { items: T[]; totalCount: number } {
    if (this.isServerSide) {
      return { items: this._serverItems, totalCount: this._serverTotalCount };
    }

    const filtered = processClientSideData(
      this._data,
      this._columns as unknown as Parameters<typeof processClientSideData>[1],
      this._filters,
      this._sort?.field,
      this._sort?.direction
    ) as T[];

    const totalCount = filtered.length;
    const startIdx = (this._page - 1) * this._pageSize;
    const endIdx = startIdx + this._pageSize;
    const items = filtered.slice(startIdx, endIdx);

    return { items, totalCount };
  }

  // --- Server-side fetch ---

  private fetchServerData(): void {
    if (!this._dataSource) return;

    // Cancel any in-flight request before starting a new one
    if (this._abortController) {
      this._abortController.abort();
    }

    const id = ++this._fetchId;
    this._abortController = new AbortController();
    const currentController = this._abortController;

    this._isLoading = true;
    this.emitter.emit('stateChange', { type: 'loading' });

    this._dataSource
      .fetchPage({
        page: this._page,
        pageSize: this._pageSize,
        sort: this._sort ? { field: this._sort.field, direction: this._sort.direction } : undefined,
        filters: this._filters,
      })
      .then((res) => {
        // Ignore if this request was superseded by a newer one
        if (id !== this._fetchId || currentController.signal.aborted) return;
        this._serverItems = res.items;
        this._serverTotalCount = res.totalCount;
        this._isLoading = false;

        if (!this._firstDataRendered && res.items.length > 0) {
          this._firstDataRendered = true;
          validateRowIds(res.items, this._getRowId as (item: T) => import('@alaarab/ogrid-core').RowId);
          this._onFirstDataRendered?.();
        }

        this.emitter.emit('stateChange', { type: 'data' });
      })
      .catch((err) => {
        // Ignore if this request was superseded or aborted
        if (id !== this._fetchId || currentController.signal.aborted) return;
        this._onError?.(err);
        this._serverItems = [];
        this._serverTotalCount = 0;
        this._isLoading = false;
        this.emitter.emit('stateChange', { type: 'data' });
      });
  }

  // --- Setters ---

  setData(data: T[]): void {
    this._data = data;
    if (!this.isServerSide) {
      this._filterOptions = deriveFilterOptionsFromData(
        data,
        this._columns as unknown as Parameters<typeof deriveFilterOptionsFromData>[1]
      );
    }
    this.emitter.emit('stateChange', { type: 'data' });
  }

  setPage(page: number): void {
    this._page = page;
    if (this.isServerSide) {
      this.fetchServerData();
    } else {
      this.emitter.emit('stateChange', { type: 'page' });
    }
  }

  setPageSize(pageSize: number): void {
    this._pageSize = pageSize;
    this._page = 1;
    if (this.isServerSide) {
      this.fetchServerData();
    } else {
      this.emitter.emit('stateChange', { type: 'page' });
    }
  }

  setSort(sort: { field: string; direction: 'asc' | 'desc' } | undefined): void {
    this._sort = sort;
    this._page = 1;
    if (this.isServerSide) {
      this.fetchServerData();
    } else {
      this.emitter.emit('stateChange', { type: 'sort' });
    }
  }

  toggleSort(field: string): void {
    if (this._sort?.field === field) {
      this._sort = this._sort.direction === 'asc'
        ? { field, direction: 'desc' }
        : undefined;
    } else {
      this._sort = { field, direction: 'asc' };
    }
    this._page = 1;
    if (this.isServerSide) {
      this.fetchServerData();
    } else {
      this.emitter.emit('stateChange', { type: 'sort' });
    }
  }

  setFilter(key: string, value: FilterValue | undefined): void {
    this._filters = mergeFilter(this._filters, key, value);
    this._page = 1;
    if (this.isServerSide) {
      this.fetchServerData();
    } else {
      this.emitter.emit('stateChange', { type: 'filter' });
    }
  }

  clearFilters(): void {
    this._filters = {};
    this._page = 1;
    if (this.isServerSide) {
      this.fetchServerData();
    } else {
      this.emitter.emit('stateChange', { type: 'filter' });
    }
  }

  setVisibleColumns(columns: Set<string>): void {
    this._visibleColumns = columns;
    this._visibleColsDirty = true;
    this.emitter.emit('stateChange', { type: 'columns' });
  }

  setColumnOrder(order: string[]): void {
    this._columnOrder = order;
    this._visibleColsDirty = true;
    this.emitter.emit('stateChange', { type: 'columns' });
  }

  setLoading(loading: boolean): void {
    this._isLoading = loading;
    this.emitter.emit('stateChange', { type: 'loading' });
  }

  refreshData(): void {
    if (this.isServerSide) {
      this.fetchServerData();
    }
  }

  // --- Event subscription ---

  onStateChange(handler: (event: StateChangeEvent) => void): () => void {
    this.emitter.on('stateChange', handler);
    return () => this.emitter.off('stateChange', handler);
  }

  // --- API ---

  getApi(): IJsOGridApi<T> {
    return {
      setRowData: (data: T[]) => {
        if (!this.isServerSide) this.setData(data);
      },
      setLoading: (loading: boolean) => this.setLoading(loading),
      getColumnState: (): IGridColumnState => ({
        visibleColumns: Array.from(this._visibleColumns),
        sort: this._sort,
        filters: Object.keys(this._filters).length > 0 ? this._filters : undefined,
      }),
      applyColumnState: (state: Partial<IGridColumnState>) => {
        if (state.visibleColumns) this._visibleColumns = new Set(state.visibleColumns);
        if (state.sort !== undefined) this._sort = state.sort;
        if (state.filters !== undefined) this._filters = state.filters ?? {};
        if (this.isServerSide) {
          this.fetchServerData();
        } else {
          this.emitter.emit('stateChange', { type: 'columns' });
        }
      },
      setFilterModel: (filters: IFilters) => {
        this._filters = filters;
        this._page = 1;
        if (this.isServerSide) {
          this.fetchServerData();
        } else {
          this.emitter.emit('stateChange', { type: 'filter' });
        }
      },
      getSelectedRows: () => [],
      setSelectedRows: () => {},
      selectAll: () => {},
      deselectAll: () => {},
      clearFilters: () => this.clearFilters(),
      clearSort: () => this.setSort(undefined),
      resetGridState: () => {
        this.clearFilters();
        this.setSort(undefined);
      },
      getDisplayedRows: () => this.getProcessedItems().items,
      refreshData: () => this.refreshData(),
      // scrollToRow is wired by OGrid after construction when virtualScrollState is present.
      // This stub is replaced by OGrid.ts (see "Wire scrollToRow API method") for virtual scroll.
      // For non-virtual grids it remains a no-op (native browser scroll handles row visibility).
      scrollToRow: () => { /* no-op for non-virtual-scroll grids */ },
      getColumnOrder: () => [...this._columnOrder],
      setColumnOrder: (order: string[]) => this.setColumnOrder(order),
      exportToCsv: (filename?: string) => {
        const { items } = this.getProcessedItems();
        const cols = this.visibleColumnDefs.map(c => ({ columnId: c.columnId, name: c.name }));
        coreExportToCsv(items, cols, (item, colId) => {
          const col = this._columns.find(c => c.columnId === colId);
          if (!col) return '';
          const val = getCellValue(item, col as unknown as Parameters<typeof getCellValue>[1]);
          if (col.valueFormatter) return col.valueFormatter(val, item);
          return val != null ? String(val) : '';
        }, filename);
      },
    };
  }

  destroy(): void {
    // Cancel any in-flight fetch request
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
    this.emitter.removeAllListeners();
  }
}
