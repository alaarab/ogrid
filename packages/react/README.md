# @alaarab/ogrid-react

React hooks and headless components shared by both OGrid UI kits. Supports React and ReactDOM 17, 18 and 19; depends on `ogrid-core` and `@tanstack/react-virtual`.

```bash
npm install @alaarab/ogrid-react react react-dom
```

Use `@alaarab/ogrid-react-radix` or `@alaarab/ogrid-react-fluent` for a ready-made grid. Both re-export this API. Use this package to render your own table:

```tsx
import { useHeadlessGrid, type IColumnDef } from '@alaarab/ogrid-react';

interface Row { id: string; name: string }
const columns: IColumnDef<Row>[] = [
  { columnId: 'name', name: 'Name', sortable: true },
];

export function CustomTable({ data }: { data: Row[] }) {
  const grid = useHeadlessGrid({ columns, data, getRowId: (row) => row.id });
  return (
    <table>
      <thead>
        <tr>{grid.columns.map((column) => (
          <th key={column.columnId}>
            <button type="button" onClick={() => grid.toggleSort(column.columnId)}>
              {column.name} {grid.sortIndicator(column.columnId)}
            </button>
          </th>
        ))}</tr>
      </thead>
      <tbody>{grid.rows.map((row) => (
        <tr key={grid.getRowId(row)}>{grid.columns.map((column) => (
          <td key={column.columnId}>{String(grid.getCellValue(row, column.columnId) ?? '')}</td>
        ))}</tr>
      ))}</tbody>
    </table>
  );
}
```

`useHeadlessGrid` manages sort/filter/pagination and basic row selection. Compose `useInlineEdit`, `useRangeSelection`, `useFillHandle`, `useCellClipboard`, `useUndoRedo` and `useGridFocus` for spreadsheet interactions. You wire their events and render the UI; see the [headless guide](https://alaarab.github.io/ogrid/docs/headless) and [hook reference](https://alaarab.github.io/ogrid/docs/api/headless-hooks).

The component layer also shares merges, freeze/structure commands, find/replace, notes, conditional formatting, validation, formula assistance and drag behavior between the kits. Optional forms and behavior have lazy entries; the standalone validation form is exported at `@alaarab/ogrid-react/data-validation`.

`@alaarab/ogrid-react/testing` exports shared test factories. This optional entry requires `@testing-library/react` 16 and React 18+.

MIT licensed; version 2.19.0.
