// Types  -  columnTypes
export type {
  ColumnFilterType,
  IDateFilterValue,
  ConditionFilterKind,
  ConditionOperator,
  IFilterCondition,
  IConditionFilterValue,
  IColumnFilterDef,
  IFilterOption,
  FilterOption,
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
  ISortModelItem,
  SortModel,
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
export type { CsvColumn, CsvEscapeOptions, FormulaExportOptions } from './utils';

// Utils  -  cellValue, columnUtils
export { getCellValue, isColumnEditable, isCellWrapped, createGridDataAccessor, createFormulaRowMap, createOffsetFormulaRowMap } from './utils';
export type { IFormulaRowMap } from './utils';
export { flattenColumns, buildHeaderRows } from './utils';

// Utils  -  structure edits (insert/delete rows and columns)
export {
  insertRowsAt,
  removeRowsById,
  restoreRemovedRows,
  countLeafColumns,
  insertColumnAt,
  removeColumnById,
  createStructureColumn,
  remapMergedCells,
} from './utils';
export type { IRemovedRow } from './utils';

// Utils  -  ogridHelpers
export {
  isFilterConfig,
  getFilterField,
  mergeFilter,
  getFilterOptionLabel,
  getFilterOptionValue,
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
export type { PaginationViewModel, PageSize } from './utils';

// Utils  -  gridContextMenuHelpers
export {
  GRID_CONTEXT_MENU_ITEMS,
  COLUMN_HEADER_MENU_ITEMS,
  getContextMenuHandlers,
  getColumnHeaderMenuItems,
  getStructureMenuItems,
  getHidingMenuItems,
  formatShortcut,
  computeHiddenGaps,
  hiddenKeysInSpan,
  hiddenKeysAround,
} from './utils';
export type {
  GridContextMenuItem,
  IColumnHeaderMenuItem,
  GridContextMenuHandlerProps,
  ColumnHeaderMenuInput,
  ColumnHeaderMenuHandlers,
  StructureMenuInput,
  HidingMenuInput,
  IHiddenGaps,
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

// Utils  -  conditionFilter
export {
  CONDITION_OPERATORS,
  getConditionOperatorLabel,
  getConditionOperatorArity,
  resolveConditionFilterKind,
  isConditionComplete,
  normalizeConditionFilter,
  createConditionPredicate,
} from './utils';

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
  ICellEditCommitOptions,
  CellRenderDescriptor,
  CellRenderMode,
} from './utils';

// Utils  -  debounce, dom
export { debounce } from './utils';
export { measureRange, buildCellIndex, cellIndexKey, CELL_INDEX_STRIDE, injectGlobalStyles } from './utils';
export type { OverlayRect } from './utils';

// Utils  -  sortHelpers
export { computeNextSortState, computeNextSortModel, normalizeSortModel, sortModelKey } from './utils';
export type { ISortState, ComputeNextSortModelOptions } from './utils';

// Utils  -  columnAutosize
export { measureColumnContentWidth, estimateHeaderMinWidth, AUTOSIZE_EXTRA_PX, AUTOSIZE_MAX_PX } from './utils';

// Utils  -  keyboardNavigation
export { findCtrlArrowTarget, computeTabNavigation, computeArrowNavigation, applyCellDeletion, getOppositeCorner, computeRangeCycleStep } from './utils';
export type { ArrowNavigationContext, ArrowNavigationResult, RangeCycleDirection } from './utils';

// Utils  -  sheetReferences (name box input, F4 reference cycling)
export { cycleReferenceAtCaret, parseSheetReference } from './utils';
export type { ISheetReferenceRange, ICycledReference } from './utils';

// Utils  -  selectionHelpers
export { rangesEqual, clampSelectionToBounds, computeAutoScrollSpeed, computeAutoScrollDelta, getSelectAllRange, applyRangeRowSelection, computeRowSelectionState } from './utils';

// Utils  -  mergedCells
export { resolveMergedCells, isCoveredCell, expandRangeToMerges, isSingleMergeRange } from './utils';
export type { IResolvedMerge, IMergeLayout, ResolveMergedCellsParams } from './utils';

// Utils  -  find & replace
export {
  DEFAULT_FIND_OPTIONS,
  getFindCellText,
  cellTextMatches,
  replaceInCellText,
  findMatches,
  findNextMatchIndex,
  planReplace,
  formatFindStatus,
} from './utils';
export type {
  FindLookIn,
  FindSearchOrder,
  FindScope,
  IFindOptions,
  IFindMatch,
  IFindSource,
  IFindFormulaEdit,
  IReplacePlan,
  IPlanReplaceParams,
} from './utils';
// Conditional formatting
export {
  createConditionalFormatter,
  conditionalFormatCellStyle,
  conditionalFormatTextStyle,
  getConditionalFormatIcon,
  interpolateColor,
  parseCssColor,
  CONDITIONAL_FORMAT_STYLES,
  COLOR_SCALES,
} from './utils';
export type { IConditionalFormatContext, IConditionalFormatter, ConditionalFormatCellStyleOptions } from './utils';
export type {
  IConditionalFormatStyle,
  ConditionalFormatOperator,
  ConditionalFormatTextOperator,
  ConditionalFormatDatePeriod,
  ConditionalFormatIconSet,
  IConditionalFormatValueBound,
  IColorScaleStop,
  IConditionalFormatRuleBase,
  IConditionalFormatCellValueRule,
  IConditionalFormatTextRule,
  IConditionalFormatDateRule,
  IConditionalFormatDuplicateRule,
  IConditionalFormatTopBottomRule,
  IConditionalFormatAverageRule,
  IConditionalFormatBlankRule,
  IConditionalFormatFormulaRule,
  IConditionalFormatPredicateRule,
  IConditionalFormatColorScaleRule,
  IConditionalFormatDataBarRule,
  IConditionalFormatIconSetRule,
  IConditionalFormatRule,
  ICellDataBar,
  ICellIcon,
  ICellConditionalFormat,
} from './types';

// Utils  -  clipboardHelpers
export {
  formatCellValueForTsv,
  formatSelectionAsTsv,
  parseTsvClipboard,
  applyPastedValues,
  applyCutClear,
  captureCutSource,
  resolveCutClear,
  tilePastedRows,
  formatTsvAsHtmlTable,
  parseHtmlClipboard,
  htmlClipboardToTsv,
} from './utils';
export type { ICutSource, ResolveCutClearParams, IPasteFormulaSource } from './utils';

// Utils  -  fillHelpers
export { applyFillValues, areFillCompatible, computeFillRange, computeFillDragEdits, computeAutoFillEndRow, detectFillSeries } from './utils';
export type { IFillFormulaOptions, IFillSeriesOptions, IFillSeries, IDetectFillSeriesOptions } from './utils';

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
  IFormulaLimits,
  IGridDataAccessor,
  INamedRange,
  IAuditEntry,
  IAuditTrail,
  FormulaFunctionCategory,
  IFormulaFunctionArg,
  IFormulaFunctionMetadata,
  IFormulaSignaturePart,
  IFormulaCaretContext,
  IFormulaCaretToken,
  IFormulaCaretCall,
  IFormulaCompletion,
} from './formula';

// Utils  -  cellNotes
export { cellNoteKey, indexCellNotes, upsertCellNote, removeCellNote, setCellNote, getCellNoteMenuItems } from './utils';
