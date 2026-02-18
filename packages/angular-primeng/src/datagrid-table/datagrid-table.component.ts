import {
  Component,
  Input,
  signal,
  computed,
  ElementRef,
  ViewChild,
  ChangeDetectionStrategy,
  ViewEncapsulation,
  OnChanges,
  SimpleChanges,
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
import { PopoverCellEditorComponent } from './popover-cell-editor.component';

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
    PopoverCellEditorComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  providers: [DataGridStateService],
  template: `
    <div class="ogrid-root">
      <div
        #wrapper
        tabindex="0"
        role="region"
        class="ogrid-scroll-wrapper"
        [attr.aria-label]="resolvedAriaLabel()"
        [attr.aria-labelledby]="ariaLabelledBy()"
        [attr.data-empty]="showEmptyInGrid() ? 'true' : null"
        [attr.data-column-count]="state().layout.totalColCount"
        [attr.data-freeze-rows]="freezeRows() != null && freezeRows()! >= 1 ? freezeRows() : null"
        [attr.data-freeze-cols]="freezeCols() != null && freezeCols()! >= 1 ? freezeCols() : null"
        [attr.data-overflow-x]="allowOverflowX() ? 'true' : 'false'"
        [attr.data-has-selection]="rowSelectionMode !== 'none' ? 'true' : null"
        (contextmenu)="$event.preventDefault()"
        (keydown)="onGridKeyDown($event)"
        (mousedown)="onWrapperMouseDown($event)"
        (scroll)="onWrapperScroll($event)"
        [style.--data-table-column-count]="state().layout.totalColCount"
        [style.--data-table-width]="tableWidthStyle()"
        [style.--data-table-min-width]="tableMinWidthStyle()"
      >
        <div class="ogrid-table-wrapper">
          <div [class.loading-dimmed]="isLoading() && items().length > 0" class="ogrid-table-wrapper">
            <div #tableContainer class="ogrid-table-wrapper">
              <table class="ogrid-table">
                <thead class="ogrid-thead">
                  @for (row of headerRows(); track $index; let rowIdx = $index) {
                    <tr>
                      @if (rowIdx === headerRows().length - 1 && hasCheckboxCol()) {
                        <th scope="col" rowSpan="1" class="ogrid-checkbox-header">
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
                        <th scope="col" rowSpan="1" class="ogrid-row-number-header">
                          #
                        </th>
                      }
                      @if (rowIdx === 0 && rowIdx < headerRows().length - 1 && hasRowNumbersCol()) {
                        <th [attr.rowSpan]="headerRows().length - 1" class="ogrid-row-number-spacer"></th>
                      }
                      @for (cell of row; track $index; let cellIdx = $index) {
                        @if (cell.isGroup) {
                          <th
                            [attr.colSpan]="cell.colSpan"
                            scope="colgroup"
                            class="ogrid-column-group-header"
                          >
                            {{ cell.label }}
                          </th>
                        } @else {
                          @let col = asColumnDef(cell.columnDef);
                          @let pinned = isPinned(col.columnId);
                          <th
                            scope="col"
                            class="ogrid-header-cell"
                            [attr.data-column-id]="col.columnId"
                            [attr.rowSpan]="headerRows().length > 1 && rowIdx < headerRows().length - 1 ? headerRows().length - rowIdx : null"
                            [class.ogrid-th-pinned-left]="pinned === 'left'"
                            [class.ogrid-th-pinned-right]="pinned === 'right'"
                            [style.min-width.px]="col.minWidth ?? defaultMinWidth"
                            [style.width.px]="getColumnWidth(col)"
                            [style.max-width.px]="getColumnWidth(col)"
                            [style.left.px]="pinned === 'left' ? getPinnedLeftOffset(col.columnId) : null"
                            [style.right.px]="pinned === 'right' ? getPinnedRightOffset(col.columnId) : null"
                            [style.cursor]="columnReorderService.isDragging() ? 'grabbing' : 'grab'"
                            (mousedown)="onHeaderMouseDown(col.columnId, $event)"
                          >
                            <div class="ogrid-header-content">
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
                              @let colSortState = getSortState(col.columnId);
                              <column-header-menu
                                [columnId]="col.columnId"
                                [canPinLeft]="colPinState.canPinLeft"
                                [canPinRight]="colPinState.canPinRight"
                                [canUnpin]="colPinState.canUnpin"
                                [currentSort]="colSortState"
                                [isSortable]="col.sortable !== false"
                                [isResizable]="col.resizable !== false"
                                [handlers]="getColumnHeaderMenuHandlers(col.columnId)"
                              />
                            </div>
                            <div
                              class="ogrid-resize-handle"
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
                    @if (vsEnabled() && vsTopSpacerHeight() > 0) {
                      <tr [style.height.px]="vsTopSpacerHeight()"></tr>
                    }
                    @for (item of vsVisibleItems(); track trackByRowId($index, item); let localIdx = $index) {
                      @let rowIndex = vsStartIndex() + localIdx;
                      @let rowId = getRowIdInput(item);
                      @let isSelected = selectedRowIds().has(rowId);
                      <tr
                        [attr.data-row-id]="rowId"
                        [style.background]="isSelected ? 'var(--ogrid-selected-bg, #e8f0fe)' : null"
                        (click)="onRowClickPrimeng($event, item)"
                      >
                        @if (hasCheckboxCol()) {
                          <td
                            class="ogrid-checkbox-cell"
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
                          <td class="ogrid-row-number-cell">

                            {{ rowNumberOffset() + rowIndex + 1 }}
                          </td>
                        }
                        @for (col of visibleCols(); track col.columnId; let colIdx = $index) {
                          @let pinned = isPinned(col.columnId);
                          <td
                            [attr.data-column-id]="col.columnId"
                            [class.ogrid-td-pinned-left]="pinned === 'left'"
                            [class.ogrid-td-pinned-right]="pinned === 'right'"
                            class="ogrid-data-cell"
                            [style.min-width.px]="col.minWidth ?? defaultMinWidth"
                            [style.width.px]="getColumnWidth(col)"
                            [style.max-width.px]="getColumnWidth(col)"
                            [style.left.px]="pinned === 'left' ? getPinnedLeftOffset(col.columnId) : null"
                            [style.right.px]="pinned === 'right' ? getPinnedRightOffset(col.columnId) : null"
                            [style.text-align]="col.type === 'numeric' ? 'right' : col.type === 'boolean' ? 'center' : null"
                          >
                            @if (isEditingCellInline(item, col)) {
                              <ogrid-primeng-inline-cell-editor
                                [value]="getCellValueFn(item, col)"
                                [item]="item"
                                [column]="col"
                                [rowIndex]="rowIndex"
                                [editorType]="getEditorType(col, item)"
                                (commit)="onCellEditorCommit(item, col, rowIndex, colIdx, $event)"
                                (cancel)="cancelEdit()"
                              ></ogrid-primeng-inline-cell-editor>
                            } @else if (isEditingCellPopover(item, col)) {
                              @let editorProps = buildPopoverEditorPropsForPrimeng(item, col, rowIndex, colIdx);
                              <ogrid-primeng-popover-cell-editor
                                [item]="item"
                                [column]="col"
                                [rowIndex]="rowIndex"
                                [globalColIndex]="colIdx + colOffset()"
                                [displayValue]="getCellValueFn(item, col)"
                                [editorProps]="editorProps"
                                [onCancel]="cancelEditHandler"
                              ></ogrid-primeng-popover-cell-editor>
                            } @else {
                              <div
                                [attr.data-row-index]="rowIndex"
                                [attr.data-col-index]="colIdx + colOffset()"
                                (mousedown)="onCellMouseDown($event, rowIndex, colIdx + colOffset())"
                                (dblclick)="onCellDblClickPrimeng(item, col, rowIndex, colIdx)"
                                (contextmenu)="onCellContextMenu($event)"
                                class="ogrid-cell-content"
                                [style.cursor]="canEditCell(col, item) ? 'cell' : 'default'"
                                [style.background]="getCellBackground(rowIndex, colIdx)"
                                [style.outline]="isActiveCell(rowIndex, colIdx) ? '2px solid var(--ogrid-selection, #217346)' : null"
                                [style.outline-offset]="isActiveCell(rowIndex, colIdx) ? '-2px' : null"
                              >
                                <span [style]="getCellStyleObj(col, item)">{{ resolveCellDisplay(col, item) }}</span>
                                @if (canEditCell(col, item) && isSelectionEndCell(rowIndex, colIdx)) {
                                  <div
                                    (mousedown)="onFillHandleMouseDown($event)"
                                    class="ogrid-fill-handle"
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
                      <tr [style.height.px]="vsBottomSpacerHeight()"></tr>
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
                [items]="items()"
                [visibleColumns]="propsVisibleColumns()"
                [columnOrder]="propsColumnOrder()"
              ></ogrid-marching-ants-overlay>

              @if (showEmptyInGrid() && emptyState()) {
                <div class="ogrid-empty-container">
                  <div>
                    <div class="ogrid-empty-title">No results found</div>
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
          [classNames]="contextMenuClasses"
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
        <div class="ogrid-loading-overlay" aria-live="polite">
          <div class="ogrid-loading-content">
            <span class="ogrid-loading-text">{{ loadingMessage() }}</span>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    /* ─── OGrid Theme Variables ─── */
    :root {
      --ogrid-bg: #ffffff;
      --ogrid-fg: rgba(0, 0, 0, 0.87);
      --ogrid-fg-secondary: rgba(0, 0, 0, 0.6);
      --ogrid-fg-muted: rgba(0, 0, 0, 0.5);
      --ogrid-border: rgba(0, 0, 0, 0.12);
      --ogrid-header-bg: rgba(0, 0, 0, 0.04);
      --ogrid-hover-bg: rgba(0, 0, 0, 0.04);
      --ogrid-selected-row-bg: #e6f0fb;
      --ogrid-active-cell-bg: rgba(0, 0, 0, 0.02);
      --ogrid-range-bg: rgba(33, 115, 70, 0.12);
      --ogrid-accent: #0078d4;
      --ogrid-selection-color: #217346;
      --ogrid-loading-overlay: rgba(255, 255, 255, 0.7);
    }
    @media (prefers-color-scheme: dark) {
      :root:not([data-theme="light"]) {
        --ogrid-bg: #1e1e1e;
        --ogrid-fg: rgba(255, 255, 255, 0.87);
        --ogrid-fg-secondary: rgba(255, 255, 255, 0.6);
        --ogrid-fg-muted: rgba(255, 255, 255, 0.5);
        --ogrid-border: rgba(255, 255, 255, 0.12);
        --ogrid-header-bg: rgba(255, 255, 255, 0.06);
        --ogrid-hover-bg: rgba(255, 255, 255, 0.08);
        --ogrid-selected-row-bg: #1a3a5c;
        --ogrid-active-cell-bg: rgba(255, 255, 255, 0.06);
        --ogrid-range-bg: rgba(46, 160, 67, 0.15);
        --ogrid-accent: #4da6ff;
        --ogrid-selection-color: #2ea043;
        --ogrid-loading-overlay: rgba(0, 0, 0, 0.7);
      }
    }
    [data-theme="dark"] {
      --ogrid-bg: #1e1e1e;
      --ogrid-fg: rgba(255, 255, 255, 0.87);
      --ogrid-fg-secondary: rgba(255, 255, 255, 0.6);
      --ogrid-fg-muted: rgba(255, 255, 255, 0.5);
      --ogrid-border: rgba(255, 255, 255, 0.12);
      --ogrid-header-bg: rgba(255, 255, 255, 0.06);
      --ogrid-hover-bg: rgba(255, 255, 255, 0.08);
      --ogrid-selected-row-bg: #1a3a5c;
      --ogrid-active-cell-bg: rgba(255, 255, 255, 0.06);
      --ogrid-range-bg: rgba(46, 160, 67, 0.15);
      --ogrid-accent: #4da6ff;
      --ogrid-selection-color: #2ea043;
      --ogrid-loading-overlay: rgba(0, 0, 0, 0.7);
    }
    :host { display: block; }
    .ogrid-root {
      position: relative;
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .ogrid-scroll-wrapper {
      flex: 1;
      min-height: 0;
      overflow: auto;
      position: relative;
      background: var(--ogrid-bg, #ffffff);
      color: var(--ogrid-fg, rgba(0, 0, 0, 0.87));
    }
    .ogrid-table-wrapper {
      position: relative;
    }
    .ogrid-table {
      width: var(--data-table-width, 100%);
      min-width: var(--data-table-min-width, 100%);
      border-collapse: collapse;
      table-layout: fixed;
    }
    .ogrid-thead {
      z-index: 3;
      background: var(--ogrid-header-bg, #f5f5f5);
      position: sticky;
      top: 0;
    }
    .ogrid-checkbox-header {
      width: 48px;
      min-width: 48px;
      max-width: 48px;
      text-align: center;
      background: var(--ogrid-header-bg, #f5f5f5);
      border-bottom: 2px solid var(--ogrid-border, #e0e0e0);
      position: sticky;
      top: 0;
      z-index: 3;
    }
    .ogrid-row-number-header {
      width: 50px;
      min-width: 50px;
      max-width: 50px;
      text-align: center;
      font-weight: 600;
      background: var(--ogrid-header-bg, #f5f5f5);
      border-bottom: 2px solid var(--ogrid-border, #e0e0e0);
      position: sticky;
      top: 0;
      z-index: 3;
    }
    .ogrid-row-number-spacer {
      width: 50px;
      min-width: 50px;
      max-width: 50px;
      background: var(--ogrid-header-bg, #f5f5f5);
    }
    .ogrid-column-group-header {
      text-align: center;
      font-weight: 600;
      background: var(--ogrid-header-bg, #f5f5f5);
      border-bottom: 2px solid var(--ogrid-border, #e0e0e0);
      padding: 6px 10px;
    }
    .ogrid-header-cell {
      background: var(--ogrid-header-bg, #f5f5f5);
      border-bottom: 2px solid var(--ogrid-border, #e0e0e0);
      padding: 0;
      position: relative;
      user-select: none;
    }
    .ogrid-header-content {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px 10px;
    }
    .ogrid-resize-handle {
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      width: 4px;
      cursor: col-resize;
    }
    .ogrid-checkbox-cell {
      width: 48px;
      min-width: 48px;
      max-width: 48px;
      padding: 6px 4px;
      text-align: center;
      border-bottom: 1px solid var(--ogrid-border, #f0f0f0);
    }
    .ogrid-row-number-cell {
      width: 50px;
      min-width: 50px;
      max-width: 50px;
      padding: 6px;
      text-align: center;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: var(--ogrid-fg-secondary, rgba(0, 0, 0, 0.6));
      background: var(--ogrid-header-bg, rgba(0, 0, 0, 0.04));
      border-bottom: 1px solid var(--ogrid-border, #f0f0f0);
      position: sticky;
      left: 0;
      z-index: 3;
    }
    .ogrid-data-cell {
      padding: 0;
      border-bottom: 1px solid var(--ogrid-border, #f0f0f0);
      position: relative;
    }
    .ogrid-cell-content {
      padding: 6px 10px;
      min-height: 20px;
      cursor: default;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .ogrid-scroll-wrapper [data-drag-range] { background: var(--ogrid-range-bg, rgba(33, 115, 70, 0.12)) !important; }
    .ogrid-fill-handle {
      position: absolute;
      bottom: -3px;
      right: -3px;
      width: 7px;
      height: 7px;
      background: var(--ogrid-selection, #217346);
      cursor: crosshair;
      z-index: 2;
    }
    .ogrid-empty-container {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
      text-align: center;
      color: var(--ogrid-fg-muted, rgba(0, 0, 0, 0.5));
    }
    .ogrid-empty-title {
      font-weight: 600;
      margin-bottom: 8px;
    }
    .ogrid-loading-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--ogrid-loading-overlay, rgba(255, 255, 255, 0.7));
      z-index: 10;
    }
    .ogrid-loading-content {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--ogrid-fg, #242424);
    }
    .ogrid-loading-text {
      font-size: 14px;
    }
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
      top: 0;
      left: 0;
      z-index: 10;
      background: var(--ogrid-header-bg, #f5f5f5);
      border-left: 2px solid var(--ogrid-primary, #217346);
    }
    .ogrid-th-pinned-right {
      position: sticky;
      top: 0;
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
    ::ng-deep th:focus-visible,
    ::ng-deep td:focus-visible {
      outline: 2px solid var(--primary-color, #6366f1);
      outline-offset: -2px;
      z-index: 11;
    }
    ::ng-deep .p-button:focus-visible,
    ::ng-deep button:focus-visible {
      outline: 2px solid var(--primary-color, #6366f1);
      outline-offset: 2px;
    }

    /* Context menu */
    .ogrid-context-menu {
      position: fixed;
      z-index: 10000;
      min-width: 160px;
      padding: 4px 0;
      background: var(--ogrid-bg, #fff);
      border: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));
      border-radius: 6px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    }
    .ogrid-context-menu-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      width: 100%;
      padding: 6px 12px;
      border: none;
      background: none;
      font-size: 13px;
      text-align: left;
      cursor: pointer;
      color: var(--ogrid-fg, rgba(0, 0, 0, 0.87));
    }
    .ogrid-context-menu-item:hover:not(:disabled) {
      background: var(--ogrid-hover-bg, rgba(0, 0, 0, 0.04));
    }
    .ogrid-context-menu-item:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .ogrid-context-menu-item-label {
      flex: 1;
    }
    .ogrid-context-menu-item-shortcut {
      color: var(--ogrid-fg-muted, rgba(0, 0, 0, 0.5));
      font-size: 0.85em;
    }
    .ogrid-context-menu-divider {
      height: 1px;
      margin: 4px 0;
      background: var(--ogrid-border, rgba(0, 0, 0, 0.12));
    }
    ::ng-deep .p-checkbox:focus-visible {
      outline: 2px solid var(--primary-color, #6366f1);
      outline-offset: 2px;
    }

    /* PrimeNG Menu popup overrides — must use !important to win over PrimeNG's CSS-variable-based defaults */
    .p-menu {
      background: var(--ogrid-bg, #ffffff) !important;
      color: var(--ogrid-fg, rgba(0, 0, 0, 0.87)) !important;
      border: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12)) !important;
      border-radius: 4px !important;
      padding: 4px 0 !important;
    }
    .p-menu-overlay {
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3), 0 0 0 1px var(--ogrid-border, rgba(0, 0, 0, 0.12)) !important;
    }
    .p-menu-item-content {
      color: var(--ogrid-fg, rgba(0, 0, 0, 0.87)) !important;
    }
    .p-menu-item-link {
      color: var(--ogrid-fg, rgba(0, 0, 0, 0.87)) !important;
      padding: 6px 12px !important;
    }
    .p-menu-item-label {
      color: var(--ogrid-fg, rgba(0, 0, 0, 0.87)) !important;
      font-size: 0.875rem !important;
    }
    .p-menu-item:not(.p-disabled) .p-menu-item-content:hover {
      background: var(--ogrid-hover-bg, rgba(0, 0, 0, 0.04)) !important;
      color: var(--ogrid-fg, rgba(0, 0, 0, 0.87)) !important;
    }
    .p-menu-separator {
      border-color: var(--ogrid-border, rgba(0, 0, 0, 0.12)) !important;
      margin: 4px 0 !important;
    }
  `],
})
export class DataGridTableComponent<T = unknown> extends BaseDataGridTableComponent<T> implements OnChanges {
  @ViewChild('wrapper') private wrapperRef?: ElementRef<HTMLDivElement>;
  @ViewChild('tableContainer') private tableContainerRefEl?: ElementRef<HTMLDivElement>;

