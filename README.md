<p align="center">
  <img src="packages/docs/static/img/favicon.svg" width="80" height="80" alt="OGrid" />
</p>

<h1 align="center">OGrid</h1>

<p align="center">
  <strong>The lightweight, multi-framework data grid with enterprise features and zero enterprise cost.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@alaarab/ogrid-core"><img src="https://img.shields.io/npm/v/@alaarab/ogrid-core?color=%23217346&label=npm" alt="npm version" /></a>
  <a href="https://github.com/alaarab/ogrid/actions/workflows/ci.yml"><img src="https://github.com/alaarab/ogrid/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI" /></a>
  <a href="https://github.com/alaarab/ogrid/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License" /></a>
  <img src="https://img.shields.io/badge/tests-2%2C980%20passing-brightgreen" alt="2,980 tests passing" />
  <img src="https://img.shields.io/badge/gzip-12.2%20KB%20core-blue" alt="12.2 KB gzipped core" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-17%20%7C%2018%20%7C%2019-61DAFB?logo=react&logoColor=white" alt="React 17, 18, 19" />
  <img src="https://img.shields.io/badge/Angular-21-DD0031?logo=angular&logoColor=white" alt="Angular 21" />
  <img src="https://img.shields.io/badge/Vue-3.3+-4FC08D?logo=vuedotjs&logoColor=white" alt="Vue 3.3+" />
  <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" alt="TypeScript strict" />
</p>

<p align="center">
  <a href="https://alaarab.github.io/ogrid/">Documentation</a> &middot;
  <a href="https://alaarab.github.io/ogrid/docs/getting-started/overview">Getting Started</a> &middot;
  <a href="https://alaarab.github.io/ogrid/docs/api/ogrid-props">API Reference</a> &middot;
  <a href="https://alaarab.github.io/ogrid/docs/guides/migration-from-ag-grid">Migrate from AG Grid</a> &middot;
  <a href="https://discord.gg/KMajyx9j4m">Discord Community</a>
</p>

---

Pick the framework and UI library you already use -- **React** (Radix UI, Fluent UI, Material UI), **Angular** (Angular Material, PrimeNG, Radix UI), **Vue** (Vuetify, PrimeVue, Radix UI), or **vanilla JS** -- and get sorting, filtering, pagination, cell editing, spreadsheet selection, and more out of the box.

## Why OGrid?

| | OGrid | AG Grid Community | AG Grid Enterprise |
|---|---|---|---|
| Spreadsheet selection | Built-in | -- | $999/dev/year |
| Clipboard (copy/paste) | Built-in | -- | $999/dev/year |
| Fill handle (drag to fill) | Built-in | -- | $999/dev/year |
| Undo / Redo | Built-in | -- | $999/dev/year |
| Context menu | Built-in | -- | $999/dev/year |
| Status bar | Built-in | -- | $999/dev/year |
| Side bar | Built-in | -- | $999/dev/year |
| Cell editing | Built-in | Built-in | Built-in |
| Sorting & filtering | Built-in | Built-in | Built-in |
| **Bundle size (gzip)** | **12.2 KB** core | ~339 KB | ~339 KB+ |
| **License** | **MIT (free)** | MIT | Commercial |
| **Cost** | **$0** | $0 | **$999/dev/year** |

OGrid gives you every feature AG Grid locks behind an enterprise license -- for free, forever.

## Features

