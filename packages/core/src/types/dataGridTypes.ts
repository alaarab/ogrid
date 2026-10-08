import type { FilterOption } from './columnTypes';
import type { IConditionFilterValue, IDateFilterValue, IColumnDef } from './columnTypes';

/** Row identifier type  -  grids accept string or number IDs. */
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

/** Discriminated filter value. The `type` field identifies the filter kind. */
export type FilterValue =
  | { type: 'text'; value: string }
  | { type: 'multiSelect'; value: string[] }
  | { type: 'people'; value: UserLike }
  | { type: 'date'; value: IDateFilterValue }
  | { type: 'condition'; value: IConditionFilterValue };

/** Unified filter model: field id -> discriminated filter value. */
export interface IFilters {
  [field: string]: FilterValue | undefined;
}

/** One level of a (multi-level) sort. */
export interface ISortModelItem {
  field: string;
  direction: 'asc' | 'desc';
}

/** Ordered sort levels: the first item is the primary sort, later items break ties. */
export type SortModel = ISortModelItem[];

export interface IFetchParams {
  page: number;
  pageSize: number;
  /** Primary sort level (same as `sortModel[0]`). */
  sort?: { field: string; direction: 'asc' | 'desc' };
  /** Every sort level, primary first. Empty when the grid is unsorted. */
  sortModel?: SortModel;
  filters: IFilters;
  /** Optional abort signal for cancelling stale requests when the grid state changes. */
  signal?: AbortSignal;
}

export interface IPageResult<T> {
  items: T[];
  totalCount: number;
}

/** Parameters describing a contiguous row window requested by the grid. */
export interface IRowWindowParams {
  /** First row index to fetch (0-based, inclusive). */
  start: number;
  /** One past the last row index to fetch (0-based, exclusive). */
  end: number;
  sort?: { field: string; direction: 'asc' | 'desc' };
  /** Every sort level, primary first (see IFetchParams.sortModel). */
  sortModel?: SortModel;
  filters: IFilters;
  /** Optional abort signal for cancelling stale window requests when grid state changes. */
  signal?: AbortSignal;
}

/** Result of a windowed row fetch. `items[0]` corresponds to row index `start`. */
export interface IRowWindowResult<T> {
  /** Rows for the requested window, in order. May be shorter than the window near the end of the dataset. */
  items: T[];
  /**
   * Total row count for the current sort/filter state. Optional: omit when the
   * count is unchanged from a prior call so the grid keeps its cached total.
   */
  totalCount?: number;
}

/** Sort/filter context shared by windowed row-count and row-window requests. */
export interface IRowQueryContext {
  sort?: { field: string; direction: 'asc' | 'desc' };
  /** Every sort level, primary first (see IFetchParams.sortModel). */
  sortModel?: SortModel;
  filters: IFilters;
  /** Optional abort signal for cancelling a stale request. */
  signal?: AbortSignal;
}

/**
 * Windowed data source: the grid asks only for the rows currently in (or near)
 * the viewport rather than whole pages. Implementations report `getRowCount`
 * for scrollbar geometry and serve `getRows` on demand. Pairs with
 * `createWindowedRowCache` for caching, in-flight dedup, and loading placeholders.
 *
 * A data source is treated as windowed when it provides BOTH `getRowCount` and
 * `getRows`; otherwise the grid falls back to the page-based `fetchPage` path.
 */
export interface IWindowedDataSource<T> {
  /**
   * Total number of rows for the given sort/filter state. Called when filters
   * or sort change so the grid can size the virtual scroll spacer. Should be
   * cheap to produce (e.g. a COUNT query), not a full data scan.
   */
  getRowCount(params: IRowQueryContext): Promise<number>;
  /** Fetch a contiguous window of rows. The grid requests only the visible window plus overscan. */
  getRows(params: IRowWindowParams): Promise<IRowWindowResult<T>>;
}

/**
 * Data source API. Provide EITHER the page-based `fetchPage` (classic
 * server-side pagination) OR the windowed pair `getRowCount` + `getRows`
 * (on-demand windowed fetching for very large datasets). `fetchPage` is
 * optional only so a pure windowed source can omit it; at least one mode
 * must be implemented.
 */