  // Inputs mapped from IOGridDataGridProps
  @Input({ required: true, alias: 'items' }) itemsInput!: T[];
  @Input({ required: true }) columns!: (IColumnDef<T> | IColumnGroupDef<T>)[];
  @Input({ required: true, alias: 'getRowId' }) getRowIdInput!: (item: T) => RowId;
  @Input() sortBy: string | undefined = undefined;
  @Input() sortDirection: 'asc' | 'desc' = 'asc';
  @Input({ required: true }) onColumnSort!: (columnKey: string, direction?: 'asc' | 'desc' | null) => void;
  @Input({ required: true }) visibleColumns!: Set<string>;
  @Input() columnOrder: string[] | undefined = undefined;
  @Input() onColumnOrderChange: ((order: string[]) => void) | undefined = undefined;
  @Input() onColumnResized: ((columnId: string, width: number) => void) | undefined = undefined;
  @Input() onColumnPinned: ((columnId: string, pinned: 'left' | 'right' | null) => void) | undefined = undefined;
  @Input({ alias: 'pinnedColumns' }) pinnedColumnsInput: Record<string, 'left' | 'right'> | undefined = undefined;
  @Input() initialColumnWidths: Record<string, number> | undefined = undefined;
  @Input({ alias: 'freezeRows' }) freezeRowsInput: number | undefined = undefined;
  @Input({ alias: 'freezeCols' }) freezeColsInput: number | undefined = undefined;
  @Input() layoutMode: 'content' | 'fill' = 'fill';
  @Input() suppressHorizontalScroll: boolean | undefined = undefined;
  @Input() columnReorder: boolean | undefined = undefined;
  @Input({ alias: 'isLoading' }) isLoadingInput: boolean = false;
  @Input({ alias: 'loadingMessage' }) loadingMessageInput: string = 'Loading\u2026';
  @Input() editable: boolean | undefined = undefined;
  @Input() cellSelection: boolean | undefined = undefined;
  @Input() onCellValueChanged: ((event: { item: T; columnId: string; oldValue: unknown; newValue: unknown; rowIndex: number }) => void) | undefined = undefined;
  @Input({ alias: 'onUndo' }) onUndoInput: (() => void) | undefined = undefined;
  @Input({ alias: 'onRedo' }) onRedoInput: (() => void) | undefined = undefined;
  @Input({ alias: 'canUndo' }) canUndoInput: boolean | undefined = undefined;
  @Input({ alias: 'canRedo' }) canRedoInput: boolean | undefined = undefined;
  @Input({ alias: 'rowSelection' }) rowSelectionMode: 'none' | 'single' | 'multiple' = 'none';
  @Input() selectedRows: Set<RowId> | undefined = undefined;
  @Input() onSelectionChange: ((event: { selectedRowIds: RowId[]; selectedItems: T[] }) => void) | undefined = undefined;
  @Input() statusBar: unknown = undefined;
  @Input({ required: true }) filters!: Record<string, unknown>;
  @Input({ required: true }) onFilterChange!: (key: string, value: unknown) => void;
  @Input() filterOptions: Record<string, string[]> = {};
  @Input() loadingFilterOptions: Record<string, boolean> = {};
  @Input() peopleSearch: ((query: string) => Promise<unknown[]>) | undefined = undefined;
  @Input() getUserByEmail: ((email: string) => Promise<unknown>) | undefined = undefined;
  @Input({ alias: 'emptyState' }) emptyStateInput: { onClearAll: () => void; hasActiveFilters: boolean; message?: string; render?: unknown } | undefined = undefined;
  @Input() onCellError: ((error: Error) => void) | undefined = undefined;
  @Input({ alias: 'aria-label' }) ariaLabelInput: string | undefined = undefined;
  @Input({ alias: 'aria-labelledby' }) ariaLabelledByInput: string | undefined = undefined;
  @Input() showRowNumbers: boolean = false;
  @Input({ alias: 'currentPage' }) currentPageInput: number = 1;
  @Input({ alias: 'pageSize' }) pageSizeInput: number = 25;

