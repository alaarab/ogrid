import { Injectable, signal, computed, effect, DestroyRef, inject } from '@angular/core';
import {
  mergeFilter,
  deriveFilterOptionsFromData,
  getMultiSelectFilterFields,
  flattenColumns,
  processClientSideData,
  processClientSideDataAsync,
  computeNextSortState,
  shouldUseWorkerSort,
  validateColumns,
  validateRowIds,
  columnLetterToIndex,
  getCellValue,
} from '@alaarab/ogrid-core';
import type { FormulaReference } from '@alaarab/ogrid-core';
import { extractFormulaReferences, deriveFormulaBarText } from '@alaarab/ogrid-core/formula';
import type {
  RowId,
  IOGridApi,
  IFilters,
  FilterValue,
  IRowSelectionChangeEvent,
  IStatusBarProps,
  IColumnDefinition,
  IGridColumnState,
  IDataSource,
  ISideBarDef,
  IVirtualScrollConfig,
  IResponsiveColumnsConfig,
  SideBarPanelId,
  IFormulaFunction,
  IRecalcResult,
  IGridDataAccessor,
} from '../types';
import type { IOGridProps, IOGridDataGridProps } from '../types';
import type { IColumnDef, IColumnGroupDef, ICellValueChangedEvent } from '../types';
import type { SideBarProps } from '../components/sidebar.component';
import { FormulaEngineService } from './formula-engine.service';

const DEFAULT_PAGE_SIZE = 25;
const EMPTY_LOADING_OPTIONS: Record<string, boolean> = {};
const DEFAULT_PANELS: SideBarPanelId[] = ['columns', 'filters'];

/** Resolved column chooser placement. */
export type ColumnChooserPlacement = 'toolbar' | 'sidebar' | 'none';

/** Pagination state and handlers. */
export interface OGridPagination {
  page: number;
  pageSize: number;
  displayTotalCount: number;
  setPage: (p: number) => void;
  setPageSize: (size: number) => void;
  pageSizeOptions?: number[];
  entityLabelPlural: string;
}

/** Column chooser state and handlers. */
export interface OGridColumnChooser {
  columns: IColumnDefinition[];
  visibleColumns: Set<string>;
  onVisibilityChange: (columnKey: string, isVisible: boolean) => void;
  placement: ColumnChooserPlacement;
}

/** Filter state. */
export interface OGridFilters {
  hasActiveFilters: boolean;
  setFilters: (f: IFilters) => void;
}

/** Formula bar state and handlers. */
export interface OGridFormulaBarState {
  cellRef: string | null;
  formulaText: string;
  isEditing: boolean;
  onInputChange: (text: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  startEditing: () => void;
  referencedCells: FormulaReference[];
}

/** Side bar state. */
export interface OGridSideBarState {
  isEnabled: boolean;
  activePanel: SideBarPanelId | null;
  setActivePanel: (panel: SideBarPanelId | null) => void;
  panels: SideBarPanelId[];
  position: 'left' | 'right';
  isOpen: boolean;
  toggle: (panel: SideBarPanelId) => void;
  close: () => void;
}

/**
 * Top-level orchestration service for OGrid: manages pagination, sorting, filtering,
 * column visibility, sidebar, and server-side data fetching via Angular signals.
 *
 * Port of React's useOGrid hook.
 */
@Injectable()
export class OGridService<T> {
  private destroyRef = inject(DestroyRef);

  // --- Input signals (set by the component consuming this service) ---
  readonly columnsProp = signal<(IColumnDef<T> | IColumnGroupDef<T>)[]>([]);
  readonly getRowId = signal<(item: T) => RowId>((item: T) => (item as Record<string, unknown>)['id'] as RowId);
  readonly data = signal<T[] | undefined>(undefined);
  readonly dataSource = signal<IDataSource<T> | undefined>(undefined);
  readonly controlledPage = signal<number | undefined>(undefined);
  readonly controlledPageSize = signal<number | undefined>(undefined);
  readonly controlledSort = signal<{ field: string; direction: 'asc' | 'desc' } | undefined>(undefined);
  readonly controlledFilters = signal<IFilters | undefined>(undefined);
  readonly controlledVisibleColumns = signal<Set<string> | undefined>(undefined);
  readonly controlledLoading = signal<boolean | undefined>(undefined);

