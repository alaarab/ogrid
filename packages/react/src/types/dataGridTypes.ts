import type { FilterOption, ICellConditionalFormat, IConditionalFormatRule } from '@alaarab/ogrid-core';
import type { ReactNode } from 'react';
import type { IColumnDef, IColumnGroupDef, ICellValueChangedEvent } from './columnTypes';
import type { IFormulaFunction, IFormulaLimits, IRecalcResult, IGridDataAccessor, IAuditEntry, IAuditTrail, IResponsiveColumnsConfig, WindowedRow, PageSize, IFormulaRowMap, ISheetReferenceRange, IHiddenGaps } from '@alaarab/ogrid-core';

// Re-export all shared types and functions from core (no React-specific changes)
export type {
  RowId,
  UserLike,
  UserLikeInput,
  FilterValue,
  IFilters,
  IFetchParams,
  IPageResult,
  IRowWindowParams,
  IRowWindowResult,
  IRowQueryContext,
  IWindowedDataSource,
  IDataSource,
  IGridColumnState,
  RowSelectionMode,
  IRowSelectionChangeEvent,
  StatusBarPanel,
  IStatusBarProps,
  IActiveCell,
  ISelectionRange,
  IMergedCell,
  ICellNote,
  SideBarPanelId,
  ISideBarDef,
  ISheetDef,
  IVirtualScrollConfig,
  IColumnReorderConfig,
  IOGridApi,
  IRowsChangeEvent,
} from '@alaarab/ogrid-core';

export { toUserLike, isInSelectionRange, normalizeSelectionRange, isWindowedDataSource } from '@alaarab/ogrid-core';

// Import types needed by React-specific interfaces below
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
  ISheetDef,
  IVirtualScrollConfig,
  IMergedCell,
  ICellNote,
  IRowsChangeEvent,
} from '@alaarab/ogrid-core';

// --- Structure edits ---

/**
 * Event payload when a column is inserted or deleted (the `insertColumn` /
 * `deleteColumn` API, the context or column header menu, or undo/redo).
 */
export interface IColumnsChangeEvent<T> {
  /** Whether the column was inserted or deleted. */
  type: 'insert' | 'delete';
  /** The inserted or deleted column. */
  column: IColumnDef<T>;
  /**
   * Flat (leaf) index of the column: where it now sits for an insert, where it
   * sat before a delete. Formula column letters follow this index.
   */
  index: number;
  /** The complete `columns` value after the change. Pass it to your state setter. */
  columns: (IColumnDef<T> | IColumnGroupDef<T>)[];
}

/**
 * Structure-edit actions the table's menus call (OGrid builds these when
 * `allowStructureEdits` is on). Rows are addressed by record, columns by id.
 */
export interface IGridStructureActions<T> {
  /** True when rows can be inserted from the menu (client-side data and a `createRow` prop). */
  canInsertRows: boolean;
  /** True when rows can be deleted (client-side data). */
  canDeleteRows: boolean;
  /** True when columns can be inserted and deleted (an `onColumnsChange` handler). */
  canEditColumns: boolean;
  /** Insert `count` new rows before (`above`) or after (`below`) `item` in the data. */
  insertRowsNear: (item: T, position: 'above' | 'below', count: number) => void;
  /** Delete these rows. */
  deleteRows: (rowIds: RowId[]) => void;
  /** Insert `count` blank columns left or right of `columnId`. */
  insertColumnsNear: (columnId: string, side: 'left' | 'right', count: number) => void;
  /** Delete these columns (one undo step). */
  deleteColumns: (columnIds: string[]) => void;
}

/**
 * Hide/unhide actions the table's menus and gap markers call (OGrid builds
 * these when `allowHiding` is on).
 */
export interface IGridHidingActions {
  /** Hide these columns (at least one column always stays visible). */
  hideColumns: (columnIds: string[]) => void;
  /** Show these columns again. */
  unhideColumns: (columnIds: string[]) => void;
  /** Hide these rows. Absent when rows can't be hidden (a windowed data source). */
  hideRows?: (rowIds: RowId[]) => void;
  /** Show these rows again. */
  unhideRows?: (rowIds: RowId[]) => void;
  /** Hidden rows around the displayed rows, keyed by the displayed row's id. */
  hiddenRowGaps?: IHiddenGaps<RowId>;
}

