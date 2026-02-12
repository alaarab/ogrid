// Re-export core types + utils
export * from '@alaarab/ogrid-core';

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
  DataGridStateResult,
} from './services/datagrid-state.service';

// Components
export { OGridLayoutComponent } from './components/ogrid-layout.component';
export { StatusBarComponent } from './components/status-bar.component';
export { GridContextMenuComponent } from './components/grid-context-menu.component';
export { SideBarComponent } from './components/sidebar.component';
export type { SideBarProps, SideBarFilterColumn } from './components/sidebar.component';
export { MarchingAntsOverlayComponent } from './components/marching-ants-overlay.component';
export { EmptyStateComponent } from './components/empty-state.component';