  readonly onPageChange = signal<((page: number) => void) | undefined>(undefined);
  readonly onPageSizeChange = signal<((size: number) => void) | undefined>(undefined);
  readonly onSortChange = signal<((sort: { field: string; direction: 'asc' | 'desc' }) => void) | undefined>(undefined);
  readonly onFiltersChange = signal<((filters: IFilters) => void) | undefined>(undefined);
  readonly onVisibleColumnsChange = signal<((cols: Set<string>) => void) | undefined>(undefined);
  readonly columnOrder = signal<string[] | undefined>(undefined);
  readonly internalColumnOrder = signal<string[] | undefined>(undefined);
  readonly onColumnOrderChange = signal<((order: string[]) => void) | undefined>(undefined);
  readonly onColumnResized = signal<((columnId: string, width: number) => void) | undefined>(undefined);
  readonly onAutosizeColumn = signal<((columnId: string, width: number) => void) | undefined>(undefined);
  readonly onColumnPinned = signal<((columnId: string, pinned: 'left' | 'right' | null) => void) | undefined>(undefined);
  readonly defaultPageSize = signal<number>(DEFAULT_PAGE_SIZE);
  readonly defaultSortBy = signal<string | undefined>(undefined);
  readonly defaultSortDirection = signal<'asc' | 'desc'>('asc');
  readonly toolbar = signal<unknown>(undefined);
  readonly toolbarBelow = signal<unknown>(undefined);
  readonly emptyState = signal<{ message?: string; render?: unknown } | undefined>(undefined);
  readonly entityLabelPlural = signal<string>('items');
  readonly className = signal<string | undefined>(undefined);
  readonly layoutMode = signal<'content' | 'fill'>('fill');
  readonly suppressHorizontalScroll = signal<boolean | undefined>(undefined);
  readonly stickyHeader = signal<boolean>(true);
  readonly fullScreen = signal<boolean>(false);
  readonly editable = signal<boolean | undefined>(undefined);
  readonly cellSelection = signal<boolean | undefined>(undefined);
  readonly density = signal<'compact' | 'normal' | 'comfortable'>('normal');
  readonly rowHeight = signal<number | undefined>(undefined);
  readonly onCellValueChanged = signal<((event: ICellValueChangedEvent<T>) => void) | undefined>(undefined);
  readonly onUndo = signal<(() => void) | undefined>(undefined);
  readonly onRedo = signal<(() => void) | undefined>(undefined);
  readonly canUndo = signal<boolean | undefined>(undefined);
  readonly canRedo = signal<boolean | undefined>(undefined);
  readonly rowSelection = signal<'none' | 'single' | 'multiple'>('none');
  readonly selectedRows = signal<Set<RowId> | undefined>(undefined);
  readonly onSelectionChange = signal<((event: IRowSelectionChangeEvent<T>) => void) | undefined>(undefined);
  readonly statusBar = signal<boolean | IStatusBarProps | undefined>(undefined);
  readonly pageSizeOptions = signal<number[] | undefined>(undefined);
  readonly sideBarConfig = signal<boolean | ISideBarDef | undefined>(undefined);
  readonly onFirstDataRendered = signal<(() => void) | undefined>(undefined);
  readonly onError = signal<((error: unknown) => void) | undefined>(undefined);
  readonly columnChooserProp = signal<boolean | 'toolbar' | 'sidebar' | undefined>(undefined);
  readonly columnReorder = signal<boolean | undefined>(undefined);
  readonly responsiveColumns = signal<boolean | IResponsiveColumnsConfig | undefined>(undefined);
  readonly virtualScroll = signal<IVirtualScrollConfig | undefined>(undefined);
  readonly ariaLabel = signal<string | undefined>(undefined);
  readonly ariaLabelledBy = signal<string | undefined>(undefined);
  readonly workerSort = signal<boolean | 'auto'>(false);
  readonly showRowNumbers = signal<boolean>(false);
  readonly cellReferences = signal<boolean>(false);
  readonly formulasEnabled = signal<boolean>(false);
  readonly initialFormulas = signal<Array<{ col: number; row: number; formula: string }> | undefined>(undefined);
  readonly onFormulaRecalc = signal<((result: IRecalcResult) => void) | undefined>(undefined);
  readonly formulaFunctions = signal<Record<string, IFormulaFunction> | undefined>(undefined);
  readonly namedRanges = signal<Record<string, string> | undefined>(undefined);
  readonly sheets = signal<Record<string, IGridDataAccessor> | undefined>(undefined);
  readonly sheetDefs = signal<import('@alaarab/ogrid-core').ISheetDef[] | undefined>(undefined);
  readonly activeSheet = signal<string | undefined>(undefined);
  readonly onSheetChange = signal<((sheetId: string) => void) | undefined>(undefined);
  readonly onSheetAdd = signal<(() => void) | undefined>(undefined);

  /** Active cell reference string (e.g. 'A1') updated by DataGridTable when cellReferences is enabled. */
  readonly activeCellRef = signal<string | null>(null);

  /** Active cell coordinates (0-based col/row). */
  readonly activeCellCoords = signal<{ col: number; row: number } | null>(null);

  /** Stable callback passed to DataGridTable to update activeCellRef + coords. */
  private readonly handleActiveCellChange = (ref: string | null) => {
    this.activeCellRef.set(ref);
    if (ref) {
      const m = ref.match(/^([A-Z]+)(\d+)$/);
      if (m) {
        this.activeCellCoords.set({ col: columnLetterToIndex(m[1]), row: parseInt(m[2], 10) - 1 });
      } else {
        this.activeCellCoords.set(null);
      }
    } else {
      this.activeCellCoords.set(null);
    }
  };

  // --- Formula bar state ---
  private readonly formulaBarEditing = signal(false);
  private readonly formulaBarEditText = signal('');

  // --- Formula engine ---
  private readonly formulaService = new FormulaEngineService<T>();
  /** Monotonic counter incremented on formula recalculation  -  drives cache invalidation. */
  readonly formulaVersion = signal(0);

  // Stable formula method references for dataGridProps (avoid per-recompute arrow functions)
  private readonly getFormulaValueFn = (col: number, row: number) => this.formulaService.getValue(col, row);
  private readonly hasFormulaFn = (col: number, row: number) => this.formulaService.hasFormula(col, row);
  private readonly getFormulaFn = (col: number, row: number) => this.formulaService.getFormula(col, row);
  private readonly setFormulaFn = (col: number, row: number, formula: string | null) => this.formulaService.setFormula(col, row, formula ?? '');
  private readonly onFormulaCellChangedFn = (col: number, row: number) => this.formulaService.onCellChanged(col, row);
  private readonly getPrecedentsFn = (col: number, row: number) => this.formulaService.getPrecedents(col, row);
  private readonly getDependentsFn = (col: number, row: number) => this.formulaService.getDependents(col, row);
  private readonly getAuditTrailFn = (col: number, row: number) => this.formulaService.getAuditTrail(col, row);

  // --- Internal state signals ---
  private readonly internalData = signal<T[]>([]);
  private readonly internalLoading = signal<boolean>(false);
  private readonly internalPage = signal<number>(1);
  private readonly internalPageSizeOverride = signal<number | null>(null);
  private readonly internalSortOverride = signal<{ field: string; direction: 'asc' | 'desc' } | null>(null);
  private readonly internalFilters = signal<IFilters>({});
  private readonly internalVisibleColumnsOverride = signal<Set<string> | null>(null);
  private readonly internalSelectedRows = signal<Set<RowId>>(new Set());
  private readonly columnWidthOverrides = signal<Record<string, number>>({});
  private readonly pinnedOverrides = signal<Record<string, 'left' | 'right'>>({});

  // Server-side state
  private readonly serverItems = signal<T[]>([]);
  private readonly serverTotalCount = signal<number>(0);
  private readonly serverLoading = signal<boolean>(true);
  private fetchAbortController: AbortController | null = null;
  private filterAbortController: AbortController | null = null;
  private readonly refreshCounter = signal<number>(0);
  private readonly firstDataRendered = signal<boolean>(false);

  // Worker sort async state
  private readonly asyncClientItems = signal<{ items: unknown[]; totalCount: number } | null>(null);
  private workerSortAbortId = 0;

  // Stable sorted order (index-based, same approach as React/Vue).
  // sortedIndices stores indices into displayData() from the last explicit sort/filter pass.
  // When only displayData changes (cell edit), we reuse these indices to look up updated row
  // objects - preserving order without re-sorting. Matches Excel behavior.
  private sortedIndices: number[] | null = null;
  private sortedPrevSortVersion = -1;
  private sortedPrevFilters: IFilters | null = null;
  private sortedPrevColumns: IColumnDef<T>[] | null = null;
  private sortedPrevDataLength = -1;
  private readonly sortSnapshotVersion = signal(0);

  // Side bar state
  private readonly sideBarActivePanel = signal<SideBarPanelId | null>(null);

  // Filter options state
  private readonly serverFilterOptions = signal<Record<string, string[]>>({});
  readonly loadingFilterOptions = signal<Record<string, boolean>>({});

