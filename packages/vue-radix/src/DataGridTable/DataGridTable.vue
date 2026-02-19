<script setup lang="ts">
import { computed, defineComponent, h, Teleport } from 'vue';
import {
  useDataGridTableSetup,
  getHeaderFilterConfig,
  getCellRenderDescriptor,
  resolveCellDisplayContent,
  resolveCellStyle,
  buildInlineEditorProps,
  buildPopoverEditorProps,
  getCellInteractionProps,
  buildHeaderRows,
  CHECKBOX_COLUMN_WIDTH,
  ROW_NUMBER_COLUMN_WIDTH,
  DEFAULT_MIN_COLUMN_WIDTH,
  type IOGridDataGridProps,
  type IColumnDef,
  type ICellEditorProps,
} from '@alaarab/ogrid-vue';
import ColumnHeaderFilter from '../ColumnHeaderFilter/ColumnHeaderFilter.vue';
import ColumnHeaderMenu from '../ColumnHeaderMenu/ColumnHeaderMenu.vue';
import InlineCellEditor from './InlineCellEditor.vue';
import { StatusBar, MarchingAntsOverlay } from '@alaarab/ogrid-vue';
import GridContextMenu from './GridContextMenu.vue';

const props = defineProps<{
  gridProps: IOGridDataGridProps<any>;
}>();

const propsRef = computed(() => props.gridProps);

const {
  wrapperRef,
  tableContainerRef,
  tableRef,
  lastMouseShift,
  state,
  columnReorder: { isDragging: isReorderDragging, dropIndicatorX, handleHeaderMouseDown: handleReorderMouseDown },
  virtualScroll: { containerRef: vsContainerRef, visibleRange, totalHeight, scrollToRow },
  virtualScrollEnabled,
  columnResize: { handleResizeStart, getColumnWidth },
} = useDataGridTableSetup({ props: propsRef });

// Wrap refs in plain object to prevent Vue template auto-unwrapping
// (MarchingAntsOverlay expects Ref<HTMLElement | null>, not the raw element)
const _refs = { tableContainer: tableContainerRef };

// Computed state refs
const layout = computed(() => state.layout.value);
const rowSel = computed(() => state.rowSelection.value);
const editing = computed(() => state.editing.value);
const interaction = computed(() => state.interaction.value);
const ctxMenu = computed(() => state.contextMenu.value);
const viewModels = computed(() => state.viewModels.value);
const pinning = computed(() => state.pinning.value);
const headerMenu = computed(() => pinning.value.headerMenu);

const headerRows = computed(() => buildHeaderRows(props.gridProps.columns, props.gridProps.visibleColumns));

// Computed items for virtual scrolling support
const visibleItems = computed(() => {
  const items = props.gridProps.items;
  if (!virtualScrollEnabled.value) return items.map((item, i) => ({ item, rowIndex: i }));
  const vr = visibleRange.value;
  const result: { item: any; rowIndex: number }[] = [];
  for (let i = vr.startIndex; i <= Math.min(vr.endIndex, items.length - 1); i++) {
    if (items[i]) result.push({ item: items[i], rowIndex: i });
  }
  return result;
});

// Pagination-aware row number offset
const rowNumberOffset = computed(() => {
  if (!layout.value.hasRowNumbersCol) return 0;
  const currentPage = props.gridProps.currentPage ?? 1;
  const pageSize = props.gridProps.pageSize ?? 25;
  return (currentPage - 1) * pageSize;
});

// Layout overflow handling
const fitToContent = computed(() => (props.gridProps.layoutMode ?? 'fill') === 'content');
const allowOverflowX = computed(() => {
  const l = layout.value;
  return !props.gridProps.suppressHorizontalScroll
    && l.containerWidth > 0
    && (l.minTableWidth > l.containerWidth || l.desiredTableWidth > l.containerWidth);
});

// Read pre-computed pinning offsets
const pinningOffsets = computed(() => ({
  leftOffsets: pinning.value.leftOffsets,
  rightOffsets: pinning.value.rightOffsets,
}));

