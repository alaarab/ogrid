import * as React from 'react';
import {
  useMemo,
  useCallback,
  useState,
  useEffect,
  useRef,
} from 'react';

import { flattenColumns, getCellValue } from '../utils';
import { validateColumns, validateRowIds } from '@alaarab/ogrid-core';
import { useFormulaEngine } from './useFormulaEngine';
import { useFormulaBar } from './useFormulaBar';
import { FormulaBar } from '../components/FormulaBar';
import { SheetTabs } from '../components/SheetTabs';
import { useOGridPagination } from './useOGridPagination';
import { useOGridSorting } from './useOGridSorting';
import { useOGridFilters } from './useOGridFilters';
import { useOGridDataFetching } from './useOGridDataFetching';
import { useOGridColumnVisibility } from './useOGridColumnVisibility';
import { useOGridColumnLayout } from './useOGridColumnLayout';
import { useOGridRowSelection } from './useOGridRowSelection';
import { useOGridActiveCell } from './useOGridActiveCell';
import { useOGridImperativeHandle } from './useOGridImperativeHandle';
import { useLatestRef } from './useLatestRef';
import { useSideBarState } from './useSideBarState';
import type { SideBarProps } from '../components/SideBar';
import type {
  IOGridProps,
  IOGridDataGridProps,
  IOGridApi,
  IStatusBarProps,
  IColumnDefinition,
} from '../types';

const DEFAULT_PAGE_SIZE = 25;
const EMPTY_LOADING_OPTIONS: Record<string, boolean> = {};

/** Inline style for the name box (active cell reference display). */
const NAME_BOX_STYLE: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: '12px',
  fontWeight: 500,
  padding: '2px 8px',
  border: '1px solid var(--ogrid-border, #e0e0e0)',
  borderRadius: 3,
  background: 'var(--ogrid-bg, #fff)',
  color: 'var(--ogrid-fg, #242424)',
  minWidth: 48,
  textAlign: 'center',
  lineHeight: '20px',
  userSelect: 'none',
};

/** Resolved column chooser placement. */
export type ColumnChooserPlacement = 'toolbar' | 'sidebar' | 'external' | 'none';