  // --- Derived computed signals ---

  readonly columns = computed(() => flattenColumns(this.columnsProp()) as IColumnDef<T>[]);

  readonly isServerSide = computed(() => this.dataSource() != null);
  readonly isClientSide = computed(() => !this.isServerSide());

  readonly displayData = computed(() => this.data() ?? this.internalData());
  readonly displayLoading = computed(() => this.controlledLoading() ?? this.internalLoading());

  readonly defaultSortField = computed(() => this.defaultSortBy() ?? this.columns()[0]?.columnId ?? '');

  readonly page = computed(() => this.controlledPage() ?? this.internalPage());
  readonly pageSize = computed(() => this.controlledPageSize() ?? this.internalPageSizeOverride() ?? this.defaultPageSize());
  readonly sort = computed(() => this.controlledSort() ?? this.internalSortOverride() ?? {
    field: this.defaultSortField(),
    direction: this.defaultSortDirection(),
  });
  readonly filters = computed(() => this.controlledFilters() ?? this.internalFilters());
  readonly visibleColumns = computed(() => {
    const controlled = this.controlledVisibleColumns();
    if (controlled) return controlled;
    const override = this.internalVisibleColumnsOverride();
    if (override) return override;
    const cols = this.columns();
    if (cols.length === 0) return new Set<string>();
    const visible = cols.filter((c) => c.defaultVisible !== false).map((c) => c.columnId);
    return new Set(visible.length > 0 ? visible : cols.map((c) => c.columnId));
  });
  readonly effectiveColumnOrder = computed(() => this.columnOrder() ?? this.internalColumnOrder());
  readonly effectiveSelectedRows = computed(() => this.selectedRows() ?? this.internalSelectedRows());

  readonly columnChooserPlacement = computed<ColumnChooserPlacement>(() => {
    const prop = this.columnChooserProp();
    return prop === false ? 'none' : prop === 'sidebar' ? 'sidebar' : 'toolbar';
  });

  readonly multiSelectFilterFields = computed(() => getMultiSelectFilterFields(this.columns()));

  readonly hasServerFilterOptions = computed(() => this.dataSource()?.fetchFilterOptions != null);

  readonly clientFilterOptions = computed(() => {
    if (this.hasServerFilterOptions()) return this.serverFilterOptions();
    return deriveFilterOptionsFromData(this.displayData(), this.columns());
  });

  readonly workerSortEnabled = computed(() => shouldUseWorkerSort(this.workerSort(), this.displayData().length, {
    columns: this.columns(),
    filters: this.filters(),
    sortBy: this.sort().field,
  }));

  /** Sync path: used when workerSort is off. */
  readonly clientItemsAndTotal = computed(() => {
    if (!this.isClientSide() || this.workerSortEnabled()) return null;

    const data = this.displayData();
    const cols = this.columns();
    const f = this.filters();
    const sv = this.sortSnapshotVersion(); // reactive: increments on explicit sort
    const sortField = this.sort().field;
    const sortDir = this.sort().direction;

    const needsResort =
      sv !== this.sortedPrevSortVersion ||
      f !== this.sortedPrevFilters ||
      cols !== this.sortedPrevColumns ||
      data.length !== this.sortedPrevDataLength;

    let orderedRows: T[];

    if (needsResort || this.sortedIndices === null) {
      this.sortedPrevSortVersion = sv;
      this.sortedPrevFilters = f;
      this.sortedPrevColumns = cols;
      this.sortedPrevDataLength = data.length;

      const sorted = processClientSideData(data, cols, f, sortField, sortDir);
      const indexMap = new Map<T, number>();
      for (let i = 0; i < data.length; i++) indexMap.set(data[i], i);
      this.sortedIndices = sorted.map((row) => {
        const idx = indexMap.get(row);
        return idx !== undefined ? idx : -1;
      }).filter((idx) => idx !== -1);
      orderedRows = sorted;
    } else {
      // Cell edit: preserve existing order, look up updated row objects by index.
      orderedRows = this.sortedIndices.map((idx) => data[idx]).filter((r) => r !== undefined) as T[];
    }

    const total = orderedRows.length;
    const start = (this.page() - 1) * this.pageSize();
    const paged = orderedRows.slice(start, start + this.pageSize());
    return { items: paged, totalCount: total };
  });

  /** Resolved client items  -  sync or async depending on workerSort. */
  readonly resolvedClientItems = computed(() => {
    // Sync path
    const syncResult = this.clientItemsAndTotal();
    if (syncResult) return syncResult;
    // Async path
    return this.asyncClientItems() as { items: T[]; totalCount: number } | null;
  });

  readonly displayItems = computed(() => {
    const cit = this.resolvedClientItems();
    return this.isClientSide() && cit ? cit.items : this.serverItems();
  });

  readonly displayTotalCount = computed(() => {
    const cit = this.resolvedClientItems();
    return this.isClientSide() && cit ? cit.totalCount : this.serverTotalCount();
  });

  readonly hasActiveFilters = computed(() => {
    return Object.values(this.filters()).some((v) => v !== undefined);
  });

  readonly columnChooserColumns = computed<IColumnDefinition[]>(() =>
    this.columns().map((c) => ({
      columnId: c.columnId,
      name: c.name,
      required: c.required === true,
    })),
  );

  readonly statusBarConfig = computed<IStatusBarProps | undefined>(() => {
    const sb = this.statusBar();
    if (!sb) return undefined;
    if (typeof sb === 'object') return sb;
    const totalData = this.isClientSide() ? (this.data()?.length ?? 0) : this.serverTotalCount();
    const filteredData = this.displayTotalCount();
    return {
      totalCount: totalData,
      filteredCount: this.hasActiveFilters() ? filteredData : undefined,
      selectedCount: this.effectiveSelectedRows().size,
      suppressRowCount: true,
    };
  });

  readonly isLoadingResolved = computed(() => {
    return (this.isServerSide() && this.serverLoading()) || this.displayLoading();
  });

  // Side bar
  readonly sideBarEnabled = computed(() => {
    const config = this.sideBarConfig();
    return config != null && config !== false;
  });

  readonly sideBarParsed = computed(() => {
    const config = this.sideBarConfig();
    if (!this.sideBarEnabled() || config === true) {
      return { panels: DEFAULT_PANELS, position: 'right' as const, defaultPanel: null as SideBarPanelId | null };
    }
    const def = config as ISideBarDef;
    return {
      panels: def.panels ?? DEFAULT_PANELS,
      position: def.position ?? 'right',
      defaultPanel: def.defaultPanel ?? null,
    };
  });

