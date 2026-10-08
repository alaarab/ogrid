// Constants (re-exported from core)
export {
  CHECKBOX_COLUMN_WIDTH,
  ROW_NUMBER_COLUMN_WIDTH,
  ROW_NUMBER_COLUMN_MIN_WIDTH,
  ROW_NUMBER_COLUMN_ID,
  DEFAULT_MIN_COLUMN_WIDTH,
  CELL_PADDING,
  GRID_BORDER_RADIUS,
} from '@alaarab/ogrid-core';

// Types
export type {
  ColumnFilterType,
  IColumnFilterDef,
  IFilterOption,
  FilterOption,
  IColumnMeta,
  IColumnDef,
  IColumnGroupDef,
  IColumnDefinition,
  ICellValueChangedEvent,
  ICellEditorProps,
  CellEditorParams,
  IValueParserParams,
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
  IOGridApi,
  IOGridProps,
  IOGridDataGridProps,
  WindowedDataState,
  RowSelectionMode,
  RowId,
  IRowSelectionChangeEvent,
  StatusBarPanel,
  IStatusBarProps,
  IActiveCell,
  ISelectionRange,
  IMergedCell,
  ICellNote,
  HeaderCell,
  HeaderRow,
  SideBarPanelId,
  ISideBarDef,
  IDateFilterValue,
  IVirtualScrollConfig,
  IColumnReorderConfig,
  ISheetDef,
  IFormulaCellWriter,
  IRowsChangeEvent,
  IColumnsChangeEvent,
  IGridStructureActions,
  IGridCellNavigator,
  IGridHidingActions,
} from './types';
export { toUserLike, isInSelectionRange, normalizeSelectionRange, isWindowedDataSource } from './types';

