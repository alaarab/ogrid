import type { ReactNode } from 'react';
import type { IColumnDef, IColumnGroupDef, ICellValueChangedEvent } from './columnTypes';
import type { IFormulaFunction, IRecalcResult, IGridDataAccessor, IAuditEntry, IAuditTrail, IResponsiveColumnsConfig } from '@alaarab/ogrid-core';

// Re-export all shared types and functions from core (no React-specific changes)
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
  ISheetDef,
  IVirtualScrollConfig,
  IColumnReorderConfig,
  IOGridApi,
} from '@alaarab/ogrid-core';

export { toUserLike, isInSelectionRange, normalizeSelectionRange } from '@alaarab/ogrid-core';

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
} from '@alaarab/ogrid-core';

// --- OGrid / useOGrid ---

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

  defaultPageSize?: number;
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
   *  - `false`: column chooser hidden entirely. */
  columnChooser?: boolean | 'toolbar' | 'sidebar';

  layoutMode?: 'content' | 'fill';

  /** When true, horizontal scrolling is suppressed (overflow-x hidden). */
  suppressHorizontalScroll?: boolean;

  /** When true (default), header row sticks to the top of the scroll container. */
  stickyHeader?: boolean;

  /** When true, shows a fullscreen toggle button in the toolbar. Default: false. */
  fullScreen?: boolean;

  /** Side bar configuration. `true` shows default panels (columns + filters). Pass ISideBarDef for options. */
  sideBar?: boolean | ISideBarDef;

  /** Page size options shown in the pagination dropdown. Default: [10, 20, 50, 100]. */
  pageSizeOptions?: number[];

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
  /** Named ranges for the formula engine: name → cell/range ref string (e.g. { Revenue: 'A1:A10' }). */
  namedRanges?: Record<string, string>;
  /** Sheet accessors for cross-sheet formula references (e.g. { Sheet2: accessor }). */
  sheets?: Record<string, IGridDataAccessor>;

  /** Sheet definitions for bottom tab bar. When set, renders Excel-style sheet tabs. */
  sheetDefs?: ISheetDef[];
  /** Currently active sheet id. */
  activeSheet?: string;
  /** Called when the user switches sheets. */
  onSheetChange?: (sheetId: string) => void;
  /** Called when the user clicks the add-sheet button. */
  onSheetAdd?: () => void;

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

/** Props for the OGrid wrapper component (shared across Fluent, Material, Radix).
 *  Must provide either `data` (client-side) or `dataSource` (server-side), not both. */
export type IOGridProps<T> = IOGridClientProps<T> | IOGridServerProps<T>;

/** Props passed from useOGrid to the framework-specific DataGridTable. */
export interface IOGridDataGridProps<T> {
  items: T[];
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
  pageSize?: number;
  statusBar?: IStatusBarProps;
  /** Unified filter model (discriminated union values). */
  filters: IFilters;
  /** Single callback for all filter changes. Pass undefined to clear. */
  onFilterChange: (key: string, value: FilterValue | undefined) => void;
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
  /** Enable column reordering via drag-and-drop on header cells. Default: false. */
  columnReorder?: boolean;
  /** Responsive column hiding config (passed from IOGridBaseProps). */
  responsiveColumns?: boolean | IResponsiveColumnsConfig;
  /** Virtual scrolling configuration. When provided, only visible rows are rendered for large datasets. */
  virtualScroll?: IVirtualScrollConfig;
  /** Fixed row height in pixels. Overrides default row height (36px). */
  rowHeight?: number;
  /** Cell spacing/density preset. Controls cell padding throughout the grid. Default: 'normal'. */
  density?: 'compact' | 'normal' | 'comfortable';
  /** Called when a cell renderer or custom editor throws an error. */
  onCellError?: (error: Error, errorInfo: React.ErrorInfo) => void;
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
  /** Monotonic counter incremented on each formula recalculation — used for cache invalidation. */
  formulaVersion?: number;
  /** Cell references to highlight (from active formula in formula bar). */
  formulaReferences?: import('@alaarab/ogrid-core').FormulaReference[];
}