/** @internal The grid's edit path and undo history, handed to OGrid's imperative API. */
export interface IGridEditBridge<T> {
  /**
   * Commit `value` to a cell as an edit (value parser, onCellValueChanged,
   * undo, formulas). `sheetRow` is the record's formula row, or -1 when unknown.
   * Returns false when the column is unknown or the value parser rejects it.
   */
  setCellValue: (item: T, columnId: string, value: unknown, sheetRow: number) => boolean;
  /** Add a step to the grid's undo history. No-op when the host owns undo (`onUndo`). */
  recordUndoable: (action: { undo: () => void; redo: () => void }) => void;
}

// --- OGrid / useOGrid ---

/** Base props shared by both client-side and server-side OGrid modes. */
interface IOGridBaseProps<T> {
  columns: (IColumnDef<T> | IColumnGroupDef<T>)[];
  getRowId: (item: T) => RowId;

  page?: number;
  pageSize?: PageSize;
  sort?: { field: string; direction: 'asc' | 'desc' };
  filters?: IFilters;
  visibleColumns?: Set<string>;
  isLoading?: boolean;

  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: PageSize) => void;
  onSortChange?: (sort: { field: string; direction: 'asc' | 'desc' }) => void;
  onFiltersChange?: (filters: IFilters) => void;
  onVisibleColumnsChange?: (cols: Set<string>) => void;
  columnOrder?: string[];
  onColumnOrderChange?: (order: string[]) => void;
  /** Called when a column is resized by the user. */
  onColumnResized?: (columnId: string, width: number) => void;
  /** Called when a column is pinned or unpinned. */
  onColumnPinned?: (columnId: string, pinned: 'left' | 'right' | null) => void;
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

  /** Show Excel-style row numbers column at the start of the grid (1, 2, 3...). Default: false. */
  showRowNumbers?: boolean;

  /** Enable Excel-style cell references: column letter headers (A, B, C...), row number gutter, and a name box showing the active cell (e.g. "A1"). Implies showRowNumbers. */
  cellReferences?: boolean;

  statusBar?: boolean | IStatusBarProps;

  defaultPageSize?: PageSize;
  defaultSortBy?: string;
  defaultSortDirection?: 'asc' | 'desc';

  toolbar?: ReactNode;
  /** Secondary toolbar row rendered below the primary toolbar (e.g. active filter chips). */
  toolbarBelow?: ReactNode;
  emptyState?: { message?: ReactNode; render?: () => ReactNode };
  entityLabelPlural?: string;
  className?: string;
  /** Where the column chooser renders.
   *  - `true` or `'toolbar'` (default): column chooser button in the toolbar strip.
   *  - `'sidebar'`: column chooser only available via the sidebar columns panel.
   *  - `'external'`: the grid renders no chooser; the consumer renders the
   *    standalone `<ColumnChooser>` themselves (e.g. next to an "N total" line)
   *    and lifts visibility via `visibleColumns` / `onVisibleColumnsChange`.
   *  - `false`: column chooser hidden entirely. */
  columnChooser?: boolean | 'toolbar' | 'sidebar' | 'external';

  layoutMode?: 'content' | 'fill';

  /** When true, horizontal scrolling is suppressed (overflow-x hidden). */
  suppressHorizontalScroll?: boolean;

  /** When true (default), header row sticks to the top of the scroll container. */
  stickyHeader?: boolean;
  /**
   * Merged cells (Excel "Merge Cells"). Each anchor cell spans `rowSpan`
   * displayed rows and `colSpan` visible columns; covered cells are not
   * rendered. Navigation, selection, copy and editing treat the block as one
   * cell (the anchor). Merges that no longer fit the view (anchor filtered out
   * or on another page, span past the end, across pinned columns or frozen
   * rows) are clipped or dropped rather than misdrawn.
   */
  mergedCells?: IMergedCell[];
  /**
   * Keep the first N displayed rows visible below the header while the body
   * scrolls vertically (Excel "Freeze Top Rows"). Works with pinned columns
   * and virtual scrolling. Default: 0.
   */
  frozenRows?: number;
  /**
   * Excel-style Find & Replace. Ctrl+F (Cmd+F) opens Find and Ctrl+H opens
   * Replace while the grid has focus; the browser's own find is untouched
   * when it doesn't. Searches every filtered row across pages. Replace runs
   * through each column's `valueParser` and `onCellValueChanged`, skips
   * read-only cells, and Replace all is one undo step. Default: false.
   */
  findReplace?: boolean;
  /**
   * Excel-style conditional formatting rules (highlight rules, color scales,
   * data bars, icon sets). Statistics cover the full client-side data (the
   * current page for server-side grids). `formula` rules need `formulas`.
   */
  conditionalFormats?: IConditionalFormatRule<T>[];

  /**
   * Excel-style cell notes (controlled). Each note sits on (`rowId`,
   * `columnId`), shows a red corner marker and opens on hover or focus. Pair
   * with `onCellNotesChange` to make it editable.
   */
  cellNotes?: ICellNote[];
  /** Initial notes when `cellNotes` is not controlled. */
  defaultCellNotes?: ICellNote[];
  /** Called with the full notes array after a note is added, edited or deleted. */
  onCellNotesChange?: (notes: ICellNote[]) => void;
  /**
   * Let users add, edit and delete notes (context menu New/Edit/Delete note,
   * Shift+F2). Defaults to true when `onCellNotesChange` is set. Without
   * `cellNotes`, the grid keeps the notes itself (uncontrolled).
   */
  cellNotesEditable?: boolean;
  /** Author stamped on notes the user creates. */
  cellNoteAuthor?: string;

  /** When true, shows a fullscreen toggle button in the toolbar. Default: false. */
  fullScreen?: boolean;

  /** Side bar configuration. `true` shows default panels (columns + filters). Pass ISideBarDef for options. */
  sideBar?: boolean | ISideBarDef;

  /** Page size options shown in the pagination dropdown. Include the literal `'all'` to offer an "All" entry that shows every filtered row on one page. Default: [10, 25, 50, 100]. */
  pageSizeOptions?: PageSize[];

  /** Enable column reordering via drag-and-drop on header cells. Default: false. */
  columnReorder?: boolean;

  /**
   * Enable responsive column hiding. Columns with `responsivePriority` are
   * auto-hidden when the container narrows below breakpoint thresholds.
   * - `true`: use default breakpoints (576/768/992/1200px)
   * - `IResponsiveColumnsConfig`: custom breakpoints
   * - `false` / omitted: disabled
   */
  responsiveColumns?: boolean | IResponsiveColumnsConfig;

  /** Virtual scrolling configuration. When provided, only visible rows are rendered for large datasets. */
  virtualScroll?: IVirtualScrollConfig;

  /** Fixed row height in pixels. Overrides default row height (36px). */
  rowHeight?: number;

  /** Cell spacing/density preset. Controls cell padding throughout the grid. Default: 'normal'. */
  density?: 'compact' | 'normal' | 'comfortable';

  /**
   * Offload sorting to a Web Worker to avoid blocking the main thread.
   * - `true`: always use worker sort
   * - `'auto'`: use worker sort when data.length > 5000
   * - `false` (default): use synchronous sort
   * Columns with custom `compare` functions fall back to synchronous sort.
   */
  workerSort?: boolean | 'auto';

  /** Fires once when the grid first renders with data (useful for restoring column state). */
  onFirstDataRendered?: () => void;

  /** Called when server-side fetchPage fails. */
  onError?: (error: unknown) => void;

  /** Called when reading the system clipboard fails on paste (e.g. permission denied). The paste is abandoned. */
  onClipboardError?: (error: unknown) => void;

  /** Called when a cell renderer or custom editor throws an error. */
  onCellError?: (error: Error, errorInfo: React.ErrorInfo) => void;

  /** Enable Excel-like formula support. When true, cells starting with '=' are treated as formulas. Default: false. */
  formulas?: boolean;
  /** Initial formulas to load when the formula engine initializes. */
  initialFormulas?: Array<{ col: number; row: number; formula: string }>;
  /** Called when formula recalculation produces updated cell values (e.g. cascade from an edited cell). */
  onFormulaRecalc?: (result: IRecalcResult) => void;
  /** Custom formula functions to register with the formula engine (e.g. { MYFUNC: { minArgs: 1, maxArgs: 1, evaluate: ... } }). */
  formulaFunctions?: Record<string, IFormulaFunction>;
  /** Named ranges for the formula engine: name  to  cell/range ref string (e.g. { Revenue: 'A1:A10' }). */
  namedRanges?: Record<string, string>;
  /** Per-formula limits (cells read per formula, work budget). Defaults suit large grids; lower them for untrusted imported workbooks. Read when the formula engine is created. */
  formulaLimits?: IFormulaLimits;
  /** Sheet accessors for cross-sheet formula references (e.g. { Sheet2: accessor }). */
  sheets?: Record<string, IGridDataAccessor>;

  /**
   * Spreadsheet-style structure editing from the UI: the cell context menu gets
   * "Insert row above/below", "Delete row", "Insert column left/right" and
   * "Delete column", and the column header menu gets the column items.
   * Changes are reported through `onRowsChange` / `onColumnsChange` and are
   * undoable. The `insertRows`/`deleteRows`/`insertColumn`/`deleteColumn` API
   * works without this flag. Default: false.
   */
  allowStructureEdits?: boolean;
  /**
   * Called when rows are inserted or deleted. `event.data` is the complete new
   * data array: `onRowsChange={(e) => setData(e.data)}`. Required to apply row
   * changes when you pass `data` (without `data`, rows set through
   * `setRowData` update in place).
   */
  onRowsChange?: (event: IRowsChangeEvent<T>) => void;
  /**
   * Called when a column is inserted or deleted. `event.columns` is the
   * complete new `columns` value: `onColumnsChange={(e) => setColumns(e.columns)}`.
   */
  onColumnsChange?: (event: IColumnsChangeEvent<T>) => void;
  /**
   * Builds a blank row for "Insert row" and `insertRows(index)` without rows.
   * It must give the row a new unique id. `index` is where the row goes in `data`.
   */
  createRow?: (index: number) => T;

  /**
   * Let users resize individual rows by dragging the bottom edge of a row
   * number (needs `showRowNumbers` or `cellReferences`). Not available with
   * virtual scrolling or a windowed data source, which need fixed row heights.
   * Default: false.
   */
  rowResize?: boolean;
  /** Row heights in pixels by row id. When set, the grid uses these (controlled) and reports drags through `onRowResized`. */
  rowHeights?: Record<string, number>;
  /** Called when the user finishes resizing a row. */
  onRowResized?: (rowId: RowId, height: number) => void;

  /**
   * Spreadsheet-style hiding from the UI: "Hide column" / "Unhide columns" in
   * the column header menu, "Hide row(s)" / "Unhide rows" (and "Hide columns"
   * for a whole-column or multi-column selection) in the cell context menu,
   * and a double-line marker where hidden columns or rows sit (click it to
   * unhide them). Hidden columns are the columns missing from `visibleColumns`;
   * hidden rows are `hiddenRowIds`. Default: false.
   */
  allowHiding?: boolean;
  /**
   * Hidden rows by id (controlled). Hidden rows are left out of the display,
   * keyboard navigation, copy, status-bar aggregations, row counts and paging,
   * and SUBTOTAL 101-111. They are hidden whether or not `allowHiding` is on.
   * Server-side, rows are hidden within each loaded page (the source's total
   * count is shown as-is); a windowed data source can't hide rows.
   */
  hiddenRowIds?: RowId[];
  /** Initially hidden rows when `hiddenRowIds` is not controlled. */
  defaultHiddenRowIds?: RowId[];
  /** Called when the user hides or unhides rows, with the complete new list. */
  onHiddenRowIdsChange?: (rowIds: RowId[]) => void;

  /** Sheet definitions for bottom tab bar. When set, renders Excel-style sheet tabs. */
  sheetDefs?: ISheetDef[];
  /** Currently active sheet id. */
  activeSheet?: string;
  /** Called when the user switches sheets. */
  onSheetChange?: (sheetId: string) => void;
  /** Called when the user clicks the add-sheet button. */
  onSheetAdd?: () => void;
  /** Rename a sheet: double-click its tab (or F2, or "Rename" in the tab menu) to edit the name inline. */
  onSheetRename?: (sheetId: string, name: string) => void;
  /** Reorder sheets by dragging tabs (or "Move left/right" in the tab menu). Receives every sheet id in the new order. */
  onSheetReorder?: (sheetIds: string[]) => void;
  /** Delete a sheet from the tab menu (right-click a tab, or Shift+F10). Not offered for the last sheet. */
  onSheetDelete?: (sheetId: string) => void;
  /** Set or clear (`undefined`) a sheet's tab color from the tab menu. */
  onSheetColorChange?: (sheetId: string, color: string | undefined) => void;

  'aria-label'?: string;
  'aria-labelledby'?: string;
}