- **Sorting** -- Click headers to sort; multi-column sort; custom comparators
- **Column Types** -- Built-in `text`, `numeric`, `date`, `boolean` with auto-formatting, alignment, editors, and filters
- **Filtering** -- Text search, multi-select checkboxes, date range, people picker; client or server-side
- **Pagination** -- Configurable page sizes; client-side or server-side via `IDataSource`
- **Cell Editing** -- Inline text, select, checkbox, rich select, and custom popup editors
- **Spreadsheet Selection** -- Click-and-drag range selection with active cell highlight
- **Clipboard** -- Ctrl+C / X / V with multi-cell copy/paste; respects `valueFormatter` / `valueParser`
- **Fill Handle** -- Drag to fill cells (Excel-style)
- **Undo / Redo** -- Full edit history with Ctrl+Z / Ctrl+Y; batch operation support
- **Row Selection** -- Single or multiple with Shift+click range support
- **Cell References** -- Excel-style column letters (A, B, C…), row numbers, and name box showing active cell (e.g. "A1")
- **Column Groups** -- Multi-row grouped headers with arbitrary nesting
- **Column Pinning** -- Sticky left/right columns
- **Column Resize** -- Drag column borders to resize
- **Column Chooser** -- Show/hide columns via toolbar dropdown or sidebar panel
- **Toolbar & Layout** -- Unified bordered container with primary toolbar, secondary `toolbarBelow` row, and footer
- **Side Bar** -- Toggle-able panel with Columns (show/hide) and Filters (inline controls) panels
- **Context Menu** -- Right-click: copy, paste, cut, export, undo/redo with keyboard shortcuts
- **Status Bar** -- Row count, filtered count, selection aggregations (sum, avg, min, max)
- **Keyboard Navigation** -- Arrow keys, Tab, Enter, F2, Home/End, Ctrl+Home/End, Ctrl+Arrow (Excel-style data region jump)
- **CSV Export** -- One-click export with formatted values
- **Grid API** -- `ref`-based imperative API: `setRowData`, `getColumnState`, `selectAll`, etc.
- **Server-Side Data** -- `IDataSource` pattern for remote pagination, sorting, filtering
- **Column State Persistence** -- Save/restore visibility, sort, order, widths, filters
- **Empty State** -- Custom message or render function
- **Virtual Scrolling** -- Row and column virtualization for large datasets
- **Web Worker Sort/Filter** -- Offload sort and filter to a background thread (`workerSort: true`)
- **CSS Containment** -- Automatic `contain: content` on cells; `content-visibility: auto` on off-screen rows
- **TypeScript Strict** -- Fully generic `<T>` with strict mode; zero `any` leaks

## Framework Support

OGrid provides **10 UI packages** across 4 frameworks, all sharing a single headless core:

| Framework | UI Library | Package | Peer Dependencies |
|-----------|-----------|---------|-------------------|
| **React** | Radix UI (default) | `@alaarab/ogrid-react-radix` | `react`, `react-dom` |
| | Fluent UI v9 | `@alaarab/ogrid-react-fluent` | + `@fluentui/react-components`, `@fluentui/react-icons` |
| | Material UI v7 | `@alaarab/ogrid-react-material` | + `@mui/material`, `@mui/icons-material`, `@emotion/*` |
| **Angular** | Angular Material v21 | `@alaarab/ogrid-angular-material` | `@angular/material`, `@angular/cdk` |
| | PrimeNG v21 | `@alaarab/ogrid-angular-primeng` | `primeng` |
| | Radix UI | `@alaarab/ogrid-angular-radix` | -- |
| **Vue** | Vuetify 3 | `@alaarab/ogrid-vue-vuetify` | `vuetify` |
| | PrimeVue 4 | `@alaarab/ogrid-vue-primevue` | `primevue` |
| | Radix UI | `@alaarab/ogrid-vue-radix` | -- |
| **Vanilla JS** | None needed | `@alaarab/ogrid-js` | None |

All UI packages within a framework expose the **same API** -- switch UI libraries by changing one import.

## Quick Start

### React

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

> Using Fluent UI? Change the import to `@alaarab/ogrid-react-fluent`. Material UI? `@alaarab/ogrid-react-material`. Same API.

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

> Using PrimeNG? Change the import to `@alaarab/ogrid-angular-primeng`. Radix UI? `@alaarab/ogrid-angular-radix`. Same API.

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

const gridProps = {
  columns,
  data: employees,
  getRowId: (e: any) => e.id,
  editable: true,
  statusBar: true,
};
</script>

<template>
  <OGrid :gridProps="gridProps" />
</template>
```

> Using PrimeVue? Change the import to `@alaarab/ogrid-vue-primevue`. Radix UI? `@alaarab/ogrid-vue-radix`. Same API.

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

// Programmatic control
grid.getApi().setRowData(newData);
grid.destroy();
```

## Bundle Size

| Package | Gzipped | Notes |
|---------|---------|-------|
| `@alaarab/ogrid-core` | **12.2 KB** | Pure TS, zero dependencies |
| `@alaarab/ogrid-react` (+ virtual scroll) | **40.0 KB** | Includes `@tanstack/react-virtual` |
| `@alaarab/ogrid-react-material` | **12.9 KB** | Thin UI layer |
| `@alaarab/ogrid-js` | **33.8 KB** | Full standalone grid |
| AG Grid Community (comparison) | **~339 KB** | -- |

Core + a UI package gives you a full-featured data grid at a fraction of the size of alternatives.

## Cell Editing

OGrid supports multiple editor types out of the box:

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
  onCellValueChanged={(e) => console.log(e.columnId, e.oldValue, '->', e.newValue)}
