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
import { useOGridCallbacks, useStableOptionalCallback } from './useOGridCallbacks';
import { useColumnValidation, useRowIdValidation } from './useOGridValidation';
import { useOGridSheetState } from './useOGridSheetState';
import { useOGridPageClamp } from './useOGridPageClamp';
import { useOGridSideBar } from './useOGridSideBar';
import { useOGridSheetCoordinates } from './useOGridSheetCoordinates';
import { useOGridFormulas } from './useOGridFormulas';
import { useConditionalFormatting } from './useConditionalFormatting';
import { useOGridChrome } from './useOGridChrome';
import { useOGridStructureEdits } from './useOGridStructureEdits';
import { useOGridCellApi } from './useOGridCellApi';
import { useOGridNameBox } from './useOGridNameBox';
import { useOGridHiddenRows } from './useOGridHiddenRows';
import { useLatestRef } from './useLatestRef';
import { useOGridCellNotes } from './useOGridCellNotes';
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
import type { IOGridProps, IOGridDataGridProps, IOGridApi, IGridEditBridge, IGridHidingActions } from '../types';
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
    mergedCells, frozenRows, findReplace,
    'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy,
    rowResize, rowHeights,
  } = props;
  const onRowResized = useStableOptionalCallback(props.onRowResized);

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
  const hiddenRows = useOGridHiddenRows({
    controlledHiddenRowIds: props.hiddenRowIds,
    defaultHiddenRowIds: props.defaultHiddenRowIds,
    onHiddenRowIdsChange: props.onHiddenRowIdsChange,
  });
  const structureVersionRef = useRef(0);
  const dataFetchingState = useOGridDataFetching({
    isServerSide, dataSource, dataSourceKey, displayData, getRowId, editVersionRef, structureVersionRef, columns: sortFilterColumns,
    stableFilters: filtersState.stableFilters, sort: sortingState.sort, sortVersion: sortingState.sortVersion,
    page, pageSize, paginate: !fullyVirtualized,
    onError: props.onError, onFirstDataRendered: props.onFirstDataRendered, workerSort: props.workerSort,
    hiddenRowIds: hiddenRows.hiddenRowSet,
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
    columnWidths: columnWidthOverrides, pinned: pinnedOverrides, hiddenRowIds: hiddenRows.hiddenRowIds,
  }, defaultSortField, defaultSortDirection, {
    visibility, sorting: sortingState, filters: filtersState, pagination: paginationState, selection, columnLayout, hiddenRows,
  });

  // --- Hide/unhide from the menus and gap markers (allowHiding) ---
  const { allowHiding } = props;
  const visibleColumnsRef = useLatestRef(visibleColumns);
  const { hideRows, unhideRows } = hiddenRows;
  const { hiddenRowGaps } = dataFetchingState;
  const hidingActions = useMemo<IGridHidingActions | undefined>(() => {
    if (!allowHiding) return undefined;
    return {
      hideColumns: (columnIds) => {
        const drop = new Set(columnIds);
        const next = new Set([...visibleColumnsRef.current].filter((id) => !drop.has(id)));
        // Like Excel, the last visible column can't be hidden.
        if (next.size > 0 && next.size !== visibleColumnsRef.current.size) setVisibleColumns(next);
      },
      unhideColumns: (columnIds) => {
        const next = new Set(visibleColumnsRef.current);
        for (const id of columnIds) next.add(id);
        if (next.size !== visibleColumnsRef.current.size) setVisibleColumns(next);
      },
      // A windowed source streams rows by index, so it can't leave rows out.
      ...(isWindowed ? {} : { hideRows, unhideRows, hiddenRowGaps: hiddenRowGaps ?? undefined }),
    };
  }, [allowHiding, visibleColumnsRef, setVisibleColumns, isWindowed, hideRows, unhideRows, hiddenRowGaps]);

  useOGridPageClamp(
    resolvePageClampTarget(page, pageSize, displayTotalCount, controlledPage !== undefined, fullyVirtualized || isWindowed),
    setPage,
  );

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
  const nameBox = useOGridNameBox(props.namedRanges);
  const { hiddenRowSet } = hiddenRows;
  const isSheetRowHidden = useMemo(() => {
    if (!hiddenRowSet || !props.formulas) return undefined;
    return (row: number) => {
      const item = sheetItems[row];
      return item !== undefined && hiddenRowSet.has(getRowId(item));
    };
  }, [hiddenRowSet, props.formulas, sheetItems, getRowId]);
  const { dgFormulaProps, formulaBarEl, activeCellRef, onActiveCellChange, formulaEngine, formulasFollowData } =
    useOGridFormulas(props, sheetItems, columns, formulaRowMap, nameBox, isSheetRowHidden);
  // Stats cover hidden rows too (Excel semantics); hidden rows are simply not painted.
  const conditionalFormat = useConditionalFormatting({
    rules: props.conditionalFormats, items: sheetItems, columns, formulaEngine, formulaVersion: dgFormulaProps.formulaVersion,
  });

  // --- Cell API and structure edits (through the table's edit path and undo history) ---
  const gridEditBridgeRef = useRef<IGridEditBridge<T> | null>(null);
  const cellApi = useOGridCellApi({ sheetItems, columns, getRowId, formulaEngine, bridgeRef: gridEditBridgeRef });
  const structure = useOGridStructureEdits({
    props, isServerSide, displayData, setInternalData, getRowId, editVersionRef, structureVersionRef,
    columnOrder, effectiveColumnOrder, setInternalColumnOrder: columnLayout.setInternalColumnOrder, onColumnOrderChange,
    formulaEngine, formulasFollowData, bridgeRef: gridEditBridgeRef,
  });
  const { structureActions } = structure;
  const dgNoteProps = useOGridCellNotes(props);

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
    editApi: {
      getCellValue: cellApi.getCellValue, setCellValue: cellApi.setCellValue,
      insertRows: structure.insertRows, deleteRows: structure.deleteRows,
      insertColumn: structure.insertColumn, deleteColumn: structure.deleteColumn,
    },
  });

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

  // Find & Replace searches every filtered row; a paginated client-side grid
  // only displays one page, so it gets the full list and a page setter. With
  // formulas the search stays on the displayed rows (formula cells are
  // addressed through the displayed-row map).
  const findRows = findReplace && !isServerSide && !isWindowed && !fullyVirtualized && pageSize !== 'all' && !props.formulas
    ? dataFetchingState.allFilteredItems
    : undefined;

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
    mergedCells, frozenRows, conditionalFormat,
    rowResize, rowHeights, onRowResized, structureActions, gridEditBridgeRef, hidingActions,
    findReplace, findRows, onFindPageChange: findRows ? setPage : undefined,
    cellNavigatorRef: nameBox.cellNavigatorRef,
    ...dgNoteProps,
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
    rowHeight, density, ariaLabel, ariaLabelledBy, mergedCells, frozenRows, conditionalFormat,
    rowResize, rowHeights, onRowResized, structureActions, hidingActions, dgNoteProps,
    findReplace, findRows, setPage,
    nameBox.cellNavigatorRef, dgEmptyState, dgFormulaProps,
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

  const layout = useOGridChrome(props, showNameBox, activeCellRef, sideBarProps, formulaBarEl, nameBox);

  const filtersResult = useMemo<UseOGridFilters>(() => ({
    hasActiveFilters: filtersState.hasActiveFilters,
    setFilters: filtersState.setFilters,
  }), [filtersState.hasActiveFilters, filtersState.setFilters]);

  return { dataGridProps, pagination, columnChooser, layout, filters: filtersResult };
}