/** Client-side mode: pass a data array. */
export interface IOGridClientProps<T> extends IOGridBaseProps<T> {
  data: T[];
  dataSource?: never;
  dataSourceKey?: never;
}

/** Server-side mode: pass a dataSource. */
export interface IOGridServerProps<T> extends IOGridBaseProps<T> {
  data?: never;
  dataSource: IDataSource<T>;
  /**
   * Identity of the data source. When set, the grid treats the source as
   * replaced (refetches, drops cached rows and filter options) only when this
   * key changes, so `dataSource` can be an inline object rebuilt every render.
   * The grid always calls the latest object's methods. When omitted, a new
   * object whose own properties are all identical to the previous one's is the
   * same source; any other new object is treated as a swap.
   */
  dataSourceKey?: string | number;
}

/** Props for the OGrid wrapper component (shared across Fluent, Material, Radix).
 *  Must provide either `data` (client-side) or `dataSource` (server-side), not both. */
export type IOGridProps<T> = IOGridClientProps<T> | IOGridServerProps<T>;

/** Props passed from useOGrid to the framework-specific DataGridTable. */
/**
 * Sparse, index-addressed row access for a windowed (lazy) data source.
 *
 * Produced by `useOGridDataFetching` when the `dataSource` implements the
 * windowed contract (`getRowCount` + `getRows`). The virtualized render path
 * reads `getRow(index)` for each visible row and calls `requestWindow` as the
 * viewport moves; rows arrive asynchronously and the grid re-renders. In
 * windowed mode `items` is empty — the grid never holds the whole dataset.
 */