/>
```

Built-in editors: `text` (default), `select`, `checkbox`, `date`, `richSelect`, and custom popup editors via `cellEditor` component.

## Grid API

Access the imperative API via a ref for programmatic control:

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

Use the `IDataSource` interface for remote pagination, sorting, and filtering:

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

## Feature Parity Matrix

Every feature works the same across all frameworks. Ship consistent behavior regardless of your stack.

| Feature | React | Angular | Vue | Vanilla JS |
|---------|:-----:|:-------:|:---:|:----------:|
| Sorting | Yes | Yes | Yes | Yes |
| Filtering (text, multiSelect, date, people) | Yes | Yes | Yes | Yes |
| Pagination (client & server) | Yes | Yes | Yes | Yes |
| Cell editing (text, select, checkbox, date, richSelect) | Yes | Yes | Yes | Yes |
| Spreadsheet selection | Yes | Yes | Yes | Yes |
| Clipboard (copy/cut/paste) | Yes | Yes | Yes | Yes |
| Fill handle | Yes | Yes | Yes | Yes |
| Undo / Redo | Yes | Yes | Yes | Yes |
| Row selection (single & multi) | Yes | Yes | Yes | Yes |
| Column groups | Yes | Yes | Yes | Yes |
| Column pinning | Yes | Yes | Yes | Yes |
| Column resize | Yes | Yes | Yes | Yes |
| Column chooser | Yes | Yes | Yes | Yes |
| Context menu | Yes | Yes | Yes | Yes |
| Status bar | Yes | Yes | Yes | Yes |
| Side bar | Yes | Yes | Yes | Yes |
| Keyboard navigation | Yes | Yes | Yes | Yes |
| CSV export | Yes | Yes | Yes | Yes |
| Server-side data | Yes | Yes | Yes | Yes |
| Column state persistence | Yes | Yes | Yes | Yes |
| Virtual scrolling (row + column) | Yes | Yes | Yes | Yes |
| Web Worker sort/filter | Yes | Yes | Yes | Yes |
| Grid API (`IOGridApi`) | Yes | Yes | Yes | Yes |

## Architecture

```
@alaarab/ogrid-core          (pure TS, zero deps)
├── @alaarab/ogrid-react          hooks + headless components
│   ├── ogrid-react-radix         Radix UI views
│   ├── ogrid-react-fluent        Fluent UI views
│   └── ogrid-react-material      Material UI views
├── @alaarab/ogrid-angular        signals + services
│   ├── ogrid-angular-material    Angular Material views
│   ├── ogrid-angular-primeng     PrimeNG views
│   └── ogrid-angular-radix       Radix UI views
├── @alaarab/ogrid-vue            composables
│   ├── ogrid-vue-vuetify         Vuetify views
│   ├── ogrid-vue-primevue        PrimeVue views
│   └── ogrid-vue-radix           Radix UI views
└── @alaarab/ogrid-js             vanilla JS (class-based)
```

**Core** owns types and pure TypeScript utilities with zero dependencies. **Framework adapters** (React hooks, Angular services, Vue composables) own state logic and headless components. **UI packages** are thin view layers (~50 lines of framework-specific rendering per component). All UI packages within a framework pass the same test suite via shared test factories.

## Packages

| Package | npm | Description |
|---------|-----|-------------|
| [`@alaarab/ogrid-core`](./packages/core) | [![npm](https://img.shields.io/npm/v/@alaarab/ogrid-core)](https://www.npmjs.com/package/@alaarab/ogrid-core) | Pure TS types, algorithms, utilities (zero deps) |
| **React** | | |
| [`@alaarab/ogrid-react`](./packages/react) | [![npm](https://img.shields.io/npm/v/@alaarab/ogrid-react)](https://www.npmjs.com/package/@alaarab/ogrid-react) | React hooks, headless components, shared test factories |
| [`@alaarab/ogrid-react-radix`](./packages/react-radix) | [![npm](https://img.shields.io/npm/v/@alaarab/ogrid-react-radix)](https://www.npmjs.com/package/@alaarab/ogrid-react-radix) | Radix UI implementation (default, lightweight) |
| [`@alaarab/ogrid-react-fluent`](./packages/react-fluent) | [![npm](https://img.shields.io/npm/v/@alaarab/ogrid-react-fluent)](https://www.npmjs.com/package/@alaarab/ogrid-react-fluent) | Fluent UI v9 implementation |
| [`@alaarab/ogrid-react-material`](./packages/react-material) | [![npm](https://img.shields.io/npm/v/@alaarab/ogrid-react-material)](https://www.npmjs.com/package/@alaarab/ogrid-react-material) | Material UI v7 implementation |
| **Angular** | | |
| [`@alaarab/ogrid-angular`](./packages/angular) | [![npm](https://img.shields.io/npm/v/@alaarab/ogrid-angular)](https://www.npmjs.com/package/@alaarab/ogrid-angular) | Angular v21 services with signals |
| [`@alaarab/ogrid-angular-material`](./packages/angular-material) | [![npm](https://img.shields.io/npm/v/@alaarab/ogrid-angular-material)](https://www.npmjs.com/package/@alaarab/ogrid-angular-material) | Angular Material v21 implementation |
| [`@alaarab/ogrid-angular-primeng`](./packages/angular-primeng) | [![npm](https://img.shields.io/npm/v/@alaarab/ogrid-angular-primeng)](https://www.npmjs.com/package/@alaarab/ogrid-angular-primeng) | PrimeNG v21 implementation |
| [`@alaarab/ogrid-angular-radix`](./packages/angular-radix) | [![npm](https://img.shields.io/npm/v/@alaarab/ogrid-angular-radix)](https://www.npmjs.com/package/@alaarab/ogrid-angular-radix) | Radix UI v21 implementation (lightweight) |
| **Vue** | | |
| [`@alaarab/ogrid-vue`](./packages/vue) | [![npm](https://img.shields.io/npm/v/@alaarab/ogrid-vue)](https://www.npmjs.com/package/@alaarab/ogrid-vue) | Vue 3 composables with Composition API |
| [`@alaarab/ogrid-vue-vuetify`](./packages/vue-vuetify) | [![npm](https://img.shields.io/npm/v/@alaarab/ogrid-vue-vuetify)](https://www.npmjs.com/package/@alaarab/ogrid-vue-vuetify) | Vuetify 3 implementation |
| [`@alaarab/ogrid-vue-primevue`](./packages/vue-primevue) | [![npm](https://img.shields.io/npm/v/@alaarab/ogrid-vue-primevue)](https://www.npmjs.com/package/@alaarab/ogrid-vue-primevue) | PrimeVue 4 implementation |
| [`@alaarab/ogrid-vue-radix`](./packages/vue-radix) | [![npm](https://img.shields.io/npm/v/@alaarab/ogrid-vue-radix)](https://www.npmjs.com/package/@alaarab/ogrid-vue-radix) | Radix UI Vue implementation (lightweight) |
| **Vanilla JS** | | |
| [`@alaarab/ogrid-js`](./packages/js) | [![npm](https://img.shields.io/npm/v/@alaarab/ogrid-js)](https://www.npmjs.com/package/@alaarab/ogrid-js) | Vanilla JS data grid (no framework needed) |

UI packages re-export everything from their adapter package (which re-exports from `@alaarab/ogrid-core`) -- one import is all you need.

## Testing

**2,980 tests** across 14 packages with 100% pass rate. Each framework uses its native testing tools:

| Framework | Tool | Packages | Tests |
|-----------|------|----------|------:|
| Core | Jest + ts-jest | 1 | 377 |
| React | React Testing Library | 4 | 831 |
| Angular | Angular Testing utilities | 4 | 617 |
| Vue | Vue Test Utils | 4 | 719 |
| Vanilla JS | Native DOM + jsdom | 1 | 313 |
| **Total** | | **14** | **2,980** |

Cross-package parity is enforced through **shared test factories** -- 8 factories per framework that generate identical test scenarios for every UI package.

## Development

```bash
git clone https://github.com/alaarab/ogrid.git
cd ogrid
npm install
npm run build                       # Build all packages (Turborepo)
npm run test:all                    # Run all 2,980 tests
npm run lint                        # ESLint

