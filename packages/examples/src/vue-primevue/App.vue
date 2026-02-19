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
import { OGrid } from '@alaarab/ogrid-vue-primevue';
import type { IOGridProps } from '@alaarab/ogrid-vue-primevue';
import { makeDemoProjects, makeDemoColumns, getRowId } from '../shared/demoData';
import type { Project } from '../shared/demoData';

const gridProps: IOGridProps<Project> = {
  data: makeDemoProjects(75),
  columns: makeDemoColumns<Project>(),
  getRowId,
  entityLabelPlural: 'projects',
  defaultPageSize: 25,
  editable: true,
  cellSelection: true,
  statusBar: true,
};
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
