# OGrid

A lightweight, framework-agnostic data grid for React. Pick the UI framework you already use — Fluent UI, Material UI, or Radix UI — and get sorting, filtering, pagination, cell editing, spreadsheet selection, and more out of the box. Designed to be the simpler, smaller, better-packaged alternative to AG Grid.

## Packages

| Package | npm | Description |
|---------|-----|-------------|
| [`@alaarab/ogrid-core`](./packages/core) | [![npm](https://img.shields.io/npm/v/@alaarab/ogrid-core)](https://www.npmjs.com/package/@alaarab/ogrid-core) | Framework-agnostic types, hooks, and utilities |
| [`@alaarab/ogrid-fluent`](./packages/fluent) | [![npm](https://img.shields.io/npm/v/@alaarab/ogrid-fluent)](https://www.npmjs.com/package/@alaarab/ogrid-fluent) | Fluent UI implementation |
| [`@alaarab/ogrid-material`](./packages/material) | [![npm](https://img.shields.io/npm/v/@alaarab/ogrid-material)](https://www.npmjs.com/package/@alaarab/ogrid-material) | Material UI implementation (MUI Table-based) |
| [`@alaarab/ogrid`](./packages/radix) | [![npm](https://img.shields.io/npm/v/@alaarab/ogrid)](https://www.npmjs.com/package/@alaarab/ogrid) | Default implementation (Radix UI; lightweight, no Fluent or Material required) |

## Features

- **Sorting** — Click column headers to sort ascending/descending; configurable default sort
- **Filtering** — Three filter types: text search, multi-select checkboxes, people picker
- **Pagination** — Configurable page sizes with first/prev/next/last navigation
- **Column Visibility** — Show/hide columns via a dropdown chooser
- **Cell Editing** — Inline editing with built-in editors (`text`, `select`, `checkbox`) and custom popup editors
- **Spreadsheet Selection** — Click and drag range selection, Shift+click, keyboard navigation (arrow keys, Tab, Enter)
- **Clipboard** — Copy/cut/paste with TSV support (Ctrl+C/X/V)
- **Row Selection** — Single or multiple row selection with shift-click
- **Undo/Redo** — History stack for cell edits (Ctrl+Z / Ctrl+Y)
- **Fill Handle** — Drag to fill cells down (spreadsheet-style)
- **Column Groups** — Multi-level grouped headers
- **Column Pinning** — Pin columns to the left or right edge
- **Value Getters/Formatters** — Compute and format cell values without custom `renderCell`
- **Cell Styles** — Static or dynamic per-cell inline styles
- **Context Menu** — Right-click menu (Copy, Cut, Paste, Select All)
- **Status Bar** — Row count, filtered count, selected count
- **Grid API** — Imperative ref API (`setRowData`, `setFilterModel`, `getSelectedRows`, etc.)
- **CSV Export** — Export visible or all data to CSV
- **Empty State** — Custom message or full custom content when no results
- **Data Source Pattern** — Pass `data` (array) for client-side or `dataSource` for server-side
- **React 17, 18 & 19** — Compatible with all three versions
- **Generic Types** — Works with any data type `<T>`
- **Lightweight** — No heavy runtime; just your framework's components + thin logic

## Quick Start

### Radix UI (Default)

```bash
npm install @alaarab/ogrid
```

```tsx
import { OGrid, type IColumnDef } from '@alaarab/ogrid';

const columns: IColumnDef<Product>[] = [
  { columnId: 'name', name: 'Name', sortable: true, filterable: { type: 'text' }, renderCell: (item) => <span>{item.name}</span> },
  { columnId: 'category', name: 'Category', sortable: true, filterable: { type: 'multiSelect', filterField: 'category' }, renderCell: (item) => <span>{item.category}</span> },
  { columnId: 'price', name: 'Price', sortable: true, renderCell: (item) => <span>${item.price.toFixed(2)}</span> },
];

<OGrid<Product>
  data={products}
  columns={columns}
  getRowId={(r) => r.id}
  entityLabelPlural="products"
/>
```

### Fluent UI

```bash
npm install @alaarab/ogrid-fluent
```

```tsx
import { OGrid, type IColumnDef } from '@alaarab/ogrid-fluent';

<OGrid<Product>
  data={products}
  columns={columns}
  getRowId={(r) => r.id}
  entityLabelPlural="products"
/>
```

### Material UI

```bash
npm install @alaarab/ogrid-material
```

```tsx
import { OGrid, type IColumnDef } from '@alaarab/ogrid-material';

<OGrid<Product>
  data={products}
  columns={columns}
  getRowId={(r) => r.id}
  entityLabelPlural="products"
/>
```

All framework packages re-export everything from `@alaarab/ogrid-core`, so you only need one import.

### Cell Editing

```tsx
<OGrid<Product>
  data={products}
  columns={[
    { columnId: 'name', name: 'Name', editable: true, cellEditor: 'text' },
    { columnId: 'status', name: 'Status', editable: true, cellEditor: 'select', cellEditorParams: { values: ['Active', 'Inactive'] } },
    { columnId: 'verified', name: 'Verified', editable: true, cellEditor: 'checkbox' },
  ]}
  getRowId={(r) => r.id}
  onCellValueChanged={(event) => console.log(event)}
/>
```

### Grid API

```tsx
const gridRef = useRef<IOGridApi<Product>>(null);

<OGrid ref={gridRef} data={products} columns={columns} getRowId={(r) => r.id} />

// Programmatic control
gridRef.current?.setRowData(newData);
gridRef.current?.setFilterModel({ status: ['Active'] });
gridRef.current?.selectAll();
```

### Server-Side Data

```tsx
import type { IDataSource } from '@alaarab/ogrid-core';

const dataSource: IDataSource<Product> = {
  async fetchPage(params) {
    const res = await fetch(`/api/products?page=${params.page}&pageSize=${params.pageSize}`);
    return res.json(); // { items: Product[], totalCount: number }
  },
  async fetchFilterOptions(field) {
    const res = await fetch(`/api/products/distinct/${field}`);
    return res.json(); // string[]
  },
};

// Works with any framework package (same component name, different import):
<OGrid dataSource={dataSource} columns={columns} getRowId={(r) => r.id} />
```

## Architecture

```
ogrid/
├── packages/
│   ├── core/         # @alaarab/ogrid-core    – types, hooks, utilities
│   ├── fluent/       # @alaarab/ogrid-fluent   – Fluent UI components
│   ├── material/     # @alaarab/ogrid-material – Material UI components
│   ├── radix/        # @alaarab/ogrid          – Radix UI components (default)
│   └── examples/     # Example apps for each framework
├── turbo.json        # Turborepo task config
└── package.json      # Workspace root
```

- **Core** holds everything framework-agnostic: `IColumnDef`, `IDataSource`, `IFilters`, all state hooks (`useDataGridState`, `useCellEditing`, `useCellSelection`, `useKeyboardNavigation`, `useClipboard`, `useUndoRedo`, etc.), utilities (`exportToCsv`, `getCellValue`, `flattenColumns`), and headless components (`OGridLayout`, `StatusBar`, `GridContextMenu`).
- **Fluent**, **Material**, and **Radix** (`@alaarab/ogrid`) each export **`<OGrid>`** (same component name) plus lower-level pieces (`DataGridTable`, `ColumnHeaderFilter`, `ColumnChooser`, `PaginationControls`) using their respective UI libraries.
- All framework packages re-export core types and utilities for convenience — consumers only need one import.

## API Overview

### Top-Level Component

Each framework package exports **`<OGrid>`** — the package you import from picks the implementation. It wires together the grid, filters, column chooser, pagination, and all interactive features.

| Prop | Type | Description |
|------|------|-------------|
| `columns` | `(IColumnDef<T> \| IColumnGroupDef<T>)[]` | Column definitions (flat or grouped) |
| `getRowId` | `(item: T) => string` | Unique row key |
| `data` | `T[]` | Client-side: in-memory array |
| `dataSource` | `IDataSource<T>` | Server-side: your API adapter |
| `defaultPageSize` | `number` | Initial rows per page (default 20) |
| `defaultSortBy` | `string` | Initial sort column |
| `defaultSortDirection` | `'asc' \| 'desc'` | Initial sort direction |
| `entityLabelPlural` | `string` | Label for pagination (e.g. "products") |
| `title` | `ReactNode` | Optional title above the grid |
| `toolbar` | `ReactNode` | Optional toolbar (e.g. export button) |
| `emptyState` | `{ message?, render? }` | Custom empty state |
| `layoutMode` | `'content' \| 'fill'` | Grid sizing behavior |
| `editable` | `boolean` | Enable cell editing |
| `onCellValueChanged` | `(event: ICellValueChangedEvent<T>) => void` | Cell edit callback |
| `rowSelection` | `'none' \| 'single' \| 'multiple'` | Row selection mode |
| `onSelectionChange` | `(event: IRowSelectionChangeEvent<T>) => void` | Row selection callback |
| `statusBar` | `boolean \| IStatusBarProps` | Show status bar |
| `freezeRows` | `number` | Sticky header rows |
| `freezeCols` | `number` | Sticky left columns |
| `aria-label` | `string` | Accessible name |
| `ref` | `Ref<IOGridApi<T>>` | Imperative grid API |

For controlled state, pass `page`, `sort`, `filters`, `visibleColumns` and the corresponding `on*Change` callbacks.

### Core Types

```typescript
interface IColumnDef<T> {
  columnId: string;
  name: string;
  sortable?: boolean;
  filterable?: { type: 'text' | 'multiSelect' | 'people'; filterField?: string };
  defaultVisible?: boolean;
  required?: boolean;
  minWidth?: number;
  defaultWidth?: number;
  idealWidth?: number;
  pinned?: 'left' | 'right';
  renderCell?: (item: T) => ReactNode;
  compare?: (a: T, b: T) => number;
  valueGetter?: (item: T) => unknown;
  valueFormatter?: (value: unknown, item: T) => string;
  cellStyle?: CSSProperties | ((item: T) => CSSProperties);
  editable?: boolean | ((item: T) => boolean);
  cellEditor?: 'text' | 'select' | 'checkbox' | ComponentType<ICellEditorProps<T>>;
  cellEditorPopup?: boolean;
  cellEditorParams?: CellEditorParams;
}

interface IColumnGroupDef<T> {
  headerName: string;
  children: (IColumnGroupDef<T> | IColumnDef<T>)[];
}

interface IDataSource<T> {
  fetchPage(params: IFetchParams): Promise<{ items: T[]; totalCount: number }>;
  fetchFilterOptions?(field: string): Promise<string[]>;
  searchPeople?(query: string): Promise<UserLike[]>;
  getUserByEmail?(email: string): Promise<UserLike | undefined>;
}

interface IOGridApi<T> {
  setRowData: (data: T[]) => void;
  setLoading: (loading: boolean) => void;
  getColumnState: () => IGridColumnState;
  setFilterModel: (filters: IFilters) => void;
  getSelectedRows: () => string[];
  setSelectedRows: (rowIds: string[]) => void;
  selectAll: () => void;
  deselectAll: () => void;
}
```

## Development

```bash
# Install all dependencies
npm install

# Run all workspace tests
npm run test:all

# Run tests for a specific package
npm run test:core
npm run test:fluent
npm run test:material
npm run test:radix

# Build all packages
npm run build

# Lint
npm run lint

# Storybook
npm run storybook:fluent    # port 6006
npm run storybook:material  # port 6007
npm run storybook:radix     # port 6008

# Example apps
cd packages/examples
npm run dev:fluent           # port 3001
npm run dev:material         # port 3002
```

## Peer Dependencies

| Package | Peer Dependencies |
|---------|-------------------|
| `@alaarab/ogrid-core` | `react ^17 \|\| ^18 \|\| ^19` |
| `@alaarab/ogrid-fluent` | `react`, `react-dom`, `@fluentui/react-components ^9`, `@fluentui/react-icons ^2` |
| `@alaarab/ogrid-material` | `react`, `react-dom`, `@mui/material ^6`, `@mui/icons-material ^6`, `@emotion/react ^11`, `@emotion/styled ^11` |
| `@alaarab/ogrid` (Radix) | `react`, `react-dom` |

## License

MIT
