# Vue Parity Audit Report

**Date:** 2026-02-12
**Auditor:** Claude Opus 4.6 (automated parity audit)
**Scope:** All 4 Vue packages vs their React reference implementations

---

## Summary Table

| Package | React Equivalent | Completeness | Tests | Severity |
|---------|------------------|-------------|-------|----------|
| `vue` (composables) | `react` (hooks) | **~93%** | 4 tests (React has 247) | P1 |
| `vue-vuetify` (UI) | `react-radix` (UI) | **~85%** | 1 test (React has 92) | P1 |
| `vue-primevue` (UI) | `react-material` (UI) | **~85%** | 1 test (React has 92) | P1 |
| `vue-radix` (UI) | `react-radix` (UI) | **~60%** | 1 test (React has 92) | P0 |

---

## Detailed Findings

### P0 - Critical (Blocking for production use)

#### P0-1: `vue` package missing `useColumnPinning` composable
- **React:** `/home/alaarab/ogrid/packages/react/src/hooks/useColumnPinning.ts` (141 lines)
- **Vue:** Does not exist. No file, no export, no reference anywhere in `packages/vue/src/`.
- **Impact:** The `useDataGridState` composable in Vue cannot expose the `pinning` sub-object. This means Vue UI packages have no programmatic column pinning API (pin left/right, compute sticky offsets). The React `useDataGridState` returns a `pinning: DataGridPinningState` with full pin/unpin/offset computation. Vue's `UseDataGridStateResult` interface is missing the `pinning` field entirely.
- **Files affected:**
  - `/home/alaarab/ogrid/packages/vue/src/composables/useDataGridState.ts` lines 105-112 (missing `pinning` in result type)
  - `/home/alaarab/ogrid/packages/vue/src/composables/index.ts` (no export for `useColumnPinning`)

#### P0-2: `vue` package missing `useColumnHeaderMenuState` composable
- **React:** `/home/alaarab/ogrid/packages/react/src/hooks/useColumnHeaderMenuState.ts` (88 lines)
- **Vue:** Does not exist.
- **Impact:** The column header context menu (pin left/right/unpin) has no state management in Vue. React's DataGridTable renders a `<ColumnHeaderMenu>` component using this hook's state. Neither vue-vuetify, vue-primevue, nor vue-radix have a ColumnHeaderMenu component at all.
- **Files affected:** Same as P0-1.

#### P0-3: No `ColumnHeaderMenu` component in any Vue UI package
- **React-radix:** `/home/alaarab/ogrid/packages/react-radix/src/ColumnHeaderMenu/ColumnHeaderMenu.tsx` (renders pin left/right/unpin menu)
- **Vue-vuetify, vue-primevue, vue-radix:** No `ColumnHeaderMenu` directory or component exists.
- **Impact:** Users cannot right-click a column header to pin/unpin columns in any Vue UI package. This is a visible feature gap.

#### P0-4: `vue-radix` DataGridTable does NOT use `getHeaderFilterConfig` utility
- **React-radix:** `/home/alaarab/ogrid/packages/react-radix/src/DataGridTable/DataGridTable.tsx` line 425: `<ColumnHeaderFilter {...getHeaderFilterConfig(col, headerFilterInput)} />`
- **Vue-vuetify:** Uses it correctly at `/home/alaarab/ogrid/packages/vue-vuetify/src/DataGridTable/DataGridTable.ts` line 424
- **Vue-radix:** `/home/alaarab/ogrid/packages/vue-radix/src/DataGridTable/DataGridTable.vue` lines 199-207 manually passes props to ColumnHeaderFilter using stale non-standard property names (`columnKey`, `columnName`, `filterType`, `isSorted`, `isSortedDescending`, `onSort`). It does NOT use the shared `getHeaderFilterConfig` utility.
- **Impact:** The vue-radix ColumnHeaderFilter receives incorrect/incomplete props. It bypasses the headless utility and instead reads from `cell.column` properties that don't match the headless API (e.g., `cell.column.isSorted` doesn't exist on `IColumnDef`). Filters likely do not function correctly.

