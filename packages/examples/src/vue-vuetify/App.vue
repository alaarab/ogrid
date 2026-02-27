<template>
  <v-app>
    <v-main>
      <div style="padding: 24px; max-width: 1200px; margin: 0 auto; height: 100vh; display: flex; flex-direction: column;">
        <h1>OGrid - Vue Vuetify Example</h1>
        <p style="color: var(--ogrid-fg-secondary, #666); margin-bottom: 16px;">
          A fully featured data table powered by <code>@alaarab/ogrid-vue-vuetify</code>.
          Includes sorting, multi-select &amp; text filtering, column chooser, and pagination.
        </p>
        <div style="flex: 1; min-height: 0;">
          <OGrid :grid-props="gridProps" />
        </div>
      </div>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { OGrid } from '@alaarab/ogrid-vue-vuetify';
import type { IOGridProps } from '@alaarab/ogrid-vue-vuetify';
import { connectGridToBridge } from '@alaarab/ogrid-mcp/bridge-client';
import type { BridgeConnection } from '@alaarab/ogrid-mcp/bridge-client';
import { makeDemoProjects, makeDemoColumns, getRowId, handleCellValueChanged } from '../shared/demoData';
import type { Project } from '../shared/demoData';

const projects = makeDemoProjects(75);
const gridProps: IOGridProps<Project> = {
  data: projects,
  columns: makeDemoColumns<Project>(),
  getRowId,
  entityLabelPlural: 'projects',
  defaultPageSize: 25,
  editable: true,
  cellSelection: true,
  statusBar: true,
  onCellValueChanged: (e) => handleCellValueChanged(projects, e),
};

let bridge: BridgeConnection | null = null;

onMounted(() => {
  bridge = connectGridToBridge({
    gridId: 'vue-vuetify-demo',
    getData: () => projects,
    getColumns: () => gridProps.columns.map((c) => ({
      columnId: c.columnId,
      headerName: c.name ?? c.columnId,
      type: c.type,
    })),
    getSort: () => [],
    getFilters: () => ({}),
    onCellUpdate: (rowIndex, columnId, value) => {
      if (projects[rowIndex]) {
        (projects[rowIndex] as Record<string, unknown>)[columnId] = value;
      }
    },
  });
});

onUnmounted(() => {
  bridge?.disconnect();
});
</script>
