# @alaarab/ogrid-vue-radix

OGrid data grid for Vue 3, built with Headless UI Vue.

## Install

```bash
npm install @alaarab/ogrid-vue-radix
```

## Usage

```vue
<script setup lang="ts">
import { OGrid } from '@alaarab/ogrid-vue-radix';

const columns = [
  { columnId: 'name', name: 'Name', sortable: true, editable: true },
  { columnId: 'department', name: 'Department', filterable: { type: 'multiSelect' } },
];
</script>

<template>
  <OGrid :columns="columns" :data="rows" :getRowId="(r) => r.id" />
</template>
```

## Headless API — `useHeadlessGrid`

Render OGrid's sort/filter/paginate/select state with your own table chrome.
Same logic that powers `<OGrid>` exposed as a Vue composable returning refs
and computeds. Inputs accept refs, getters, or plain values.

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { useHeadlessGrid } from '@alaarab/ogrid-vue-radix';

const grid = useHeadlessGrid({
  columns,
  data: ref(employees),
  getRowId: (e) => e.id,
  initialSort: { field: 'salary', direction: 'desc' },
  initialPageSize: 25,
});
</script>

<template>
  <table>
    <thead>
      <tr>
        <th
          v-for="col in grid.columns.value"
          :key="col.columnId"
          @click="grid.toggleSort(col.columnId)"
        >
          {{ col.name }} {{ grid.sortIndicator(col.columnId).value }}
        </th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in grid.rows.value" :key="grid.getRowId(row)">
        <td v-for="col in grid.columns.value" :key="col.columnId">
          {{ grid.getCellValue(row, col.columnId) }}
        </td>
      </tr>
    </tbody>
  </table>
</template>
```

The composable returns refs (`sort`, `filters`, `page`, `pageSize`,
`selectedRowIds`), computeds (`columns`, `rows`, `totalCount`,
`totalPages`, `allFilteredRows`, `hasActiveFilters`), and plain action
functions. See the React `useHeadlessGrid` docs for the full API
reference — the shape is identical, just Vue-flavored.

See the [OGrid docs](https://alaarab.github.io/ogrid/) for full documentation.
