import type * as React from 'react';
import { useMemo, useState, useRef } from 'react';

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
import { useOGridDataGridProps } from './useOGridDataGridProps';
import { useSortFilterColumns } from './useSortFilterColumns';
import {
  buildStatusBarConfig,
  isFullyVirtualized,
  resolveColumnChooserPlacement,
  resolveDefaultSortField,
  resolveSelectionKnownItems,
  resolveSpreadsheetChrome,
} from './ogridDerivations';
import type { IOGridProps, IOGridApi } from '../types';
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
    entityLabelPlural = 'items', statusBar, pageSizeOptions, virtualScroll, activeSheet,
  } = props;

  // Inline consumer callbacks are stabilized so they don't cause cascading re-renders.
  const callbacks = useOGridCallbacks(props);
  const { getRowId, editVersionRef, onColumnOrderChange } = callbacks;

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
  const sortingState = useOGridSorting({
    controlledSort, defaultSortField, defaultSortDirection, columns,
    onSortChange: props.onSortChange, setPage: paginationState.setPage,
  });
  const filtersState = useOGridFilters({
    controlledFilters, onFiltersChange: props.onFiltersChange,
    setPage: paginationState.setPage,
    columns: sortFilterColumns, displayData, dataSource, dataSourceKey,
  });
  const dataFetchingState = useOGridDataFetching({
    isServerSide, dataSource, dataSourceKey, displayData, getRowId, editVersionRef, columns: sortFilterColumns,
    stableFilters: filtersState.stableFilters,
    sort: sortingState.sort,
    sortVersion: sortingState.sortVersion,
    page: paginationState.page,
    pageSize: paginationState.pageSize,
    paginate: !fullyVirtualized,
    onError: props.onError, onFirstDataRendered: props.onFirstDataRendered,
    workerSort: props.workerSort,
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
  const columnLayout = useOGridColumnLayout({
    columnsProp,
    controlledColumnOrder: columnOrder,
    onColumnOrderChange,
    onColumnResized: props.onColumnResized,
    onColumnPinned: props.onColumnPinned,
  });

  // --- Per-sheet UI state (captured on leave, restored on return) ---
  useOGridSheetState({
    activeSheet,
    current: {
      visibleColumns,
      sort: sortingState.sort,
      filters: filtersState.filters,
      page: paginationState.page,
      selectedRows: selection.effectiveSelectedRows,
      columnOrder: columnLayout.effectiveColumnOrder,
      columnWidths: columnLayout.columnWidthOverrides,
      pinned: columnLayout.pinnedOverrides,
    },
    defaultSortField,
    defaultSortDirection,
    controlled: {
      visibleColumns: controlledVisibleColumns !== undefined,
      sort: controlledSort !== undefined,
      filters: controlledFilters !== undefined,
      page: controlledPage !== undefined,
      selectedRows: selectedRows !== undefined,
      columnOrder: columnOrder !== undefined,
    },
    setters: {
      setVisibleColumns: visibility.setInternalVisibleColumns,
      setSort: sortingState.setInternalSort,
      setFilters: filtersState.setInternalFilters,
      setPage: paginationState.setInternalPage,
      setSelectedRows: selection.setInternalSelectedRows,
      setColumnOrder: columnLayout.setInternalColumnOrder,
      setColumnWidths: columnLayout.setColumnWidthOverrides,
      setPinned: columnLayout.setPinnedOverrides,
    },
  });

  useOGridPageClamp({
    page: paginationState.page,
    pageSize: paginationState.pageSize,
    totalCount: displayTotalCount,
    controlled: controlledPage !== undefined,
    unpaged: fullyVirtualized || isWindowed,
  }, paginationState.setPage);

  // --- Imperative handle (stabilized via refs to avoid invalidation on every state change) ---
  const scrollToRowRef = useRef<IOGridApi<T>['scrollToRow'] | null>(null);
  useOGridImperativeHandle({
    ref, isServerSide, columnOrder, onColumnOrderChange,
    commitSelection: selection.commitSelection,
    sortingState, filtersState, dataFetchingState, setVisibleColumns,
    setInternalColumnOrder: columnLayout.setInternalColumnOrder,
    setColumnWidthOverrides: columnLayout.setColumnWidthOverrides,
    setPinnedOverrides: columnLayout.setPinnedOverrides,
    setInternalData, setInternalLoading, visibleColumns,
    effectiveColumnOrder: columnLayout.effectiveColumnOrder,
    columnWidthOverrides: columnLayout.columnWidthOverrides,
    pinnedOverrides: columnLayout.pinnedOverrides,
    effectiveSelectedRows: selection.effectiveSelectedRows,
    columns, getRowId, scrollToRowRef,
  });

  // --- Status bar ---
  const selectedCount = selection.effectiveSelectedRows.size;
  const statusBarConfig = useMemo(
    () => buildStatusBarConfig(statusBar, {
      isServerSide, dataLength: displayData.length, totalCount: displayTotalCount,
      hasActiveFilters: filtersState.hasActiveFilters, selectedCount,
    }),
    [statusBar, isServerSide, displayData.length, displayTotalCount, filtersState.hasActiveFilters, selectedCount]
  );

  const { sideBarProps, columnChooserColumns } = useOGridSideBar({
    sideBar: props.sideBar, columns, visibleColumns,
    onVisibilityChange: handleVisibilityChange, onSetVisibleColumns: setVisibleColumns,
    filters: filtersState.filters, onFilterChange: filtersState.handleFilterChange,
    filterOptions: filtersState.clientFilterOptions,
  });

  // --- Sheet coordinates and formulas ---
  const chrome = resolveSpreadsheetChrome(props);
  const { sheetItems, formulaRowMap } = useOGridSheetCoordinates({
    spreadsheetMode: chrome.spreadsheetMode, isServerSide, displayData, displayItems, windowed,
    page: paginationState.page, pageSize: paginationState.pageSize, getRowId,
  });
  const { dgFormulaProps, formulaBarEl, activeCellRef, onActiveCellChange } = useOGridFormulas({
    formulas: props.formulas, initialFormulas: props.initialFormulas, onFormulaRecalc: props.onFormulaRecalc,
    formulaFunctions: props.formulaFunctions, namedRanges: props.namedRanges, formulaLimits: props.formulaLimits,
    sheets: props.sheets, sheetItems, columns, formulaRowMap, hasHostUndo: callbacks.hasHostUndo,
  });

  // --- Assembly ---
  const dataGridProps = useOGridDataGridProps({
    props, scrollToRowRef, callbacks, dataFetching: dataFetchingState, sorting: sortingState,
    filters: filtersState, visibleColumns, columnLayout, selection, chrome, onActiveCellChange, isWindowed,
    page: paginationState.page, pageSize: paginationState.pageSize, statusBarConfig,
    isLoading: (isServerSide && dataFetchingState.serverLoading) || dataFetchingState.workerPending || displayLoading,
    formulaProps: dgFormulaProps,
  });

  const pagination = useMemo<UseOGridPagination>(() => ({
    page: paginationState.page,
    pageSize: paginationState.pageSize,
    displayTotalCount,
    setPage: paginationState.setPage,
    setPageSize: paginationState.setPageSize,
    pageSizeOptions,
    entityLabelPlural,
    hidden: fullyVirtualized || isWindowed,
  }), [paginationState.page, paginationState.pageSize, displayTotalCount, paginationState.setPage, paginationState.setPageSize, pageSizeOptions, entityLabelPlural, fullyVirtualized, isWindowed]);

  const columnChooser = useMemo<UseOGridColumnChooser>(() => ({
    columns: columnChooserColumns,
    visibleColumns,
    onVisibilityChange: handleVisibilityChange,
    onSetVisibleColumns: setVisibleColumns,
    placement: columnChooserPlacement,
  }), [columnChooserColumns, visibleColumns, handleVisibilityChange, setVisibleColumns, columnChooserPlacement]);

  const layout = useOGridChrome({
    toolbar: props.toolbar, toolbarBelow: props.toolbarBelow, className: props.className,
    emptyState: props.emptyState, fullScreen: props.fullScreen, sheetDefs: props.sheetDefs, activeSheet,
    onSheetChange: props.onSheetChange, onSheetAdd: props.onSheetAdd,
    showNameBox: chrome.showNameBox, activeCellRef, sideBarProps, formulaBar: formulaBarEl,
  });

  const filtersResult = useMemo<UseOGridFilters>(() => ({
    hasActiveFilters: filtersState.hasActiveFilters,
    setFilters: filtersState.setFilters,
  }), [filtersState.hasActiveFilters, filtersState.setFilters]);

  return { dataGridProps, pagination, columnChooser, layout, filters: filtersResult };
}