export interface WindowedDataState<T> {
  /** Total row count for the current sort/filter state (0 until first known). */
  rowCount: number;
  /** Read the row slot at an absolute index: a loaded row, or a loading/error placeholder. */
  getRow: (index: number) => WindowedRow<T>;
  /** Ensure rows in `[start, end)` are loaded or loading. Call as the visible window moves. */
  requestWindow: (start: number, end: number) => void;
  /** Retry a previously failed block covering `index`. */
  retryRow: (index: number) => void;
  /**
   * Sparse array of length `rowCount` holding each loaded row at its absolute
   * index (holes where rows are not loaded). When present, keyboard
   * navigation, copy/paste, fill, editing and row selection work over the
   * loaded rows; without it they have no rows to act on.
   */
  loadedRows?: T[];
}

export interface IOGridDataGridProps<T> {
  /** @internal Connects the table's scroll implementation to the grid API. */
  scrollToRowRef?: React.RefObject<((index: number, options?: { align?: 'start' | 'center' | 'end' }) => void) | null>;
  items: T[];
  /**
   * Windowed (lazy) row access. Set when the data source streams rows on
   * demand instead of holding them all in `items`. When present the grid
   * virtual-scrolls `windowed.rowCount` rows and reads each visible row via
   * `windowed.getRow`. Mutually exclusive with a populated `items` array.
   */
  windowed?: WindowedDataState<T> | null;
  columns: (IColumnDef<T> | IColumnGroupDef<T>)[];
  getRowId: (item: T) => RowId;
  sortBy?: string;
  sortDirection: 'asc' | 'desc';
  onColumnSort: (columnKey: string, direction?: 'asc' | 'desc' | null) => void;
  visibleColumns: Set<string>;
  /** Optional column display order (column ids). When set, visible columns are ordered by this array. */
  columnOrder?: string[];
  onColumnOrderChange?: (order: string[]) => void;
  /** Called when a column is resized by the user. */
  onColumnResized?: (columnId: string, width: number) => void;
  /** Called when user requests autosize for a single column (with measured width). */
  onAutosizeColumn?: (columnId: string, width: number) => void;
  /** Called when a column is pinned or unpinned. */
  onColumnPinned?: (columnId: string, pinned: 'left' | 'right' | null) => void;
  /** Runtime pin overrides (from restored state or programmatic changes). */
  pinnedColumns?: Record<string, 'left' | 'right'>;
  /** Initial column width overrides (from restored state). */
  initialColumnWidths?: Record<string, number>;
  layoutMode?: 'content' | 'fill';
  /** When true, horizontal scrolling is suppressed (overflow-x hidden). */
  suppressHorizontalScroll?: boolean;
  /** When true (default), header row sticks to the top of the scroll container. */
  stickyHeader?: boolean;
  /**
   * Merged cells (Excel "Merge Cells"). Each anchor cell spans `rowSpan`
   * displayed rows and `colSpan` visible columns; covered cells are not
   * rendered. Navigation, selection, copy and editing treat the block as one
   * cell (the anchor). Merges that no longer fit the view (anchor filtered out
   * or on another page, span past the end, across pinned columns or frozen
   * rows) are clipped or dropped rather than misdrawn.
   */
  mergedCells?: IMergedCell[];
  /**
   * Keep the first N displayed rows visible below the header while the body
   * scrolls vertically (Excel "Freeze Top Rows"). Works with pinned columns
   * and virtual scrolling. Default: 0.
   */
  frozenRows?: number;
  /** Enable the Find & Replace panel (Ctrl+F / Ctrl+H). */
  findReplace?: boolean;
  /**
   * @internal Every filtered, sorted row across pages, for Find & Replace on a
   * paginated grid. Omitted when `items` already holds every row.
   */
  findRows?: T[];
  /** @internal Moves the grid to a page so a Find match on it can be shown. */
  onFindPageChange?: (page: number) => void;
  /** Cell notes to show (red corner marker, popover on hover/focus). */
  cellNotes?: ICellNote[];
  /** Called with the full notes array after a note edit; required for editing. */
  onCellNotesChange?: (notes: ICellNote[]) => void;
  /** Show New/Edit/Delete note in the context menu and open the note editor on Shift+F2. */
  cellNotesEditable?: boolean;
  /** Author stamped on notes the user creates. */
  cellNoteAuthor?: string;
  /**
   * Conditional format of a cell (see useConditionalFormatting). OGrid builds
   * it from `conditionalFormats`; a new function repaints every row.
   */
  conditionalFormat?: (item: T, columnId: string) => ICellConditionalFormat | undefined;
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
  /** Show Excel-style row numbers column. */
  showRowNumbers?: boolean;
  /** Show Excel-style column letter headers (A, B, C...) above the header row. */
  showColumnLetters?: boolean;
  /** Show a name box displaying the active cell reference (e.g. "A1"). */
  showNameBox?: boolean;
  /** Callback when the active cell changes. Used by the name box to display the current cell reference. */
  onActiveCellChange?: (ref: string | null) => void;
  /** Current page number (1-based) for row number calculation. */
  currentPage?: number;
  /** Page size for row number calculation. */
  pageSize?: PageSize;
  /** Total rows across all pages (after filtering). Drives `aria-rowcount`; unknown when omitted. */
  totalCount?: number;
  statusBar?: IStatusBarProps;
  /** Unified filter model (discriminated union values). */
  filters: IFilters;
  /** Single callback for all filter changes. Pass undefined to clear. */
  onFilterChange: (key: string, value: FilterValue | undefined) => void;
  filterOptions: Record<string, FilterOption[]>;
  loadingFilterOptions: Record<string, boolean>;
  peopleSearch?: (query: string) => Promise<UserLike[]>;
  getUserByEmail?: (email: string) => Promise<UserLike | undefined>;
  emptyState?: {
    onClearAll: () => void;
    hasActiveFilters: boolean;
    message?: ReactNode;
    render?: () => ReactNode;
  };
  /** Enable column reordering via drag-and-drop on header cells. Default: false. */
  columnReorder?: boolean;
  /** Responsive column hiding config (passed from IOGridBaseProps). */
  responsiveColumns?: boolean | IResponsiveColumnsConfig;
  /** Virtual scrolling configuration. When provided, only visible rows are rendered for large datasets. */
  virtualScroll?: IVirtualScrollConfig;
  /** Fixed row height in pixels. Overrides default row height (36px). */
  rowHeight?: number;
  /** Let users resize rows by dragging the bottom edge of a row number (row numbers shown, no virtual scrolling). */
  rowResize?: boolean;
  /** Controlled row heights (px) by row id. */
  rowHeights?: Record<string, number>;
  /** Called when the user finishes resizing a row. */
  onRowResized?: (rowId: RowId, height: number) => void;
  /** Structure-edit actions for the context and column header menus. Omit to hide those menu items. */
  structureActions?: IGridStructureActions<T>;
  /** Hide/unhide actions for the menus and hidden-gap markers. Omit to hide those menu items and markers. */
  hidingActions?: IGridHidingActions;
  /** @internal Filled by the grid with its edit path and undo history (OGrid's cell API uses it). */
  gridEditBridgeRef?: React.MutableRefObject<IGridEditBridge<T> | null>;
  /** Cell spacing/density preset. Controls cell padding throughout the grid. Default: 'normal'. */
  density?: 'compact' | 'normal' | 'comfortable';
  /** Called when a cell renderer or custom editor throws an error. */
  onCellError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Called when reading the system clipboard fails on paste. The paste is abandoned. */
  onClipboardError?: (error: unknown) => void;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  /** Custom keydown handler. Called before grid's built-in handling. Call event.preventDefault() to suppress grid default. */
  onKeyDown?: (event: React.KeyboardEvent) => void;

