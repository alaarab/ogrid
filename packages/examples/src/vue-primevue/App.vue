<template>
  <div style="padding: 24px; max-width: 1200px; margin: 0 auto;">
    <h1>OGrid - Vue PrimeVue Example</h1>
    <p style="color: #666; margin-bottom: 16px;">
      A fully featured data table powered by <code>@alaarab/ogrid-vue-primevue</code>.
      Includes sorting, multi-select &amp; text filtering, column chooser, and pagination.
    </p>
    <OGrid :grid-props="gridProps" />
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
};
</script>
