// Re-export core types + utils
export * from '@alaarab/ogrid-core';

// Vue-specific types (override core's IColumnDef with Vue-specific version)
export type {
  IColumnDef,
  ICellEditorProps,
  IOGridProps,
  IOGridClientProps,
  IOGridServerProps,
  IOGridDataGridProps,
} from './types';

// Re-export all other types from the types barrel
export type {
  ColumnFilterType,
  IColumnFilterDef,
  IColumnMeta,
  IColumnGroupDef,
  IColumnDefinition,
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
  IVirtualScrollConfig,
} from './types';

export { toUserLike, isInSelectionRange, normalizeSelectionRange } from './types';

// Shared components
export { MarchingAntsOverlay } from './components/MarchingAntsOverlay';
export { StatusBar, type StatusBarProps } from './components/StatusBar';

// Composables
export {
  useOGrid,
  useDataGridState,
  useActiveCell,
  useCellEditing,
  useCellSelection,
  useClipboard,
  useRowSelection,
  useKeyboardNavigation,
  useFillHandle,
  useUndoRedo,
  useContextMenu,
  useColumnResize,
  useColumnReorder,
  useVirtualScroll,
  useFilterOptions,
  useDebounce,
  useDebouncedCallback,
  useTableLayout,
  useColumnHeaderFilterState,
  useTextFilterState,
  useMultiSelectFilterState,
  usePeopleFilterState,
  useDateFilterState,
  useColumnChooserState,
  useInlineCellEditorState,
  useRichSelectState,
  useSideBarState,
  useColumnPinning,
  useColumnHeaderMenuState,
  useDataGridTableSetup,
} from './composables';

// Composable types
export type {
  UseOGridResult,
  UseOGridPagination,
  UseOGridColumnChooser,
  UseOGridLayout,
  UseOGridFilters,
  ColumnChooserPlacement,
  UseDataGridStateParams,
  UseDataGridStateResult,
  DataGridLayoutState,
  DataGridRowSelectionState,
  DataGridEditingState,
  DataGridCellInteractionState,
  DataGridContextMenuState,
  DataGridViewModelState,
  DataGridPinningState,
  UseActiveCellResult,
  EditingCell,
  UseCellEditingParams,
  UseCellEditingResult,
  UseCellSelectionParams,
  UseCellSelectionResult,
  UseClipboardParams,
  UseClipboardResult,
  UseRowSelectionParams,
  UseRowSelectionResult,
  UseKeyboardNavigationParams,
  UseKeyboardNavigationResult,
  UseFillHandleParams,
  UseFillHandleResult,
  UseUndoRedoParams,
  UseUndoRedoResult,
  ContextMenuPosition,
  UseContextMenuResult,
  UseColumnResizeParams,
  UseColumnResizeResult,
  UseColumnReorderParams,
  UseColumnReorderResult,
  UseVirtualScrollParams,
  UseVirtualScrollResult,
  UseFilterOptionsResult,
  UseTableLayoutParams,
  UseTableLayoutResult,
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
  InlineCellEditorType,
  UseInlineCellEditorStateParams,
  UseInlineCellEditorStateResult,
  UseRichSelectStateParams,
  UseRichSelectStateResult,
  UseSideBarStateParams,
  UseSideBarStateResult,
  DebouncedFn,
  UseColumnPinningParams,
  UseColumnPinningResult,
  UseColumnHeaderMenuStateParams,
  UseColumnHeaderMenuStateResult,
  UseDataGridTableSetupParams,
  UseDataGridTableSetupResult,
} from './composables';

// View model utilities (for UI packages)
export {
  getHeaderFilterConfig,
  getCellRenderDescriptor,
  resolveCellDisplayContent,
  resolveCellStyle,
  buildInlineEditorProps,
  buildPopoverEditorProps,
  getCellInteractionProps,
} from './utils';

export type {
  HeaderFilterConfigInput,
  HeaderFilterConfig,
  CellRenderDescriptorInput,
  CellRenderDescriptor,
  CellRenderMode,
  CellInteractionHandlers,
  CellInteractionProps,
} from './utils';

// DataGridTable factory (for UI packages)
export { createDataGridTable, type IDataGridTableUIBindings } from './components/createDataGridTable';

// Component types (for UI packages to implement)
export type { SideBarProps, SideBarFilterColumn } from './components/SideBar';