// Hooks
export {
  useFilterOptions,
  useOGrid,
  useHeadlessGrid,
  useInlineEdit,
  useRangeSelection,
  useFillHandle,
  useCellClipboard,
  useFindReplace,
  useFindReplacePanel,
  formatReplaceStatus,
  useGridFocus,
  useActiveCell,
  useCellEditing,
  useContextMenu,
  useCellSelection,
  useClipboard,
  useRowSelection,
  useKeyboardNavigation,
  useUndoRedo,
  useDebounce,
  useDataGridState,
  useColumnHeaderFilterState,
  useTextFilterState,
  useMultiSelectFilterState,
  usePeopleFilterState,
  useDateFilterState,
  useColumnChooserState,
  useInlineCellEditorState,
  useColumnResize,
  useRichSelectState,
  useSelectState,
  useSideBarState,
  useTableLayout,
  useColumnReorder,
  useVirtualScroll,
  useListVirtualizer,
  useGridVirtualization,
  useLatestRef,
  usePortalTheme,
  useCoarsePointer,
  usePaginationControls,
  useDataGridTableOrchestration,
  useColumnMeta,
  useFormulaEngine,
  useFormulaBar,
  getColumnHeaderMenuProps,
} from './hooks';
export type {
  UseFilterOptionsResult,
  UseFilterOptionsOptions,
  UseOGridResult,
  UseOGridPagination,
  UseOGridColumnChooser,
  UseOGridLayout,
  UseOGridFilters,
  ColumnChooserPlacement,
  UseHeadlessGridParams,
  UseHeadlessGridResult,
  SortState,
  HeadlessGridRowId,
  UseInlineEditParams,
  UseInlineEditResult,
  InlineEditEvent,
  InlineEditorProps,
  UseRangeSelectionParams,
  UseRangeSelectionResult,
  CellCoord,
  UseCellClipboardParams,
  UseCellClipboardResult,
  CellClipboardCopyEvent,
  CellClipboardPasteEvent,
  UseFindReplaceParams,
  UseFindReplaceResult,
  FindReplaceMode,
  FindReplaceResult,
  UseGridFocusParams,
  UseGridFocusResult,
  GridFocusCellProps,
  UseActiveCellResult,
  UseActiveCellOptions,
  UseCellEditingResult,
  EditingCell,
  UseContextMenuResult,
  ContextMenuPosition,
  UseCellSelectionResult,
  UseCellSelectionParams,
  UseClipboardResult,
  UseClipboardParams,
  UseRowSelectionResult,
  UseRowSelectionParams,
  UseKeyboardNavigationResult,
  UseKeyboardNavigationParams,
  UseUndoRedoResult,
  UseUndoRedoParams,
  UndoableAction,
  UseUndoRedoFormulaCells,
  UseFillHandleResult,
  UseFillHandleParams,
  FillModifierEvent,
  UseDataGridStateParams,
  UseDataGridStateResult,
  DataGridLayoutState,
  DataGridRowSelectionState,
  DataGridEditingState,
  DataGridCellInteractionState,
  DataGridContextMenuState,
  DataGridViewModelState,
  DataGridPinningState,
  DataGridFindReplaceState,
  UseFindReplacePanelResult,
  UseColumnHeaderFilterStateParams,
  UseColumnHeaderFilterStateResult,
  UseTextFilterStateParams,
  UseTextFilterStateResult,
  UseMultiSelectFilterStateParams,
  UseMultiSelectFilterStateResult,
  UsePeopleFilterStateParams,
  UsePeopleFilterStateResult,
  UseDateFilterStateParams,
  UseDateFilterStateResult,
  UseColumnChooserStateParams,
  UseColumnChooserStateResult,
  UseInlineCellEditorStateParams,
  UseInlineCellEditorStateResult,
  InlineCellEditorType,
  InlineCellEditorCommitOptions,
  UseColumnResizeParams,
  UseColumnResizeResult,
  UseRichSelectStateParams,
  UseRichSelectStateResult,
  UseSelectStateParams,
  UseSelectStateResult,
  UseSideBarStateParams,
  UseSideBarStateResult,
  UseTableLayoutParams,
  UseTableLayoutResult,
  UseColumnReorderParams,
  UseColumnReorderResult,
  UseVirtualScrollParams,
  UseVirtualScrollResult,
  UseGridVirtualizationParams,
  UseGridVirtualizationResult,
  UsePaginationControlsProps,
  UsePaginationControlsResult,
  UseDataGridTableOrchestrationParams,
  UseDataGridTableOrchestrationResult,
  UseColumnMetaParams,
  ColumnMetaResult,
  UseFormulaEngineParams,
  UseFormulaEngineResult,
  UseFormulaBarParams,
  UseFormulaBarResult,
} from './hooks';

// Constants
export {
  GRID_ROOT_STYLE,
  GRID_ROOT_VIRTUAL_SCROLL_STYLE,
  CURSOR_CELL_STYLE,
  POPOVER_ANCHOR_STYLE,
  PREVENT_DEFAULT,
  NOOP,
  STOP_PROPAGATION,
} from './constants/domHelpers';

