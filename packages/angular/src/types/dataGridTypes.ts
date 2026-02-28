import type { TemplateRef } from '@angular/core';
import type { IColumnDef, IColumnGroupDef, ICellValueChangedEvent } from './columnTypes';
import type { IResponsiveColumnsConfig } from '@alaarab/ogrid-core';

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
  IVirtualScrollConfig,
  IOGridApi,
  IFormulaFunction,
  IRecalcResult,
  IGridDataAccessor,
  IAuditEntry,
  IAuditTrail,
  ISheetDef,
  FormulaReference,
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
  IVirtualScrollConfig,
  IFormulaFunction,
  IRecalcResult,
  IGridDataAccessor,
  IAuditEntry,
  IAuditTrail,
  ISheetDef,
  FormulaReference,
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
  /** Called when user requests autosize for a single column (with measured width). */
  onAutosizeColumn?: (columnId: string, width: number) => void;
  onColumnPinned?: (columnId: string, pinned: 'left' | 'right' | null) => void;
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
  /** When true (default), header row sticks to the top of the scroll container. */
  stickyHeader?: boolean;
  /** When true, shows a fullscreen toggle button in the toolbar. Default: false. */
  fullScreen?: boolean;
  sideBar?: boolean | ISideBarDef;
  columnReorder?: boolean;
  /** Enable responsive column hiding based on container width. Columns with `responsivePriority` are auto-hidden on narrow containers. */
  responsiveColumns?: boolean | IResponsiveColumnsConfig;
  virtualScroll?: IVirtualScrollConfig;
  /** Offload sort/filter to a Web Worker for large datasets. Falls back to sync when sort column has a custom compare. */
  workerSort?: boolean;
  /** Fixed row height in pixels. Overrides default row height (36px). */
  rowHeight?: number;
  pageSizeOptions?: number[];
  onFirstDataRendered?: () => void;
  onError?: (error: unknown) => void;
  onCellError?: (error: Error, info: unknown) => void;

  showRowNumbers?: boolean;

  /** Enable Excel-style cell references: column letter headers, row numbers, and name box. Implies showRowNumbers. */
  cellReferences?: boolean;

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

  /** Sheet definitions for the tab bar at grid bottom. */
  sheetDefs?: ISheetDef[];
  /** Active sheet ID (controlled). */
  activeSheet?: string;
  /** Called when user clicks a sheet tab. */
  onSheetChange?: (sheetId: string) => void;
  /** Called when user clicks the "+" add sheet button. */
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
  onColumnSort: (columnKey: string, direction?: 'asc' | 'desc' | null) => void;
  visibleColumns: Set<string>;
  columnOrder?: string[];
  onColumnOrderChange?: (order: string[]) => void;
  onColumnResized?: (columnId: string, width: number) => void;
  /** Called when user requests autosize for a single column (with measured width). */
  onAutosizeColumn?: (columnId: string, width: number) => void;
  onColumnPinned?: (columnId: string, pinned: 'left' | 'right' | null) => void;
  pinnedColumns?: Record<string, 'left' | 'right'>;
  initialColumnWidths?: Record<string, number>;
  layoutMode?: 'content' | 'fill';
  suppressHorizontalScroll?: boolean;
  /** When true (default), header row sticks to the top of the scroll container. */
  stickyHeader?: boolean;
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
  showColumnLetters?: boolean;
  showNameBox?: boolean;
  onActiveCellChange?: (ref: string | null) => void;
  currentPage?: number;
  pageSize?: number;
  statusBar?: IStatusBarProps;
  filters: IFilters;
  onFilterChange: (key: string, value: FilterValue | undefined) => void;
  filterOptions: Record<string, string[]>;
  loadingFilterOptions: Record<string, boolean>;
  peopleSearch?: (query: string) => Promise<UserLike[]>;
  getUserByEmail?: (email: string) => Promise<UserLike | undefined>;
  columnReorder?: boolean;
  /** Responsive column hiding config. */
  responsiveColumns?: boolean | IResponsiveColumnsConfig;
  virtualScroll?: IVirtualScrollConfig;
  /** Fixed row height in pixels. Overrides default row height (36px). */
  rowHeight?: number;
  emptyState?: {
    onClearAll: () => void;
    hasActiveFilters: boolean;
    message?: string;
    render?: unknown;
  };
  onCellError?: (error: Error, info: unknown) => void;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  /** Custom keydown handler. Called before grid's built-in handling. Call event.preventDefault() to suppress grid default. */
  onKeyDown?: (event: KeyboardEvent) => void;

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
  formulaReferences?: FormulaReference[];
}