  readonly filterableColumns = computed(() =>
    this.columns()
      .filter((c) => c.filterable && c.filterable.type)
      .map((c) => ({
        columnId: c.columnId,
        name: c.name,
        filterField: c.filterable?.filterField ?? c.columnId,
        filterType: c.filterable?.type as 'text' | 'multiSelect' | 'people' | 'date',
      })),
  );

  readonly sideBarState = computed<OGridSideBarState>(() => ({
    isEnabled: this.sideBarEnabled(),
    activePanel: this.sideBarActivePanel(),
    setActivePanel: (panel: SideBarPanelId | null) => this.sideBarActivePanel.set(panel),
    panels: this.sideBarParsed().panels,
    position: this.sideBarParsed().position,
    isOpen: this.sideBarActivePanel() !== null,
    toggle: (panel: SideBarPanelId) => this.sideBarActivePanel.update((p) => p === panel ? null : panel),
    close: () => this.sideBarActivePanel.set(null),
  }));

  // --- Formula bar derived state ---

  /** Display text derived from active cell (formula string or raw value). */
  private readonly formulaBarDisplayText = computed(() => {
    const coords = this.activeCellCoords();
    if (!coords) return '';
    const getFormula = this.formulaService.enabled()
      ? (c: number, r: number) => this.formulaService.getFormula(c, r)
      : undefined;
    const items = this.displayItems();
    const cols = this.columns();
    const getRawValue = (c: number, r: number): unknown => {
      if (r < 0 || r >= items.length || c < 0 || c >= cols.length) return undefined;
      return getCellValue(items[r], cols[c]);
    };
    return deriveFormulaBarText(coords.col, coords.row, getFormula, getRawValue);
  });

  /** Formula text shown in the bar: edit text when editing, display text otherwise. */
  readonly formulaBarText = computed(() =>
    this.formulaBarEditing() ? this.formulaBarEditText() : this.formulaBarDisplayText(),
  );

  /** References extracted from the current formula text (for highlighting). */
  readonly formulaBarReferences = computed(() =>
    extractFormulaReferences(this.formulaBarText()),
  );

  // Stable formula bar callbacks (avoid new closures per computed)
  private readonly formulaBarOnInputChangeFn = (text: string) => { this.formulaBarEditText.set(text); };
  private readonly formulaBarOnCommitFn = () => { this.commitFormulaBar(); };
  private readonly formulaBarOnCancelFn = () => { this.cancelFormulaBar(); };
  private readonly formulaBarStartEditingFn = () => { this.startFormulaBarEditing(); };

  /** Aggregate formula bar state for template consumption. */
  readonly formulaBarState = computed<OGridFormulaBarState>(() => ({
    cellRef: this.activeCellRef(),
    formulaText: this.formulaBarText(),
    isEditing: this.formulaBarEditing(),
    onInputChange: this.formulaBarOnInputChangeFn,
    onCommit: this.formulaBarOnCommitFn,
    onCancel: this.formulaBarOnCancelFn,
    startEditing: this.formulaBarStartEditingFn,
    referencedCells: this.formulaBarReferences(),
  }));

  // --- Pre-computed stable callback references for dataGridProps ---
  // These avoid recreating arrow functions on every dataGridProps recomputation.
  private readonly handleSortFn = (columnKey: string, direction?: 'asc' | 'desc' | null) => this.handleSort(columnKey, direction);
  private readonly handleColumnResizedFn = (columnId: string, width: number) => this.handleColumnResized(columnId, width);
  private readonly handleColumnPinnedFn = (columnId: string, pinned: 'left' | 'right' | null) => this.handleColumnPinned(columnId, pinned);
  private readonly handleSelectionChangeFn = (event: IRowSelectionChangeEvent<T>) => this.handleSelectionChange(event);
  private readonly handleFilterChangeFn = (key: string, value: FilterValue | undefined) => this.handleFilterChange(key, value);
  private readonly clearAllFiltersFn = () => this.setFilters({});
  private readonly setPageFn = (p: number) => this.setPage(p);
  private readonly setPageSizeFn = (size: number) => this.setPageSize(size);
  private readonly handleVisibilityChangeFn = (columnKey: string, isVisible: boolean) => this.handleVisibilityChange(columnKey, isVisible);

  // --- Data grid props computed ---
  readonly dataGridProps = computed<IOGridDataGridProps<T>>(() => ({
    items: this.displayItems(),
    columns: this.columnsProp(),
    getRowId: this.getRowId(),
    sortBy: this.sort().field,
    sortDirection: this.sort().direction,
    onColumnSort: this.handleSortFn,
    visibleColumns: this.visibleColumns(),
    columnOrder: this.effectiveColumnOrder(),
    onColumnOrderChange: this.onColumnOrderChange(),
    onColumnResized: this.handleColumnResizedFn,
    onAutosizeColumn: this.onAutosizeColumn(),
    onColumnPinned: this.handleColumnPinnedFn,
    pinnedColumns: this.pinnedOverrides(),
    initialColumnWidths: this.columnWidthOverrides(),
    editable: this.editable(),
    cellSelection: this.cellSelection(),
    density: this.density(),
    rowHeight: this.rowHeight(),
    onCellValueChanged: this.onCellValueChanged(),
    onUndo: this.onUndo(),
    onRedo: this.onRedo(),
    canUndo: this.canUndo(),
    canRedo: this.canRedo(),
    rowSelection: this.rowSelection(),
    selectedRows: this.effectiveSelectedRows(),
    onSelectionChange: this.handleSelectionChangeFn,
    showRowNumbers: this.showRowNumbers() || this.cellReferences() || this.formulasEnabled(),
    showColumnLetters: !!(this.cellReferences() || this.formulasEnabled()),
    showNameBox: !!(this.cellReferences() && !this.formulasEnabled()),
    onActiveCellChange: (this.cellReferences() || this.formulasEnabled()) ? this.handleActiveCellChange : undefined,
    currentPage: this.page(),
    pageSize: this.pageSize(),
    statusBar: this.statusBarConfig(),
    isLoading: this.isLoadingResolved(),
    filters: this.filters(),
    onFilterChange: this.handleFilterChangeFn,
    filterOptions: this.clientFilterOptions(),
    loadingFilterOptions: this.dataSource()?.fetchFilterOptions ? this.loadingFilterOptions() : EMPTY_LOADING_OPTIONS,
    peopleSearch: this.dataSource()?.searchPeople?.bind(this.dataSource()),
    getUserByEmail: this.dataSource()?.getUserByEmail?.bind(this.dataSource()),
    layoutMode: this.layoutMode(),
    suppressHorizontalScroll: this.suppressHorizontalScroll(),
    stickyHeader: this.stickyHeader(),
    columnReorder: this.columnReorder(),
    responsiveColumns: this.responsiveColumns(),
    virtualScroll: this.virtualScroll(),
    'aria-label': this.ariaLabel(),
    'aria-labelledby': this.ariaLabelledBy(),
    emptyState: {
      hasActiveFilters: this.hasActiveFilters(),
      onClearAll: this.clearAllFiltersFn,
      message: this.emptyState()?.message,
      render: this.emptyState()?.render,
    },
    formulas: this.formulasEnabled(),
    formulaVersion: this.formulaVersion(),
    formulaReferences: this.formulaBarReferences().length > 0 ? this.formulaBarReferences() : undefined,
    ...(this.formulaService.enabled() ? {
      getFormulaValue: this.getFormulaValueFn,
      hasFormula: this.hasFormulaFn,
      getFormula: this.getFormulaFn,
      setFormula: this.setFormulaFn,
      onFormulaCellChanged: this.onFormulaCellChangedFn,
      getPrecedents: this.getPrecedentsFn,
      getDependents: this.getDependentsFn,
      getAuditTrail: this.getAuditTrailFn,
    } : {}),
  }));

