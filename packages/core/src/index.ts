// Types  -  columnTypes
export type {
  ColumnFilterType,
  IDateFilterValue,
  IColumnFilterDef,
  DateFormat,
  IColumnMeta,
  IValueParserParams,
  IColumnDef,
  ICellValueChangedEvent,
  ICellEditorProps,
  CellEditorParams,
  IColumnGroupDef,
  HeaderCell,
  HeaderRow,
  IColumnDefinition,
} from './types';

// Types  -  dataGridTypes
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
  SideBarPanelId,
  ISideBarDef,
  ISheetDef,
  IVirtualScrollConfig,
  IColumnReorderConfig,
  IOGridApi,
} from './types';
export {
  toUserLike,
  isInSelectionRange,
  normalizeSelectionRange,
  isWindowedDataSource,
} from './types';

// Utils  -  exportToCsv
export {
  escapeCsvValue,
  buildCsvHeader,
  buildCsvRows,
  exportToCsv,
  triggerCsvDownload,
  triggerBlobDownload,
} from './utils';
export type { CsvColumn, FormulaExportOptions } from './utils';

// Utils  -  cellValue, columnUtils
export { getCellValue, isColumnEditable, createGridDataAccessor } from './utils';
export { flattenColumns, buildHeaderRows } from './utils';

// Utils  -  ogridHelpers
export {
  isFilterConfig,
  getFilterField,
  mergeFilter,
  deriveFilterOptionsFromData,
  getMultiSelectFilterFields,
} from './utils';

// Utils  -  statusBarHelpers, dataGridStatusBar
export { getStatusBarParts } from './utils';
export { getDataGridStatusBarConfig } from './utils';
export type { StatusBarPart, StatusBarPartsInput } from './utils';

// Utils  -  paginationHelpers
export {
  getPaginationViewModel,
  PAGE_SIZE_OPTIONS,
  MAX_PAGE_BUTTONS,
} from './utils';
export type { PaginationViewModel } from './utils';

// Utils  -  gridContextMenuHelpers
export {
  GRID_CONTEXT_MENU_ITEMS,
  COLUMN_HEADER_MENU_ITEMS,
  getContextMenuHandlers,
  getColumnHeaderMenuItems,
  formatShortcut,
} from './utils';
export type {
  GridContextMenuItem,
  IColumnHeaderMenuItem,
  GridContextMenuHandlerProps,
  ColumnHeaderMenuInput,
  ColumnHeaderMenuHandlers,
} from './utils';

// Utils  -  valueParsers
export {
  parseValue,
  numberParser,
  currencyParser,
  dateParser,
  emailParser,
  booleanParser,
} from './utils';
export type { ParseValueResult } from './utils';

// Utils  -  aggregationUtils
export { computeAggregations } from './utils';
export type { AggregationResult } from './utils';

// Utils  -  clientSideData
export { processClientSideData } from './utils';

// Utils  -  gridRowComparator
export { areGridRowPropsEqual, isRowInRange } from './utils';
export type { GridRowComparatorProps } from './utils';

// Utils  -  checkboxUtils
export { handleBooleanCellPointerDown } from './utils';
export type { BooleanCellSelectHandlers } from './utils';

// Utils  -  columnReorder
export {
  getPinStateForColumn,
  reorderColumnArray,
  calculateDropTarget,
} from './utils';
export type { ColumnPinState, IDropTarget, ICalculateDropTargetParams } from './utils';

// Utils  -  virtualScroll
export {
  computeVisibleRange,
  computeTotalHeight,
  getScrollTopForRow,
  computeVisibleColumnRange,
  partitionColumnsForVirtualization,
  MAX_SPACER_PX,
  computeScaledGeometry,
  computeScaledWindow,
  scrollTopForRowScaled,
} from './utils';
export type {
  IVisibleRange,
  IVisibleColumnRange,
  IScaledSpacerConfig,
  IScaledSpacerGeometry,
  IScaledRowWindow,
} from './utils';