const handleSingleRowClick = (e: MouseEvent, rowId: string | number) => {
  if (props.gridProps.rowSelection !== 'single') return;
  const sel = rowSel.value.selectedRowIds;
  rowSel.value.updateSelection(sel.has(rowId) ? new Set() : new Set([rowId]));
};

const handleRowCheckboxChange = (rowId: string | number, checked: boolean, rowIndex: number) => {
  rowSel.value.handleRowCheckboxChange(rowId, checked, rowIndex, lastMouseShift.value);
};

const isRowSelected = (rowId: string | number) => {
  return rowSel.value.selectedRowIds.has(rowId);
};

const handleKeyDown = (e: KeyboardEvent) => {
  interaction.value.handleGridKeyDown(e);
};

const NOOP = () => {};

// Cell render helpers
const getCellRenderData = (item: any, col: IColumnDef<any>, rowIndex: number, colIndex: number) => {
  const descriptor = getCellRenderDescriptor(item, col, rowIndex, colIndex, viewModels.value.cellDescriptorInput);
  const editCallbacks = {
    commitCellEdit: editing.value.commitCellEdit,
    setEditingCell: editing.value.setEditingCell,
    setPendingEditorValue: editing.value.setPendingEditorValue,
    cancelPopoverEdit: editing.value.cancelPopoverEdit,
  };

  if (descriptor.mode === 'editing-inline') {
    const editorProps = buildInlineEditorProps(item, col, descriptor, editCallbacks);
    return { type: 'editor' as const, props: editorProps, descriptor };
  }

  if (descriptor.mode === 'editing-popover' && typeof col.cellEditor === 'function') {
    const editorProps = buildPopoverEditorProps(item, col, descriptor, editing.value.pendingEditorValue, editCallbacks);
    return { type: 'popover-editor' as const, props: editorProps, col, descriptor };
  }

  return { type: 'content' as const, props: null, descriptor };
};

const getCellDisplayValue = (item: any, col: IColumnDef<any>, rowIndex: number, colIndex: number) => {
  const descriptor = getCellRenderDescriptor(item, col, rowIndex, colIndex, viewModels.value.cellDescriptorInput);
  return resolveCellDisplayContent(col, item, descriptor.displayValue);
};

const getCellClass = (rowIndex: number, colIndex: number, col: IColumnDef<any>, item: any) => {
  const descriptor = getCellRenderDescriptor(item, col, rowIndex, colIndex, viewModels.value.cellDescriptorInput);
  const classes = ['ogrid-cell'];

  if (descriptor.isActive && !descriptor.isInRange) {
    classes.push('ogrid-active-cell');
  }

  if (descriptor.isInRange) {
    classes.push('ogrid-selected-cell');
  }

  return classes.join(' ');
};

const getCellStyle = (item: any, col: IColumnDef<any>, rowIndex: number, colIndex: number) => {
  const descriptor = getCellRenderDescriptor(item, col, rowIndex, colIndex, viewModels.value.cellDescriptorInput);
  const columnWidth = getColumnWidth(col);

  // Use previously-measured DOM width as a minWidth floor to prevent columns
  // from shrinking when new data loads (e.g. server-side pagination).
  const layoutValue = layout.value;
  const hasResizeOverride = !!layoutValue.columnSizingOverrides[col.columnId];
  const measuredW = layoutValue.measuredColumnWidths[col.columnId];
  const baseMinWidth = col.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH;
  const effectiveMinWidth = hasResizeOverride ? columnWidth : Math.max(baseMinWidth, measuredW ?? 0);

  const style: Record<string, string> = {
    position: 'relative',
    padding: '0',
    minWidth: `${effectiveMinWidth}px`,
    width: `${columnWidth}px`,
    maxWidth: `${columnWidth}px`,
  };

  // Column pinning
  const isPinnedLeft = col.pinned === 'left';
  const isPinnedRight = col.pinned === 'right';

  if (isPinnedLeft) {
    const offsets = pinningOffsets.value;
    style.position = 'sticky';
    style.left = `${offsets.leftOffsets[col.columnId] ?? 0}px`;
    style.zIndex = '6';
    style.backgroundColor = 'var(--ogrid-bg, #fff)';
    style.willChange = 'transform';
  } else if (isPinnedRight) {
    const offsets = pinningOffsets.value;
    style.position = 'sticky';
    style.right = `${offsets.rightOffsets[col.columnId] ?? 0}px`;
    style.zIndex = '6';
    style.backgroundColor = 'var(--ogrid-bg, #fff)';
    style.willChange = 'transform';
  }

  if (descriptor.canEditAny) {
    style.cursor = 'cell';
  }

  if (descriptor.isInCutRange) {
    style.backgroundColor = 'rgba(0,0,0,0.04)';
    style.opacity = '0.7';
  }

  return style;
};

