import type { ReactNode } from 'react';
import type { IColumnDef, IColumnGroupDef, ICellValueChangedEvent, IDateFilterValue } from './columnTypes';

/** Row identifier type — grids accept string or number IDs. */
export type RowId = string | number;

export interface UserLike {
  id?: string;
  displayName: string;
  email: string;
  photo?: string;
}

/** Input shape for toUserLike (e.g. from Graph API or directory). */
export type UserLikeInput = {
  displayName: string;
  mail?: string;
  userPrincipalName?: string;
  email?: string;
  id?: string;
  photo?: string;
};

export function toUserLike(u: UserLikeInput | undefined): UserLike | undefined {
  if (!u) return undefined;
  return {
    id: u.id,
    displayName: u.displayName,
    email: 'email' in u && u.email ? u.email : (u.mail || u.userPrincipalName || ''),
    photo: u.photo
  };
}

/** Single filter value: text (string), multi-select (string[]), people (UserLike), or date range. */
export type FilterValue = string | string[] | UserLike | IDateFilterValue;

/** Unified filter model: field id -> filter value. Use FilterValue for type-safe access. */
export interface IFilters {
  [field: string]: FilterValue | undefined;
}

/** Type guard for IDateFilterValue. */
function isDateFilterValue(value: unknown): value is IDateFilterValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !('email' in value) && ('from' in value || 'to' in value);
}

/** Split IFilters into DataGridTable's multiSelect, text, people, and date props. */
export function toDataGridFilterProps(filters: IFilters): {
  multiSelectFilters: Record<string, string[]>;
  textFilters: Record<string, string>;
  peopleFilters: Record<string, UserLike | undefined>;
  dateFilters: Record<string, IDateFilterValue>;
} {
  const multiSelectFilters: Record<string, string[]> = {};
  const textFilters: Record<string, string> = {};
  const peopleFilters: Record<string, UserLike | undefined> = {};
  const dateFilters: Record<string, IDateFilterValue> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) multiSelectFilters[key] = value;
    else if (typeof value === 'string') textFilters[key] = value;
    else if (typeof value === 'object' && value !== null && 'email' in value) peopleFilters[key] = value as UserLike;
    else if (isDateFilterValue(value)) dateFilters[key] = value;
  }
  return { multiSelectFilters, textFilters, peopleFilters, dateFilters };
}

export interface IFetchParams {
  page: number;
  pageSize: number;
  sort?: { field: string; direction: 'asc' | 'desc' };
  filters: IFilters;
}

export interface IPageResult<T> {
  items: T[];
  totalCount: number;
}

/** Data source API: fetch a page and optionally filter options / people. */
export interface IDataSource<T> {
  fetchPage(params: IFetchParams): Promise<IPageResult<T>>;
  fetchFilterOptions?(field: string): Promise<string[]>;
  searchPeople?(query: string): Promise<UserLike[]>;
  getUserByEmail?(email: string): Promise<UserLike | undefined>;
}

/** Column state returned by getColumnState(). All fields JSON-serializable for persistence (e.g. localStorage). */
export interface IGridColumnState {
  visibleColumns: string[];
  sort?: { field: string; direction: 'asc' | 'desc' };
  /** Column display order (array of column ids). */
  columnOrder?: string[];
  /** Column widths (column id -> width in pixels). */
  columnWidths?: Record<string, number>;
  /** Active filters. */
  filters?: IFilters;
  /** Pinned columns (column id -> 'left' | 'right'). */
  pinnedColumns?: Record<string, 'left' | 'right'>;
}

// --- Row selection ---

/** Row selection mode. */
export type RowSelectionMode = 'none' | 'single' | 'multiple';

/** Event payload when row selection changes. */
export interface IRowSelectionChangeEvent<T> {
  selectedRowIds: RowId[];
  selectedItems: T[];
}

// --- Status bar ---

/** Status bar panel definition. */
export type StatusBarPanel = 'rowCount' | 'filteredRowCount' | 'selectedRowCount';

