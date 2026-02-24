import { signal, computed, effect, ElementRef, inject } from '@angular/core';
import { DataGridStateService } from '../services/datagrid-state.service';
import { ColumnReorderService } from '../services/column-reorder.service';
import { VirtualScrollService } from '../services/virtual-scroll.service';
import {
  buildHeaderRows,
  DEFAULT_MIN_COLUMN_WIDTH,
  CELL_PADDING,
  CHECKBOX_COLUMN_WIDTH,
  ROW_NUMBER_COLUMN_WIDTH,
  measureColumnContentWidth,
} from '@alaarab/ogrid-core';
import {
  getHeaderFilterConfig,
  getCellRenderDescriptor,
  resolveCellDisplayContent,
  resolveCellStyle,
  buildPopoverEditorProps,
} from '../utils';
import type {
  IOGridDataGridProps,
  IColumnDef,
  RowId,
} from '../types';
import type { HeaderFilterConfig, CellRenderDescriptor } from '../utils';

/**
 * Abstract base class containing all shared TypeScript logic for DataGridTable components.
 * Framework-specific UI packages extend this with their templates and style overrides.
 *
 * Subclasses must:
 * 1. Provide a @Component decorator with template and styles
 * 2. Call `initBase()` in the constructor (effects require injection context)
 * 3. Implement abstract accessors for propsInput, wrapperRef, and tableContainerRef
 */
export abstract class BaseDataGridTableComponent<T = unknown> {
  readonly stateService = inject<DataGridStateService<T>>(DataGridStateService);
  readonly columnReorderService = inject<ColumnReorderService<T>>(ColumnReorderService);
  readonly virtualScrollService = inject(VirtualScrollService);

  protected lastMouseShift = false;
  readonly columnSizingVersion = signal(0);

  /** Dirty flag — set when column layout changes, cleared after measurement. */
  private readonly measureDirty = signal<boolean>(true);

  /** DOM-measured column widths from the last layout pass.
   *  Used as a minWidth floor to prevent columns from shrinking
   *  when new data loads (e.g. server-side pagination). */
  readonly measuredColumnWidths = signal<Record<string, number>>({});

  // Signal-backed view child elements — set from ngAfterViewInit.
  // @ViewChild is a plain property (not a signal), so effects/computed that read it
  // only evaluate once during construction when the ref is still undefined.
  protected readonly wrapperElSignal = signal<HTMLElement | null>(null);
  protected readonly tableContainerElSignal = signal<HTMLElement | null>(null);

  // --- Abstract accessors for subclass-provided values ---

  /** Return the IOGridDataGridProps from however the subclass receives them */
  protected abstract getProps(): IOGridDataGridProps<T> | undefined;

  /** Return the wrapper element ref */
  protected abstract getWrapperRef(): ElementRef<HTMLElement> | undefined;

  /** Return the table container element ref */
  protected abstract getTableContainerRef(): ElementRef<HTMLElement> | undefined;

  /** Lifecycle hook — populate element signals from @ViewChild refs */
  ngAfterViewInit(): void {
    const wrapper = this.getWrapperRef()?.nativeElement ?? null;
    const tableContainer = this.getTableContainerRef()?.nativeElement ?? null;
    if (wrapper) this.wrapperElSignal.set(wrapper);
    if (tableContainer) this.tableContainerElSignal.set(tableContainer);
    this.measureColumnWidths();
  }

  /** Lifecycle hook — re-measure column widths only when layout changed */
  ngAfterViewChecked(): void {
    if (this.measureDirty()) {
      this.measureDirty.set(false);
      this.measureColumnWidths();
    }
  }

