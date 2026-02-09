# @alaarab/ogrid-fluent

[OGrid](https://github.com/alaarab/ogrid) data table for [Fluent UI](https://react.fluentui.dev/). Sort, filter (text, multi-select, people), paginate, show/hide columns, and export to CSV. Use an in-memory array or plug in your own API.

## Install

```bash
npm install @alaarab/ogrid-fluent
```

### Peer Dependencies

```
@fluentui/react-components ^9.0.0
@fluentui/react-icons ^2.0.0
react ^17.0.0 || ^18.0.0 || ^19.0.0
react-dom ^17.0.0 || ^18.0.0 || ^19.0.0
```

## Quick Start

```tsx
import { OGrid, type IColumnDef } from '@alaarab/ogrid-fluent';

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

- **`OGrid<T>`** -- Full table with column chooser, filters, and pagination (Fluent UI implementation)
- **`DataGridTable<T>`** -- Lower-level grid for custom state management
- **`ColumnChooser`** -- Column visibility dropdown
- **`PaginationControls`** -- Pagination UI
- **`ColumnHeaderFilter`** -- Column header with sort/filter (used internally)

All core types, hooks, and utilities are re-exported from `@alaarab/ogrid-core` for convenience.

## Storybook

```bash
npm run storybook   # port 6006
```

## License

MIT
