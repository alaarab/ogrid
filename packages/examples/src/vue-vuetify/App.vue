<template>
  <v-app>
    <v-main>
      <div style="padding: 24px; max-width: 1200px; margin: 0 auto; height: 100vh; display: flex; flex-direction: column;">
        <h1>OGrid - Vue Vuetify Example</h1>
        <p style="color: #666; margin-bottom: 16px;">
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
import { OGrid } from '@alaarab/ogrid-vue-vuetify';
import type { IOGridProps } from '@alaarab/ogrid-vue-vuetify';
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