  /** Measure actual th widths from the DOM and update the measuredColumnWidths signal.
   *  Only updates the signal when values actually change, to avoid render loops. */
  private measureColumnWidths(): void {
    const wrapper = this.getWrapperRef()?.nativeElement;
    if (!wrapper) return;
    const headerCells = wrapper.querySelectorAll<HTMLElement>('th[data-column-id]');
    if (headerCells.length === 0) return;
    const measured: Record<string, number> = {};
    headerCells.forEach((cell) => {
      const colId = cell.getAttribute('data-column-id');
      if (colId) measured[colId] = cell.offsetWidth;
    });
    // Only update signal if values changed to avoid triggering computed re-evaluations unnecessarily
    const prev = this.measuredColumnWidths();
    let changed = Object.keys(measured).length !== Object.keys(prev).length;
    if (!changed) {
      for (const key in measured) {
        if (prev[key] !== measured[key]) { changed = true; break; }
      }
    }
    if (changed) {
      this.measuredColumnWidths.set(measured);
    }
  }

  // --- Delegated state ---

  readonly state = computed(() => this.stateService.getState());

  // Intermediate computed signals — narrow slices of state() so leaf computeds
  // only recompute when their specific sub-state changes.
  protected readonly layoutState = computed(() => this.state().layout);
  protected readonly rowSelectionState = computed(() => this.state().rowSelection);
  protected readonly editingState = computed(() => this.state().editing);
  protected readonly interactionState = computed(() => this.state().interaction);
  protected readonly contextMenuState = computed(() => this.state().contextMenu);
  protected readonly viewModelsState = computed(() => this.state().viewModels);
  protected readonly pinningState = computed(() => this.state().pinning);

  readonly tableContainerEl = computed(() => this.tableContainerElSignal());

  readonly items = computed(() => this.getProps()?.items ?? []);
  readonly getRowId = computed(() => this.getProps()?.getRowId ?? ((item: T) => (item as Record<string, unknown>)['id'] as RowId));
  readonly isLoading = computed(() => this.getProps()?.isLoading ?? false);
  readonly loadingMessage = computed(() => 'Loading\u2026');
  readonly layoutModeFit = computed(() => (this.getProps()?.layoutMode ?? 'fill') === 'content');
  readonly rowHeightCssVar = computed(() => {
    const rh = this.getProps()?.rowHeight;
    return rh ? `${rh}px` : null;
  });
  readonly ariaLabel = computed(() => this.getProps()?.['aria-label'] ?? 'Data grid');
  readonly ariaLabelledBy = computed(() => this.getProps()?.['aria-labelledby']);
  readonly stickyHeader = computed(() => this.getProps()?.stickyHeader ?? true);
  readonly emptyState = computed(() => this.getProps()?.emptyState);
  readonly currentPage = computed(() => this.getProps()?.currentPage ?? 1);
  readonly pageSize = computed(() => this.getProps()?.pageSize ?? 25);
  readonly rowNumberOffset = computed(() => this.hasRowNumbersCol() ? (this.currentPage() - 1) * this.pageSize() : 0);
  readonly propsVisibleColumns = computed(() => this.getProps()?.visibleColumns);
  readonly propsColumnOrder = computed(() => this.getProps()?.columnOrder);

  // State service outputs — read from narrow intermediate signals
  readonly visibleCols = computed(() => this.layoutState().visibleCols);
  readonly hasCheckboxCol = computed(() => this.layoutState().hasCheckboxCol);
  readonly hasRowNumbersCol = computed(() => this.layoutState().hasRowNumbersCol);
  readonly colOffset = computed(() => this.layoutState().colOffset);
  readonly containerWidth = computed(() => this.layoutState().containerWidth);
  readonly minTableWidth = computed(() => this.layoutState().minTableWidth);
  readonly desiredTableWidth = computed(() => this.layoutState().desiredTableWidth);
  readonly columnSizingOverrides = computed(() => this.layoutState().columnSizingOverrides);

  readonly selectedRowIds = computed(() => this.rowSelectionState().selectedRowIds);
  readonly allSelected = computed(() => this.rowSelectionState().allSelected);
  readonly someSelected = computed(() => this.rowSelectionState().someSelected);

