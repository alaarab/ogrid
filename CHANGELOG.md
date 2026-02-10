# Changelog

All notable changes to OGrid will be documented in this file.

## [1.5.0] – 2026-02-09

### Added

- **Side Bar** — Toggle-able side panel with `sideBar` prop (`boolean | ISideBarDef`). Includes two panels:
  - **Columns Panel** — Show/hide column visibility with checkboxes, Select All / Clear All buttons
  - **Filters Panel** — Inline filter controls (text, multiSelect, date range, people) per filterable column
- **Column State Persistence API** — Save and restore complete grid state with `getColumnState()` and `applyColumnState(state)` on `IOGridApi`. State includes:
  - `columnOrder`, `columnWidths`, `filters`, `pinnedColumns`, `visibleColumns`, `sort`
  - New callbacks: `onColumnResized(columnId, width)`, `onColumnPinned(columnId, pinned)`
  - `initialColumnWidths` and `pinnedColumns` props on `IOGridDataGridProps` for declarative initialization
- **Multi-Row Grouped Column Headers** — `buildHeaderRows()` utility handles arbitrary nesting depth. `IColumnGroupDef` with `headerName` and `children`. All three UI packages render multi-row `<thead>` with `.groupHeaderCell` styling.
- **Built-in Column Types** — Extended `IColumnMeta.type` to `'text' | 'numeric' | 'date' | 'boolean'`:
  - **Date type**: Auto-formats via `toLocaleDateString()`, date range filter (from/to), chronological sorting, native `<input type="date">` editor
  - **Boolean type**: Displays `True`/`False`, center-aligned, defaults to checkbox editor
- **Rich Select Editor** — New `cellEditor: 'richSelect'` with searchable dropdown. Headless `useRichSelectState` hook (search, filter, keyboard nav). All three UI packages implement the dropdown with inline search.
- **Status Bar Aggregation** — `computeAggregations()` utility calculates `sum`, `avg`, `min`, `max`, `count` for numeric selected cells. Rendered in StatusBar when selection range exists.
- **Ctrl+Arrow Excel-Style Navigation** — Ctrl+Up/Down/Left/Right jumps to data region edges (Excel behavior):
  - Non-empty + non-empty neighbor → scan to last non-empty before gap/edge
  - Empty or empty neighbor → skip empties to next non-empty or edge
  - Ctrl+Shift+Arrow extends selection to the same target
- **Unified Grid Layout** — `OGridLayout` wraps everything in a single bordered container:
  - **Toolbar strip**: `toolbar` (custom ReactNode, left) + `toolbarEnd` (column chooser, right)
  - **Footer strip**: Pagination controls inside bordered container
  - **Column chooser placement**: `columnChooser` prop (`boolean | 'toolbar' | 'sidebar'`) controls where column chooser renders
  - `title` prop deprecated (renders above container for backward compat)
- **Undo/Redo Context Menu** — Context menu items for Undo/Redo with keyboard shortcut labels (Ctrl+Z/Y, ⌘ on Mac). `canUndo`/`canRedo` boolean props on `IOGridProps` and `IOGridDataGridProps`.
- **521 tests** across all packages (Core: 245, Radix: 92, Fluent: 92, Material: 92).

### Changed

