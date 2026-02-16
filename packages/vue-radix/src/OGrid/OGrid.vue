<script setup lang="ts">
import { computed, type PropType } from 'vue';
import {
  useOGrid,
  type IOGridProps,
  type IOGridDataGridProps,
  type SideBarProps,
  type SideBarPanelId,
  type FilterValue,
  type IFilters,
} from '@alaarab/ogrid-vue';
import DataGridTable from '../DataGridTable/DataGridTable.vue';
import ColumnChooser from '../ColumnChooser/ColumnChooser.vue';
import PaginationControls from '../PaginationControls/PaginationControls.vue';

const PANEL_WIDTH = 240;
const TAB_WIDTH = 36;

const PANEL_LABELS: Record<SideBarPanelId, string> = {
  columns: 'Columns',
  filters: 'Filters',
};

const PANEL_ICONS: Record<SideBarPanelId, string> = {
  columns: '\u2261',
  filters: '\u2A65',
};

const props = defineProps({
  gridProps: {
    type: Object as PropType<IOGridProps<unknown>>,
    required: true,
  },
});

const propsRef = computed(() => props.gridProps);
const { dataGridProps, pagination, columnChooser, layout, api } = useOGrid(propsRef);

const hasSideBar = computed(() => layout.value.sideBarProps != null);
const sideBar = computed(() => layout.value.sideBarProps);
const sideBarPosition = computed(() => sideBar.value?.position ?? 'right');
const hasToolbar = computed(() => !!layout.value.toolbar || columnChooser.value.placement === 'toolbar');

const allColumnsVisible = computed(() => {
  const sb = sideBar.value;
  if (!sb) return false;
  return sb.columns.every((c) => sb.visibleColumns.has(c.columnId));
});

function selectAllColumns() {
  const sb = sideBar.value;
  if (!sb) return;
  const next = new Set(sb.visibleColumns);
  sb.columns.forEach((c) => next.add(c.columnId));
  sb.onSetVisibleColumns(next);
}

function clearAllColumns() {
  const sb = sideBar.value;
  if (!sb) return;
  const next = new Set<string>();
  sb.columns.forEach((c) => {
    if (c.required && sb.visibleColumns.has(c.columnId)) next.add(c.columnId);
  });
  sb.onSetVisibleColumns(next);
}

function getFilterTextValue(sb: SideBarProps, filterKey: string): string {
  const f = sb.filters[filterKey];
  return f?.type === 'text' ? f.value : '';
}

function getFilterDateValue(sb: SideBarProps, filterKey: string): { from?: string; to?: string } {
  const f = sb.filters[filterKey];
  return f?.type === 'date' ? f.value : { from: undefined, to: undefined };
}

function getFilterMultiSelectValue(sb: SideBarProps, filterKey: string): string[] {
  const f = sb.filters[filterKey];
  return f?.type === 'multiSelect' ? f.value : [];
}

function handlePageSizeChange(size: number) {
  pagination.value.setPageSize(size);
  pagination.value.setPage(1);
}

defineExpose({ api });
</script>