#### P0-5: `vue-radix` DataGridTable has broken template logic
- **File:** `/home/alaarab/ogrid/packages/vue-radix/src/DataGridTable/DataGridTable.vue`
- **Issues found:**
  1. **Line 69-77: `getCellRenderData` uses non-existent `descriptor.renderMode` and `descriptor.editorProps`** -- The `CellRenderDescriptor` type from the core utility uses `descriptor.mode` (values: `'display'`, `'editing-inline'`, `'editing-popover'`), not `descriptor.renderMode`. The `editorProps` field also does not exist on the descriptor. This means inline editors never render.
  2. **Line 99-115: `getCellStyle` passes wrong arguments to `getCellRenderDescriptor`** -- It passes `(col, {}, rowIndex, colIndex, ...)` but the function signature expects `(item, col, rowIndex, colIndex, ...)`. The item and col arguments are swapped, and an empty object is passed as the item.
  3. **Line 99: `getColumnWidth` called with `col.columnId`** -- But `getColumnWidth` from `useColumnResize` expects a column object, not a string. Vue-vuetify correctly passes the column object.
  4. **Line 190: `getColumnWidth(cell.column.columnId)`** -- Same issue in header. Should be `getColumnWidth(cell.column)`.
  5. **Line 214: `handleResizeStart(e, cell.column!.columnId)`** -- Should be `handleResizeStart(e, cell.column!)` (expects column object).
  6. **Line 221:** The `<tbody>` iterates `gridProps.items` directly without virtual scroll support. The `visibleRange`, `virtualScrollEnabled`, and `totalHeight` are destructured in setup but never used in the template.
  7. **Line 127:** `wrapperRef` is set via a template ref string `"wrapperRef"` but the composable already creates its own `wrapperRef`. The template should bind to the composable's ref, not create a separate one. The scroll container and keyboard handler wrapper are on different elements (lines 128 vs 136), which breaks keyboard navigation.
  8. **Line 283-284:** Custom render function for empty state has empty `<div v-if="gridProps.emptyState.render">` but never actually calls the render function.

#### P0-6: `vue-radix` has 0 functional tests
- **React-radix:** 92 tests across 8 test files (ColumnChooser, ColumnHeaderFilter, DataGridTable, OGrid, PaginationControls, sideBar, spreadsheet, columnGroups)
- **Vue-radix:** 1 test file (`exports.test.ts`) with 8 basic `expect(mod.X).toBeDefined()` assertions
- **Impact:** No behavioral verification. The template bugs described in P0-5 would be caught by any integration test.

---

### P1 - Important (Feature gaps that affect completeness)

#### P1-1: `vue` package missing `DataGridPinningState` in `useDataGridState` result
- **React:** `UseDataGridStateResult<T>` has 7 sub-objects: `layout`, `rowSelection`, `editing`, `interaction`, `contextMenu`, `viewModels`, `pinning`
- **Vue:** `UseDataGridStateResult<T>` at `/home/alaarab/ogrid/packages/vue/src/composables/useDataGridState.ts` lines 105-112 has only 6 sub-objects -- missing `pinning`.
- **Impact:** No UI package can render column pinning UI (sticky left/right offsets, pin/unpin menu).

#### P1-2: Missing `density` prop in Vue types and rendering
- **React:** `IOGridDataGridProps` includes `density?: 'compact' | 'normal' | 'comfortable'` (lines 219-220 of `/home/alaarab/ogrid/packages/react/src/types/dataGridTypes.ts`). React-radix DataGridTable applies `styles[density-${density}]` CSS class.
- **Vue:** `IOGridDataGridProps` at `/home/alaarab/ogrid/packages/vue/src/types/dataGridTypes.ts` does not include a `density` prop. No Vue UI package references density in its DataGridTable template/render.
- **Impact:** Users cannot configure cell spacing in any Vue grid.

