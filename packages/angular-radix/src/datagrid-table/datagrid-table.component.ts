import { Component, ElementRef, ChangeDetectionStrategy, Input, ViewChild, signal } from '@angular/core';
import {
  BaseDataGridTableComponent,
  DataGridStateService,
  StatusBarComponent,
  GridContextMenuComponent,
  MarchingAntsOverlayComponent,
  EmptyStateComponent,
} from '@alaarab/ogrid-angular';
import type {
  IOGridDataGridProps,
} from '@alaarab/ogrid-angular';
import { ColumnHeaderFilterComponent } from '../column-header-filter/column-header-filter.component';
import { ColumnHeaderMenuComponent } from '../column-header-menu/column-header-menu.component';
import { InlineCellEditorComponent } from './inline-cell-editor.component';
import { PopoverCellEditorComponent } from './popover-cell-editor.component';

/**
 * DataGridTable component for Angular Radix using native HTML table.
 * Standalone component with lightweight styling and CSS variables.
 */
@Component({
  selector: 'ogrid-datagrid-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ColumnHeaderFilterComponent, ColumnHeaderMenuComponent, StatusBarComponent, GridContextMenuComponent, MarchingAntsOverlayComponent, EmptyStateComponent, InlineCellEditorComponent, PopoverCellEditorComponent],
  providers: [DataGridStateService],
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
        (scroll)="onWrapperScroll($event)"
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
                        <th [attr.rowSpan]="headerRows().length - 1" class="ogrid-datagrid-th ogrid-datagrid-checkbox-spacer"></th>
                      }
                      @if (rowIdx === headerRows().length - 1 && hasRowNumbersCol()) {
                        <th class="ogrid-datagrid-th ogrid-datagrid-row-number-header" [attr.rowSpan]="headerRows().length > 1 ? 1 : null">
                          #
                        </th>
                      }
                      @if (rowIdx === 0 && rowIdx < headerRows().length - 1 && hasRowNumbersCol()) {
                        <th [attr.rowSpan]="headerRows().length - 1" class="ogrid-datagrid-th ogrid-datagrid-row-number-spacer"></th>
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
                          @let pinned = isPinned(col.columnId);
                          @let pinnedLeft = pinned === 'left' || (isFreezeCol && colIdx === 0);
                          @let pinnedRight = pinned === 'right';
                          <th scope="col"
                            class="ogrid-datagrid-th"
                            [class.ogrid-datagrid-th--pinned-left]="pinnedLeft"
                            [class.ogrid-datagrid-th--pinned-right]="pinnedRight"
                            [attr.rowSpan]="headerRows().length > 1 ? headerRows().length - rowIdx : null"
                            [attr.data-column-id]="col.columnId"
                            [style.minWidth.px]="col.minWidth ?? 80"
                            [style.width.px]="colW"
                            [style.maxWidth.px]="colW"
                            [style.left.px]="pinnedLeft ? getPinnedLeftOffset(col.columnId) : null"
                            [style.right.px]="pinnedRight ? getPinnedRightOffset(col.columnId) : null"
                            [class.ogrid-datagrid-th--reorderable]="!columnReorderService.isDragging()"
                            [class.ogrid-datagrid-th--dragging]="columnReorderService.isDragging()"
                            (mousedown)="onHeaderMouseDown(col.columnId, $event)"
                          >
                            <div style="display: flex; align-items: center; gap: 4px; flex: 1; min-width: 0;">
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
                              @let colPinState = getPinState(col.columnId);
                              @let colSortState = getSortState(col.columnId);
                              <column-header-menu
                                [columnId]="col.columnId"
                                [canPinLeft]="colPinState.canPinLeft"
                                [canPinRight]="colPinState.canPinRight"
                                [canUnpin]="colPinState.canUnpin"
                                [currentSort]="colSortState"
                                [isSortable]="col.sortable !== false"
                                [isResizable]="col.resizable !== false"
                                [handlers]="getColumnMenuHandlers(col.columnId)"
                              />
                            </div>
                            <div class="ogrid-datagrid-resize-handle" (mousedown)="onResizeStart($event, col)"></div>
                          </th>
                        }
                      }
                    </tr>
                  }
                </thead>
                @if (!showEmptyInGrid()) {
                  <tbody>
                    @if (vsEnabled() && vsTopSpacerHeight() > 0) {
                      <tr class="ogrid-datagrid-vs-spacer" [style.height.px]="vsTopSpacerHeight()"></tr>
                    }
                    @for (item of vsVisibleItems(); track getRowId()(item); let localIdx = $index) {
                      @let rowIndex = vsStartIndex() + localIdx;
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
                        @if (hasRowNumbersCol()) {
                          <td class="ogrid-datagrid-td ogrid-datagrid-row-number-cell">
                            {{ rowNumberOffset() + rowIndex + 1 }}
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
                            [style.left.px]="colLayout.pinnedLeft ? getPinnedLeftOffset(colLayout.col.columnId) : null"
                            [style.right.px]="colLayout.pinnedRight ? getPinnedRightOffset(colLayout.col.columnId) : null"
                          >
                            @let descriptor = getCellDescriptor(item, colLayout.col, rowIndex, colIdx);
                            @if (descriptor.mode === 'editing-inline') {
                              <ogrid-radix-inline-cell-editor
                                [value]="descriptor.value"
                                [item]="item"
                                [column]="colLayout.col"
                                [rowIndex]="rowIndex"
                                [editorType]="descriptor.editorType ?? 'text'"
                                (commit)="commitEdit(item, colLayout.col.columnId, descriptor.value, $event, rowIndex, descriptor.globalColIndex)"
                                (cancel)="cancelEdit()"
                              ></ogrid-radix-inline-cell-editor>
                            } @else if (descriptor.mode === 'editing-popover') {
                              @let editorProps = buildPopoverEditorProps(item, colLayout.col, descriptor);
                              <ogrid-radix-popover-cell-editor
                                [item]="item"
                                [column]="colLayout.col"
                                [rowIndex]="rowIndex"
                                [globalColIndex]="descriptor.globalColIndex"
                                [displayValue]="descriptor.displayValue"
                                [editorProps]="editorProps"
                                [onCancel]="() => cancelEdit()"
                              ></ogrid-radix-popover-cell-editor>
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
                    @if (vsEnabled() && vsBottomSpacerHeight() > 0) {
                      <tr class="ogrid-datagrid-vs-spacer" [style.height.px]="vsBottomSpacerHeight()"></tr>
                    }
                  </tbody>
                }
              </table>

              <ogrid-marching-ants-overlay
                [containerEl]="tableContainerEl"
                [selectionRange]="state().interaction.selectionRange"
                [copyRange]="state().interaction.copyRange"
                [cutRange]="state().interaction.cutRange"
                [colOffset]="state().layout.colOffset"
                [columnSizingVersion]="columnSizingVersion()"
                [items]="items()"
                [visibleColumns]="propsVisibleColumns()"
                [columnOrder]="propsColumnOrder()"
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
            <ogrid-context-menu
              [x]="menuPosition()!.x"
              [y]="menuPosition()!.y"
              [hasSelection]="hasCellSelection()"
              [canUndoProp]="canUndo()"
              [canRedoProp]="canRedo()"
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
export class DataGridTableComponent<T> extends BaseDataGridTableComponent<T> {
  private readonly propsSignal = signal<IOGridDataGridProps<T> | undefined>(undefined);

  @Input({ required: true, alias: 'props' })
  set propsInput(value: IOGridDataGridProps<T>) {
    this.propsSignal.set(value);
  }

  @ViewChild('wrapperEl') private wrapperRef?: ElementRef<HTMLElement>;
  @ViewChild('tableContainerEl') private tableContainerRef?: ElementRef<HTMLElement>;

  constructor() {
    super();
    this.initBase();
  }

  protected getProps(): IOGridDataGridProps<T> | undefined {
    return this.propsSignal();
  }

  protected getWrapperRef(): ElementRef<HTMLElement> | undefined {
    return this.wrapperRef;
  }

  protected getTableContainerRef(): ElementRef<HTMLElement> | undefined {
    return this.tableContainerRef;
  }

  /** Build column header menu handlers for a given column */
  protected getColumnMenuHandlers(columnId: string) {
    return {
      onPinLeft: () => this.onPinColumn(columnId, 'left'),
      onPinRight: () => this.onPinColumn(columnId, 'right'),
      onUnpin: () => this.onUnpinColumn(columnId),
      onSortAsc: () => this.onSortAsc(columnId),
      onSortDesc: () => this.onSortDesc(columnId),
      onClearSort: () => this.onClearSort(),
      onAutosizeThis: () => this.onAutosizeColumn(columnId),
      onAutosizeAll: () => this.onAutosizeAllColumns(),
      onClose: () => {}
    };
  }
}
