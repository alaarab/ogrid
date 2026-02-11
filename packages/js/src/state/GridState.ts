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
} from '@alaarab/ogrid-core';
import {
  flattenColumns,
  processClientSideData,
  exportToCsv as coreExportToCsv,
  getCellValue,
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

  constructor(options: OGridOptions<T>) {
    this._allColumns = options.columns;
    // flattenColumns expects core types - cast to unknown first to avoid type conflicts
    this._columns = flattenColumns(options.columns as unknown as Parameters<typeof flattenColumns>[0]) as IColumnDef<T>[];
    this._getRowId = options.getRowId;
    this._data = options.data ?? [];
    this._page = options.page ?? 1;
    this._pageSize = options.pageSize ?? 20;
    this._sort = options.sort;
    this._filters = options.filters ?? {};
    this._visibleColumns = options.visibleColumns ?? new Set(this._columns.map(c => c.columnId));
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

  /** Get the visible columns in display order. */
  get visibleColumnDefs(): IColumnDef<T>[] {
    return this._columns.filter(c => this._visibleColumns.has(c.columnId));
  }

  /** Get processed (sorted, filtered, paginated) items for current page. */
  getProcessedItems(): { items: T[]; totalCount: number } {
    // processClientSideData signature: (data, columns, filters, sortBy?, sortDirection?)
    // Cast to unknown first to work around structural type differences
    const filtered = processClientSideData(
      this._data,
      this._columns as unknown as Parameters<typeof processClientSideData>[1],
      this._filters,
      this._sort?.field,
      this._sort?.direction
    ) as T[];

    const totalCount = filtered.length;

    // Apply pagination
    const startIdx = (this._page - 1) * this._pageSize;
    const endIdx = startIdx + this._pageSize;
    const items = filtered.slice(startIdx, endIdx);

    return { items, totalCount };
  }

  // --- Setters ---

  setData(data: T[]): void {
    this._data = data;
    this.emitter.emit('stateChange', { type: 'data' });
  }

  setPage(page: number): void {
    this._page = page;
    this.emitter.emit('stateChange', { type: 'page' });
  }

  setPageSize(pageSize: number): void {
    this._pageSize = pageSize;
    this._page = 1;
    this.emitter.emit('stateChange', { type: 'page' });
  }

  setSort(sort: { field: string; direction: 'asc' | 'desc' } | undefined): void {
    this._sort = sort;
    this._page = 1;
    this.emitter.emit('stateChange', { type: 'sort' });
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
    this.emitter.emit('stateChange', { type: 'sort' });
  }

  setFilter(key: string, value: FilterValue | undefined): void {
    if (value === undefined) {
      const next = { ...this._filters };
      delete next[key];
      this._filters = next;
    } else {
      this._filters = { ...this._filters, [key]: value };
    }
    this._page = 1;
    this.emitter.emit('stateChange', { type: 'filter' });
  }

  clearFilters(): void {
    this._filters = {};
    this._page = 1;
    this.emitter.emit('stateChange', { type: 'filter' });
  }

  setVisibleColumns(columns: Set<string>): void {
    this._visibleColumns = columns;
    this.emitter.emit('stateChange', { type: 'columns' });
  }

  setLoading(loading: boolean): void {
    this._isLoading = loading;
    this.emitter.emit('stateChange', { type: 'loading' });
  }

  // --- Event subscription ---

  onStateChange(handler: (event: StateChangeEvent) => void): () => void {
    this.emitter.on('stateChange', handler);
    return () => this.emitter.off('stateChange', handler);
  }

  // --- API ---

  getApi(): IJsOGridApi<T> {
    return {
      setRowData: (data: T[]) => this.setData(data),
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
        this.emitter.emit('stateChange', { type: 'columns' });
      },
      setFilterModel: (filters: IFilters) => {
        this._filters = filters;
        this._page = 1;
        this.emitter.emit('stateChange', { type: 'filter' });
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
      refreshData: () => {},
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
    this.emitter.removeAllListeners();
  }
}