#### P1-3: Missing `columnReorder` prop in Vue types
- **React:** `IOGridProps` and `IOGridDataGridProps` both have `columnReorder?: boolean`.
- **Vue:** `IOGridBaseProps` at `/home/alaarab/ogrid/packages/vue/src/types/dataGridTypes.ts` does not include `columnReorder`. The `useOGrid` composable doesn't pass it through to `dataGridProps`.
- **Impact:** Column reorder is technically wired via `useDataGridTableSetup` but the prop pathway from OGrid is incomplete. Works when using DataGridTable directly but not through OGrid.

#### P1-4: Missing `showRowNumbers` rendering in vue-vuetify and vue-radix DataGridTable
- **Vue useDataGridState:** Correctly computes `hasRowNumbersCol` at `/home/alaarab/ogrid/packages/vue/src/composables/useDataGridState.ts` line 180
- **Vue-vuetify DataGridTable:** `/home/alaarab/ogrid/packages/vue-vuetify/src/DataGridTable/DataGridTable.ts` renders row number header and cells correctly.
- **Vue-radix DataGridTable:** `/home/alaarab/ogrid/packages/vue-radix/src/DataGridTable/DataGridTable.vue` does NOT render row number columns at all. No `<td>` or `<th>` for row numbers in the template.

#### P1-5: SideBar not rendered in OGrid components (vue-vuetify, vue-primevue)
- **React-radix:** OGrid renders SideBar via `OGridLayout` which handles the sidebar panel alongside the DataGridTable.
- **Vue-vuetify OGrid:** `/home/alaarab/ogrid/packages/vue-vuetify/src/OGrid/OGrid.ts` line 24 computes `_sideBar = layout.value.sideBarProps` but never uses it. The sidebar is never rendered.
- **Vue-primevue OGrid:** Same issue (identical code).
- **Impact:** Users who set `sideBar: true` will see no sidebar. Column chooser in sidebar mode (`columnChooser: 'sidebar'`) is broken.

#### P1-6: Missing `CellErrorBoundary` equivalent in Vue
- **React:** `/home/alaarab/ogrid/packages/react/src/components/CellErrorBoundary.tsx` wraps every cell in an error boundary to prevent a single cell crash from taking down the grid.
- **React-radix DataGridTable:** Line 320: `<CellErrorBoundary key={...} onError={onCellError}>{content}</CellErrorBoundary>`
- **Vue:** No `CellErrorBoundary` component exists. None of the Vue UI packages wrap cell content in any error handling.
- **Impact:** A runtime error in a custom cell renderer or editor will crash the entire grid.

#### P1-7: Missing `DRAG_ANCHOR_ATTR` in Vue `useCellSelection`
- **React:** `/home/alaarab/ogrid/packages/react/src/hooks/useCellSelection.ts` lines 31-32 use both `DRAG_ATTR` and `DRAG_ANCHOR_ATTR` for drag selection visual feedback. The anchor cell gets a white background via `data-drag-anchor`, and edge borders via inset box-shadows (lines 172-177).
- **Vue:** `/home/alaarab/ogrid/packages/vue/src/composables/useCellSelection.ts` lines 113-132 only uses `DRAG_ATTR`. No `DRAG_ANCHOR_ATTR`, no edge borders (box-shadow), no anchor styling.
- **Impact:** During drag selection, the visual feedback is incomplete -- no anchor cell highlighting and no green border around the live drag range.

#### P1-8: Massive test deficit across all Vue packages
- **Vue core composables:** 4 tests (exports, useDebounce, useOGrid, useRowSelection) vs React's 247 tests covering all hooks
- **Vue-vuetify:** 1 test file (exports only) vs React-radix's 92 tests
- **Vue-primevue:** 1 test file (exports only) vs React-material's 92 tests
- **Vue-radix:** 1 test file (exports only) vs React-radix's 92 tests
- **Missing Vue composable test coverage:**
  - `useActiveCell` (React has tests)
  - `useCellEditing` (React has tests)
  - `useCellSelection` (React has tests)
  - `useClipboard` (React has tests)
  - `useColumnChooserState` (React has tests)
  - `useColumnResize` (React has tests)
  - `useContextMenu` (React has tests)
  - `useDataGridState` (React has tests)
  - `useDateFilterState` (React has tests)
  - `useFillHandle` (React has tests)
  - `useFilterOptions` (React has tests)
  - `useInlineCellEditorState` (React has tests)
  - `useKeyboardNavigation` (React has tests)
  - `useMultiSelectFilterState` (React has tests)
  - `usePeopleFilterState` (React has tests)
  - `useRichSelectState` (React has tests)
  - `useSideBarState` (React has tests)
  - `useTextFilterState` (React has tests)
  - `useUndoRedo` (React has tests)

