import type { IColumnDef, IColumnGroupDef, ICellValueChangedEvent } from './columnTypes';
import type {
  RowId,
  IFilters,
  IDataSource,
  RowSelectionMode,
  IRowSelectionChangeEvent,
  IOGridApi,
  ISideBarDef,
  IStatusBarProps,
  IVirtualScrollConfig,
  IFormulaFunction,
  IRecalcResult,
  IGridDataAccessor,
  IResponsiveColumnsConfig,
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
  IFormulaFunction,
  IRecalcResult,
  IGridDataAccessor,
  IAuditEntry,
  IAuditTrail,
  IResponsiveColumnsConfig,
} from '@alaarab/ogrid-core';

/** Standardized cell event parameter for cell interaction callbacks. */
export interface CellEvent {
  /** Zero-based row index within the current page. */
  rowIndex: number;
  /** Zero-based column index among visible columns. */
  colIndex: number;
  /** The original DOM event (MouseEvent for click/dblclick/contextmenu, PointerEvent for pointerdown). */
  event?: MouseEvent | PointerEvent;
  /** Typed row identifier (string or number). Present for double-click events. */
  rowId?: RowId;
  /** Column identifier string. Present for double-click events. */
  columnId?: string;
}

/** Extended API for the vanilla JS package (adds methods not in the core IOGridApi). */
export interface IJsOGridApi<T> extends IOGridApi<T> {
  /** Export displayed rows to CSV and trigger a download. */
  exportToCsv: (filename?: string, options?: { exportMode?: 'values' | 'formulas' }) => void;
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

  /** Show row numbers column. Default: false. */
  showRowNumbers?: boolean;

  /** Enable Excel-style cell references: column letter headers, row numbers, and name box. Implies showRowNumbers. */
  cellReferences?: boolean;

  /** Status bar configuration or boolean to enable/disable with defaults. */
  statusBar?: boolean | IStatusBarProps;

  /** Plural label for the entity type (e.g. 'items'). Used in status bar and empty state. */
  entityLabelPlural?: string;

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
  /** When true (default), header row sticks to the top of the scroll container. */
  stickyHeader?: boolean;
  /** When true, shows a fullscreen toggle button in the toolbar. Default: false. */
  fullScreen?: boolean;

  /** Custom empty state message. */
  emptyMessage?: string;

  /** Accessible label for the grid. */
  'aria-label'?: string;

  /** Accessible label reference for the grid (ID of a labelling element). */
  'aria-labelledby'?: string;

  /** Side bar configuration (columns panel + filters panel). */
  sideBar?: boolean | ISideBarDef;

  /** Error callback for server-side data source failures. */
  onError?: (error: unknown) => void;

  /** Called when a cell editor throws an error. JS alternative: listen to the 'cellError' event. */
  onCellError?: (error: Error, info: unknown) => void;

  /** Called when undo is triggered. JS alternative: listen to the 'undo' event. */
  onUndo?: () => void;

  /** Called when redo is triggered. JS alternative: listen to the 'redo' event. */
  onRedo?: () => void;

  /** Whether there are undo operations available. */
  canUndo?: boolean;

  /** Whether there are redo operations available. */
  canRedo?: boolean;

  /** Called when the current page changes. JS alternative: listen to the 'pageChange' event. */
  onPageChange?: (page: number) => void;

  /** Called when the page size changes. JS alternative: listen to the 'pageSizeChange' event. */
  onPageSizeChange?: (size: number) => void;

  /** Callback fired when first data is rendered. */
  onFirstDataRendered?: () => void;

  /** Virtual scrolling configuration. */
  virtualScroll?: IVirtualScrollConfig;

  /**
   * Enable responsive column hiding based on container width.
   * Columns with `responsivePriority` are hidden/shown as the container resizes.
   * - `true`: use default breakpoints
   * - `IResponsiveColumnsConfig`: custom breakpoints
   * - `false` or omitted: disabled
   */
  responsiveColumns?: boolean | IResponsiveColumnsConfig;

  /**
   * Offload sorting to a Web Worker to avoid blocking the main thread.
   * - `true`: always use worker sort
   * - `'auto'`: use worker sort when data.length > 5000
   * - `false` (default): use synchronous sort
   */
  workerSort?: boolean | 'auto';

  /** Fixed row height in pixels. Overrides default row height (36px). */
  rowHeight?: number;

  /** Cell spacing/density preset. Controls cell padding throughout the grid. Default: 'normal'. */
  density?: 'compact' | 'normal' | 'comfortable';

  /** Enable column reordering via drag-and-drop on header cells. Default: false. */
  columnReorder?: boolean;

  /** Page size options shown in the pagination dropdown. Default: [10, 20, 50, 100]. */
  pageSizeOptions?: number[];

  /** Initial column display order (array of column ids). */
  columnOrder?: string[];

  /** Accessible label for the grid wrapper element. */
  ariaLabel?: string;

  /** Callback fired when column order changes. */
  onColumnOrderChange?: (order: string[]) => void;

  /** Callback fired when a column is resized. */
  onColumnResized?: (columnId: string, width: number) => void;

  /** Callback fired when a column is pinned or unpinned. */
  onColumnPinned?: (columnId: string, pin: 'left' | 'right' | null) => void;

  /** Where the column chooser renders. `true` or `'toolbar'` (default): toolbar. `'sidebar'`: sidebar only. `false`: hidden. */
  columnChooser?: boolean | 'toolbar' | 'sidebar';

  /** Secondary toolbar row rendered below the primary toolbar. */
  toolbarBelow?: HTMLElement | null;

  /** Custom keydown handler. Called before grid's built-in handling. Call event.preventDefault() to suppress grid default. */
  onKeyDown?: (event: KeyboardEvent) => void;

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
}

/** Events emitted by the OGrid instance. */
export interface OGridEvents<T> extends Record<string, unknown> {
  cellValueChanged: ICellValueChangedEvent<T>;
  selectionChange: IRowSelectionChangeEvent<T>;
  sortChange: { field: string; direction: 'asc' | 'desc' };
  filterChange: { filters: IFilters };
  pageChange: { page: number };
}
