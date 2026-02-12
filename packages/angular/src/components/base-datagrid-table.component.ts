import { signal, computed, effect, ElementRef } from '@angular/core';
import { DataGridStateService } from '../services/datagrid-state.service';
import { ColumnReorderService } from '../services/column-reorder.service';
import { VirtualScrollService } from '../services/virtual-scroll.service';
import {
  buildHeaderRows,
  getCellValue,
  DEFAULT_MIN_COLUMN_WIDTH,
} from '@alaarab/ogrid-core';
import {
  getHeaderFilterConfig,
  getCellRenderDescriptor,
  resolveCellDisplayContent,
  resolveCellStyle,
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
export abstract class BaseDataGridTableComponent<T = any> {
  readonly stateService = new DataGridStateService<T>();
  readonly columnReorderService = new ColumnReorderService<T>();
  readonly virtualScrollService = new VirtualScrollService();

  protected lastMouseShift = false;
  readonly columnSizingVersion = signal(0);

  // --- Abstract accessors for subclass-provided values ---

  /** Return the IOGridDataGridProps from however the subclass receives them */
  protected abstract getProps(): IOGridDataGridProps<T> | undefined;

  /** Return the wrapper element ref */
  protected abstract getWrapperRef(): ElementRef<HTMLElement> | undefined;

  /** Return the table container element ref */
  protected abstract getTableContainerRef(): ElementRef<HTMLElement> | undefined;

  // --- Delegated state ---

  readonly state = computed(() => this.stateService.getState());

  readonly tableContainerEl = computed(() => this.getTableContainerRef()?.nativeElement ?? null);

  readonly items = computed(() => this.getProps()?.items ?? []);
  readonly getRowId = computed(() => this.getProps()?.getRowId ?? ((item: T) => (item as Record<string, unknown>)['id'] as RowId));
  readonly isLoading = computed(() => this.getProps()?.isLoading ?? false);
  readonly loadingMessage = computed(() => 'Loading\u2026');
  readonly freezeRows = computed(() => this.getProps()?.freezeRows);
  readonly freezeCols = computed(() => this.getProps()?.freezeCols);
  readonly layoutModeFit = computed(() => (this.getProps()?.layoutMode ?? 'fill') === 'content');
  readonly ariaLabel = computed(() => this.getProps()?.['aria-label'] ?? 'Data grid');
  readonly ariaLabelledBy = computed(() => this.getProps()?.['aria-labelledby']);
  readonly emptyState = computed(() => this.getProps()?.emptyState);
  readonly currentPage = computed(() => this.getProps()?.currentPage ?? 1);
  readonly pageSize = computed(() => this.getProps()?.pageSize ?? 25);
  readonly rowNumberOffset = computed(() => this.hasRowNumbersCol() ? (this.currentPage() - 1) * this.pageSize() : 0);

  // State service outputs
  readonly visibleCols = computed(() => this.state().layout.visibleCols);
  readonly hasCheckboxCol = computed(() => this.state().layout.hasCheckboxCol);
  readonly hasRowNumbersCol = computed(() => this.state().layout.hasRowNumbersCol);
  readonly colOffset = computed(() => this.state().layout.colOffset);
  readonly containerWidth = computed(() => this.state().layout.containerWidth);
  readonly minTableWidth = computed(() => this.state().layout.minTableWidth);
  readonly desiredTableWidth = computed(() => this.state().layout.desiredTableWidth);
  readonly columnSizingOverrides = computed(() => this.state().layout.columnSizingOverrides);

  readonly selectedRowIds = computed(() => this.state().rowSelection.selectedRowIds);
  readonly allSelected = computed(() => this.state().rowSelection.allSelected);
  readonly someSelected = computed(() => this.state().rowSelection.someSelected);

  readonly editingCell = computed(() => this.state().editing.editingCell);
  readonly pendingEditorValue = computed(() => this.state().editing.pendingEditorValue);

  readonly activeCell = computed(() => this.state().interaction.activeCell);
  readonly selectionRange = computed(() => this.state().interaction.selectionRange);
  readonly hasCellSelection = computed(() => this.state().interaction.hasCellSelection);
  readonly cutRange = computed(() => this.state().interaction.cutRange);
  readonly copyRange = computed(() => this.state().interaction.copyRange);
  readonly canUndo = computed(() => this.state().interaction.canUndo);
  readonly canRedo = computed(() => this.state().interaction.canRedo);
  readonly isDragging = computed(() => this.state().interaction.isDragging);

  readonly menuPosition = computed(() => this.state().contextMenu.menuPosition);
  readonly statusBarConfig = computed(() => this.state().viewModels.statusBarConfig);
  readonly showEmptyInGrid = computed(() => this.state().viewModels.showEmptyInGrid);
  readonly headerFilterInput = computed(() => this.state().viewModels.headerFilterInput);
  readonly cellDescriptorInput = computed(() => this.state().viewModels.cellDescriptorInput);

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
    const fc = this.freezeCols();
    const props = this.getProps();
    const pinnedCols = props?.pinnedColumns ?? {};
    return cols.map((col, colIdx) => {
      const isFreezeCol = fc != null && fc >= 1 && colIdx < fc;
      const runtimePinned = pinnedCols[col.columnId];
      const pinnedLeft = runtimePinned === 'left' || (col as any).pinned === 'left' || (isFreezeCol && colIdx === 0);
      const pinnedRight = runtimePinned === 'right' || (col as any).pinned === 'right';
      const w = this.getColumnWidth(col);
      return {
        col,
        pinnedLeft,
        pinnedRight,
        minWidth: col.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH,
        width: w,
      };
    });
  });

  /**
   * Initialize base wiring effects. Must be called from subclass constructor
   * (effects need to run inside an injection context).
   */
  protected initBase(): void {
    // Wire props to state service
    effect(() => {
      const p = this.getProps();
      if (p) this.stateService.props.set(p);
    });

    // Wire wrapper element
    effect(() => {
      const el = this.getWrapperRef()?.nativeElement;
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
        this.columnReorderService.enabled.set(!!p.onColumnOrderChange);
      }
    });

    // Wire virtual scroll service inputs
    effect(() => {
      const p = this.getProps();
      if (p) {
        this.virtualScrollService.totalRows.set(p.items.length);
      }
    });
  }

  // --- Helper methods ---

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

  getCellDescriptor(item: T, col: IColumnDef<T>, rowIndex: number, colIdx: number): CellRenderDescriptor {
    return getCellRenderDescriptor(item, col, rowIndex, colIdx, this.cellDescriptorInput());
  }

  resolveCellContent(col: IColumnDef<T>, item: T, displayValue: unknown): string {
    return resolveCellDisplayContent(col, item, displayValue);
  }

  resolveCellStyleFn(col: IColumnDef<T>, item: T): Record<string, string> | undefined {
    return resolveCellStyle(col, item);
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
    this.state().interaction.setActiveCell({ rowIndex, columnIndex: globalColIndex });
  }

  onCellContextMenu(event: MouseEvent): void {
    this.state().contextMenu.handleCellContextMenu(event);
  }

  onCellDblClick(rowId: RowId, columnId: string): void {
    this.state().editing.setEditingCell({ rowId, columnId });
  }

  onFillHandleMouseDown(event: MouseEvent): void {
    this.state().interaction.handleFillHandleMouseDown(event);
  }

  onResizeStart(event: MouseEvent, col: IColumnDef<T>): void {
    event.preventDefault();
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
    const props = this.getProps();
    props?.onColumnPinned?.(columnId, side);
  }

  onUnpinColumn(columnId: string): void {
    const props = this.getProps();
    props?.onColumnPinned?.(columnId, null);
  }

  isPinned(columnId: string): 'left' | 'right' | undefined {
    const props = this.getProps();
    return props?.pinnedColumns?.[columnId];
  }

  getPinState(columnId: string): { canPinLeft: boolean; canPinRight: boolean; canUnpin: boolean } {
    const pinned = this.isPinned(columnId);
    return {
      canPinLeft: pinned !== 'left',
      canPinRight: pinned !== 'right',
      canUnpin: !!pinned,
    };
  }
}