---

### P2 - Nice-to-Have (Minor gaps, polish issues)

#### P2-1: Vue `useCellEditing` has extra `params` signature not in React
- **Vue:** `/home/alaarab/ogrid/packages/vue/src/composables/useCellEditing.ts` lines 9-12 accept optional `scrollToRow` and `getRowIndex` params for virtual scroll integration.
- **React:** `/home/alaarab/ogrid/packages/react/src/hooks/useCellEditing.ts` has no params -- it's a stateless hook.
- **Impact:** Minor API surface difference. Not a bug, but creates divergence in the API contracts.

#### P2-2: Vue `useOGrid` uses non-reactive `sideBar` config
- **File:** `/home/alaarab/ogrid/packages/vue/src/composables/useOGrid.ts` line 375
- `useSideBarState({ config: props.value.sideBar })` passes the initial value only. If the parent changes `sideBar` after mount, the sidebar config won't update because `props.value.sideBar` is evaluated once.
- **React:** `/home/alaarab/ogrid/packages/react/src/hooks/useOGrid.ts` line 556: `useSideBarState({ config: sideBar })` re-evaluates on every render.

#### P2-3: Vue `useActiveCell` uses `requestAnimationFrame` instead of `useLayoutEffect`
- **File:** `/home/alaarab/ogrid/packages/vue/src/composables/useActiveCell.ts` lines 49-86
- Uses `requestAnimationFrame` for scroll-into-view, whereas React uses `useLayoutEffect` (synchronous before paint).
- **Impact:** This is actually a reasonable Vue adaptation, but it means there could be a single frame where the cell is focused but not scrolled into view. The code correctly handles cleanup and stale-check.

#### P2-4: Vue `useOGrid` uses `let fetchId` instead of a ref for server-side fetch tracking
- **File:** `/home/alaarab/ogrid/packages/vue/src/composables/useOGrid.ts` line 277
- `let fetchId = 0` as a plain closure variable. React uses `useRef` for this.
- **Impact:** In Vue, this works fine since composables are called once. Not a bug, but stylistically different.

#### P2-5: vue-vuetify and vue-primevue OGrid double-call `setPage(1)` on page size change
- **File:** `/home/alaarab/ogrid/packages/vue-vuetify/src/OGrid/OGrid.ts` lines 47-50
- ```js
  onPageSizeChange: (size: number) => {
    pagination.value.setPageSize(size);
    pagination.value.setPage(1);  // redundant -- setPageSize already calls setPage(1)
  }
  ```
- **Impact:** Causes double page-reset. Same issue in the React OGrid component, so this is inherited behavior. Minor.

#### P2-6: `vue-radix` OGrid is a passthrough wrapper with no orchestration
- **File:** `/home/alaarab/ogrid/packages/vue-radix/src/OGrid/OGrid.vue` (13 lines)
- It just passes `$props` through to a non-existent `OGridLayout` and `DataGridTable`. It doesn't use `useOGrid`, doesn't render pagination, doesn't render column chooser, doesn't render toolbar.
- **Impact:** The OGrid component is effectively non-functional. Only DataGridTable can be used.

#### P2-7: Missing `useLatestRef` export from `vue` package index
- **React:** `/home/alaarab/ogrid/packages/react/src/index.ts` line 79: exports `useLatestRef`
- **Vue:** `/home/alaarab/ogrid/packages/vue/src/index.ts` does NOT export `useLatestRef` in its barrel exports
- **Vue composables index:** `/home/alaarab/ogrid/packages/vue/src/composables/index.ts` line 61 does export it.
- **Impact:** Minor, since it's accessible through the composables barrel.