// Components
export { OGridLayout } from './components/OGridLayout';
export type { OGridLayoutProps } from './components/OGridLayout';
export { StatusBar } from './components/StatusBar';
export type { StatusBarProps, StatusBarClassNames } from './components/StatusBar';
export {
  BaseInlineCellEditor,
  editorWrapperStyle,
  editorInputStyle,
  richSelectWrapperStyle,
  richSelectDropdownStyle,
  richSelectOptionStyle,
  richSelectOptionHighlightedStyle,
  richSelectNoMatchesStyle,
  richSelectSearchInputStyle,
  richSelectFooterStyle,
  selectEditorStyle,
  selectDisplayStyle,
  selectChevronStyle,
} from './components/BaseInlineCellEditor';
export type { BaseInlineCellEditorProps } from './components/BaseInlineCellEditor';
export { GridContextMenu } from './components/GridContextMenu';
export type { GridContextMenuProps, GridContextMenuClassNames, GridContextMenuStructure, GridContextMenuHiding } from './components/GridContextMenu';
export { MarchingAntsOverlay } from './components/MarchingAntsOverlay';
export type { MarchingAntsOverlayProps } from './components/MarchingAntsOverlay';
export { FormulaBar } from './components/FormulaBar';
export type { FormulaBarProps } from './components/FormulaBar';
export { FormulaRefOverlay } from './components/FormulaRefOverlay';
export type { FormulaRefOverlayProps } from './components/FormulaRefOverlay';
export { SheetTabs, SHEET_TAB_COLORS, moveSheetId } from './components/SheetTabs';
export type { SheetTabsProps } from './components/SheetTabs';
export { SideBar } from './components/SideBar';
export type { SideBarProps, SideBarFilterColumn } from './components/SideBar';
export { BaseColumnHeaderMenu } from './components/BaseColumnHeaderMenu';
export type { BaseColumnHeaderMenuProps, ColumnHeaderMenuClassNames } from './components/BaseColumnHeaderMenu';
export { PaginationControlsBase } from './components/PaginationControlsBase';
export type {
  PaginationControlsBaseProps,
  PaginationControlsBaseClassNames,
  IPaginationControlsSlots,
  INavButtonSlotProps,
  IPageButtonSlotProps,
  IPageSizeSelectSlotProps,
  IOuterContainerSlotProps,
} from './components/PaginationControlsBase';
export { ColumnChooserContent } from './components/ColumnChooserContent';
export type {
  ColumnChooserContentProps,
  ColumnChooserContentClassNames,
  IColumnChooserCheckboxItemProps,
  IColumnChooserActionsProps,
  IColumnChooserHeaderProps,
} from './components/ColumnChooserContent';
export { createOGrid } from './components/createOGrid';
export type { CreateOGridComponents, GridRowProps, InlineCellEditorProps } from './components/createOGrid';
export {
  createGridContextMenu,
  createStatusBar,
  createDropIndicator,
  createLoadingOverlay,
} from './components/createStyledKitComponents';
export type {
  KitStylesModule,
  StyledGridContextMenuProps,
  StyledStatusBarProps,
  StyledDropIndicatorProps,
  StyledLoadingOverlayProps,
} from './components/createStyledKitComponents';
export { BaseDataGridTableInner, createDataGridTable } from './components/BaseDataGridTable';
export type {
  DataGridStyles,
  DataGridPrimitives,
  RowCheckboxRenderProps,
  HeaderSelectAllRenderProps,
  BooleanCellRenderProps,
  PopoverEditorRenderProps,
  FindReplacePanelProps,
} from './components/BaseDataGridTable';
export { CellErrorBoundary } from './components/CellErrorBoundary';
export type { CellErrorBoundaryProps } from './components/CellErrorBoundary';
export { WindowedPlaceholderRow } from './components/WindowedPlaceholderRow';
export type { WindowedPlaceholderRowProps } from './components/WindowedPlaceholderRow';
export { EmptyState } from './components/EmptyState';
export type { EmptyStateProps } from './components/EmptyState';
export { BaseEmptyState } from './components/BaseEmptyState';
export type { BaseEmptyStateProps, BaseEmptyStateClassNames } from './components/BaseEmptyState';
export { BaseLoadingOverlay } from './components/BaseLoadingOverlay';
export type { BaseLoadingOverlayProps, BaseLoadingOverlayClassNames } from './components/BaseLoadingOverlay';
export { BaseDropIndicator } from './components/BaseDropIndicator';
export type { BaseDropIndicatorProps } from './components/BaseDropIndicator';
export {
  DateFilterContent,
  getColumnHeaderFilterStateParams,
  getDateFilterContentProps,
} from './components/ColumnHeaderFilterContent';
export type {
  IColumnHeaderFilterProps,
  DateFilterContentProps,
  DateFilterClassNames,
} from './components/ColumnHeaderFilterContent';

