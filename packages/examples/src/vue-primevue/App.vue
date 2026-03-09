<template>
  <div class="app-container">
    <h1>OGrid - Vue PrimeVue Example</h1>
    <p class="app-subtitle">
      A fully featured data table powered by <code>@alaarab/ogrid-vue-primevue</code>.
      Includes sorting, multi-select &amp; text filtering, column chooser, and pagination.
    </p>
    <div style="flex: 1; min-height: 0;">
      <OGrid :grid-props="gridProps" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { OGrid } from '@alaarab/ogrid-vue-primevue';
import type { IOGridProps } from '@alaarab/ogrid-vue-primevue';
import { connectGridToBridge } from '@alaarab/ogrid-mcp/bridge-client';
import type { BridgeConnection } from '@alaarab/ogrid-mcp/bridge-client';
import { makeDemoProjects, makeDemoColumns, getRowId } from '../shared/demoData';
import type { Project } from '../shared/demoData';

const projects = ref(makeDemoProjects(75));
const columns = makeDemoColumns<Project>();

const updateProjectCell = (rowId: string, columnId: string, newValue: unknown) => {
  projects.value = projects.value.map((row) =>
    row.id === rowId ? { ...row, [columnId]: newValue } : row
  );
};

const gridProps = computed<IOGridProps<Project>>(() => ({
  data: projects.value,
  columns,
  getRowId,
  entityLabelPlural: 'projects',
  defaultPageSize: 25,
  editable: true,
  cellSelection: true,
  statusBar: true,
  onCellValueChanged: (e) => updateProjectCell(e.item.id, e.columnId, e.newValue),
}));

let bridge: BridgeConnection | null = null;

onMounted(() => {
  bridge = connectGridToBridge({
    gridId: 'vue-primevue-demo',
    getData: () => projects.value,
    getColumns: () => columns.map((c) => ({
      columnId: c.columnId,
      headerName: c.name ?? c.columnId,
      type: c.type,
    })),
    getSort: () => [],
    getFilters: () => ({}),
    onCellUpdate: (rowIndex, columnId, value) => {
      const row = projects.value[rowIndex];
      if (!row) return;
      updateProjectCell(row.id, columnId, value);
    },
  });
});

onUnmounted(() => {
  bridge?.disconnect();
});
</script>

<style>
.app-container {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--ogrid-bg, #fff);
  color: var(--ogrid-fg, rgba(0,0,0,0.87));
}
.app-subtitle {
  color: var(--ogrid-fg-secondary, #666);
  margin-bottom: 16px;
}
html, body {
  background: var(--ogrid-bg, #fff);
  color: var(--ogrid-fg, rgba(0,0,0,0.87));
  transition: background 0.2s, color 0.2s;
}
</style>