// Header cell style (with pinning support)
const getHeaderCellStyle = (col: IColumnDef<any>, colIndex: number) => {
  const columnWidth = getColumnWidth(col);
  const isPinnedLeft = col.pinned === 'left';
  const isPinnedRight = col.pinned === 'right';

  // Apply the same measured-width floor as body cells
  const layoutValue = layout.value;
  const hasResizeOverride = !!layoutValue.columnSizingOverrides[col.columnId];
  const measuredW = layoutValue.measuredColumnWidths[col.columnId];
  const baseMinWidth = col.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH;
  const effectiveMinWidth = hasResizeOverride ? columnWidth : Math.max(baseMinWidth, measuredW ?? 0);

  const style: Record<string, string> = {
    width: `${columnWidth}px`,
    minWidth: `${effectiveMinWidth}px`,
    maxWidth: `${columnWidth}px`,
  };

  if (isPinnedLeft) {
    const offsets = pinningOffsets.value;
    style.position = 'sticky';
    style.top = '0';
    style.left = `${offsets.leftOffsets[col.columnId] ?? 0}px`;
    style.zIndex = '10';
    style.backgroundColor = 'var(--ogrid-header-bg, #f5f5f5)';
    style.willChange = 'transform';
  } else if (isPinnedRight) {
    const offsets = pinningOffsets.value;
    style.position = 'sticky';
    style.top = '0';
    style.right = `${offsets.rightOffsets[col.columnId] ?? 0}px`;
    style.zIndex = '10';
    style.backgroundColor = 'var(--ogrid-header-bg, #f5f5f5)';
    style.willChange = 'transform';
  }

  return style;
};

// Cell content style (with numeric/boolean alignment)
const getCellContentStyle = (col: IColumnDef<any>, item: any, rowIndex: number, colIndex: number) => {
  const descriptor = getCellRenderDescriptor(item, col, rowIndex, colIndex, viewModels.value.cellDescriptorInput);
  const style: Record<string, string> = {
    padding: '8px 12px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    position: 'relative',
  };

  if (col.type === 'numeric') {
    style.textAlign = 'right';
  } else if (col.type === 'boolean') {
    style.textAlign = 'center';
  }

  // Apply custom cell styles
  const customStyle = resolveCellStyle(col, item);
  if (customStyle) {
    Object.assign(style, customStyle);
  }

  return style;
};

const shouldShowFillHandle = (item: any, col: IColumnDef<any>, rowIndex: number, colIndex: number) => {
  const range = interaction.value.selectionRange;
  if (!range) return false;

  const descriptor = getCellRenderDescriptor(item, col, rowIndex, colIndex, viewModels.value.cellDescriptorInput);
  return descriptor.canEditAny && descriptor.isSelectionEndCell;
};

const getFilterProps = (col: IColumnDef<any>) => {
  return getHeaderFilterConfig(col, viewModels.value.headerFilterInput);
};

// Popover anchor ref
const setPopoverAnchorEl = (el: HTMLElement) => {
  editing.value.setPopoverAnchorEl(el);
};