// Utilities
export {
  escapeCsvValue,
  buildCsvHeader,
  buildCsvRows,
  exportToCsv,
  triggerCsvDownload,
  triggerBlobDownload,
  getCellValue,
  flattenColumns,
  buildHeaderRows,
  getFilterField,
  mergeFilter,
  deriveFilterOptionsFromData,
  getMultiSelectFilterFields,
  getStatusBarParts,
  getDataGridStatusBarConfig,
  GRID_CONTEXT_MENU_ITEMS,
  COLUMN_HEADER_MENU_ITEMS,
  getContextMenuHandlers,
  getColumnHeaderMenuItems,
  getStructureMenuItems,
  getHidingMenuItems,
  computeHiddenGaps,
  hiddenKeysInSpan,
  hiddenKeysAround,
  formatShortcut,
  getPaginationViewModel,
  PAGE_SIZE_OPTIONS,
  MAX_PAGE_BUTTONS,
  getHeaderFilterConfig,
  getCellRenderDescriptor,
  CellDescriptorCache,
  isRowInRange,
  resolveCellDisplayContent,
  resolveCellStyle,
  buildInlineEditorProps,
  buildPopoverEditorProps,
  getCellInteractionProps,
  parseValue,
  numberParser,
  currencyParser,
  dateParser,
  emailParser,
  booleanParser,
  computeAggregations,
  processClientSideData,
  partitionColumnsForVirtualization,
  areGridRowPropsEqual,
  findCtrlArrowTarget,
  computeTabNavigation,
  rangesEqual,
  resolveMergedCells,
  remapMergedCells,
  expandRangeToMerges,
  isCoveredCell,
  clampSelectionToBounds,
  computeAutoScrollSpeed,
  formatCellValueForTsv,
  formatSelectionAsTsv,
  parseTsvClipboard,
  UndoRedoStack,
  indexToColumnLetter,
  formatCellReference,
  getGridCellSurfaceState,
  handleBooleanCellPointerDown,
  WindowedRowCache,
  createWindowedRowCache,
} from './utils';
export type {
  WindowedRow,
  WindowedRowCacheOptions,
  CsvColumn,
  StatusBarPart,
  StatusBarPartsInput,
  GridContextMenuItem,
  GridContextMenuHandlerProps,
  PaginationViewModel,
  PageSize,
  IMergeLayout,
  IResolvedMerge,
  HeaderFilterConfigInput,
  HeaderFilterConfig,
  CellRenderDescriptorInput,
  CellRenderDescriptor,
  CellRenderMode,
  CellInteractionHandlers,
  ParseValueResult,
  AggregationResult,
  GridRowComparatorProps,
  GridCellSurfaceState,
  GetGridCellSurfaceStateParams,
  IColumnHeaderMenuItem,
  ColumnHeaderMenuInput,
  HidingMenuInput,
  IHiddenGaps,
  ColumnHeaderMenuHandlers,
  BooleanCellSelectHandlers,
} from './utils';

// Find & replace (pure helpers from core, for headless use alongside useFindReplace)
export {
  DEFAULT_FIND_OPTIONS,
  findMatches,
  findNextMatchIndex,
  planReplace,
  replaceInCellText,
  cellTextMatches,
  getFindCellText,
  formatFindStatus,
} from '@alaarab/ogrid-core';
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
} from '@alaarab/ogrid-core';

// Shared component props & renderers (for UI packages to consume)
export { renderFilterContent, createBaseFilterRenderers } from './components/ColumnHeaderFilterRenderers';
export type {
  FilterContentRenderers,
  MultiSelectRendererProps,
  TextRendererProps,
  PeopleRendererProps,
  DateRendererProps,
} from './components/ColumnHeaderFilterRenderers';
export type { IColumnChooserProps } from './components/ColumnChooserProps';
export type { IPaginationControlsProps } from './components/PaginationControlsProps';

// Cell notes
export { cellNoteKey, indexCellNotes, upsertCellNote, removeCellNote, setCellNote, getCellNoteMenuItems } from './utils';
export type { CellNotePopoverRenderProps } from './components/BaseDataGridTable.types';
export type { GridContextMenuNotes } from './components/GridContextMenu';