# Storybook
npm run storybook:react-fluent      # React Fluent UI    (port 6006)
npm run storybook:react-material    # React Material UI  (port 6007)
npm run storybook:react-radix       # React Radix UI     (port 6008)
npm run storybook:vue-vuetify       # Vue Vuetify        (port 6011)

# Documentation
npm run docs:dev                    # Docusaurus dev server
npm run docs:build                  # Build docs site
```

### Requirements

- **Node.js** >= 18 (developed with Node 22)
- **npm** workspaces + **Turborepo** for monorepo management

## Contributing

Contributions are welcome. To get started:

1. Fork the repository and create a feature branch.
2. Make your changes following the project conventions (TypeScript strict, ESM-first, headless architecture).
3. If your change affects UI, update **all** UI packages within the relevant framework(s) to maintain parity.
4. Add or extend tests. Use the shared test factories so all UI packages get coverage.
5. Run the full verification suite before submitting:

```bash
npm run build && npm run test:all && npm run lint
```

6. Open a pull request with a clear description of what changed and why.

See [CLAUDE.md](./CLAUDE.md) for detailed architecture documentation and conventions.

## License

[MIT](./LICENSE) -- Free forever. No enterprise tiers. No feature paywalls. No license keys.

---

<p align="center">
  Built by <a href="https://github.com/alaarab">Ala Arab</a>
</p>
