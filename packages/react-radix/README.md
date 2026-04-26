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

## Inline cell editing — `useInlineEdit`

Add spreadsheet-style cell editing to your shadcn table. Compose with
`useHeadlessGrid`; bring your own input component. `valueParser` validation
fires on commit (same flow `<OGrid>` uses).

```tsx
import { useHeadlessGrid, useInlineEdit } from '@alaarab/ogrid-react-radix';

const grid = useHeadlessGrid({ columns, data: employees, getRowId: (r) => r.id });
const edit = useInlineEdit({
  columns,
  getRowId: (r) => r.id,
  onCellEdit: ({ item, columnId, newValue }) =>
    updateRow(item.id, { [columnId]: newValue }),
});

return (
  <Table>
    <TableBody>
      {grid.rows.map((row) => (
        <TableRow key={grid.getRowId(row)}>
          {grid.columns.map((col) => (
            <TableCell
              key={col.columnId}
              onDoubleClick={() => edit.startEdit(row, col.columnId)}
            >
              {edit.isEditing(row, col.columnId) ? (
                <input autoFocus {...edit.getEditorProps(row, col.columnId)} />
              ) : (
                String(grid.getCellValue(row, col.columnId))
              )}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  </Table>
);
```

The hook returns `editingCell`, `pendingValue`, `setPendingValue`, `startEdit`,
`commitEdit`, `cancelEdit`, `isEditing(row, columnId)`, `canEdit(row, columnId)`,
and `getEditorProps(row, columnId)` (which spreads into your input as
`value`/`onChange`/`onBlur`/`onKeyDown` — Enter commits, Escape cancels).

## Range selection — `useRangeSelection`

Excel/Sheets-style anchor + focus range selection. Pure state — consumer
wires their own mouse handlers. Foundation for fill handle and clipboard.

```tsx
const range = useRangeSelection({ rowCount: grid.rows.length, colCount: grid.columns.length });

<TableCell
  onMouseDown={(e) => e.shiftKey ? range.extendRange(rowIdx, colIdx) : range.startRange(rowIdx, colIdx)}
  onMouseEnter={(e) => e.buttons === 1 && range.extendRange(rowIdx, colIdx)}
  data-selected={range.isInRange(rowIdx, colIdx)}
/>
```

Returns `range`, `anchor`, `focus`, `startRange`, `extendRange`, `setRange`,
`clearRange`, `selectAll`, `isInRange`, `getRangeRows`, `getRangeCells`.

## Fill handle — `useFillHandle`

Excel-style drag-to-fill. Builds on `useRangeSelection`. Smart-fill
(numeric series, copy-text, type-compatibility checks) comes from core's
`applyFillValues`.

```tsx
const fill = useFillHandle({
  rangeSelection: range,
  rows: grid.rows,
  columns: grid.columns,
  onFillCells: (events) => events.forEach(applyEdit),
});

// At the bottom-right of the active range:
<div onMouseDown={fill.startFill} />

// On every cell during drag:
<TableCell
  onMouseEnter={() => fill.isFilling && fill.updateFill(rowIdx, colIdx)}
  onMouseUp={fill.commitFill}
  data-fill={fill.isInFillRange(rowIdx, colIdx)}
/>
```

## Copy / cut / paste — `useCellClipboard`

TSV-format clipboard, round-trippable through Excel and Google Sheets.
Honors `clipboardFormatter` for copy and `valueParser` for paste validation.

```tsx
const clipboard = useCellClipboard({
  rangeSelection: range,
  rows: grid.rows,
  columns: grid.columns,
  onCellEdit: (events) => events.forEach(applyEdit),
});

useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key === 'c') clipboard.copyRange();
    if (mod && e.key === 'x') clipboard.cutRange();
    if (mod && e.key === 'v') clipboard.pasteRange();
  };
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}, [clipboard]);
```

## Undo / redo — `useUndoRedo`

Wraps your `onCellEdit` callback with an undo/redo history stack. Pair
with `useInlineEdit`, `useFillHandle`, and `useCellClipboard` to get
spreadsheet-style undo for free.

```tsx
const undo = useUndoRedo({ onCellValueChanged: applyEditToRows });

const edit = useInlineEdit({ columns, getRowId, onCellEdit: undo.onCellValueChanged });
const fill = useFillHandle({ ..., onFillCells: (events) => events.forEach(undo.onCellValueChanged) });
const clipboard = useCellClipboard({ ..., onCellEdit: (events) => events.forEach(undo.onCellValueChanged) });

<button onClick={undo.undo} disabled={!undo.canUndo}>Undo</button>
<button onClick={undo.redo} disabled={!undo.canRedo}>Redo</button>
```

## Theming

Override any `--ogrid-*` variable to customize. The shadcn preset above maps
them to your shadcn tokens (`--card`, `--ring`, `--radius`, `--font-sans`)
automatically.

See the [OGrid docs](https://alaarab.github.io/ogrid/) for the full token
catalog and component reference.