  readonly pagination = computed<OGridPagination>(() => ({
    page: this.page(),
    pageSize: this.pageSize(),
    displayTotalCount: this.displayTotalCount(),
    setPage: this.setPageFn,
    setPageSize: this.setPageSizeFn,
    pageSizeOptions: this.pageSizeOptions(),
    entityLabelPlural: this.entityLabelPlural(),
  }));

  readonly columnChooser = computed<OGridColumnChooser>(() => ({
    columns: this.columnChooserColumns(),
    visibleColumns: this.visibleColumns(),
    onVisibilityChange: this.handleVisibilityChangeFn,
    placement: this.columnChooserPlacement(),
  }));

  readonly filtersResult = computed<OGridFilters>(() => ({
    hasActiveFilters: this.hasActiveFilters(),
    setFilters: (f: IFilters) => this.setFilters(f),
  }));

  readonly sideBarProps = computed<SideBarProps | null>(() => {
    const state = this.sideBarState();
    if (!state.isEnabled) return null;
    return {
      activePanel: state.activePanel,
      onPanelChange: state.setActivePanel,
      panels: state.panels,
      position: state.position,
      columns: this.columnChooserColumns(),
      visibleColumns: this.visibleColumns(),
      onVisibilityChange: (columnKey: string, visible: boolean) => this.handleVisibilityChange(columnKey, visible),
      onSetVisibleColumns: (cols: Set<string>) => this.setVisibleColumns(cols),
      filterableColumns: this.filterableColumns(),
      filters: this.filters(),
      onFilterChange: (key: string, value: FilterValue | undefined) => this.handleFilterChange(key, value),
      filterOptions: this.clientFilterOptions(),
    };
  });

