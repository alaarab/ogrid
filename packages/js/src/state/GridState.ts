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
  IResponsiveColumnsConfig,
} from '@alaarab/ogrid-core';
import {
  flattenColumns,
  processClientSideData,
  processClientSideDataAsync,
  exportToCsv as coreExportToCsv,
  getCellValue,
  deriveFilterOptionsFromData,
  mergeFilter,
  shouldUseWorkerSort,
  validateColumns,
  validateRowIds,
  resolveResponsiveConfig,
  applyResponsiveHiding,
} from '@alaarab/ogrid-core';
import { EventEmitter } from './EventEmitter';
import type { FormulaEngineState } from './FormulaEngineState';

type StateChangeEvent =
  | { type: 'data' }
  | { type: 'loading' }
  | { type: 'sort'; sort: { field: string; direction: 'asc' | 'desc' } | undefined }
  | { type: 'filter'; filters: IFilters }
  | { type: 'page'; page: number }
  | { type: 'pageSize'; page: number; pageSize: number }
  | {
      type: 'columns';
      reason: 'visibleColumns' | 'columnOrder' | 'responsive';
      visibleColumns?: Set<string>;
      columnOrder?: string[];
    };

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
  private _ariaLabelledBy?: string;
  private _stickyHeader: boolean;
  private _fullScreen: boolean;
  private _workerSort: boolean | 'auto';

  // Formula engine (optional  -  wired by OGrid when formulas option is enabled)
  private _formulaEngine: FormulaEngineState | null = null;

  // Filter options for client-side data (used by sidebar filters panel & header filter popovers)
  private _filterOptions: Record<string, string[]> = {};

  // Column display order (array of columnIds)
  private _columnOrder: string[] = [];

  // Responsive column hiding
  private _responsiveColumns: IResponsiveColumnsConfig | null = null;
  private _containerWidth = 0;

  // Dirty-flag memoization for visibleColumnDefs getter
  private _visibleColsCache: IColumnDef<T>[] | null = null;
  private _visibleColsDirty = true;

  // Stable sorted order (index-based) - same approach as React/Vue/Angular.
  // sortedIndices stores indices into _data from the last explicit sort/filter pass.
  // When only _data changes (cell edit via setData), we reuse these indices so rows
  // stay in place rather than jumping to a new sorted position (Excel-like behavior).
  private _sortedIndices: number[] | null = null;
  private _sortDirty = true; // true = must re-sort on next getProcessedItems call

  private getKnownColumnIds(): string[] {
    return this._columns.map((column) => column.columnId);
  }

  private normalizeVisibleColumns(columns: Iterable<string>): Set<string> {
    const knownColumnIds = new Set(this.getKnownColumnIds());
    return new Set(Array.from(columns).filter((columnId) => knownColumnIds.has(columnId)));
  }

  private normalizeColumnOrder(order: string[]): string[] {
    const knownColumnIds = this.getKnownColumnIds();
    const validColumnIds = new Set(knownColumnIds);
    const nextOrder: string[] = [];
    const seen = new Set<string>();

    for (const columnId of order) {
      if (!validColumnIds.has(columnId) || seen.has(columnId)) continue;
      seen.add(columnId);
      nextOrder.push(columnId);
    }

    for (const columnId of knownColumnIds) {
      if (seen.has(columnId)) continue;
      seen.add(columnId);
      nextOrder.push(columnId);
    }

    return nextOrder;
  }

  private emitStateChange(event: StateChangeEvent): void {
    this.emitter.emit('stateChange', event);
  }

  private emitDataChange(): void {
    this.emitStateChange({ type: 'data' });
  }

  private handleQueryStateChange(event: StateChangeEvent): void {
    this.emitStateChange(event);
    if (this.isServerSide) {
      this.fetchServerData();
    } else {
      this.emitDataChange();
    }
  }

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
    this._visibleColumns = this.normalizeVisibleColumns(
      options.visibleColumns ?? this._columns.map(c => c.columnId)
    );
    this._columnOrder = this.normalizeColumnOrder(options.columnOrder ?? this._columns.map(c => c.columnId));
    this._onError = options.onError;
    this._onFirstDataRendered = options.onFirstDataRendered;
    this._rowHeight = options.rowHeight;
    this._ariaLabel = options['aria-label'] ?? options.ariaLabel;
    this._ariaLabelledBy = options['aria-labelledby'];
    this._stickyHeader = options.stickyHeader ?? true;
    this._fullScreen = options.fullScreen ?? false;
    this._workerSort = options.workerSort ?? false;

    // Responsive columns config
    this._responsiveColumns = resolveResponsiveConfig(options.responsiveColumns) ?? null;

    // Derive initial filter options for client-side data
    if (!this._dataSource) {
      this._filterOptions = deriveFilterOptionsFromData(
        this._data,
        this._columns as unknown as Parameters<typeof deriveFilterOptionsFromData>[1]
      );
    }

    // Runtime validation  -  runs once at construction
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
  get ariaLabelledBy(): string | undefined { return this._ariaLabelledBy; }
  get responsiveColumns(): IResponsiveColumnsConfig | null { return this._responsiveColumns; }

  /** Get the visible columns in display order (respects column reorder and responsive hiding). Memoized via dirty flag. */
  get visibleColumnDefs(): IColumnDef<T>[] {
    if (!this._visibleColsDirty && this._visibleColsCache) return this._visibleColsCache;
    const userVisible = this._columns.filter(c => this._visibleColumns.has(c.columnId));
    const visible = applyResponsiveHiding(userVisible, this._containerWidth, this._responsiveColumns ?? undefined) as IColumnDef<T>[];

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

    let orderedRows: T[];

    if (this._sortDirty || this._sortedIndices === null) {
      // Sort/filter changed: rebuild the sorted order from scratch.
      const sorted = processClientSideData(
        this._data,
        this._columns as unknown as Parameters<typeof processClientSideData>[1],
        this._filters,
        this._sort?.field,
        this._sort?.direction
      ) as T[];

      // Store as indices into _data so we can look up updated rows on the next call.
      const indexMap = new Map<T, number>();
      for (let i = 0; i < this._data.length; i++) indexMap.set(this._data[i], i);
      this._sortedIndices = sorted.map((row) => {
        const idx = indexMap.get(row);
        return idx !== undefined ? idx : -1;
      }).filter((idx) => idx !== -1);
      this._sortDirty = false;
      orderedRows = sorted;
    } else {
      // Only data values changed (cell edit): preserve existing order.
      orderedRows = this._sortedIndices.map((idx) => this._data[idx]).filter((r) => r !== undefined) as T[];
    }

    const totalCount = orderedRows.length;
    const startIdx = (this._page - 1) * this._pageSize;
    const endIdx = startIdx + this._pageSize;
    const items = orderedRows.slice(startIdx, endIdx);

    return { items, totalCount };
  }

  /** Whether worker sort should be used for the current data set. */
  get useWorkerSort(): boolean {
    return shouldUseWorkerSort(this._workerSort, this._data.length, {
      columns: this._columns,
      filters: this._filters,
      sortBy: this._sort?.field,
    });
  }

  /**
   * Async version of getProcessedItems that offloads sort/filter to a Web Worker.
   * Falls back to sync when worker sort is not active.
   * Uses the same index-based snapshot approach as getProcessedItems.
   */
  async getProcessedItemsAsync(): Promise<{ items: T[]; totalCount: number }> {
    if (this.isServerSide || !this.useWorkerSort) {
      return this.getProcessedItems();
    }

    if (!this._sortDirty && this._sortedIndices !== null) {
      // Only data values changed (cell edit): preserve existing order.
      const orderedRows = this._sortedIndices.map((idx) => this._data[idx]).filter((r) => r !== undefined) as T[];
      const totalCount = orderedRows.length;
      const startIdx = (this._page - 1) * this._pageSize;
      const endIdx = startIdx + this._pageSize;
      return { items: orderedRows.slice(startIdx, endIdx), totalCount };
    }

    const sorted = await processClientSideDataAsync(
      this._data,
      this._columns as unknown as Parameters<typeof processClientSideDataAsync>[1],
      this._filters,
      this._sort?.field,
      this._sort?.direction
    ) as T[];

    // Store sorted indices for subsequent data-only changes.
    const indexMap = new Map<T, number>();
    for (let i = 0; i < this._data.length; i++) indexMap.set(this._data[i], i);
    this._sortedIndices = sorted.map((row) => {
      const idx = indexMap.get(row);
      return idx !== undefined ? idx : -1;
    }).filter((idx) => idx !== -1);
    this._sortDirty = false;

    const totalCount = sorted.length;
    const startIdx = (this._page - 1) * this._pageSize;
    const endIdx = startIdx + this._pageSize;
    const items = sorted.slice(startIdx, endIdx);

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
    this.emitStateChange({ type: 'loading' });

    this._dataSource
      .fetchPage({
        page: this._page,
        pageSize: this._pageSize,
        sort: this._sort ? { field: this._sort.field, direction: this._sort.direction } : undefined,
        filters: this._filters,
        signal: currentController.signal,
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

        this.emitDataChange();
      })
      .catch((err) => {
        // Ignore if this request was superseded or aborted
        if (id !== this._fetchId || currentController.signal.aborted) return;
        this._onError?.(err);
        this._serverItems = [];
        this._serverTotalCount = 0;
        this._isLoading = false;
        this.emitDataChange();
      });
  }

  // --- Setters ---

  setData(data: T[]): void {
    const prevData = this._data;
    const prevLength = prevData.length;
    this._data = data;
    if (!this.isServerSide) {
      this._filterOptions = deriveFilterOptionsFromData(
        data,
        this._columns as unknown as Parameters<typeof deriveFilterOptionsFromData>[1]
      );
    }
    // If row count or row-id order changed, the cached sorted indices are no longer valid.
    // When row ids stay in the same order, treat it as a data-only update so edited rows
    // do not jump to a new position immediately.
    const rowOrderChanged =
      data.length !== prevLength ||
      data.some((item, index) => {
        const previousItem = prevData[index];
        return previousItem == null || this._getRowId(previousItem) !== this._getRowId(item);
      });

    if (rowOrderChanged) {
      this._sortDirty = true;
    }
    this.emitDataChange();
  }

  setPage(page: number): void {
    this._page = page;
    this.handleQueryStateChange({ type: 'page', page: this._page });
  }

  setPageSize(pageSize: number): void {
    this._pageSize = pageSize;
    this._page = 1;
    this.handleQueryStateChange({ type: 'pageSize', page: this._page, pageSize: this._pageSize });
  }

  setSort(sort: { field: string; direction: 'asc' | 'desc' } | undefined): void {
    this._sort = sort;
    this._page = 1;
    this._sortDirty = true; // explicit sort change: re-sort on next getProcessedItems call
    this.handleQueryStateChange({ type: 'sort', sort: this._sort });
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
    this._sortDirty = true; // explicit sort change: re-sort on next getProcessedItems call
    this.handleQueryStateChange({ type: 'sort', sort: this._sort });
  }

  setFilter(key: string, value: FilterValue | undefined): void {
    this._filters = mergeFilter(this._filters, key, value);
    this._page = 1;
    this._sortDirty = true; // filter change requires re-sort to get the right subset
    this.handleQueryStateChange({ type: 'filter', filters: this._filters });
  }

  clearFilters(): void {
    this.setFilterModel({});
  }

  setVisibleColumns(columns: Set<string>): void {
    this._visibleColumns = this.normalizeVisibleColumns(columns);
    this._visibleColsDirty = true;
    this.emitStateChange({
      type: 'columns',
      reason: 'visibleColumns',
      visibleColumns: new Set(this._visibleColumns),
    });
  }

  setColumnOrder(order: string[]): void {
    this._columnOrder = this.normalizeColumnOrder(order);
    this._visibleColsDirty = true;
    this.emitStateChange({
      type: 'columns',
      reason: 'columnOrder',
      columnOrder: [...this._columnOrder],
    });
  }

  setFilterModel(filters: IFilters): void {
    this._filters = { ...filters };
    this._page = 1;
    this._sortDirty = true; // filter change requires re-sort to get the right subset
    this.handleQueryStateChange({ type: 'filter', filters: this._filters });
  }

  /** Update the container width for responsive column hiding. Invalidates the visible-cols cache. */
  setContainerWidth(width: number): void {
    if (this._containerWidth === width) return;
    this._containerWidth = width;
    if (this._responsiveColumns) {
      this._visibleColsDirty = true;
      this.emitStateChange({ type: 'columns', reason: 'responsive' });
    }
  }

  setLoading(loading: boolean): void {
    this._isLoading = loading;
    this.emitStateChange({ type: 'loading' });
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
        columnOrder: [...this._columnOrder],
        filters: Object.keys(this._filters).length > 0 ? this._filters : undefined,
      }),
      applyColumnState: (state: Partial<IGridColumnState>) => {
        if ('visibleColumns' in state && state.visibleColumns) this.setVisibleColumns(new Set(state.visibleColumns));
        if ('columnOrder' in state && state.columnOrder) this.setColumnOrder(state.columnOrder);
        if ('sort' in state) this.setSort(state.sort);
        if ('filters' in state) this.setFilterModel(state.filters ?? {});
      },
      setFilterModel: (filters: IFilters) => {
        this.setFilterModel(filters);
      },
      getSelectedRows: () => [],
      setSelectedRows: () => {},
      selectAll: () => {},
      deselectAll: () => {},
      getActiveSheet: () => null,
      setActiveSheet: () => {},
      getSheetDefs: () => [],
      setSheetDefs: () => {},
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
      exportToCsv: (filename?: string, options?: { exportMode?: 'values' | 'formulas' }) => {
        const { items } = this.getProcessedItems();
        const cols = this.visibleColumnDefs.map(c => ({ columnId: c.columnId, name: c.name }));
        const formulaOptions = this._formulaEngine?.isEnabled() ? {
          getFormula: this._formulaEngine.getFormula.bind(this._formulaEngine),
          hasFormula: this._formulaEngine.hasFormula.bind(this._formulaEngine),
          columnIdToIndex: new Map(this.visibleColumnDefs.map((c, i) => [c.columnId, i])),
          exportMode: options?.exportMode ?? 'values',
        } : undefined;
        coreExportToCsv(items, cols, (item, colId) => {
          const col = this._columns.find(c => c.columnId === colId);
          if (!col) return '';
          const val = getCellValue(item, col as unknown as Parameters<typeof getCellValue>[1]);
          if (col.valueFormatter) return col.valueFormatter(val, item);
          return val != null ? String(val) : '';
        }, filename, formulaOptions);
      },
    };
  }

  /** Wire in the formula engine so exportToCsv can use it. */
  setFormulaEngine(engine: FormulaEngineState): void {
    this._formulaEngine = engine;
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
