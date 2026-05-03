<p align="center">
  <img src="packages/docs/static/img/favicon.svg" width="64" height="64" alt="OGrid" />
</p>

<h1 align="center">OGrid</h1>

<p align="center">
  Spreadsheet behavior for any table chrome. Headless hooks for inline edit, range select, fill handle, copy/paste — drop them on shadcn, Material, Fluent, or your own &lt;table&gt;. Or use the built-in &lt;OGrid&gt; component. React-first, MIT.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@alaarab/ogrid-core"><img src="https://img.shields.io/npm/v/@alaarab/ogrid-core?color=%23217346&label=npm" alt="npm" /></a>
  <a href="https://github.com/alaarab/ogrid/actions/workflows/ci.yml"><img src="https://github.com/alaarab/ogrid/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI" /></a>
  <a href="https://github.com/alaarab/ogrid/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License" /></a>
</p>

<p align="center">
  <a href="https://alaarab.github.io/ogrid/">Documentation</a> &middot;
  <a href="https://alaarab.github.io/ogrid/docs/getting-started/overview">Getting Started</a> &middot;
  <a href="https://alaarab.github.io/ogrid/docs/api/ogrid-props">API Reference</a> &middot;
  <a href="https://alaarab.github.io/ogrid/docs/guides/migration-from-ag-grid">Migrate from AG Grid</a> &middot;
  <a href="https://discord.gg/KMajyx9j4m">Discord Community</a>
</p>

---

