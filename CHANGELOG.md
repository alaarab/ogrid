# Changelog

All notable changes to OGrid will be documented in this file.

## [1.9.0] – 2026-02-10

### BREAKING CHANGES

- **Grouped `useOGrid` returns** — The hook's flat return object is now organized into 4 logical groups: `pagination`, `columnChooser`, `layout`, `filters`. The `dataGridProps` field is unchanged.
  ```typescript
  // Before (1.8.x)
  const { page, setPage, pageSize, ... } = useOGrid(props, ref);
  // After (1.9.0)
  const { dataGridProps, pagination, columnChooser, layout, filters } = useOGrid(props, ref);
  pagination.page;  pagination.setPage(2);
  columnChooser.columns;  columnChooser.onVisibilityChange('col', true);
  ```
  Renamed: `columnChooserColumns` → `columnChooser.columns`, `handleVisibilityChange` → `columnChooser.onVisibilityChange`, `columnChooserPlacement` → `columnChooser.placement`.

- **`useKeyboardNavigation` params restructured** — Flat params object replaced with 4 groups: `data`, `state`, `handlers`, `features`. Internal change — only affects direct hook consumers (not OGrid/DataGridTable users).

- **`useUndoRedo` param renamed** — `maxHistory` → `maxUndoDepth` (default raised from 50 to 100). Result now also exposes `maxUndoDepth`.

### Added

- **New `IOGridApi` methods** — 5 new methods on the grid API ref:
  - `clearFilters()` — Remove all active filters.
  - `clearSort()` — Reset to default sort field/direction.
  - `resetGridState(options?)` — Clear filters, sort, and selection in one call. Pass `{ keepSelection: true }` to preserve row selection.
  - `getDisplayedRows()` — Returns the currently visible (post-filter/sort/paginate) rows.
  - `refreshData()` — Re-trigger server-side data fetch (no-op for client-side).

- **Filter sub-hooks** — `useColumnHeaderFilterState` decomposed into 4 composable sub-hooks, each independently exported:
  - `useTextFilterState` — Text filter temp value and apply/clear.
  - `useMultiSelectFilterState` — Multi-select checkboxes, search, select/clear all.
  - `usePeopleFilterState` — People search with debounce, suggestions, select/clear.
  - `useDateFilterState` — Date range from/to temp values, apply/clear.

- **`useLatestRef` utility hook** — Generic hook that keeps a ref synced to the latest value. Eliminates boilerplate 2-line `useRef` + assignment pattern across all UI packages.

- **`UseOGridPagination`, `UseOGridColumnChooser`, `UseOGridLayout`, `UseOGridFilters`** — New exported sub-interfaces for the grouped `useOGrid` return type.

- **234 new tests** (total: **755** across all packages — Core: 479, Radix: 92, Fluent: 92, Material: 92). New test suites:
  - `useTextFilterState.test.ts`, `useMultiSelectFilterState.test.ts`, `usePeopleFilterState.test.ts`, `useDateFilterState.test.ts`
  - `useColumnChooserState.test.ts`, `useColumnResize.test.ts`, `useInlineCellEditorState.test.ts`
  - `clientSideData.test.ts`, `paginationHelpers.test.ts`, `ogridHelpers.test.ts`, `dataGridStatusBar.test.ts`, `gridContextMenuHelpers.test.ts`

- **`pageSizeOptions` prop** on `IOGridProps` — Customizable page size dropdown options (default `[10, 25, 50, 100]`). Active page size is auto-inserted if missing.

### Improved

- **`dataGridProps` memoized** — `useOGrid` now wraps `dataGridProps` in `useMemo`, preventing unnecessary re-renders of `DataGridTable` when only pagination or column chooser state changes.

- **`useDataGridState` sub-objects memoized** — Each of the 6 return groups (`layout`, `rowSelection`, `editing`, `interaction`, `contextMenu`, `viewModels`) is individually `useMemo`-ized, so consumers only re-render when their specific slice changes.

- **Stable `handleGridKeyDown`** — `useKeyboardNavigation` now reads params from a ref instead of closing over 20+ values. The returned handler is a single stable callback (no dependency array churn).

