// Explicit named re-exports from core (replaces export * for better tree-shaking).

// Core types
export type {
  ColumnFilterType,
  IDateFilterValue,
  IColumnFilterDef,
  IColumnMeta,
  IValueParserParams,
  IColumnDef as ICoreColumnDef,
  ICellValueChangedEvent,
  ICellEditorProps,
  CellEditorParams,
  IColumnGroupDef as ICoreColumnGroupDef,
  HeaderCell,
  HeaderRow,
  IColumnDefinition,
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
  HeaderFilterConfigInput,
  HeaderFilterConfig,
  CellRenderDescriptorInput,
  CellRenderDescriptor,
  CellRenderMode,
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
  toUserLike,
  isInSelectionRange,
  normalizeSelectionRange,
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
  getHeaderFilterConfig,
  getCellRenderDescriptor,
  CellDescriptorCache,
  resolveCellDisplayContent,
  resolveCellStyle,
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

// Shadow core column types with vanilla JS extensions
export type { IColumnDef, IColumnGroupDef, ICellEditorContext } from './types/columnTypes';
export type { OGridOptions, OGridEvents, IJsOGridApi, CellEvent } from './types/gridTypes';

// Utils
export { debounce } from './utils';

// Classes
export { OGrid } from './OGrid';
export { OGridEventWiring } from './OGridEventWiring';
export type { InteractionResult, EventWiringCallbacks } from './OGridEventWiring';
export { OGridRendering } from './OGridRendering';
export type { OGridRenderingContext } from './OGridRendering';
export { GridState } from './state/GridState';
export { EventEmitter } from './state/EventEmitter';
export { SelectionState } from './state/SelectionState';
export { KeyboardNavState } from './state/KeyboardNavState';
export { ClipboardState } from './state/ClipboardState';
export { UndoRedoState } from './state/UndoRedoState';
export { ColumnResizeState } from './state/ColumnResizeState';
export { TableLayoutState } from './state/TableLayoutState';
export { TableRenderer } from './renderer/TableRenderer';
export type { TableRendererInteractionState } from './renderer/TableRenderer';
export { PaginationControls } from './components/PaginationControls';
export { StatusBar } from './components/StatusBar';
export { ColumnChooser } from './components/ColumnChooser';
export { InlineCellEditor } from './components/InlineCellEditor';
export { ContextMenu } from './components/ContextMenu';
export { FillHandleState } from './state/FillHandleState';
export { RowSelectionState } from './state/RowSelectionState';
export { ColumnPinningState } from './state/ColumnPinningState';
export { ColumnReorderState } from './state/ColumnReorderState';
export { VirtualScrollState } from './state/VirtualScrollState';
export { MarchingAntsOverlay } from './components/MarchingAntsOverlay';
export { SideBarState } from './state/SideBarState';
export { HeaderFilterState } from './state/HeaderFilterState';
export { FormulaEngineState } from './state/FormulaEngineState';
export type { FormulaEngineStateOptions } from './state/FormulaEngineState';
export { SideBar } from './components/SideBar';
export { HeaderFilter } from './components/HeaderFilter';
export { FormulaBar } from './components/FormulaBar';
export type { FormulaBarCallbacks } from './components/FormulaBar';