  /** Enable formula support. When true, cell values starting with '=' are treated as formulas. */
  formulas?: boolean;
  /** Get the formula engine's computed value for a cell, or undefined if no formula. */
  getFormulaValue?: (col: number, row: number) => unknown;
  /** Check if a cell has a formula. */
  hasFormula?: (col: number, row: number) => boolean;
  /** Get the formula string for a cell. */
  getFormula?: (col: number, row: number) => string | undefined;
  /** Set a formula for a cell (called from edit commit when value starts with '='). */
  setFormula?: (col: number, row: number, formula: string | null) => void;
  /** Notify the formula engine that a non-formula cell changed. */
  onFormulaCellChanged?: (col: number, row: number) => void;
  /** Get all cells that a cell depends on (deep, transitive). */
  getPrecedents?: (col: number, row: number) => IAuditEntry[];
  /** Get all cells that depend on a cell (deep, transitive). */
  getDependents?: (col: number, row: number) => IAuditEntry[];
  /** Get full audit trail for a cell. */
  getAuditTrail?: (col: number, row: number) => IAuditTrail | null;
  /** Monotonic counter incremented on each formula recalculation  -  used for cache invalidation. */
  formulaVersion?: number;
  /** Cell references to highlight (from active formula in formula bar). */
  formulaReferences?: import('@alaarab/ogrid-core').FormulaReference[];
  /**
   * Called when a cell is clicked during formula editing to insert a cell reference.
   * Accepts a cell reference string (e.g. "A1") and returns true if the reference was inserted.
   */
  onFormulaInsertReference?: (reference: string) => boolean;
  /**
   * Maps displayed rows to formula (sheet) rows and back. The formula callbacks
   * above, A1 references, row numbers and the name box use sheet rows; columns
   * are always indexes into the flat column defs. OGrid passes a map so formulas
   * follow their record through sort, filter and paging. Without one, sheet rows
   * are positions in `items`.
   */
  formulaRowMap?: IFormulaRowMap;
  /**
   * Filled by the grid with a writer for sheet cells that goes through the
   * grid's own edit path (value parsing, undo history, formula engine). OGrid's
   * formula bar commits through it.
   */
  formulaCellWriterRef?: React.MutableRefObject<IFormulaCellWriter | null>;
  /**
   * Filled by the grid with a navigator that selects sheet ranges. OGrid's
   * name box jumps through it.
   */
  cellNavigatorRef?: React.MutableRefObject<IGridCellNavigator | null>;
}

/** Selects a range given in sheet coordinates (the name box's jump). */
export interface IGridCellNavigator {
  /**
   * Select the displayed part of `range` (flat columns, sheet rows) and make
   * its top-left cell active. Returns false when none of it is displayed
   * (hidden columns, rows filtered out or on another page).
   */
  selectRange: (range: ISheetReferenceRange) => boolean;
  /** Move keyboard focus to the grid's active cell (the grid itself while that cell isn't rendered). */
  focusActiveCell: () => void;
}

/** Writes text into a sheet cell (flat column index, sheet row) as if typed into the cell. */
export interface IFormulaCellWriter {
  /** Whether the cell exists in the current view and can be edited. */
  canEdit: (col: number, row: number) => boolean;
  /** Commit `text` (a formula when it starts with '='). Returns false when the cell can't be edited. */
  write: (col: number, row: number, text: string) => boolean;
  /** Move keyboard focus to the grid's active cell (the grid itself while that cell isn't rendered). */
  focusActiveCell?: () => void;
}