// Bind wrapperRef to element via ref callback
const setWrapperRef = (el: any) => {
  wrapperRef.value = el as HTMLDivElement;
  vsContainerRef.value = el as HTMLElement;
};
</script>

<template>
  <div class="ogrid-wrapper">
    <!-- Main Grid -->
    <div
      :ref="setWrapperRef"
      class="ogrid-table-container"
      :style="{
        overflowX: gridProps.suppressHorizontalScroll ? 'hidden' : allowOverflowX ? 'auto' : 'hidden',
        overflowY: 'auto',
        opacity: gridProps.isLoading && gridProps.items.length > 0 ? '0.6' : '1',
        '--ogrid-row-height': gridProps.rowHeight ? `${gridProps.rowHeight}px` : undefined,
      }"
      tabindex="0"
      role="region"
      :aria-label="gridProps['aria-label'] ?? (!gridProps['aria-labelledby'] ? 'Data grid' : undefined)"
      :aria-labelledby="gridProps['aria-labelledby']"
      @keydown="handleKeyDown"
      @mousedown="(e) => { lastMouseShift = e.shiftKey; }"
      @contextmenu.prevent
    >
      <!-- Drop Indicator for Column Reorder -->
      <div
        v-if="isReorderDragging && dropIndicatorX !== null"
        class="ogrid-drop-indicator"
        :style="{ left: `${dropIndicatorX}px` }"
      ></div>

      <div :ref="(el) => { tableContainerRef = el as HTMLDivElement; }" style="position: relative">
        <table
          :ref="(el) => { tableRef = el as HTMLElement; }"
          class="ogrid-table"
          :style="{
            width: fitToContent ? 'auto' : '100%',
            minWidth: allowOverflowX ? `${layout.minTableWidth}px` : undefined,
          }"
        >
          <!-- Header -->
          <thead>
            <tr
              v-for="(row, rowIdx) in headerRows"
              :key="rowIdx"
              class="ogrid-header-row"
            >
              <!-- Checkbox Header -->
              <th
                v-if="layout.hasCheckboxCol && rowIdx === 0"
                :rowspan="headerRows.length"
                class="ogrid-header-cell ogrid-selection-header"
                :style="{ width: `${CHECKBOX_COLUMN_WIDTH}px` }"
              >
                <input
                  v-if="gridProps.rowSelection === 'multiple'"
                  :ref="(el) => { if (el) (el as HTMLInputElement).indeterminate = rowSel.someSelected && !rowSel.allSelected; }"
                  type="checkbox"
                  :checked="rowSel.allSelected"
                  @change="rowSel.handleSelectAll"
                  aria-label="Select all rows"
                  class="ogrid-checkbox"
                />
              </th>

              <!-- Row Numbers Header -->
              <th
                v-if="layout.hasRowNumbersCol && rowIdx === headerRows.length - 1"
                class="ogrid-header-cell ogrid-row-number-header"
                :style="{ width: `${ROW_NUMBER_COLUMN_WIDTH}px`, textAlign: 'center' }"
              >
                #
              </th>

              <!-- Header Cells -->
              <th
                v-for="cell in row"
                :key="cell.columnDef?.columnId || `group-${rowIdx}`"
                :colspan="cell.colSpan"
                :rowspan="!cell.isGroup ? headerRows.length - cell.depth : undefined"
                :class="['ogrid-header-cell', { 'ogrid-group-header': cell.isGroup }]"
                :style="cell.columnDef && !cell.isGroup
                  ? getHeaderCellStyle(cell.columnDef, layout.visibleCols.indexOf(cell.columnDef))
                  : undefined"
                :data-column-id="cell.columnDef?.columnId"
                :aria-sort="cell.columnDef && !cell.isGroup && gridProps.sort?.field === cell.columnDef.columnId
                  ? (gridProps.sort.direction === 'asc' ? 'ascending' : 'descending')
                  : undefined"
                @mousedown="cell.columnDef && !cell.isGroup ? (e) => handleReorderMouseDown(cell.columnDef.columnId, e) : undefined"
              >
                <div class="ogrid-header-content">
                  <ColumnHeaderFilter
                    v-if="cell.columnDef && !cell.isGroup"
                    v-bind="getFilterProps(cell.columnDef)"
                  />
                  <span v-else class="ogrid-header-label">
                    {{ cell.label }}
                  </span>
                  <button
                    v-if="cell.columnDef && !cell.isGroup"
                    class="ogrid-header-menu-btn"
                    aria-label="Column options"
                    title="Column options"
                    @click.stop="(e: MouseEvent) => headerMenu.open(cell.columnDef.columnId, e.currentTarget as HTMLElement)"
                  >&#8942;</button>
                </div>

                <!-- Resize Handle -->
                <div
                  v-if="cell.columnDef && cell.columnDef.resizable !== false"
                  class="ogrid-resize-handle"
                  @mousedown.stop="(e) => {
                    // Clear cell selection/focus before resize so outlines
                    // and focus rings don't persist during drag (parity with React).
                    interaction.setActiveCell(null);
                    interaction.setSelectionRange(null);
                    wrapperRef?.focus({ preventScroll: true });
                    handleResizeStart(e, cell.columnDef!);
                  }"
                ></div>
              </th>
            </tr>
          </thead>

          <!-- Body with virtual scrolling support -->
          <tbody v-if="!viewModels.showEmptyInGrid">
            <!-- Top spacer for virtual scrolling -->
            <tr
              v-if="virtualScrollEnabled && visibleRange.offsetTop > 0"
              :style="{ height: `${visibleRange.offsetTop}px` }"
              aria-hidden="true"
            />

            <tr
              v-for="{ item, rowIndex } in visibleItems"
              :key="gridProps.getRowId(item)"
              :data-row-id="gridProps.getRowId(item)"
              :class="{
                'ogrid-row': true,
                'ogrid-selected-row': isRowSelected(gridProps.getRowId(item)),
              }"
              :style="{ cursor: gridProps.rowSelection === 'single' ? 'pointer' : undefined }"
              @click="(e) => handleSingleRowClick(e, gridProps.getRowId(item))"
            >
              <!-- Checkbox Cell -->
              <td
                v-if="layout.hasCheckboxCol"
                class="ogrid-cell ogrid-selection-cell"
                @click.stop
              >
                <input
                  type="checkbox"
                  :checked="isRowSelected(gridProps.getRowId(item))"
                  @change="(e) => handleRowCheckboxChange(gridProps.getRowId(item), (e.target as HTMLInputElement).checked, rowIndex)"
                  :aria-label="`Select row ${rowIndex + 1}`"
                  class="ogrid-checkbox"
                />
              </td>

              <!-- Row Number Cell -->
              <td
                v-if="layout.hasRowNumbersCol"
                class="ogrid-cell ogrid-row-number-cell"
              >
                {{ rowNumberOffset + rowIndex + 1 }}
              </td>

              <!-- Data Cells -->
              <td
                v-for="(col, colIndex) in layout.visibleCols"
                :key="col.columnId"
                :data-column-id="col.columnId"
                :data-row-index="rowIndex"
                :data-col-index="layout.colOffset + colIndex"
                :class="getCellClass(rowIndex, layout.colOffset + colIndex, col, item)"
                :style="getCellStyle(item, col, rowIndex, layout.colOffset + colIndex)"
                @mousedown="(e) => interaction.handleCellMouseDown(e, rowIndex, layout.colOffset + colIndex)"
                @contextmenu="(e) => ctxMenu.handleCellContextMenu(e)"
              >
                <div :style="getCellContentStyle(col, item, rowIndex, layout.colOffset + colIndex)">
                  <!-- Inline Editor -->
                  <div
                    v-if="getCellRenderData(item, col, rowIndex, layout.colOffset + colIndex).type === 'editor'"
                    class="ogrid-editing-cell"
                  >
                    <component
                      :is="InlineCellEditor"
                      v-bind="getCellRenderData(item, col, rowIndex, layout.colOffset + colIndex).props"
                    />
                  </div>
                  <!-- Popover Editor -->
                  <template v-else-if="getCellRenderData(item, col, rowIndex, layout.colOffset + colIndex).type === 'popover-editor'">
                    <div
                      :ref="(el) => { if (el) setPopoverAnchorEl(el as HTMLElement); }"
                      style="min-height: 100%; min-width: 40px"
                      aria-hidden="true"
                    ></div>
                    <component
                      v-if="editing.popoverAnchorEl"
                      :is="getCellRenderData(item, col, rowIndex, layout.colOffset + colIndex).col.cellEditor"
                      v-bind="getCellRenderData(item, col, rowIndex, layout.colOffset + colIndex).props"
                    />
                  </template>
                  <!-- Display Content -->
                  <template v-else>
                    {{ getCellDisplayValue(item, col, rowIndex, layout.colOffset + colIndex) }}

                    <!-- Fill Handle (on selection end cell) -->
                    <div
                      v-if="shouldShowFillHandle(item, col, rowIndex, layout.colOffset + colIndex)"
                      class="ogrid-fill-handle"
                      @mousedown="interaction.handleFillHandleMouseDown"
                      aria-label="Fill handle"
                    ></div>
                  </template>
                </div>
              </td>
            </tr>

            <!-- Bottom spacer for virtual scrolling -->
            <tr
              v-if="virtualScrollEnabled && visibleRange.offsetBottom > 0"
              :style="{ height: `${visibleRange.offsetBottom}px` }"
              aria-hidden="true"
            />
          </tbody>
        </table>

        <!-- Empty State -->
        <div v-if="viewModels.showEmptyInGrid && gridProps.emptyState" class="ogrid-empty-state">
          <component
            v-if="gridProps.emptyState.render"
            :is="{ render: gridProps.emptyState.render }"
          />
          <div v-else>
            <div class="ogrid-empty-title">No results found</div>
            <div class="ogrid-empty-message">
              <template v-if="gridProps.emptyState.message">
                {{ gridProps.emptyState.message }}
              </template>
              <template v-else-if="gridProps.emptyState.hasActiveFilters">
                No items match your current filters. Try adjusting your search or
                <button
                  class="ogrid-empty-clear-btn"
                  @click="gridProps.emptyState.onClearAll"
                >
                  clear all filters
                </button>
                to see all items.
              </template>
              <template v-else>
                No data available
              </template>
            </div>
          </div>
        </div>

        <!-- Marching Ants Overlay -->
        <MarchingAntsOverlay
          :containerRef="_refs.tableContainer"
          :selectionRange="interaction.selectionRange"
          :copyRange="interaction.copyRange"
          :cutRange="interaction.cutRange"
          :colOffset="layout.colOffset"
          :items="gridProps.items"
          :visibleColumns="gridProps.visibleColumns instanceof Set ? Array.from(gridProps.visibleColumns) : gridProps.visibleColumns"
          :columnSizingOverrides="layout.columnSizingOverrides"
          :columnOrder="gridProps.columnOrder"
        />
      </div>
    </div>

    <!-- Loading Overlay -->
    <div
      v-if="gridProps.isLoading"
      class="ogrid-loading-overlay"
    >
      <div class="ogrid-loading-content">
        <div class="loading-spinner"></div>
        <span>{{ gridProps.loadingMessage || 'Loading...' }}</span>
      </div>
    </div>

    <!-- Context Menu (Teleported to body) -->
    <Teleport to="body" v-if="ctxMenu.menuPosition">
      <GridContextMenu
        :x="ctxMenu.menuPosition.x"
        :y="ctxMenu.menuPosition.y"
        :hasSelection="!!interaction.selectionRange"
        :canUndo="interaction.canUndo"
        :canRedo="interaction.canRedo"
        :onUndo="interaction.onUndo || NOOP"
        :onRedo="interaction.onRedo || NOOP"
        :onCopy="interaction.handleCopy"
        :onCut="interaction.handleCut"
        :onPaste="() => interaction.handlePaste()"
        :onSelectAll="interaction.handleSelectAllCells"
        :onClose="ctxMenu.closeContextMenu"
      />
    </Teleport>

    <!-- Column Header Menu -->
    <ColumnHeaderMenu
      :isOpen="headerMenu.isOpen"
      :anchorElement="headerMenu.anchorElement"
      :onClose="headerMenu.close"
      :onPinLeft="headerMenu.handlePinLeft"
      :onPinRight="headerMenu.handlePinRight"
      :onUnpin="headerMenu.handleUnpin"
      :onSortAsc="headerMenu.handleSortAsc"
      :onSortDesc="headerMenu.handleSortDesc"
      :onClearSort="headerMenu.handleClearSort"
      :onAutosizeThis="headerMenu.handleAutosizeThis"
      :onAutosizeAll="headerMenu.handleAutosizeAll"
      :canPinLeft="headerMenu.canPinLeft"
      :canPinRight="headerMenu.canPinRight"
      :canUnpin="headerMenu.canUnpin"
      :currentSort="headerMenu.currentSort"
      :isSortable="headerMenu.isSortable"
      :isResizable="headerMenu.isResizable"
    />

    <!-- Status Bar -->
    <StatusBar
      v-if="viewModels.statusBarConfig"
      :totalCount="viewModels.statusBarConfig.totalCount"
      :filteredCount="viewModels.statusBarConfig.filteredCount"
      :selectedCount="viewModels.statusBarConfig.selectedCount ?? rowSel.selectedRowIds.size"
      :selectedCellCount="interaction.selectionRange
        ? (Math.abs(interaction.selectionRange.endRow - interaction.selectionRange.startRow) + 1) *
          (Math.abs(interaction.selectionRange.endCol - interaction.selectionRange.startCol) + 1)
        : undefined"
      :aggregation="viewModels.statusBarConfig.aggregation"
      :suppressRowCount="viewModels.statusBarConfig.suppressRowCount"
    />
  </div>
