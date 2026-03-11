<template>
  <v-app>
    <v-main>
      <div style="padding: 24px; max-width: 1200px; margin: 0 auto; height: 100vh; display: flex; flex-direction: column;">
        <h1>OGrid - Vue Vuetify Example</h1>
        <p style="color: var(--ogrid-fg-secondary, #666); margin-bottom: 16px;">
          {{ subtitle }}
        </p>
        <div style="flex: 1; min-height: 0;">
          <OGrid :grid-props="gridProps" />
        </div>
      </div>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { OGrid } from '@alaarab/ogrid-vue-vuetify';
import type { IOGridProps } from '@alaarab/ogrid-vue-vuetify';
import { DatePickerEditor, RatingEditor, ColorPickerEditor, SliderEditor, TagsEditor } from '@alaarab/ogrid-vue-inputs';
import { connectGridToBridge } from '@alaarab/ogrid-mcp/bridge-client';
import type { BridgeConnection } from '@alaarab/ogrid-mcp/bridge-client';
import { createProjectExampleScenario } from '../shared/demoScenario';
import { getExampleFeatureFlags } from '../shared/queryFlags';
import { makePremiumInputColumns, makePremiumInputRows } from '../shared/premiumInputsData';

type ExampleRow = { id: string; [key: string]: unknown };

const featureFlags = getExampleFeatureFlags(typeof window !== 'undefined' ? window.location.search : '');
const projectScenario = createProjectExampleScenario(featureFlags);
const isPremiumExample = featureFlags.premiumInputs;
const initialRows = isPremiumExample
  ? makePremiumInputRows()
  : projectScenario.data;
const columns = isPremiumExample
  ? makePremiumInputColumns({
    dateEditor: DatePickerEditor,
    ratingEditor: RatingEditor,
    colorEditor: ColorPickerEditor,
    sliderEditor: SliderEditor,
    tagsEditor: TagsEditor,
  })
  : projectScenario.columns;

const subtitle = isPremiumExample
  ? 'Premium editor parity mode powered by @alaarab/ogrid-vue-inputs.'
  : 'A fully featured data table powered by @alaarab/ogrid-vue-vuetify. Includes sorting, multi-select text filtering, column chooser, and pagination.';

const rows = ref<ExampleRow[]>(initialRows as ExampleRow[]);

const updateRowCell = (rowId: string, columnId: string, newValue: unknown) => {
  rows.value = rows.value.map((row) =>
    row.id === rowId ? { ...row, [columnId]: newValue } : row,
  );
};

const gridProps = computed<IOGridProps<ExampleRow>>(() => ({
  ...(!isPremiumExample && projectScenario.serverSide ? { dataSource: projectScenario.dataSource! } : { data: rows.value }),
  columns: columns as IOGridProps<ExampleRow>['columns'],
  getRowId: (row) => row.id,
  entityLabelPlural: isPremiumExample ? 'products' : 'projects',
  defaultPageSize: isPremiumExample ? 10 : 25,
  editable: isPremiumExample || !projectScenario.serverSide,
  cellSelection: true,
  cellReferences: isPremiumExample ? undefined : featureFlags.cellReferences,
  rowSelection: isPremiumExample ? undefined : projectScenario.rowSelection,
  formulas: isPremiumExample ? undefined : projectScenario.formulas,
  initialFormulas: isPremiumExample ? undefined : projectScenario.initialFormulas,
  statusBar: true,
  onCellValueChanged: (event) => updateRowCell(event.item.id, event.columnId, event.newValue),
}));

let bridge: BridgeConnection | null = null;

onMounted(() => {
  bridge = connectGridToBridge({
    gridId: 'vue-vuetify-demo',
    getData: () => rows.value,
    getColumns: () => columns.map((column) => ({
      columnId: column.columnId,
      headerName: column.name ?? column.columnId,
      type: column.type,
    })),
    getSort: () => [],
    getFilters: () => ({}),
    onCellUpdate: (rowIndex, columnId, value) => {
      const row = rows.value[rowIndex];
      if (!row) return;
      updateRowCell(row.id, columnId, value);
    },
  });
});

onUnmounted(() => {
  bridge?.disconnect();
});
</script>