  readonly editingCell = computed(() => this.editingState().editingCell);
  readonly pendingEditorValue = computed(() => this.editingState().pendingEditorValue);

  readonly activeCell = computed(() => this.interactionState().activeCell);
  readonly selectionRange = computed(() => this.interactionState().selectionRange);
  readonly hasCellSelection = computed(() => this.interactionState().hasCellSelection);
  readonly cutRange = computed(() => this.interactionState().cutRange);
  readonly copyRange = computed(() => this.interactionState().copyRange);
  readonly canUndo = computed(() => this.interactionState().canUndo);
  readonly canRedo = computed(() => this.interactionState().canRedo);
  readonly isDragging = computed(() => this.interactionState().isDragging);

  readonly menuPosition = computed(() => this.contextMenuState().menuPosition);
  readonly statusBarConfig = computed(() => this.viewModelsState().statusBarConfig);
  readonly showEmptyInGrid = computed(() => this.viewModelsState().showEmptyInGrid);
  readonly headerFilterInput = computed(() => this.viewModelsState().headerFilterInput);
  readonly cellDescriptorInput = computed(() => this.viewModelsState().cellDescriptorInput);

  // Pinning state
  readonly pinnedColumnsMap = computed(() => this.pinningState().pinnedColumns);

  // Virtual scrolling
  readonly vsEnabled = computed(() => this.virtualScrollService.isActive());
  readonly vsVisibleRange = computed(() => this.virtualScrollService.visibleRange());
  readonly vsTopSpacerHeight = computed(() => {
    if (!this.vsEnabled()) return 0;
    return this.vsVisibleRange().offsetTop;
  });
  readonly vsBottomSpacerHeight = computed(() => {
    if (!this.vsEnabled()) return 0;
    return this.vsVisibleRange().offsetBottom;
  });
  readonly vsVisibleItems = computed(() => {
    const items = this.items();
    if (!this.vsEnabled()) return items;
    const range = this.vsVisibleRange();
    return items.slice(range.startIndex, Math.min(range.endIndex + 1, items.length));
  });
  readonly vsStartIndex = computed(() => {
    if (!this.vsEnabled()) return 0;
    return this.vsVisibleRange().startIndex;
  });

  // Popover editing
  readonly popoverAnchorEl = computed(() => this.editingState().popoverAnchorEl);
  readonly pendingEditorValueForPopover = computed(() => this.editingState().pendingEditorValue);

  readonly allowOverflowX = computed(() => {
    const p = this.getProps();
    if (p?.suppressHorizontalScroll) return false;
    const cw = this.containerWidth();
    const mtw = this.minTableWidth();
    const dtw = this.desiredTableWidth();
    return cw > 0 && (mtw > cw || dtw > cw);
  });

  readonly selectionCellCount = computed(() => {
    const sr = this.selectionRange();
    if (!sr) return undefined;
    return (Math.abs(sr.endRow - sr.startRow) + 1) * (Math.abs(sr.endCol - sr.startCol) + 1);
  });

  // Header rows from column definition
  readonly headerRows = computed(() => {
    const p = this.getProps();
    if (!p) return [];
    return buildHeaderRows(p.columns, p.visibleColumns);
  });

  // Pre-computed column layouts
  readonly columnLayouts = computed(() => {
    const cols = this.visibleCols() as IColumnDef<T>[];
    const props = this.getProps();
    const pinnedCols = props?.pinnedColumns ?? {};
    const measuredWidths = this.measuredColumnWidths();
    const sizingOverrides = this.columnSizingOverrides();
    return cols.map((col) => {
      const runtimePinned = pinnedCols[col.columnId];
      const pinnedLeft = runtimePinned === 'left' || (col as unknown as Record<string, unknown>).pinned === 'left';
      const pinnedRight = runtimePinned === 'right' || (col as unknown as Record<string, unknown>).pinned === 'right';
      const w = this.getColumnWidth(col);
      // Use previously-measured DOM width as a minWidth floor to prevent columns
      // from shrinking when new data loads (e.g. server-side pagination).
      const hasResizeOverride = !!sizingOverrides[col.columnId];
      const measuredW = measuredWidths[col.columnId];
      const baseMinWidth = col.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH;
      const effectiveMinWidth = hasResizeOverride ? w : Math.max(baseMinWidth, measuredW ?? 0);
      return {
        col,
        pinnedLeft,
        pinnedRight,
        minWidth: effectiveMinWidth,
        width: w,
      };
    });
  });