  constructor() {
    // Validate columns once (on first non-empty columns signal)
    let columnsValidated = false;
    effect(() => {
      const cols = this.columns();
      if (!columnsValidated && cols.length > 0) {
        columnsValidated = true;
        validateColumns(cols as Parameters<typeof validateColumns>[0]);
      }
    });

    // Worker sort async effect  -  runs processClientSideDataAsync when workerSort is on
    // Uses the same index-based snapshot approach as the sync path.
    let asyncSortedIndices: number[] | null = null;
    let asyncPrevSortVersion = -1;
    let asyncPrevFilters: IFilters | null = null;
    let asyncPrevColumns: IColumnDef<T>[] | null = null;
    let asyncPrevDataLength = -1;

    effect((onCleanup) => {
      if (!this.isClientSide() || !this.workerSortEnabled()) return;

      const data = this.displayData();
      const cols = this.columns();
      const filters = this.filters();
      const sv = this.sortSnapshotVersion(); // reactive trigger for explicit sort changes
      const sortField = this.sort().field;
      const sortDir = this.sort().direction;
      const page = this.page();
      const ps = this.pageSize();

      const needsResortAsync =
        sv !== asyncPrevSortVersion ||
        filters !== asyncPrevFilters ||
        cols !== asyncPrevColumns ||
        data.length !== asyncPrevDataLength;

      const abortId = ++this.workerSortAbortId;

      if (needsResortAsync || asyncSortedIndices === null) {
        asyncPrevSortVersion = sv;
        asyncPrevFilters = filters;
        asyncPrevColumns = cols;
        asyncPrevDataLength = data.length;
        asyncSortedIndices = null;

        processClientSideDataAsync(data, cols, filters, sortField, sortDir)
          .then((rows) => {
            if (abortId !== this.workerSortAbortId) return; // stale
            const indexMap = new Map<T, number>();
            for (let i = 0; i < data.length; i++) indexMap.set(data[i], i);
            asyncSortedIndices = (rows as T[]).map((row) => {
              const idx = indexMap.get(row);
              return idx !== undefined ? idx : -1;
            }).filter((idx) => idx !== -1);
            const total = rows.length;
            const start = (page - 1) * ps;
            const paged = rows.slice(start, start + ps);
            this.asyncClientItems.set({ items: paged, totalCount: total });
          })
          .catch(() => {
            if (abortId !== this.workerSortAbortId) return;
            // Fallback: use sync
            const rows = processClientSideData(data, cols, filters, sortField, sortDir);
            const indexMap = new Map<T, number>();
            for (let i = 0; i < data.length; i++) indexMap.set(data[i], i);
            asyncSortedIndices = rows.map((row) => {
              const idx = indexMap.get(row);
              return idx !== undefined ? idx : -1;
            }).filter((idx) => idx !== -1);
            const total = rows.length;
            const start = (page - 1) * ps;
            const paged = rows.slice(start, start + ps);
            this.asyncClientItems.set({ items: paged, totalCount: total });
          });
      } else {
        // Preserve order: look up updated rows by stored indices.
        const orderedRows = asyncSortedIndices.map((idx) => data[idx]).filter((r) => r !== undefined) as T[];
        const total = orderedRows.length;
        const start = (page - 1) * ps;
        const paged = orderedRows.slice(start, start + ps);
        this.asyncClientItems.set({ items: paged, totalCount: total });
      }

      onCleanup(() => {
        this.workerSortAbortId++;
      });
    });

    // Server-side data fetching effect
    effect((onCleanup) => {
      const ds = this.dataSource();
      if (!this.isServerSide() || !ds) {
        if (!this.isServerSide()) this.serverLoading.set(false);
        return;
      }

      const page = this.page();
      const pageSize = this.pageSize();
      const sort = this.sort();
      const filters = this.filters();
      // Read refreshCounter to trigger re-fetches
      this.refreshCounter();

      const controller = new AbortController();
      this.fetchAbortController = controller;
      this.serverLoading.set(true);

      ds.fetchPage({
        page,
        pageSize,
        sort: { field: sort.field, direction: sort.direction },
        filters,
        signal: controller.signal,
      })
        .then((res) => {
          if (controller.signal.aborted) return;
          this.serverItems.set(res.items);
          this.serverTotalCount.set(res.totalCount);
        })
        .catch((err) => {
          if (controller.signal.aborted) return;
          this.onError()?.(err);
          this.serverItems.set([]);
          this.serverTotalCount.set(0);
        })
        .finally(() => {
          if (!controller.signal.aborted) this.serverLoading.set(false);
        });

      onCleanup(() => {
        controller.abort();
      });
    });

    // Fire onFirstDataRendered once; also validate row IDs on first data
    let rowIdsValidated = false;
    effect(() => {
      const items = this.displayItems();
      if (!this.firstDataRendered() && items.length > 0) {
        this.firstDataRendered.set(true);
        this.onFirstDataRendered()?.();
      }
      if (!rowIdsValidated && items.length > 0) {
        rowIdsValidated = true;
        validateRowIds(items, this.getRowId() as (item: typeof items[0]) => import('@alaarab/ogrid-core').RowId);
      }
    });

    // Load server filter options
    effect((onCleanup) => {
      const ds = this.dataSource();
      const fields = this.multiSelectFilterFields();
      const fetcher = ds && 'fetchFilterOptions' in ds && typeof ds.fetchFilterOptions === 'function'
        ? ds.fetchFilterOptions.bind(ds)
        : undefined;

      if (!fetcher || fields.length === 0) {
        this.serverFilterOptions.set({});
        this.loadingFilterOptions.set({});
        return;
      }

      const controller = new AbortController();
      this.filterAbortController = controller;

      const loading: Record<string, boolean> = {};
      fields.forEach((f) => { loading[f] = true; });
      this.loadingFilterOptions.set(loading);

      const results: Record<string, string[]> = {};
      Promise.all(
        fields.map(async (field) => {
          try {
            results[field] = await fetcher(field);
          } catch {
            results[field] = [];
          }
        }),
      ).then(() => {
        if (controller.signal.aborted) return;
        this.serverFilterOptions.set(results);
        this.loadingFilterOptions.set({});
      });

      onCleanup(() => {
        controller.abort();
      });
    });

    // Initialize sidebar default panel
    effect(() => {
      const parsed = this.sideBarParsed();
      if (parsed.defaultPanel) {
        this.sideBarActivePanel.set(parsed.defaultPanel);
      }
    });

    // Reset formula bar editing when active cell changes
    effect(() => {
      // Read active cell coords to trigger on cell change
      this.activeCellCoords();
      this.formulaBarEditing.set(false);
    });

    // Formula engine: configure when formula signals change
    effect(() => {
      const userRecalcCb = this.onFormulaRecalc();
      this.formulaService.configure({
        formulas: this.formulasEnabled(),
        initialFormulas: this.initialFormulas(),
        formulaFunctions: this.formulaFunctions(),
        onFormulaRecalc: (result) => {
          this.formulaVersion.update((v) => v + 1);
          userRecalcCb?.(result);
        },
        namedRanges: this.namedRanges(),
        sheets: this.sheets(),
      });
    });

    // Formula engine: keep data in sync with display items + columns
    effect(() => {
      const items = this.displayItems();
      const cols = this.columns();
      this.formulaService.setData(items, cols);
    });

    // Cleanup on destroy  -  abort in-flight requests and reset callback signals
    this.destroyRef.onDestroy(() => {
      this.fetchAbortController?.abort();
      this.filterAbortController?.abort();
      this.fetchAbortController = null;
      this.filterAbortController = null;

      this.onPageChange.set(undefined);
      this.onPageSizeChange.set(undefined);
      this.onSortChange.set(undefined);
      this.onFiltersChange.set(undefined);
      this.onVisibleColumnsChange.set(undefined);
      this.onColumnOrderChange.set(undefined);
      this.onColumnResized.set(undefined);
      this.onAutosizeColumn.set(undefined);
      this.onColumnPinned.set(undefined);
      this.onCellValueChanged.set(undefined);
      this.onSelectionChange.set(undefined);
      this.onFirstDataRendered.set(undefined);
      this.onError.set(undefined);
      this.onUndo.set(undefined);
      this.onRedo.set(undefined);
    });
  }

  // --- Setters ---

  setPage(p: number): void {
    if (this.controlledPage() === undefined) this.internalPage.set(p);
    this.onPageChange()?.(p);
  }

  setPageSize(size: number): void {
    if (this.controlledPageSize() === undefined) this.internalPageSizeOverride.set(size);
    this.onPageSizeChange()?.(size);
    this.setPage(1);
  }

  setSort(s: { field: string; direction: 'asc' | 'desc' }): void {
    if (this.controlledSort() === undefined) this.internalSortOverride.set(s);
    this.onSortChange()?.(s);
    this.setPage(1);
    // Invalidate sorted indices so clientItemsAndTotal re-sorts with the new field/direction.
    this.sortedIndices = null;
    this.sortSnapshotVersion.update((v) => v + 1);
  }

  setFilters(f: IFilters): void {
    if (this.controlledFilters() === undefined) this.internalFilters.set(f);
    this.onFiltersChange()?.(f);
    this.setPage(1);
  }

  setVisibleColumns(cols: Set<string>): void {
    if (this.controlledVisibleColumns() === undefined) this.internalVisibleColumnsOverride.set(cols);
    this.onVisibleColumnsChange()?.(cols);
  }

  handleSort(columnKey: string, direction?: 'asc' | 'desc' | null): void {
    this.setSort(computeNextSortState(this.sort(), columnKey, direction));
  }

  handleFilterChange(key: string, value: FilterValue | undefined): void {
    this.setFilters(mergeFilter(this.filters(), key, value));
  }

  handleVisibilityChange(columnKey: string, isVisible: boolean): void {
    const next = new Set(this.visibleColumns());
    if (isVisible) next.add(columnKey);
    else next.delete(columnKey);
    this.setVisibleColumns(next);
  }

  handleSelectionChange(event: IRowSelectionChangeEvent<T>): void {
    if (this.selectedRows() === undefined) {
      this.internalSelectedRows.set(new Set(event.selectedRowIds));
    }
    this.onSelectionChange()?.(event);
  }

  handleColumnResized(columnId: string, width: number): void {
    this.columnWidthOverrides.update((prev) => ({ ...prev, [columnId]: width }));
    this.onColumnResized()?.(columnId, width);
  }

