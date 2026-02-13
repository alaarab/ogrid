import {
  Component, input, ElementRef, viewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import {
  BaseDataGridTableComponent,
  DataGridStateService,
  MarchingAntsOverlayComponent,
  CHECKBOX_COLUMN_WIDTH,
  ROW_NUMBER_COLUMN_WIDTH,
} from '@alaarab/ogrid-angular';
import type {
  IOGridDataGridProps,
} from '@alaarab/ogrid-angular';
import { ColumnHeaderFilterComponent } from '../column-header-filter/column-header-filter.component';
import { ColumnHeaderMenuComponent } from '../column-header-menu/column-header-menu.component';
import { InlineCellEditorComponent } from './inline-cell-editor.component';
import { PopoverCellEditorComponent } from './popover-cell-editor.component';

/**
 * DataGridTable component using native HTML table with Material Design-inspired styling.
 * Standalone component — this is the workhorse of the grid.
 */
@Component({
  selector: 'ogrid-datagrid-table',
  standalone: true,
  imports: [ColumnHeaderFilterComponent, ColumnHeaderMenuComponent, MarchingAntsOverlayComponent, InlineCellEditorComponent, PopoverCellEditorComponent],
  providers: [DataGridStateService],
  changeDetection: ChangeDetectionStrategy.OnPush,
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
                        <th [attr.rowSpan]="headerRows().length - 1" class="ogrid-datagrid-th" style="width: 48px; min-width: 48px; padding: 0;"></th>
                      }
                      @if (rowIdx === headerRows().length - 1 && hasRowNumbersCol()) {
                        <th class="ogrid-datagrid-th ogrid-row-number-header" [attr.rowSpan]="headerRows().length > 1 ? 1 : null">
                          <div class="ogrid-row-number-header-content">#</div>
                        </th>
                      }
                      @if (rowIdx === 0 && rowIdx < headerRows().length - 1 && hasRowNumbersCol()) {
                        <th [attr.rowSpan]="headerRows().length - 1" class="ogrid-datagrid-th" [style.width.px]="50" [style.min-width.px]="50" style="padding: 0;"></th>
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
                            [style.cursor]="columnReorderService.isDragging() ? 'grabbing' : 'grab'"
                            (mousedown)="onHeaderMouseDown(col.columnId, $event)"
                          >
                            <div style="display:flex;align-items:center;gap:4px;">
                              <ogrid-column-header-filter
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
                              @let pinState = getPinState(col.columnId);
                              @let sortState = getSortState(col.columnId);
                              <column-header-menu
                                [columnId]="col.columnId"
                                [canPinLeft]="pinState.canPinLeft"
                                [canPinRight]="pinState.canPinRight"
                                [canUnpin]="pinState.canUnpin"
                                [currentSort]="sortState"
                                [isSortable]="col.sortable !== false"
                                [isResizable]="col.resizable !== false"
                                [handlers]="{
                                  onPinLeft: () => onPinColumn(col.columnId, 'left'),
                                  onPinRight: () => onPinColumn(col.columnId, 'right'),
                                  onUnpin: () => onUnpinColumn(col.columnId),
                                  onSortAsc: () => onSortAsc(col.columnId),
                                  onSortDesc: () => onSortDesc(col.columnId),
                                  onClearSort: () => onClearSort(),
                                  onAutosizeThis: () => onAutosizeColumn(col.columnId),
                                  onAutosizeAll: () => onAutosizeAllColumns(),
                                  onClose: () => {}
                                }"
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
                          <td class="ogrid-datagrid-td ogrid-row-number-cell">
                            <div class="ogrid-row-number-cell-content">
                              {{ rowNumberOffset() + rowIndex + 1 }}
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
                              <ogrid-mat-inline-cell-editor
                                [value]="descriptor.value"
                                [item]="item"
                                [column]="colLayout.col"
                                [rowIndex]="rowIndex"
                                [editorType]="descriptor.editorType ?? 'text'"
                                (commit)="commitEdit(item, colLayout.col.columnId, descriptor.value, $event, rowIndex, descriptor.globalColIndex)"
                                (cancel)="cancelEdit()"
                              ></ogrid-mat-inline-cell-editor>
                            } @else if (descriptor.mode === 'editing-popover') {
                              @let editorProps = buildPopoverEditorProps(item, colLayout.col, descriptor);
                              <ogrid-mat-popover-cell-editor
                                [item]="item"
                                [column]="colLayout.col"
                                [rowIndex]="rowIndex"
                                [globalColIndex]="descriptor.globalColIndex"
                                [displayValue]="descriptor.displayValue"
                                [editorProps]="editorProps"
                                [onCancel]="() => cancelEdit()"
                              ></ogrid-mat-popover-cell-editor>
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
  styles: [`
    :host { display: block; }
    .ogrid-datagrid-root { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; }
    .ogrid-datagrid-wrapper {
      position: relative; flex: 1; min-height: 0; width: 100%; max-width: 100%;
      overflow-x: hidden; overflow-y: auto; background: #fff;
      will-change: scroll-position; outline: none;
    }
    .ogrid-datagrid-wrapper [data-drag-range] { background: rgba(33, 115, 70, 0.12) !important; }
    .ogrid-datagrid-wrapper--fit { width: fit-content; }
    .ogrid-datagrid-wrapper--overflow-x { overflow-x: auto; }
    .ogrid-datagrid-scroll-wrapper { display: flex; flex-direction: column; min-height: 100%; }
    .ogrid-datagrid-table-wrapper--loading { position: relative; opacity: 0.6; }
    .ogrid-datagrid-table {
      width: 100%; border-collapse: collapse; overflow: hidden; table-layout: fixed;
    }
    .ogrid-datagrid-thead {
      position: sticky; top: 0; z-index: 8; background: rgba(0,0,0,0.04);
    }
    .ogrid-datagrid-thead th { background: rgba(0,0,0,0.04); }
    .ogrid-datagrid-header-row { background: rgba(0,0,0,0.04); }
    .ogrid-datagrid-th {
      font-weight: 600; position: relative; padding: 6px 10px; text-align: left;
      font-size: 14px; border-bottom: 1px solid rgba(0,0,0,0.12);
    }
    .ogrid-datagrid-th--pinned-left {
      position: sticky; left: 0; z-index: 9; background: rgba(0,0,0,0.04); will-change: transform;
      border-left: 2px solid var(--mat-sys-primary, #1976d2);
    }
    .ogrid-datagrid-th--pinned-right {
      position: sticky; right: 0; z-index: 9; background: rgba(0,0,0,0.04); will-change: transform;
      border-right: 2px solid var(--mat-sys-primary, #1976d2);
    }
    .ogrid-datagrid-group-header {
      text-align: center; font-weight: 600; border-bottom: 2px solid rgba(0,0,0,0.12); padding: 6px;
    }
    .ogrid-datagrid-checkbox-col {
      width: ${CHECKBOX_COLUMN_WIDTH}px; min-width: ${CHECKBOX_COLUMN_WIDTH}px;
      max-width: ${CHECKBOX_COLUMN_WIDTH}px; text-align: center;
    }
    .ogrid-datagrid-checkbox-wrapper { display: flex; align-items: center; justify-content: center; }
    .ogrid-row-number-header, .ogrid-row-number-cell {
      width: ${ROW_NUMBER_COLUMN_WIDTH}px; min-width: ${ROW_NUMBER_COLUMN_WIDTH}px;
      max-width: ${ROW_NUMBER_COLUMN_WIDTH}px; text-align: center;
      background: rgba(0,0,0,0.04); font-weight: 600;
      font-variant-numeric: tabular-nums; color: rgba(0,0,0,0.6);
      position: sticky; left: 0; z-index: 3;
    }
    .ogrid-row-number-header { z-index: 4; }
    .ogrid-row-number-header-content, .ogrid-row-number-cell-content {
      display: flex; align-items: center; justify-content: center;
    }
    .ogrid-datagrid-row { }
    .ogrid-datagrid-row:hover { background: rgba(0,0,0,0.04); }
    .ogrid-datagrid-row--selected { background: rgba(25,118,210,0.08); }
    .ogrid-datagrid-td { position: relative; padding: 0; height: 1px; border-bottom: 1px solid rgba(0,0,0,0.06); }
    .ogrid-datagrid-td--pinned-left {
      position: sticky; left: 0; z-index: 6; background: #fff; will-change: transform;
      border-left: 2px solid var(--mat-sys-primary, #1976d2);
    }
    .ogrid-datagrid-td--pinned-right {
      position: sticky; right: 0; z-index: 6; background: #fff; will-change: transform;
      border-right: 2px solid var(--mat-sys-primary, #1976d2);
    }
    .ogrid-datagrid-cell {
      width: 100%; height: 100%; display: flex; align-items: center; min-width: 0;
      padding: 6px 10px; box-sizing: border-box; overflow: hidden;
      text-overflow: ellipsis; white-space: nowrap; user-select: none; outline: none;
      font-size: 14px;
    }
    .ogrid-datagrid-cell--numeric { justify-content: flex-end; text-align: right; }
    .ogrid-datagrid-cell--boolean { justify-content: center; text-align: center; }
    .ogrid-datagrid-cell--editable { cursor: cell; }
    .ogrid-datagrid-cell--active {
      outline: 2px solid var(--ogrid-selection, #217346); outline-offset: -1px;
      z-index: 2; position: relative; overflow: visible;
    }
    .ogrid-datagrid-cell--in-range { background: var(--ogrid-bg-range, rgba(33, 115, 70, 0.12)); }
    .ogrid-datagrid-cell--in-cut-range { background: rgba(0,0,0,0.04); opacity: 0.7; }
    .ogrid-datagrid-cell--editing { padding: 0; }
    .ogrid-datagrid-editor-input {
      width: 100%; height: 100%; padding: 6px 10px; border: 2px solid var(--ogrid-selection, #217346);
      box-sizing: border-box; font-size: 14px; outline: none; font-family: inherit; line-height: inherit;
    }
    .ogrid-datagrid-cell--numeric .ogrid-datagrid-editor-input {
      text-align: right;
    }
    .ogrid-datagrid-editor-select {
      width: 100%; height: 100%; padding: 4px 8px; border: 2px solid var(--ogrid-selection, #217346);
      box-sizing: border-box; font-size: 14px;
    }
    .ogrid-datagrid-fill-handle {
      position: absolute; right: -3px; bottom: -3px; width: 7px; height: 7px;
      background: var(--ogrid-selection, #217346);
      border: 1px solid var(--ogrid-bg, #fff); border-radius: 1px;
      cursor: crosshair; pointer-events: auto; z-index: 3;
    }
    .ogrid-datagrid-resize-handle {
      position: absolute; top: 0; right: -3px; bottom: 0; width: 8px;
      cursor: col-resize; user-select: none;
    }
    .ogrid-datagrid-resize-handle::after {
      content: ''; position: absolute; top: 0; right: 3px; bottom: 0; width: 2px;
    }
    .ogrid-datagrid-resize-handle:hover::after { background: var(--mat-sys-primary, #1976d2); }
    .ogrid-datagrid-resize-handle:active::after { background: var(--mat-sys-primary, #1565c0); }
    .ogrid-datagrid-empty {
      padding: 32px 16px; text-align: center; border-top: 1px solid rgba(0,0,0,0.12);
      background: rgba(0,0,0,0.04);
    }
    .ogrid-datagrid-empty__title { font-size: 18px; font-weight: 600; margin-bottom: 8px; }
    .ogrid-datagrid-empty__message { font-size: 14px; color: rgba(0,0,0,0.6); }
    .ogrid-datagrid-empty__clear {
      background: none; border: none; color: var(--mat-sys-primary, #1976d2);
      cursor: pointer; font-size: inherit; text-decoration: underline; padding: 0;
    }
    .ogrid-datagrid-loading-overlay {
      position: absolute; inset: 0; z-index: 2;
      display: flex; align-items: center; justify-content: center;
      background: rgba(255,255,255,0.7);
    }
    .ogrid-datagrid-loading-inner {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      padding: 16px; background: #fff; border: 1px solid rgba(0,0,0,0.12); border-radius: 4px;
    }
    .ogrid-datagrid-spinner {
      width: 24px; height: 24px; border: 3px solid rgba(0,0,0,0.12);
      border-top-color: var(--mat-sys-primary, #1976d2);
      border-radius: 50%; animation: ogrid-spin 0.8s linear infinite;
    }
    @keyframes ogrid-spin { to { transform: rotate(360deg); } }
    .ogrid-datagrid-drop-indicator {
      position: absolute; top: 0; bottom: 0; width: 3px;
      background: var(--ogrid-primary, #217346);
      pointer-events: none; z-index: 100; transition: left 0.05s;
    }
    .ogrid-datagrid-context-menu-overlay {
      position: fixed; inset: 0; z-index: 1000;
    }
  `],
})
export class DataGridTableComponent<T> extends BaseDataGridTableComponent<T> {
  readonly propsInput = input.required<IOGridDataGridProps<T>>({ alias: 'props' });

  private readonly wrapperRef = viewChild<ElementRef<HTMLElement>>('wrapperEl');
  private readonly tableContainerRef = viewChild<ElementRef<HTMLElement>>('tableContainerEl');

  constructor() {
    super();
    this.initBase();
  }

  protected getProps(): IOGridDataGridProps<T> | undefined {
    return this.propsInput();
  }

  protected getWrapperRef(): ElementRef<HTMLElement> | undefined {
    return this.wrapperRef();
  }

  protected getTableContainerRef(): ElementRef<HTMLElement> | undefined {
    return this.tableContainerRef();
  }
}