  // Compute sticky offsets for pinned columns (single pass from both ends)
  readonly pinningOffsets = computed(() => {
    const layouts = this.columnLayouts();
    const leftOffsets: Record<string, number> = {};
    const rightOffsets: Record<string, number> = {};

    let leftAcc = 0;
    if (this.hasCheckboxCol()) leftAcc += CHECKBOX_COLUMN_WIDTH;
    if (this.hasRowNumbersCol()) leftAcc += ROW_NUMBER_COLUMN_WIDTH;
    let rightAcc = 0;

    const len = layouts.length;
    for (let i = 0; i < len; i++) {
      // Left-pinned: walk forward
      const leftLayout = layouts[i];
      if (leftLayout.pinnedLeft) {
        leftOffsets[leftLayout.col.columnId] = leftAcc;
        leftAcc += leftLayout.width + CELL_PADDING;
      }
      // Right-pinned: walk backward
      const ri = len - 1 - i;
      const rightLayout = layouts[ri];
      if (rightLayout.pinnedRight) {
        rightOffsets[rightLayout.col.columnId] = rightAcc;
        rightAcc += rightLayout.width + CELL_PADDING;
      }
    }

    return { leftOffsets, rightOffsets };
  });

  /**
   * Initialize base wiring effects. Must be called from subclass constructor.
   *
   * **Timing:** Angular requires `effect()` to be created inside an injection
   * context (constructor or field initializer). On the first run, signals like
   * `wrapperElSignal()` return `null` because the DOM hasn't been created yet.
   * After `ngAfterViewInit` sets these signals, Angular's signal graph
   * automatically re-runs each effect. The null guards inside each effect body
   * ensure the first (null) run is a safe no-op.
   *
   * Sequence:
   *   1. Constructor → `initBase()` → effects created, first run (signals null → no-ops)
   *   2. `ngAfterViewInit` → `wrapperElSignal.set(el)` → effects re-run with real values
   */
  protected initBase(): void {
    // Wire props to state service
    effect(() => {
      const p = this.getProps();
      if (p) this.stateService.props.set(p);
    });

    // Wire wrapper element (reads from signal populated by ngAfterViewInit)
    effect(() => {
      const el = this.wrapperElSignal();
      if (el) {
        this.stateService.wrapperEl.set(el);
        this.columnReorderService.wrapperEl.set(el);
      }
    });

    // Wire column reorder service inputs
    effect(() => {
      const p = this.getProps();
      if (p) {
        const cols = this.visibleCols() as IColumnDef<T>[];
        this.columnReorderService.columns.set(cols);
        this.columnReorderService.columnOrder.set(p.columnOrder);
        this.columnReorderService.onColumnOrderChange.set(p.onColumnOrderChange);
        this.columnReorderService.enabled.set(p.columnReorder === true);
      }
    });

    // Mark measurement dirty when column layout changes
    effect(() => {
      // Track signals that affect column layout
      this.visibleCols();
      this.columnSizingOverrides();
      this.columnSizingVersion();
      this.measureDirty.set(true);
    });

    // Wire virtual scroll service inputs
    effect(() => {
      const p = this.getProps();
      if (p) {
        this.virtualScrollService.totalRows.set(p.items.length);
        if (p.virtualScroll) {
          this.virtualScrollService.updateConfig({
            enabled: p.virtualScroll.enabled,
            rowHeight: p.virtualScroll.rowHeight,
            overscan: p.virtualScroll.overscan,
          });
        }
      }
    });

    // Wire wrapper element to virtual scroll for scroll events + container height
    effect(() => {
      const el = this.wrapperElSignal();
      if (el) {
        this.virtualScrollService.setContainer(el);
        this.virtualScrollService.containerHeight.set(el.clientHeight);
      }
    });
  }

