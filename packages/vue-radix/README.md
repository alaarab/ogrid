# @alaarab/ogrid-vue-radix

Lightweight Vue 3 data grid with minimal dependencies. Built with Headless UI Vue for a clean, accessible interface.

## Installation

```bash
npm install @alaarab/ogrid-vue-radix
```

## Quick Start

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { OGrid } from '@alaarab/ogrid-vue-radix';

const columns = ref([
  { columnId: 'id', name: 'ID', type: 'numeric' },
  { columnId: 'name', name: 'Name', type: 'text', editable: true },
  { columnId: 'email', name: 'Email', type: 'text', editable: true },
  { columnId: 'age', name: 'Age', type: 'numeric', editable: true }
]);

const data = ref([
  { id: 1, name: 'Alice', email: 'alice@example.com', age: 28 },
  { id: 2, name: 'Bob', email: 'bob@example.com', age: 32 },
  { id: 3, name: 'Charlie', email: 'charlie@example.com', age: 25 }
]);
</script>

<template>
  <OGrid
    :columns="columns"
    :data="data"
    :getRowId="(row) => row.id"
    :editable="true"
    :cellSelection="true"
  />
</template>
```

## Why OGrid Vue Radix?

**Lightweight alternative** to Vuetify and PrimeVue data grids:
- 📦 Minimal bundle size (~80KB gzipped)
- 🎨 Built with Headless UI Vue - no large component library required
- 🚀 Same powerful features as OGrid Vue Vuetify/PrimeVue
- 💅 Clean, modern design with CSS variables for easy customization

## Features

- ✅ Sorting, filtering, and pagination
- ✅ Cell editing (inline text, select, checkbox, date)
- ✅ Cell and row selection
- ✅ Column resizing and reordering
- ✅ Column pinning (sticky left/right)
- ✅ Virtual scrolling for large datasets
- ✅ CSV export
- ✅ Keyboard navigation
- ✅ Context menu (copy, cut, paste)
- ✅ Undo/redo
- ✅ Server-side data sources
- ✅ Column groups (multi-level headers)
- ✅ Sidebar panels (columns, filters)
- ✅ TypeScript support

## Documentation

Full documentation: **[ogrid.dev](https://ogrid.dev)**
- [Getting Started](https://ogrid.dev/docs/quick-start)
- [API Reference](https://ogrid.dev/docs/api/props)
- [Examples](https://ogrid.dev/docs/examples)

## Customization

Customize appearance with CSS variables:

```css
:root {
  --ogrid-border: #e0e0e0;
  --ogrid-bg: #ffffff;
  --ogrid-header-bg: #f5f5f5;
  --ogrid-primary: #0066cc;
  --ogrid-active-cell-border: #0066cc;
  --ogrid-selected-cell-bg: #e3f2fd;
}
```

## Architecture

OGrid Vue Radix is part of the OGrid framework family:
- **@alaarab/ogrid-core** - Pure TypeScript types and utilities
- **@alaarab/ogrid-vue** - Vue 3 composables and headless components
- **@alaarab/ogrid-vue-radix** - Headless UI implementation (this package)
- **@alaarab/ogrid-vue-vuetify** - Vuetify 3 implementation
- **@alaarab/ogrid-vue-primevue** - PrimeVue 4 implementation

All Vue packages share the same headless core and expose identical APIs.

## License

MIT © Ala Arab