/** Props for the status bar. */
export interface IStatusBarProps {
  /** Total row count (unfiltered). */
  totalCount: number;
  /** Filtered row count (after filters applied). Omit to hide. */
  filteredCount?: number;
  /** Number of selected rows. Omit or 0 to hide. */
  selectedCount?: number;
  /** Panels to show (default: all applicable). */
  panels?: StatusBarPanel[];
  /** Aggregation values for selected numeric cells. */
  aggregation?: {
    sum: number;
    avg: number;
    min: number;
    max: number;
    count: number;
  } | null;
  /** When true, hides the "Rows: X" label (e.g. when pagination already shows it). */
  suppressRowCount?: boolean;
}

// --- Active cell (keyboard navigation) ---

/** Identifies a cell for keyboard navigation. */
export interface IActiveCell {
  rowIndex: number;
  columnIndex: number;
}

// --- Cell range selection (spreadsheet-style) ---

/** Rectangular cell range (inclusive). Column indices are data-column indices (0 = first data column). */
export interface ISelectionRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

/** Returns true if (row, col) is inside the range (inclusive). */
export function isInSelectionRange(
  range: ISelectionRange,
  row: number,
  col: number
): boolean {
  const minR = Math.min(range.startRow, range.endRow);
  const maxR = Math.max(range.startRow, range.endRow);
  const minC = Math.min(range.startCol, range.endCol);
  const maxC = Math.max(range.startCol, range.endCol);
  return row >= minR && row <= maxR && col >= minC && col <= maxC;
}

/** Normalize range so start ≤ end for both dimensions. */
export function normalizeSelectionRange(range: ISelectionRange): ISelectionRange {
  return {
    startRow: Math.min(range.startRow, range.endRow),
    endRow: Math.max(range.startRow, range.endRow),
    startCol: Math.min(range.startCol, range.endCol),
    endCol: Math.max(range.startCol, range.endCol),
  };
}

// --- Side bar ---

/** Available side bar panel identifiers. */
export type SideBarPanelId = 'columns' | 'filters';

/** Side bar configuration options. */
export interface ISideBarDef {
  /** Which panels to show (default: ['columns', 'filters']). */
  panels?: SideBarPanelId[];
  /** Panel to open on mount. */
  defaultPanel?: SideBarPanelId;
  /** Position of the side bar (default: 'right'). */
  position?: 'left' | 'right';
}

/** Imperative grid API exposed via ref. */
export interface IOGridApi<T> {
  /** Set row data (client-side only; no-op when using dataSource). */
  setRowData: (data: T[]) => void;
  /** Set loading overlay. */
  setLoading: (loading: boolean) => void;
  /** Get current column state (visibility, order, widths, sort, filters). */
  getColumnState: () => IGridColumnState;
  /** Bulk restore column state (visibility, order, widths, sort, filters). All fields optional. */
  applyColumnState: (state: Partial<IGridColumnState>) => void;
  /** Set filter model (unified IFilters). */
  setFilterModel: (filters: IFilters) => void;
  /** Get currently selected row IDs. */
  getSelectedRows: () => RowId[];
  /** Set selected row IDs programmatically. */
  setSelectedRows: (rowIds: RowId[]) => void;
  /** Select all rows. */
  selectAll: () => void;
  /** Deselect all rows. */
  deselectAll: () => void;
}

// --- OGrid / useOGrid ---

/** Props for the OGrid wrapper component (shared across Fluent, Material, Radix). */
export interface IOGridProps<T> {
  columns: (IColumnDef<T> | IColumnGroupDef<T>)[];
  getRowId: (item: T) => RowId;
  data?: T[];
  dataSource?: IDataSource<T>;

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
  /** Called when a column is resized by the user. */
  onColumnResized?: (columnId: string, width: number) => void;
  /** Called when a column is pinned or unpinned. */
  onColumnPinned?: (columnId: string, pinned: 'left' | 'right' | null) => void;
  freezeRows?: number;
  freezeCols?: number;
  editable?: boolean;
  /** Enable spreadsheet-like cell selection (active cell, range, fill handle, clipboard, context menu). Default: true. */
  cellSelection?: boolean;
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