/** Pagination state and handlers. */
export interface UseOGridPagination {
  page: number;
  pageSize: number;
  displayTotalCount: number;
  setPage: (p: number) => void;
  setPageSize: (size: number) => void;
  pageSizeOptions?: number[];
  entityLabelPlural: string;
  /**
   * True when pagination is bypassed (full-dataset virtualization mode —
   * `virtualScroll.paginate === false`). The UI layer should not render
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
  setFilters: (f: import('../types').IFilters) => void;
}

export interface UseOGridResult<T> {
  dataGridProps: IOGridDataGridProps<T>;
  pagination: UseOGridPagination;
  columnChooser: UseOGridColumnChooser;
  layout: UseOGridLayout;
  filters: UseOGridFilters;
}

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
    columns: columnsProp,
    getRowId: getRowIdProp,
    data,
    dataSource,
    page: controlledPage,
    pageSize: controlledPageSize,
    sort: controlledSort,
    filters: controlledFilters,
    visibleColumns: controlledVisibleColumns,
    isLoading: controlledLoading,
    onPageChange,
    onPageSizeChange,
    onSortChange,
    onFiltersChange,
    onVisibleColumnsChange,
    columnOrder,
    onColumnOrderChange: onColumnOrderChangeProp,
    onColumnResized,
    onColumnPinned,
    defaultPageSize = DEFAULT_PAGE_SIZE,
    defaultSortBy,
    defaultSortDirection = 'asc',
    toolbar,
    toolbarBelow,
    emptyState,
    entityLabelPlural = 'items',
    className,
    layoutMode = 'fill',
    suppressHorizontalScroll,
    editable,
    cellSelection,
    onCellValueChanged: onCellValueChangedProp,
    onUndo: onUndoProp,
    onRedo: onRedoProp,
    canUndo,
    canRedo,
    rowSelection = 'none',
    selectedRows,
    onSelectionChange,
    showRowNumbers,
    cellReferences,
    statusBar,
    pageSizeOptions,
    sideBar,
    stickyHeader,
    fullScreen,
    onFirstDataRendered,
    onError,
    columnChooser: columnChooserProp,
    columnReorder,
    responsiveColumns,
    virtualScroll,
    rowHeight,
    density = 'normal',
    workerSort,
    formulas,
    initialFormulas,
    onFormulaRecalc,
    formulaFunctions,
    namedRanges,
    sheets,
    sheetDefs,
    activeSheet,
    onSheetChange,
    onSheetAdd,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
  } = props;

  // Stabilize consumer callbacks so inline functions don't cause cascading re-renders.
  // AG Grid does this internally  -  we need to match that resilience.
  const getRowIdStableRef = useLatestRef(getRowIdProp);
  const getRowId = useCallback((item: T) => getRowIdStableRef.current(item), [getRowIdStableRef]) as typeof getRowIdProp;
  const onColumnOrderChangeRef = useLatestRef(onColumnOrderChangeProp);
  const hasColumnOrderChange = onColumnOrderChangeProp != null;
  const onColumnOrderChange = useMemo(
    () => hasColumnOrderChange ? (order: string[]) => onColumnOrderChangeRef.current?.(order) : undefined,
    [hasColumnOrderChange, onColumnOrderChangeRef]
  );
  const onCellValueChangedRef = useLatestRef(onCellValueChangedProp);
  const hasCellValueChanged = onCellValueChangedProp != null;
  const onCellValueChanged = useMemo(
    () => hasCellValueChanged ? (event: import('../types').ICellValueChangedEvent<T>) => onCellValueChangedRef.current?.(event) : undefined,
    [hasCellValueChanged, onCellValueChangedRef]
  );
  const onUndoRef = useLatestRef(onUndoProp);
  const hasUndo = onUndoProp != null;
  const onUndo = useMemo(
    () => hasUndo ? () => onUndoRef.current?.() : undefined,
    [hasUndo, onUndoRef]
  );
  const onRedoRef = useLatestRef(onRedoProp);
  const hasRedo = onRedoProp != null;
  const onRedo = useMemo(
    () => hasRedo ? () => onRedoRef.current?.() : undefined,
    [hasRedo, onRedoRef]
  );

  // --- Derived column state ---
  const columnChooserPlacement: ColumnChooserPlacement =
    columnChooserProp === false ? 'none'
    : columnChooserProp === 'sidebar' ? 'sidebar'
    : columnChooserProp === 'external' ? 'external'
    : 'toolbar';

  const columns = useMemo(() => flattenColumns(columnsProp), [columnsProp]);
  const isServerSide = dataSource != null;

  // Full-dataset virtualization: when `virtualScroll.enabled` and the consumer
  // opts out of paging (`virtualScroll.paginate === false`) on a client-side
  // grid, the grid virtual-scrolls the entire dataset in one viewport instead
  // of one page at a time. Pagination is bypassed and its controls are hidden.
  // Server-side grids always page through the `dataSource`, so the flag is
  // ignored there.
  const fullyVirtualized =
    !isServerSide && virtualScroll?.enabled === true && virtualScroll?.paginate === false;

  // --- Runtime validation (dev-only, runs once on mount) ---
  const rowIdsValidatedRef = useRef(false);
  useEffect(() => {
    validateColumns(columns as Parameters<typeof validateColumns>[0]);
  }, [columns]);
  const defaultSortField = defaultSortBy ?? columns[0]?.columnId ?? '';

  // --- Internal data state (for imperative setRowData/setLoading API) ---
  const [internalData, setInternalData] = useState<T[]>([]);
  const [internalLoading, setInternalLoading] = useState(false);
  const displayData = data ?? internalData;
  const displayLoading = controlledLoading ?? internalLoading;

  // --- Sub-hooks ---
  const paginationState = useOGridPagination({
    controlledPage, controlledPageSize, defaultPageSize,
    onPageChange, onPageSizeChange,
  });

  const sortingState = useOGridSorting({
    controlledSort, defaultSortField, defaultSortDirection,
    onSortChange, setPage: paginationState.setPage,
  });

  const filtersState = useOGridFilters({
    controlledFilters, onFiltersChange,
    setPage: paginationState.setPage,
    columns, displayData, dataSource,
  });

  const dataFetchingState = useOGridDataFetching({
    isServerSide, dataSource, displayData, columns,
    stableFilters: filtersState.stableFilters,
    sort: sortingState.sort,
    sortVersion: sortingState.sortVersion,
    page: paginationState.page,
    pageSize: paginationState.pageSize,
    paginate: !fullyVirtualized,
    onError, onFirstDataRendered,
    workerSort,
  });

  // Validate row IDs once on first data render
  useEffect(() => {
    const items = dataFetchingState.displayItems;
    if (!rowIdsValidatedRef.current && items.length > 0) {
      rowIdsValidatedRef.current = true;
      validateRowIds(items, getRowId as (item: T) => import('@alaarab/ogrid-core').RowId);
    }
  }, [dataFetchingState.displayItems, getRowId]);

  // --- Column visibility ---
  const {
    visibleColumns,
    setVisibleColumns,
    handleVisibilityChange,
  } = useOGridColumnVisibility({
    columns,
    controlledVisibleColumns,
    onVisibleColumnsChange,
  });

  // --- Row selection ---
  const {
    effectiveSelectedRows,
    handleSelectionChange,
    setInternalSelectedRows,
  } = useOGridRowSelection({
    controlledSelectedRows: selectedRows,
    onSelectionChange,
  });

  // --- Column layout (order / resize / pin) ---
  const {
    effectiveColumnOrder,
    columnWidthOverrides,
    pinnedOverrides,
    handleColumnResized,
    handleColumnPinned,
    setInternalColumnOrder,
    setColumnWidthOverrides,
    setPinnedOverrides,
  } = useOGridColumnLayout({
    columnsProp,
    controlledColumnOrder: columnOrder,
    onColumnResized,
    onColumnPinned,
  });

  // --- Imperative handle (stabilized via refs to avoid invalidation on every state change) ---
  useOGridImperativeHandle({
    ref,
    isServerSide,
    columnOrder,
    selectedRows,
    onColumnOrderChange,
    onSelectionChange,
    sortingState,
    filtersState,
    dataFetchingState,
    setVisibleColumns,
    setInternalColumnOrder,
    setColumnWidthOverrides,
    setPinnedOverrides,
    setInternalSelectedRows,
    setInternalData,
    setInternalLoading,
    visibleColumns,
    effectiveColumnOrder,
    columnWidthOverrides,
    pinnedOverrides,
    effectiveSelectedRows,
    columns,
    getRowId,
  });

  // --- Status bar ---
  const statusBarConfig = useMemo((): IStatusBarProps | undefined => {
    if (!statusBar) return undefined;
    if (typeof statusBar === 'object') return statusBar;
    const totalData = !isServerSide ? (data?.length ?? 0) : dataFetchingState.displayTotalCount;
    const filteredData = dataFetchingState.displayTotalCount;
    return {
      totalCount: totalData,
      filteredCount: filtersState.hasActiveFilters ? filteredData : undefined,
      selectedCount: effectiveSelectedRows.size,
      suppressRowCount: true,
    };
  }, [statusBar, isServerSide, data, dataFetchingState.displayTotalCount, filtersState.hasActiveFilters, effectiveSelectedRows.size]);

  // --- Side bar ---
  const sideBarState = useSideBarState({ config: sideBar });

  const columnChooserColumns: IColumnDefinition[] = useMemo(
    () => columns.map((c) => ({ columnId: c.columnId, name: c.name, required: c.required === true })),
    [columns]
  );

  const filterableColumns = useMemo(
    () =>
      columns
        .filter((c) => c.filterable?.type)
        .map((c) => ({
          columnId: c.columnId,
          name: c.name,
          filterField: c.filterable?.filterField ?? c.columnId,
          filterType: c.filterable?.type as 'text' | 'multiSelect' | 'people' | 'date',
        })),
    [columns]
  );

  const sideBarProps: SideBarProps | null = useMemo(() => {
    if (!sideBarState.isEnabled) return null;
    return {
      activePanel: sideBarState.activePanel,
      onPanelChange: sideBarState.setActivePanel,
      panels: sideBarState.panels,
      position: sideBarState.position,
      columns: columnChooserColumns,
      visibleColumns,
      onVisibilityChange: handleVisibilityChange,
      onSetVisibleColumns: setVisibleColumns,
      filterableColumns,
      filters: filtersState.filters,
      onFilterChange: filtersState.handleFilterChange,
      filterOptions: filtersState.clientFilterOptions,
    };
  }, [
    sideBarState.isEnabled, sideBarState.activePanel, sideBarState.setActivePanel,
    sideBarState.panels, sideBarState.position,
    columnChooserColumns, visibleColumns, handleVisibilityChange, setVisibleColumns,
    filterableColumns, filtersState.filters, filtersState.handleFilterChange, filtersState.clientFilterOptions,
  ]);

  // --- Formula engine (opt-in, tree-shakeable) ---
  const [formulaVersion, setFormulaVersion] = useState(0);
  const wrappedOnFormulaRecalc = useCallback((result: import('@alaarab/ogrid-core').IRecalcResult) => {
    setFormulaVersion(v => v + 1);
    onFormulaRecalc?.(result);
  }, [onFormulaRecalc]);
  const formulaEngine = useFormulaEngine({
    formulas,
    items: dataFetchingState.displayItems,
    flatColumns: columns,
    initialFormulas,
    onFormulaRecalc: wrappedOnFormulaRecalc,
    formulaFunctions,
    namedRanges,
    sheets,
  });

  // --- Assembly ---
  const clearAllFilters = useCallback(() => filtersState.setFilters({}), [filtersState]);
  const isLoadingResolved = (isServerSide && dataFetchingState.serverLoading) || displayLoading;
  const showRowNumbersResolved = showRowNumbers || cellReferences || formulas;
  const showColumnLettersResolved = !!(cellReferences || formulas);
  const showNameBox = !!cellReferences && !formulas; // formula bar has its own name box
  const showActiveCellChange = !!(cellReferences || formulas);

  // --- Name box / formula bar (active cell reference + coordinates) ---
  const { activeCellRef, activeCellCoords, onActiveCellChange } = useOGridActiveCell();

  // --- Formula bar hook (only when formulas are enabled) ---
  // Latest-value snapshots for the formula bar's raw-value lookup. The imperative
  // handle keeps its own internal snapshots, so these are scoped to getRawValue.
  const displayItemsRef = useLatestRef(dataFetchingState.displayItems);
  const columnsRef = useLatestRef(columns);
  const getRawValue = useCallback((col: number, row: number): unknown => {
    const items = displayItemsRef.current;
    const cols = columnsRef.current;
    const item = items[row];
    const colDef = cols[col];
    if (item === undefined || colDef === undefined) return undefined;
    return getCellValue(item, colDef);
  }, [displayItemsRef, columnsRef]);

  const formulaBarState = useFormulaBar({
    activeCol: activeCellCoords?.col ?? null,
    activeRow: activeCellCoords?.row ?? null,
    activeCellRef,
    getFormula: formulaEngine.enabled ? formulaEngine.getFormula : undefined,
    getRawValue,
    setFormula: formulaEngine.enabled ? formulaEngine.setFormula : undefined,
  });

  // Split dataGridProps into focused sub-memos so that changes in one concern
  // (e.g. sorting) don't invalidate memos for unrelated concerns (e.g. formulas).

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

  const dgFormulaProps = useMemo(() => ({
    formulas,
    getFormulaValue: formulaEngine.enabled ? formulaEngine.getFormulaValue : undefined,
    hasFormula: formulaEngine.enabled ? formulaEngine.hasFormula : undefined,
    getFormula: formulaEngine.enabled ? formulaEngine.getFormula : undefined,
    setFormula: formulaEngine.enabled ? formulaEngine.setFormula : undefined,
    onFormulaCellChanged: formulaEngine.enabled ? formulaEngine.onCellChanged : undefined,
    getPrecedents: formulaEngine.enabled ? formulaEngine.getPrecedents : undefined,
    getDependents: formulaEngine.enabled ? formulaEngine.getDependents : undefined,
    getAuditTrail: formulaEngine.enabled ? formulaEngine.getAuditTrail : undefined,
    formulaVersion,
    formulaReferences: formulaBarState.referencedCells.length > 0 ? formulaBarState.referencedCells : undefined,
    onFormulaInsertReference: formulaBarState.insertReference,
  }), [formulas, formulaEngine, formulaVersion, formulaBarState.referencedCells, formulaBarState.insertReference]);

  const dataGridProps = useMemo<IOGridDataGridProps<T>>(() => ({
    items: dataFetchingState.displayItems,
    windowed: dataFetchingState.windowed,
    columns: columnsProp,
    getRowId,
    sortBy: sortingState.sort.field,
    sortDirection: sortingState.sort.direction,
    onColumnSort: sortingState.handleSort,
    visibleColumns,
    columnOrder: effectiveColumnOrder,
    onColumnOrderChange,
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
    rowSelection,
    selectedRows: effectiveSelectedRows,
    onSelectionChange: handleSelectionChange,
    showRowNumbers: showRowNumbersResolved,
    showColumnLetters: showColumnLettersResolved,
    showNameBox,
    onActiveCellChange: showActiveCellChange ? onActiveCellChange : undefined,
    currentPage: paginationState.page,
    pageSize: paginationState.pageSize,
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
    dataFetchingState.displayItems, dataFetchingState.windowed, columnsProp, getRowId,
    sortingState.sort.field, sortingState.sort.direction, sortingState.handleSort,
    visibleColumns, effectiveColumnOrder, onColumnOrderChange, handleColumnResized,
    handleColumnPinned, pinnedOverrides, columnWidthOverrides,
    editable, cellSelection, onCellValueChanged, onUndo, onRedo, canUndo, canRedo,
    rowSelection, effectiveSelectedRows, handleSelectionChange,
    showRowNumbersResolved, showColumnLettersResolved, showNameBox, showActiveCellChange, onActiveCellChange,
    paginationState.page, paginationState.pageSize, statusBarConfig,
    isLoadingResolved, dgFilterProps,
    layoutMode, suppressHorizontalScroll, stickyHeader, columnReorder, responsiveColumns, virtualScroll,
    rowHeight, density, ariaLabel, ariaLabelledBy,
    dgEmptyState, dgFormulaProps,
  ]);

  const pagination = useMemo<UseOGridPagination>(() => ({
    page: paginationState.page,
    pageSize: paginationState.pageSize,
    displayTotalCount: dataFetchingState.displayTotalCount,
    setPage: paginationState.setPage,
    setPageSize: paginationState.setPageSize,
    pageSizeOptions,
    entityLabelPlural,
    hidden: fullyVirtualized,
  }), [paginationState.page, paginationState.pageSize, dataFetchingState.displayTotalCount, paginationState.setPage, paginationState.setPageSize, pageSizeOptions, entityLabelPlural, fullyVirtualized]);

  const columnChooser = useMemo<UseOGridColumnChooser>(() => ({
    columns: columnChooserColumns,
    visibleColumns,
    onVisibilityChange: handleVisibilityChange,
    onSetVisibleColumns: setVisibleColumns,
    placement: columnChooserPlacement,
  }), [columnChooserColumns, visibleColumns, handleVisibilityChange, setVisibleColumns, columnChooserPlacement]);

  const nameBoxEl = useMemo(() => showNameBox ? React.createElement('div', {
    style: NAME_BOX_STYLE,
    'aria-label': 'Active cell reference',
  }, activeCellRef ?? '\u2014') : null, [showNameBox, activeCellRef]);

  const resolvedToolbar = useMemo(() => showNameBox
    ? React.createElement(React.Fragment, null, nameBoxEl, toolbar)
    : toolbar, [showNameBox, nameBoxEl, toolbar]);

  // Formula bar element (only when formulas are enabled)
  const formulaBarEl = useMemo(() => {
    if (!formulas) return undefined;
    return React.createElement(FormulaBar, {
      cellRef: formulaBarState.cellRef,
      formulaText: formulaBarState.formulaText,
      isEditing: formulaBarState.isEditing,
      onInputChange: formulaBarState.onInputChange,
      onCommit: formulaBarState.onCommit,
      onCancel: formulaBarState.onCancel,
      startEditing: formulaBarState.startEditing,
      inputRef: formulaBarState.inputRef,
    });
  }, [formulas, formulaBarState.cellRef, formulaBarState.formulaText, formulaBarState.isEditing, formulaBarState.onInputChange, formulaBarState.onCommit, formulaBarState.onCancel, formulaBarState.startEditing, formulaBarState.inputRef]);

  // Sheet tabs element (only when sheetDefs are provided)
  const sheetTabsEl = useMemo(() => {
    if (!sheetDefs || sheetDefs.length === 0 || !activeSheet || !onSheetChange) return undefined;
    return React.createElement(SheetTabs, {
      sheets: sheetDefs,
      activeSheet,
      onSheetChange,
      onSheetAdd,
    });
  }, [sheetDefs, activeSheet, onSheetChange, onSheetAdd]);

  const layout = useMemo<UseOGridLayout>(() => ({
    toolbar: resolvedToolbar,
    toolbarBelow,
    className,
    emptyState,
    sideBarProps,
    fullScreen,
    formulaBar: formulaBarEl,
    sheetTabs: sheetTabsEl,
  }), [resolvedToolbar, toolbarBelow, className, emptyState, sideBarProps, fullScreen, formulaBarEl, sheetTabsEl]);

  const filtersResult = useMemo<UseOGridFilters>(() => ({
    hasActiveFilters: filtersState.hasActiveFilters,
    setFilters: filtersState.setFilters,
  }), [filtersState.hasActiveFilters, filtersState.setFilters]);

  return {
    dataGridProps,
    pagination,
    columnChooser,
    layout,
    filters: filtersResult,
  };
}