- **Client-side filtering: single-pass predicate pipeline** — `processClientSideData` builds a predicate array and runs one `.filter()` pass instead of N sequential `.filter()` calls (one per column). Reduces allocations for grids with many filtered columns.

- **`buildHeaderRows` leaf count caching** — Uses a `Map` cache to avoid O(n^2) repeated subtree traversals for deeply nested column groups.

- **`useFilterOptions` stable deps** — `fields` array sorted+joined into a `useMemo` string key instead of inline `.slice().sort().join()` in the dependency array.

- **Stable empty-object references** — `EMPTY_LOADING_OPTIONS` constant avoids creating `{}` on every render for `loadingFilterOptions`.

- **`useLatestRef` across all UI packages** — Replaced 7+ manual `useRef`+assignment pairs per DataGridTable with `useLatestRef(value)` one-liners. Reduces boilerplate and ensures consistency.

- **Inline style hoisting** — All three InlineCellEditor components hoist rich-select styles (wrapper, dropdown, option, highlight, no-matches) to module-scope constants. Eliminates per-render object allocation.

- **Material DataGridTable sx hoisting** — Loading overlay, empty state, table wrapper, and inner loading box sx objects moved to module-scope constants.

- **Fluent row className optimization** — Replaced `.filter(Boolean).join(' ')` with template literal concatenation for row class computation.

- **Material fill handle / selection CSS vars** — Hardcoded colors (`#217346`, `#fff`) replaced with CSS custom properties (`--ogrid-selection`, `--ogrid-bg`, `--ogrid-bg-range`) for theme consistency.

- **MarchingAntsOverlay deduplication** — Keyframe injection checks for existing `<style id="ogrid-marching-ants-keyframes">` element instead of module-scope boolean, preventing issues with multiple OGrid instances or HMR.

- **`useOGrid` return sub-objects memoized** — `pagination`, `columnChooser`, `layout`, and `filters` return groups are each individually `useMemo`-ized. Previously they were plain objects recreated every render, defeating the grouping benefit.

- **`useClipboard` stable callbacks** — `handleCopy`, `handleCut`, and `handlePaste` now use `useLatestRef` for volatile dependencies (`items`, `visibleCols`, `selectionRange`, `activeCell`, `editable`, `onCellValueChanged`). Callbacks no longer recreate when data or selection changes — only `colOffset`, `beginBatch`, and `endBatch` remain as true deps.

- **`GridContextMenu` useMemo fix** — The handler memoization was using `[props]` as the dependency, which always changes (object identity). Now destructures individual handler props as deps, so handlers are only recomputed when actual callbacks change.

- **`SideBar` inline style hoisting** — ~20 inline style objects (tab strip, buttons, panels, filters, checkboxes) hoisted to module-scope constants. Eliminates per-render object allocation for every sidebar render.

- **`OGridLayout` rootStyle hoisted** — Root container style moved from inline to module scope.

- **Stable context menu props (all 3 UI packages)** — `onUndo`/`onRedo` fallbacks use module-scope `NOOP` instead of inline `() => {}`. `onPaste` wrapper uses `useCallback` (`handlePasteVoid`) instead of inline arrow function.

- **`commitCellEdit` stable callback** — `useDataGridState`'s `commitCellEdit` now reads `visibleCols` and `items.length` via `useLatestRef` instead of closing over them. The callback no longer recreates when columns or data change, which keeps the `editingState` memo group stable.

- **Client-side multiSelect filter: Set lookup** — `processClientSideData` multiSelect filter now uses `Set.has()` (O(1)) instead of `Array.includes()` (O(n)) per row. Significant for grids with many filter options.

- **`MarchingAntsOverlay` animation style hoisted** — Static marching ants CSS animation object moved to module scope.

- **`useColumnResize` cleanup on unmount** — Drag event listeners are now properly removed if the component unmounts mid-resize.

- **`mergeFilter` people filter cleanup** — Empty people filter values are now correctly removed from the filter object.