  handleColumnPinned(columnId: string, pinned: 'left' | 'right' | null): void {
    this.pinnedOverrides.update((prev) => {
      if (pinned === null) {
        const { [columnId]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [columnId]: pinned };
    });
    this.onColumnPinned()?.(columnId, pinned);
  }

  // --- Formula bar methods ---

  private startFormulaBarEditing(): void {
    this.formulaBarEditText.set(this.formulaBarDisplayText());
    this.formulaBarEditing.set(true);
  }

  private commitFormulaBar(): void {
    const coords = this.activeCellCoords();
    if (!coords) return;
    const text = this.formulaBarEditText().trim();
    if (text.startsWith('=')) {
      this.formulaService.setFormula(coords.col, coords.row, text);
      this.formulaVersion.update((v) => v + 1);
    } else {
      this.formulaService.setFormula(coords.col, coords.row, null);
      this.onCellValueChanged()?.({
        rowIndex: coords.row,
        columnId: this.columns()[coords.col]?.columnId ?? '',
        oldValue: undefined,
        newValue: text,
      } as ICellValueChangedEvent<T>);
    }
    this.formulaBarEditing.set(false);
  }

  private cancelFormulaBar(): void {
    this.formulaBarEditing.set(false);
    this.formulaBarEditText.set('');
  }

  // --- Configure from props ---

  configure(props: IOGridProps<T>): void {
    this.columnsProp.set(props.columns);

    // Initialize pinned overrides from column definitions on first configure
    if (Object.keys(this.pinnedOverrides()).length === 0) {
      const initial: Record<string, 'left' | 'right'> = {};
      for (const col of flattenColumns(props.columns)) {
        if (col.pinned) initial[col.columnId] = col.pinned;
      }
      if (Object.keys(initial).length > 0) this.pinnedOverrides.set(initial);
    }
    this.getRowId.set(props.getRowId);
    if ('data' in props && props.data !== undefined) this.data.set(props.data);
    if ('dataSource' in props && props.dataSource !== undefined) this.dataSource.set(props.dataSource);
    if (props.page !== undefined) this.controlledPage.set(props.page);
    if (props.pageSize !== undefined) this.controlledPageSize.set(props.pageSize);
    if (props.sort !== undefined) this.controlledSort.set(props.sort);
    if (props.filters !== undefined) this.controlledFilters.set(props.filters);
    if (props.visibleColumns !== undefined) this.controlledVisibleColumns.set(props.visibleColumns);
    if (props.isLoading !== undefined) this.controlledLoading.set(props.isLoading);
    if (props.onPageChange) this.onPageChange.set(props.onPageChange);
    if (props.onPageSizeChange) this.onPageSizeChange.set(props.onPageSizeChange);
    if (props.onSortChange) this.onSortChange.set(props.onSortChange);
    if (props.onFiltersChange) this.onFiltersChange.set(props.onFiltersChange);
    if (props.onVisibleColumnsChange) this.onVisibleColumnsChange.set(props.onVisibleColumnsChange);
    if (props.columnOrder !== undefined) this.columnOrder.set(props.columnOrder);
    if (props.onColumnOrderChange) this.onColumnOrderChange.set(props.onColumnOrderChange);
    if (props.onColumnResized) this.onColumnResized.set(props.onColumnResized);
    if (props.onAutosizeColumn) this.onAutosizeColumn.set(props.onAutosizeColumn);
    if (props.onColumnPinned) this.onColumnPinned.set(props.onColumnPinned);
    if (props.defaultPageSize !== undefined) this.defaultPageSize.set(props.defaultPageSize);
    if (props.defaultSortBy !== undefined) this.defaultSortBy.set(props.defaultSortBy);
    if (props.defaultSortDirection !== undefined) this.defaultSortDirection.set(props.defaultSortDirection);
    if (props.editable !== undefined) this.editable.set(props.editable);
    if (props.cellSelection !== undefined) this.cellSelection.set(props.cellSelection);
    if (props.density !== undefined) this.density.set(props.density);
    if (props.rowHeight !== undefined) this.rowHeight.set(props.rowHeight);
    if (props.onCellValueChanged) this.onCellValueChanged.set(props.onCellValueChanged);
    if (props.onUndo) this.onUndo.set(props.onUndo);
    if (props.onRedo) this.onRedo.set(props.onRedo);
    if (props.canUndo !== undefined) this.canUndo.set(props.canUndo);
    if (props.canRedo !== undefined) this.canRedo.set(props.canRedo);
    if (props.rowSelection !== undefined) this.rowSelection.set(props.rowSelection);
    if (props.selectedRows !== undefined) this.selectedRows.set(props.selectedRows);
    if (props.onSelectionChange) this.onSelectionChange.set(props.onSelectionChange);
    if (props.statusBar !== undefined) this.statusBar.set(props.statusBar);
    if (props.pageSizeOptions !== undefined) this.pageSizeOptions.set(props.pageSizeOptions);
    if (props.sideBar !== undefined) this.sideBarConfig.set(props.sideBar);
    if (props.onFirstDataRendered) this.onFirstDataRendered.set(props.onFirstDataRendered);
    if (props.onError) this.onError.set(props.onError);
    if (props.columnChooser !== undefined) this.columnChooserProp.set(props.columnChooser);
    if (props.columnReorder !== undefined) this.columnReorder.set(props.columnReorder);
    if (props.responsiveColumns !== undefined) this.responsiveColumns.set(props.responsiveColumns);
    if (props.virtualScroll !== undefined) this.virtualScroll.set(props.virtualScroll);
    if (props.workerSort !== undefined) this.workerSort.set(props.workerSort);
    if (props.showRowNumbers !== undefined) this.showRowNumbers.set(props.showRowNumbers);
    if (props.cellReferences !== undefined) this.cellReferences.set(props.cellReferences);
    if (props.formulas !== undefined) this.formulasEnabled.set(props.formulas);
    if (props.initialFormulas !== undefined) this.initialFormulas.set(props.initialFormulas);
    if (props.onFormulaRecalc) this.onFormulaRecalc.set(props.onFormulaRecalc);
    if (props.formulaFunctions !== undefined) this.formulaFunctions.set(props.formulaFunctions);
    if (props.namedRanges !== undefined) this.namedRanges.set(props.namedRanges);
    if (props.sheets !== undefined) this.sheets.set(props.sheets);
    if (props.sheetDefs !== undefined) this.sheetDefs.set(props.sheetDefs);
    if (props.activeSheet !== undefined) this.activeSheet.set(props.activeSheet);
    if (props.onSheetChange) this.onSheetChange.set(props.onSheetChange);
    if (props.onSheetAdd) this.onSheetAdd.set(props.onSheetAdd);
    if (props.entityLabelPlural !== undefined) this.entityLabelPlural.set(props.entityLabelPlural);
    if (props.className !== undefined) this.className.set(props.className);
    if (props.layoutMode !== undefined) this.layoutMode.set(props.layoutMode);
    if (props.suppressHorizontalScroll !== undefined) this.suppressHorizontalScroll.set(props.suppressHorizontalScroll);
    if (props.stickyHeader !== undefined) this.stickyHeader.set(props.stickyHeader);
    if (props.fullScreen !== undefined) this.fullScreen.set(props.fullScreen);
    if (props['aria-label'] !== undefined) this.ariaLabel.set(props['aria-label']);
    if (props['aria-labelledby'] !== undefined) this.ariaLabelledBy.set(props['aria-labelledby']);
  }

  // --- API ---

  // --- Column Pinning Methods ---

  /**
   * Pin a column to the left or right edge.
   */
  pinColumn(columnId: string, side: 'left' | 'right'): void {
    this.pinnedOverrides.update((prev) => ({ ...prev, [columnId]: side }));
    this.onColumnPinned()?.(columnId, side);
  }

  /**
   * Unpin a column (remove sticky positioning).
   */
  unpinColumn(columnId: string): void {
    this.pinnedOverrides.update((prev) => {
      const { [columnId]: _, ...next } = prev;
      return next;
    });
    this.onColumnPinned()?.(columnId, null);
  }

  /**
   * Check if a column is pinned and which side.
   */
  isPinned(columnId: string): 'left' | 'right' | undefined {
    return this.pinnedOverrides()[columnId];
  }

  /**
   * Compute sticky left offsets for left-pinned columns.
   * Returns a map of columnId -> left offset in pixels.
   */
  computeLeftOffsets(
    visibleCols: { columnId: string }[],
    columnWidths: Record<string, number>,
    defaultWidth: number,
    hasCheckboxColumn: boolean,
    checkboxColumnWidth: number
  ): Record<string, number> {
    const offsets: Record<string, number> = {};
    const pinned = this.pinnedOverrides();
    let left = hasCheckboxColumn ? checkboxColumnWidth : 0;

    for (const col of visibleCols) {
      if (pinned[col.columnId] === 'left') {
        offsets[col.columnId] = left;
        left += columnWidths[col.columnId] ?? defaultWidth;
      }
    }
    return offsets;
  }

  /**
   * Compute sticky right offsets for right-pinned columns.
   * Returns a map of columnId -> right offset in pixels.
   */
  computeRightOffsets(
    visibleCols: { columnId: string }[],
    columnWidths: Record<string, number>,
    defaultWidth: number
  ): Record<string, number> {
    const offsets: Record<string, number> = {};
    const pinned = this.pinnedOverrides();
    let right = 0;

    for (let i = visibleCols.length - 1; i >= 0; i--) {
      const col = visibleCols[i];
      if (pinned[col.columnId] === 'right') {
        offsets[col.columnId] = right;
        right += columnWidths[col.columnId] ?? defaultWidth;
      }
    }
    return offsets;
  }

  getApi(): IOGridApi<T> {
    return {
      setRowData: (d: T[]) => {
        if (!this.isServerSide()) this.internalData.set(d);
      },
      setLoading: (loading: boolean) => this.internalLoading.set(loading),
      getColumnState: (): IGridColumnState => ({
        visibleColumns: Array.from(this.visibleColumns()),
        sort: this.sort(),
        columnOrder: this.effectiveColumnOrder() ?? undefined,
        columnWidths: Object.keys(this.columnWidthOverrides()).length > 0 ? this.columnWidthOverrides() : undefined,
        filters: Object.keys(this.filters()).length > 0 ? this.filters() : undefined,
        pinnedColumns: Object.keys(this.pinnedOverrides()).length > 0 ? this.pinnedOverrides() : undefined,
      }),
      applyColumnState: (state: Partial<IGridColumnState>) => {
        if (state.visibleColumns) this.setVisibleColumns(new Set(state.visibleColumns));
        if (state.sort) this.setSort(state.sort);
        if (state.columnOrder) {
          if (this.columnOrder() === undefined) this.internalColumnOrder.set(state.columnOrder);
          this.onColumnOrderChange()?.(state.columnOrder);
        }
        if (state.columnWidths) this.columnWidthOverrides.set(state.columnWidths);
        if (state.filters) this.setFilters(state.filters);
        if (state.pinnedColumns) this.pinnedOverrides.set(state.pinnedColumns);
      },
      setFilterModel: (filters: IFilters) => this.setFilters(filters),
      getSelectedRows: () => Array.from(this.effectiveSelectedRows()),
      setSelectedRows: (rowIds: RowId[]) => {
        if (this.selectedRows() === undefined) this.internalSelectedRows.set(new Set(rowIds));
      },
      selectAll: () => {
        const allIds = new Set(this.displayItems().map((item) => this.getRowId()(item)));
        if (this.selectedRows() === undefined) this.internalSelectedRows.set(allIds);
        this.onSelectionChange()?.({
          selectedRowIds: Array.from(allIds),
          selectedItems: this.displayItems(),
        });
      },
      deselectAll: () => {
        if (this.selectedRows() === undefined) this.internalSelectedRows.set(new Set());
        this.onSelectionChange()?.({ selectedRowIds: [], selectedItems: [] });
      },
      clearFilters: () => this.setFilters({}),
      clearSort: () => this.setSort({ field: this.defaultSortField(), direction: this.defaultSortDirection() }),
      resetGridState: (options?: { keepSelection?: boolean }) => {
        this.setFilters({});
        this.setSort({ field: this.defaultSortField(), direction: this.defaultSortDirection() });
        if (!options?.keepSelection) {
          if (this.selectedRows() === undefined) this.internalSelectedRows.set(new Set());
          this.onSelectionChange()?.({ selectedRowIds: [], selectedItems: [] });
        }
      },
      getDisplayedRows: () => this.displayItems(),
      refreshData: () => {
        if (this.isServerSide()) {
          this.refreshCounter.update((c) => c + 1);
        }
      },
      getColumnOrder: () => this.effectiveColumnOrder() ?? this.columns().map((c) => c.columnId),
      setColumnOrder: (order: string[]) => {
        if (this.columnOrder() === undefined) this.internalColumnOrder.set(order);
        this.onColumnOrderChange()?.(order);
      },
      scrollToRow: (_index: number, _options?: { align?: 'start' | 'center' | 'end' }) => {
        // Scrolling is handled by VirtualScrollService at the UI layer.
        // The UI component should wire this to VirtualScrollService.scrollToRow().
      },
    };
  }
}
