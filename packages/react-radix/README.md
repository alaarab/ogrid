# @alaarab/ogrid-react-radix

OGrid data grid for React, built with Radix UI primitives.

## Install

```bash
npm install @alaarab/ogrid-react-radix
```

## Usage

```tsx
import { OGrid, type IColumnDef } from '@alaarab/ogrid-react-radix';

const columns: IColumnDef<Employee>[] = [
  { columnId: 'name', name: 'Name', sortable: true, editable: true },
  { columnId: 'department', name: 'Department', filterable: { type: 'multiSelect' } },
];

<OGrid columns={columns} data={employees} getRowId={(e) => e.id} />
```

## Headless API — `useHeadlessGrid`

Render OGrid's sort/filter/paginate/select state with your own table chrome
(shadcn `<Table>`, plain `<table>`, anything else). The same logic that powers
`<OGrid>` is exposed as a hook so you keep your design system and still get
the spreadsheet-class state management.

```tsx
import { useHeadlessGrid } from '@alaarab/ogrid-react-radix';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'; // your shadcn primitives

const grid = useHeadlessGrid({
  columns,
  data: employees,
  getRowId: (e) => e.id,
  initialSort: { field: 'salary', direction: 'desc' },
  initialPageSize: 25,
});

return (
  <Table>
    <TableHeader>
      <TableRow>
        {grid.columns.map((col) => (
          <TableHead
            key={col.columnId}
            onClick={() => col.sortable && grid.toggleSort(col.columnId)}
          >
            {col.name} {grid.sortIndicator(col.columnId)}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
    <TableBody>
      {grid.rows.map((row) => (
        <TableRow
          key={grid.getRowId(row)}
          onClick={() => grid.toggleRowSelection(row)}
          data-selected={grid.isRowSelected(row)}
        >
          {grid.columns.map((col) => (
            <TableCell key={col.columnId}>
              {String(grid.getCellValue(row, col.columnId))}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  </Table>
);
```

The hook returns:

| | |
|---|---|
| `rows`, `allFilteredRows`, `totalCount`, `totalPages` | Current-page rows, full filtered set, counts |
| `columns`, `getRowId`, `getCellValue` | Column defs, row identity, cell value resolution (honors `valueGetter`) |
| `sort`, `setSort`, `toggleSort`, `sortIndicator` | Current sort state + `▲`/`▼`/`""` indicator helper |
| `filters`, `setFilters`, `setFilter`, `hasActiveFilters` | Filter state |
| `page`, `pageSize`, `setPage`, `setPageSize` | Pagination |
| `selectedRowIds`, `isRowSelected`, `toggleRowSelection`, `selectAllOnPage`, `clearSelection` | Minimal Set-based row selection |

Pair with `preset-shadcn.css` for full theme inheritance:

```ts
import "@alaarab/ogrid-react-radix/styles/preset-shadcn.css";
```

## Theming

Override any `--ogrid-*` variable to customize. The shadcn preset above maps
them to your shadcn tokens (`--card`, `--ring`, `--radius`, `--font-sans`)
automatically.

See the [OGrid docs](https://alaarab.github.io/ogrid/) for the full token
catalog and component reference.