  readonly defaultMinWidth = DEFAULT_MIN_COLUMN_WIDTH;

  readonly statusBarClasses = {
    statusBar: 'ogrid-status-bar',
    statusBarItem: 'ogrid-status-bar-item',
    statusBarLabel: 'ogrid-status-bar-label',
    statusBarValue: 'ogrid-status-bar-value',
  };

  readonly contextMenuClasses = {
    contextMenu: 'ogrid-context-menu',
    contextMenuItem: 'ogrid-context-menu-item',
    contextMenuItemLabel: 'ogrid-context-menu-item-label',
    contextMenuItemShortcut: 'ogrid-context-menu-item-shortcut',
    contextMenuDivider: 'ogrid-context-menu-divider',
  };

  // PrimeNG uses flat number overrides for column sizing
  private readonly primengColumnSizingOverrides = signal<Record<string, number>>({});
  private readonly propsSignal = signal<IOGridDataGridProps<T> | undefined>(undefined);
  private resizeStartX = 0;
  private resizeColumnId = '';
  private resizeStartWidth = 0;

  // Bound method reference for template
  readonly cancelEditHandler = () => this.cancelEdit();

  constructor() {
    super();
    this.initBase();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Initialize column sizing from initial widths
    if (changes['initialColumnWidths']) {
      const iw = this.initialColumnWidths;
      if (iw) {
        this.primengColumnSizingOverrides.set({ ...iw });
      }
    }
    // Rebuild props signal whenever any input changes so computed chains track it
    this.propsSignal.set(this.buildProps());
  }

