import type * as React from 'react';
import { useMemo, useCallback, useState, useRef } from 'react';

import { flattenColumns } from '../utils';
import { useOGridPagination } from './useOGridPagination';
import { useOGridSorting } from './useOGridSorting';
import { useOGridFilters } from './useOGridFilters';
import { useOGridDataFetching } from './useOGridDataFetching';
import { useOGridColumnVisibility } from './useOGridColumnVisibility';
import { useOGridColumnLayout } from './useOGridColumnLayout';
import { useOGridRowSelection } from './useOGridRowSelection';
import { useOGridImperativeHandle } from './useOGridImperativeHandle';
import { useOGridCallbacks } from './useOGridCallbacks';
import { useColumnValidation, useRowIdValidation } from './useOGridValidation';
import { useOGridSheetState } from './useOGridSheetState';
import { useOGridPageClamp } from './useOGridPageClamp';
import { useOGridSideBar } from './useOGridSideBar';
import { useOGridSheetCoordinates } from './useOGridSheetCoordinates';
import { useOGridFormulas } from './useOGridFormulas';
import { useOGridChrome } from './useOGridChrome';
import { useSortFilterColumns } from './useSortFilterColumns';
import {
  buildStatusBarConfig,
  isFullyVirtualized,
  resolveColumnChooserPlacement,
  resolveDefaultSortField,
  resolvePageClampTarget,
  resolveSelectionKnownItems,
  resolveSpreadsheetChrome,
} from './ogridDerivations';
import type { IOGridProps, IOGridDataGridProps, IOGridApi } from '../types';
import type { UseOGridColumnChooser, UseOGridFilters, UseOGridPagination, UseOGridResult } from './useOGrid.types';

export type {
  ColumnChooserPlacement,
  UseOGridPagination,
  UseOGridColumnChooser,
  UseOGridLayout,
  UseOGridFilters,
  UseOGridResult,
} from './useOGrid.types';

const DEFAULT_PAGE_SIZE = 25;
const EMPTY_LOADING_OPTIONS: Record<string, boolean> = {};

/**
 * Top-level orchestration hook for OGrid: manages pagination, sorting, filtering, column visibility, and sidebar.
 * Delegates to focused sub-hooks for each concern.
 * @param props - All OGrid props (columns, data, callbacks, feature flags).
 * @param ref - Forwarded ref for imperative API (refresh, export, applyColumnState).
 * @returns Grouped props for DataGridTable, pagination controls, column chooser, layout, and filters.
 */