- **Cell Selection Colors** — Selection colors changed from blue (#0066cc) to Excel green (#217346) via `--ogrid-selection` CSS variable
- **Drag Selection Performance** — Eliminated 60-120Hz re-renders during drag selection. During drag, bypass React state entirely using refs + `requestAnimationFrame` + DOM attribute toggling (`data-drag-range`). React state only committed on mouseup (single re-render). Same optimization applied to fill handle.
- **Context Menu Behavior** — Context menu now only appears on cell right-click (not wrapper/headers/empty space). `useContextMenu.handleCellContextMenu` now calls `preventDefault()` on the event.
- **useOGrid Layout Mode** — Default `layoutMode` changed from `'content'` to `'fill'` for consistency with DataGridTable
- **Clipboard Copy** — `useClipboard.handleCopy` now uses `col.valueFormatter` before `String()` conversion, fixing `[object Object]` output for complex types like `UserLike`
- **DataGridTable Styling** — Removed outer `border` and `border-radius` from DataGridTable components (OGridLayout provides the container border)

### Fixed

- **Cell Click Target** — Padding moved from `<td>` to `.cellContent` div so entire cell is clickable
- **Batch Visibility Bug** — Select All / Clear All in side bar now use `onSetVisibleColumns(Set)` instead of per-column `onVisibilityChange` to avoid stale closure batching bugs

---

## [1.2.0] – 2026-02-08

### Added

- **Radix UI package** (`@alaarab/ogrid`) — Lightweight default implementation using Radix primitives and native HTML. Same feature set as Fluent and Material.
- **Spreadsheet features** — Cell range selection, copy/cut/paste (TSV), fill handle, context menu (Shift+F10), keyboard navigation, undo/redo, row selection, status bar.
- **Shared test factories** — `core/src/testing/` contains `createDataGridTableTests`, `createColumnHeaderFilterTests`, `createOGridTests`, `createSpreadsheetTests`, `createColumnChooserTests`, `createPaginationControlsTests`. UI package tests are 5-line wrappers calling these factories, ensuring feature parity.
- **266 tests** across all packages (Core: 86, Radix: 60, Fluent: 60, Material: 60).
- **Headless state hooks** in core — `useDataGridState`, `useColumnHeaderFilterState`, `useColumnChooserState`, `useInlineCellEditorState`. UI packages are thin view layers.
- **Core utilities** — `getPaginationViewModel`, `getHeaderFilterConfig`, `getCellRenderDescriptor`, `getStatusBarParts`, `getContextMenuHandlers`.
- **Headless components** — `OGridLayout`, `StatusBar`, `GridContextMenu` in core.

### Fixed

- **Infinite re-render** in `useColumnHeaderFilterState` — Destructuring defaults (`selectedValues = []`, `options = []`) created new array references on every render, triggering infinite `useEffect` cycles when the popover was open.
- **Material popover not opening in tests** — `Popover open` was gated on `!!popoverPosition` (set via `setTimeout(0)`), preventing the popover from rendering synchronously. Aligned with Radix/Fluent pattern.

### Changed

- **Test architecture** — Eliminated ~3,000 lines of duplicated test code across UI packages. All UI tests now delegate to shared factories in core.
- **Core build** — `tsconfig.json` excludes `**/testing/**` from production build (testing files use jest globals).

---

## [1.1.0] – 2026-02-07

### Added

- **Cell editing (P0)** — Inline editing with `onCellValueChanged`; built-in editors: `text`, `select` (with `cellEditorParams.values`), `checkbox`. Column-level `editable` and `cellEditor` on `IColumnDef`; optional `cellEditorParams`. Fluent: inline `Input`/`Select`/`Checkbox`; Material: `editable` + `processRowUpdate` with `singleSelect`/`valueOptions`.
- **Custom popup editors (P0)** — `cellEditorPopup` on column def; custom React component as `cellEditor` rendered in Popover (Fluent) or Popover (Material). `ICellEditorProps` with `value`, `onValueChange`, `onCommit`, `onCancel`, `item`, `column`, `cellEditorParams`.
- **Value getters / formatters (P0)** — `valueGetter` and `valueFormatter` on `IColumnDef`; core `getCellValue()`; used for filtering, sorting, and display when no `renderCell`.
- **Cell styles (P0)** — `cellStyle` on `IColumnDef` (static or `(item) => CSSProperties`); applied in both Fluent and Material DataGridTable cell rendering.
- **Column groups (P0)** — `IColumnGroupDef` with `headerName` and `children`; core `flattenColumns()`; `columns` prop accepts flat or tree. Fluent: single header row from flattened columns; Material: `columnGroupingModel` for multi-row group headers.
- **Dynamic columns (P0)** — Column change handling: Fluent clears sizing overrides for removed columns; DynamicColumns story (Fluent + Material) toggles column set.
- **Grid API (P0)** — `IOGridApi<T>` with `setRowData`, `setLoading`, `getColumnState`, `setFilterModel`. OGrid (Fluent + Material) uses `forwardRef` + `useImperativeHandle`; optional `isLoading` prop; internal data/loading state when using API without controlled props.

### Changed

- **OGrid** — Now a `forwardRef` component; pass a ref to access `IOGridApi`. When neither `data` nor `dataSource` is provided, grid uses internal data (empty by default); `setRowData` updates it.

---

## [1.0.0] – 2026-02-07

### Added

- **Monorepo restructure** -- Project rebranded from `@alaarab/fluent-data-table` to **OGrid** with three packages:
  - `@alaarab/ogrid-core` -- Framework-agnostic types (`IColumnDef`, `IDataSource`, `IFilters`, `UserLike`), hooks (`useFilterOptions`), and utilities (`exportToCsv`, `toDataGridFilterProps`, `toUserLike`).
  - `@alaarab/ogrid-fluent` -- Fluent UI implementation (FluentDataTable, DataGridTable, ColumnHeaderFilter, ColumnChooser, PaginationControls).
  - `@alaarab/ogrid-material` -- Material UI implementation using `@mui/x-data-grid` (MaterialDataTable, DataGridTable, ColumnHeaderFilter, ColumnChooser, PaginationControls).
- **React 17 + 18 support** -- Peer dependencies allow `react ^17.0.0 || ^18.0.0`.
- **Storybook** -- Per-package Storybook instances (Fluent on port 6006, Material on port 6007).
- **Example apps** -- Vite-powered example apps for both Fluent and Material in `packages/examples/`.
- **74 tests** across all packages (20 core, 33 fluent, 21 material).

### Migration from `@alaarab/fluent-data-table`

Replace imports:

```diff
- import { FluentDataTable, type IColumnDef, ... } from '@alaarab/fluent-data-table';
+ import { FluentDataTable, type IColumnDef, ... } from '@alaarab/ogrid-fluent';
```

All types, hooks, and utilities are re-exported from `@alaarab/ogrid-fluent` for backward compatibility. No API changes -- just the package name.

---

## Pre-OGrid History (`@alaarab/fluent-data-table`)

### [1.2.2] – 2025-02-05

- Version bump.

### [1.2.1] – 2025-02-05

- `useFilterOptions` accepts `IDataSource<T>` directly (no adapter needed).
- `FluentDataTable` passes `dataSource` directly to `useFilterOptions`.
- Removed `IDataGridDataSource`, `IDataGridQueryParams`, `toLegacyFilters`.
- Added `DataGridTable` `isLoading` and `loadingMessage` overlay.

### [1.2.0]

- Single `IDataSource<T>` and unified `IFilters`; client-side (`data`) and server-side (`dataSource`).
- `IFetchParams`, `IPageResult`, `toDataGridFilterProps`, `toUserLike`.
- Optional controlled mode: `page`, `sort`, `filters`, `visibleColumns` and `on*` callbacks.