#### P2-8: Duplicate MarchingAntsOverlay files in vue-radix
- **File:** `/home/alaarab/ogrid/packages/vue-radix/src/DataGridTable/MarchingAntsOverlay.vue` (SFC version)
- **File:** `/home/alaarab/ogrid/packages/vue-radix/src/DataGridTable/MarchingAntsOverlay.ts` (render function version)
- Both files exist. The SFC version is imported in DataGridTable.vue. The .ts version is unused dead code.

#### P2-9: Vue `useDataGridState` eagerly evaluates `colOffset` as a non-reactive value
- **File:** `/home/alaarab/ogrid/packages/vue/src/composables/useDataGridState.ts` line 183
- `const colOffset = computed(() => specialColsCount.value).value;` -- the `.value` at the end extracts the initial number, losing reactivity. If `rowSelection` mode changes from 'none' to 'multiple' after mount, `colOffset` will not update.
- **React:** Uses a plain variable derived from `hasCheckboxCol` + `hasRowNumbersCol` which is recomputed on each render.
- **Impact:** Dynamic row selection mode switching (rare but supported) would break cell coordinate calculations.

#### P2-10: MarchingAntsOverlay missing from vue-vuetify and vue-primevue
- **Vue-vuetify DataGridTable:** Does not import or render MarchingAntsOverlay anywhere.
- **Vue-primevue DataGridTable:** Does not import or render MarchingAntsOverlay anywhere.
- **Vue-radix DataGridTable:** Correctly renders MarchingAntsOverlay.
- **React:** All 3 React UI packages render MarchingAntsOverlay.
- **Impact:** Copy/cut visual feedback (animated dashed border) missing in vue-vuetify and vue-primevue.

---

## Package-by-Package Summary

### `packages/vue/` vs `packages/react/`

**Composable coverage:**
| React Hook | Vue Composable | Status |
|-----------|---------------|--------|
| `useOGrid` | `useOGrid` | Implemented (minor reactive issue P2-2) |
| `useDataGridState` | `useDataGridState` | Missing `pinning` sub-object (P1-1) |
| `useActiveCell` | `useActiveCell` | Implemented |
| `useCellEditing` | `useCellEditing` | Implemented (extra params P2-1) |
| `useCellSelection` | `useCellSelection` | Missing anchor styling (P1-7) |
| `useClipboard` | `useClipboard` | Implemented |
| `useRowSelection` | `useRowSelection` | Implemented |
| `useKeyboardNavigation` | `useKeyboardNavigation` | Implemented |
| `useFillHandle` | `useFillHandle` | Implemented |
| `useUndoRedo` | `useUndoRedo` | Implemented |
| `useContextMenu` | `useContextMenu` | Implemented |
| `useColumnResize` | `useColumnResize` | Implemented |
| `useColumnReorder` | `useColumnReorder` | Implemented |
| `useVirtualScroll` | `useVirtualScroll` | Implemented |
| `useFilterOptions` | `useFilterOptions` | Implemented |
| `useDebounce` | `useDebounce` | Implemented |
| `useTableLayout` | `useTableLayout` | Implemented |
| `useColumnHeaderFilterState` | `useColumnHeaderFilterState` | Implemented |
| `useTextFilterState` | `useTextFilterState` | Implemented |
| `useMultiSelectFilterState` | `useMultiSelectFilterState` | Implemented |
| `usePeopleFilterState` | `usePeopleFilterState` | Implemented |
| `useDateFilterState` | `useDateFilterState` | Implemented |
| `useColumnChooserState` | `useColumnChooserState` | Implemented |
| `useInlineCellEditorState` | `useInlineCellEditorState` | Implemented |
| `useRichSelectState` | `useRichSelectState` | Implemented |
| `useSideBarState` | `useSideBarState` | Implemented |
| `useLatestRef` | `useLatestRef` | Implemented |
| **`useColumnPinning`** | -- | **MISSING (P0-1)** |
| **`useColumnHeaderMenuState`** | -- | **MISSING (P0-2)** |

