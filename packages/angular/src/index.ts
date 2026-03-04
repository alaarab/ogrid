// Explicit named re-exports from core (replaces export * for better tree-shaking).

// Row grouping
export { isGroupHeader, buildGroupedRows } from '@alaarab/ogrid-core';
export type { IRowGroup, IRowGroupingConfig, RowGroupingDisplayRow } from '@alaarab/ogrid-core';

// Core types not already re-exported from ./types
export type {
  ISheetDef,
  IVirtualScrollConfig,
  IColumnReorderConfig,
  CsvColumn,
  FormulaExportOptions,
  StatusBarPart,
  StatusBarPartsInput,
  PaginationViewModel,
  GridContextMenuItem,
  IColumnHeaderMenuItem,
  GridContextMenuHandlerProps,
  ColumnHeaderMenuInput,
  ColumnHeaderMenuHandlers,
  ParseValueResult,
  AggregationResult,
  GridRowComparatorProps,
  ColumnPinState,
  IDropTarget,
  ICalculateDropTargetParams,
  IVisibleRange,
  IVisibleColumnRange,
  SortFilterRequest,
  SortFilterResponse,
  OverlayRect,
  ISortState,
  ArrowNavigationContext,
  ArrowNavigationResult,
  IFillFormulaOptions,
  FormulaReference,
  IResponsiveColumnsConfig,
  ZIndexKey,
  ICellAddress,
  ICellRange,
  CellKey,
  FormulaErrorType,
  TokenType,
  Token,
  ASTNode,
  BinaryOp,
  IFormulaContext,
  IFormulaFunction,
  IEvaluator,
  IRecalcResult,
  IFormulaEngineConfig,
  IGridDataAccessor,
  INamedRange,
  IAuditEntry,
  IAuditTrail,
} from '@alaarab/ogrid-core';

// Core utilities
export {
  escapeCsvValue,
  buildCsvHeader,
  buildCsvRows,
  exportToCsv,
  triggerCsvDownload,
  getCellValue,
  isColumnEditable,
  createGridDataAccessor,
  flattenColumns,
  buildHeaderRows,
  isFilterConfig,
  getFilterField,
  mergeFilter,
  deriveFilterOptionsFromData,
  getMultiSelectFilterFields,
  getStatusBarParts,
  getDataGridStatusBarConfig,
  getPaginationViewModel,
  PAGE_SIZE_OPTIONS,
  MAX_PAGE_BUTTONS,
  GRID_CONTEXT_MENU_ITEMS,
  COLUMN_HEADER_MENU_ITEMS,
  getContextMenuHandlers,
  getColumnHeaderMenuItems,
  formatShortcut,
  parseValue,
  numberParser,
  currencyParser,
  dateParser,
  emailParser,
  booleanParser,
  computeAggregations,
  processClientSideData,
  areGridRowPropsEqual,
  isRowInRange,
  getPinStateForColumn,
  reorderColumnArray,
  calculateDropTarget,
  computeVisibleRange,
  computeTotalHeight,
  getScrollTopForRow,
  computeVisibleColumnRange,
  partitionColumnsForVirtualization,
  createSortFilterWorker,
  terminateSortFilterWorker,
  extractValueMatrix,
  processClientSideDataAsync,
  CellDescriptorCache,
  buildInlineEditorProps,
  buildPopoverEditorProps,
  measureRange,
  buildCellIndex,
  injectGlobalStyles,
  computeNextSortState,
  measureColumnContentWidth,
  AUTOSIZE_EXTRA_PX,
  AUTOSIZE_MAX_PX,
  findCtrlArrowTarget,
  computeTabNavigation,
  computeArrowNavigation,
  applyCellDeletion,
  rangesEqual,
  clampSelectionToBounds,
  computeAutoScrollSpeed,
  applyRangeRowSelection,
  computeRowSelectionState,
  formatCellValueForTsv,
  formatSelectionAsTsv,
  parseTsvClipboard,
  applyPastedValues,
  applyCutClear,
  applyFillValues,
  UndoRedoStack,
  validateColumns,
  validateRowIds,
  validateVirtualScrollConfig,
  indexToColumnLetter,
  columnLetterToIndex,
  formatCellReference,
  getResponsiveHiddenColumns,
  RESPONSIVE_BREAKPOINTS,
  resolveResponsiveConfig,
  applyResponsiveHiding,
} from '@alaarab/ogrid-core';

// Core constants
export {
  CHECKBOX_COLUMN_WIDTH,
  ROW_NUMBER_COLUMN_WIDTH,
  ROW_NUMBER_COLUMN_ID,
  ROW_NUMBER_COLUMN_MIN_WIDTH,
  DEFAULT_MIN_COLUMN_WIDTH,
  CELL_PADDING,
  GRID_BORDER_RADIUS,
  DEFAULT_DEBOUNCE_MS,
  PEOPLE_SEARCH_DEBOUNCE_MS,
  SIDEBAR_TRANSITION_MS,
  Z_INDEX,
} from '@alaarab/ogrid-core';

