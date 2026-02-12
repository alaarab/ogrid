<script setup lang="ts">
import { ref, computed, h, Teleport } from 'vue';
import {
  useDataGridState,
  useColumnResize,
  useColumnReorder,
  useVirtualScroll,
  getHeaderFilterConfig,
  getCellRenderDescriptor,
  resolveCellDisplayContent,
  resolveCellStyle,
  getCellInteractionProps,
  buildHeaderRows,
  flattenColumns,
  CHECKBOX_COLUMN_WIDTH,
  DEFAULT_MIN_COLUMN_WIDTH,
  type IOGridDataGridProps,
  type IColumnDef,
  type ICellEditorProps,
} from '@alaarab/ogrid-vue';
import ColumnHeaderFilter from '../ColumnHeaderFilter/ColumnHeaderFilter.vue';
import InlineCellEditor from './InlineCellEditor.vue';
import StatusBar from './StatusBar.vue';
import GridContextMenu from './GridContextMenu.vue';
import MarchingAntsOverlay from './MarchingAntsOverlay.vue';

const props = defineProps<{
  gridProps: IOGridDataGridProps<any>;
}>();

const wrapperRef = ref<HTMLDivElement | null>(null);
const tableContainerRef = ref<HTMLDivElement | null>(null);
const tableRef = ref<HTMLTableElement | null>(null);
const lastMouseShift = ref(false);
const propsRef = computed(() => props.gridProps);

const state = useDataGridState({ props: propsRef, wrapperRef });

// Column reorder
const columnOrderRef = computed(() => {
  const p = props.gridProps;
  if (p.columnOrder) return p.columnOrder;
  return flattenColumns(p.columns).filter(c => p.visibleColumns?.has(c.columnId) ?? true).map(c => c.columnId);
});
const onColumnOrderChangeRef = computed(() => props.gridProps.onColumnOrderChange);
const { isDragging: isReorderDragging, dropIndicatorX, handleHeaderMouseDown: handleReorderMouseDown } = useColumnReorder({
  columnOrder: columnOrderRef,
  onColumnOrderChange: onColumnOrderChangeRef,
  tableRef,
});

// Virtual scrolling
const virtualScrollEnabled = computed(() => props.gridProps.virtualScroll?.enabled ?? false);
const totalRowsRef = computed(() => props.gridProps.items.length);
const rowHeight = props.gridProps.virtualScroll?.rowHeight ?? 36;
const overscan = props.gridProps.virtualScroll?.overscan ?? 5;
const { containerRef: vsContainerRef, visibleRange, totalHeight, scrollToRow } = useVirtualScroll({
  totalRows: totalRowsRef,
  rowHeight,
  enabled: virtualScrollEnabled,
  overscan,
});

// Computed state refs
const layout = computed(() => state.layout.value);
const rowSel = computed(() => state.rowSelection.value);
const editing = computed(() => state.editing.value);
const interaction = computed(() => state.interaction.value);
const ctxMenu = computed(() => state.contextMenu.value);
const viewModels = computed(() => state.viewModels.value);

const headerRows = computed(() => buildHeaderRows(props.gridProps.columns, props.gridProps.visibleColumns));

const { handleResizeStart, getColumnWidth } = useColumnResize({
  columnSizingOverrides: computed(() => layout.value.columnSizingOverrides),
  setColumnSizingOverrides: layout.value.setColumnSizingOverrides,
});

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