<template>
  <div
    :class="layout.className"
    :style="{
      display: 'flex',
      flexDirection: 'column',
      border: '1px solid rgba(0,0,0,0.12)',
      borderRadius: '4px',
      overflow: 'hidden',
    }"
  >
    <!-- Toolbar strip -->
    <div
      v-if="hasToolbar"
      :style="{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        borderBottom: '1px solid rgba(0,0,0,0.12)',
        gap: '8px',
      }"
    >
      <div :style="{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1' }">
        <component :is="layout.toolbar" v-if="layout.toolbar" />
      </div>
      <ColumnChooser
        v-if="columnChooser.placement === 'toolbar'"
        :columns="columnChooser.columns"
        :visible-columns="columnChooser.visibleColumns"
        :on-visibility-change="columnChooser.onVisibilityChange"
      />
    </div>

    <!-- Toolbar below -->
    <div
      v-if="layout.toolbarBelow"
      :style="{ padding: '8px 12px', borderBottom: '1px solid rgba(0,0,0,0.12)' }"
    >
      <component :is="layout.toolbarBelow" />
    </div>

    <!-- Main content area (sidebar + grid) -->
    <div :style="{ display: 'flex', flex: '1', minHeight: '0' }">
      <!-- Left sidebar -->
      <template v-if="hasSideBar && sideBarPosition === 'left'">
        <!-- Tab strip -->
        <div
          :style="{
            display: 'flex',
            flexDirection: 'column',
            width: TAB_WIDTH + 'px',
            background: 'var(--ogrid-header-bg, #f5f5f5)',
            borderRight: '1px solid var(--ogrid-border, #e0e0e0)',
          }"
          role="tablist"
          aria-label="Side bar tabs"
        >
          <button
            v-for="panel in sideBar!.panels"
            :key="panel"
            role="tab"
            :aria-selected="sideBar!.activePanel === panel"
            :aria-label="PANEL_LABELS[panel]"
            :title="PANEL_LABELS[panel]"
            @click="sideBar!.onPanelChange(sideBar!.activePanel === panel ? null : panel)"
            :style="{
              width: TAB_WIDTH + 'px',
              height: TAB_WIDTH + 'px',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--ogrid-fg, #242424)',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: sideBar!.activePanel === panel ? 'var(--ogrid-bg, #fff)' : 'transparent',
              fontWeight: sideBar!.activePanel === panel ? 'bold' : 'normal',
            }"
          >
            {{ PANEL_ICONS[panel] }}
          </button>
        </div>
        <!-- Panel content -->
        <div
          v-if="sideBar!.activePanel"
          :style="{
            width: PANEL_WIDTH + 'px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: 'var(--ogrid-bg, #fff)',
            color: 'var(--ogrid-fg, #242424)',
            borderRight: '1px solid var(--ogrid-border, #e0e0e0)',
          }"
          role="tabpanel"
          :aria-label="PANEL_LABELS[sideBar!.activePanel]"
        >
          <div :style="{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--ogrid-border, #e0e0e0)', fontWeight: '600' }">
            <span>{{ PANEL_LABELS[sideBar!.activePanel] }}</span>
            <button @click="sideBar!.onPanelChange(null)" :style="{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '16px', color: 'var(--ogrid-fg, #242424)' }" aria-label="Close panel">&times;</button>
          </div>
          <div :style="{ flex: '1', overflowY: 'auto', padding: '8px 12px' }">
            <!-- Columns panel -->
            <template v-if="sideBar!.activePanel === 'columns'">
              <div :style="{ display: 'flex', gap: '8px', marginBottom: '8px' }">
                <button :disabled="allColumnsVisible" @click="selectAllColumns" :style="{ flex: '1', cursor: 'pointer', background: 'var(--ogrid-bg-subtle, #f3f2f1)', color: 'var(--ogrid-fg, #242424)', border: '1px solid var(--ogrid-border, #e0e0e0)', borderRadius: '4px', padding: '4px 8px' }">Select All</button>
                <button @click="clearAllColumns" :style="{ flex: '1', cursor: 'pointer', background: 'var(--ogrid-bg-subtle, #f3f2f1)', color: 'var(--ogrid-fg, #242424)', border: '1px solid var(--ogrid-border, #e0e0e0)', borderRadius: '4px', padding: '4px 8px' }">Clear All</button>
              </div>
              <label v-for="col in sideBar!.columns" :key="col.columnId" :style="{ display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 0', cursor: 'pointer' }">
                <input type="checkbox" :checked="sideBar!.visibleColumns.has(col.columnId)" :disabled="col.required" @change="(e: Event) => sideBar!.onVisibilityChange(col.columnId, (e.target as HTMLInputElement).checked)" />
                <span>{{ col.name }}</span>
              </label>
            </template>
            <!-- Filters panel -->
            <template v-if="sideBar!.activePanel === 'filters'">
              <div v-if="sideBar!.filterableColumns.length === 0" :style="{ color: 'var(--ogrid-muted, #999)', fontStyle: 'italic' }">No filterable columns</div>
              <div v-for="col in sideBar!.filterableColumns" :key="col.columnId" :style="{ marginBottom: '12px' }">
                <div :style="{ fontWeight: '500', marginBottom: '4px', fontSize: '13px' }">{{ col.name }}</div>
                <!-- Text filter -->
                <input
                  v-if="col.filterType === 'text'"
                  type="text"
                  :value="getFilterTextValue(sideBar!, col.filterField)"
                  @input="(e: Event) => { const val = (e.target as HTMLInputElement).value; sideBar!.onFilterChange(col.filterField, val ? { type: 'text', value: val } : undefined); }"
                  :placeholder="'Filter ' + col.name + '...'"
                  :aria-label="'Filter ' + col.name"
                  :style="{ width: '100%', boxSizing: 'border-box', padding: '4px 6px', background: 'var(--ogrid-bg, #fff)', color: 'var(--ogrid-fg, #242424)', border: '1px solid var(--ogrid-border, #e0e0e0)', borderRadius: '4px' }"
                />
                <!-- MultiSelect filter -->
                <div v-if="col.filterType === 'multiSelect'" :style="{ maxHeight: '120px', overflowY: 'auto' }" role="group" :aria-label="col.name + ' options'">
                  <label v-for="opt in (sideBar!.filterOptions[col.filterField] ?? [])" :key="opt" :style="{ display: 'flex', alignItems: 'center', gap: '4px', padding: '1px 0', cursor: 'pointer', fontSize: '13px' }">
                    <input
                      type="checkbox"
                      :checked="getFilterMultiSelectValue(sideBar!, col.filterField).includes(opt)"
                      @change="(e: Event) => {
                        const current = getFilterMultiSelectValue(sideBar!, col.filterField);
                        const next = (e.target as HTMLInputElement).checked ? [...current, opt] : current.filter((v: string) => v !== opt);
                        sideBar!.onFilterChange(col.filterField, next.length > 0 ? { type: 'multiSelect', value: next } : undefined);
                      }"
                    />
                    <span>{{ opt }}</span>
                  </label>
                </div>
                <!-- Date filter -->
                <div v-if="col.filterType === 'date'" :style="{ display: 'flex', flexDirection: 'column', gap: '4px' }">
                  <label :style="{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }">
                    From:
                    <input
                      type="date"
                      :value="getFilterDateValue(sideBar!, col.filterField).from ?? ''"
                      @input="(e: Event) => {
                        const from = (e.target as HTMLInputElement).value || undefined;
                        const to = getFilterDateValue(sideBar!, col.filterField).to;
                        sideBar!.onFilterChange(col.filterField, from || to ? { type: 'date', value: { from, to } } : undefined);
                      }"
                      :aria-label="col.name + ' from date'"
                      :style="{ flex: '1', padding: '2px 4px', background: 'var(--ogrid-bg, #fff)', color: 'var(--ogrid-fg, #242424)', border: '1px solid var(--ogrid-border, #e0e0e0)', borderRadius: '4px' }"
                    />
                  </label>
                  <label :style="{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }">
                    To:
                    <input
                      type="date"
                      :value="getFilterDateValue(sideBar!, col.filterField).to ?? ''"
                      @input="(e: Event) => {
                        const to = (e.target as HTMLInputElement).value || undefined;
                        const from = getFilterDateValue(sideBar!, col.filterField).from;
                        sideBar!.onFilterChange(col.filterField, from || to ? { type: 'date', value: { from, to } } : undefined);
                      }"
                      :aria-label="col.name + ' to date'"
                      :style="{ flex: '1', padding: '2px 4px', background: 'var(--ogrid-bg, #fff)', color: 'var(--ogrid-fg, #242424)', border: '1px solid var(--ogrid-border, #e0e0e0)', borderRadius: '4px' }"
                    />
                  </label>
                </div>
              </div>
            </template>
          </div>
        </div>
      </template>

      <!-- Grid content -->
      <div :style="{ flex: '1', minWidth: '0', minHeight: '0', display: 'flex', flexDirection: 'column' }">
        <DataGridTable :grid-props="(dataGridProps as any)" />
      </div>

      <!-- Right sidebar -->
      <template v-if="hasSideBar && sideBarPosition !== 'left'">
        <!-- Panel content -->
        <div
          v-if="sideBar!.activePanel"
          :style="{
            width: PANEL_WIDTH + 'px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: 'var(--ogrid-bg, #fff)',
            color: 'var(--ogrid-fg, #242424)',
            borderLeft: '1px solid var(--ogrid-border, #e0e0e0)',
          }"
          role="tabpanel"
          :aria-label="PANEL_LABELS[sideBar!.activePanel]"
        >
          <div :style="{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--ogrid-border, #e0e0e0)', fontWeight: '600' }">
            <span>{{ PANEL_LABELS[sideBar!.activePanel] }}</span>
            <button @click="sideBar!.onPanelChange(null)" :style="{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '16px', color: 'var(--ogrid-fg, #242424)' }" aria-label="Close panel">&times;</button>
          </div>
          <div :style="{ flex: '1', overflowY: 'auto', padding: '8px 12px' }">
            <template v-if="sideBar!.activePanel === 'columns'">
              <div :style="{ display: 'flex', gap: '8px', marginBottom: '8px' }">
                <button :disabled="allColumnsVisible" @click="selectAllColumns" :style="{ flex: '1', cursor: 'pointer', background: 'var(--ogrid-bg-subtle, #f3f2f1)', color: 'var(--ogrid-fg, #242424)', border: '1px solid var(--ogrid-border, #e0e0e0)', borderRadius: '4px', padding: '4px 8px' }">Select All</button>
                <button @click="clearAllColumns" :style="{ flex: '1', cursor: 'pointer', background: 'var(--ogrid-bg-subtle, #f3f2f1)', color: 'var(--ogrid-fg, #242424)', border: '1px solid var(--ogrid-border, #e0e0e0)', borderRadius: '4px', padding: '4px 8px' }">Clear All</button>
              </div>
              <label v-for="col in sideBar!.columns" :key="col.columnId" :style="{ display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 0', cursor: 'pointer' }">
                <input type="checkbox" :checked="sideBar!.visibleColumns.has(col.columnId)" :disabled="col.required" @change="(e: Event) => sideBar!.onVisibilityChange(col.columnId, (e.target as HTMLInputElement).checked)" />
                <span>{{ col.name }}</span>
              </label>
            </template>
            <template v-if="sideBar!.activePanel === 'filters'">
              <div v-if="sideBar!.filterableColumns.length === 0" :style="{ color: 'var(--ogrid-muted, #999)', fontStyle: 'italic' }">No filterable columns</div>
              <div v-for="col in sideBar!.filterableColumns" :key="col.columnId" :style="{ marginBottom: '12px' }">
                <div :style="{ fontWeight: '500', marginBottom: '4px', fontSize: '13px' }">{{ col.name }}</div>
                <input
                  v-if="col.filterType === 'text'"
                  type="text"
                  :value="getFilterTextValue(sideBar!, col.filterField)"
                  @input="(e: Event) => { const val = (e.target as HTMLInputElement).value; sideBar!.onFilterChange(col.filterField, val ? { type: 'text', value: val } : undefined); }"
                  :placeholder="'Filter ' + col.name + '...'"
                  :aria-label="'Filter ' + col.name"
                  :style="{ width: '100%', boxSizing: 'border-box', padding: '4px 6px', background: 'var(--ogrid-bg, #fff)', color: 'var(--ogrid-fg, #242424)', border: '1px solid var(--ogrid-border, #e0e0e0)', borderRadius: '4px' }"
                />
                <div v-if="col.filterType === 'multiSelect'" :style="{ maxHeight: '120px', overflowY: 'auto' }" role="group" :aria-label="col.name + ' options'">
                  <label v-for="opt in (sideBar!.filterOptions[col.filterField] ?? [])" :key="opt" :style="{ display: 'flex', alignItems: 'center', gap: '4px', padding: '1px 0', cursor: 'pointer', fontSize: '13px' }">
                    <input
                      type="checkbox"
                      :checked="getFilterMultiSelectValue(sideBar!, col.filterField).includes(opt)"
                      @change="(e: Event) => {
                        const current = getFilterMultiSelectValue(sideBar!, col.filterField);
                        const next = (e.target as HTMLInputElement).checked ? [...current, opt] : current.filter((v: string) => v !== opt);
                        sideBar!.onFilterChange(col.filterField, next.length > 0 ? { type: 'multiSelect', value: next } : undefined);
                      }"
                    />
                    <span>{{ opt }}</span>
                  </label>
                </div>
                <div v-if="col.filterType === 'date'" :style="{ display: 'flex', flexDirection: 'column', gap: '4px' }">
                  <label :style="{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }">
                    From:
                    <input type="date" :value="getFilterDateValue(sideBar!, col.filterField).from ?? ''" @input="(e: Event) => { const from = (e.target as HTMLInputElement).value || undefined; const to = getFilterDateValue(sideBar!, col.filterField).to; sideBar!.onFilterChange(col.filterField, from || to ? { type: 'date', value: { from, to } } : undefined); }" :aria-label="col.name + ' from date'" :style="{ flex: '1', padding: '2px 4px', background: 'var(--ogrid-bg, #fff)', color: 'var(--ogrid-fg, #242424)', border: '1px solid var(--ogrid-border, #e0e0e0)', borderRadius: '4px' }" />
                  </label>
                  <label :style="{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }">
                    To:
                    <input type="date" :value="getFilterDateValue(sideBar!, col.filterField).to ?? ''" @input="(e: Event) => { const to = (e.target as HTMLInputElement).value || undefined; const from = getFilterDateValue(sideBar!, col.filterField).from; sideBar!.onFilterChange(col.filterField, from || to ? { type: 'date', value: { from, to } } : undefined); }" :aria-label="col.name + ' to date'" :style="{ flex: '1', padding: '2px 4px', background: 'var(--ogrid-bg, #fff)', color: 'var(--ogrid-fg, #242424)', border: '1px solid var(--ogrid-border, #e0e0e0)', borderRadius: '4px' }" />
                  </label>
                </div>
              </div>
            </template>
          </div>
        </div>
        <!-- Tab strip -->
        <div
          :style="{
            display: 'flex',
            flexDirection: 'column',
            width: TAB_WIDTH + 'px',
            background: 'var(--ogrid-header-bg, #f5f5f5)',
            borderLeft: '1px solid var(--ogrid-border, #e0e0e0)',
          }"
          role="tablist"
          aria-label="Side bar tabs"
        >
          <button
            v-for="panel in sideBar!.panels"
            :key="panel"
            role="tab"
            :aria-selected="sideBar!.activePanel === panel"
            :aria-label="PANEL_LABELS[panel]"
            :title="PANEL_LABELS[panel]"
            @click="sideBar!.onPanelChange(sideBar!.activePanel === panel ? null : panel)"
            :style="{
              width: TAB_WIDTH + 'px',
              height: TAB_WIDTH + 'px',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--ogrid-fg, #242424)',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: sideBar!.activePanel === panel ? 'var(--ogrid-bg, #fff)' : 'transparent',
              fontWeight: sideBar!.activePanel === panel ? 'bold' : 'normal',
            }"
          >
            {{ PANEL_ICONS[panel] }}
          </button>
        </div>
      </template>
    </div>

    <!-- Footer strip (pagination) -->
    <div :style="{ display: 'flex', alignItems: 'center', padding: '8px 0', borderTop: '1px solid rgba(0,0,0,0.12)' }">
      <PaginationControls
        :current-page="pagination.page"
        :page-size="pagination.pageSize"
        :total-count="pagination.displayTotalCount"
        :on-page-change="pagination.setPage"
        :on-page-size-change="handlePageSizeChange"
        :page-size-options="pagination.pageSizeOptions"
        :entity-label-plural="pagination.entityLabelPlural"
      />
    </div>
  </div>
</template>