// Formula system (from @alaarab/ogrid-core/formula subpath)
export {
  FormulaError,
  FormulaEngine,
  FormulaEvaluator,
  DependencyGraph,
  tokenize,
  parse,
  createBuiltInFunctions,
  parseCellRef,
  parseRange,
  formatAddress,
  toCellKey,
  fromCellKey,
  adjustFormulaReferences,
  toNumber,
  formulaToString,
  toBoolean,
  flattenArgs,
  isFormulaError,
  REF_ERROR,
  DIV_ZERO_ERROR,
  VALUE_ERROR,
  NAME_ERROR,
  CIRC_ERROR,
  GENERAL_ERROR,
  NA_ERROR,
  extractFormulaReferences,
  processFormulaBarCommit,
  deriveFormulaBarText,
  handleFormulaBarKeyDown,
  canInsertReference,
  insertReferenceAtCursor,
  FORMULA_REF_COLORS,
  FORMULA_BAR_CSS,
  FORMULA_BAR_STYLES,
} from '@alaarab/ogrid-core/formula';

// Angular-specific types
export type {
  IColumnDef,
  IColumnGroupDef,
  IColumnDefinition,
  ICellEditorProps,
} from './types';

export type {
  IOGridProps,
  IOGridClientProps,
  IOGridServerProps,
  IOGridDataGridProps,
} from './types';

// Re-export all shared types from types/index (those that are just re-exports from core)
export type {
  ColumnFilterType,
  IColumnFilterDef,
  IColumnMeta,
  ICellValueChangedEvent,
  CellEditorParams,
  IValueParserParams,
  IDateFilterValue,
  HeaderCell,
  HeaderRow,
  RowId,
  UserLike,
  UserLikeInput,
  FilterValue,
  IFilters,
  IFetchParams,
  IPageResult,
  IDataSource,
  IGridColumnState,
  IOGridApi,
  RowSelectionMode,
  IRowSelectionChangeEvent,
  StatusBarPanel,
  IStatusBarProps,
  IActiveCell,
  ISelectionRange,
  SideBarPanelId,
  ISideBarDef,
} from './types';

export { toUserLike, isInSelectionRange, normalizeSelectionRange } from './types';

// Services
export { OGridService } from './services/ogrid.service';
export type {
  ColumnChooserPlacement,
  OGridPagination,
  OGridColumnChooser,
  OGridFilters,
  OGridSideBarState,
  OGridFormulaBarState,
} from './services/ogrid.service';

export { DataGridStateService } from './services/datagrid-state.service';
export type {
  DataGridLayoutState,
  DataGridRowSelectionState,
  DataGridEditingState,
  DataGridCellInteractionState,
  DataGridContextMenuState,
  DataGridViewModelState,
  DataGridPinningState,
  DataGridStateResult,
} from './services/datagrid-state.service';

export { DataGridLayoutHelper } from './services/datagrid-layout.service';
export { DataGridEditingHelper } from './services/datagrid-editing.service';
export { DataGridInteractionHelper } from './services/datagrid-interaction.service';

export { ColumnReorderService } from './services/column-reorder.service';

export { VirtualScrollService } from './services/virtual-scroll.service';

export { FormulaEngineService } from './services/formula-engine.service';
export type { FormulaEngineConfig } from './services/formula-engine.service';

// Components
export { OGridLayoutComponent } from './components/ogrid-layout.component';
export { StatusBarComponent } from './components/status-bar.component';
export { GridContextMenuComponent } from './components/grid-context-menu.component';
export { SideBarComponent } from './components/sidebar.component';
export type { SideBarProps, SideBarFilterColumn } from './components/sidebar.component';
export { MarchingAntsOverlayComponent } from './components/marching-ants-overlay.component';
export { FormulaBarComponent } from './components/formula-bar.component';
export { SheetTabsComponent } from './components/sheet-tabs.component';
export { FormulaRefOverlayComponent } from './components/formula-ref-overlay.component';
export { EmptyStateComponent } from './components/empty-state.component';
export { BaseOGridComponent } from './components/base-ogrid.component';
export { BaseDataGridTableComponent } from './components/base-datagrid-table.component';
export { BaseColumnHeaderFilterComponent } from './components/base-column-header-filter.component';
export type { IColumnHeaderFilterProps } from './components/base-column-header-filter.component';
export { BaseColumnChooserComponent } from './components/base-column-chooser.component';
export type { IColumnChooserProps } from './components/base-column-chooser.component';
export { BasePaginationControlsComponent } from './components/base-pagination-controls.component';
export { BaseInlineCellEditorComponent } from './components/base-inline-cell-editor.component';
export { BaseColumnHeaderMenuComponent } from './components/base-column-header-menu.component';
export { INLINE_CELL_EDITOR_TEMPLATE, INLINE_CELL_EDITOR_STYLES } from './components/inline-cell-editor-template';
export { BasePopoverCellEditorComponent, POPOVER_CELL_EDITOR_TEMPLATE, POPOVER_CELL_EDITOR_OVERLAY_STYLES } from './components/base-popover-cell-editor.component';

// Shared styles
export { OGRID_THEME_VARS_CSS } from './styles/ogrid-theme-vars';

// Utilities (view model helpers)
export type {
  HeaderFilterConfigInput,
  HeaderFilterConfig,
  CellRenderDescriptorInput,
  CellRenderDescriptor,
  CellRenderMode,
} from './utils';

export {
  getHeaderFilterConfig,
  getCellRenderDescriptor,
  resolveCellDisplayContent,
  resolveCellStyle,
  createDebouncedSignal,
  createDebouncedCallback,
  debounce,
  createLatestCallback,
} from './utils';
