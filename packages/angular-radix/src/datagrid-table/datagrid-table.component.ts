import {
  Component, input, signal, computed, effect,
  ChangeDetectionStrategy, ElementRef, viewChild,
} from '@angular/core';
import {
  DataGridStateService,
  ColumnReorderService,
  VirtualScrollService,
  StatusBarComponent,
  GridContextMenuComponent,
  MarchingAntsOverlayComponent,
  EmptyStateComponent,
  buildHeaderRows,
  getCellValue,
  CHECKBOX_COLUMN_WIDTH,
  DEFAULT_MIN_COLUMN_WIDTH,
  getHeaderFilterConfig,
  getCellRenderDescriptor,
  resolveCellDisplayContent,
  resolveCellStyle,
} from '@alaarab/ogrid-angular';
import type {
  IOGridDataGridProps,
  IColumnDef,
  RowId,
  CellRenderDescriptor,
  HeaderFilterConfig,
} from '@alaarab/ogrid-angular';
import { ColumnHeaderFilterComponent } from '../column-header-filter/column-header-filter.component';

/**
 * DataGridTable component for Angular Radix using native HTML table.
 * Standalone component with lightweight styling and CSS variables.
 */
@Component({
  selector: 'ogrid-datagrid-table',
  standalone: true,
  imports: [ColumnHeaderFilterComponent, StatusBarComponent, GridContextMenuComponent, MarchingAntsOverlayComponent, EmptyStateComponent],
  providers: [DataGridStateService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './datagrid-table.component.scss',
  template: `
    <div class="ogrid-datagrid-root">
      <div
        #wrapperEl
        class="ogrid-datagrid-wrapper"
        [class.ogrid-datagrid-wrapper--fit]="layoutModeFit()"
        [class.ogrid-datagrid-wrapper--overflow-x]="allowOverflowX()"
        tabindex="0"
        role="region"
        [attr.aria-label]="ariaLabel()"
        [attr.aria-labelledby]="ariaLabelledBy()"
        (mousedown)="onWrapperMouseDown($event)"
        (keydown)="onGridKeyDown($event)"
        (contextmenu)="$event.preventDefault()"
        [attr.data-overflow-x]="allowOverflowX() ? 'true' : 'false'"
      >
        <div class="ogrid-datagrid-scroll-wrapper">
          <div [style.minWidth.px]="allowOverflowX() ? minTableWidth() : undefined">
            <div [class.ogrid-datagrid-table-wrapper--loading]="isLoading() && items().length > 0" #tableContainerEl>
              <table class="ogrid-datagrid-table" [style.minWidth.px]="minTableWidth()"
                [attr.data-freeze-rows]="freezeRows()"
                [attr.data-freeze-cols]="freezeCols()"
              >
                <thead class="ogrid-datagrid-thead">
                  @for (row of headerRows(); track $index; let rowIdx = $index) {
                    <tr class="ogrid-datagrid-header-row">
                      @if (rowIdx === headerRows().length - 1 && hasCheckboxCol()) {
                        <th class="ogrid-datagrid-th ogrid-datagrid-checkbox-col" [attr.rowSpan]="headerRows().length > 1 ? 1 : null">
                          <div class="ogrid-datagrid-checkbox-wrapper">
                            <input
                              type="checkbox"
                              [checked]="allSelected()"
                              [indeterminate]="someSelected()"
                              (change)="onSelectAllChange($event)"
                              aria-label="Select all rows"
                            />
                          </div>
                        </th>
                      }
                      @if (rowIdx === 0 && rowIdx < headerRows().length - 1 && hasCheckboxCol()) {
                        <th [attr.rowSpan]="headerRows().length - 1" class="ogrid-datagrid-th" style="width: 48px; min-width: 48px; padding: 0;"></th>
                      }
                      @for (cell of row; track $index; let cellIdx = $index) {
                        @if (cell.isGroup) {
                          <th [attr.colSpan]="cell.colSpan" scope="colgroup" class="ogrid-datagrid-th ogrid-datagrid-group-header">
                            {{ cell.label }}
                          </th>
                        } @else {
                          @let col = asColumnDef(cell.columnDef);
                          @let colIdx = visibleColIndex(col);
                          @let isFreezeCol = freezeCols() != null && (freezeCols() ?? 0) >= 1 && colIdx < (freezeCols() ?? 0);
                          @let colW = getColumnWidth(col);
                          <th scope="col"
                            class="ogrid-datagrid-th"
                            [class.ogrid-datagrid-th--pinned-left]="col.pinned === 'left' || (isFreezeCol && colIdx === 0)"
                            [class.ogrid-datagrid-th--pinned-right]="col.pinned === 'right'"
                            [attr.rowSpan]="headerRows().length > 1 ? headerRows().length - rowIdx : null"
                            [attr.data-column-id]="col.columnId"
                            [style.minWidth.px]="col.minWidth ?? 80"
                            [style.width.px]="colW"
                            [style.maxWidth.px]="colW"
                            [style.cursor]="columnReorderService.isDragging() ? 'grabbing' : 'grab'"
                            (mousedown)="onHeaderMouseDown(col.columnId, $event)"
                          >
                            <column-header-filter
                              [columnKey]="col.columnId"
                              [columnName]="col.name"
                              [filterType]="getFilterConfig(col).filterType"
                              [isSorted]="getFilterConfig(col).isSorted"
                              [isSortedDescending]="getFilterConfig(col).isSortedDescending"
                              [onSort]="getFilterConfig(col).onSort"
                              [selectedValues]="getFilterConfig(col).selectedValues"
                              [onFilterChange]="getFilterConfig(col).onFilterChange"
                              [options]="getFilterConfig(col).options"
                              [isLoadingOptions]="getFilterConfig(col).isLoadingOptions ?? false"
                              [textValue]="getFilterConfig(col).textValue ?? ''"
                              [onTextChange]="getFilterConfig(col).onTextChange"
                              [selectedUser]="getFilterConfig(col).selectedUser"
                              [onUserChange]="getFilterConfig(col).onUserChange"
                              [peopleSearch]="getFilterConfig(col).peopleSearch"
                              [dateValue]="getFilterConfig(col).dateValue"
                              [onDateChange]="getFilterConfig(col).onDateChange"
                            />
                            <div class="ogrid-datagrid-resize-handle" (mousedown)="onResizeStart($event, col)"></div>
                          </th>
                        }
                      }
                    </tr>
                  }
                </thead>
                @if (!showEmptyInGrid()) {
                  <tbody>
                    @for (item of items(); track getRowId()(item); let rowIndex = $index) {
                      @let rowId = getRowId()(item);
                      @let isSelected = selectedRowIds().has(rowId);
                      <tr
                        class="ogrid-datagrid-row"
                        [class.ogrid-datagrid-row--selected]="isSelected"
                        [attr.data-row-id]="rowId"
                        (click)="onRowClick($event, rowId)"
                      >
                        @if (hasCheckboxCol()) {
                          <td class="ogrid-datagrid-td ogrid-datagrid-checkbox-col">
                            <div
                              class="ogrid-datagrid-checkbox-wrapper"
                              [attr.data-row-index]="rowIndex"
                              [attr.data-col-index]="0"
                              (click)="$event.stopPropagation()"
                            >
                              <input
                                type="checkbox"
                                [checked]="isSelected"
                                (change)="onRowCheckboxChange(rowId, $event, rowIndex)"
                                [attr.aria-label]="'Select row ' + (rowIndex + 1)"
                              />
                            </div>
                          </td>
                        }
                        @for (colLayout of columnLayouts(); track colLayout.col.columnId; let colIdx = $index) {
                          <td
                            class="ogrid-datagrid-td"
                            [class.ogrid-datagrid-td--pinned-left]="colLayout.pinnedLeft"
                            [class.ogrid-datagrid-td--pinned-right]="colLayout.pinnedRight"
                            [style.minWidth.px]="colLayout.minWidth"
                            [style.width.px]="colLayout.width"
                            [style.maxWidth.px]="colLayout.width"
                          >
                            @let descriptor = getCellDescriptor(item, colLayout.col, rowIndex, colIdx);
                            @if (descriptor.mode === 'editing-inline') {
                              <div class="ogrid-datagrid-cell ogrid-datagrid-cell--editing">
                                @switch (descriptor.editorType) {
                                  @case ('checkbox') {
                                    <input
                                      type="checkbox"
                                      [checked]="!!descriptor.value"
                                      (change)="commitEdit(item, colLayout.col.columnId, descriptor.value, ($event.target as HTMLInputElement).checked, rowIndex, descriptor.globalColIndex)"
                                      (keydown)="$event.key === 'Escape' && cancelEdit()"
                                    />
                                  }
                                  @case ('select') {
                                    <select
                                      class="ogrid-datagrid-editor-select"
                                      [value]="descriptor.value != null ? '' + descriptor.value : ''"
                                      (change)="commitEdit(item, colLayout.col.columnId, descriptor.value, ($event.target as HTMLSelectElement).value, rowIndex, descriptor.globalColIndex)"
                                      (keydown)="$event.key === 'Escape' && cancelEdit()"
                                    >
                                      @for (v of getSelectValues(colLayout.col); track v) {
                                        <option [value]="v">{{ v }}</option>
                                      }
                                    </select>
                                  }
                                  @case ('date') {
                                    <input
                                      type="date"
                                      class="ogrid-datagrid-editor-input"
                                      [value]="formatDateForInput(descriptor.value)"
                                      (change)="commitEdit(item, colLayout.col.columnId, descriptor.value, ($event.target as HTMLInputElement).value, rowIndex, descriptor.globalColIndex)"
                                      (keydown)="onEditorKeydown($event, item, colLayout.col.columnId, descriptor.value, rowIndex, descriptor.globalColIndex)"
                                    />
                                  }
                                  @default {
                                    <input
                                      type="text"
                                      class="ogrid-datagrid-editor-input"
                                      [value]="descriptor.value != null ? '' + descriptor.value : ''"
                                      (keydown)="onEditorKeydown($event, item, colLayout.col.columnId, descriptor.value, rowIndex, descriptor.globalColIndex)"
                                    />
                                  }
                                }
                              </div>
                            } @else {
                              @let content = resolveCellContent(colLayout.col, item, descriptor.displayValue);
                              @let cellStyle = resolveCellStyleFn(colLayout.col, item);
                              <div
                                class="ogrid-datagrid-cell"
                                [class.ogrid-datagrid-cell--active]="descriptor.isActive && !descriptor.isInRange"
                                [class.ogrid-datagrid-cell--in-range]="descriptor.isInRange"
                                [class.ogrid-datagrid-cell--in-cut-range]="descriptor.isInCutRange"
                                [class.ogrid-datagrid-cell--editable]="descriptor.canEditAny"
                                [class.ogrid-datagrid-cell--numeric]="colLayout.col.type === 'numeric'"
                                [class.ogrid-datagrid-cell--boolean]="colLayout.col.type === 'boolean'"
                                [attr.data-row-index]="rowIndex"
                                [attr.data-col-index]="descriptor.globalColIndex"
                                [attr.data-in-range]="descriptor.isInRange ? 'true' : null"
                                [attr.tabindex]="descriptor.isActive ? 0 : -1"
                                (mousedown)="onCellMouseDown($event, rowIndex, descriptor.globalColIndex)"
                                (click)="onCellClick(rowIndex, descriptor.globalColIndex)"
                                (contextmenu)="onCellContextMenu($event)"
                                (dblclick)="descriptor.canEditAny ? onCellDblClick(descriptor.rowId, colLayout.col.columnId) : null"
                                [attr.role]="descriptor.canEditAny ? 'button' : null"
                                [style]="cellStyle ?? undefined"
                              >
                                {{ content }}
                                @if (descriptor.canEditAny && descriptor.isSelectionEndCell) {
                                  <div
                                    class="ogrid-datagrid-fill-handle"
                                    (mousedown)="onFillHandleMouseDown($event)"
                                    aria-label="Fill handle"
                                  ></div>
                                }
                              </div>
                            }
                          </td>
                        }
                      </tr>
                    }
                  </tbody>
                }
              </table>

              <ogrid-marching-ants-overlay
                [containerEl]="tableContainerEl()"
                [selectionRange]="state().interaction.selectionRange"
                [copyRange]="state().interaction.copyRange"
                [cutRange]="state().interaction.cutRange"
                [colOffset]="state().layout.colOffset"
                [columnSizingVersion]="columnSizingVersion()"
              ></ogrid-marching-ants-overlay>

              @if (showEmptyInGrid() && emptyState()) {
                <div class="ogrid-datagrid-empty">
                  <div class="ogrid-datagrid-empty__title">No results found</div>
                  <div class="ogrid-datagrid-empty__message">
                    @if (emptyState()!.message != null) {
                      {{ emptyState()!.message }}
                    } @else if (emptyState()!.hasActiveFilters) {
                      No items match your current filters. Try adjusting your search or
                      <button class="ogrid-datagrid-empty__clear" (click)="emptyState()!.onClearAll?.()">clear all filters</button>
                      to see all items.
                    } @else {
                      There are no items available at this time.
                    }
                  </div>
                </div>
              }
            </div>
          </div>
        </div>

        @if (columnReorderService.isDragging() && columnReorderService.dropIndicatorX() !== null) {
          <div class="ogrid-datagrid-drop-indicator" [style.left.px]="columnReorderService.dropIndicatorX()"></div>
        }

        @if (menuPosition()) {
          <div
            class="ogrid-datagrid-context-menu-overlay"
            (click)="closeContextMenu()"
            (contextmenu)="$event.preventDefault(); closeContextMenu()"
          >
            <ogrid-grid-context-menu
              [x]="menuPosition()!.x"
              [y]="menuPosition()!.y"
              [hasSelection]="hasCellSelection()"
              [canUndo]="canUndo()"
              [canRedo]="canRedo()"
              (undoAction)="onUndo()"
              (redoAction)="onRedo()"
              (copyAction)="handleCopy()"
              (cutAction)="handleCut()"
              (pasteAction)="handlePaste()"
              (selectAllAction)="handleSelectAllCells()"
              (closeAction)="closeContextMenu()"
            />
          </div>
        }
      </div>

      @if (statusBarConfig()) {
        <ogrid-status-bar
          [totalCount]="statusBarConfig()!.totalCount"
          [filteredCount]="statusBarConfig()!.filteredCount"
          [selectedCount]="statusBarConfig()!.selectedCount ?? selectedRowIds().size"
          [selectedCellCount]="selectionCellCount()"
          [aggregation]="statusBarConfig()!.aggregation"
          [suppressRowCount]="statusBarConfig()!.suppressRowCount"
        />
      }

      @if (isLoading()) {
        <div class="ogrid-datagrid-loading-overlay">
          <div class="ogrid-datagrid-loading-inner">
            <div class="ogrid-datagrid-spinner"></div>
            <span>{{ loadingMessage() }}</span>
          </div>
        </div>
      }
    </div>
  `,
})
export class DataGridTableComponent<T> {
  readonly propsInput = input.required<IOGridDataGridProps<T>>({ alias: 'props' });

  private readonly wrapperRef = viewChild<ElementRef<HTMLElement>>('wrapperEl');
  private readonly tableContainerRef = viewChild<ElementRef<HTMLElement>>('tableContainerEl');
  private readonly stateService = new DataGridStateService<T>();
  readonly columnReorderService = new ColumnReorderService<T>();
  readonly virtualScrollService = new VirtualScrollService();

  private lastMouseShift = false;
  private columnSizingVersion = signal(0);

  constructor() {
    // Wire props and wrapper element to state service
    effect(() => {
      const p = this.propsInput();
      if (p) this.stateService.props.set(p);
    });

    effect(() => {
      const el = this.wrapperRef()?.nativeElement;
      if (el) {
        this.stateService.wrapperEl.set(el);
        this.columnReorderService.wrapperEl.set(el);
      }
    });

    // Wire column reorder service inputs
    effect(() => {
      const p = this.propsInput();
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
      const p = this.propsInput();
      if (p) {
        this.virtualScrollService.totalRows.set(p.items.length);
      }
    });
  }

  // --- Delegated state ---

  private readonly state = computed(() => this.stateService.getState());

  readonly items = computed(() => this.propsInput()?.items ?? []);
  readonly getRowId = computed(() => this.propsInput()?.getRowId ?? ((item: T) => (item as Record<string, unknown>)['id'] as RowId));
  readonly isLoading = computed(() => this.propsInput()?.isLoading ?? false);
  readonly loadingMessage = computed(() => 'Loading\u2026');
  readonly freezeRows = computed(() => this.propsInput()?.freezeRows);
  readonly freezeCols = computed(() => this.propsInput()?.freezeCols);
  readonly layoutModeFit = computed(() => (this.propsInput()?.layoutMode ?? 'fill') === 'content');
  readonly ariaLabel = computed(() => this.propsInput()?.['aria-label'] ?? 'Data grid');
  readonly ariaLabelledBy = computed(() => this.propsInput()?.['aria-labelledby']);
  readonly emptyState = computed(() => this.propsInput()?.emptyState);

  // State service outputs
  readonly visibleCols = computed(() => this.state().layout.visibleCols);
  readonly hasCheckboxCol = computed(() => this.state().layout.hasCheckboxCol);
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
    const p = this.propsInput();
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
    const p = this.propsInput();
    if (!p) return [];
    return buildHeaderRows(p.columns, p.visibleColumns);
  });

  // Pre-computed column layouts
  readonly columnLayouts = computed(() => {
    const cols = this.visibleCols() as IColumnDef<T>[];
    const fc = this.freezeCols();
    return cols.map((col, colIdx) => {
      const isFreezeCol = fc != null && fc >= 1 && colIdx < fc;
      const pinnedLeft = col.pinned === 'left' || (isFreezeCol && colIdx === 0);
      const pinnedRight = col.pinned === 'right';
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
    const p = this.propsInput();
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
}
