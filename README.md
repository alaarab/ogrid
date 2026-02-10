<p align="center">
  <img src="packages/docs/static/img/favicon.svg" width="64" height="64" alt="OGrid" />
</p>

<h1 align="center">OGrid</h1>

<p align="center">
  <strong>The lightweight React data grid with enterprise features and zero enterprise cost.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@alaarab/ogrid"><img src="https://img.shields.io/npm/v/@alaarab/ogrid?color=%23217346&label=npm" alt="npm version" /></a>
  <a href="https://github.com/alaarab/ogrid/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License" /></a>
  <img src="https://img.shields.io/badge/tests-521%20passing-brightgreen" alt="521 tests passing" />
  <img src="https://img.shields.io/badge/React-17%20%7C%2018%20%7C%2019-blue" alt="React 17, 18, 19" />
  <img src="https://img.shields.io/badge/TypeScript-strict-blue" alt="TypeScript strict" />
</p>

<p align="center">
  <a href="https://alaarab.github.io/ogrid/">Docs</a> &middot;
  <a href="https://alaarab.github.io/ogrid/docs/getting-started/overview">Getting Started</a> &middot;
  <a href="https://alaarab.github.io/ogrid/docs/api/ogrid-props">API Reference</a> &middot;
  <a href="https://alaarab.github.io/ogrid/docs/guides/migration-from-ag-grid">Migrate from AG Grid</a>
</p>

---

Pick the UI framework you already use — **Fluent UI**, **Material UI**, or **Radix UI** — and get sorting, filtering, pagination, cell editing, spreadsheet selection, and more out of the box.

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
| [`@alaarab/ogrid`](./packages/radix) | [![npm](https://img.shields.io/npm/v/@alaarab/ogrid)](https://www.npmjs.com/package/@alaarab/ogrid) | **Default** — Radix UI (lightweight, no Fluent/Material needed) |
| [`@alaarab/ogrid-fluent`](./packages/fluent) | [![npm](https://img.shields.io/npm/v/@alaarab/ogrid-fluent)](https://www.npmjs.com/package/@alaarab/ogrid-fluent) | Fluent UI v9 implementation |
| [`@alaarab/ogrid-material`](./packages/material) | [![npm](https://img.shields.io/npm/v/@alaarab/ogrid-material)](https://www.npmjs.com/package/@alaarab/ogrid-material) | Material UI v6 implementation |
| [`@alaarab/ogrid-core`](./packages/core) | [![npm](https://img.shields.io/npm/v/@alaarab/ogrid-core)](https://www.npmjs.com/package/@alaarab/ogrid-core) | Headless core — types, hooks, utilities |

All framework packages re-export everything from `@alaarab/ogrid-core` — one import is all you need.

## Quick Start

```bash
npm install @alaarab/ogrid
```

```tsx
import { OGrid, type IColumnDef } from '@alaarab/ogrid';

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

Using Fluent UI? Change the import to `@alaarab/ogrid-fluent`. Material UI? `@alaarab/ogrid-material`. Same API.

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
│   ├── core/         # @alaarab/ogrid-core     – types, hooks, utilities (headless)
│   ├── fluent/       # @alaarab/ogrid-fluent    – Fluent UI components
│   ├── material/     # @alaarab/ogrid-material  – Material UI components
│   ├── radix/        # @alaarab/ogrid           – Radix UI components (default)
│   ├── docs/         # Documentation site
│   └── examples/     # Example apps per framework
└── package.json      # npm workspaces root
```

**Core** owns all state logic (hooks) and types. **UI packages** are thin view layers using their framework's primitives. All three pass the same 521 tests.

## Development

```bash
npm install                     # Install all dependencies
npm run build                   # Build all packages (Turborepo)
npm run test:all                # Run all 521 tests
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
| `@alaarab/ogrid` (Radix) | `react`, `react-dom` |
| `@alaarab/ogrid-fluent` | `react`, `react-dom`, `@fluentui/react-components ^9`, `@fluentui/react-icons ^2` |
| `@alaarab/ogrid-material` | `react`, `react-dom`, `@mui/material ^6`, `@mui/icons-material ^6`, `@emotion/react ^11`, `@emotion/styled ^11` |
| `@alaarab/ogrid-core` | `react ^17 \|\| ^18 \|\| ^19` |

## License

MIT — Free forever. No enterprise tiers. No feature paywalls.