- **`ensurePageSizeInOptions`** — Pagination helper auto-inserts the active page size into the options list if it's not already present, preventing a missing option when `defaultPageSize` doesn't match standard options.

### Fixed

- **Fluent filter popover positioning** — Replaced manual `position: fixed` popover with Fluent UI's native `Popover`/`PopoverSurface` component. The filter dropdown was rendering far from the header when the grid was inside a scrollable container (e.g. SPFx web parts). Removed `Tooltip` wrapper around column name (was causing layout issues).

- **Page scroll on cell click** — Replaced `scrollIntoView()` with manual wrapper-only scroll math that only scrolls the grid container, not ancestor containers or the page. All `focus()` calls use `{ preventScroll: true }`.

- **Fluent hardcoded link colors** — Replaced `#0f6cbd`/`#115ea3`/`#0c3b5e` with Fluent design tokens (`--colorBrandForeground1`, etc.) for proper dark mode support.

- **Fill handle border color** — Radix and Fluent fill handle border changed from hardcoded `#fff` to `var(--ogrid-bg, #fff)`.

### Changed

- **Package READMEs** — All 4 package READMEs updated with feature highlights, AG Grid comparison table, and links to full documentation.

- **Docs improvements** — All feature doc pages (column-chooser, column-groups, column-pinning, editing, filtering, pagination, sorting) updated with richer examples showing numeric types, value formatters, rich select editors, and `defaultPageSize`/`pageSizeOptions`. Homepage hero grid now showcases rich select editors, date editing, and sidebar panel.

- **Fluent mock updated** — Added `Popover` and `PopoverSurface` mocks for the new filter popover implementation.

---

## [1.8.x] – 2026-02-10

### 1.8.2
- **DataGrid row rendering optimization** — Memoized row components to reduce unnecessary re-renders during cell selection and drag operations.

### 1.8.1
- Version bump with minor fixes.

### 1.8.0
- **Drag-selecting state** — `isDragging` flag in `DataGridCellInteractionState`.
- **`isRowInRange` utility** — Row-level selection range check for render optimization.
- **Mobile touch support** — Touch events for cell drag-selection and fill handle.
- **Memoized row rendering** — All three UI packages use memoized row components.

---

## [1.7.2] – 2026-02-10

### Improved

- **DataGridTable performance** — Added memoization across all three UI packages for row rendering and cell interaction.
- **Story consistency** — OGrid stories updated with consistent title wrapping.

### Changed

- **Material peer deps** — Updated to require MUI v7 (`@mui/material ^7.0.0`).

---

## [1.7.0] – 2026-02-09

### Added

- **`toolbarBelow` prop** — New slot on `OGrid` and `OGridLayout` for a secondary toolbar row below the primary toolbar (e.g. filter chips, breadcrumbs).

### Changed

- **Removed deprecated exports** — `FluentDataTable` and `IFluentDataTableProps` removed from Fluent package exports. Use `OGrid` instead.
- **Story refactor** — DataGridTable stories across all three UI packages updated to use unified `filters` prop and `onFilterChange`.
- **Simplified Material/Fluent internals** — `MaterialDataTable` and `FluentDataTable` components streamlined to remove deprecated types.

---

## [1.6.0] – 2026-02-09

### BREAKING CHANGES

- **FilterValue discriminated union** — `IFilters` values are now typed discriminated unions instead of raw values. All filter values must specify their `type`:
  ```typescript
  // Before (1.5.x)
  { status: ['Active', 'Closed'], name: 'Alice' }
  // After (1.6.0)
  { status: { type: 'multiSelect', value: ['Active', 'Closed'] }, name: { type: 'text', value: 'Alice' } }
  ```
  Supported types: `{ type: 'text', value: string }`, `{ type: 'multiSelect', value: string[] }`, `{ type: 'people', value: UserLike }`, `{ type: 'date', value: IDateFilterValue }`.

- **Unified filter API on DataGridTable** — `IOGridDataGridProps` now uses `filters: IFilters` + `onFilterChange: (key, value) => void` instead of the 8 split filter props (`multiSelectFilters`, `textFilters`, `peopleFilters`, `dateFilters` and their onChange handlers). This does NOT affect `OGrid` consumers — only direct `DataGridTable` users.

