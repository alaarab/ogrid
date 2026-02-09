import type { ReactNode } from 'react';
import type { IColumnDef, IColumnGroupDef, ICellValueChangedEvent } from './columnTypes';

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

/** Single filter value: text (string), multi-select (string[]), or people (UserLike). */
export type FilterValue = string | string[] | UserLike;

/** Unified filter model: field id -> filter value. Use FilterValue for type-safe access. */
export interface IFilters {
  [field: string]: FilterValue | undefined;
}

/** Split IFilters into DataGridTable's multiSelect, text, and people props. */
export function toDataGridFilterProps(filters: IFilters): {
  multiSelectFilters: Record<string, string[]>;
  textFilters: Record<string, string>;
  peopleFilters: Record<string, UserLike | undefined>;
} {
  const multiSelectFilters: Record<string, string[]> = {};
  const textFilters: Record<string, string> = {};
  const peopleFilters: Record<string, UserLike | undefined> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) multiSelectFilters[key] = value;
    else if (typeof value === 'string') textFilters[key] = value;
    else if (typeof value === 'object' && value !== null && 'email' in value) peopleFilters[key] = value as UserLike;
  }
  return { multiSelectFilters, textFilters, peopleFilters };
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

/** Column state returned by getColumnState(). Uses string[] for JSON-serializability (e.g. column state persistence). */
export interface IGridColumnState {
  visibleColumns: string[];
  sort?: { field: string; direction: 'asc' | 'desc' };
}

// --- Row selection ---

/** Row selection mode. */
export type RowSelectionMode = 'none' | 'single' | 'multiple';

/** Event payload when row selection changes. Uses string[] for JSON-serializability. */
export interface IRowSelectionChangeEvent<T> {
  selectedRowIds: string[];
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

/** Imperative grid API exposed via ref. */
export interface IOGridApi<T> {
  /** Set row data (client-side only; no-op when using dataSource). */
  setRowData: (data: T[]) => void;
  /** Set loading overlay. */
  setLoading: (loading: boolean) => void;
  /** Get current column state (visible columns, sort). */
  getColumnState: () => IGridColumnState;
  /** Set filter model (unified IFilters). */
  setFilterModel: (filters: IFilters) => void;
  /** Get currently selected row IDs. */
  getSelectedRows: () => string[];
  /** Set selected row IDs programmatically. */
  setSelectedRows: (rowIds: string[]) => void;
  /** Select all rows. */
  selectAll: () => void;
  /** Deselect all rows. */
  deselectAll: () => void;
}

// --- OGrid / useOGrid ---

/** Props for the OGrid wrapper component (shared across Fluent, Material, Radix). */
export interface IOGridProps<T> {
  columns: (IColumnDef<T> | IColumnGroupDef<T>)[];
  getRowId: (item: T) => string;
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
  freezeRows?: number;
  freezeCols?: number;
  editable?: boolean;
  onCellValueChanged?: (event: ICellValueChangedEvent<T>) => void;
  onUndo?: () => void;
  onRedo?: () => void;

  rowSelection?: RowSelectionMode;
  selectedRows?: Set<string>;
  onSelectionChange?: (event: IRowSelectionChangeEvent<T>) => void;

  statusBar?: boolean | IStatusBarProps;

  defaultPageSize?: number;
  defaultSortBy?: string;
  defaultSortDirection?: 'asc' | 'desc';

  toolbar?: ReactNode;
  emptyState?: { message?: ReactNode; render?: () => ReactNode };
  entityLabelPlural?: string;
  className?: string;
  title?: ReactNode;

  layoutMode?: 'content' | 'fill';

  /** Called when server-side fetchPage fails. */
  onError?: (error: unknown) => void;

  'aria-label'?: string;
  'aria-labelledby'?: string;
}

/** Props passed from useOGrid to the framework-specific DataGridTable. */
export interface IOGridDataGridProps<T> {
  items: T[];
  columns: (IColumnDef<T> | IColumnGroupDef<T>)[];
  getRowId: (item: T) => string;
  sortBy: string;
  sortDirection: 'asc' | 'desc';
  onColumnSort: (columnKey: string) => void;
  visibleColumns: Set<string>;
  /** Optional column display order (column ids). When set, visible columns are ordered by this array. */
  columnOrder?: string[];
  onColumnOrderChange?: (order: string[]) => void;
  /** Number of rows to freeze (sticky), e.g. 1 = header row. */
  freezeRows?: number;
  /** Number of data columns to freeze (sticky left). */
  freezeCols?: number;
  layoutMode?: 'content' | 'fill';
  isLoading?: boolean;
  loadingMessage?: string;
  editable?: boolean;
  onCellValueChanged?: (event: ICellValueChangedEvent<T>) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  rowSelection?: RowSelectionMode;
  selectedRows?: Set<string>;
  onSelectionChange?: (event: IRowSelectionChangeEvent<T>) => void;
  statusBar?: IStatusBarProps;
  multiSelectFilters: Record<string, string[]>;
  onMultiSelectFilterChange: (key: string, values: string[]) => void;
  textFilters?: Record<string, string>;
  onTextFilterChange?: (key: string, value: string) => void;
  peopleFilters?: Record<string, UserLike | undefined>;
  onPeopleFilterChange?: (key: string, user: UserLike | undefined) => void;
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
