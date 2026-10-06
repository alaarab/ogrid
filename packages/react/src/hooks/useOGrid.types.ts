import type * as React from 'react';
import type { SortState } from './useOGridSorting';
import type { SideBarProps } from '../components/SideBar';
import type {
  IOGridDataGridProps,
  IColumnDefinition,
  IFilters,
  RowId,
  PageSize,
} from '../types';

/** Resolved column chooser placement. */
export type ColumnChooserPlacement = 'toolbar' | 'sidebar' | 'external' | 'none';

/** Pagination state and handlers. */
export interface UseOGridPagination {
  page: number;
  pageSize: PageSize;
  displayTotalCount: number;
  setPage: (p: number) => void;
  setPageSize: (size: PageSize) => void;
  pageSizeOptions?: PageSize[];
  entityLabelPlural: string;
  /**
   * True when pagination is bypassed (full-dataset virtualization mode —
   * `virtualScroll.paginate === false` — or a windowed data source). The UI layer should not render
   * pagination controls in this mode.
   */
  hidden: boolean;
}

/** Column chooser state and handlers. */
export interface UseOGridColumnChooser {
  columns: IColumnDefinition[];
  visibleColumns: Set<string>;
  onVisibilityChange: (columnKey: string, isVisible: boolean) => void;
  onSetVisibleColumns: (columns: Set<string>) => void;
  placement: ColumnChooserPlacement;
}

/** Layout / chrome configuration. */
export interface UseOGridLayout {
  toolbar: React.ReactNode;
  toolbarBelow: React.ReactNode;
  className?: string;
  emptyState?: { message?: React.ReactNode; render?: () => React.ReactNode };
  sideBarProps: SideBarProps | null;
  fullScreen?: boolean;
  /** Formula bar element (rendered between toolbar and grid when formulas are enabled). */
  formulaBar?: React.ReactNode;
  /** Sheet tabs element (rendered between grid and footer when sheetDefs are provided). */
  sheetTabs?: React.ReactNode;
}

/** Filter state. */
export interface UseOGridFilters {
  hasActiveFilters: boolean;
  setFilters: (f: IFilters) => void;
}

/**
 * Grid state that belongs to one sheet, captured and restored across switches.
 * A slot typed as optional uses `undefined` to mean "leave it to the hook that
 * reconciles this against the incoming column defs".
 */
export interface SheetScopedGridState {
  visibleColumns: Set<string> | undefined;
  sort: SortState;
  filters: IFilters;
  page: number;
  selectedRows: Set<RowId>;
  columnOrder: string[] | undefined;
  columnWidths: Record<string, number>;
  pinned: Record<string, 'left' | 'right'> | undefined;
}

export interface UseOGridResult<T> {
  dataGridProps: IOGridDataGridProps<T>;
  pagination: UseOGridPagination;
  columnChooser: UseOGridColumnChooser;
  layout: UseOGridLayout;
  filters: UseOGridFilters;
}
