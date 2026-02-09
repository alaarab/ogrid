# @alaarab/ogrid

[OGrid](https://github.com/alaarab/ogrid) data table with [Radix UI](https://www.radix-ui.com/) primitives and no Fluent/Material dependency. Sort, filter (text, multi-select, people), paginate, show/hide columns, spreadsheet-style selection (cell range, copy/paste, context menu), row selection, status bar, and CSV export. Use an in-memory array or plug in your own API.

## Install

```bash
npm install @alaarab/ogrid
```

### Peer Dependencies

```
react ^17.0.0 || ^18.0.0 || ^19.0.0
react-dom ^17.0.0 || ^18.0.0 || ^19.0.0
```

Radix UI primitives (`@radix-ui/react-checkbox`, `@radix-ui/react-popover`) are bundled as regular dependencies.

## Quick Start

```tsx
import { OGrid, type IColumnDef } from '@alaarab/ogrid';

const columns: IColumnDef<Product>[] = [
  { columnId: 'name', name: 'Name', sortable: true, filterable: { type: 'text' }, renderCell: (item) => <span>{item.name}</span> },
  { columnId: 'category', name: 'Category', sortable: true, filterable: { type: 'multiSelect', filterField: 'category' }, renderCell: (item) => <span>{item.category}</span> },
];

<OGrid<Product>
  data={products}
  columns={columns}
  getRowId={(r) => r.id}
  entityLabelPlural="products"
/>
```

## Components

- **`OGrid<T>`** -- Full table with column chooser, filters, and pagination (Radix/native implementation)
- **`DataGridTable<T>`** -- Lower-level grid for custom state management
- **`ColumnChooser`** -- Column visibility dropdown
- **`PaginationControls`** -- Pagination UI
- **`ColumnHeaderFilter`** -- Column header with sort/filter (used internally)

All core types, hooks, and utilities are re-exported from `@alaarab/ogrid-core`.

## Storybook

```bash
npm run storybook
```

## License

MIT