  // --- Helper methods ---

  /** Lookup effective min-width for a column (includes measured width floor) */
  getEffectiveMinWidth(col: IColumnDef<T>): number {
    const layout = this.columnLayouts().find((l) => l.col.columnId === col.columnId);
    return layout?.minWidth ?? col.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH;
  }

  /**
   * Returns derived cell interaction metadata (non-event attributes) for use in templates.
   * Mirrors React's getCellInteractionProps for the Angular view layer.
   * Event handlers (mousedown, click, dblclick, contextmenu) are still bound inline in templates.
   */
  getCellInteractionProps(descriptor: { isActive: boolean; isInRange: boolean; canEditAny: boolean; globalColIndex: number; rowIndex: number }) {
    return {
      tabIndex: descriptor.isActive ? 0 : -1,
      dataRowIndex: descriptor.rowIndex,
      dataColIndex: descriptor.globalColIndex,
      dataInRange: descriptor.isInRange ? 'true' : null,
      role: descriptor.canEditAny ? 'button' : null,
    };
  }

  asColumnDef(colDef: unknown): IColumnDef<T> {
    return colDef as IColumnDef<T>;
  }

  visibleColIndex(col: IColumnDef<T>): number {
    return (this.visibleCols() as IColumnDef<T>[]).indexOf(col);
  }

  getColumnWidth(col: IColumnDef<T>): number {
    const overrides = this.columnSizingOverrides();
    const override = overrides[col.columnId];
    if (override) return override.widthPx;
    return col.defaultWidth ?? col.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH;
  }

  getFilterConfig(col: IColumnDef<T>): HeaderFilterConfig {
    return getHeaderFilterConfig(col, this.headerFilterInput());
  }

  /** Memoized column menu handlers — avoids recreating objects on every CD cycle */
  protected readonly columnMenuHandlersMap = computed(() => {
    const cols = this.visibleCols() as IColumnDef<T>[];
    const map = new Map<string, ReturnType<typeof this.buildColumnMenuHandlers>>();
    for (const col of cols) {
      map.set(col.columnId, this.buildColumnMenuHandlers(col.columnId));
    }
    return map;
  });

  /** Build column menu handler object for a single column */
  private buildColumnMenuHandlers(columnId: string) {
    return {
      onPinLeft: () => this.onPinColumn(columnId, 'left'),
      onPinRight: () => this.onPinColumn(columnId, 'right'),
      onUnpin: () => this.onUnpinColumn(columnId),
      onSortAsc: () => this.onSortAsc(columnId),
      onSortDesc: () => this.onSortDesc(columnId),
      onClearSort: () => this.onClearSort(columnId),
      onAutosizeThis: () => this.onAutosizeColumn(columnId),
      onAutosizeAll: () => this.onAutosizeAllColumns(),
      onClose: () => {}
    };
  }

  /** Get memoized handlers for a column */
  getColumnMenuHandlersMemoized(columnId: string) {
    return this.columnMenuHandlersMap().get(columnId) ?? this.buildColumnMenuHandlers(columnId);
  }

  getCellDescriptor(item: T, col: IColumnDef<T>, rowIndex: number, colIdx: number): CellRenderDescriptor {
    return getCellRenderDescriptor(item, col, rowIndex, colIdx, this.cellDescriptorInput());
  }

  resolveCellContent(col: IColumnDef<T>, item: T, displayValue: unknown): unknown {
    try {
      return resolveCellDisplayContent(col, item, displayValue);
    } catch (err) {
      const onCellError = this.getProps()?.onCellError;
      if (onCellError) {
        onCellError(err instanceof Error ? err : new Error(String(err)), undefined);
      }
      return '';
    }
  }