// Helper methods for template
const getCellRenderData = (item: any, col: IColumnDef<any>, rowIndex: number, colIndex: number) => {
  const descriptor = getCellRenderDescriptor(item, col, rowIndex, colIndex, viewModels.value.cellDescriptorInput);

  if (descriptor.renderMode === 'inline-editor' && descriptor.editorProps) {
    return { type: 'editor', props: descriptor.editorProps };
  }

  return { type: 'content', descriptor };
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

const getCellStyle = (rowIndex: number, colIndex: number, col: IColumnDef<any>) => {
  const descriptor = getCellRenderDescriptor(col, {}, rowIndex, colIndex, viewModels.value.cellDescriptorInput);
  const style: Record<string, string> = {
    width: `${getColumnWidth(col.columnId)}px`,
  };

  if (descriptor.canEditAny) {
    style.cursor = 'cell';
  }

  if (descriptor.isInCutRange) {
    style.backgroundColor = 'rgba(0,0,0,0.04)';
    style.opacity = '0.7';
  }

  return style;
};

const shouldShowFillHandle = (rowIndex: number, colIndex: number) => {
  const range = interaction.value.selectionRange;
  if (!range) return false;

  const descriptor = getCellRenderDescriptor({}, {}, rowIndex, colIndex, viewModels.value.cellDescriptorInput);
  return descriptor.canEditAny && rowIndex === range.endRow && colIndex === range.endCol;
};
</script>

<template>
  <div ref="wrapperRef" class="ogrid-wrapper">
    <!-- Loading State -->
    <div v-if="gridProps.isLoading" class="ogrid-loading">
      <div class="loading-spinner"></div>
      <div>{{ gridProps.loadingMessage || 'Loading...' }}</div>
    </div>

    <!-- Main Grid -->
    <div
      v-else
      ref="tableContainerRef"
      class="ogrid-table-container"
      tabindex="0"
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

      <table
        ref="tableRef"
        class="ogrid-table"
        :style="{
          width: gridProps.layoutMode === 'content' ? 'auto' : '100%',
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
                type="checkbox"
                :checked="rowSel.allSelected"
                @change="rowSel.handleSelectAll"
                aria-label="Select all rows"
                class="ogrid-checkbox"
              />
            </th>

            <!-- Header Cells -->
            <th
              v-for="cell in row"
              :key="cell.column?.columnId || `group-${rowIdx}`"
              :colspan="cell.colspan"
              :rowspan="cell.rowspan"
              class="ogrid-header-cell"
              :style="{
                width: cell.column ? `${getColumnWidth(cell.column.columnId)}px` : undefined,
              }"
              @mousedown="cell.column && !cell.isGroup ? (e) => handleReorderMouseDown(cell.column.columnId, e) : undefined"
            >
              <div class="ogrid-header-content">
                <span class="ogrid-header-label">
                  {{ cell.column?.name || cell.groupName }}
                </span>

                <ColumnHeaderFilter
                  v-if="cell.column && !cell.isGroup"
                  :columnKey="cell.column.columnId"
                  :columnName="cell.column.name"
                  :filterType="cell.column.filterable?.type || 'none'"
                  :isSorted="cell.column.isSorted"
                  :isSortedDescending="cell.column.isSortedDescending"
                  :onSort="cell.column.onSort"
                />
              </div>

              <!-- Resize Handle -->
              <div
                v-if="cell.column && cell.column.resizable !== false"
                class="ogrid-resize-handle"
                @mousedown="(e) => handleResizeStart(e, cell.column!.columnId)"
              ></div>
            </th>
          </tr>
        </thead>

        <!-- Body -->
        <tbody v-if="!viewModels.showEmptyInGrid">
          <tr
            v-for="(item, rowIndex) in gridProps.items"
            :key="gridProps.getRowId(item)"
            :data-row-id="gridProps.getRowId(item)"
            :class="{
              'ogrid-row': true,
              'ogrid-selected-row': isRowSelected(gridProps.getRowId(item)),
            }"
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

            <!-- Data Cells -->
            <td
              v-for="(col, colIndex) in layout.visibleCols"
              :key="col.columnId"
              :data-row-index="rowIndex"
              :data-col-index="layout.colOffset + colIndex"
              :class="getCellClass(rowIndex, layout.colOffset + colIndex, col, item)"
              :style="getCellStyle(rowIndex, layout.colOffset + colIndex, col)"
              @mousedown="(e) => interaction.handleCellMouseDown(e, rowIndex, layout.colOffset + colIndex)"
              @contextmenu="(e) => ctxMenu.handleCellContextMenu(e, rowIndex, layout.colOffset + colIndex)"
            >
              <div class="ogrid-cell-content">
                <component
                  v-if="getCellRenderData(item, col, rowIndex, layout.colOffset + colIndex).type === 'editor'"
                  :is="InlineCellEditor"
                  v-bind="getCellRenderData(item, col, rowIndex, layout.colOffset + colIndex).props"
                />
                <template v-else>
                  {{ getCellDisplayValue(item, col, rowIndex, layout.colOffset + colIndex) }}

                  <!-- Fill Handle (on selection end cell) -->
                  <div
                    v-if="shouldShowFillHandle(rowIndex, layout.colOffset + colIndex)"
                    class="ogrid-fill-handle"
                    @mousedown="interaction.handleFillHandleMouseDown"
                    aria-label="Fill handle"
                  ></div>
                </template>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Empty State -->
      <div v-if="viewModels.showEmptyInGrid && gridProps.emptyState" class="ogrid-empty-state">
        <div v-if="gridProps.emptyState.render">
          <!-- Custom render function -->
        </div>
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
        :containerRef="tableContainerRef"
        :selectionRange="interaction.selectionRange"
        :copyRange="interaction.copyRange"
        :cutRange="interaction.cutRange"
        :colOffset="layout.colOffset"
      />
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

.ogrid-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
  gap: 16px;
  color: var(--ogrid-muted, #888);
  font-size: 14px;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--ogrid-border, #e0e0e0);
  border-top-color: var(--ogrid-primary, #0066cc);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.ogrid-table-container {
  flex: 1;
  overflow: auto;
  position: relative;
  outline: none;
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
  position: sticky;
  top: 0;
  z-index: 2;
}

.ogrid-header-cell {
  position: relative;
  background: var(--ogrid-header-bg, #f5f5f5);
  border-bottom: 1px solid var(--ogrid-border, #e0e0e0);
  border-right: 1px solid var(--ogrid-border, #e0e0e0);
  padding: 8px 12px;
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
}

.ogrid-header-content {
  display: flex;
  align-items: center;
  gap: 4px;
}

.ogrid-header-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ogrid-resize-handle {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  cursor: col-resize;
  z-index: 10;

  &:hover {
    background: var(--ogrid-primary, #0066cc);
  }
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

  &:last-child {
    border-right: none;
  }
}

.ogrid-cell-content {
  padding: 8px 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  position: relative;
}

.ogrid-active-cell {
  outline: 2px solid var(--ogrid-active-border, #0078d4);
  outline-offset: -2px;
  z-index: 1;
}

.ogrid-selected-cell {
  background: var(--ogrid-bg-range, rgba(33, 115, 70, 0.12));
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
</style>