</template>

<style scoped lang="scss">
@import './DataGridTable.module.scss';

.ogrid-wrapper {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.ogrid-table-container {
  flex: 1;
  position: relative;
  outline: none;
  background-color: var(--ogrid-bg, #fff);
  will-change: scroll-position;
}

/* Drag-range highlight applied via DOM attributes during drag (bypasses Vue for performance) */
:deep([data-drag-range]) {
  background: var(--ogrid-range-bg, rgba(33, 115, 70, 0.12)) !important;
}

.ogrid-drop-indicator {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--ogrid-primary, #217346);
  pointer-events: none;
  z-index: 100;
}

.ogrid-table {
  border-collapse: collapse;
  font-size: 14px;
  background: var(--ogrid-bg, #fff);
}

.ogrid-header-row {
  z-index: 8;
  background: var(--ogrid-header-bg, #f5f5f5);
}

.ogrid-header-cell {
  position: sticky;
  top: 0;
  background: var(--ogrid-header-bg, #f5f5f5);
  border-bottom: 1px solid var(--ogrid-border, #e0e0e0);
  border-right: 1px solid var(--ogrid-border, #e0e0e0);
  padding: 8px 12px;
  z-index: 8;
  text-align: left;
  font-weight: 600;
  user-select: none;
  cursor: grab;

  &:last-child {
    border-right: none;
  }

  &:active {
    cursor: grabbing;
  }

  &:focus-visible {
    outline: 2px solid var(--ogrid-accent, #0078d4);
    outline-offset: -2px;
    z-index: 11;
  }
}

.ogrid-group-header {
  text-align: center;
  border-bottom: 2px solid var(--ogrid-border, #e0e0e0);
  cursor: default;

  &:active {
    cursor: default;
  }
}

.ogrid-header-content {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
}

.ogrid-header-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ogrid-header-menu-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 6px;
  font-size: 16px;
  color: var(--ogrid-fg-muted, rgba(0, 0, 0, 0.5));
  line-height: 1;
  flex-shrink: 0;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  transition: background-color 0.15s;

  &:hover {
    background: var(--ogrid-hover-bg, rgba(0, 0, 0, 0.04));
    color: var(--ogrid-fg, rgba(0, 0, 0, 0.8));
  }

  &:focus-visible {
    outline: 2px solid var(--ogrid-accent, #0078d4);
    outline-offset: 2px;
  }
}

.ogrid-resize-handle {
  position: absolute;
  right: -3px;
  top: 0;
  bottom: 0;
  width: 8px;
  cursor: col-resize;
  z-index: 10;
  user-select: none;
}

.ogrid-row {
  &:hover {
    background: var(--ogrid-hover-bg, #f9f9f9);
  }
}

.ogrid-selected-row {
  background: var(--ogrid-selected-bg, #e3f2fd);
}

.ogrid-cell {
  padding: 0;
  border-bottom: 1px solid var(--ogrid-border, #e0e0e0);
  border-right: 1px solid var(--ogrid-border, #e0e0e0);
  position: relative;
  height: 1px;

  &:last-child {
    border-right: none;
  }

  &:focus-visible {
    outline: 2px solid var(--ogrid-accent, #0078d4);
    outline-offset: -2px;
    z-index: 3;
  }
}

.ogrid-active-cell {
  outline: 2px solid var(--ogrid-active-border, #0078d4);
  outline-offset: -2px;
  z-index: 1;
}

.ogrid-selected-cell {
  background: var(--ogrid-bg-range, rgba(33, 115, 70, 0.12));
}

.ogrid-editing-cell {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  outline: 2px solid var(--ogrid-selection-color, #217346);
  outline-offset: -1px;
  z-index: 2;
  position: relative;
  background: var(--ogrid-bg, #fff);
  overflow: visible;
  padding: 0;
}

.ogrid-fill-handle {
  position: absolute;
  right: -3px;
  bottom: -3px;
  width: 7px;
  height: 7px;
  background-color: var(--ogrid-selection, #217346);
  border: 1px solid var(--ogrid-bg, #fff);
  border-radius: 1px;
  cursor: crosshair;
  pointer-events: auto;
  z-index: 3;
}

.ogrid-selection-header,
.ogrid-selection-cell {
  width: 40px;
  text-align: center;
  padding: 8px;
}

.ogrid-row-number-header,
.ogrid-row-number-cell {
  width: 40px;
  text-align: center;
  padding: 6px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--ogrid-muted, #888);
  background: var(--ogrid-header-bg, #f5f5f5);
}

.ogrid-checkbox {
  cursor: pointer;
  width: 16px;
  height: 16px;
}

.ogrid-empty-state {
  padding: 32px 16px;
  text-align: center;
  border-top: 1px solid var(--ogrid-border, #e0e0e0);
  background: var(--ogrid-statusbar-bg, #f5f5f5);
}

.ogrid-empty-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 8px;
}

.ogrid-empty-message {
  font-size: 0.875rem;
  color: var(--ogrid-muted, #888);
}

.ogrid-empty-clear-btn {
  background: none;
  border: none;
  color: var(--ogrid-primary, #0066cc);
  text-decoration: underline;
  cursor: pointer;
  padding: 0;
  font: inherit;

  &:hover {
    color: var(--ogrid-primary-hover, #005a9e);
  }
}

.ogrid-loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.7);
}

.ogrid-loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
  background-color: var(--ogrid-bg, #fff);
  border: 1px solid var(--ogrid-border, #e0e0e0);
  border-radius: 4px;
  font-size: 0.875rem;
  color: var(--ogrid-muted, #888);
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--ogrid-border, #e0e0e0);
  border-top-color: var(--ogrid-primary, #0066cc);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
