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

See the [OGrid docs](https://alaarab.github.io/ogrid/) for full documentation.