> **Status:** React and Vanilla JS are the actively maintained adapter families. The Angular and Vue packages are **frozen at v2.9.0** — they remain on npm and in the repository for reference, but no longer receive feature work or version bumps. See [Frozen adapters](#frozen-adapters) below.

Pick the framework and UI library you already use and get sorting, filtering, pagination, cell editing, spreadsheet selection, and the shared core grid model out of the box.

## NEW in 2.9 — Headless spreadsheet hooks

A set of headless hooks that add **spreadsheet behavior** — inline edit, range select, fill handle, copy/paste, undo/redo, keyboard navigation — to **any table chrome** (shadcn `<Table>`, Material `<mat-table>`, your own `<table>`). React / Vue / Angular, MIT.

```tsx
import {
  useHeadlessGrid, useInlineEdit, useRangeSelection,
  useFillHandle, useCellClipboard, useUndoRedo, useGridFocus,
} from "@alaarab/ogrid-react-radix";

const grid = useHeadlessGrid({ columns, data, getRowId: (r) => r.id });
const range = useRangeSelection({ rowCount: grid.rows.length, colCount: grid.columns.length });
const edit = useInlineEdit({ columns, getRowId: (r) => r.id, onCellEdit: applyEdit });
// ... render with shadcn <Table>, plain HTML, or whatever
```

See the [Spreadsheet Demo Storybook](https://alaarab.github.io/ogrid/storybook/?path=/story/ogrid-react-radix-spreadsheetdemo--full-spreadsheet) for the full set of hooks combined on one page (~200 lines, copy-paste starter).

## Why OGrid?

| | OGrid | AG Grid Community | AG Grid Enterprise |
|---|---|---|---|
| Spreadsheet selection | Built-in | No | $999/dev/year |
| Clipboard (copy/paste) | Built-in | No | $999/dev/year |
| Fill handle (drag to fill) | Built-in | No | $999/dev/year |
| Undo / Redo | Built-in | No | $999/dev/year |
| Context menu | Built-in | No | $999/dev/year |
| Status bar | Built-in | No | $999/dev/year |
| Side bar | Built-in | No | $999/dev/year |
| Cell editing | Built-in | Built-in | Built-in |
| Sorting & filtering | Built-in | Built-in | Built-in |
| **Bundle size (gzip)** | **44-61 KB** | ~339 KB | ~339 KB+ |
| **License** | **MIT (free)** | MIT | Commercial |
| **Cost** | **$0** | $0 | **$999/dev/year** |

Bundle size is what you actually install (core + framework adapter + UI layer). See the [architecture section](#architecture) for per-setup sizes.

## Features

**Data**
- Sorting: click headers to sort, multi-column sort, custom comparators
- Filtering: text search, multi-select checkboxes, date range, people picker (client or server-side)
- Pagination: configurable page sizes, client-side or server-side via `IDataSource`
- Virtual scrolling: row and column virtualization for large datasets
- Web worker sort/filter: offload to a background thread with `workerSort: true`
- Server-side data: `IDataSource` pattern for remote pagination, sorting, filtering
- Column types: built-in `text`, `numeric`, `date`, `boolean` with auto-formatting and filters

**Editing**
- Cell editing: inline text, select, checkbox, rich select, and custom popup editors
- Clipboard: Ctrl+C / X / V with multi-cell copy/paste, respects `valueFormatter` / `valueParser`
- Fill handle: drag to fill cells (Excel-style)
- Undo / redo: full edit history with Ctrl+Z / Ctrl+Y, batch operation support
- Premium inputs: optional calendar date picker and more via `@alaarab/ogrid-{react,angular,vue,js}-inputs`

**Selection & Navigation**
- Spreadsheet selection: click-and-drag range selection with active cell highlight
- Row selection: single or multiple with Shift+click range support
- Keyboard navigation: Arrow keys, Tab, Enter, F2, Home/End, Ctrl+Home/End, Ctrl+Arrow (Excel-style)
- Cell references: Excel-style column letters (A, B, C...), row numbers, name box showing active cell

**Columns**
- Column groups: multi-row grouped headers with arbitrary nesting
- Column pinning: sticky left/right columns
- Column resize: drag column borders to resize
- Column chooser: show/hide columns via toolbar dropdown or sidebar panel
- Column state persistence: save/restore visibility, sort, order, widths, filters

**UI**
- Toolbar & layout: unified bordered container with primary toolbar, secondary `toolbarBelow` row, and footer
- Side bar: toggle-able panel with Columns and Filters panels
- Context menu: right-click with copy, paste, cut, export, undo/redo and keyboard shortcuts
- Status bar: row count, filtered count, selection aggregations (sum, avg, min, max)
- Empty state: custom message or render function
- CSV export: one-click export with formatted values

**Advanced**
- Grid API: `ref`-based imperative API for `setRowData`, `getColumnState`, `selectAll`, etc.
- Formula engine: 159 built-in functions, Excel-like formula bar, cell reference highlighting, cross-cell recalculation
- Editor integration (MCP): `@alaarab/ogrid-mcp` connects your IDE to OGrid docs and lets it read and control a running grid
- CSS containment: automatic `contain: content` on cells, `content-visibility: auto` on off-screen rows
- TypeScript strict: fully generic `<T>` with strict mode, zero `any` leaks

## Architecture

```
@alaarab/ogrid-core          (pure TS, zero deps)
├── @alaarab/ogrid-react          hooks + headless components
│   ├── ogrid-react-radix         Radix UI views
│   ├── ogrid-react-fluent        Fluent UI views
│   └── ogrid-react-material      (frozen — MUI v7)
├── @alaarab/ogrid-angular        (frozen — signals + services)
│   ├── ogrid-angular-material    (frozen)
│   ├── ogrid-angular-primeng     (frozen)
│   └── ogrid-angular-radix       (frozen)
├── @alaarab/ogrid-vue            (frozen — composables)
│   ├── ogrid-vue-vuetify         (frozen)
│   ├── ogrid-vue-primevue        (frozen)
│   └── ogrid-vue-radix           (frozen)
└── @alaarab/ogrid-js             vanilla JS (class-based)
```

Core owns types and pure TypeScript utilities with zero dependencies. The React adapter (hooks + headless components) is the actively maintained surface. The Angular signals/services and Vue composables adapters are kept as a reference for the framework-agnostic separation pattern but receive no new work.

### Installed sizes (gzip)

These are the actual sizes you ship. Each row is core + adapter + UI layer combined:

| Setup | Gzip |
|-------|------|
| React + Radix | 54 KB |
| React + Fluent | 55 KB |
| React + Material | 57 KB |
| Vanilla JS | 45 KB |
| AG Grid Community (comparison) | ~339 KB |

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

> Using Fluent UI? Change the import to `@alaarab/ogrid-react-fluent`. Same API.

> Need Material UI, Angular, or Vue? See [Frozen adapters](#frozen-adapters) — those packages still work at their last shipped versions but are no longer actively developed.

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

Core features are shared across React, Angular, Vue, and vanilla JS. Main CI now stays fast with lint plus a browser smoke suite on every push, while the heavier verification workflows are run manually when you want a full release-grade pass.

## Packages

| Package | npm | Peer Dependencies |
|---------|-----|-------------------|
| [`@alaarab/ogrid-core`](./packages/core) | [![npm](https://img.shields.io/npm/v/@alaarab/ogrid-core)](https://www.npmjs.com/package/@alaarab/ogrid-core) | None |
| **React** | | |
| [`@alaarab/ogrid-react`](./packages/react) | [![npm](https://img.shields.io/npm/v/@alaarab/ogrid-react)](https://www.npmjs.com/package/@alaarab/ogrid-react) | `react`, `react-dom` |
| [`@alaarab/ogrid-react-radix`](./packages/react-radix) | [![npm](https://img.shields.io/npm/v/@alaarab/ogrid-react-radix)](https://www.npmjs.com/package/@alaarab/ogrid-react-radix) | `react`, `react-dom` |
| [`@alaarab/ogrid-react-fluent`](./packages/react-fluent) | [![npm](https://img.shields.io/npm/v/@alaarab/ogrid-react-fluent)](https://www.npmjs.com/package/@alaarab/ogrid-react-fluent) | + `@fluentui/react-components`, `@fluentui/react-icons` |
| **Vanilla JS** | | |
| [`@alaarab/ogrid-js`](./packages/js) | [![npm](https://img.shields.io/npm/v/@alaarab/ogrid-js)](https://www.npmjs.com/package/@alaarab/ogrid-js) | None |

UI packages re-export everything from their adapter (which re-exports from core), so one import is all you need.

Optional premium inputs (calendar date picker, rating, color picker, slider, tags) are available as add-on packages: `@alaarab/ogrid-react-inputs`, `@alaarab/ogrid-js-inputs`.

### Frozen adapters

The following packages remain published on npm at the version listed and the source lives in `packages/` for reference, but they are no longer in the active build, test, release, or CI pipelines. They will not get framework-major upgrades or new features. Existing installs continue to work; for new projects, use the React Radix or React Fluent adapter or vanilla JS.

| Frozen package | npm |
|---|---|
| `@alaarab/ogrid-react-material` | v2.9.1 (MUI v7; v9 dropped Typography props the adapter uses) |
| `@alaarab/ogrid-angular`, `-angular-material`, `-angular-primeng`, `-angular-radix`, `-angular-inputs` | v2.9.0 |
| `@alaarab/ogrid-vue`, `-vue-vuetify`, `-vue-primevue`, `-vue-radix`, `-vue-inputs` | v2.9.0 |

## Editor Integration (MCP)

`@alaarab/ogrid-mcp` is a standalone [MCP server](https://modelcontextprotocol.io) that gives your IDE full access to OGrid documentation and lets it read and control a running grid in real time.

### Connect your editor to OGrid docs

```bash
# One-time setup (any MCP-compatible editor)
npx -y @alaarab/ogrid-mcp

# Or add to your editor's MCP config
{
  "mcpServers": {
    "ogrid": { "command": "npx", "args": ["-y", "@alaarab/ogrid-mcp"] }
  }
}
```

Once connected, your editor can search and read the full OGrid documentation:

```
> Which filtering modes does OGrid support?
> Show me a server-side data source example in Angular
> How do I pin columns in Vue?
```

Available tools: `search_docs`, `list_docs`, `get_docs`, `get_code_example`, `detect_version`
Available resources: `ogrid://quick-reference`, `ogrid://docs/{path}`, `ogrid://migration-guide`

### Live testing bridge

Add `--bridge` to let your editor read and control a **running** OGrid instance:

```bash
npx @alaarab/ogrid-mcp --bridge
```

Then connect your dev app with one `useEffect`:

```tsx
import { connectGridToBridge } from '@alaarab/ogrid-mcp/bridge-client';

useEffect(() => {
  const bridge = connectGridToBridge({
    gridId: 'my-grid',
    getData: () => data,
    getColumns: () => columns,
    onCellUpdate: (rowIndex, columnId, value) =>
      setData(prev => prev.map((row, i) => i === rowIndex ? { ...row, [columnId]: value } : row)),
  });
  return () => bridge.disconnect();
}, [data]);
```

Now your editor can inspect what's actually rendering, update cells, apply filters, and navigate pages while you watch the grid update live.

Bridge tools: `list_grids`, `get_grid_state`, `send_grid_command`

> **Note:** The bridge is dev-only and localhost-only. Never run `--bridge` in production.

See the [MCP guide](packages/docs/docs/guides/mcp.mdx) and [live testing bridge guide](packages/docs/docs/guides/mcp-live-testing.mdx) for full documentation.

## Testing

Active suites use each framework's native testing tools:

| Framework | Tool | Tests |
|-----------|------|------:|
| Core | Jest + ts-jest | ~1,501 |
| React | React Testing Library | ~903 |
| Vanilla JS | Native DOM + jsdom | ~394 |

Cross-package parity is driven by shared test factories. Playwright covers a fast smoke gate on every push plus a manual full matrix across the active example apps. Frozen Angular and Vue test suites still live in their packages and pass at v2.9.0 but are not part of the active CI matrix.

## Development

```bash
git clone https://github.com/alaarab/ogrid.git
cd ogrid
npm install
npm run build                       # Build all packages (Turborepo)
npm run test:all                    # Run all tests
npm run lint                        # Biome
npm run test:e2e:smoke              # Browser merge gate (React Radix, JS)
npm run test:e2e:docs               # Built docs homepage verification
npm run test:e2e:matrix             # Full browser matrix across active example apps

# GitHub Actions
# CI                -> fast push/PR checks (lint + browser smoke)
# Full Verification -> manual full build/test matrix before release or larger merges
# Playwright Matrix -> manual browser parity pass across active example apps

# Storybook
npm run storybook:react-fluent      # React Fluent UI    (port 6006)
npm run storybook:react-radix       # React Radix UI     (port 6008)

# Documentation
npm run docs:dev                    # Docusaurus dev server
npm run docs:build                  # Build docs site
```

### Requirements

- Node.js >= 18 (developed with Node 22)
- npm workspaces + Turborepo for monorepo management

## Contributing

Contributions are welcome. To get started:

1. Fork the repository and create a feature branch.
2. Make your changes following the project conventions (TypeScript strict, ESM-first, headless architecture).
3. If your change affects UI, update **all** UI packages within the relevant framework(s) to maintain parity.
4. Add or extend tests. Use the shared test factories so all UI packages get coverage.
5. Run the full verification suite before submitting:

```bash
npm run build && npm run test:all && npm run lint && npm run test:e2e:smoke
```

6. Open a pull request with a clear description of what changed and why.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture documentation and conventions.

## License

[MIT](./LICENSE)

---

Built by [Ala Arab](https://github.com/alaarab)
