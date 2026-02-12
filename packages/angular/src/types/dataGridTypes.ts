import type { TemplateRef } from '@angular/core';
import type { IColumnDef, IColumnGroupDef, ICellValueChangedEvent } from './columnTypes';

// Re-export all shared types and functions from core (no Angular-specific changes)
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
  IOGridApi,
} from '@alaarab/ogrid-core';

export { toUserLike, isInSelectionRange, normalizeSelectionRange } from '@alaarab/ogrid-core';

// Import types needed by Angular-specific interfaces below
import type {
  RowId,
  UserLike,
  IFilters,
  FilterValue,
  RowSelectionMode,
  IRowSelectionChangeEvent,
  IStatusBarProps,
  IDataSource,
  ISideBarDef,
} from '@alaarab/ogrid-core';

// --- OGrid / OGridService ---

/** Base props shared by both client-side and server-side OGrid modes. */
interface IOGridBaseProps<T> {
  columns: (IColumnDef<T> | IColumnGroupDef<T>)[];
  getRowId: (item: T) => RowId;

  page?: number;
  pageSize?: number;
  sort?: { field: string; direction: 'asc' | 'desc' };
  filters?: IFilters;
  visibleColumns?: Set<string>;
  isLoading?: boolean;

  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  onSortChange?: (sort: { field: string; direction: 'asc' | 'desc' }) => void;
  onFiltersChange?: (filters: IFilters) => void;
  onVisibleColumnsChange?: (cols: Set<string>) => void;
  columnOrder?: string[];
  onColumnOrderChange?: (order: string[]) => void;
  onColumnResized?: (columnId: string, width: number) => void;
  onColumnPinned?: (columnId: string, pinned: 'left' | 'right' | null) => void;
  freezeRows?: number;
  freezeCols?: number;
  editable?: boolean;
  cellSelection?: boolean;
  density?: 'compact' | 'normal' | 'comfortable';
  onCellValueChanged?: (event: ICellValueChangedEvent<T>) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;

  rowSelection?: RowSelectionMode;
  selectedRows?: Set<RowId>;
  onSelectionChange?: (event: IRowSelectionChangeEvent<T>) => void;

  statusBar?: boolean | IStatusBarProps;

  defaultPageSize?: number;
  defaultSortBy?: string;
  defaultSortDirection?: 'asc' | 'desc';

  toolbar?: TemplateRef<unknown>;
  toolbarBelow?: TemplateRef<unknown>;
  emptyState?: { message?: string; render?: TemplateRef<unknown> };
  entityLabelPlural?: string;
  className?: string;
  columnChooser?: boolean | 'toolbar' | 'sidebar';

  layoutMode?: 'content' | 'fill';
  suppressHorizontalScroll?: boolean;
  sideBar?: boolean | ISideBarDef;
  pageSizeOptions?: number[];
  onFirstDataRendered?: () => void;
  onError?: (error: unknown) => void;
  onCellError?: (error: Error) => void;

  'aria-label'?: string;
  'aria-labelledby'?: string;
}

/** Client-side mode: pass a data array. */
export interface IOGridClientProps<T> extends IOGridBaseProps<T> {
  data: T[];
  dataSource?: never;
}

/** Server-side mode: pass a dataSource. */
export interface IOGridServerProps<T> extends IOGridBaseProps<T> {
  data?: never;
  dataSource: IDataSource<T>;
}

/** Props for the OGrid wrapper (shared across Angular UI packages).
 *  Must provide either `data` (client-side) or `dataSource` (server-side), not both. */
export type IOGridProps<T> = IOGridClientProps<T> | IOGridServerProps<T>;

/** Props passed from OGridService to the framework-specific DataGridTable. */
export interface IOGridDataGridProps<T> {
  items: T[];
  columns: (IColumnDef<T> | IColumnGroupDef<T>)[];
  getRowId: (item: T) => RowId;
  sortBy?: string;
  sortDirection: 'asc' | 'desc';
  onColumnSort: (columnKey: string) => void;
  visibleColumns: Set<string>;
  columnOrder?: string[];
  onColumnOrderChange?: (order: string[]) => void;
  onColumnResized?: (columnId: string, width: number) => void;
  onColumnPinned?: (columnId: string, pinned: 'left' | 'right' | null) => void;
  pinnedColumns?: Record<string, 'left' | 'right'>;
  initialColumnWidths?: Record<string, number>;
  freezeRows?: number;
  freezeCols?: number;
  layoutMode?: 'content' | 'fill';
  suppressHorizontalScroll?: boolean;
  isLoading?: boolean;
  loadingMessage?: string;
  editable?: boolean;
  cellSelection?: boolean;
  density?: 'compact' | 'normal' | 'comfortable';
  onCellValueChanged?: (event: ICellValueChangedEvent<T>) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  rowSelection?: RowSelectionMode;
  selectedRows?: Set<RowId>;
  onSelectionChange?: (event: IRowSelectionChangeEvent<T>) => void;
  showRowNumbers?: boolean;
  currentPage?: number;
  pageSize?: number;
  statusBar?: IStatusBarProps;
  filters: IFilters;
  onFilterChange: (key: string, value: FilterValue | undefined) => void;
  filterOptions: Record<string, string[]>;
  loadingFilterOptions: Record<string, boolean>;
  peopleSearch?: (query: string) => Promise<UserLike[]>;
  getUserByEmail?: (email: string) => Promise<UserLike | undefined>;
  emptyState?: {
    onClearAll: () => void;
    hasActiveFilters: boolean;
    message?: string;
    render?: TemplateRef<unknown>;
  };
  onCellError?: (error: Error) => void;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}
