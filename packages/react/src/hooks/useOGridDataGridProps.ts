import { useCallback, useMemo } from 'react';
import type { IOGridApi, IOGridDataGridProps, IOGridProps, IStatusBarProps, PageSize } from '../types';
import type { UseOGridCallbacksState } from './useOGridCallbacks';
import type { UseOGridColumnLayoutState } from './useOGridColumnLayout';
import type { UseOGridDataFetchingState } from './useOGridDataFetching';
import type { UseOGridFiltersState } from './useOGridFilters';
import type { UseOGridRowSelectionState } from './useOGridRowSelection';
import type { UseOGridSortingState } from './useOGridSorting';
import type { resolveSpreadsheetChrome } from './ogridDerivations';

const EMPTY_LOADING_OPTIONS: Record<string, boolean> = {};

export interface UseOGridDataGridPropsParams<T> {
  props: IOGridProps<T>;
  scrollToRowRef: React.RefObject<IOGridApi<T>['scrollToRow'] | null>;
  callbacks: UseOGridCallbacksState<T>;
  dataFetching: UseOGridDataFetchingState<T>;
  sorting: UseOGridSortingState;
  filters: UseOGridFiltersState;
  visibleColumns: Set<string>;
  columnLayout: UseOGridColumnLayoutState;
  selection: UseOGridRowSelectionState<T>;
  chrome: ReturnType<typeof resolveSpreadsheetChrome>;
  onActiveCellChange: (ref: string | null) => void;
  isWindowed: boolean;
  page: number;
  pageSize: PageSize;
  statusBarConfig: IStatusBarProps | undefined;
  isLoading: boolean;
  formulaProps: Partial<IOGridDataGridProps<T>>;
}

/**
 * Assembles DataGridTable's props. Split into focused sub-memos so a change in
 * one concern (e.g. sorting) doesn't invalidate memos for unrelated concerns
 * (e.g. formulas); the outer memo lists every input, so its identity only
 * changes when something DataGridTable reads changed.
 */
export function useOGridDataGridProps<T>(params: UseOGridDataGridPropsParams<T>): IOGridDataGridProps<T> {
  const {
    scrollToRowRef, visibleColumns, onActiveCellChange, isWindowed, statusBarConfig,
    callbacks, dataFetching, sorting, filters: filtersState, columnLayout, selection, chrome,
  } = params;
  const {
    columns: columnsProp, dataSource, editable, cellSelection, canUndo, canRedo, rowSelection = 'none', emptyState,
    layoutMode = 'fill', suppressHorizontalScroll, stickyHeader, columnReorder, responsiveColumns, virtualScroll,
    rowHeight, density = 'normal', 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy,
  } = params.props;
  const { getRowId, onCellValueChanged, onUndo, onRedo, onClipboardError } = callbacks;
  const { displayItems, windowed, displayTotalCount } = dataFetching;
  const { effectiveColumnOrder, handleColumnOrderChange, handleColumnResized, handleColumnPinned, pinnedOverrides, columnWidthOverrides } = columnLayout;
  const { effectiveSelectedRows, handleSelectionChange } = selection;
  const showRowNumbersResolved = chrome.showRowNumbers;
  const showColumnLettersResolved = chrome.showColumnLetters;
  const showNameBox = chrome.showNameBox;
  const showActiveCellChange = chrome.reportActiveCell;
  const isLoadingResolved = params.isLoading;
  const page = params.page;
  const pageSize = params.pageSize;
  const dgFormulaProps = params.formulaProps;

  const { setFilters } = filtersState;
  const clearAllFilters = useCallback(() => setFilters({}), [setFilters]);

  const dgFilterProps = useMemo(() => ({
    filters: filtersState.filters,
    onFilterChange: filtersState.handleFilterChange,
    filterOptions: filtersState.clientFilterOptions,
    loadingFilterOptions: dataSource?.fetchFilterOptions ? filtersState.loadingFilterOptions : EMPTY_LOADING_OPTIONS,
    peopleSearch: dataSource?.searchPeople,
    getUserByEmail: dataSource?.getUserByEmail,
  }), [filtersState.filters, filtersState.handleFilterChange, filtersState.clientFilterOptions, dataSource, filtersState.loadingFilterOptions]);

  const dgEmptyState = useMemo(() => ({
    hasActiveFilters: filtersState.hasActiveFilters,
    onClearAll: clearAllFilters,
    message: emptyState?.message,
    render: emptyState?.render,
  }), [filtersState.hasActiveFilters, clearAllFilters, emptyState]);

  return useMemo<IOGridDataGridProps<T>>(() => ({
    scrollToRowRef,
    items: displayItems,
    windowed,
    columns: columnsProp,
    getRowId,
    sortBy: sorting.sort.field,
    sortDirection: sorting.sort.direction,
    onColumnSort: sorting.handleSort,
    visibleColumns,
    columnOrder: effectiveColumnOrder,
    onColumnOrderChange: handleColumnOrderChange,
    onColumnResized: handleColumnResized,
    onColumnPinned: handleColumnPinned,
    pinnedColumns: pinnedOverrides,
    initialColumnWidths: columnWidthOverrides,
    editable,
    cellSelection,
    onCellValueChanged,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
    onClipboardError,
    rowSelection,
    selectedRows: effectiveSelectedRows,
    onSelectionChange: handleSelectionChange,
    showRowNumbers: showRowNumbersResolved,
    showColumnLetters: showColumnLettersResolved,
    showNameBox,
    onActiveCellChange: showActiveCellChange ? onActiveCellChange : undefined,
    // A windowed source scrolls every row in one viewport: no page offset.
    currentPage: isWindowed ? 1 : page,
    pageSize,
    totalCount: displayTotalCount,
    statusBar: statusBarConfig,
    isLoading: isLoadingResolved,
    ...dgFilterProps,
    layoutMode,
    suppressHorizontalScroll,
    stickyHeader: stickyHeader ?? true,
    columnReorder,
    responsiveColumns,
    virtualScroll,
    rowHeight,
    density,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    emptyState: dgEmptyState,
    ...dgFormulaProps,
  }), [
    scrollToRowRef, displayItems, windowed, columnsProp, getRowId,
    sorting.sort.field, sorting.sort.direction, sorting.handleSort,
    visibleColumns, effectiveColumnOrder, handleColumnOrderChange, handleColumnResized,
    handleColumnPinned, pinnedOverrides, columnWidthOverrides,
    editable, cellSelection, onCellValueChanged, onUndo, onRedo, canUndo, canRedo, onClipboardError,
    rowSelection, effectiveSelectedRows, handleSelectionChange,
    showRowNumbersResolved, showColumnLettersResolved, showNameBox, showActiveCellChange, onActiveCellChange,
    isWindowed, page, pageSize, displayTotalCount, statusBarConfig,
    isLoadingResolved, dgFilterProps,
    layoutMode, suppressHorizontalScroll, stickyHeader, columnReorder, responsiveColumns, virtualScroll,
    rowHeight, density, ariaLabel, ariaLabelledBy,
    dgEmptyState, dgFormulaProps,
  ]);
}