export function useOGrid<T>(
  props: IOGridProps<T>,
  ref: React.Ref<IOGridApi<T>>
): UseOGridResult<T> {
  const {
    columns: columnsProp, data, dataSource, dataSourceKey,
    page: controlledPage, pageSize: controlledPageSize, sort: controlledSort, filters: controlledFilters,
    visibleColumns: controlledVisibleColumns, isLoading: controlledLoading, selectedRows, columnOrder,
    defaultPageSize = DEFAULT_PAGE_SIZE, defaultSortBy, defaultSortDirection = 'asc',
    emptyState, entityLabelPlural = 'items', layoutMode = 'fill', suppressHorizontalScroll,
    editable, cellSelection, canUndo, canRedo, rowSelection = 'none', statusBar, pageSizeOptions,
    stickyHeader, columnReorder, responsiveColumns, virtualScroll, rowHeight, density = 'normal',
    mergedCells, frozenRows,
    'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy,
  } = props;

  // Inline consumer callbacks are stabilized so they don't cause cascading re-renders.
  const { getRowId, editVersionRef, onColumnOrderChange, onCellValueChanged, onUndo, onRedo, onClipboardError } =
    useOGridCallbacks(props);

  // --- Derived column state ---
  const columnChooserPlacement = resolveColumnChooserPlacement(props.columnChooser);
  const columns = useMemo(() => flattenColumns(columnsProp), [columnsProp]);
  // Same rows-affecting fields as `columns`, but stable across inline `columns` props.
  const sortFilterColumns = useSortFilterColumns(columns);
  const isServerSide = dataSource != null;
  const fullyVirtualized = isFullyVirtualized(isServerSide, virtualScroll);
  useColumnValidation(columns);
  const defaultSortField = resolveDefaultSortField(defaultSortBy, columns);

  // --- Internal data state (for imperative setRowData/setLoading API) ---
  const [internalData, setInternalData] = useState<T[]>([]);
  const [internalLoading, setInternalLoading] = useState(false);
  const displayData = data ?? internalData;
  const displayLoading = controlledLoading ?? internalLoading;

  // --- Sub-hooks ---
  const paginationState = useOGridPagination({
    controlledPage, controlledPageSize, defaultPageSize,
    onPageChange: props.onPageChange, onPageSizeChange: props.onPageSizeChange,
  });
  const { page, pageSize, setPage } = paginationState;
  const sortingState = useOGridSorting({
    controlledSort, defaultSortField, defaultSortDirection, columns, onSortChange: props.onSortChange, setPage,
  });
  const filtersState = useOGridFilters({
    controlledFilters, onFiltersChange: props.onFiltersChange, setPage,
    columns: sortFilterColumns, displayData, dataSource, dataSourceKey,
  });
  const dataFetchingState = useOGridDataFetching({
    isServerSide, dataSource, dataSourceKey, displayData, getRowId, editVersionRef, columns: sortFilterColumns,
    stableFilters: filtersState.stableFilters, sort: sortingState.sort, sortVersion: sortingState.sortVersion,
    page, pageSize, paginate: !fullyVirtualized,
    onError: props.onError, onFirstDataRendered: props.onFirstDataRendered, workerSort: props.workerSort,
  });
  const { displayItems, windowed, displayTotalCount } = dataFetchingState;
  // A windowed (lazy) source virtual-scrolls all rows: no pages, no pager.
  const isWindowed = windowed != null;
  useRowIdValidation(displayItems, getRowId);

  const visibility = useOGridColumnVisibility({
    columns, controlledVisibleColumns, onVisibleColumnsChange: props.onVisibleColumnsChange,
  });
  const { visibleColumns, setVisibleColumns, handleVisibilityChange } = visibility;
  const selection = useOGridRowSelection({
    controlledSelectedRows: selectedRows,
    onSelectionChange: props.onSelectionChange,
    getRowId,
    knownItems: resolveSelectionKnownItems(isServerSide, windowed?.loadedRows, displayItems, displayData),
  });
  const { effectiveSelectedRows, handleSelectionChange } = selection;
  const columnLayout = useOGridColumnLayout({
    columnsProp, controlledColumnOrder: columnOrder, onColumnOrderChange,
    onColumnResized: props.onColumnResized, onColumnPinned: props.onColumnPinned,
  });
  const {
    effectiveColumnOrder, columnWidthOverrides, pinnedOverrides,
    handleColumnOrderChange, handleColumnResized, handleColumnPinned,
  } = columnLayout;

  // --- Per-sheet UI state (captured on leave, restored on return) ---
  useOGridSheetState(props, {
    visibleColumns, sort: sortingState.sort, filters: filtersState.filters, page,
    selectedRows: effectiveSelectedRows, columnOrder: effectiveColumnOrder,
    columnWidths: columnWidthOverrides, pinned: pinnedOverrides,
  }, defaultSortField, defaultSortDirection, {
    visibility, sorting: sortingState, filters: filtersState, pagination: paginationState, selection, columnLayout,
  });

  useOGridPageClamp(
    resolvePageClampTarget(page, pageSize, displayTotalCount, controlledPage !== undefined, fullyVirtualized || isWindowed),
    setPage,
  );

  // --- Imperative handle (stabilized via refs to avoid invalidation on every state change) ---
  const scrollToRowRef = useRef<IOGridApi<T>['scrollToRow'] | null>(null);
  useOGridImperativeHandle({
    ref, isServerSide, columnOrder, onColumnOrderChange, commitSelection: selection.commitSelection,
    sortingState, filtersState, dataFetchingState, setVisibleColumns,
    setInternalColumnOrder: columnLayout.setInternalColumnOrder,
    setColumnWidthOverrides: columnLayout.setColumnWidthOverrides,
    setPinnedOverrides: columnLayout.setPinnedOverrides,
    setInternalData, setInternalLoading, visibleColumns, effectiveColumnOrder, columnWidthOverrides,
    pinnedOverrides, effectiveSelectedRows, columns, getRowId, scrollToRowRef,
  });

  // --- Status bar, side bar ---
  const selectedCount = effectiveSelectedRows.size;
  const statusBarConfig = useMemo(
    () => buildStatusBarConfig(statusBar, isServerSide, displayData.length, displayTotalCount, filtersState.hasActiveFilters, selectedCount),
    [statusBar, isServerSide, displayData.length, displayTotalCount, filtersState.hasActiveFilters, selectedCount]
  );
  const { sideBarProps, columnChooserColumns } = useOGridSideBar(props.sideBar, columns, visibility, filtersState);

  // --- Sheet coordinates and formulas ---
  const chrome = resolveSpreadsheetChrome(props);
  const { showRowNumbers: showRowNumbersResolved, showColumnLetters: showColumnLettersResolved, showNameBox } = chrome;
  const showActiveCellChange = chrome.reportActiveCell;
  const { sheetItems, formulaRowMap } = useOGridSheetCoordinates(
    chrome.spreadsheetMode, isServerSide, displayData, dataFetchingState, paginationState, getRowId,
  );
  const { dgFormulaProps, formulaBarEl, activeCellRef, onActiveCellChange } = useOGridFormulas(props, sheetItems, columns, formulaRowMap);

  // --- Assembly ---
  // dataGridProps is split into focused sub-memos so that changes in one
  // concern (e.g. sorting) don't invalidate memos for unrelated concerns.
  const { setFilters } = filtersState;
  const clearAllFilters = useCallback(() => setFilters({}), [setFilters]);
  const isLoadingResolved = (isServerSide && dataFetchingState.serverLoading) || dataFetchingState.workerPending || displayLoading;

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

  const dataGridProps = useMemo<IOGridDataGridProps<T>>(() => ({
    scrollToRowRef, items: displayItems, windowed, columns: columnsProp, getRowId,
    sortBy: sortingState.sort.field, sortDirection: sortingState.sort.direction, onColumnSort: sortingState.handleSort,
    visibleColumns, columnOrder: effectiveColumnOrder, onColumnOrderChange: handleColumnOrderChange,
    onColumnResized: handleColumnResized, onColumnPinned: handleColumnPinned,
    pinnedColumns: pinnedOverrides, initialColumnWidths: columnWidthOverrides,
    editable, cellSelection, onCellValueChanged, onUndo, onRedo, canUndo, canRedo, onClipboardError,
    rowSelection, selectedRows: effectiveSelectedRows, onSelectionChange: handleSelectionChange,
    showRowNumbers: showRowNumbersResolved, showColumnLetters: showColumnLettersResolved, showNameBox,
    onActiveCellChange: showActiveCellChange ? onActiveCellChange : undefined,
    // A windowed source scrolls every row in one viewport: no page offset.
    currentPage: isWindowed ? 1 : page, pageSize, totalCount: displayTotalCount,
    statusBar: statusBarConfig, isLoading: isLoadingResolved,
    ...dgFilterProps,
    layoutMode, suppressHorizontalScroll, stickyHeader: stickyHeader ?? true, columnReorder, responsiveColumns,
    virtualScroll, rowHeight, density, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy,
    mergedCells, frozenRows,
    emptyState: dgEmptyState,
    ...dgFormulaProps,
  }), [
    displayItems, windowed, columnsProp, getRowId,
    sortingState.sort.field, sortingState.sort.direction, sortingState.handleSort,
    visibleColumns, effectiveColumnOrder, handleColumnOrderChange, handleColumnResized,
    handleColumnPinned, pinnedOverrides, columnWidthOverrides,
    editable, cellSelection, onCellValueChanged, onUndo, onRedo, canUndo, canRedo, onClipboardError,
    rowSelection, effectiveSelectedRows, handleSelectionChange,
    showRowNumbersResolved, showColumnLettersResolved, showNameBox, showActiveCellChange, onActiveCellChange,
    isWindowed, page, pageSize, displayTotalCount, statusBarConfig,
    isLoadingResolved, dgFilterProps,
    layoutMode, suppressHorizontalScroll, stickyHeader, columnReorder, responsiveColumns, virtualScroll,
    rowHeight, density, ariaLabel, ariaLabelledBy, mergedCells, frozenRows,
    dgEmptyState, dgFormulaProps,
  ]);

  const pagination = useMemo<UseOGridPagination>(() => ({
    page, pageSize, displayTotalCount, setPage, setPageSize: paginationState.setPageSize,
    pageSizeOptions, entityLabelPlural, hidden: fullyVirtualized || isWindowed,
  }), [page, pageSize, displayTotalCount, setPage, paginationState.setPageSize, pageSizeOptions, entityLabelPlural, fullyVirtualized, isWindowed]);

  const columnChooser = useMemo<UseOGridColumnChooser>(() => ({
    columns: columnChooserColumns,
    visibleColumns,
    onVisibilityChange: handleVisibilityChange,
    onSetVisibleColumns: setVisibleColumns,
    placement: columnChooserPlacement,
  }), [columnChooserColumns, visibleColumns, handleVisibilityChange, setVisibleColumns, columnChooserPlacement]);

  const layout = useOGridChrome(props, showNameBox, activeCellRef, sideBarProps, formulaBarEl);

  const filtersResult = useMemo<UseOGridFilters>(() => ({
    hasActiveFilters: filtersState.hasActiveFilters,
    setFilters: filtersState.setFilters,
  }), [filtersState.hasActiveFilters, filtersState.setFilters]);

  return { dataGridProps, pagination, columnChooser, layout, filters: filtersResult };
}
