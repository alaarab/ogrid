<p align="center">
  <strong>OGrid JS</strong> — Vanilla JavaScript data grid with zero framework dependencies.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@alaarab/ogrid-js"><img src="https://img.shields.io/npm/v/@alaarab/ogrid-js?color=%23217346&label=npm" alt="npm version" /></a>
  <a href="https://github.com/alaarab/ogrid/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License" /></a>
  <img src="https://img.shields.io/badge/TypeScript-strict-blue" alt="TypeScript strict" />
</p>

<p align="center">
  <a href="https://alaarab.github.io/ogrid/">Documentation</a> · <a href="https://alaarab.github.io/ogrid/docs/getting-started/overview">Getting Started</a> · <a href="https://alaarab.github.io/ogrid/docs/api/ogrid-props">API Reference</a>
</p>

---

Vanilla JS data grid for [OGrid](https://github.com/alaarab/ogrid) — full feature parity with the React packages, no framework required. Class-based state with EventEmitter replaces React hooks. Depends only on [`@alaarab/ogrid-core`](https://www.npmjs.com/package/@alaarab/ogrid-core).

## Features

- Sorting, filtering, pagination (client-side and server-side)
- Cell selection, keyboard navigation, clipboard (copy/cut/paste)
- Inline cell editing with undo/redo (batch support)
- Fill handle (drag-to-fill)
- Row selection (single/multiple, shift-click range, select all)
- Column resizing and pinning (left/right)
- Column chooser, sidebar (columns & filters panels)
- Header filters (text, multiSelect, date)
- Context menu
- Status bar with aggregations
- Marching ants copy/cut overlay
- Server-side data source with `fetchPage`

## Quick Start

```typescript
import { OGrid } from '@alaarab/ogrid-js';

const grid = new OGrid(document.getElementById('grid')!, {
  columns: [
    { columnId: 'name', header: 'Name' },
    { columnId: 'age', header: 'Age', type: 'numeric' },
  ],
  data: [
    { name: 'Alice', age: 30 },
    { name: 'Bob', age: 25 },
  ],
  pagination: true,
  pageSize: 10,
});

// Access the API
const api = grid.getApi();

// Clean up
grid.destroy();
```

## Install

```bash
npm install @alaarab/ogrid-js
```

Peer dep: `@alaarab/ogrid-core`.

## Documentation

Full docs at **[alaarab.github.io/ogrid](https://alaarab.github.io/ogrid/)**.

## License

MIT — Free forever.