  toolbar?: ReactNode;
  emptyState?: { message?: ReactNode; render?: () => ReactNode };
  entityLabelPlural?: string;
  className?: string;
  /** @deprecated Render your title outside the OGrid component. Will be removed in next major. */
  title?: ReactNode;

  /** Where the column chooser renders.
   *  - `true` or `'toolbar'` (default): column chooser button in the toolbar strip.
   *  - `'sidebar'`: column chooser only available via the sidebar columns panel.
   *  - `false`: column chooser hidden entirely. */
  columnChooser?: boolean | 'toolbar' | 'sidebar';

  layoutMode?: 'content' | 'fill';

  /** When true, horizontal scrolling is suppressed (overflow-x hidden). */
  suppressHorizontalScroll?: boolean;

  /** Side bar configuration. `true` shows default panels (columns + filters). Pass ISideBarDef for options. */
  sideBar?: boolean | ISideBarDef;

  /** Page size options shown in the pagination dropdown. Default: [10, 20, 50, 100]. */
  pageSizeOptions?: number[];

  /** Fires once when the grid first renders with data (useful for restoring column state). */
  onFirstDataRendered?: () => void;

  /** Called when server-side fetchPage fails. */
  onError?: (error: unknown) => void;

  'aria-label'?: string;
  'aria-labelledby'?: string;
}

/** Props passed from useOGrid to the framework-specific DataGridTable. */
export interface IOGridDataGridProps<T> {
  items: T[];
  columns: (IColumnDef<T> | IColumnGroupDef<T>)[];
  getRowId: (item: T) => RowId;
  sortBy?: string;
  sortDirection: 'asc' | 'desc';
  onColumnSort: (columnKey: string) => void;
  visibleColumns: Set<string>;
  /** Optional column display order (column ids). When set, visible columns are ordered by this array. */
  columnOrder?: string[];
  onColumnOrderChange?: (order: string[]) => void;
  /** Called when a column is resized by the user. */
  onColumnResized?: (columnId: string, width: number) => void;
  /** Called when a column is pinned or unpinned. */
  onColumnPinned?: (columnId: string, pinned: 'left' | 'right' | null) => void;
  /** Runtime pin overrides (from restored state or programmatic changes). */
  pinnedColumns?: Record<string, 'left' | 'right'>;
  /** Initial column width overrides (from restored state). */
  initialColumnWidths?: Record<string, number>;
  /** Number of rows to freeze (sticky), e.g. 1 = header row. */
  freezeRows?: number;
  /** Number of data columns to freeze (sticky left). */
  freezeCols?: number;
  layoutMode?: 'content' | 'fill';
  /** When true, horizontal scrolling is suppressed (overflow-x hidden). */
  suppressHorizontalScroll?: boolean;
  isLoading?: boolean;
  loadingMessage?: string;
  editable?: boolean;
  /** Enable spreadsheet-like cell selection. Default: true. */
  cellSelection?: boolean;
  onCellValueChanged?: (event: ICellValueChangedEvent<T>) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  rowSelection?: RowSelectionMode;
  selectedRows?: Set<RowId>;
  onSelectionChange?: (event: IRowSelectionChangeEvent<T>) => void;
  statusBar?: IStatusBarProps;
  multiSelectFilters: Record<string, string[]>;
  onMultiSelectFilterChange: (key: string, values: string[]) => void;
  textFilters?: Record<string, string>;
  onTextFilterChange?: (key: string, value: string) => void;
  peopleFilters?: Record<string, UserLike | undefined>;
  onPeopleFilterChange?: (key: string, user: UserLike | undefined) => void;
  dateFilters?: Record<string, IDateFilterValue>;
  onDateFilterChange?: (key: string, value: IDateFilterValue | undefined) => void;
  filterOptions: Record<string, string[]>;
  loadingFilterOptions: Record<string, boolean>;
  peopleSearch?: (query: string) => Promise<UserLike[]>;
  getUserByEmail?: (email: string) => Promise<UserLike | undefined>;
  emptyState?: {
    onClearAll: () => void;
    hasActiveFilters: boolean;
    message?: ReactNode;
    render?: () => ReactNode;
  };
  'aria-label'?: string;
  'aria-labelledby'?: string;
}
