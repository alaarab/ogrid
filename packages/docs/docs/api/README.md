# API Reference

Complete API documentation for OGrid components, types, and interfaces.

## Components

- [DataGridTable](./components-datagrid-table.mdx): core data grid component that renders the table, headers, rows, and cells
- [ColumnHeaderFilter](./components-column-header-filter.mdx): column header with sorting and filtering UI (text, multi-select, people, date)
- [ColumnChooser](./components-column-chooser.mdx): dropdown for showing/hiding columns
- [PaginationControls](./components-pagination-controls.mdx): pagination UI with page navigation and page size selector
- [StatusBar](./components-status-bar.mdx): status bar with row counts and cell aggregations
- [SideBar](./components-sidebar.mdx): collapsible sidebar with columns and filters panels

## Configuration

- [OGrid Props](./ogrid-props.mdx): top-level OGrid component props (client-side and server-side modes)
- [Column Definition](./column-def.mdx): complete column definition reference (IColumnDef, IColumnGroupDef, cell editors, filters)
- [Grid API](./grid-api.mdx): imperative grid API (IOGridApi) for programmatic control
- [JS API](./js-api.mdx): vanilla JS API reference (OGrid class, state classes, components)

## Types

- [Types Reference](./types.mdx): all shared TypeScript types
  - Data types: `RowId`, `FilterValue`, `IFilters`, `IDataSource`, `IFetchParams`, `IPageResult`
  - Selection: `RowSelectionMode`, `IActiveCell`, `ISelectionRange`, `IRowSelectionChangeEvent`
  - Editing: `ICellEditorProps`, `ICellValueChangedEvent`, `CellEditorParams`
  - UI: `IStatusBarProps`, `ISideBarDef`, `UserLike`
  - State: `IGridColumnState`, `IVirtualScrollConfig`

## Quick Links

### Getting Started
- [Installation](/docs/getting-started/installation)
- [Quick Start](/docs/getting-started/quick-start)
- [Framework Showcase](/docs/guides/framework-showcase)

### Features
- [Sorting](/docs/features/sorting)
- [Filtering](/docs/features/filtering)
- [Pagination](/docs/features/pagination)
- [Row Selection](/docs/features/row-selection)
- [Spreadsheet Selection](/docs/features/spreadsheet-selection)
- [Editing](/docs/features/editing)
- [Column Chooser](/docs/features/column-chooser)
- [Server-Side Data](/docs/features/server-side-data)
- [Virtual Scrolling](/docs/features/virtual-scrolling)
- [Sidebar](/docs/features/sidebar)

## Type Imports

All types can be imported from any OGrid package:

```typescript
// React packages
import type {
  IColumnDef,
  IOGridApi,
  IOGridProps,
  IDataSource,
  ICellEditorProps,
  IFilters,
  FilterValue,
  RowId,
} from '@alaarab/ogrid-react-radix';

// Angular packages
import type {
  IColumnDef,
  IOGridApi,
  IDataSource,
} from '@alaarab/ogrid-angular-material';

// Vue packages
import type {
  IColumnDef,
  IOGridApi,
  IDataSource,
} from '@alaarab/ogrid-vue-vuetify';

// Vanilla JS
import type {
  IColumnDef,
  IDataSource,
} from '@alaarab/ogrid-js';
```

## Framework-Specific APIs

Each framework has idiomatic APIs:

| Framework | Orchestration | State Hook/Service | Props Pattern |
|-----------|---------------|-------------------|---------------|
| React | `useOGrid()` hook | `useDataGridState()` | Individual props |
| Angular | `OGridService` | `DataGridStateService` | Signal-based inputs |
| Vue | `useOGrid()` composable | `useDataGridState()` | Individual props or `:grid-props` |
| Vanilla JS | `OGrid` class | `GridState` class | Constructor options |

See the [Framework Showcase](/docs/guides/framework-showcase) for detailed comparisons and examples.
