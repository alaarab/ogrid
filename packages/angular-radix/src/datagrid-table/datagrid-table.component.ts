import { Component, ElementRef, ChangeDetectionStrategy, ViewEncapsulation, Input, ViewChild, signal, computed, effect } from '@angular/core';
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
  ROW_NUMBER_COLUMN_ID,
  OGRID_THEME_VARS_CSS,
  indexToColumnLetter,
  formatCellReference,
} from '@alaarab/ogrid-angular';
import type {
  IOGridDataGridProps,
  IColumnDef,
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
  encapsulation: ViewEncapsulation.None,
  imports: [ColumnHeaderFilterComponent, ColumnHeaderMenuComponent, StatusBarComponent, GridContextMenuComponent, MarchingAntsOverlayComponent, EmptyStateComponent, FormulaRefOverlayComponent, InlineCellEditorComponent, PopoverCellEditorComponent],
  providers: [DataGridStateService, ColumnReorderService, VirtualScrollService],
  styles: [OGRID_THEME_VARS_CSS, `
    :host { display: block; }
    .ogrid-datagrid-root {
      position: relative;
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }
    .ogrid-datagrid-wrapper {
      position: relative;
      flex: 1;
      min-height: 0;
      width: 100%;
      max-width: 100%;
      overflow-x: hidden;
      overflow-y: auto;
      background: var(--ogrid-bg, #ffffff);
      will-change: scroll-position;
      outline: none;
    }
    .ogrid-datagrid-wrapper [data-drag-range] {
      background: rgba(33, 115, 70, 0.12);
    }
    .ogrid-datagrid-wrapper--fit { width: fit-content; }
    .ogrid-datagrid-wrapper--overflow-x { overflow-x: auto; }
    .ogrid-datagrid-wrapper--loading-empty { min-height: 200px; }
    .ogrid-datagrid-scroll-wrapper {
      display: flex;
      flex-direction: column;
      min-height: 100%;
    }
    .ogrid-datagrid-table-wrapper--loading {
      position: relative;
      opacity: 0.6;
    }
    .ogrid-datagrid-table {
      width: 100%;
      min-width: max-content;
      border-collapse: collapse;
      table-layout: fixed;
    }
    .ogrid-datagrid-table tbody tr { height: var(--ogrid-row-height, auto); }
    .ogrid-datagrid-thead {
      z-index: 8;
      background: var(--ogrid-header-bg, #f5f5f5);
    }
    .ogrid-datagrid-thead th {
      background: var(--ogrid-header-bg, #f5f5f5);
    }
    .ogrid-datagrid-header-row {
      background: var(--ogrid-header-bg, #f5f5f5);
    }
    .ogrid-datagrid-th {
      font-weight: 600;
      padding: 6px 10px;
      text-align: left;
      font-size: 14px;
      border-bottom: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));
      color: var(--ogrid-fg, #242424);
      background: var(--ogrid-header-bg, #f5f5f5);
      z-index: 8;
    }
    .ogrid-sticky-header .ogrid-datagrid-th { position: sticky; top: 0; }
    .ogrid-datagrid-th:focus-visible {
      outline: 2px solid var(--ogrid-accent, #0078d4);
      outline-offset: -2px;
      z-index: 11;
    }
    .ogrid-datagrid-th--pinned-left {
      position: sticky;
      top: 0;
      left: 0;
      z-index: 10;
      background: var(--ogrid-header-bg, #f5f5f5);
      will-change: transform;
      border-right: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));
      box-shadow: 2px 0 4px -1px rgba(0, 0, 0, 0.1);
    }
    .ogrid-datagrid-th--pinned-right {
      position: sticky;
      top: 0;
      right: 0;
      z-index: 10;
      background: var(--ogrid-header-bg, #f5f5f5);
      will-change: transform;
      border-left: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));
      box-shadow: -2px 0 4px -1px rgba(0, 0, 0, 0.1);
    }
    .ogrid-datagrid-group-header {
      text-align: center;
      font-weight: 600;
      border-bottom: 2px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));
      padding: 6px;
    }
    .ogrid-datagrid-checkbox-col {
      width: 48px;
      min-width: 48px;
      max-width: 48px;
      text-align: center;
    }
    .ogrid-datagrid-checkbox-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .ogrid-datagrid-row:hover {
      background: var(--ogrid-hover-bg, #f9f9f9);
    }
    .ogrid-datagrid-row--selected {
      background: var(--ogrid-selected-row-bg, #e6f0fb);
    }
    .ogrid-datagrid-td {
      position: relative;
      padding: 0;
      height: 1px;
      border-bottom: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));
    }
    .ogrid-datagrid-td--pinned-left {
      position: sticky;
      left: 0;
      z-index: 6;
      background: var(--ogrid-bg, #ffffff);
      will-change: transform;
      border-right: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));
      box-shadow: 2px 0 4px -1px rgba(0, 0, 0, 0.1);
    }
    .ogrid-datagrid-td--pinned-right {
      position: sticky;
      right: 0;
      z-index: 6;
      background: var(--ogrid-bg, #ffffff);
      will-change: transform;
      border-left: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));
      box-shadow: -2px 0 4px -1px rgba(0, 0, 0, 0.1);
    }
    .ogrid-datagrid-cell {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      min-width: 0;
      padding: var(--ogrid-cell-padding, 6px 10px);
      box-sizing: border-box;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      user-select: none;
      outline: none;
      font-size: 14px;
      color: var(--ogrid-fg, #242424);
    }
    .ogrid-datagrid-cell:focus-visible {
      outline: 2px solid var(--ogrid-accent, #0078d4);
      outline-offset: -2px;
      z-index: 3;
    }
    .ogrid-datagrid-cell--numeric {
      justify-content: flex-end;
      text-align: right;
    }
    .ogrid-datagrid-cell--boolean {
      justify-content: center;
      text-align: center;
    }
    .ogrid-datagrid-cell--editable { cursor: cell; }
    .ogrid-datagrid-cell--active {
      outline: 2px solid var(--ogrid-active-border, #0078d4);
      outline-offset: -1px;
      z-index: 2;
      position: relative;
      overflow: visible;
    }
    .ogrid-datagrid-td:has(> .ogrid-datagrid-cell--active),
    .ogrid-datagrid-td:has(> .ogrid-editing-cell) { z-index: 2; }
    .ogrid-datagrid-cell--active-in-range {
      outline: none;
      background: var(--ogrid-bg, #fff);
    }
    .ogrid-datagrid-cell--in-range {
      background: var(--ogrid-bg-range, rgba(33, 115, 70, 0.12));
    }
    .ogrid-datagrid-cell--in-cut-range {
      background: var(--ogrid-hover-bg, rgba(0, 0, 0, 0.04));
      opacity: 0.7;
    }
    .ogrid-datagrid-cell--editing { padding: 0; }
    .ogrid-editing-cell {
      width: 100%; height: 100%; display: flex; align-items: center; box-sizing: border-box;
      outline: 2px solid var(--ogrid-selection-color, #217346); outline-offset: -1px;
      z-index: 2; position: relative; background: var(--ogrid-bg, #fff); overflow: visible; padding: 0;
    }
    .ogrid-datagrid-editor-input {
      width: 100%;
      height: 100%;
      padding: 6px 10px;
      border: 2px solid var(--ogrid-active-border, #0078d4);
      box-sizing: border-box;
      font-size: 14px;
      outline: none;
      background: var(--ogrid-bg, #ffffff);
      color: var(--ogrid-fg, #242424);
      font-family: inherit;
      line-height: inherit;
    }
    .ogrid-datagrid-cell--numeric .ogrid-datagrid-editor-input {
      text-align: right;
    }
    .ogrid-datagrid-editor-select {
      width: 100%;
      height: 100%;
      padding: 4px 8px;
      border: 2px solid var(--ogrid-active-border, #0078d4);
      box-sizing: border-box;
      font-size: 14px;
      background: var(--ogrid-bg, #ffffff);
      color: var(--ogrid-fg, #242424);
    }
    .ogrid-datagrid-fill-handle {
      position: absolute;
      right: -3px;
      bottom: -3px;
      width: 7px;
      height: 7px;
      background: var(--ogrid-active-border, #0078d4);
      border: 1px solid var(--ogrid-bg, #ffffff);
      border-radius: 1px;
      cursor: crosshair;
      pointer-events: auto;
      touch-action: none;
      z-index: 3;
    }
    @media (pointer: coarse) {
      .ogrid-datagrid-fill-handle { width: 14px; height: 14px; right: -7px; bottom: -7px; border-radius: 2px; }
    }
    .ogrid-datagrid-resize-handle {
      position: absolute;
      top: 0;
      right: -3px;
      bottom: 0;
      width: 8px;
      cursor: col-resize;
      user-select: none;
      touch-action: none;
    }
    @media (pointer: coarse) {
      .ogrid-datagrid-resize-handle { width: 16px; right: -8px; }
    }
    .ogrid-datagrid-resize-handle::after {
      content: '';
      position: absolute;
      top: 0;
      right: 3px;
      bottom: 0;
      width: 2px;
    }
    .ogrid-datagrid-resize-handle:hover::after {
      background: var(--ogrid-active-border, #0078d4);
    }
    .ogrid-datagrid-resize-handle:active::after {
      background: var(--ogrid-active-border, #0078d4);
    }
    .ogrid-datagrid-empty {
      padding: 32px 16px;
      text-align: center;
      border-top: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));
      background: var(--ogrid-header-bg, #f5f5f5);
    }
    .ogrid-datagrid-empty__title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 8px;
      color: var(--ogrid-fg, #242424);
    }
    .ogrid-datagrid-empty__message {
      font-size: 14px;
      color: var(--ogrid-fg, #242424);
      opacity: 0.7;
    }
    .ogrid-datagrid-empty__clear {
      background: none;
      border: none;
      color: var(--ogrid-active-border, #0078d4);
      cursor: pointer;
      font-size: inherit;
      text-decoration: underline;
      padding: 0;
    }
    .ogrid-datagrid-loading-overlay {
      position: absolute;
      inset: 0;
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--ogrid-loading-overlay, rgba(255, 255, 255, 0.7));
    }
    .ogrid-datagrid-loading-inner {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 16px;
      background: var(--ogrid-bg, #ffffff);
      border: 1px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));
      border-radius: 4px;
    }
    .ogrid-datagrid-spinner {
      width: 24px;
      height: 24px;
      border: 3px solid var(--ogrid-border, rgba(0, 0, 0, 0.12));
      border-top-color: var(--ogrid-active-border, #0078d4);
      border-radius: 50%;
      animation: ogrid-spin 0.8s linear infinite;
    }
    @keyframes ogrid-spin { to { transform: rotate(360deg); } }
    .ogrid-datagrid-drop-indicator {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 3px;
      background: var(--ogrid-active-border, #0078d4);
      pointer-events: none;
      z-index: 100;
      transition: left 0.05s;
    }
    .ogrid-datagrid-context-menu-overlay {
      position: fixed;
      inset: 0;
      z-index: 1000;
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
    .ogrid-datagrid-checkbox-spacer {
      width: 48px;
      min-width: 48px;
      padding: 0;
    }
    .ogrid-datagrid-th--reorderable {
      cursor: grab;
    }
    .ogrid-datagrid-th--dragging {
      cursor: grabbing;
    }
    .ogrid-datagrid-row-number-header {
      text-align: center;
      font-weight: 600;
      background: var(--ogrid-header-bg, rgba(0, 0, 0, 0.04));
      color: var(--ogrid-fg-secondary, rgba(0, 0, 0, 0.6));
      position: sticky;
      left: 0;
      z-index: 9;
    }
    .ogrid-datagrid-row-number-spacer {
      padding: 0;
    }
    .ogrid-datagrid-row-number-cell {
      text-align: center;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: var(--ogrid-fg-secondary, rgba(0, 0, 0, 0.6));
      background: var(--ogrid-header-bg, rgba(0, 0, 0, 0.04));
      padding: 6px;
      position: sticky;
      left: 0;
      z-index: 6;
    }
  `],
  template: `
    <div class="ogrid-datagrid-root">
      <div
        #wrapperEl
        class="ogrid-datagrid-wrapper"
        [class.ogrid-datagrid-wrapper--fit]="layoutModeFit()"
        [class.ogrid-datagrid-wrapper--loading-empty]="isLoading() && items().length === 0"
        [style.--ogrid-row-height]="rowHeightCssVar()"
        tabindex="0"
        role="region"
        [attr.aria-label]="ariaLabel()"
        [attr.aria-labelledby]="ariaLabelledBy()"
        (pointerdown)="onWrapperMouseDown($event)"
        (keydown)="onGridKeyDown($event)"
        (scroll)="onWrapperScroll($event)"
        (contextmenu)="$event.preventDefault()"
        [class.ogrid-datagrid-wrapper--overflow-x]="allowOverflowX()"
        [attr.data-overflow-x]="allowOverflowX() ? 'true' : 'false'"
        data-ogrid-scroll-container
      >
        <div class="ogrid-datagrid-scroll-wrapper">
          <div [style.minWidth.px]="allowOverflowX() ? minTableWidth() : undefined" style="overflow-x: clip">
            <div [class.ogrid-datagrid-table-wrapper--loading]="isLoading() && items().length > 0" #tableContainerElRef>
              <table class="ogrid-datagrid-table" role="grid" [style.minWidth.px]="minTableWidth()"
                [attr.data-virtual-scroll]="vsEnabled() ? '' : null"
              >
                <thead [class]="stickyHeader() ? 'ogrid-datagrid-thead ogrid-sticky-header' : 'ogrid-datagrid-thead'">
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
                        <th class="ogrid-datagrid-th ogrid-datagrid-row-number-header" [attr.rowSpan]="headerRows().length > 1 ? 1 : null"
                          [style.width.px]="getRowNumberWidth()"
                          [style.min-width.px]="getRowNumberWidth()"
                          [style.max-width.px]="getRowNumberWidth()"
                        >
                          #
                          <div class="ogrid-datagrid-resize-handle" (pointerdown)="onResizeRowNumber($event)" (dblclick)="$event.stopPropagation()"></div>
                        </th>
                      }
                      @if (rowIdx === 0 && rowIdx < headerRows().length - 1 && hasRowNumbersCol()) {
                        <th [attr.rowSpan]="headerRows().length - 1" class="ogrid-datagrid-th ogrid-datagrid-row-number-spacer"></th>
                      }
                      @for (cell of row; track cell.columnDef?.columnId ?? $index; let cellIdx = $index) {
                        @if (cell.isGroup) {
                          <th [attr.colSpan]="cell.colSpan" scope="colgroup" class="ogrid-datagrid-th ogrid-datagrid-group-header">
                            {{ cell.label }}
                          </th>
                        } @else {
                          @let col = asColumnDef(cell.columnDef);
                          @let colW = getColumnWidth(col);
                          @let pinned = isPinned(col.columnId);
                          @let pinnedLeft = pinned === 'left';
                          @let pinnedRight = pinned === 'right';
                          @let sortState = getSortState(col.columnId);
                          @let ariaSort = sortState === 'asc' ? 'ascending' : sortState === 'desc' ? 'descending' : null;
                          @let config = getFilterConfig(col);
                          <th scope="col"
                            class="ogrid-datagrid-th"
                            [class.ogrid-datagrid-th--pinned-left]="pinnedLeft"
                            [class.ogrid-datagrid-th--pinned-right]="pinnedRight"
                            [attr.rowSpan]="headerRows().length > 1 ? headerRows().length - rowIdx : null"
                            [attr.data-column-id]="col.columnId"
                            [attr.aria-sort]="ariaSort"
                            [style.minWidth.px]="getEffectiveMinWidth(col)"
                            [style.width.px]="colW"
                            [style.maxWidth.px]="colW"
                            [style.left.px]="pinnedLeft ? getPinnedLeftOffset(col.columnId) : null"
                            [style.right.px]="pinnedRight ? getPinnedRightOffset(col.columnId) : null"
                            [class.ogrid-datagrid-th--reorderable]="!columnReorderService.isDragging()"
                            [class.ogrid-datagrid-th--dragging]="columnReorderService.isDragging()"
                            (pointerdown)="onHeaderMouseDown(col.columnId, $event)"
                          >
                            <div style="display: flex; align-items: center; gap: 4px; flex: 1; min-width: 0;">
                              <column-header-filter
                                [columnKey]="col.columnId"
                                [columnName]="col.name"
                                [filterType]="config.filterType"
                                [isSorted]="config.isSorted"
                                [isSortedDescending]="config.isSortedDescending"
                                [onSort]="config.onSort"
                                [selectedValues]="config.selectedValues"
                                [onFilterChange]="config.onFilterChange"
                                [options]="config.options"
                                [isLoadingOptions]="config.isLoadingOptions ?? false"
                                [textValue]="config.textValue ?? ''"
                                [onTextChange]="config.onTextChange"
                                [selectedUser]="config.selectedUser"
                                [onUserChange]="config.onUserChange"
                                [peopleSearch]="config.peopleSearch"
                                [dateValue]="config.dateValue"
                                [onDateChange]="config.onDateChange"
                              />
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
                            <div class="ogrid-datagrid-resize-handle" (pointerdown)="onResizeStart($event, col)" (dblclick)="onResizeDoubleClick($event, col)"></div>
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
                        [attr.aria-selected]="isSelected || null"
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
                          <td class="ogrid-datagrid-td ogrid-datagrid-row-number-cell"
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
                        @for (colLayout of vsColumnLayouts(); track colLayout.col.columnId) {
                          <td
                            class="ogrid-datagrid-td"
                            [attr.data-column-id]="colLayout.col.columnId"
                            [class.ogrid-datagrid-td--pinned-left]="colLayout.pinnedLeft"
                            [class.ogrid-datagrid-td--pinned-right]="colLayout.pinnedRight"
                            [style.minWidth.px]="colLayout.minWidth"
                            [style.width.px]="colLayout.width"
                            [style.maxWidth.px]="colLayout.width"
                            [style.left.px]="colLayout.pinnedLeft ? getPinnedLeftOffset(colLayout.col.columnId) : null"
                            [style.right.px]="colLayout.pinnedRight ? getPinnedRightOffset(colLayout.col.columnId) : null"
                          >
                            @let descriptor = getCellDescriptor(item, colLayout.col, rowIndex, getGlobalColIndex(colLayout.col));
                            @if (descriptor.mode === 'editing-inline') {
                              <div class="ogrid-editing-cell">
                              <ogrid-radix-inline-cell-editor
                                [value]="descriptor.value"
                                [item]="item"
                                [column]="colLayout.col"
                                [rowIndex]="rowIndex"
                                [editorType]="descriptor.editorType ?? 'text'"
                                (commit)="commitEdit(item, colLayout.col.columnId, descriptor.value, $event, rowIndex, descriptor.globalColIndex)"
                                (cancel)="cancelEdit()"
                              ></ogrid-radix-inline-cell-editor>
                              </div>
                            } @else if (descriptor.mode === 'editing-popover') {
                              @let editorProps = buildPopoverEditorProps(item, colLayout.col, descriptor);
                              <ogrid-radix-popover-cell-editor
                                [item]="item"
                                [column]="colLayout.col"
                                [rowIndex]="rowIndex"
                                [globalColIndex]="descriptor.globalColIndex"
                                [displayValue]="descriptor.displayValue"
                                [editorProps]="editorProps"
                                [onCancel]="cancelEditBound"
                              ></ogrid-radix-popover-cell-editor>
                            } @else {
                              @let content = resolveCellContent(colLayout.col, item, descriptor.displayValue);
                              @let cellStyle = resolveCellStyleFn(colLayout.col, item, descriptor.displayValue);
                              <div
                                class="ogrid-datagrid-cell"
                                [class.ogrid-datagrid-cell--active]="descriptor.isActive"
                                [class.ogrid-datagrid-cell--active-in-range]="descriptor.isActive && descriptor.isInRange"
                                [class.ogrid-datagrid-cell--in-range]="descriptor.isInRange && !descriptor.isActive"
                                [class.ogrid-datagrid-cell--in-cut-range]="descriptor.isInCutRange"
                                [class.ogrid-datagrid-cell--editable]="descriptor.canEditAny"
                                [class.ogrid-datagrid-cell--numeric]="colLayout.col.type === 'numeric'"
                                [class.ogrid-datagrid-cell--boolean]="colLayout.col.type === 'boolean'"
                                [attr.data-row-index]="rowIndex"
                                [attr.data-col-index]="descriptor.globalColIndex"
                                [attr.data-in-range]="descriptor.isInRange ? 'true' : null"
                                [attr.tabindex]="descriptor.isActive ? 0 : -1"
                                (pointerdown)="onCellMouseDown($event, rowIndex, descriptor.globalColIndex)"
                                (click)="onCellClick(rowIndex, descriptor.globalColIndex)"
                                (contextmenu)="onCellContextMenu($event)"
                                (dblclick)="descriptor.canEditAny ? onCellDblClick(descriptor.rowId, colLayout.col.columnId) : null"
                                [attr.role]="descriptor.canEditAny ? 'button' : null"
                                [style]="cellStyle ?? undefined"
                              >
                                @if (colLayout.col.type === 'boolean') {
                                  <input type="checkbox" [checked]="!!descriptor.displayValue" [disabled]="!descriptor.canEditAny" (change)="descriptor.canEditAny ? commitEdit(item, colLayout.col.columnId, !!descriptor.displayValue, !descriptor.displayValue, rowIndex, descriptor.globalColIndex) : null" (click)="$event.stopPropagation()" style="margin:0;outline:none" [style.cursor]="descriptor.canEditAny ? 'pointer' : 'default'" [attr.aria-label]="descriptor.displayValue ? 'Checked' : 'Unchecked'" />
                                } @else {
                                  {{ content }}
                                }
                                @if (descriptor.canEditAny && descriptor.isSelectionEndCell) {
                                  <div
                                    class="ogrid-datagrid-fill-handle"
                                    (pointerdown)="onFillHandleMouseDown($event)"
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
                <div class="ogrid-datagrid-empty">
                  <div class="ogrid-datagrid-empty__title">No results found</div>
                  <div class="ogrid-datagrid-empty__message">
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

      @let sbConfig = statusBarConfig();
      @if (sbConfig) {
        <ogrid-status-bar
          [totalCount]="sbConfig.totalCount"
          [filteredCount]="sbConfig.filteredCount"
          [selectedCount]="sbConfig.selectedCount ?? selectedRowIds().size"
          [selectedCellCount]="selectionCellCount()"
          [aggregation]="sbConfig.aggregation"
          [suppressRowCount]="sbConfig.suppressRowCount"
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
  @ViewChild('tableContainerElRef') private tableContainerRef?: ElementRef<HTMLElement>;

  readonly cancelEditBound = () => this.cancelEdit();

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

  protected getProps(): IOGridDataGridProps<T> | undefined {
    return this.propsSignal();
  }

  protected getWrapperRef(): ElementRef<HTMLElement> | undefined {
    return this.wrapperRef;
  }

  protected getTableContainerRef(): ElementRef<HTMLElement> | undefined {
    return this.tableContainerRef;
  }

  getColumnLetter(colIdx: number): string {
    return indexToColumnLetter(colIdx);
  }

  onResizeRowNumber(event: PointerEvent): void {
    event.stopPropagation();
    this.onResizeStart(event, { columnId: ROW_NUMBER_COLUMN_ID, name: '#' } as IColumnDef<T>);
  }

}
