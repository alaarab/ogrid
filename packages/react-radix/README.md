<p align="center">
  <strong>OGrid</strong> — The lightweight React data grid with enterprise features and zero enterprise cost.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@alaarab/ogrid"><img src="https://img.shields.io/npm/v/@alaarab/ogrid?color=%23217346&label=npm" alt="npm version" /></a>
  <a href="https://github.com/alaarab/ogrid/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License" /></a>
  <img src="https://img.shields.io/badge/React-17%20%7C%2018%20%7C%2019-blue" alt="React 17, 18, 19" />
  <img src="https://img.shields.io/badge/TypeScript-strict-blue" alt="TypeScript strict" />
</p>

<p align="center">
  <a href="https://alaarab.github.io/ogrid/">Documentation</a> · <a href="https://alaarab.github.io/ogrid/docs/getting-started/overview">Getting Started</a> · <a href="https://alaarab.github.io/ogrid/docs/api/ogrid-props">API Reference</a>
</p>

---

This is the **default OGrid package** built with Radix UI primitives — lightweight, no Fluent/Material dependency. Also available for [Fluent UI](https://www.npmjs.com/package/@alaarab/ogrid-fluent) and [Material UI](https://www.npmjs.com/package/@alaarab/ogrid-material). Same API, just swap the import.

## Why OGrid?

| | OGrid | AG Grid Community | AG Grid Enterprise |
|---|---|---|---|
| Spreadsheet selection | Built-in | - | $999/dev/year |
| Clipboard (copy/paste) | Built-in | - | $999/dev/year |
| Fill handle | Built-in | - | $999/dev/year |
| Undo/redo | Built-in | - | $999/dev/year |
| Context menu | Built-in | - | $999/dev/year |
| Status bar | Built-in | - | $999/dev/year |
| Side bar | Built-in | - | $999/dev/year |
| Cell editing | Built-in | Built-in | Built-in |
| Sorting & filtering | Built-in | Built-in | Built-in |
| **License** | **MIT (free)** | MIT | Commercial |

## Features

Sorting · Filtering (text, multi-select, date range, people picker) · Pagination · Cell editing (inline, select, checkbox, rich select, date, custom popover) · Spreadsheet selection · Clipboard · Fill handle · Undo/redo · Row selection · Column groups · Column pinning · Column resize · Column chooser · Side bar · Context menu · Status bar with aggregations · CSV export · Grid API · Server-side data · Column state persistence · Keyboard navigation (Excel-style Ctrl+Arrow) · Built-in column types (text, numeric, date, boolean) · React 17/18/19 · TypeScript strict

## Install

```bash
npm install @alaarab/ogrid
```

Radix UI primitives are bundled as regular dependencies — only `react` and `react-dom` are peer deps.

## Quick Start

```tsx
import { OGrid, type IColumnDef } from '@alaarab/ogrid';

const columns: IColumnDef<Employee>[] = [
  { columnId: 'name', name: 'Name', sortable: true, editable: true },
  { columnId: 'department', name: 'Department',
    filterable: { type: 'multiSelect' },
    cellEditor: 'richSelect', cellEditorParams: { values: ['Engineering', 'Sales', 'Marketing'] } },
  { columnId: 'salary', name: 'Salary', type: 'numeric', editable: true,
    valueFormatter: (v) => `$${Number(v).toLocaleString()}` },
];

<OGrid
  columns={columns}
  data={employees}
  getRowId={(e) => e.id}
  editable
  cellSelection
  statusBar
  sideBar
/>
```

## Documentation

Full docs, API reference, and interactive examples at **[alaarab.github.io/ogrid](https://alaarab.github.io/ogrid/)**.

## License

MIT — Free forever. No enterprise tiers. No feature paywalls.
