<p align="center">
  <img src="packages/docs/static/img/favicon.svg" width="64" height="64" alt="OGrid" />
</p>

<h1 align="center">OGrid</h1>

<p align="center">
  <strong>The lightweight, multi-framework data grid with enterprise features and zero enterprise cost.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@alaarab/ogrid-react-radix"><img src="https://img.shields.io/npm/v/@alaarab/ogrid-react-radix?color=%23217346&label=npm" alt="npm version" /></a>
  <a href="https://github.com/alaarab/ogrid/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License" /></a>
  <img src="https://img.shields.io/badge/tests-2028%20passing-brightgreen" alt="2028 tests passing" />
  <img src="https://img.shields.io/badge/React-17%20%7C%2018%20%7C%2019-blue" alt="React 17, 18, 19" />
  <img src="https://img.shields.io/badge/Angular-21-red" alt="Angular 21" />
  <img src="https://img.shields.io/badge/Vue-3.3+-green" alt="Vue 3.3+" />
  <img src="https://img.shields.io/badge/TypeScript-strict-blue" alt="TypeScript strict" />
</p>

<p align="center">
  <a href="https://alaarab.github.io/ogrid/">Docs</a> &middot;
  <a href="https://alaarab.github.io/ogrid/docs/getting-started/overview">Getting Started</a> &middot;
  <a href="https://alaarab.github.io/ogrid/docs/api/ogrid-props">API Reference</a> &middot;
  <a href="https://alaarab.github.io/ogrid/docs/guides/migration-from-ag-grid">Migrate from AG Grid</a>
</p>

---

Pick the framework and UI library you already use — **React** (Fluent UI, Material UI, Radix UI), **Angular** (Angular Material, PrimeNG), **Vue** (Vuetify, PrimeVue), or **vanilla JS** — and get sorting, filtering, pagination, cell editing, spreadsheet selection, and more out of the box.

## Why OGrid?

| | OGrid | AG Grid Community | AG Grid Enterprise |
|---|---|---|---|
| Spreadsheet selection | Built-in | - | $999/dev/year |
| Clipboard (copy/paste) | Built-in | - | $999/dev/year |
| Fill handle | Built-in | - | $999/dev/year |
| Undo/redo | Built-in | - | $999/dev/year |
| Context menu | Built-in | - | $999/dev/year |
| Status bar | Built-in | - | $999/dev/year |
| Cell editing | Built-in | Built-in | Built-in |
| Sorting & filtering | Built-in | Built-in | Built-in |
| **License** | **MIT (free)** | MIT | Commercial |
| **Cost** | **$0** | $0 | **$999/dev/year** |

OGrid gives you every feature AG Grid locks behind an enterprise license — for free, forever.

## Packages

