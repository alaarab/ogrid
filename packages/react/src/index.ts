// Constants (re-exported from core)
export {
  CHECKBOX_COLUMN_WIDTH,
  ROW_NUMBER_COLUMN_WIDTH,
  DEFAULT_MIN_COLUMN_WIDTH,
  CELL_PADDING,
  GRID_BORDER_RADIUS,
} from '@alaarab/ogrid-core';

// Types
export type {
  ColumnFilterType,
  IColumnFilterDef,
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
  IDataSource,
  IGridColumnState,
  IOGridApi,
  IOGridProps,
  IOGridDataGridProps,
  RowSelectionMode,
  RowId,
  IRowSelectionChangeEvent,
  StatusBarPanel,
  IStatusBarProps,
  IActiveCell,
  ISelectionRange,
  HeaderCell,
  HeaderRow,
  SideBarPanelId,
  ISideBarDef,
  IDateFilterValue,
  IVirtualScrollConfig,
  IColumnReorderConfig,
} from './types';
export { toUserLike, isInSelectionRange, normalizeSelectionRange } from './types';

// Hooks
export {
  useFilterOptions,
  useOGrid,
  useActiveCell,
  useCellEditing,
  useContextMenu,
  useCellSelection,
  useClipboard,
  useRowSelection,
  useKeyboardNavigation,
  useUndoRedo,
  useDebounce,
  useFillHandle,
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
  useLatestRef,
  usePaginationControls,
  useDataGridTableOrchestration,
} from './hooks';
export type {
  UseFilterOptionsResult,
  UseOGridResult,
  UseOGridPagination,
  UseOGridColumnChooser,
  UseOGridLayout,
  UseOGridFilters,
  ColumnChooserPlacement,
  UseActiveCellResult,
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
  UseFillHandleResult,
  UseFillHandleParams,
  UseDataGridStateParams,
  UseDataGridStateResult,
  DataGridLayoutState,
  DataGridRowSelectionState,
  DataGridEditingState,
  DataGridCellInteractionState,
  DataGridContextMenuState,
  DataGridViewModelState,
  DataGridPinningState,
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
  UsePaginationControlsProps,
  UsePaginationControlsResult,
  UseDataGridTableOrchestrationParams,
  UseDataGridTableOrchestrationResult,
} from './hooks';

// Constants
export {
  GRID_ROOT_STYLE,
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
  selectEditorStyle,
  selectDisplayStyle,
  selectChevronStyle,
} from './components/BaseInlineCellEditor';
export type { BaseInlineCellEditorProps } from './components/BaseInlineCellEditor';
export { GridContextMenu } from './components/GridContextMenu';
export type { GridContextMenuProps, GridContextMenuClassNames } from './components/GridContextMenu';
export { MarchingAntsOverlay } from './components/MarchingAntsOverlay';
export type { MarchingAntsOverlayProps } from './components/MarchingAntsOverlay';
export { SideBar } from './components/SideBar';
export type { SideBarProps, SideBarFilterColumn } from './components/SideBar';
export { BaseColumnHeaderMenu } from './components/BaseColumnHeaderMenu';
export type { BaseColumnHeaderMenuProps, ColumnHeaderMenuClassNames } from './components/BaseColumnHeaderMenu';
export { createOGrid } from './components/createOGrid';
export type { CreateOGridComponents, GridRowProps, InlineCellEditorProps } from './components/createOGrid';
export { CellErrorBoundary } from './components/CellErrorBoundary';
export type { CellErrorBoundaryProps } from './components/CellErrorBoundary';
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
  formatShortcut,
  getPaginationViewModel,
  PAGE_SIZE_OPTIONS,
  MAX_PAGE_BUTTONS,
  getHeaderFilterConfig,
  getCellRenderDescriptor,
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
  areGridRowPropsEqual,
  findCtrlArrowTarget,
  computeTabNavigation,
  rangesEqual,
  clampSelectionToBounds,
  computeAutoScrollSpeed,
  formatCellValueForTsv,
  formatSelectionAsTsv,
  parseTsvClipboard,
  UndoRedoStack,
} from './utils';
export type {
  CsvColumn,
  StatusBarPart,
  StatusBarPartsInput,
  GridContextMenuItem,
  GridContextMenuHandlerProps,
  PaginationViewModel,
  HeaderFilterConfigInput,
  HeaderFilterConfig,
  CellRenderDescriptorInput,
  CellRenderDescriptor,
  CellRenderMode,
  CellInteractionHandlers,
  ParseValueResult,
  AggregationResult,
  GridRowComparatorProps,
  IColumnHeaderMenuItem,
  ColumnHeaderMenuInput,
  ColumnHeaderMenuHandlers,
} from './utils';

// Shared component props & renderers (for UI packages to consume)
export { renderFilterContent } from './components/ColumnHeaderFilterRenderers';
export type {
  FilterContentRenderers,
  MultiSelectRendererProps,
  TextRendererProps,
  PeopleRendererProps,
  DateRendererProps,
} from './components/ColumnHeaderFilterRenderers';
export type { IColumnChooserProps } from './components/ColumnChooserProps';
export type { IPaginationControlsProps } from './components/PaginationControlsProps';