**Missing React components in Vue:**
| React Component | Vue Equivalent | Status |
|----------------|---------------|--------|
| `OGridLayout` | -- | No standalone Vue component (logic inlined in OGrid) |
| `StatusBar` | -- | No shared Vue component (each UI pkg implements) |
| `GridContextMenu` | -- | No shared Vue component (each UI pkg implements) |
| `MarchingAntsOverlay` | -- | No shared Vue component (implemented in vue-radix only) |
| `SideBar` | `SideBar.ts` | Exists as type definition only (`SideBar.d.ts` + `SideBar.ts`) |
| `EmptyState` | -- | No shared Vue component |
| **`CellErrorBoundary`** | -- | **MISSING (P1-6)** |
| `BaseInlineCellEditor` | -- | No shared Vue component |

### `packages/vue-vuetify/` vs `packages/react-radix/`

| Feature | React-radix | Vue-vuetify | Gap |
|---------|------------|-------------|-----|
| DataGridTable | Full | ~90% complete | Missing ColumnHeaderMenu (P0-3), MarchingAntsOverlay (P2-10), showRowNumbers works |
| OGrid | Full | ~75% | SideBar not rendered (P1-5) |
| ColumnHeaderFilter | Full (text, multiSelect, people, date) | Full | Parity |
| ColumnChooser | Full | Full | Parity |
| PaginationControls | Full | Full | Parity |
| InlineCellEditor | Full | Full | Parity |
| StatusBar | Full | Full | Parity |
| GridContextMenu | Full | Full | Parity |
| Tests | 92 | 1 (exports only) | Major gap (P1-8) |

### `packages/vue-primevue/` vs `packages/react-material/`

Same gaps as vue-vuetify (they share the same structure). Identical issues:
- SideBar not rendered in OGrid (P1-5)
- No ColumnHeaderMenu (P0-3)
- No MarchingAntsOverlay (P2-10)
- 1 test only (P1-8)

### `packages/vue-radix/` vs `packages/react-radix/`