| Package | npm | Description |
|---------|-----|-------------|
| [`@alaarab/ogrid-core`](./packages/core) | [![npm](https://img.shields.io/npm/v/@alaarab/ogrid-core)](https://www.npmjs.com/package/@alaarab/ogrid-core) | Pure TS types, algorithms, utilities (zero deps) |
| [`@alaarab/ogrid-react`](./packages/react) | [![npm](https://img.shields.io/npm/v/@alaarab/ogrid-react)](https://www.npmjs.com/package/@alaarab/ogrid-react) | React hooks, headless components, shared test factories |
| [`@alaarab/ogrid-react-radix`](./packages/react-radix) | [![npm](https://img.shields.io/npm/v/@alaarab/ogrid-react-radix)](https://www.npmjs.com/package/@alaarab/ogrid-react-radix) | **Default** — Radix UI (lightweight, no Fluent/Material needed) |
| [`@alaarab/ogrid-react-fluent`](./packages/react-fluent) | [![npm](https://img.shields.io/npm/v/@alaarab/ogrid-react-fluent)](https://www.npmjs.com/package/@alaarab/ogrid-react-fluent) | Fluent UI v9 implementation |
| [`@alaarab/ogrid-react-material`](./packages/react-material) | [![npm](https://img.shields.io/npm/v/@alaarab/ogrid-react-material)](https://www.npmjs.com/package/@alaarab/ogrid-react-material) | Material UI v7 implementation |
| **Angular** | | |
| [`@alaarab/ogrid-angular`](./packages/angular) | [![npm](https://img.shields.io/npm/v/@alaarab/ogrid-angular)](https://www.npmjs.com/package/@alaarab/ogrid-angular) | Angular v21 services with signals |
| [`@alaarab/ogrid-angular-material`](./packages/angular-material) | [![npm](https://img.shields.io/npm/v/@alaarab/ogrid-angular-material)](https://www.npmjs.com/package/@alaarab/ogrid-angular-material) | Angular Material v21 implementation |
| [`@alaarab/ogrid-angular-primeng`](./packages/angular-primeng) | [![npm](https://img.shields.io/npm/v/@alaarab/ogrid-angular-primeng)](https://www.npmjs.com/package/@alaarab/ogrid-angular-primeng) | PrimeNG v21 implementation |
| **Vue** | | |
| [`@alaarab/ogrid-vue`](./packages/vue) | [![npm](https://img.shields.io/npm/v/@alaarab/ogrid-vue)](https://www.npmjs.com/package/@alaarab/ogrid-vue) | Vue 3 composables with Composition API |
| [`@alaarab/ogrid-vue-vuetify`](./packages/vue-vuetify) | [![npm](https://img.shields.io/npm/v/@alaarab/ogrid-vue-vuetify)](https://www.npmjs.com/package/@alaarab/ogrid-vue-vuetify) | Vuetify 3 implementation |
| [`@alaarab/ogrid-vue-primevue`](./packages/vue-primevue) | [![npm](https://img.shields.io/npm/v/@alaarab/ogrid-vue-primevue)](https://www.npmjs.com/package/@alaarab/ogrid-vue-primevue) | PrimeVue 4 implementation |
| **Other** | | |
| [`@alaarab/ogrid-js`](./packages/js) | [![npm](https://img.shields.io/npm/v/@alaarab/ogrid-js)](https://www.npmjs.com/package/@alaarab/ogrid-js) | Vanilla JS data grid (no framework) |

UI packages re-export everything from their adapter package (which re-exports from `@alaarab/ogrid-core`) — one import is all you need.

## Quick Start

```bash
npm install @alaarab/ogrid-react-radix
```

```tsx
import { OGrid, type IColumnDef } from '@alaarab/ogrid-react-radix';

const columns: IColumnDef<Employee>[] = [
  { columnId: 'name', name: 'Name', sortable: true, filterable: { type: 'text' } },
  { columnId: 'department', name: 'Department', filterable: { type: 'multiSelect' } },
  { columnId: 'salary', name: 'Salary', editable: true, type: 'numeric',
    valueFormatter: (v) => `$${Number(v).toLocaleString()}` },
];

function App() {
  return (
    <OGrid
      columns={columns}
      data={employees}
      getRowId={(e) => e.id}
      editable
      cellSelection
      statusBar
    />
  );
}
```

Using Fluent UI? Change the import to `@alaarab/ogrid-react-fluent`. Material UI? `@alaarab/ogrid-react-material`. Same API.

### Angular

```bash
npm install @alaarab/ogrid-angular-material @angular/material @angular/cdk
```

```typescript
import { Component } from '@angular/core';
import { OGridComponent, type IColumnDef } from '@alaarab/ogrid-angular-material';

@Component({
  standalone: true,
  imports: [OGridComponent],
  template: `<ogrid [gridProps]="gridProps" />`
})
export class AppComponent {
  gridProps = {
    columns: [
      { columnId: 'name', name: 'Name', sortable: true, filterable: { type: 'text' } },
      { columnId: 'department', name: 'Department', filterable: { type: 'multiSelect' } },
      { columnId: 'salary', name: 'Salary', editable: true, type: 'numeric' },
    ] as IColumnDef[],
    data: employees,
    getRowId: (e: any) => e.id,
    editable: true,
    statusBar: true,
  };
}
```

Using PrimeNG? Change the import to `@alaarab/ogrid-angular-primeng`. Same API.

### Vue

```bash
npm install @alaarab/ogrid-vue-vuetify vuetify
```

```vue
<script setup lang="ts">
import { OGrid, type IColumnDef } from '@alaarab/ogrid-vue-vuetify';

const columns: IColumnDef[] = [
  { columnId: 'name', name: 'Name', sortable: true, filterable: { type: 'text' } },
  { columnId: 'department', name: 'Department', filterable: { type: 'multiSelect' } },
  { columnId: 'salary', name: 'Salary', editable: true, type: 'numeric' },
];

const gridProps = { columns, data: employees, getRowId: (e: any) => e.id, editable: true, statusBar: true };
</script>

<template>
  <OGrid :gridProps="gridProps" />
</template>
```

Using PrimeVue? Change the import to `@alaarab/ogrid-vue-primevue`. Same API.

### Vanilla JS

```bash
npm install @alaarab/ogrid-js
```

```ts
import { OGrid } from '@alaarab/ogrid-js';

const grid = new OGrid(document.getElementById('grid')!, {
  columns: [
    { columnId: 'name', name: 'Name', sortable: true, filterable: { type: 'text' } },
    { columnId: 'department', name: 'Department', filterable: { type: 'multiSelect' } },
    { columnId: 'salary', name: 'Salary', editable: true, type: 'numeric' },
  ],
  data: employees,
  getRowId: (e) => e.id,
  editable: true,
  cellSelection: true,
});

// Later: update data, destroy
grid.getApi().setRowData(newData);
grid.destroy();
```

## Features

- **Sorting** — Click headers to sort; configurable defaults; custom comparators
- **Column Types** — Built-in `text`, `numeric`, `date`, `boolean` types with auto-formatting, alignment, editors, and filters
- **Filtering** — Text search, multi-select checkboxes, date range picker, people picker; client or server-side
- **Pagination** — Configurable page sizes; client-side or server-side via `IDataSource`
- **Cell Editing** — Inline text, select, checkbox, rich select, and custom popup editors
- **Spreadsheet Selection** — Click-and-drag range selection with active cell highlight
- **Clipboard** — Ctrl+C/X/V with multi-cell copy/paste; respects `valueFormatter`/`valueParser`
- **Row Selection** — Single or multiple with Shift+click range support
- **Undo / Redo** — Edit history with Ctrl+Z / Ctrl+Y
- **Fill Handle** — Drag to fill cells (Excel-style)
- **Column Groups** — Multi-row grouped headers with arbitrary nesting
- **Column Pinning** — Sticky left/right columns
- **Toolbar & Layout** — Unified bordered container with primary toolbar (left/right slots), secondary `toolbarBelow` row (e.g. filter chips), column chooser placement (`toolbar` / `sidebar` / hidden), and cohesive footer
- **Side Bar** — Toggle-able side panel with Columns (show/hide, Select All/Clear All) and Filters (inline filter controls per column) panels
- **Column Chooser** — Show/hide columns via toolbar dropdown or sidebar panel
- **Column Resize** — Drag column borders to resize
- **Context Menu** — Right-click: copy, paste, cut, export, undo/redo with shortcuts
- **Status Bar** — Row count, filtered count, selection aggregations (sum, avg, min, max)
- **Grid API** — `ref`-based imperative API: `setRowData`, `getColumnState`, `selectAll`, etc.
- **CSV Export** — One-click export with formatted values
- **Server-Side Data** — `IDataSource` pattern for remote pagination, sorting, filtering
- **Column State Persistence** — Save/restore visibility, sort, order, widths, filters
- **Empty State** — Custom message or render function
- **Keyboard Navigation** — Arrow keys, Tab, Enter, F2, Home/End, Ctrl+Home/End, Ctrl+Arrow (Excel-style data region jump)
- **React 17, 18 & 19** — Compatible with all three
- **Angular 21** — Signals-based services, standalone components, zone-less
- **Vue 3.3+** — Composition API composables with ref/computed reactivity
- **TypeScript Strict** — Fully generic `<T>` with strict mode
- **Lightweight** — No bloat, no heavy runtime

## Cell Editing

```tsx
<OGrid
  columns={[
    { columnId: 'name', name: 'Name', editable: true },
    { columnId: 'status', name: 'Status', editable: true,
      cellEditor: 'select', cellEditorParams: { values: ['Active', 'Inactive'] } },
    { columnId: 'verified', name: 'Verified', editable: true, cellEditor: 'checkbox' },
  ]}
  data={data}
  getRowId={(r) => r.id}
  editable
  onCellValueChanged={(e) => console.log(e.columnId, e.oldValue, '→', e.newValue)}
/>
```

## Grid API

```tsx
const gridRef = useRef<IOGridApi<Product>>(null);

<OGrid ref={gridRef} data={products} columns={columns} getRowId={(r) => r.id} />

// Programmatic control
gridRef.current?.setRowData(newData);
gridRef.current?.setFilterModel({ status: ['Active'] });
gridRef.current?.selectAll();

// Save/restore column state (localStorage, database, etc.)
const state = gridRef.current?.getColumnState();
gridRef.current?.applyColumnState(savedState);
```

## Server-Side Data

```tsx
import type { IDataSource } from '@alaarab/ogrid-core';

const dataSource: IDataSource<Product> = {
  async fetchPage({ page, pageSize, sort, filters }) {
    const res = await fetch(`/api/products?page=${page}&pageSize=${pageSize}`);
    return res.json(); // { items: Product[], totalCount: number }
  },
  async fetchFilterOptions(field) {
    const res = await fetch(`/api/products/distinct/${field}`);
    return res.json(); // string[]
  },
};

<OGrid dataSource={dataSource} columns={columns} getRowId={(r) => r.id} />
```

## Architecture

```
ogrid/
├── packages/
│   ├── core/               # @alaarab/ogrid-core             – pure TS types, algorithms, utilities
│   ├── react/              # @alaarab/ogrid-react             – React hooks, headless components
│   ├── react-radix/        # @alaarab/ogrid-react-radix       – Radix UI components (default)
│   ├── react-fluent/       # @alaarab/ogrid-react-fluent      – Fluent UI components
│   ├── react-material/     # @alaarab/ogrid-react-material    – Material UI components
│   ├── angular/            # @alaarab/ogrid-angular           – Angular services with signals
│   ├── angular-material/   # @alaarab/ogrid-angular-material  – Angular Material components
│   ├── angular-primeng/    # @alaarab/ogrid-angular-primeng   – PrimeNG components
│   ├── vue/                # @alaarab/ogrid-vue               – Vue 3 composables
│   ├── vue-vuetify/        # @alaarab/ogrid-vue-vuetify       – Vuetify components
│   ├── vue-primevue/       # @alaarab/ogrid-vue-primevue      – PrimeVue components
│   ├── js/                 # @alaarab/ogrid-js                – Vanilla JS data grid
│   ├── docs/               # Documentation site
│   └── examples/           # Example apps per framework
└── package.json            # npm workspaces root
```

**Core** owns types and pure TS utilities. **Framework adapters** (React hooks, Angular services, Vue composables) own state logic. **UI packages** are thin view layers. All UI packages within a framework pass the same test suite.

## Development

```bash
npm install                     # Install all dependencies
npm run build                   # Build all packages (Turborepo)
npm run test:all                # Run all tests
npm run lint                    # ESLint

# Storybook (per-framework)
npm run storybook:fluent        # port 6006
npm run storybook:material      # port 6007
npm run storybook:radix         # port 6008

# Docs site
npm run docs:dev                # Docusaurus dev server
```

## Peer Dependencies

| Package | Peer Dependencies |
|---------|-------------------|
| `@alaarab/ogrid-react-radix` (Radix) | `react`, `react-dom` |
| `@alaarab/ogrid-react-fluent` | `react`, `react-dom`, `@fluentui/react-components ^9`, `@fluentui/react-icons ^2` |
| `@alaarab/ogrid-react-material` | `react`, `react-dom`, `@mui/material ^7`, `@mui/icons-material ^7`, `@emotion/react ^11`, `@emotion/styled ^11` |
| `@alaarab/ogrid-angular-material` | `@angular/core ^21`, `@angular/common ^21`, `@angular/material ^21`, `@angular/cdk ^21` |
| `@alaarab/ogrid-angular-primeng` | `@angular/core ^21`, `@angular/common ^21`, `primeng ^21` |
| `@alaarab/ogrid-vue-vuetify` | `vue ^3.3`, `vuetify ^3` |
| `@alaarab/ogrid-vue-primevue` | `vue ^3.3`, `primevue ^4` |
| `@alaarab/ogrid-react` | `react ^17 \|\| ^18 \|\| ^19` |
| `@alaarab/ogrid-angular` | `@angular/core ^21`, `@angular/common ^21` |
| `@alaarab/ogrid-vue` | `vue ^3.3` |
| `@alaarab/ogrid-js` | None |
| `@alaarab/ogrid-core` | None |

## License

MIT — Free forever. No enterprise tiers. No feature paywalls.
