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
  validateColumns,
  validateRowIds,
  resolveResponsiveConfig,
  applyResponsiveHiding,
  buildGroupedRows,
  isGroupHeader,
} from '@alaarab/ogrid-core';
import type { IRowGroup, RowGroupingDisplayRow } from '@alaarab/ogrid-core';
import { EventEmitter } from './EventEmitter';
import type { FormulaEngineState } from './FormulaEngineState';

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
  private _workerSort: boolean | 'auto';

  // Formula engine (optional  -  wired by OGrid when formulas option is enabled)
  private _formulaEngine: FormulaEngineState | null = null;

  // Filter options for client-side data (used by sidebar filters panel & header filter popovers)
  private _filterOptions: Record<string, string[]> = {};

  // Column display order (array of columnIds)
  private _columnOrder: string[] = [];

  // Row grouping
  private _groupByColumnIds: string[] = [];
  private _expandedGroups: Set<string> = new Set();

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
    this._workerSort = options.workerSort ?? false;

    // Row grouping config
    this._groupByColumnIds = options.groupBy ?? [];

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
  get responsiveColumns(): IResponsiveColumnsConfig | null { return this._responsiveColumns; }
  get groupByColumnIds(): string[] { return this._groupByColumnIds; }
  get expandedGroups(): Set<string> { return this._expandedGroups; }

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

  /** Whether row grouping is currently active. */
  get isGrouped(): boolean {
    return this._groupByColumnIds.length > 0;
  }

  /**
   * Get display rows with group headers interleaved when grouping is active.
   * When groupBy is empty, returns the same items as getProcessedItems.
   * When groupBy is set, returns a flat array of RowGroupingDisplayRow<T>
   * (group headers + data rows) with pagination applied to the flat list.
   */
  getGroupedDisplayRows(): { displayRows: RowGroupingDisplayRow<T>[]; totalCount: number } {
    if (!this.isGrouped) {
      const result = this.getProcessedItems();
      return { displayRows: result.items, totalCount: result.totalCount };
    }

    // Get all sorted/filtered items (no pagination yet)
    let allItems: T[];
    if (this._sortDirty || this._sortedIndices === null) {
      allItems = processClientSideData(
        this._data,
        this._columns as unknown as Parameters<typeof processClientSideData>[1],
        this._filters,
        this._sort?.field,
        this._sort?.direction
      ) as T[];

      const indexMap = new Map<T, number>();
      for (let i = 0; i < this._data.length; i++) indexMap.set(this._data[i], i);
      this._sortedIndices = allItems.map((row) => {
        const idx = indexMap.get(row);
        return idx !== undefined ? idx : -1;
      }).filter((idx) => idx !== -1);
      this._sortDirty = false;
    } else {
      allItems = this._sortedIndices.map((idx) => this._data[idx]).filter((r) => r !== undefined) as T[];
    }

    // Build grouped rows (group headers + data rows flattened)
    const { displayRows } = buildGroupedRows<T>(
      allItems,
      this._columns as unknown as import('@alaarab/ogrid-core').IColumnDef<T>[],
      this._groupByColumnIds,
      this._expandedGroups,
    );

    // Paginate over the flat display rows
    const totalCount = displayRows.length;
    const startIdx = (this._page - 1) * this._pageSize;
    const endIdx = startIdx + this._pageSize;
    return { displayRows: displayRows.slice(startIdx, endIdx), totalCount };
  }

  /** Whether worker sort should be used for the current data set. */
  get useWorkerSort(): boolean {
    return this._workerSort === true || (this._workerSort === 'auto' && this._data.length > 5000);
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
    const prevLength = this._data.length;
    this._data = data;
    if (!this.isServerSide) {
      this._filterOptions = deriveFilterOptionsFromData(
        data,
        this._columns as unknown as Parameters<typeof deriveFilterOptionsFromData>[1]
      );
    }
    // If row count changed (add/remove), the existing sorted indices are invalid - re-sort.
    // If only values changed (cell edit), preserve the existing sort order (Excel-like behavior).
    if (data.length !== prevLength) {
      this._sortDirty = true;
    }
    this.emitter.emit('stateChange', { type: 'data' });
  }

  setGroupBy(columnIds: string[]): void {
    this._groupByColumnIds = columnIds;
    this._expandedGroups = new Set();
    this._page = 1;
    this._sortDirty = true;
    this.emitter.emit('stateChange', { type: 'data' });
  }

  toggleGroup(groupKey: string): void {
    if (this._expandedGroups.has(groupKey)) {
      this._expandedGroups.delete(groupKey);
    } else {
      this._expandedGroups.add(groupKey);
    }
    this.emitter.emit('stateChange', { type: 'data' });
  }

  expandAllGroups(): void {
    // Build the group tree to get all group keys
    const allItems = this._sortedIndices
      ? this._sortedIndices.map((idx) => this._data[idx]).filter((r) => r !== undefined) as T[]
      : this._data;
    const { groupTree } = buildGroupedRows<T>(
      allItems,
      this._columns as unknown as import('@alaarab/ogrid-core').IColumnDef<T>[],
      this._groupByColumnIds,
      new Set<string>(),
    );
    const collectKeys = (groups: IRowGroup<T>[]): void => {
      for (const g of groups) {
        this._expandedGroups.add(g.groupKey);
        if (g.subGroups) collectKeys(g.subGroups);
      }
    };
    collectKeys(groupTree);
    this.emitter.emit('stateChange', { type: 'data' });
  }

  collapseAllGroups(): void {
    this._expandedGroups.clear();
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
    this._sortDirty = true; // explicit sort change: re-sort on next getProcessedItems call
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
    this._sortDirty = true; // explicit sort change: re-sort on next getProcessedItems call
    if (this.isServerSide) {
      this.fetchServerData();
    } else {
      this.emitter.emit('stateChange', { type: 'sort' });
    }
  }

  setFilter(key: string, value: FilterValue | undefined): void {
    this._filters = mergeFilter(this._filters, key, value);
    this._page = 1;
    this._sortDirty = true; // filter change requires re-sort to get the right subset
    if (this.isServerSide) {
      this.fetchServerData();
    } else {
      this.emitter.emit('stateChange', { type: 'filter' });
    }
  }

  clearFilters(): void {
    this._filters = {};
    this._page = 1;
    this._sortDirty = true; // filter change requires re-sort to get the right subset
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

  /** Update the container width for responsive column hiding. Invalidates the visible-cols cache. */
  setContainerWidth(width: number): void {
    if (this._containerWidth === width) return;
    this._containerWidth = width;
    if (this._responsiveColumns) {
      this._visibleColsDirty = true;
      this.emitter.emit('stateChange', { type: 'columns' });
    }
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