- **Grouped `useDataGridState` returns** — The hook's return object is now organized into 6 logical groups instead of 42 flat properties:
  - `layout` — column structure, sizing, container dimensions
  - `rowSelection` — selected rows, selection handlers
  - `editing` — cell editing state, commit/cancel
  - `interaction` — active cell, selection range, keyboard, clipboard, fill handle, undo/redo
  - `contextMenu` — menu position, handlers (note: `contextMenu` position renamed to `menuPosition`)
  - `viewModels` — headerFilterInput, cellDescriptorInput, statusBarConfig, showEmptyInGrid

- **Removed deprecated props** — `title`, `gap`, and `columnChooser` removed from `OGridLayout`. Consumers should render titles outside `<OGrid>` and use `toolbarEnd` for column chooser placement.

- **Removed `toDataGridFilterProps`** — This helper was replaced by the unified filter API; use `filters`/`onFilterChange` directly.

### Added

- **`processClientSideData` utility** — Pure function extracted from `useOGrid` for client-side filtering and sorting. Can be used independently for custom data processing pipelines.
- **Wildcard re-exports** — All three UI packages now use `export * from '@alaarab/ogrid-core'` instead of cherry-picked re-export lists. Every core type is automatically available from any UI package import.
- **Grouped state sub-interfaces** — `DataGridLayoutState`, `DataGridRowSelectionState`, `DataGridEditingState`, `DataGridCellInteractionState`, `DataGridContextMenuState`, `DataGridViewModelState` are exported for consumers building custom grid wrappers.

### Fixed

- **Material InlineCellEditor auto-focus** — Added `useEffect` auto-focus matching Radix/Fluent behavior.

### Improved

- **Phase 2: Descriptor-to-component pattern** — All three UI packages now use the full suite of 6 core helpers (`getCellRenderDescriptor`, `buildInlineEditorProps`, `buildPopoverEditorProps`, `getCellInteractionProps`, `resolveCellDisplayContent`, `resolveCellStyle`). Each package's `renderCellContent` is now a thin ~50-line mapping from descriptors to framework-specific JSX.

---

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

## [1.3.2] – 2026-02-09

### Fixed

- **Pinned column sticky positioning** — Radix: boosted SCSS specificity with `.dataTable` qualifier to override `position: relative` on `th`/`td`. Fluent/Material: applied sticky `left`/`right` positioning to both header and body cells for pinned columns.

### Improved

- **Drag selection performance** — Bypassed React state during mouse drag using refs + `requestAnimationFrame` + DOM `data-drag-range` attributes for visual feedback. React state committed only on mouseup (single re-render). Same pattern applied to `useFillHandle`.

---

## [1.3.1] – 2026-02-09

### Changed

- **Default layout mode** — `useOGrid` default `layoutMode` changed from `'content'` to `'fill'` for consistency with DataGridTable.
- **Batch processing** — Clipboard, fill handle, and undo/redo hooks now support batch operations (`beginBatch`/`endBatch`) for grouped edits.

### Improved

- **Cell selection** — Enhanced selection and clipboard handling, improved checkbox styling.

---

## [1.3.0] – 2026-02-09

### Added

- **Marching Ants Overlay** — `MarchingAntsOverlay` component for visual feedback on selection and copy/cut ranges (animated dashed border).
- **Value Parsers** — Utility functions for parsing various data types: `parseNumber`, `parseCurrency`, `parseDate`, `parseEmail`, `parseBoolean` with unit tests.
- **Context Menu Enhancements** — Undo/redo actions with keyboard shortcut labels displayed in context menu.

### Improved

- **Clipboard** — Enhanced copy/cut/paste with proper range tracking and marching ants visual feedback.
- **Keyboard navigation** — Additional keybindings and improved cell navigation.

---

## [1.2.2] – 2026-02-09

### Changed

- **`getRowId` type widened** — Return type changed from `string` to `string | number`.
- **`sortBy` made optional** — `sortBy` is now optional in `IOGridDataGridProps` (was required).

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
