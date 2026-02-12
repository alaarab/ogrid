import { Injectable, signal, computed, effect, DestroyRef, inject } from '@angular/core';
import {
  mergeFilter,
  deriveFilterOptionsFromData,
  getMultiSelectFilterFields,
  flattenColumns,
  processClientSideData,
  getDataGridStatusBarConfig,
} from '@alaarab/ogrid-core';
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
  SideBarPanelId,
} from '../types';
import type { IOGridProps, IOGridDataGridProps } from '../types';
import type { IColumnDef, IColumnGroupDef, ICellValueChangedEvent } from '../types';
import type { SideBarFilterColumn } from '../components/sidebar.component';

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
  readonly onColumnOrderChange = signal<((order: string[]) => void) | undefined>(undefined);
  readonly onColumnResized = signal<((columnId: string, width: number) => void) | undefined>(undefined);
  readonly onColumnPinned = signal<((columnId: string, pinned: 'left' | 'right' | null) => void) | undefined>(undefined);
  readonly freezeRows = signal<number | undefined>(undefined);
  readonly freezeCols = signal<number | undefined>(undefined);
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
  readonly editable = signal<boolean | undefined>(undefined);
  readonly cellSelection = signal<boolean | undefined>(undefined);
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
  readonly ariaLabel = signal<string | undefined>(undefined);
  readonly ariaLabelledBy = signal<string | undefined>(undefined);

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
  private fetchId = 0;
  private readonly refreshCounter = signal<number>(0);
  private firstDataRendered = false;

  // Side bar state
  private readonly sideBarActivePanel = signal<SideBarPanelId | null>(null);

  // Filter options state
  private readonly serverFilterOptions = signal<Record<string, string[]>>({});
  private readonly loadingFilterOptions = signal<Record<string, boolean>>({});

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
    if (this.controlledVisibleColumns()) return this.controlledVisibleColumns()!;
    if (this.internalVisibleColumnsOverride()) return this.internalVisibleColumnsOverride()!;
    const cols = this.columns();
    if (cols.length === 0) return new Set<string>();
    const visible = cols.filter((c) => c.defaultVisible !== false).map((c) => c.columnId);
    return new Set(visible.length > 0 ? visible : cols.map((c) => c.columnId));
  });
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

  readonly clientItemsAndTotal = computed(() => {
    if (!this.isClientSide()) return null;
    const rows = processClientSideData(
      this.displayData(),
      this.columns(),
      this.filters(),
      this.sort().field,
      this.sort().direction,
    );
    const total = rows.length;
    const start = (this.page() - 1) * this.pageSize();
    const paged = rows.slice(start, start + this.pageSize());
    return { items: paged, totalCount: total };
  });

  readonly displayItems = computed(() => {
    const cit = this.clientItemsAndTotal();
    return this.isClientSide() && cit ? cit.items : this.serverItems();
  });

  readonly displayTotalCount = computed(() => {
    const cit = this.clientItemsAndTotal();
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
        filterField: c.filterable!.filterField ?? c.columnId,
        filterType: c.filterable!.type as 'text' | 'multiSelect' | 'people' | 'date',
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

  // --- Data grid props computed ---
  readonly dataGridProps = computed<IOGridDataGridProps<T>>(() => ({
    items: this.displayItems(),
    columns: this.columnsProp(),
    getRowId: this.getRowId(),
    sortBy: this.sort().field,
    sortDirection: this.sort().direction,
    onColumnSort: (columnKey: string) => this.handleSort(columnKey),
    visibleColumns: this.visibleColumns(),
    columnOrder: this.columnOrder(),
    onColumnOrderChange: this.onColumnOrderChange(),
    onColumnResized: (columnId: string, width: number) => this.handleColumnResized(columnId, width),
    onColumnPinned: (columnId: string, pinned: 'left' | 'right' | null) => this.handleColumnPinned(columnId, pinned),
    pinnedColumns: this.pinnedOverrides(),
    initialColumnWidths: this.columnWidthOverrides(),
    freezeRows: this.freezeRows(),
    freezeCols: this.freezeCols(),
    editable: this.editable(),
    cellSelection: this.cellSelection(),
    onCellValueChanged: this.onCellValueChanged(),
    onUndo: this.onUndo(),
    onRedo: this.onRedo(),
    canUndo: this.canUndo(),
    canRedo: this.canRedo(),
    rowSelection: this.rowSelection(),
    selectedRows: this.effectiveSelectedRows(),
    onSelectionChange: (event: IRowSelectionChangeEvent<T>) => this.handleSelectionChange(event),
    statusBar: this.statusBarConfig(),
    isLoading: this.isLoadingResolved(),
    filters: this.filters(),
    onFilterChange: (key: string, value: FilterValue | undefined) => this.handleFilterChange(key, value),
    filterOptions: this.clientFilterOptions(),
    loadingFilterOptions: this.dataSource()?.fetchFilterOptions ? this.loadingFilterOptions() : EMPTY_LOADING_OPTIONS,
    peopleSearch: this.dataSource()?.searchPeople?.bind(this.dataSource()),
    getUserByEmail: this.dataSource()?.getUserByEmail?.bind(this.dataSource()),
    layoutMode: this.layoutMode(),
    suppressHorizontalScroll: this.suppressHorizontalScroll(),
    'aria-label': this.ariaLabel(),
    'aria-labelledby': this.ariaLabelledBy(),
    emptyState: {
      hasActiveFilters: this.hasActiveFilters(),
      onClearAll: () => this.setFilters({}),
      message: this.emptyState()?.message,
      render: this.emptyState()?.render as never,
    },
  }));

  readonly pagination = computed<OGridPagination>(() => ({
    page: this.page(),
    pageSize: this.pageSize(),
    displayTotalCount: this.displayTotalCount(),
    setPage: (p: number) => this.setPage(p),
    setPageSize: (size: number) => this.setPageSize(size),
    pageSizeOptions: this.pageSizeOptions(),
    entityLabelPlural: this.entityLabelPlural(),
  }));

  readonly columnChooser = computed<OGridColumnChooser>(() => ({
    columns: this.columnChooserColumns(),
    visibleColumns: this.visibleColumns(),
    onVisibilityChange: (columnKey: string, isVisible: boolean) => this.handleVisibilityChange(columnKey, isVisible),
    placement: this.columnChooserPlacement(),
  }));

  readonly filtersResult = computed<OGridFilters>(() => ({
    hasActiveFilters: this.hasActiveFilters(),
    setFilters: (f: IFilters) => this.setFilters(f),
  }));

  readonly sideBarProps = computed<SideBarFilterColumn[] extends never ? null : unknown>(() => {
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
    // Server-side data fetching effect
    effect(() => {
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

      const id = ++this.fetchId;
      this.serverLoading.set(true);

      ds.fetchPage({ page, pageSize, sort: { field: sort.field, direction: sort.direction }, filters })
        .then((res) => {
          if (id !== this.fetchId) return;
          this.serverItems.set(res.items);
          this.serverTotalCount.set(res.totalCount);
        })
        .catch((err) => {
          if (id !== this.fetchId) return;
          this.onError()?.(err);
          this.serverItems.set([]);
          this.serverTotalCount.set(0);
        })
        .finally(() => {
          if (id === this.fetchId) this.serverLoading.set(false);
        });
    });

    // Fire onFirstDataRendered once
    effect(() => {
      if (!this.firstDataRendered && this.displayItems().length > 0) {
        this.firstDataRendered = true;
        this.onFirstDataRendered()?.();
      }
    });

    // Load server filter options
    effect(() => {
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
        this.serverFilterOptions.set(results);
        this.loadingFilterOptions.set({});
      });
    });

    // Initialize sidebar default panel
    effect(() => {
      const parsed = this.sideBarParsed();
      if (parsed.defaultPanel) {
        this.sideBarActivePanel.set(parsed.defaultPanel);
      }
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

  handleSort(columnKey: string): void {
    const sort = this.sort();
    this.setSort({
      field: columnKey,
      direction: sort.field === columnKey && sort.direction === 'asc' ? 'desc' : 'asc',
    });
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
        const { [columnId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [columnId]: pinned };
    });
    this.onColumnPinned()?.(columnId, pinned);
  }

  // --- Configure from props ---

  configure(props: IOGridProps<T>): void {
    this.columnsProp.set(props.columns);
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
    if (props.onColumnPinned) this.onColumnPinned.set(props.onColumnPinned);
    if (props.freezeRows !== undefined) this.freezeRows.set(props.freezeRows);
    if (props.freezeCols !== undefined) this.freezeCols.set(props.freezeCols);
    if (props.defaultPageSize !== undefined) this.defaultPageSize.set(props.defaultPageSize);
    if (props.defaultSortBy !== undefined) this.defaultSortBy.set(props.defaultSortBy);
    if (props.defaultSortDirection !== undefined) this.defaultSortDirection.set(props.defaultSortDirection);
    if (props.editable !== undefined) this.editable.set(props.editable);
    if (props.cellSelection !== undefined) this.cellSelection.set(props.cellSelection);
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
    if (props.entityLabelPlural !== undefined) this.entityLabelPlural.set(props.entityLabelPlural);
    if (props.className !== undefined) this.className.set(props.className);
    if (props.layoutMode !== undefined) this.layoutMode.set(props.layoutMode);
    if (props.suppressHorizontalScroll !== undefined) this.suppressHorizontalScroll.set(props.suppressHorizontalScroll);
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
      const next = { ...prev };
      delete next[columnId];
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
        columnOrder: this.columnOrder() ?? undefined,
        columnWidths: Object.keys(this.columnWidthOverrides()).length > 0 ? this.columnWidthOverrides() : undefined,
        filters: Object.keys(this.filters()).length > 0 ? this.filters() : undefined,
        pinnedColumns: Object.keys(this.pinnedOverrides()).length > 0 ? this.pinnedOverrides() : undefined,
      }),
      applyColumnState: (state: Partial<IGridColumnState>) => {
        if (state.visibleColumns) this.setVisibleColumns(new Set(state.visibleColumns));
        if (state.sort) this.setSort(state.sort);
        if (state.columnOrder && this.onColumnOrderChange()) this.onColumnOrderChange()!(state.columnOrder);
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
      getColumnOrder: () => this.columnOrder() ?? this.columns().map((c) => c.columnId),
      setColumnOrder: (order: string[]) => {
        this.onColumnOrderChange()?.(order);
      },
      scrollToRow: (_index: number, _options?: { align?: 'start' | 'center' | 'end' }) => {
        // Scrolling is handled by VirtualScrollService at the UI layer.
        // The UI component should wire this to VirtualScrollService.scrollToRow().
      },
    };
  }
}
