# @alaarab/ogrid-core

Framework-agnostic types, hooks, and utilities for [OGrid](https://github.com/alaarab/ogrid) data tables.

This package is the shared foundation used by `@alaarab/ogrid-fluent` and `@alaarab/ogrid-material`. You typically don't need to install it directly -- both framework packages re-export everything from core.

## Install

```bash
npm install @alaarab/ogrid-core
```

## What's Included

### Types

- `IColumnDef<T>` -- Column definition with sorting, filtering, and rendering
- `IDataSource<T>` -- Server-side data source interface
- `IFetchParams` -- Parameters for `fetchPage()`
- `IFilters` -- Unified filter values (text, multi-select, people)
- `UserLike` -- Minimal user shape for people picker
- `IColumnFilterDef`, `IColumnMeta`, `IPageResult`, `ColumnFilterType`

### Hooks

- `useOGrid(props, ref)` -- Page/sort/filter/visibleColumns + `dataGridProps` for DataGridTable (used by OGrid wrappers)
- `useDataGridState({ props, wrapperRef })` -- Orchestrator for grid state, selection, editing, clipboard, keyboard, fill handle, status bar
- `useFilterOptions(dataSource, fields)` -- Loads filter options for multi-select columns
- `useColumnHeaderFilterState(params)` -- Headless filter popover state (open, temp values, apply/clear, people search)
- `useColumnChooserState({ columns, visibleColumns, onVisibilityChange })` -- Column visibility dropdown (open, Escape, select all/clear)
- `useInlineCellEditorState({ value, editorType, onCommit, onCancel })` -- Inline cell editor (localValue, keydown, blur/commit)

### Components

- `OGridLayout` -- Layout structure for OGrid: toolbar row (title, toolbar, columnChooser), grid area, pagination. Accepts `containerComponent` and `gap` so Fluent/Material/Radix supply their Container (div or Box).

### Utilities

- `getPaginationViewModel(...)` -- Page numbers, ellipsis, start/end item for PaginationControls
- `getHeaderFilterConfig(col, input)` -- ColumnHeaderFilter props from column + filter/sort state
- `getCellRenderDescriptor(item, col, rowIndex, colIdx, input)` -- Cell mode (editing-inline / editing-popover / display) and flags for DataGridTable
- `toDataGridFilterProps(filters)` -- Splits `IFilters` into `multiSelectFilters`, `textFilters`, `peopleFilters`
- `toUserLike(user)` -- Converts a user-like object to `UserLike`
- `exportToCsv(items, columns, getValue, filename)` -- Full CSV export
- `buildCsvHeader`, `buildCsvRows`, `triggerCsvDownload`, `escapeCsvValue` -- Low-level CSV helpers

## License

MIT
