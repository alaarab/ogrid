import type { IColumnDef, IColumnGroupDef, ICellValueChangedEvent } from './columnTypes';
import type {
  RowId,
  IFilters,
  IDataSource,
  RowSelectionMode,
  IRowSelectionChangeEvent,
  IOGridApi,
  ISideBarDef,
  IVirtualScrollConfig,
} from '@alaarab/ogrid-core';

// Re-export core types
export type {
  RowId,
  UserLike,
  UserLikeInput,
  FilterValue,
  IFilters,
  IFetchParams,
  IPageResult,
  IDataSource,
  IGridColumnState,
  RowSelectionMode,
  IRowSelectionChangeEvent,
  StatusBarPanel,
  IStatusBarProps,
  IActiveCell,
  ISelectionRange,
  SideBarPanelId,
  ISideBarDef,
  IVirtualScrollConfig,
  IOGridApi,
} from '@alaarab/ogrid-core';

/** Extended API for the vanilla JS package (adds methods not in the core IOGridApi). */
export interface IJsOGridApi<T> extends IOGridApi<T> {
  /** Export displayed rows to CSV and trigger a download. */
  exportToCsv: (filename?: string) => void;
  /** Scroll to a specific row by index (virtual scrolling). */
  scrollToRow: (index: number, options?: { align?: 'start' | 'center' | 'end' }) => void;
  /** Get the current column display order (array of column ids). */
  getColumnOrder: () => string[];
  /** Set the column display order. */
  setColumnOrder: (order: string[]) => void;
}

/** Options for the vanilla JS OGrid constructor. */
export interface OGridOptions<T> {
  columns: (IColumnDef<T> | IColumnGroupDef<T>)[];
  getRowId: (item: T) => RowId;

  /** Client-side data array. Mutually exclusive with dataSource. */
  data?: T[];
  /** Server-side data source. Mutually exclusive with data. */
  dataSource?: IDataSource<T>;

  /** Initial page (1-based). Default: 1. */
  page?: number;
  /** Rows per page. Default: 20. */
  pageSize?: number;
  /** Initial sort. */
  sort?: { field: string; direction: 'asc' | 'desc' };
  /** Initial filters. */
  filters?: IFilters;
  /** Initially visible columns (all visible if omitted). */
  visibleColumns?: Set<string>;

  editable?: boolean;
  cellSelection?: boolean;

  /** Callback fired when a cell value is changed via editing. */
  onCellValueChanged?: (event: ICellValueChangedEvent<T>) => void;

  rowSelection?: RowSelectionMode;
  /** Callback fired when row selection changes. */
  onSelectionChange?: (event: IRowSelectionChangeEvent<T>) => void;
  /** Controlled selected row IDs. */
  selectedRows?: Set<RowId>;

  /** Pin columns to left/right edges. Keys are columnIds. */
  pinnedColumns?: Record<string, 'left' | 'right'>;

  /** Layout mode: 'content' sizes to content, 'fill' fills container. Default: 'fill'. */
  layoutMode?: 'content' | 'fill';
  suppressHorizontalScroll?: boolean;

  /** Custom empty state message. */
  emptyMessage?: string;

  /** Accessible label for the grid. */
  'aria-label'?: string;

  /** Side bar configuration (columns panel + filters panel). */
  sideBar?: boolean | ISideBarDef;

  /** Error callback for server-side data source failures. */
  onError?: (error: unknown) => void;

  /** Callback fired when first data is rendered. */
  onFirstDataRendered?: () => void;

  /** Virtual scrolling configuration. */
  virtualScroll?: IVirtualScrollConfig;
}

/** Events emitted by the OGrid instance. */
export interface OGridEvents<T> extends Record<string, unknown> {
  cellValueChanged: ICellValueChangedEvent<T>;
  selectionChange: IRowSelectionChangeEvent<T>;
  sortChange: { field: string; direction: 'asc' | 'desc' };
  filterChange: { filters: IFilters };
  pageChange: { page: number };
}
