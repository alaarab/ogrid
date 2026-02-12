import {
  Component,
  input,
  signal,
  computed,
  effect,
  ElementRef,
  viewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import {
  BaseDataGridTableComponent,
  DataGridStateService,
  StatusBarComponent,
  GridContextMenuComponent,
  MarchingAntsOverlayComponent,
  EmptyStateComponent,
  DEFAULT_MIN_COLUMN_WIDTH,
  getCellValue,
  resolveCellDisplayContent,
  resolveCellStyle,
} from '@alaarab/ogrid-angular';
import type {
  IOGridDataGridProps,
  IColumnDef,
  IColumnGroupDef,
  RowId,
} from '@alaarab/ogrid-angular';
import { ColumnHeaderFilterComponent } from '../column-header-filter/column-header-filter.component';
import { ColumnHeaderMenuComponent } from '../column-header-menu/column-header-menu.component';
import { InlineCellEditorComponent } from './inline-cell-editor.component';

@Component({
  selector: 'ogrid-primeng-datagrid-table',
  standalone: true,
  imports: [
    StatusBarComponent,
    GridContextMenuComponent,
    MarchingAntsOverlayComponent,
    EmptyStateComponent,
    ColumnHeaderFilterComponent,
    ColumnHeaderMenuComponent,
    InlineCellEditorComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [DataGridStateService],
  template: `
    <div style="position:relative;flex:1;min-height:0;display:flex;flex-direction:column">
      <div
        #wrapper
        tabindex="0"
        role="region"
        [attr.aria-label]="resolvedAriaLabel()"
        [attr.aria-labelledby]="ariaLabelledBy()"
        [attr.data-empty]="showEmptyInGrid() ? 'true' : null"
        [attr.data-column-count]="state().layout.totalColCount"
        [attr.data-freeze-rows]="freezeRows() != null && freezeRows()! >= 1 ? freezeRows() : null"
        [attr.data-freeze-cols]="freezeCols() != null && freezeCols()! >= 1 ? freezeCols() : null"
        [attr.data-overflow-x]="allowOverflowX() ? 'true' : 'false'"
        [attr.data-has-selection]="rowSelectionMode() !== 'none' ? 'true' : null"
        (contextmenu)="$event.preventDefault()"
        (keydown)="onGridKeyDown($event)"
        (mousedown)="onWrapperMouseDown($event)"
        style="flex:1;min-height:0;overflow:auto;outline:none;position:relative;font-size:13px;color:var(--ogrid-fg, #242424)"
        [style.--data-table-column-count]="state().layout.totalColCount"
        [style.--data-table-width]="tableWidthStyle()"
        [style.--data-table-min-width]="tableMinWidthStyle()"
      >
        <div style="position:relative">
          <div [class.loading-dimmed]="isLoading() && items().length > 0" style="position:relative">
            <div #tableContainer style="position:relative">
              <table
                style="width:var(--data-table-width, 100%);min-width:var(--data-table-min-width, 100%);border-collapse:collapse;table-layout:fixed"
              >
                <thead style="position:sticky;top:0;z-index:3;background:var(--ogrid-header-bg, #f5f5f5)">
                  @for (row of headerRows(); track $index; let rowIdx = $index) {
                    <tr>
                      @if (rowIdx === headerRows().length - 1 && hasCheckboxCol()) {
                        <th
                          scope="col"
                          rowSpan="1"
                          style="width:48px;min-width:48px;max-width:48px;padding:6px 4px;text-align:center;border-bottom:1px solid var(--ogrid-border, #e0e0e0)"
                        >
                          <input
                            type="checkbox"
                            [checked]="allSelected()"
                            [indeterminate]="someSelected() && !allSelected()"
                            (change)="onSelectAllChangePrimeng($any($event.target).checked)"
                            aria-label="Select all rows"
                          />
                        </th>
                      }
                      @if (rowIdx === 0 && rowIdx < headerRows().length - 1 && hasCheckboxCol()) {
                        <th [attr.rowSpan]="headerRows().length - 1"></th>
                      }
                      @if (rowIdx === headerRows().length - 1 && hasRowNumbersCol()) {
                        <th
                          scope="col"
                          rowSpan="1"
                          style="width:50px;min-width:50px;max-width:50px;padding:6px;text-align:center;font-weight:600;background:var(--ogrid-bg-subtle,#fafafa);color:var(--ogrid-text-secondary,#666);border-bottom:1px solid var(--ogrid-border,#e0e0e0);position:sticky;left:0;z-index:4"
                        >
                          #
                        </th>
                      }
                      @if (rowIdx === 0 && rowIdx < headerRows().length - 1 && hasRowNumbersCol()) {
                        <th [attr.rowSpan]="headerRows().length - 1" style="width:50px;min-width:50px"></th>
                      }
                      @for (cell of row; track $index; let cellIdx = $index) {
                        @if (cell.isGroup) {
                          <th
                            [attr.colSpan]="cell.colSpan"
                            scope="colgroup"
                            style="padding:6px 8px;text-align:center;font-weight:600;border-bottom:1px solid var(--ogrid-border, #e0e0e0)"
                          >
                            {{ cell.label }}
                          </th>
                        } @else {
                          @let col = asColumnDef(cell.columnDef);
                          @let pinned = isPinned(col.columnId);
                          <th
                            scope="col"
                            [attr.data-column-id]="col.columnId"
                            [attr.rowSpan]="headerRows().length > 1 && rowIdx < headerRows().length - 1 ? headerRows().length - rowIdx : null"
                            [class.ogrid-th-pinned-left]="pinned === 'left'"
                            [class.ogrid-th-pinned-right]="pinned === 'right'"
                            style="padding:6px 8px;text-align:left;font-weight:600;border-bottom:1px solid var(--ogrid-border, #e0e0e0);position:relative"
                            [style.min-width.px]="col.minWidth ?? defaultMinWidth"
                            [style.width.px]="getColumnWidth(col)"
                            [style.max-width.px]="getColumnWidth(col)"
                            [style.cursor]="columnReorderService.isDragging() ? 'grabbing' : 'grab'"
                            (mousedown)="onHeaderMouseDown(col.columnId, $event)"
                          >
                            <div style="display:flex;align-items:center;gap:4px;">
                              <ogrid-primeng-column-header-filter
                                [columnKey]="col.columnId"
                                [columnName]="col.name"
                                [filterType]="getFilterConfig(col).filterType"
                                [isSorted]="getFilterConfig(col).isSorted ?? false"
                                [isSortedDescending]="getFilterConfig(col).isSortedDescending ?? false"
                                [onSort]="getFilterConfig(col).onSort"
                                [selectedValues]="getFilterConfig(col).selectedValues"
                                [onFilterChange]="getFilterConfig(col).onFilterChange"
                                [options]="getFilterConfig(col).options ?? []"
                                [isLoadingOptions]="getFilterConfig(col).isLoadingOptions ?? false"
                                [textValue]="getFilterConfig(col).textValue ?? ''"
                                [onTextChange]="getFilterConfig(col).onTextChange"
                                [selectedUser]="getFilterConfig(col).selectedUser"
                                [onUserChange]="getFilterConfig(col).onUserChange"
                                [peopleSearch]="getFilterConfig(col).peopleSearch"
                                [dateValue]="getFilterConfig(col).dateValue"
                                [onDateChange]="getFilterConfig(col).onDateChange"
                              ></ogrid-primeng-column-header-filter>
                              @let colPinState = getPinState(col.columnId);
                              <column-header-menu
                                [columnId]="col.columnId"
                                [onPinLeft]="() => onPinColumn(col.columnId, 'left')"
                                [onPinRight]="() => onPinColumn(col.columnId, 'right')"
                                [onUnpin]="() => onUnpinColumn(col.columnId)"
                                [canPinLeft]="colPinState.canPinLeft"
                                [canPinRight]="colPinState.canPinRight"
                                [canUnpin]="colPinState.canUnpin"
                              />
                            </div>
                            <div
                              style="position:absolute;top:0;right:0;bottom:0;width:4px;cursor:col-resize"
                              (mousedown)="onResizeStartPrimeng($event, col)"
                              [attr.aria-label]="'Resize ' + col.name"
                            ></div>
                          </th>
                        }
                      }
                    </tr>
                  }
                </thead>

                @if (!showEmptyInGrid()) {
                  <tbody>
                    @for (item of items(); track trackByRowId($index, item); let rowIndex = $index) {
                      @let rowId = getRowIdInput()(item);
                      @let isSelected = selectedRowIds().has(rowId);
                      <tr
                        [attr.data-row-id]="rowId"
                        [style.background]="isSelected ? 'var(--ogrid-selected-bg, #e8f0fe)' : null"
                        (click)="onRowClickPrimeng($event, item)"
                      >
                        @if (hasCheckboxCol()) {
                          <td
                            style="width:48px;min-width:48px;max-width:48px;padding:6px 4px;text-align:center;border-bottom:1px solid var(--ogrid-border, #f0f0f0)"
                            [attr.data-row-index]="rowIndex"
                            [attr.data-col-index]="0"
                            (click)="$event.stopPropagation()"
                          >
                            <input
                              type="checkbox"
                              [checked]="isSelected"
                              (change)="onRowCheckboxChangePrimeng(item, $any($event.target).checked, rowIndex, $event)"
                              [attr.aria-label]="'Select row ' + (rowIndex + 1)"
                            />
                          </td>
                        }
                        @if (hasRowNumbersCol()) {
                          <td
                            style="width:50px;min-width:50px;max-width:50px;padding:6px;text-align:center;font-weight:600;font-variant-numeric:tabular-nums;color:var(--ogrid-text-secondary,#666);background:var(--ogrid-bg-subtle,#fafafa);border-bottom:1px solid var(--ogrid-border,#f0f0f0);position:sticky;left:0;z-index:3"
                          >
                            {{ rowNumberOffset() + rowIndex + 1 }}
                          </td>
                        }
                        @for (col of visibleCols(); track col.columnId; let colIdx = $index) {
                          @let pinned = isPinned(col.columnId);
                          <td
                            [class.ogrid-td-pinned-left]="pinned === 'left'"
                            [class.ogrid-td-pinned-right]="pinned === 'right'"
                            style="padding:0;border-bottom:1px solid var(--ogrid-border, #f0f0f0);position:relative"
                            [style.min-width.px]="col.minWidth ?? defaultMinWidth"
                            [style.width.px]="getColumnWidth(col)"
                            [style.max-width.px]="getColumnWidth(col)"
                            [style.text-align]="col.type === 'numeric' ? 'right' : col.type === 'boolean' ? 'center' : null"
                          >
                            @if (isEditingCell(item, col)) {
                              <ogrid-primeng-inline-cell-editor
                                [value]="getCellValueFn(item, col)"
                                [item]="item"
                                [column]="col"
                                [rowIndex]="rowIndex"
                                [editorType]="getEditorType(col, item)"
                                (commit)="onCellEditorCommit(item, col, rowIndex, colIdx, $event)"
                                (cancel)="cancelEdit()"
                              ></ogrid-primeng-inline-cell-editor>
                            } @else {
                              <div
                                [attr.data-row-index]="rowIndex"
                                [attr.data-col-index]="colIdx + colOffset()"
                                (mousedown)="onCellMouseDown($event, rowIndex, colIdx + colOffset())"
                                (dblclick)="onCellDblClickPrimeng(item, col, rowIndex, colIdx)"
                                (contextmenu)="onCellContextMenu($event)"
                                style="padding:6px 10px;min-height:20px;cursor:default;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
                                [style.cursor]="canEditCell(col, item) ? 'cell' : 'default'"
                                [style.background]="getCellBackground(rowIndex, colIdx)"
                                [style.outline]="isActiveCell(rowIndex, colIdx) ? '2px solid var(--ogrid-selection, #217346)' : null"
                                [style.outline-offset]="isActiveCell(rowIndex, colIdx) ? '-2px' : null"
                              >
                                <span [style]="getCellStyleObj(col, item)">{{ resolveCellDisplay(col, item) }}</span>
                                @if (canEditCell(col, item) && isSelectionEndCell(rowIndex, colIdx)) {
                                  <div
                                    (mousedown)="onFillHandleMouseDown($event)"
                                    style="position:absolute;bottom:-3px;right:-3px;width:7px;height:7px;background:var(--ogrid-selection, #217346);cursor:crosshair;z-index:2"
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
                <div style="display:flex;align-items:center;justify-content:center;padding:48px 24px;text-align:center;color:var(--ogrid-muted, #999)">
                  <div>
                    <div style="font-weight:600;margin-bottom:8px">No results found</div>
                    <ogrid-empty-state
                      [message]="emptyState()?.message"
                      [hasActiveFilters]="emptyState()?.hasActiveFilters ?? false"
                      [render]="emptyState()?.render"
                      (clearAll)="emptyState()?.onClearAll()"
                    ></ogrid-empty-state>
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      </div>

      @if (columnReorderService.isDragging() && columnReorderService.dropIndicatorX() !== null) {
        <div class="ogrid-drop-indicator" [style.left.px]="columnReorderService.dropIndicatorX()"></div>
      }

      @if (menuPosition()) {
        <ogrid-context-menu
          [x]="menuPosition()!.x"
          [y]="menuPosition()!.y"
          [hasSelection]="hasCellSelection()"
          [canUndoProp]="canUndo()"
          [canRedoProp]="canRedo()"
          (copy)="handleCopy()"
          (cut)="handleCut()"
          (paste)="handlePaste()"
          (selectAll)="handleSelectAllCells()"
          (undoAction)="onUndo()"
          (redoAction)="onRedo()"
          (close)="closeContextMenu()"
        ></ogrid-context-menu>
      }

      @if (statusBarConfig()) {
        <ogrid-status-bar
          [totalCount]="statusBarConfig()!.totalCount"
          [filteredCount]="statusBarConfig()!.filteredCount"
          [selectedCount]="statusBarConfig()!.selectedCount ?? selectedRowIds().size"
          [selectedCellCount]="selectionCellCount()"
          [aggregation]="statusBarConfig()!.aggregation"
          [suppressRowCount]="statusBarConfig()!.suppressRowCount"
          [classNames]="statusBarClasses"
        ></ogrid-status-bar>
      }

      @if (isLoading()) {
        <div
          style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.7);z-index:10"
          aria-live="polite"
        >
          <div style="display:flex;align-items:center;gap:8px;color:var(--ogrid-fg, #242424)">
            <span style="font-size:14px">{{ loadingMessage() }}</span>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .loading-dimmed {
      opacity: 0.5;
      pointer-events: none;
    }
    .ogrid-drop-indicator {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 3px;
      background: var(--ogrid-primary, #217346);
      pointer-events: none;
      z-index: 100;
      transition: left 0.05s;
    }
    .ogrid-th-pinned-left {
      position: sticky;
      left: 0;
      z-index: 10;
      background: var(--ogrid-header-bg, #f5f5f5);
      border-left: 2px solid var(--ogrid-primary, #217346);
    }
    .ogrid-th-pinned-right {
      position: sticky;
      right: 0;
      z-index: 10;
      background: var(--ogrid-header-bg, #f5f5f5);
      border-right: 2px solid var(--ogrid-primary, #217346);
    }
    .ogrid-td-pinned-left {
      position: sticky;
      left: 0;
      z-index: 5;
      background: var(--ogrid-bg, #fff);
      border-left: 2px solid var(--ogrid-primary, #217346);
    }
    .ogrid-td-pinned-right {
      position: sticky;
      right: 0;
      z-index: 5;
      background: var(--ogrid-bg, #fff);
      border-right: 2px solid var(--ogrid-primary, #217346);
    }
  `],
})
export class DataGridTableComponent<T = unknown> extends BaseDataGridTableComponent<T> {
  private readonly wrapperRef = viewChild<ElementRef<HTMLDivElement>>('wrapper');
  private readonly tableContainerRefEl = viewChild<ElementRef<HTMLDivElement>>('tableContainer');

  // Inputs mapped from IOGridDataGridProps
  readonly itemsInput = input.required<T[]>({ alias: 'items' });
  readonly columns = input.required<(IColumnDef<T> | IColumnGroupDef<T>)[]>();
  readonly getRowIdInput = input.required<(item: T) => RowId>({ alias: 'getRowId' });
  readonly sortBy = input<string | undefined>(undefined);
  readonly sortDirection = input<'asc' | 'desc'>('asc');
  readonly onColumnSort = input.required<(columnKey: string) => void>();
  readonly visibleColumns = input.required<Set<string>>();
  readonly columnOrder = input<string[] | undefined>(undefined);
  readonly onColumnOrderChange = input<((order: string[]) => void) | undefined>(undefined);
  readonly onColumnResized = input<((columnId: string, width: number) => void) | undefined>(undefined);
  readonly onColumnPinned = input<((columnId: string, pinned: 'left' | 'right' | null) => void) | undefined>(undefined);
  readonly pinnedColumnsInput = input<Record<string, 'left' | 'right'> | undefined>(undefined, { alias: 'pinnedColumns' });
  readonly initialColumnWidths = input<Record<string, number> | undefined>(undefined);
  readonly freezeRowsInput = input<number | undefined>(undefined, { alias: 'freezeRows' });
  readonly freezeColsInput = input<number | undefined>(undefined, { alias: 'freezeCols' });
  readonly layoutMode = input<'content' | 'fill'>('fill');
  readonly suppressHorizontalScroll = input<boolean | undefined>(undefined);
  readonly isLoadingInput = input<boolean>(false, { alias: 'isLoading' });
  readonly loadingMessageInput = input<string>('Loading\u2026', { alias: 'loadingMessage' });
  readonly editable = input<boolean | undefined>(undefined);
  readonly cellSelection = input<boolean | undefined>(undefined);
  readonly onCellValueChanged = input<((event: { item: T; columnId: string; oldValue: unknown; newValue: unknown; rowIndex: number }) => void) | undefined>(undefined);
  readonly onUndoInput = input<(() => void) | undefined>(undefined, { alias: 'onUndo' });
  readonly onRedoInput = input<(() => void) | undefined>(undefined, { alias: 'onRedo' });
  readonly canUndoInput = input<boolean | undefined>(undefined, { alias: 'canUndo' });
  readonly canRedoInput = input<boolean | undefined>(undefined, { alias: 'canRedo' });
  readonly rowSelectionMode = input<'none' | 'single' | 'multiple'>('none', { alias: 'rowSelection' });
  readonly selectedRows = input<Set<RowId> | undefined>(undefined);
  readonly onSelectionChange = input<((event: { selectedRowIds: RowId[]; selectedItems: T[] }) => void) | undefined>(undefined);
  readonly statusBar = input<unknown>(undefined);
  readonly filters = input.required<Record<string, unknown>>();
  readonly onFilterChange = input.required<(key: string, value: unknown) => void>();
  readonly filterOptions = input<Record<string, string[]>>({});
  readonly loadingFilterOptions = input<Record<string, boolean>>({});
  readonly peopleSearch = input<((query: string) => Promise<unknown[]>) | undefined>(undefined);
  readonly getUserByEmail = input<((email: string) => Promise<unknown>) | undefined>(undefined);
  readonly emptyStateInput = input<{ onClearAll: () => void; hasActiveFilters: boolean; message?: string; render?: unknown } | undefined>(undefined, { alias: 'emptyState' });
  readonly onCellError = input<((error: Error) => void) | undefined>(undefined);
  readonly ariaLabelInput = input<string | undefined>(undefined, { alias: 'aria-label' });
  readonly ariaLabelledByInput = input<string | undefined>(undefined, { alias: 'aria-labelledby' });
  readonly showRowNumbers = input<boolean>(false);
  readonly currentPageInput = input<number>(1, { alias: 'currentPage' });
  readonly pageSizeInput = input<number>(25, { alias: 'pageSize' });

  readonly defaultMinWidth = DEFAULT_MIN_COLUMN_WIDTH;

  readonly statusBarClasses = {
    statusBar: 'ogrid-status-bar',
    statusBarItem: 'ogrid-status-bar-item',
    statusBarLabel: 'ogrid-status-bar-label',
    statusBarValue: 'ogrid-status-bar-value',
  };

  // PrimeNG uses flat number overrides for column sizing
  private readonly primengColumnSizingOverrides = signal<Record<string, number>>({});
  private resizeStartX = 0;
  private resizeColumnId = '';
  private resizeStartWidth = 0;

  constructor() {
    super();
    this.initBase();

    // Initialize column sizing from initial widths
    effect(() => {
      const iw = this.initialColumnWidths();
      if (iw) {
        this.primengColumnSizingOverrides.set({ ...iw });
      }
    });
  }

  // --- Abstract method implementations ---

  protected getProps(): IOGridDataGridProps<T> | undefined {
    return this.buildProps();
  }

  protected getWrapperRef(): ElementRef<HTMLElement> | undefined {
    return this.wrapperRef();
  }

  protected getTableContainerRef(): ElementRef<HTMLElement> | undefined {
    return this.tableContainerRefEl();
  }

  // --- PrimeNG-specific computed signals ---

  readonly resolvedAriaLabel = computed(() =>
    this.ariaLabelInput() ?? (this.ariaLabelledByInput() ? undefined : 'Data grid'),
  );

  readonly tableWidthStyle = computed(() => {
    if (this.showEmptyInGrid()) return '100%';
    if (this.allowOverflowX()) return 'fit-content';
    if (this.layoutMode() === 'content') return 'fit-content';
    return '100%';
  });

  readonly tableMinWidthStyle = computed(() => {
    if (this.showEmptyInGrid()) return '100%';
    if (this.allowOverflowX()) return 'max-content';
    if (this.layoutMode() === 'content') return 'max-content';
    return '100%';
  });

  // --- Column width override (PrimeNG uses flat number instead of { widthPx }) ---

  override getColumnWidth(col: IColumnDef<T>): number {
    const override = this.primengColumnSizingOverrides()[col.columnId];
    if (override) return override;
    return col.idealWidth ?? col.defaultWidth ?? col.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH;
  }

  // --- PrimeNG-specific helpers ---

  trackByRowId(_index: number, item: T): RowId {
    return this.getRowIdInput()(item);
  }

  getCellValueFn(item: T, col: IColumnDef<T>): unknown {
    return getCellValue(item, col);
  }

  resolveCellDisplay(col: IColumnDef<T>, item: T): string {
    const value = getCellValue(item, col);
    return resolveCellDisplayContent(col, item, value);
  }

  getCellStyleObj(col: IColumnDef<T>, item: T): Record<string, string> | null {
    return resolveCellStyle(col, item) ?? null;
  }

  canEditCell(col: IColumnDef<T>, item: T): boolean {
    const colEditable = col.editable === true || (typeof col.editable === 'function' && col.editable(item));
    return this.editable() !== false && !!colEditable && this.onCellValueChanged() != null && typeof col.cellEditor !== 'function';
  }

  isEditingCell(item: T, col: IColumnDef<T>): boolean {
    const editing = this.editingCell();
    if (!editing) return false;
    return editing.rowId === this.getRowIdInput()(item) && editing.columnId === col.columnId;
  }

  getEditorType(col: IColumnDef<T>, _item: T): 'text' | 'select' | 'checkbox' | 'date' | 'richSelect' {
    if (col.cellEditor === 'text' || col.cellEditor === 'select' || col.cellEditor === 'checkbox' || col.cellEditor === 'date' || col.cellEditor === 'richSelect') {
      return col.cellEditor as 'text' | 'select' | 'checkbox' | 'date' | 'richSelect';
    }
    if (col.type === 'date') return 'date';
    if (col.type === 'boolean') return 'checkbox';
    return 'text';
  }

  isActiveCell(rowIndex: number, colIdx: number): boolean {
    const ac = this.activeCell();
    if (!ac) return false;
    return ac.rowIndex === rowIndex && ac.columnIndex === colIdx + this.colOffset();
  }

  isInSelectionRange(rowIndex: number, colIdx: number): boolean {
    const range = this.selectionRange();
    if (!range) return false;
    const minR = Math.min(range.startRow, range.endRow);
    const maxR = Math.max(range.startRow, range.endRow);
    const minC = Math.min(range.startCol, range.endCol);
    const maxC = Math.max(range.startCol, range.endCol);
    return rowIndex >= minR && rowIndex <= maxR && colIdx >= minC && colIdx <= maxC;
  }

  isSelectionEndCell(rowIndex: number, colIdx: number): boolean {
    const range = this.selectionRange();
    if (!range || this.isDragging() || this.copyRange() || this.cutRange()) return false;
    return rowIndex === range.endRow && colIdx === range.endCol;
  }

  getCellBackground(rowIndex: number, colIdx: number): string | null {
    if (this.isInSelectionRange(rowIndex, colIdx)) return 'var(--ogrid-range-bg, rgba(33, 115, 70, 0.08))';
    return null;
  }

  // --- PrimeNG-specific event handlers ---

  onCellDblClickPrimeng(item: T, col: IColumnDef<T>, _rowIndex: number, _colIdx: number): void {
    if (this.canEditCell(col, item)) {
      this.stateService.setEditingCell({ rowId: this.getRowIdInput()(item), columnId: col.columnId });
    }
  }

  onCellEditorCommit(item: T, col: IColumnDef<T>, rowIndex: number, colIdx: number, newValue: unknown): void {
    const oldValue = getCellValue(item, col);
    this.stateService.commitCellEdit(item, col.columnId, oldValue, newValue, rowIndex, colIdx + this.colOffset());
  }

  onSelectAllChangePrimeng(checked: boolean): void {
    this.state().rowSelection.handleSelectAll(checked);
  }

  onRowClickPrimeng(e: MouseEvent, item: T): void {
    if (this.rowSelectionMode() !== 'single') return;
    const rowId = this.getRowIdInput()(item);
    const ids = this.selectedRowIds();
    this.state().rowSelection.updateSelection(ids.has(rowId) ? new Set() : new Set([rowId]));
  }

  onRowCheckboxChangePrimeng(item: T, checked: boolean, rowIndex: number, _e: Event): void {
    const rowId = this.getRowIdInput()(item);
    this.state().rowSelection.handleRowCheckboxChange(rowId, checked, rowIndex, this.lastMouseShift);
  }

  onResizeStartPrimeng(e: MouseEvent, col: IColumnDef<T>): void {
    e.preventDefault();
    this.resizeStartX = e.clientX;
    this.resizeColumnId = col.columnId;
    this.resizeStartWidth = this.getColumnWidth(col);

    const onMove = (me: MouseEvent) => {
      const delta = me.clientX - this.resizeStartX;
      const minW = col.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH;
      const newWidth = Math.max(minW, this.resizeStartWidth + delta);
      this.primengColumnSizingOverrides.update((prev) => ({ ...prev, [this.resizeColumnId]: newWidth }));
      this.columnSizingVersion.update(v => v + 1);
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove, true);
      window.removeEventListener('mouseup', onUp, true);
      const finalWidth = this.primengColumnSizingOverrides()[this.resizeColumnId];
      if (finalWidth) {
        this.onColumnResized()?.(this.resizeColumnId, finalWidth);
        const overrides: Record<string, { widthPx: number }> = {};
        for (const [id, w] of Object.entries(this.primengColumnSizingOverrides())) {
          overrides[id] = { widthPx: w };
        }
        this.state().layout.setColumnSizingOverrides(overrides);
      }
    };

    window.addEventListener('mousemove', onMove, true);
    window.addEventListener('mouseup', onUp, true);
  }

  // --- Build props ---

  private buildProps(): IOGridDataGridProps<T> {
    return {
      items: this.itemsInput(),
      columns: this.columns(),
      getRowId: this.getRowIdInput(),
      sortBy: this.sortBy(),
      sortDirection: this.sortDirection(),
      onColumnSort: this.onColumnSort(),
      visibleColumns: this.visibleColumns(),
      columnOrder: this.columnOrder(),
      onColumnOrderChange: this.onColumnOrderChange(),
      onColumnResized: this.onColumnResized(),
      onColumnPinned: this.onColumnPinned(),
      pinnedColumns: this.pinnedColumnsInput(),
      initialColumnWidths: this.initialColumnWidths(),
      freezeRows: this.freezeRowsInput(),
      freezeCols: this.freezeColsInput(),
      layoutMode: this.layoutMode(),
      suppressHorizontalScroll: this.suppressHorizontalScroll(),
      isLoading: this.isLoadingInput(),
      loadingMessage: this.loadingMessageInput(),
      editable: this.editable(),
      cellSelection: this.cellSelection(),
      onCellValueChanged: this.onCellValueChanged() as IOGridDataGridProps<T>['onCellValueChanged'],
      onUndo: this.onUndoInput(),
      onRedo: this.onRedoInput(),
      canUndo: this.canUndoInput(),
      canRedo: this.canRedoInput(),
      rowSelection: this.rowSelectionMode(),
      selectedRows: this.selectedRows(),
      onSelectionChange: this.onSelectionChange() as IOGridDataGridProps<T>['onSelectionChange'],
      showRowNumbers: this.showRowNumbers(),
      currentPage: this.currentPageInput(),
      pageSize: this.pageSizeInput(),
      statusBar: this.statusBar() as IOGridDataGridProps<T>['statusBar'],
      filters: this.filters() as IOGridDataGridProps<T>['filters'],
      onFilterChange: this.onFilterChange() as IOGridDataGridProps<T>['onFilterChange'],
      filterOptions: this.filterOptions(),
      loadingFilterOptions: this.loadingFilterOptions(),
      peopleSearch: this.peopleSearch() as IOGridDataGridProps<T>['peopleSearch'],
      getUserByEmail: this.getUserByEmail() as IOGridDataGridProps<T>['getUserByEmail'],
      emptyState: this.emptyStateInput() as IOGridDataGridProps<T>['emptyState'],
      onCellError: this.onCellError(),
      'aria-label': this.ariaLabelInput(),
      'aria-labelledby': this.ariaLabelledByInput(),
    };
  }
}