| Feature | React-radix | Vue-radix | Gap |
|---------|------------|-----------|-----|
| DataGridTable | Full 615 lines | Broken 562 lines | Multiple template bugs (P0-5) |
| OGrid | Full orchestration | 13-line passthrough | Non-functional (P2-6) |
| ColumnHeaderFilter | Uses getHeaderFilterConfig | Manual prop passing with bugs | Broken (P0-4) |
| ColumnChooser | Full | Implemented | Likely works |
| PaginationControls | Full | Implemented | Likely works |
| InlineCellEditor | Full | Implemented | May not render due to P0-5 |
| StatusBar | Full | Implemented | Works |
| GridContextMenu | Full | Implemented | Works |
| MarchingAntsOverlay | Full | Implemented (SFC) | Works |
| Virtual Scrolling | Full | Not wired in template | Broken (P0-5 #6) |
| Row Numbers | Full | Not rendered | Missing (P1-4) |
| Column Header Menu | Full | Missing entirely | P0-3 |
| Tests | 92 | 1 (exports only) | P0-6 |

---

## Recommendations (Priority Order)

1. **Fix vue-radix DataGridTable** (P0-5): The template has at least 8 distinct bugs. Most cell rendering is broken. This package should not be published.
2. **Add `useColumnPinning` and `useColumnHeaderMenuState`** to `packages/vue/` (P0-1, P0-2).
3. **Add `ColumnHeaderMenu` component** to all Vue UI packages (P0-3).
4. **Fix vue-radix ColumnHeaderFilter** to use `getHeaderFilterConfig` (P0-4).
5. **Render SideBar** in vue-vuetify and vue-primevue OGrid (P1-5).
6. **Add `density` and `columnReorder` props** to Vue type definitions (P1-2, P1-3).
7. **Add `CellErrorBoundary` equivalent** for Vue (P1-6) -- likely a global error handler or `onErrorCaptured` wrapper.
8. **Add MarchingAntsOverlay** to vue-vuetify and vue-primevue (P2-10).
9. **Add `DRAG_ANCHOR_ATTR`** and edge box-shadows to `useCellSelection` (P1-7).
10. **Write tests** for all Vue packages. Target: match React test counts (~90 per UI package, ~247 for composables).

---

## Appendix: Files Referenced

### Vue packages
- `/home/alaarab/ogrid/packages/vue/src/composables/useOGrid.ts`
- `/home/alaarab/ogrid/packages/vue/src/composables/useDataGridState.ts`
- `/home/alaarab/ogrid/packages/vue/src/composables/useActiveCell.ts`
- `/home/alaarab/ogrid/packages/vue/src/composables/useCellEditing.ts`
- `/home/alaarab/ogrid/packages/vue/src/composables/useCellSelection.ts`
- `/home/alaarab/ogrid/packages/vue/src/composables/useClipboard.ts`
- `/home/alaarab/ogrid/packages/vue/src/composables/useDataGridTableSetup.ts`
- `/home/alaarab/ogrid/packages/vue/src/composables/index.ts`
- `/home/alaarab/ogrid/packages/vue/src/types/dataGridTypes.ts`
- `/home/alaarab/ogrid/packages/vue/src/index.ts`
- `/home/alaarab/ogrid/packages/vue-vuetify/src/DataGridTable/DataGridTable.ts`
- `/home/alaarab/ogrid/packages/vue-vuetify/src/OGrid/OGrid.ts`
- `/home/alaarab/ogrid/packages/vue-vuetify/src/__tests__/exports.test.ts`
- `/home/alaarab/ogrid/packages/vue-primevue/src/DataGridTable/DataGridTable.ts`
- `/home/alaarab/ogrid/packages/vue-primevue/src/OGrid/OGrid.ts`
- `/home/alaarab/ogrid/packages/vue-radix/src/DataGridTable/DataGridTable.vue`
- `/home/alaarab/ogrid/packages/vue-radix/src/DataGridTable/MarchingAntsOverlay.vue`
- `/home/alaarab/ogrid/packages/vue-radix/src/DataGridTable/MarchingAntsOverlay.ts`
- `/home/alaarab/ogrid/packages/vue-radix/src/OGrid/OGrid.vue`
- `/home/alaarab/ogrid/packages/vue-radix/src/ColumnHeaderFilter/ColumnHeaderFilter.vue`
- `/home/alaarab/ogrid/packages/vue-radix/src/__tests__/exports.test.ts`

### React packages (reference)
- `/home/alaarab/ogrid/packages/react/src/hooks/useOGrid.ts`
- `/home/alaarab/ogrid/packages/react/src/hooks/useDataGridState.ts`
- `/home/alaarab/ogrid/packages/react/src/hooks/useActiveCell.ts`
- `/home/alaarab/ogrid/packages/react/src/hooks/useCellEditing.ts`
- `/home/alaarab/ogrid/packages/react/src/hooks/useCellSelection.ts`
- `/home/alaarab/ogrid/packages/react/src/hooks/useClipboard.ts`
- `/home/alaarab/ogrid/packages/react/src/hooks/useColumnPinning.ts`
- `/home/alaarab/ogrid/packages/react/src/hooks/useColumnHeaderMenuState.ts`
- `/home/alaarab/ogrid/packages/react/src/hooks/index.ts`
- `/home/alaarab/ogrid/packages/react/src/index.ts`
- `/home/alaarab/ogrid/packages/react/src/components/MarchingAntsOverlay.tsx`
- `/home/alaarab/ogrid/packages/react/src/components/CellErrorBoundary.tsx`
- `/home/alaarab/ogrid/packages/react/src/components/EmptyState.tsx`
- `/home/alaarab/ogrid/packages/react-radix/src/DataGridTable/DataGridTable.tsx`
- `/home/alaarab/ogrid/packages/react-radix/src/OGrid/OGrid.tsx`
- `/home/alaarab/ogrid/packages/react-radix/src/ColumnHeaderFilter/ColumnHeaderFilter.tsx`
- `/home/alaarab/ogrid/packages/react-radix/src/ColumnHeaderMenu/ColumnHeaderMenu.tsx`