// Utils  -  windowedRowCache
export { WindowedRowCache, createWindowedRowCache } from './utils';
export type { WindowedRow, WindowedRowCacheOptions } from './utils';

// Utils  -  workerSortFilter
export {
  extractValueMatrix,
  processClientSideDataAsync,
  DEFAULT_WORKER_SORT_AUTO_THRESHOLD,
  shouldUseWorkerSort,
} from './utils';
export type { SortFilterRequest, SortFilterResponse } from './utils';

// Utils  -  dataGridViewModel
export {
  getHeaderFilterConfig,
  getCellRenderDescriptor,
  CellDescriptorCache,
  resolveCellDisplayContent,
  resolveCellStyle,
  buildInlineEditorProps,
  buildPopoverEditorProps,
} from './utils';
export type {
  HeaderFilterConfigInput,
  HeaderFilterConfig,
  CellRenderDescriptorInput,
  CellRenderDescriptor,
  CellRenderMode,
} from './utils';

// Utils  -  debounce, dom
export { debounce } from './utils';
export { measureRange, buildCellIndex, cellIndexKey, CELL_INDEX_STRIDE, injectGlobalStyles } from './utils';
export type { OverlayRect } from './utils';

// Utils  -  sortHelpers
export { computeNextSortState } from './utils';
export type { ISortState } from './utils';

// Utils  -  columnAutosize
export { measureColumnContentWidth, estimateHeaderMinWidth, AUTOSIZE_EXTRA_PX, AUTOSIZE_MAX_PX } from './utils';

// Utils  -  keyboardNavigation
export { findCtrlArrowTarget, computeTabNavigation, computeArrowNavigation, applyCellDeletion } from './utils';
export type { ArrowNavigationContext, ArrowNavigationResult } from './utils';

// Utils  -  selectionHelpers
export { rangesEqual, clampSelectionToBounds, computeAutoScrollSpeed, applyRangeRowSelection, computeRowSelectionState } from './utils';

// Utils  -  clipboardHelpers
export {
  formatCellValueForTsv,
  formatSelectionAsTsv,
  parseTsvClipboard,
  applyPastedValues,
  applyCutClear,
} from './utils';

// Utils  -  fillHelpers
export { applyFillValues, areFillCompatible } from './utils';
export type { IFillFormulaOptions } from './utils';

// Utils  -  undoRedoStack
export { UndoRedoStack } from './utils';

// Utils  -  validation
export { validateColumns, validateRowIds, validateVirtualScrollConfig } from './utils';

// Utils  -  cellReference
export { indexToColumnLetter, columnLetterToIndex, formatCellReference } from './utils';

// Utils  -  formulaBarHelpers (type-only; runtime moved to @alaarab/ogrid-core/formula)
export type { FormulaReference } from './utils';

// Utils  -  responsiveColumns
export { getResponsiveHiddenColumns, RESPONSIVE_BREAKPOINTS, resolveResponsiveConfig, applyResponsiveHiding } from './utils';
export type { IResponsiveColumnsConfig } from './utils';

// Utils  -  dateFormatter
export { formatDateForDisplay, parseUserInputDate, getDateInputPlaceholder, DEFAULT_DATE_FORMAT } from './utils';

// Constants  -  layout
export {
  CHECKBOX_COLUMN_WIDTH,
  ROW_NUMBER_COLUMN_WIDTH,
  ROW_NUMBER_COLUMN_MIN_WIDTH,
  ROW_NUMBER_COLUMN_ID,
  DEFAULT_MIN_COLUMN_WIDTH,
  CELL_PADDING,
  GRID_BORDER_RADIUS,
} from './constants';

// Constants  -  timing
export {
  DEFAULT_DEBOUNCE_MS,
  PEOPLE_SEARCH_DEBOUNCE_MS,
  SIDEBAR_TRANSITION_MS,
} from './constants';

// Constants  -  zIndex
export { Z_INDEX } from './constants';
export type { ZIndexKey } from './constants';

// Formula types (type-only  -  zero runtime cost; runtime is in @alaarab/ogrid-core/formula)
export type {
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
} from './formula';
