import {
  Component,
  Input,
  signal,
  computed,
  effect,
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
  ColumnReorderService,
  VirtualScrollService,
  StatusBarComponent,
  GridContextMenuComponent,
  MarchingAntsOverlayComponent,
  EmptyStateComponent,
  FormulaRefOverlayComponent,
  DEFAULT_MIN_COLUMN_WIDTH,
  ROW_NUMBER_COLUMN_ID,
  ROW_NUMBER_COLUMN_MIN_WIDTH,
  OGRID_THEME_VARS_CSS,
  indexToColumnLetter,
  formatCellReference,
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
    FormulaRefOverlayComponent,
    ColumnHeaderFilterComponent,
    ColumnHeaderMenuComponent,
    InlineCellEditorComponent,
    PopoverCellEditorComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  providers: [DataGridStateService, ColumnReorderService, VirtualScrollService],
  template: `
    <div class="ogrid-root">
      <div
        #wrapper
        tabindex="0"
        role="region"
        class="ogrid-scroll-wrapper"
        [class.ogrid-scroll-wrapper--loading-empty]="isLoading() && items().length === 0"
        [attr.aria-label]="resolvedAriaLabel()"
        [attr.aria-labelledby]="ariaLabelledBy()"
        [attr.data-empty]="showEmptyInGrid() ? 'true' : null"
        [attr.data-column-count]="state().layout.totalColCount"
        [attr.data-overflow-x]="allowOverflowX() ? 'true' : 'false'"
        data-ogrid-scroll-container
        [attr.data-has-selection]="rowSelectionMode !== 'none' ? 'true' : null"
        (contextmenu)="$event.preventDefault()"
        (keydown)="onGridKeyDown($event)"
        (pointerdown)="onWrapperMouseDown($event)"
        (scroll)="onWrapperScroll($event)"
        [style.--data-table-column-count]="state().layout.totalColCount"
        [style.--ogrid-row-height]="rowHeightCssVar()"
      >
        <div class="ogrid-table-wrapper">
          <div [class.loading-dimmed]="isLoading() && items().length > 0" class="ogrid-table-wrapper">
            <div #tableContainer class="ogrid-table-wrapper">
              <table class="ogrid-table" role="grid" [attr.data-virtual-scroll]="vsEnabled() ? '' : null">
                <thead [class]="stickyHeader() ? 'ogrid-thead ogrid-sticky-header' : 'ogrid-thead'">
                  @if (showColumnLetters()) {
                    <tr class="ogrid-column-letter-row">
                      @if (hasCheckboxCol()) {
                        <th class="ogrid-column-letter-cell"></th>
                      }
                      @if (hasRowNumbersCol()) {
                        <th class="ogrid-column-letter-cell"></th>
                      }
                      @for (col of visibleCols(); track col.columnId; let colIdx = $index) {
                        <th class="ogrid-column-letter-cell">
                          {{ getColumnLetter(colIdx) }}
                        </th>
                      }
                    </tr>
                  }
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
                        <th scope="col" rowSpan="1" class="ogrid-row-number-header"
                          [style.width.px]="getRowNumberWidth()"
                          [style.min-width.px]="getRowNumberWidth()"
                          [style.max-width.px]="getRowNumberWidth()"
                        >
                          #
                          <div
                            class="ogrid-resize-handle"
                            (pointerdown)="onResizeRowNumber($event)"
                            (dblclick)="$event.stopPropagation()"
                          ></div>
                        </th>
                      }
                      @if (rowIdx === 0 && rowIdx < headerRows().length - 1 && hasRowNumbersCol()) {
                        <th [attr.rowSpan]="headerRows().length - 1" class="ogrid-row-number-spacer"></th>
                      }
                      @for (cell of row; track cell.columnDef?.columnId ?? $index; let cellIdx = $index) {
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
                          @let config = getFilterConfig(col);
                          @let sortState = getSortState(col.columnId);
                          @let ariaSort = sortState === 'asc' ? 'ascending' : sortState === 'desc' ? 'descending' : null;
                          <th
                            scope="col"
                            class="ogrid-header-cell"
                            [attr.data-column-id]="col.columnId"
                            [attr.aria-sort]="ariaSort"
                            [attr.rowSpan]="headerRows().length > 1 && rowIdx < headerRows().length - 1 ? headerRows().length - rowIdx : null"
                            [class.ogrid-th-pinned-left]="pinned === 'left'"
                            [class.ogrid-th-pinned-right]="pinned === 'right'"
                            [style.min-width.px]="getEffectiveMinWidth(col)"
                            [style.width.px]="getColumnWidth(col)"
                            [style.max-width.px]="getColumnWidth(col)"
                            [style.left.px]="pinned === 'left' ? getPinnedLeftOffset(col.columnId) : null"
                            [style.right.px]="pinned === 'right' ? getPinnedRightOffset(col.columnId) : null"
                            [style.cursor]="columnReorderService.isDragging() ? 'grabbing' : 'grab'"
                            (pointerdown)="onHeaderMouseDown(col.columnId, $event)"
                          >
                            <div class="ogrid-header-content">
                              <ogrid-primeng-column-header-filter
                                [columnKey]="col.columnId"
                                [columnName]="col.name"
                                [filterType]="config.filterType"
                                [isSorted]="config.isSorted ?? false"
                                [isSortedDescending]="config.isSortedDescending ?? false"
                                [onSort]="config.onSort"
                                [selectedValues]="config.selectedValues"
                                [onFilterChange]="config.onFilterChange"
                                [options]="config.options ?? []"
                                [isLoadingOptions]="config.isLoadingOptions ?? false"
                                [textValue]="config.textValue ?? ''"
                                [onTextChange]="config.onTextChange"
                                [selectedUser]="config.selectedUser"
                                [onUserChange]="config.onUserChange"
                                [peopleSearch]="config.peopleSearch"
                                [dateValue]="config.dateValue"
                                [onDateChange]="config.onDateChange"
                              ></ogrid-primeng-column-header-filter>
                              @let colPinState = getPinState(col.columnId);
                              <column-header-menu
                                [columnId]="col.columnId"
                                [canPinLeft]="colPinState.canPinLeft"
                                [canPinRight]="colPinState.canPinRight"
                                [canUnpin]="colPinState.canUnpin"
                                [currentSort]="sortState"
                                [isSortable]="col.sortable !== false"
                                [isResizable]="col.resizable !== false"
                                [handlers]="getColumnMenuHandlersMemoized(col.columnId)"
                              />
                            </div>
                            <div
                              class="ogrid-resize-handle"
                              (pointerdown)="onResizeStartPrimeng($event, col)"
                              (dblclick)="onResizeDoubleClick($event, col)"
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
                        [attr.aria-selected]="isSelected || null"
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
                          <td class="ogrid-row-number-cell"
                            [style.width.px]="getRowNumberWidth()"
                            [style.min-width.px]="getRowNumberWidth()"
                            [style.max-width.px]="getRowNumberWidth()"
                          >
                            {{ rowNumberOffset() + rowIndex + 1 }}
                          </td>
                        }
                        @if (vsColumnsEnabled() && vsLeftSpacerWidth() > 0) {
                          <td [style.width.px]="vsLeftSpacerWidth()" [style.minWidth.px]="vsLeftSpacerWidth()" [style.maxWidth.px]="vsLeftSpacerWidth()" [style.padding]="'0'"></td>
                        }
                        @for (col of vsVisibleCols(); track col.columnId) {
                          @let pinned = isPinned(col.columnId);
                          <td
                            [attr.data-column-id]="col.columnId"
                            [class.ogrid-td-pinned-left]="pinned === 'left'"
                            [class.ogrid-td-pinned-right]="pinned === 'right'"
                            class="ogrid-data-cell"
                            [style.min-width.px]="getEffectiveMinWidth(col)"
                            [style.width.px]="getColumnWidth(col)"
                            [style.max-width.px]="getColumnWidth(col)"
                            [style.left.px]="pinned === 'left' ? getPinnedLeftOffset(col.columnId) : null"
                            [style.right.px]="pinned === 'right' ? getPinnedRightOffset(col.columnId) : null"
                            [style.text-align]="col.type === 'numeric' ? 'right' : null"
                          >
                            @let descriptor = getCellDescriptor(item, col, rowIndex, getGlobalColIndex(col));
                            @if (descriptor.mode === 'editing-inline') {
                              <div class="ogrid-editing-cell">
                              <ogrid-primeng-inline-cell-editor
                                [value]="descriptor.value"
                                [item]="item"
                                [column]="col"
                                [rowIndex]="rowIndex"
                                [editorType]="descriptor.editorType ?? 'text'"
                                (commit)="commitEdit(item, col.columnId, descriptor.value, $event, rowIndex, descriptor.globalColIndex)"
                                (cancel)="cancelEdit()"
                              ></ogrid-primeng-inline-cell-editor>
                              </div>
                            } @else if (descriptor.mode === 'editing-popover') {
                              @let editorProps = buildPopoverEditorProps(item, col, descriptor);
                              <ogrid-primeng-popover-cell-editor
                                [item]="item"
                                [column]="col"
                                [rowIndex]="rowIndex"
                                [globalColIndex]="descriptor.globalColIndex"
                                [displayValue]="descriptor.displayValue"
                                [editorProps]="editorProps"
                                [onCancel]="cancelEditHandler"
                              ></ogrid-primeng-popover-cell-editor>
                            } @else {
                              <div
                                [attr.data-row-index]="rowIndex"
                                [attr.data-col-index]="descriptor.globalColIndex"
                                [attr.data-active-cell]="descriptor.isActive ? 'true' : null"
                                [attr.data-in-range]="descriptor.isInRange ? 'true' : null"
                                [attr.tabindex]="descriptor.isActive ? 0 : -1"
                                (pointerdown)="onCellMouseDown($event, rowIndex, descriptor.globalColIndex)"
                                (click)="onCellClick(rowIndex, descriptor.globalColIndex)"
                                (dblclick)="descriptor.canEditAny ? onCellDblClick(descriptor.rowId, col.columnId) : null"
                                (contextmenu)="onCellContextMenu($event)"
                                class="ogrid-cell-content"
                                [style.cursor]="descriptor.canEditAny ? 'cell' : 'default'"
                                [style.background]="descriptor.isInRange && !descriptor.isActive ? 'var(--ogrid-range-bg, rgba(33, 115, 70, 0.08))' : (descriptor.isActive && descriptor.isInRange ? 'var(--ogrid-bg, #fff)' : null)"
                                [style.outline]="descriptor.isActive && !descriptor.isInRange ? '2px solid var(--ogrid-selection, #217346)' : null"
                                [style.outline-offset]="descriptor.isActive && !descriptor.isInRange ? '-2px' : null"
                              >
                                @if (col.type === 'boolean') {
                                  <input type="checkbox" [checked]="!!descriptor.displayValue" [disabled]="!descriptor.canEditAny" (change)="descriptor.canEditAny ? commitBooleanEdit(item, col.columnId, !!descriptor.displayValue, rowIndex, descriptor.globalColIndex) : null" (pointerdown)="onBooleanCheckboxPointerDown($event, rowIndex, descriptor.globalColIndex)" (click)="$event.stopPropagation()" style="margin:0;outline:none" [style.cursor]="descriptor.canEditAny ? 'pointer' : 'default'" [attr.aria-label]="descriptor.displayValue ? 'Checked' : 'Unchecked'" />
                                } @else {
                                  <span [style]="resolveCellStyleFn(col, item, descriptor.displayValue)">{{ resolveCellContent(col, item, descriptor.displayValue) }}</span>
                                }
                                @if (descriptor.canEditAny && descriptor.isSelectionEndCell) {
                                  <div
                                    (pointerdown)="onFillHandleMouseDown($event)"
                                    class="ogrid-fill-handle"
                                    aria-label="Fill handle"
                                  ></div>
                                }
                              </div>
                            }
                          </td>
                        }
                        @if (vsColumnsEnabled() && vsRightSpacerWidth() > 0) {
                          <td [style.width.px]="vsRightSpacerWidth()" [style.minWidth.px]="vsRightSpacerWidth()" [style.maxWidth.px]="vsRightSpacerWidth()" [style.padding]="'0'"></td>
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

              @if (formulaReferences() && formulaReferences()!.length > 0) {
                <ogrid-formula-ref-overlay
                  [containerEl]="tableContainerEl()"
                  [references]="formulaReferences()!"
                  [colOffset]="colOffset()"
                />
              }

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
          (copyAction)="handleCopy()"
          (cutAction)="handleCut()"
          (pasteAction)="handlePaste()"
          (selectAllAction)="handleSelectAllCells()"
          (undoAction)="onUndo()"
          (redoAction)="onRedo()"
          (closeAction)="closeContextMenu()"
        ></ogrid-context-menu>
      }

      @let sbConfig = statusBarConfig();
      @if (sbConfig) {
        <ogrid-status-bar
          [totalCount]="sbConfig.totalCount"
          [filteredCount]="sbConfig.filteredCount"
          [selectedCount]="sbConfig.selectedCount ?? selectedRowIds().size"
          [selectedCellCount]="selectionCellCount()"
          [aggregation]="sbConfig.aggregation"
          [suppressRowCount]="sbConfig.suppressRowCount"
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
  styles: [OGRID_THEME_VARS_CSS, `
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
    .ogrid-scroll-wrapper--loading-empty { min-height: 200px; }
    .ogrid-table-wrapper {
      position: relative;
      overflow-x: clip;
    }
    .ogrid-table {
      width: var(--data-table-width, 100%);
      min-width: var(--data-table-min-width, 100%);
      border-collapse: collapse;
      table-layout: fixed;
    }
    .ogrid-table tbody tr { height: var(--ogrid-row-height, auto); }
    .ogrid-thead {
      z-index: 3;
      background: var(--ogrid-header-bg, #f5f5f5);
    }
    .ogrid-sticky-header { position: sticky; top: 0; }
    .ogrid-sticky-header .ogrid-checkbox-header,
    .ogrid-sticky-header .ogrid-row-number-header { position: sticky; top: 0; }
    .ogrid-checkbox-header {
      width: 48px;
      min-width: 48px;
      max-width: 48px;
      text-align: center;
      background: var(--ogrid-header-bg, #f5f5f5);
      border-bottom: 2px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));
      z-index: 3;
    }
    .ogrid-row-number-header {
      text-align: center;
      font-weight: 600;
      background: var(--ogrid-header-bg, #f5f5f5);
      border-bottom: 2px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));
      z-index: 3;
      position: relative;
    }
    .ogrid-row-number-spacer {
      background: var(--ogrid-header-bg, #f5f5f5);
    }
    .ogrid-column-group-header {
      text-align: center;
      font-weight: 600;
      background: var(--ogrid-header-bg, #f5f5f5);
      border-bottom: 2px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));
      padding: 6px 10px;
    }
    .ogrid-header-cell {
      background: var(--ogrid-header-bg, #f5f5f5);
      border-bottom: 2px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));
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
      touch-action: none;
    }
    @media (pointer: coarse) {
      .ogrid-resize-handle { width: 16px; right: -6px; }
    }
    .ogrid-checkbox-cell {
      width: 48px;
      min-width: 48px;
      max-width: 48px;
      padding: 6px 4px;
      text-align: center;
      border-bottom: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));
    }
    .ogrid-row-number-cell {
      padding: 6px;
      text-align: center;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: var(--ogrid-fg-secondary, rgba(0, 0, 0, 0.6));
      background: var(--ogrid-header-bg, rgba(0, 0, 0, 0.04));
      border-bottom: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));
      position: sticky;
      left: 0;
      z-index: 3;
    }
    .ogrid-data-cell {
      padding: 0;
      border-bottom: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));
      position: relative;
    }
    .ogrid-data-cell:has(> [data-active-cell]),
    .ogrid-data-cell:has(> .ogrid-editing-cell) { z-index: 2; }
    .ogrid-cell-content {
      padding: var(--ogrid-cell-padding, 6px 10px);
      min-height: 20px;
      cursor: default;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .ogrid-editing-cell {
      width: 100%; height: 100%; display: flex; align-items: center; box-sizing: border-box;
      outline: 2px solid var(--ogrid-selection-color, #217346); outline-offset: -1px;
      z-index: 2; position: relative; background: var(--ogrid-bg, #fff); overflow: visible; padding: 0;
    }
    .ogrid-scroll-wrapper [data-drag-range] { background: var(--ogrid-range-bg, rgba(33, 115, 70, 0.12)); }
    .ogrid-fill-handle {
      position: absolute;
      bottom: -3px;
      right: -3px;
      width: 7px;
      height: 7px;
      background: var(--ogrid-selection, #217346);
      cursor: crosshair;
      touch-action: none;
      z-index: 2;
    }
    @media (pointer: coarse) {
      .ogrid-fill-handle { width: 14px; height: 14px; right: -7px; bottom: -7px; border-radius: 2px; }
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
      border-right: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));
      box-shadow: 2px 0 4px -1px rgba(0, 0, 0, 0.1);
    }
    .ogrid-th-pinned-right {
      position: sticky;
      top: 0;
      right: 0;
      z-index: 10;
      background: var(--ogrid-header-bg, #f5f5f5);
      border-left: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));
      box-shadow: -2px 0 4px -1px rgba(0, 0, 0, 0.1);
    }
    .ogrid-td-pinned-left {
      position: sticky;
      left: 0;
      z-index: 5;
      background: var(--ogrid-bg, #fff);
      border-right: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));
      box-shadow: 2px 0 4px -1px rgba(0, 0, 0, 0.1);
    }
    .ogrid-td-pinned-right {
      position: sticky;
      right: 0;
      z-index: 5;
      background: var(--ogrid-bg, #fff);
      border-left: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));
      box-shadow: -2px 0 4px -1px rgba(0, 0, 0, 0.1);
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
      z-index: 1000;
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

    /* PrimeNG Menu popup overrides.
       Double-class selectors (0,2,0) beat PrimeNG's single-class (0,1,0) defaults. */
    .p-menu.p-menu {
      background: var(--ogrid-bg, #ffffff);
      color: var(--ogrid-fg, rgba(0, 0, 0, 0.87));
      border: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));
      border-radius: 4px;
      padding: 4px 0;
    }
    .p-menu-overlay.p-menu-overlay {
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3), 0 0 0 1px var(--ogrid-border, rgba(0, 0, 0, 0.12));
    }
    .p-menu-item-content.p-menu-item-content {
      color: var(--ogrid-fg, rgba(0, 0, 0, 0.87));
    }
    .p-menu-item-link.p-menu-item-link {
      color: var(--ogrid-fg, rgba(0, 0, 0, 0.87));
      padding: 6px 12px;
    }
    .p-menu-item-label.p-menu-item-label {
      color: var(--ogrid-fg, rgba(0, 0, 0, 0.87));
      font-size: 0.875rem;
    }
    .p-menu-item:not(.p-disabled) .p-menu-item-content.p-menu-item-content:hover {
      background: var(--ogrid-hover-bg, rgba(0, 0, 0, 0.04));
      color: var(--ogrid-fg, rgba(0, 0, 0, 0.87));
    }
    .p-menu-separator.p-menu-separator {
      border-color: var(--ogrid-border, rgba(0, 0, 0, 0.12));
      margin: 4px 0;
    }
    .ogrid-column-letter-cell {
      text-align: center;
      font-size: 11px;
      font-weight: 500;
      color: var(--ogrid-fg-muted, rgba(0, 0, 0, 0.4));
      padding: 2px 4px;
      background: var(--ogrid-column-letter-bg, var(--ogrid-header-bg, #f5f5f5));
      border-bottom: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));
      user-select: none;
      font-variant-numeric: tabular-nums;
    }
    /* Reveal column menu trigger on header hover without layout shift.
       The button always takes up space (visibility: hidden); shown when column is hovered. */
    @media (hover: hover) {
      th:hover .column-header-menu-trigger { visibility: visible; }
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
  @Input() layoutMode: 'content' | 'fill' = 'fill';
  @Input() suppressHorizontalScroll: boolean | undefined = undefined;
  @Input() stickyHeaderInput: boolean | undefined = undefined;
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
  @Input() onCellError: ((error: Error, info: unknown) => void) | undefined = undefined;
  @Input({ alias: 'aria-label' }) ariaLabelInput: string | undefined = undefined;
  @Input({ alias: 'aria-labelledby' }) ariaLabelledByInput: string | undefined = undefined;
  @Input() showRowNumbers: boolean = false;
  @Input({ alias: 'showColumnLetters' }) showColumnLettersInput: boolean = false;
  @Input({ alias: 'showNameBox' }) showNameBoxInput: boolean = false;
  @Input() onActiveCellChange: ((ref: string | null) => void) | undefined = undefined;
  @Input({ alias: 'formulaReferences' }) formulaReferencesInput: import('@alaarab/ogrid-core').FormulaReference[] | undefined = undefined;
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

  readonly showColumnLetters = computed(() => !!this.getProps()?.showColumnLetters);
  readonly formulaReferences = computed(() => this.getProps()?.formulaReferences);

  constructor() {
    super();
    this.initBase();

    // Watch active cell and notify parent via onActiveCellChange when cellReferences is enabled
    effect(() => {
      const props = this.getProps();
      const onActiveCellChange = props?.onActiveCellChange;
      if (!onActiveCellChange) return;
      const ac = this.activeCell();
      if (ac) {
        const colIndex = ac.columnIndex - this.colOffset();
        const rowNumber = ac.rowIndex + 1;
        onActiveCellChange(formatCellReference(colIndex, rowNumber));
      } else {
        onActiveCellChange(null);
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Initialize column sizing from initial widths
    if (changes['initialColumnWidths']) {
      const iw = this.initialColumnWidths;
      if (iw) {
        this.primengColumnSizingOverrides.set({ ...iw });
      }
    }
    // Rebuild props and only set if values actually changed (shallow compare)
    const next = this.buildProps();
    const prev = this.propsSignal();
    if (!prev || !this.shallowEqual(prev, next)) {
      this.propsSignal.set(next);
    }
  }

  /** Shallow-compare two props objects by their top-level keys. */
  private shallowEqual(a: IOGridDataGridProps<T>, b: IOGridDataGridProps<T>): boolean {
    const aObj = a as unknown as Record<string, unknown>;
    const bObj = b as unknown as Record<string, unknown>;
    const keysA = Object.keys(aObj);
    const keysB = Object.keys(bObj);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
      if (aObj[key] !== bObj[key]) return false;
    }
    return true;
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

  // --- PrimeNG-specific event handlers ---

  onSelectAllChangePrimeng(checked: boolean): void {
    this.state().rowSelection.handleSelectAll(checked);
  }

  onRowClickPrimeng(e: MouseEvent, item: T): void {
    if (this.rowSelectionMode !== 'single') return;
    const rowId = this.getRowIdInput(item);
    const ids = this.selectedRowIds();
    this.state().rowSelection.updateSelection(ids.has(rowId) ? new Set() : new Set([rowId]));
  }


  onRowCheckboxChangePrimeng(item: T, checked: boolean, rowIndex: number, _e: Event): void {
    const rowId = this.getRowIdInput(item);
    this.state().rowSelection.handleRowCheckboxChange(rowId, checked, rowIndex, this.lastMouseShift);
  }

  onResizeStartPrimeng(e: PointerEvent, col: IColumnDef<T>): void {
    e.preventDefault();
    // Clear cell selection before resize so selection outlines don't persist during drag
    this.state().interaction.setActiveCell?.(null);
    this.state().interaction.setSelectionRange?.(null);
    this.getWrapperRef()?.nativeElement.focus({ preventScroll: true });
    this.resizeStartX = e.clientX;
    this.resizeColumnId = col.columnId;
    this.resizeStartWidth = col.columnId === ROW_NUMBER_COLUMN_ID ? this.getRowNumberWidth() : this.getColumnWidth(col);

    const onMove = (me: PointerEvent) => {
      const delta = me.clientX - this.resizeStartX;
      const minW = col.columnId === ROW_NUMBER_COLUMN_ID ? ROW_NUMBER_COLUMN_MIN_WIDTH : (col.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH);
      const newWidth = Math.max(minW, this.resizeStartWidth + delta);
      this.primengColumnSizingOverrides.update((prev) => ({ ...prev, [this.resizeColumnId]: newWidth }));
      this.columnSizingVersion.update(v => v + 1);
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
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

    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
  }

  onResizeRowNumber(event: PointerEvent): void {
    event.stopPropagation();
    this.onResizeStartPrimeng(event, { columnId: ROW_NUMBER_COLUMN_ID, name: '#' } as IColumnDef<T>);
  }

  override getRowNumberWidth(): number {
    const override = this.primengColumnSizingOverrides()[ROW_NUMBER_COLUMN_ID];
    if (override) return override;
    return super.getRowNumberWidth();
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
      showColumnLetters: this.showColumnLettersInput,
      showNameBox: this.showNameBoxInput,
      onActiveCellChange: this.onActiveCellChange,
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
      stickyHeader: this.stickyHeaderInput,
      'aria-label': this.ariaLabelInput,
      'aria-labelledby': this.ariaLabelledByInput,
      formulaReferences: this.formulaReferencesInput,
    };
  }

  getColumnLetter(colIdx: number): string {
    return indexToColumnLetter(colIdx);
  }
}