  // --- Abstract method implementations ---

  protected getProps(): IOGridDataGridProps<T> | undefined {
    return this.propsSignal();
  }

  protected getWrapperRef(): ElementRef<HTMLElement> | undefined {
    return this.wrapperRef;
  }

  protected getTableContainerRef(): ElementRef<HTMLElement> | undefined {
    return this.tableContainerRefEl;
  }

  // --- PrimeNG-specific computed signals ---

  readonly resolvedAriaLabel = computed(() =>
    this.ariaLabelInput ?? (this.ariaLabelledByInput ? undefined : 'Data grid'),
  );

  readonly tableWidthStyle = computed(() => {
    if (this.showEmptyInGrid()) return '100%';
    if (this.allowOverflowX()) return 'fit-content';
    if (this.layoutMode === 'content') return 'fit-content';
    return '100%';
  });

  readonly tableMinWidthStyle = computed(() => {
    if (this.showEmptyInGrid()) return '100%';
    if (this.allowOverflowX()) return 'max-content';
    if (this.layoutMode === 'content') return 'max-content';
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
    return this.getRowIdInput(item);
  }

  getCellValueFn(item: T, col: IColumnDef<T>): unknown {
    return getCellValue(item, col);
  }

  resolveCellDisplay(col: IColumnDef<T>, item: T): string {
    const value = getCellValue(item, col);
    const result = resolveCellDisplayContent(col, item, value);
    return result != null ? String(result) : '';
  }

  getCellStyleObj(col: IColumnDef<T>, item: T): Record<string, string> | null {
    return resolveCellStyle(col, item) ?? null;
  }

  canEditCell(col: IColumnDef<T>, item: T): boolean {
    const colEditable = col.editable === true || (typeof col.editable === 'function' && col.editable(item));
    return this.editable !== false && !!colEditable && this.onCellValueChanged != null && typeof col.cellEditor !== 'function';
  }

  isEditingCell(item: T, col: IColumnDef<T>): boolean {
    const editing = this.editingCell();
    if (!editing) return false;
    return editing.rowId === this.getRowIdInput(item) && editing.columnId === col.columnId;
  }

  isEditingCellInline(item: T, col: IColumnDef<T>): boolean {
    return this.isEditingCell(item, col) && typeof col.cellEditor !== 'function';
  }

  isEditingCellPopover(item: T, col: IColumnDef<T>): boolean {
    return this.isEditingCell(item, col) && typeof col.cellEditor === 'function';
  }

  buildPopoverEditorPropsForPrimeng(item: T, col: IColumnDef<T>, rowIndex: number, colIdx: number): unknown {
    const oldValue = getCellValue(item, col);
    const pendingValue = this.pendingEditorValue();
    const displayValue = pendingValue !== undefined ? pendingValue : oldValue;
    return {
      value: displayValue,
      onValueChange: (value: unknown) => this.setPendingEditorValue(value),
      item,
      column: col,
      rowIndex,
      onCommit: (newValue: unknown) => this.onCellEditorCommit(item, col, rowIndex, colIdx, newValue),
      onCancel: () => this.cancelEdit(),
    };
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
      this.stateService.setEditingCell({ rowId: this.getRowIdInput(item), columnId: col.columnId });
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
    if (this.rowSelectionMode !== 'single') return;
    const rowId = this.getRowIdInput(item);
    const ids = this.selectedRowIds();
    this.state().rowSelection.updateSelection(ids.has(rowId) ? new Set() : new Set([rowId]));
  }

  getColumnHeaderMenuHandlers(columnId: string) {
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

  onRowCheckboxChangePrimeng(item: T, checked: boolean, rowIndex: number, _e: Event): void {
    const rowId = this.getRowIdInput(item);
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
        this.onColumnResized?.(this.resizeColumnId, finalWidth);
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
      items: this.itemsInput,
      columns: this.columns,
      getRowId: this.getRowIdInput,
      sortBy: this.sortBy,
      sortDirection: this.sortDirection,
      onColumnSort: this.onColumnSort,
      visibleColumns: this.visibleColumns,
      columnOrder: this.columnOrder,
      onColumnOrderChange: this.onColumnOrderChange,
      onColumnResized: this.onColumnResized,
      onColumnPinned: this.onColumnPinned,
      pinnedColumns: this.pinnedColumnsInput,
      initialColumnWidths: this.initialColumnWidths,
      freezeRows: this.freezeRowsInput,
      freezeCols: this.freezeColsInput,
      layoutMode: this.layoutMode,
      suppressHorizontalScroll: this.suppressHorizontalScroll,
      columnReorder: this.columnReorder,
      isLoading: this.isLoadingInput,
      loadingMessage: this.loadingMessageInput,
      editable: this.editable,
      cellSelection: this.cellSelection,
      onCellValueChanged: this.onCellValueChanged as IOGridDataGridProps<T>['onCellValueChanged'],
      onUndo: this.onUndoInput,
      onRedo: this.onRedoInput,
      canUndo: this.canUndoInput,
      canRedo: this.canRedoInput,
      rowSelection: this.rowSelectionMode,
      selectedRows: this.selectedRows,
      onSelectionChange: this.onSelectionChange as IOGridDataGridProps<T>['onSelectionChange'],
      showRowNumbers: this.showRowNumbers,
      currentPage: this.currentPageInput,
      pageSize: this.pageSizeInput,
      statusBar: this.statusBar as IOGridDataGridProps<T>['statusBar'],
      filters: this.filters as IOGridDataGridProps<T>['filters'],
      onFilterChange: this.onFilterChange as IOGridDataGridProps<T>['onFilterChange'],
      filterOptions: this.filterOptions,
      loadingFilterOptions: this.loadingFilterOptions,
      peopleSearch: this.peopleSearch as IOGridDataGridProps<T>['peopleSearch'],
      getUserByEmail: this.getUserByEmail as IOGridDataGridProps<T>['getUserByEmail'],
      emptyState: this.emptyStateInput as IOGridDataGridProps<T>['emptyState'],
      onCellError: this.onCellError,
      'aria-label': this.ariaLabelInput,
      'aria-labelledby': this.ariaLabelledByInput,
    };
  }
}