  resolveCellStyleFn(col: IColumnDef<T>, item: T): Record<string, string> | undefined {
    return resolveCellStyle(col, item);
  }

  buildPopoverEditorProps(item: T, col: IColumnDef<T>, descriptor: CellRenderDescriptor): unknown {
    return buildPopoverEditorProps(item, col, descriptor, this.pendingEditorValue(), {
      setPendingEditorValue: (value: unknown) => this.setPendingEditorValue(value),
      commitCellEdit: (item: T, columnId: string, oldValue: unknown, newValue: unknown, rowIndex: number, globalColIndex: number) =>
        this.commitEdit(item, columnId, oldValue, newValue, rowIndex, globalColIndex),
      cancelPopoverEdit: () => this.cancelPopoverEdit(),
    });
  }

  /** Check if a specific cell is the active cell (PrimeNG inline template helper). */
  isActiveCell(rowIndex: number, colIdx: number): boolean {
    const ac = this.activeCell();
    if (!ac) return false;
    return ac.rowIndex === rowIndex && ac.columnIndex === colIdx + this.colOffset();
  }

  /** Check if a cell is within the current selection range (PrimeNG inline template helper). */
  isInSelectionRange(rowIndex: number, colIdx: number): boolean {
    const range = this.selectionRange();
    if (!range) return false;
    const minR = Math.min(range.startRow, range.endRow);
    const maxR = Math.max(range.startRow, range.endRow);
    const minC = Math.min(range.startCol, range.endCol);
    const maxC = Math.max(range.startCol, range.endCol);
    return rowIndex >= minR && rowIndex <= maxR && colIdx >= minC && colIdx <= maxC;
  }

  /** Check if a cell is the selection end cell for fill handle display. */
  isSelectionEndCell(rowIndex: number, colIdx: number): boolean {
    const range = this.selectionRange();
    if (!range || this.isDragging() || this.copyRange() || this.cutRange()) return false;
    return rowIndex === range.endRow && colIdx === range.endCol;
  }

  /** Get cell background color based on selection state. */
  getCellBackground(rowIndex: number, colIdx: number): string | null {
    if (this.isInSelectionRange(rowIndex, colIdx)) return 'var(--ogrid-range-bg, rgba(33, 115, 70, 0.08))';
    return null;
  }

  /** Resolve editor type from column definition. */
  getEditorType(col: IColumnDef<T>, _item: T): 'text' | 'select' | 'checkbox' | 'date' | 'richSelect' {
    if (col.cellEditor === 'text' || col.cellEditor === 'select' || col.cellEditor === 'checkbox' || col.cellEditor === 'date' || col.cellEditor === 'richSelect') {
      return col.cellEditor as 'text' | 'select' | 'checkbox' | 'date' | 'richSelect';
    }
    if (col.type === 'date') return 'date';
    if (col.type === 'boolean') return 'checkbox';
    return 'text';
  }

  getSelectValues(col: IColumnDef<T>): string[] {
    const params = col.cellEditorParams;
    if (params && typeof params === 'object' && 'values' in params) {
      return (params as { values: unknown[] }).values.map(String);
    }
    return [];
  }

  formatDateForInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  }

  getPinnedLeftOffset(columnId: string): number | null {
    const offsets = this.pinningOffsets();
    return offsets.leftOffsets[columnId] ?? null;
  }

  getPinnedRightOffset(columnId: string): number | null {
    const offsets = this.pinningOffsets();
    return offsets.rightOffsets[columnId] ?? null;
  }

  // --- Virtual scroll event handler ---

  onWrapperScroll(event: Event): void {
    this.virtualScrollService.onScroll(event);
  }

  // --- Popover editor helpers ---

  setPopoverAnchorEl(el: HTMLElement | null): void {
    this.state().editing.setPopoverAnchorEl(el);
  }

  setPendingEditorValue(value: unknown): void {
    this.state().editing.setPendingEditorValue(value);
  }

  cancelPopoverEdit(): void {
    this.state().editing.cancelPopoverEdit();
  }

  commitPopoverEdit(item: T, columnId: string, oldValue: unknown, newValue: unknown, rowIndex: number, globalColIndex: number): void {
    this.state().editing.commitCellEdit(item, columnId, oldValue, newValue, rowIndex, globalColIndex);
  }

  // --- Event handlers ---

  onWrapperMouseDown(event: MouseEvent): void {
    this.lastMouseShift = event.shiftKey;
  }

  onGridKeyDown(event: KeyboardEvent): void {
    this.state().interaction.handleGridKeyDown(event);
  }

  onCellMouseDown(event: MouseEvent, rowIndex: number, globalColIndex: number): void {
    this.state().interaction.handleCellMouseDown(event, rowIndex, globalColIndex);
  }

  onCellClick(rowIndex: number, globalColIndex: number): void {
    this.state().interaction.setActiveCell?.({ rowIndex, columnIndex: globalColIndex });
  }

  onCellContextMenu(event: MouseEvent): void {
    this.state().contextMenu.handleCellContextMenu(event);
  }

  onCellDblClick(rowId: RowId, columnId: string): void {
    this.state().editing.setEditingCell({ rowId, columnId });
  }

  onFillHandleMouseDown(event: MouseEvent): void {
    this.state().interaction.handleFillHandleMouseDown?.(event);
  }

  onResizeStart(event: MouseEvent, col: IColumnDef<T>): void {
    event.preventDefault();
    // Clear cell selection before resize (like React) so selection outlines don't persist during drag
    this.state().interaction.setActiveCell?.(null);
    this.state().interaction.setSelectionRange?.(null);
    this.getWrapperRef()?.nativeElement.focus({ preventScroll: true });
    const startX = event.clientX;
    const startWidth = this.getColumnWidth(col);
    const minWidth = col.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH;

    const onMove = (e: MouseEvent) => {
      const delta = e.clientX - startX;
      const newWidth = Math.max(minWidth, startWidth + delta);
      const overrides = { ...this.columnSizingOverrides(), [col.columnId]: { widthPx: newWidth } };
      this.state().layout.setColumnSizingOverrides(overrides);
      this.columnSizingVersion.update(v => v + 1);
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      const finalWidth = this.getColumnWidth(col);
      this.state().layout.onColumnResized?.(col.columnId, finalWidth);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  onResizeDoubleClick(event: MouseEvent, col: IColumnDef<T>): void {
    event.preventDefault();
    event.stopPropagation();
    const columnId = col.columnId;
    const thEl = (event.currentTarget as HTMLElement).closest('th') ?? (event.currentTarget as HTMLElement).parentElement;
    const container = thEl?.closest('table')?.parentElement ?? undefined;
    const minWidth = col.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH;
    const idealWidth = measureColumnContentWidth(columnId, minWidth, container);
    const overrides = { ...this.columnSizingOverrides(), [columnId]: { widthPx: idealWidth } };
    this.state().layout.setColumnSizingOverrides(overrides);
    this.columnSizingVersion.update(v => v + 1);
    this.state().layout.onColumnResized?.(columnId, idealWidth);
  }

  onSelectAllChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.state().rowSelection.handleSelectAll(!!checked);
  }

  onRowClick(event: MouseEvent, rowId: RowId): void {
    const p = this.getProps();
    if (p?.rowSelection !== 'single') return;
    const ids = this.selectedRowIds();
    this.state().rowSelection.updateSelection(ids.has(rowId) ? new Set() : new Set([rowId]));
  }

  onRowCheckboxChange(rowId: RowId, event: Event, rowIndex: number): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.state().rowSelection.handleRowCheckboxChange(rowId, checked, rowIndex, this.lastMouseShift);
  }

  commitEdit(item: T, columnId: string, oldValue: unknown, newValue: unknown, rowIndex: number, globalColIndex: number): void {
    this.state().editing.commitCellEdit(item, columnId, oldValue, newValue, rowIndex, globalColIndex);
  }

  cancelEdit(): void {
    this.state().editing.setEditingCell(null);
  }

  onEditorKeydown(event: KeyboardEvent, item: T, columnId: string, oldValue: unknown, rowIndex: number, globalColIndex: number): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      const newValue = (event.target as HTMLInputElement).value;
      this.commitEdit(item, columnId, oldValue, newValue, rowIndex, globalColIndex);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelEdit();
    }
  }

  closeContextMenu(): void {
    this.state().contextMenu.closeContextMenu();
  }

  handleCopy(): void {
    this.state().interaction.handleCopy();
  }

  handleCut(): void {
    this.state().interaction.handleCut();
  }

  handlePaste(): void {
    void this.state().interaction.handlePaste();
  }

  handleSelectAllCells(): void {
    this.state().interaction.handleSelectAllCells();
  }

  onUndo(): void {
    this.state().interaction.onUndo?.();
  }

  onRedo(): void {
    this.state().interaction.onRedo?.();
  }

  onHeaderMouseDown(columnId: string, event: MouseEvent): void {
    this.columnReorderService.handleHeaderMouseDown(columnId, event);
  }

  // --- Column pinning methods ---

  onPinColumn(columnId: string, side: 'left' | 'right'): void {
    this.state().pinning.pinColumn(columnId, side);
  }

  onUnpinColumn(columnId: string): void {
    this.state().pinning.unpinColumn(columnId);
  }

  isPinned(columnId: string): 'left' | 'right' | undefined {
    return this.state().pinning.isPinned(columnId);
  }

  getPinState(columnId: string): { canPinLeft: boolean; canPinRight: boolean; canUnpin: boolean } {
    const pinned = this.isPinned(columnId);
    return {
      canPinLeft: pinned !== 'left',
      canPinRight: pinned !== 'right',
      canUnpin: !!pinned,
    };
  }

  // --- Column sorting methods ---

  onSortAsc(columnId: string): void {
    const props = this.getProps();
    props?.onColumnSort?.(columnId, 'asc');
  }

  onSortDesc(columnId: string): void {
    const props = this.getProps();
    props?.onColumnSort?.(columnId, 'desc');
  }

  onClearSort(columnId?: string): void {
    const props = this.getProps();
    const col = columnId ?? props?.sortBy;
    if (col) {
      props?.onColumnSort?.(col, null);
    }
  }

  getSortState(columnId: string): 'asc' | 'desc' | null {
    const props = this.getProps();
    if (props?.sortBy === columnId) {
      return props.sortDirection ?? 'asc';
    }
    return null;
  }

  // --- Column autosize methods ---

  onAutosizeColumn(columnId: string): void {
    const col = this.visibleCols().find((c) => c.columnId === columnId);
    if (!col) return;

    const width = measureColumnContentWidth(columnId, col.minWidth, this.tableContainerEl() ?? undefined);
    this.state().layout.setColumnSizingOverrides({
      ...this.columnSizingOverrides(),
      [columnId]: { widthPx: width },
    });
    (this.state().layout.onAutosizeColumn ?? this.state().layout.onColumnResized)?.(columnId, width);
  }

  onAutosizeAllColumns(): void {
    const tableEl = this.tableContainerEl() ?? undefined;
    const overrides: Record<string, { widthPx: number }> = {};
    for (const col of this.visibleCols()) {
      const width = measureColumnContentWidth(col.columnId, col.minWidth, tableEl);
      overrides[col.columnId] = { widthPx: width };
      (this.state().layout.onAutosizeColumn ?? this.state().layout.onColumnResized)?.(col.columnId, width);
    }
    this.state().layout.setColumnSizingOverrides({
      ...this.columnSizingOverrides(),
      ...overrides,
    });
  }
}
