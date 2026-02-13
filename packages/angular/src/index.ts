// Re-export core types + utils
export * from '@alaarab/ogrid-core';

// Explicitly re-export constants for test resolution
export {
  CHECKBOX_COLUMN_WIDTH,
  ROW_NUMBER_COLUMN_WIDTH,
  DEFAULT_MIN_COLUMN_WIDTH,
  CELL_PADDING,
  GRID_BORDER_RADIUS,
  PEOPLE_SEARCH_DEBOUNCE_MS,
  DEFAULT_DEBOUNCE_MS,
  SIDEBAR_TRANSITION_MS,
  Z_INDEX,
} from '@alaarab/ogrid-core';

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

export { ColumnReorderService } from './services/column-reorder.service';

export { VirtualScrollService } from './services/virtual-scroll.service';

// Components
export { OGridLayoutComponent } from './components/ogrid-layout.component';
export { StatusBarComponent } from './components/status-bar.component';
export { GridContextMenuComponent } from './components/grid-context-menu.component';
export { SideBarComponent } from './components/sidebar.component';
export type { SideBarProps, SideBarFilterColumn } from './components/sidebar.component';
export { MarchingAntsOverlayComponent } from './components/marching-ants-overlay.component';
export { EmptyStateComponent } from './components/empty-state.component';
export { BaseDataGridTableComponent } from './components/base-datagrid-table.component';
export { BaseColumnHeaderFilterComponent } from './components/base-column-header-filter.component';
export type { IColumnHeaderFilterProps } from './components/base-column-header-filter.component';
export { BaseColumnChooserComponent } from './components/base-column-chooser.component';
export type { IColumnChooserProps } from './components/base-column-chooser.component';
export { BasePaginationControlsComponent } from './components/base-pagination-controls.component';

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
  createLatestRef,
  createLatestCallback,
} from './utils';