export interface IDataSource<T> extends Partial<IWindowedDataSource<T>> {
  fetchPage?(params: IFetchParams): Promise<IPageResult<T>>;
  fetchFilterOptions?(field: string): Promise<FilterOption[]>;
  searchPeople?(query: string): Promise<UserLike[]>;
  getUserByEmail?(email: string): Promise<UserLike | undefined>;
}

/**
 * Narrowing guard: true when a data source implements the windowed contract
 * (`getRowCount` + `getRows`). Use to pick the windowed fetch path over `fetchPage`.
 */
export function isWindowedDataSource<T>(
  ds: IDataSource<T> | undefined
): ds is IDataSource<T> & IWindowedDataSource<T> {
  return !!ds && typeof ds.getRowCount === 'function' && typeof ds.getRows === 'function';
}

/** Column state returned by getColumnState(). All fields JSON-serializable for persistence (e.g. localStorage). */
export interface IGridColumnState {
  visibleColumns: string[];
  sort?: { field: string; direction: 'asc' | 'desc' };
  /** Every sort level, primary first. Takes precedence over `sort` in applyColumnState. */
  sortModel?: SortModel;
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
  /** Every selected row id, including rows on other pages. */
  selectedRowIds: RowId[];
  /**
   * The selected rows the grid could resolve to objects. Checkbox and header clicks
   * resolve against the current page only, so with pagination this can be shorter
   * than `selectedRowIds`; treat the ids as the source of truth.
   */
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
  /** Number of selected cells in the current cell range. Omit or 0/1 to hide. */
  selectedCellCount?: number;
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

/**
 * A merged cell block (Excel-style "Merge Cells"). The anchor cell at
 * (`rowId`, `columnId`) renders across `rowSpan` rows and `colSpan` columns;
 * the cells it covers are not rendered. Spans default to 1 and count
 * DISPLAYED rows (after sort/filter/paging) and VISIBLE columns, starting at
 * the anchor. A merge whose anchor is not displayed is ignored; spans are
 * clipped at the end of the view, at the pinned/unpinned column boundary and
 * at the frozen-row boundary.
 */
export interface IMergedCell {
  rowId: RowId;
  columnId: string;
  rowSpan?: number;
  colSpan?: number;
}

/**
 * An Excel-style cell note (comment) on the cell at (`rowId`, `columnId`).
 * Notes are keyed by row id and column id, so they follow their record
 * through sort, filter and paging; a note whose row or column isn't displayed
 * isn't shown.
 */
export interface ICellNote {
  rowId: RowId;
  columnId: string;
  /** Note text (plain text; line breaks are kept). */
  text: string;
  /** Who wrote the note. */
  author?: string;
  /** When the note was created (ISO 8601 string). */
  createdAt?: string;
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

// --- Sheet tabs ---

/** Definition for a sheet tab. */
export interface ISheetDef {
  id: string;
  name: string;
  /** Optional tab color (CSS value). */
  color?: string;
}

// --- Virtual scrolling ---

/** Configuration for virtual scrolling. */
export interface IVirtualScrollConfig {
  /** Enable virtual scrolling (default: false). */
  enabled?: boolean;
  /**
   * Whether the grid still paginates while virtualizing (default: true).
   *
   * `true` — virtual scrolling renders only the visible slice of the *current
   * page*. Pagination controls stay active; each page is a separate scroll.
   *
   * `false` — full-dataset virtualization. Pagination is bypassed: every row is
   * a candidate for rendering and the grid virtual-scrolls the entire dataset
   * in one continuous viewport. Pagination controls are hidden. Use this for
   * large in-memory datasets where paging would be an arbitrary interruption.
   *
   * Only meaningful when `enabled` is `true` and the grid is client-side
   * (`data`, not `dataSource`).
   */
  paginate?: boolean;
  /** Fixed row height in pixels (required when enabled). */
  rowHeight?: number;
  /** Number of extra rows to render above/below the visible area (default: 5). */
  overscan?: number;
  /**
   * Minimum row count before virtual scrolling activates (default: 100).
   * When totalRows < threshold, all rows are rendered without virtualization.
   * Lower values activate virtualization earlier (more memory-efficient for mid-size grids);
   * higher values keep small grids fully rendered (no scroll offset artifacts).
   */
  threshold?: number;
  /** Enable column virtualization  -  only render visible columns (default: false). */
  columns?: boolean;
  /** Number of extra columns to render outside the visible area (default: 2). */
  columnOverscan?: number;
}

// --- Column reordering ---

/** Configuration for column reordering via drag-and-drop. */
export interface IColumnReorderConfig {
  /** Enable column reordering (default: false). */
  enabled?: boolean;
}

/**
 * Event payload when rows are inserted or deleted (the `insertRows` /
 * `deleteRows` API, the row context menu, or undo/redo of either).
 */
export interface IRowsChangeEvent<T> {
  /** Whether rows were inserted into or deleted from the data. */
  type: 'insert' | 'delete';
  /** The inserted or deleted rows, in data order. */
  rows: T[];
  /**
   * Index of each row in `rows`: for an insert, its index in `data` (the new
   * array); for a delete, the index it had in the array before the delete.
   */
  indexes: number[];
  /** The complete data array after the change. Pass it to your state setter. */
  data: T[];
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
  /** Select every row that passes the current filters, across pages (server-side: the loaded page). */
  selectAll: () => void;
  /** Deselect all rows. */
  deselectAll: () => void;
  /** Clear all filters (shorthand for setFilterModel({})). */
  clearFilters: () => void;
  /** Reset sort to the default (`defaultSortBy`, or the first sortable column, ascending). */
  clearSort: () => void;
  /** Reset all grid state (filters, sort, selection). */
  resetGridState: (options?: { keepSelection?: boolean }) => void;
  /** Get the currently displayed (paginated) rows. */
  getDisplayedRows: () => T[];
  /** Re-trigger a data fetch (server-side only; no-op for client-side). */
  refreshData: () => void;
  /** Scroll to a specific row by index (virtual scrolling). */
  scrollToRow: (index: number, options?: { align?: 'start' | 'center' | 'end' }) => void;
  /** Get the current column display order (array of column ids). */
  getColumnOrder: () => string[];
  /** Set the column display order. */
  setColumnOrder: (order: string[]) => void;
  /**
   * Read a cell. Returns the computed result for a formula cell, otherwise the
   * value the column reads from the row (`valueGetter` or `row[columnId]`).
   * `undefined` when the row or column does not exist. Client-side grids find
   * any row in `data`; server-side grids only the loaded rows.
   */
  getCellValue: (rowId: RowId, columnId: string) => unknown;
  /**
   * Write a cell as if the user had typed `value` into it: the column's
   * `valueParser` runs (a rejected value is dropped), `onCellValueChanged`
   * fires, the change joins the undo history, and with `formulas` on a string
   * starting with '=' becomes the cell's formula. Ignores `editable` (this is
   * a programmatic write); needs `onCellValueChanged` to apply a plain value.
   */
  setCellValue: (rowId: RowId, columnId: string, value: unknown) => void;
  /**
   * Insert rows before `index` in `data` (`data.length` appends). Without
   * `rows`, one row from the `createRow` prop is inserted. Reports the change
   * through `onRowsChange`; undoable. Client-side grids only.
   */
  insertRows: (index: number, rows?: T[]) => void;
  /** Delete the rows with these ids. Reports through `onRowsChange`; undoable. Client-side grids only. */
  deleteRows: (rowIds: RowId[]) => void;
  /**
   * Insert a column so it becomes leaf column `index` (an index into the
   * flattened `columns`). Without `column`, a blank editable column
   * (`column1`, `column2`, ...) is inserted. Reports through `onColumnsChange`; undoable.
   */
  insertColumn: (index: number, column?: IColumnDef<T>) => void;
  /** Delete a column. Reports through `onColumnsChange`; undoable. The row data keeps the field. */
  deleteColumn: (columnId: string) => void;
}
