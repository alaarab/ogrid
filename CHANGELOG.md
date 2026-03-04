# Changelog

All notable changes to OGrid will be documented in this file.

## [2.5.8] - 2026-03-04

### Added

- **Premium input editors** - Five optional cell editors with zero bundle impact: `DatePickerEditor`, `RatingEditor`, `ColorPickerEditor`, `SliderEditor`, `TagsEditor`. Available as separate packages for React, Angular, Vue, and vanilla JS. All use `cellEditorPopup: true` and theme via OGrid CSS variables.
  - `@alaarab/ogrid-react-inputs`, `@alaarab/ogrid-angular-inputs`, `@alaarab/ogrid-vue-inputs`, `@alaarab/ogrid-js-inputs`
  - `@alaarab/ogrid-inputs` — headless utilities (calendar, rating, color, slider, tags) shared across framework packages
- **`handleBooleanCellPointerDown` utility** - Extracted the repeated checkbox pointerdown pattern (stopPropagation + select cell) into a shared utility in `@alaarab/ogrid-core`. All 9 UI packages and vanilla JS use it.
- **`estimateHeaderMinWidth` utility** - New function in `@alaarab/ogrid-core` that estimates the minimum column width needed to show a header name without truncation. Used by React, Vue, Angular, and JS layout calculations.
- **E2E tests for fill handle type protection** - Playwright tests verifying that dragging across incompatible column types (text → richSelect, date → boolean) leaves target cells unchanged. Covers React, Angular, and Vue.
- **MCP package test suite** - 42 tests covering search indexing, doc parsing, category filtering, code block extraction, and version detection. The MCP package previously had zero tests.
- **Storybook premium inputs stories** - `PremiumInputs.stories` added to all 9 UI packages (React x3, Angular x3, Vue x3) showing all 5 editors in a grid context.
- **Angular Storybook parity** - Angular Storybook stories updated across all 3 packages to match React story coverage.

### Fixed

- **Checkbox click selection flicker** - Clicking a boolean checkbox no longer briefly selects the next cell. Replaced the `setTimeout`-based commit-then-restore pattern with a `skipAdvance` option on `commitCellEdit`. Affects all frameworks.
- **Drag-select origin cell flicker** - Starting a click-drag selection no longer briefly shows the old active cell outline on the origin cell. Drag attributes are now applied synchronously on pointerdown instead of via `setTimeout`. Affects React, Vue, Angular, and JS.
- **Inline cell editor overflow** - The inline editor no longer bleeds into adjacent columns. Editor cell container changed from `overflow: visible` to `overflow: hidden` across all frameworks.
- **Column headers truncating with ellipsis** - Columns like "Department" and "Rating" no longer show as "Depart..." by default. Column minimum width is now estimated from header text length at initialization using `estimateHeaderMinWidth`.
- **Grid empty space below rows** - When fewer rows are displayed than the grid's allocated height, the grid body now collapses to the height of actual content. `flex: 1; min-height: 0` is only applied when the `[data-virtual-scroll]` attribute is present. Affects all frameworks.
- **Leftmost cell double border** - The first column no longer shows a double border on its left edge. Added `border-left: none` on the first `th`/`td` in each row across all framework table styles.

### Changed

- **Default date editor uses text input** - The built-in `'date'` cell editor now renders `<input type="text">` with a `YYYY-MM-DD` placeholder instead of the native date picker. Premium `DatePickerEditor` from the inputs packages provides the full calendar UI.
- **Vue `renderDatePicker` callback removed** - The `createInlineCellEditor` factory no longer accepts `renderDatePicker`. The `renderCheckbox` callback remains.

## [2.5.7] - 2026-03-04

### Added

- **Fill handle type protection** - Fill handle now blocks dragging values across incompatible column types (e.g., text onto a color picker or rating cell). New `areFillCompatible()` utility in core. All frameworks get this automatically.
- **Boolean column in demo data** - Added `active` boolean column to shared demo data for checkbox testing.

### Fixed

- **Checkbox alignment** - Boolean cells no longer force center justification. Checkboxes align naturally like other cell content. Fixed across all 10 UI packages (React x3, Angular x3, Vue x3, JS).
- **Checkbox click behavior** - Clicking the cell area around a checkbox no longer causes unexpected active cell movement. Added `onPointerDown` stop propagation.
- **Hero text wrapping** - Fixed words breaking mid-word on the docs site hero ("spreadshee t.", "compromis es."). Added `word-break: normal` and `hyphens: none`.

### Changed

- **Docs hero visual polish** - Reduced top padding, adjusted dark theme gradients, thinned "Zero compromises." weight, added right-edge fade mask on hero grid.

## [2.5.6] - 2026-03-03

### Added

- **Live data demo** - Real-time stock ticker on docs front page using an actual OGrid instance with 18 ticking stocks, green/red cell styles, sector filtering, sorting, and status bar
- **Cinematic docs redesign** - Animated grid background, scroll reveal animations, section textures, micro-interactions, feature bento grid, epic CTA section
- **Density scaling for editors** - Inline cell editors now scale with compact/normal/comfortable density via CSS vars (`--ogrid-cell-padding-vertical`, `--ogrid-cell-padding-horizontal`, `--ogrid-cell-font-size`). All React, Vue, and Angular editors affected.
- **Excel-like sort snapshot** - Cell edits no longer instantly reorder sorted rows. Rows stay in place until an explicit re-sort. Uses `sortVersion` counter across React, Angular, Vue, and JS.

### Fixed

- **Header menu layout shift** - 3-dot column menu no longer pushes the sort arrow when appearing. Changed from `display: none/flex` to `visibility: hidden/visible` with `flex-shrink: 0` across all 10 UI packages (React x3, Angular x3, Vue x3, JS).
- **Version sync** - Core was at 2.5.6 while all other packages were at 2.5.5, causing npm to install stale registry copies instead of workspace links. All 22 packages now synced at 2.5.6.

### Changed

- **Vue inline editor padding** - Updated from hardcoded `padding: '0 2px'` to density-aware CSS vars with fallbacks

## [2.5.4]  -  2026-03-02

### Added

- **Type-safe fill and paste tests**  -  12 new integration tests verifying that fill handle and clipboard paste respect column types (numeric, boolean, date). Invalid values are silently rejected.
- **Missing documentation pages**  -  Added 8 feature pages (column reordering, column types, cell references, mobile touch, virtual scrolling, responsive columns, performance), 3 guide pages (accessibility, MCP server, MCP live testing), and 6 API component pages to the docs sidebar.

### Changed

- **Boolean checkbox single-click toggle**  -  Boolean cells now render an enabled checkbox that toggles on single click, instead of requiring double-click to enter edit mode. Read-only columns keep the disabled checkbox. Affects all 10 UI packages (React 3, Angular 3, Vue 3, JS 1).
- **Date editor uses text input**  -  Date cell editors now use a plain text input for Excel-like UX (type the date directly) instead of the native browser date picker, which had confusing month-selection and highlight behavior. Affects all frameworks.

### Fixed

- **Select/richSelect dropdown not closing on scroll**  -  Fixed scroll close detection in Angular, Vue, and JS inline cell editors. The selector was using `.ogrid-table-wrapper` (a CSS module class that compiles to a hash) instead of the stable `data-ogrid-scroll-container` attribute. React was already fixed; Angular, Vue, and JS are now consistent.
- **Editor not closing when clicking other cells**  -  Open inline editors (select, text, date) now close when clicking a different cell, matching Excel behavior. Affects all 4 frameworks.
- **Fluent body cell font size**  -  Normalized from 12px to 13px to match Radix and other packages.
- **Active/editing cell z-index**  -  The `<td>` containing the active or editing cell is now elevated via `z-index: 2` so the cell outline paints above adjacent cells on hovered rows. Affects all frameworks.
- **OGridLayout border color**  -  Changed fallback from `#e0e0e0` to `rgba(0, 0, 0, 0.12)` for consistency with framework defaults.
- **Header menu/filter trigger visibility**  -  Filter and menu trigger buttons now hide by default and appear on column header hover (hover-capable devices only). Always visible on touch devices and when a filter is active.
- **Row number cell background**  -  Row number cells now maintain their header-like background during row hover and selection states.

---

## [2.5.1]  -  2026-03-01

### Fixed

- **Select/richSelect editor clipped by CSS containment**  -  Fixed dropdown disappearing when clicking select-type cells. The root cause was `contain: content` on grid cells, which clips all descendants (including `position: fixed` elements). Active/editing cells now set `contain: none` to allow dropdown overflow. Affected all frameworks: React (Material, Radix, Fluent), Angular, Vue, JS.
- **Portal dropdown to document.body**  -  Select and richSelect editor dropdowns are now portaled to `document.body` via `createPortal` when using fixed positioning, fully escaping the table's containment and stacking context hierarchy (React).

---

## [2.5.0]  -  2026-02-28

### Added

- **Responsive column hiding**  -  New `responsiveColumns` prop on OGrid enables automatic column hiding based on container width. Columns with `responsivePriority` (0 = highest) are progressively hidden as the container narrows below configurable breakpoints (default: 576/768/992/1200px). `required` columns are never hidden. Supported across all 14 packages (React 3, Angular 3, Vue 3, JS 1). Core utility `getResponsiveHiddenColumns()` is framework-agnostic and can be used standalone.
- **Responsive pagination layout**  -  Pagination controls stack vertically with centered navigation on narrow viewports (< 576px) across all UI packages (React, Angular Material/PrimeNG/Radix, Vue, JS).
- **Mobile touch support**  -  Migrated all drag interactions from Mouse Events to the Pointer Events API (`pointerdown`, `pointermove`, `pointerup`), unifying mouse, touch, and pen input across all 14 packages (React, Angular, Vue, JS). Affected interactions: cell drag-selection, fill handle drag-to-fill, column resize, and column reorder. Added `touch-action: none` CSS on interactive handles to prevent browser default gestures during drag. Added `@media (pointer: coarse)` rules to increase touch target sizes on touch devices (fill handle 7px to 14px, resize handle 8px to 16px).
- **Formula engine subpath export**  -  `@alaarab/ogrid-core/formula` subpath export for tree-shaking formula engine code separately.
- **Bundle size optimizations**  -  Improved tree-shaking externals and subpath exports across all packages.

### Fixed

- **Inline formula editing**  -  Fixed cell reference insertion during formula editing and formula bar helpers.
- **Select editor highlight**  -  Select and rich-select editors now highlight the current cell value when opened, instead of always defaulting to the first option (React, Vue)
- **Arrow keys during editing**  -  Arrow keys no longer navigate away from the cell while actively editing text; they now move the cursor within the editor as expected (React, Angular, Vue, JS)
- **Row number column resize**  -  The row number column (`cellReferences` mode) is now resizable via drag, matching the behavior of regular columns (React, Angular, Vue, JS)
- **Boolean cell display**  -  Boolean columns now render a disabled checkbox instead of "True"/"False" text in display mode (React, Angular, Vue, JS)
- **Column header menu toggle**  -  Clicking the 3-dot menu button again now closes the menu instead of re-opening it (React, Vue)
- **Select/richSelect editor on scroll**  -  Select and rich-select editors now close when the grid scrolls, preventing dropdown drift from its anchor cell
- **Multiselect filter font size**  -  Reduced multiselect filter option font size from 14px to 13px for better density

### Changed

- **Responsive column logic deduplicated**  -  Shared responsive column utilities moved to core, reducing duplication across all framework packages.

---

## [2.4.0]  -  2026-02-27

### Added

**Formula engine  -  145 built-in functions** (up from 39 in 2.2.0):
- **Phase 1 (54 functions):** `ROUNDUP`, `ROUNDDOWN`, `INT`, `TRUNC`, `PRODUCT`, `SUMPRODUCT`, `MEDIAN`, `LARGE`, `SMALL`, `RANK`, `SIGN`, `LOG`, `LN`, `EXP`, `PI`, `RAND`, `RANDBETWEEN`, `FIND`, `SEARCH`, `REPLACE`, `REPT`, `EXACT`, `PROPER`, `CLEAN`, `CHAR`, `CODE`, `TEXT`, `VALUE`, `TEXTJOIN`, `IFNA`, `IFS`, `SWITCH`, `CHOOSE`, `XOR`, `HLOOKUP`, `XLOOKUP`, `DATE`, `DATEDIF`, `EDATE`, `EOMONTH`, `WEEKDAY`, `HOUR`, `MINUTE`, `SECOND`, `NETWORKDAYS`, `SUMIFS`, `COUNTIFS`, `AVERAGEIFS`, `ISBLANK`, `ISNUMBER`, `ISTEXT`, `ISERROR`, `ISNA`, `TYPE`, `#NUM!` error type
- **Phase 2 (52 functions):** `PMT`, `FV`, `PV`, `NPER`, `RATE`, `NPV`, `IRR`, `SLN`, `STDEV`/`STDEV.S`, `STDEVP`/`STDEV.P`, `VAR`/`VAR.S`, `VARP`/`VAR.P`, `CORREL`, `PERCENTILE`/`PERCENTILE.INC`, `QUARTILE`/`QUARTILE.INC`, `MODE`/`MODE.SNGL`, `GEOMEAN`, `HARMEAN`, `INDIRECT`, `OFFSET`, `ADDRESS`, `ROW`, `COLUMN`, `ROWS`, `COLUMNS`, `SEQUENCE`, `TRANSPOSE`, `MMULT`, `MDETERM`, `MINVERSE`, `MROUND`, `QUOTIENT`, `COMBIN`, `PERMUT`, `FACT`, `GCD`, `LCM`, `DAYS`, `DAYS360`, `ISOWEEKNUM`, `YEARFRAC`, `DATEVALUE`, `TIMEVALUE`, `TIME`, `WORKDAY`, `WORKDAY.INTL`, `DOLLAR`, `FIXED`, `T`, `N`, `FORMULATEXT`, `ISODD`, `ISEVEN`, `ISFORMULA`, `ISLOGICAL`, `ISNONTEXT`, `ISREF`
- **Phase 3 (named ranges, auditing, cross-sheet):** `defineNamedRange` / `removeNamedRange`, `getPrecedents` / `getDependents` / `getAuditTrail`, cross-sheet references (`=Sheet2!A1`, `='Sheet Name'!B2:C5`), formula-aware clipboard + fill handle + CSV export
- **Phase 4 (Excel-like UI):** Formula bar (`[Name Box][fx][Input]`), cell reference highlighting (`FormulaRefOverlay`), sheet tabs (`SheetTabs`), `ISheetDef` type  -  all 4 frameworks (React, Angular, Vue, JS)
- **Vue + Angular formula bar parity**  -  `SheetTabsComponent` and `FormulaRefOverlayComponent` ported to `@alaarab/ogrid-angular` (all 3 Angular UI packages) and `@alaarab/ogrid-vue` (all 3 Vue UI packages)
- Storybook `Formulas` stories for React Fluent and React Material packages

**MCP (`@alaarab/ogrid-mcp`):**
- **Documentation server**  -  `search_docs`, `list_docs`, `get_docs`, `get_code_example`, `detect_version` tools; `ogrid://quick-reference` and `ogrid://docs/{path}` resources; docs bundled for zero-config `npx @alaarab/ogrid-mcp` usage
- **Live Testing Bridge**  -  `npx @alaarab/ogrid-mcp --bridge` starts an HTTP server (port 7890, localhost-only) that running OGrid instances connect to; new tools: `list_grids`, `get_grid_state`, `send_grid_command`; `bridge-client` browser-safe entry point: `@alaarab/ogrid-mcp/bridge-client`
- **Bridge wired into all 10 example apps**  -  React (Radix, Fluent, Material), Angular (Material, PrimeNG, Radix), Vue (Vuetify, PrimeVue, Radix), and Vanilla JS; each example connects with its own `gridId` and full `getSort`/`getFilters` state reporting where the API is available
- **`getSort` and `getFilters` callbacks** added to `ConnectGridOptions`  -  bridge now reports active sort model and filter model on every state push; React and JS examples use `api.getColumnState()` for live state; Angular/Vue examples default to empty (no api ref in template-binding pattern)
- **AG Grid migration prompt**  -  `ogrid://migration-guide` resource and `migrate-from-ag-grid` prompt
- **`--version` / `-v` flag**  -  `npx @alaarab/ogrid-mcp --version` prints the installed version
- Documentation: `guides/mcp.mdx` (editor setup guide) and `guides/mcp-live-testing.mdx` (bridge guide)
- 4,189 tests across 14 packages (424 new formula + date tests added this cycle)

### Changed
- **Cross-framework UI deduplication**  -  `PaginationControlsBase` and `ColumnChooserContent` extracted to `@alaarab/ogrid-react`; `createBaseFilterRenderers` factory shared by Radix and Material; `getColumnHeaderMenuProps` utility eliminates 18-prop spread; `BaseColumnHeaderMenuComponent` abstract class shared by all 3 Angular UI packages (~170 lines removed)
- **`createGridDataAccessor` extracted to core**  -  shared by React/Angular/Vue/JS formula integrations
- **Formula bar utilities extracted to core**  -  `processFormulaBarCommit`, `deriveFormulaBarText`, `FORMULA_BAR_CSS`, `FORMULA_REF_COLORS` centralized in `@alaarab/ogrid-core`
- **Jest config optimization**  -  `isolatedModules: true` across all 14 packages; `maxWorkers: 4` caps memory at ~1.2 GB

### Fixed
- **Date cell editor empty / wrong date**  -  `<input type="date">` requires `YYYY-MM-DD`; ISO strings now truncated to first 10 chars on editor open (React, Vue, Angular). `toLocaleDateString()` now passes `{ timeZone: 'UTC' }` to prevent UTC-midnight dates shifting one day backward in negative-offset timezones
- `PROPER` now correctly lowercases remaining characters
- `VALUE` now correctly converts percentage strings (`"75%"`  to  `0.75`)
- Angular `OGridService` and Vue `useOGrid` now auto-wire formula engine props (parity with React)
- Angular `types/index.ts` re-exports formula types (`IFormulaFunction`, `IRecalcResult`, `IGridDataAccessor`, `IAuditEntry`, `IAuditTrail`)
- Column autosize header measurement includes `<th>` border widths for correct `border-box` sizing
- Date inline editor commits on Enter/blur (was silently discarding edits in React and Vue)
- Formula bar double-`=` bug  -  `deriveFormulaBarText` was prepending a second `=` to formula strings
- Formula `#ERROR!` on re-entering a formula via the bar  -  downstream consequence of the double-`=` bug
- Formula cache miss for `undefined` computed values  -  `values.has(key)` replaces `values.get(key) !== undefined`

---

## [2.3.0]  -  2026-02-24

### Added
- **Excel-style cell references** (`cellReferences` prop) across all 4 frameworks  -  column letter headers (A, B, C…), row numbers in leftmost column, name box in toolbar showing the active cell reference (e.g., "A1"). Enabling `cellReferences` implies `showRowNumbers`. `indexToColumnLetter` and `formatCellReference` utilities in `@alaarab/ogrid-core`.
- Cell references Storybook stories and feature documentation page.
- **PageDown/PageUp keyboard navigation** across all frameworks  -  jumps one visible page of rows at a time, clamped to valid row bounds.
- Performance Storybook stories (large dataset rendering benchmarks).
- Documentation polish and feature page updates.

### Fixed
- Cross-framework parity: `scrollToRow` alignment options, PageDown NaN guard when row count is zero, Angular Delete key handler refactored to match React/Vue behavior.
- JS package clipboard paste during active cell edit.
- Storybook story parity across React UI packages.

---

## [2.2.0]  -  2026-02-24

### Added
- **CSS containment** (`contain: content`) on body cells for reduced paint scope; `contain: none` on pinned columns to preserve `position: sticky`; `content-visibility: auto` on non-virtual rows for off-screen skipping.
- **Column virtualization**  -  opt-in via `virtualScroll: { columns: true, columnOverscan: 2 }`. Core utilities: `computeVisibleColumnRange()` and `partitionColumnsForVirtualization()` (returns `IVisibleColumnRange`). Off-screen columns replaced with spacer `<td>` elements on left and right. Works alongside row virtualization.
- **Web Worker sort/filter**  -  opt-in via `workerSort: true | 'auto'`. Core exposes `processClientSideDataAsync()` which offloads sort+filter to an inline Blob URL worker. Falls back to synchronous path when: a custom `compare` function is used, `people` filters are active, or the Worker API is unavailable. `terminateSortFilterWorker()` for cleanup on unmount.

### Fixed
- Column pinning initialization across all frameworks (pinned columns were not applying sticky positioning on first render).

---

## [2.1.15]  -  2026-02-24

### Added
- **Double-click column resize auto-fit** across all 10 UI packages (React x3, Angular x3, Vue x3, JS)  -  Excel-like auto-size to content on double-click of resize handle.
- Core `measureColumnContentWidth` utility: expands overflow-hidden headers and measures body cells via `position:absolute; width:max-content`.
- 25 new tests (core autosize, React/Vue double-click resize). **2,882 tests** across 14 packages.

### Fixed
- React "Maximum update depth exceeded" during column resize  -  round container width, serialize overridesKey for `useLayoutEffect` deps.
- Remove 16px empty space below last grid row on docs pages (Docusaurus global `table { margin-bottom }` override).

### Changed
- Redesigned docs CTA section: replaced 10-package grid with 4 framework cards.

---

## [2.1.11–2.1.13]  -  2026-02-23

### Added
- `role="grid"` on table element across all frameworks (React, Angular, Vue, JS).
- `aria-selected` on selected rows across all frameworks.
- `jest-axe` accessibility tests for React Fluent (22 tests) and Material (23 tests).
- Resize handle ARIA attributes (`role="separator"`, `aria-orientation`) in Fluent.
- `validateVirtualScrollConfig()` dev-mode warning, wired into all frameworks.

### Fixed
- Reverted scroll architecture changes from 2.1.11 that caused horizontal scroll locking (`overflow:clip` on tableWidthAnchor).
- Removed double horizontal scrollbar on docs grids (Docusaurus global `table { overflow: auto }` override).
- Clipped last column resize handle overhang creating 3px right gap via `overflow-x:clip` on table wrapper.

### Changed
- Centralized z-index values via CSS custom properties (`--ogrid-z-*`) across all 6 CSS files.
- Memoized Angular `DataGridStateService.getState()`  -  34 stable closures replace inline arrows.

### Performance
- Pre-compute lowercase/numeric sort keys in `processClientSideData` (like date cache).

---

## [2.1.9–2.1.10]  -  2026-02-22

### Fixed
- **Drag selection border gaps**  -  replaced per-cell inset box-shadows with a single overlay div positioned over the entire selection range during drag.
- Hide active cell outline during drag selection.
- Hide MarchingAntsOverlay selection border during drag (anchor cell green SVG border was persisting).
- **CSS module class name collisions**  -  react-fluent and react-radix produced identical class names; switched to `postcssModules` with package-specific `generateScopedName` patterns (`ogrid-fluent__*`, `ogrid-radix__*`).
- Restored CSS auto-import banner in react-fluent so consumers get styles automatically.
- `ResizeObserver` -> `useLayoutEffect` infinite loop during column resize.

---

## [2.1.6–2.1.8]  -  2026-02-21

### Fixed
- **Infinite re-fetch loop**  -  inline `dataSource` objects caused `useEffect` to re-fire every render. Stabilized via `useLatestRef` for `dataSource`, `onError`, and `onFirstDataRendered` callbacks.
- **Cascading re-renders from consumer callbacks**  -  `OGrid` now uses `useLatestRef` for `onCellValueChanged`, `getRowId`, `onUndo`, `onRedo`, `onColumnOrderChange` so inline functions don't trigger full grid re-renders.
- **Cell edit selection desync on Enter**  -  fixed across React, Angular, and Vue.
- `peopleSearch` dependency array in `useDataGridState`.

### Changed
- Extracted `isColumnEditable()` and `buildCellIndex()` helpers to core (dedup 4+ files).
- Removed auto dark mode CSS from all packages. Canonical dark mode now uses `:where()` zero-specificity defaults in `core/_ogrid-theme.scss`.
- Dark mode activates via `@media (prefers-color-scheme: dark)` or `[data-theme="dark"]` on any ancestor.
- Auto-import extracted CSS in react-radix and react-fluent bundles (consumers no longer need manual CSS import).

---

## [2.1.5]  -  2026-02-20

### Fixed
- Material grid CSS injection  -  replaced separate `.css` file with self-injecting `DataGridTable.styles.ts` so consumers don't need a separate CSS import.

---

## [2.1.4]  -  2026-02-20

### Performance
- **tsup bundling**  -  migrated all 13 packages from raw `tsc` to tsup (esbuild): single bundled JS file per package instead of 40+ individual files.
- **Material Emotion elimination**  -  replaced MUI `<TableRow>/<TableCell>/<Box>` in DataGridTable body with native `<tr>/<td>/<div>` + CSS classes, eliminating ~1,000 Emotion CSS-in-JS resolutions per render.

### Changed
- Fixed `export *` anti-pattern in all 8 UI packages with explicit named re-exports for proper tree-shaking.
- Bundled `@alaarab/ogrid-core` into react and js packages via `noExternal`.
- Updated `moduleResolution` from `"Node"` to `"Bundler"` across all packages.
- Added MUI theme CSS variables (`--ogrid-paper-bg`, `--ogrid-primary`, `--ogrid-selection-bg`) to `MuiThemeContainer`.

---

## [2.1.3]  -  2026-02-20

### Fixed
- Material `OGrid.tsx` replaced with `createOGrid()` factory to eliminate missing-prop bugs (was missing `onSetVisibleColumns`).
- Material double horizontal scrollbar  -  replaced `MUI TableContainer` with plain `<div>`.
- Material sticky headers now use opaque `var(--ogrid-header-bg)` instead of semi-transparent `action.hover`.
- Column visibility resetting to 0 on refresh when `columns=[]` on first render then populated later.
- Docs CSS: `.live-demo__content overflow:auto` -> `visible` (was breaking sticky headers), scoped global `table th` styles to `.markdown` only.

---

## [2.1.0]  -  2026-02-20

### Added
- **stickyHeader and fullScreen props** across all 14 packages.
- **Pinned column shadows**  -  border + box-shadow replaces unreliable pseudo-elements.
- **Playwright E2E test suite**  -  208 tests across 4 framework families (React Radix, Angular Material, Vue Vuetify, Vanilla JS) covering 52 scenarios.
- Cell editor commit/cancel/blur/delete tests in React/Angular/Vue factories.
- Pinned column rendering tests and fullScreen interaction tests.
- **2,443 tests** passing across 14 packages (up from 2,028 in 2.0.8).

### Changed
- **Angular signal architecture** with `OnPush` change detection on every component.
- Decomposed React/Angular hooks into focused sub-hooks.
- New shared test factories for Angular (8 factories) and Vue (8 factories).
- ESLint flat config, shared Jest base config, CI and publish workflows.
- Husky pre-commit hooks and size-limit configuration.
- Dropped Node 18 from CI (Vite 6 requires Node 20+).
- Updated deps: Jest 30, Angular 21.1.5, Storybook 10.2.10, Turbo 2.8.10.

### Fixed
- Stabilized `useFilterOptions` and `useOGridDataFetching` to prevent infinite re-render loops (inline field arrays created new references every render).
- Angular PrimeNG pinned borders (wrong side + wrong color).

---

## [2.0.16–2.0.19]  -  2026-02-18

### Added
- **Virtualized MultiSelectFilterPopover**  -  `useListVirtualizer` hook renders only visible items + overscan buffer, fixing performance with 3,663+ filter options.

### Changed
- **Core algorithm extraction**  -  pure algorithms moved to `@alaarab/ogrid-core`: clipboard helpers, keyboard navigation, selection helpers, undo/redo stack. Angular/Vue/JS adopt shared utilities (~900 lines eliminated from Angular alone).
- Import chain enforced: all 9 UI packages import exclusively from their parent framework package, never directly from `@alaarab/ogrid-core`.
- Removed `freezeCols`/`freezeRows` from all packages (column pinning fully supersedes positional freeze).

### Fixed
- Filter popover transparent background in SPFx/portal contexts (explicit opaque background on `.filterPopover`).
- Column width shrinkage during server-side data transitions (measured widths used as `minWidth` floor).
- Virtual item height calculation in MultiSelect filter.
- Replaced Fluent `Spinner` with CSS-only spinners for SPFx portal compatibility (Fluent `Spinner` requires `FluentProvider` context unavailable in portals).

### Performance
- **Comprehensive optimization pass** across all 14 packages:
  - Angular: window event listeners and ResizeObserver run outside NgZone; `@let` in templates reduces 160+ redundant calls per render.
  - React: simplified memoization, RAF-debounced scroll-into-view, filter shallow-diff.
  - Vue: `shallowRef` + in-place mutation for row index map; split server-side fetch into `onMounted` + `watch`.
  - JS: `tbody` event delegation (O(1) vs per-cell listeners), incremental DOM patching with selection-only fast path.
  - Core: pre-cached date filter timestamps, single-pass `deriveFilterOptionsFromData`.

---

## [2.0.12]  -  2026-02-18

### Added
- `useDataGridTableOrchestration` hook for unified state management across DataGridTable implementations.
- Shared props interfaces for `PaginationControls` and `ColumnChooser`.
- `renderFilterContent` utility for streamlined filter rendering in `ColumnHeaderFilter`.
- Shared styles for DataGridTable in `_data-grid-table.scss`.

### Fixed
- Loading overlay collapsed when table has no data.
- Column pinning with dynamic state (use `pinning.pinnedColumns` instead of `col.pinned`).
- Fluent migrated from `DataGrid` to `Table` primitives, eliminating state management conflicts with OGrid hooks.
- Radix/Fluent menu handlers (mousedown click-outside was closing menu before `onClick` could fire on portal-rendered items).
- Material `border-collapse:collapse` breaks sticky positioning.

---

## [2.0.11]  -  2026-02-15

### Added
- Storybook configuration and stories for Angular and Vue packages.
- Value formatting for budget column in example OGrid components.
- Enhanced ColumnChooser and ColumnHeaderMenu components.

### Changed
- Cleaned up obsolete documentation files (OPTIMIZATIONS.md, progress reports).

---

## [2.0.9]  -  2026-02-13

### Added
- **Column Header Menu**  -  sort ascending/descending, clear sort, autosize this column, autosize all columns. Dynamic menu items based on current sort state with dividers between sections. Implemented across all 10 UI packages via shared `getColumnHeaderMenuItems()` core helper.

### Fixed
- Explicit core constant exports for Jest test resolution.
- Suppressed all React/Vue test warnings for clean CI output.
- ESLint globals in `jest.setup.js`.

### Changed
- Extracted Angular base classes: `ColumnHeaderFilter`, `ColumnChooser`, `PaginationControls` to deduplicate logic across UI packages.
- Extracted React `usePaginationControls` hook to deduplicate logic.

---

## [2.0.8]  -  2026-02-12

### Added
- **Angular Popover Cell Editor** for all 3 Angular UI packages (Material, PrimeNG, Radix).
- **Test factories**  -  factory-based testing infrastructure for Angular (8 factories, ~131 tests per UI package) and Vue (8 factories, ~100 tests per UI package).
- Shared Vue `MarchingAntsOverlay` and `StatusBar` components extracted to base package.
- **2,028 tests** across 14 packages (100% pass rate).

### Changed
- ~1,208 lines of code eliminated via deduplication (debounce to core, shared Vue components, shared constants, shared `dataGridViewModel`).
- Turbo cache optimized for 3-5x faster incremental builds.
- Radix UI and TanStack Virtual moved to peer dependencies (2.1MB + 60KB bundle savings).
- Column map caching with WeakMap (20% faster filtering).

---

## [2.0.5–2.0.7]  -  2026-02-12

### Added
- 7 new example apps (angular-radix/material/primeng, vue-radix/vuetify/primevue, js) with 20 npm scripts for running all variants.
- Shared Vue `useDataGridTableSetup` composable (dedup across 3 UI packages).
- Angular `BaseDataGridTableComponent` (39-46% reduction in UI package code).
- Angular `DataGridPinningState` and header menu state in `DataGridStateService`.
- Vue `useColumnPinning` and `useColumnHeaderMenuState` composables.
- Density prop support across Angular and Vue packages.
- React `useImperativeHandle` stabilized with `useLatestRef` (6 deps instead of 18).
- Architecture diagram as a React component (replaced Mermaid) on docs overview page.
- UI library selector added to LiveDemo StackBlitz demos.

### Fixed
- 8+ Vue-Radix DataGridTable template bugs.
- Fluent `@fluentui/react-icons` peer dep version (^2.0.417 nonexistent -> ^2.0.318).
- Angular grid-context-menu `effect()` listener accumulation memory leak.
- Angular null refs in destroy cleanup.
- Vue duplicate `cutRangeRef` allocation in `useClipboard`.

### Performance
- Core: replaced `Math.min/max` spread with loop (prevents stack overflow on large selections), column `Map` for O(1) lookup, pre-computed date timestamps in sorting.
- React: Map-based column order sorting (O(n log n) vs O(n^2 log n)).
- Angular: Map-based column order sorting in `DataGridStateService`.
- Vue: Map-based column order sorting, consolidated 26 `computed()` calls into 5 grouped objects.

### Changed
- Bumped all 3rd-party deps (Docusaurus 3.9.2, Fluent 9.73, MUI 7.3.8, TypeScript 5.9.3).
- Added `sideEffects` field to all publishable packages for tree-shaking.
- Extracted Angular inline styles to CSS (sidebar, ogrid-layout, marching-ants, empty-state).
- Resolved all ESLint warnings across 14 packages (0 errors, 0 warnings).
- **1,181 tests** passing across all 14 packages.

---

## [2.0.4]  -  2026-02-12

### Added
- **Angular packages**  -  3 new UI packages: `@alaarab/ogrid-angular-material`, `@alaarab/ogrid-angular-primeng`, `@alaarab/ogrid-angular-radix`. Angular v21 services with signals (`signal()`, `computed()`, `effect()`), standalone components with inline templates, zone-less by default.
- **Vue packages**  -  3 new UI packages: `@alaarab/ogrid-vue-vuetify`, `@alaarab/ogrid-vue-primevue`, `@alaarab/ogrid-vue-radix`. Vue 3 Composition API composables using `ref()`, `computed()`, `watch()`.
- **`@alaarab/ogrid-angular`**  -  Base Angular package with `OGridService` (signals-based orchestration), `DataGridStateService`, and shared components.
- **`@alaarab/ogrid-vue`**  -  Base Vue package with `useOGrid`, `useDataGridState`, and 27 composables.
- Expanded from **6 packages to 14 packages** (core, react, react-radix, react-fluent, react-material, angular, angular-material, angular-primeng, angular-radix, vue, vue-vuetify, vue-primevue, vue-radix, js).
- Angular/Vue tabs added to all feature doc pages.
- Framework showcase updated with all 10 UI packages.

### Changed
- Grew from 1,162 to 1,181 tests across the newly expanded 14-package monorepo.

---

## [2.0.3] – 2026-02-11

### Added

- **Column Reordering**  -  Drag-and-drop column reordering across all 12 packages. Pure TypeScript core utilities (`calculateDropTarget`, `reorderColumnArray`, `getPinStateForColumn`) with framework-specific hooks/services/composables/state classes. Respects pinning zones (left-pinned, unpinned, right-pinned). 5px drag threshold, 8px resize handle exclusion zone, RAF-throttled mouse tracking with visual drop indicator.
  - React: `useColumnReorder` hook (196 lines)
  - Angular: `ColumnReorderService` (injectable with signals)
  - Vue: `useColumnReorder` composable
  - JS: `ColumnReorderState` class (EventEmitter + RAF)
  - All 8 UI packages wired with drop indicators and `data-column-id` attributes

- **Virtual Scrolling**  -  Fixed row height virtual scrolling for large datasets across all 12 packages. Auto-enables at >100 rows with 5-row overscan. Core utilities (`computeVisibleRange`, `computeTotalHeight`, `getScrollTopForRow`) shared by Angular/Vue/JS. React uses `@tanstack/react-virtual`.
  - New `IVirtualScrollConfig` type: `{ enabled?, rowHeight?, overscan? }`
  - New `IOGridApi` methods: `scrollToRow(index, options?)` with `start`/`center`/`end` alignment
  - Spacer-row rendering (not absolute positioning) for consistent table layout

- **New `IOGridApi` methods**  -  `getColumnOrder()` and `setColumnOrder(order)` for programmatic column order control.

- **Docs: Column Reordering feature page**  -  `column-reordering.mdx` with 4 framework tabs (React, Angular, Vue, Vanilla JS).

- **Docs: Virtual Scrolling feature page**  -  `virtual-scrolling.mdx` with 4 framework tabs.

- **Docs: Landing page improvements**  -  Wider column widths for readability, toolbar with Export CSV / Select All / Clear Filters buttons, code preview tabs updated to show all 4 frameworks (React, Angular, Vue, Vanilla JS).

### Fixed

- **Vue: Row deselection in controlled mode**  -  `useRowSelection.updateSelection` now correctly mutates the controlled ref when provided, instead of silently no-op'ing. Deselection and "deselect all" now work in controlled mode.

- **Vue: Sidebar toggle/close reactivity**  -  `sideBarProps` in `useOGrid` now uses JS getters for `activePanel` and `isOpen`, so stored references to the sidebar object stay current after `toggle()`/`close()` calls.

- **Vue: `useDebouncedCallback` missing cancel/flush**  -  Added `.cancel()` and `.flush()` methods with new `DebouncedFn<T>` interface. Tests now properly `await nextTick()` before advancing fake timers (Vue's `watch` schedules callbacks as microtasks).

### Changed

- **1,162 tests** across 12 packages (Core: 237, JS: 241, React: 247, Radix: 92, Fluent: 92, Material: 92, Angular: 57, Angular Material: 9, Angular PrimeNG: 10, Vue: 65, Vue Vuetify: 10, Vue PrimeVue: 10). Up from 1,012 in v2.0.2.

---

## [2.0.0-beta] – 2026-02-11

### BREAKING CHANGES

- **Package renames for v2.0 multi-framework architecture:**
  | Old Package | New Package | Description |
  |-------------|-------------|-------------|
  | `@alaarab/ogrid-core` (hooks) | `@alaarab/ogrid-react` | React hooks, headless components, shared test factories |
  | `@alaarab/ogrid` | `@alaarab/ogrid-react-radix` | Radix UI implementation |
  | `@alaarab/ogrid-fluent` | `@alaarab/ogrid-react-fluent` | Fluent UI implementation |
  | `@alaarab/ogrid-material` | `@alaarab/ogrid-react-material` | Material UI implementation |
  | *(new)* | `@alaarab/ogrid-core` | Pure TypeScript types, algorithms, utilities (zero deps) |
  | *(new)* | `@alaarab/ogrid-js` | Vanilla JS data grid (class-based, no framework) |

### Added

- **`@alaarab/ogrid-core`**  -  New pure TypeScript package with zero dependencies. Contains all shared types (`IColumnDef`, `IFilters`, `FilterValue`, etc.), algorithms (sorting, filtering, pagination), and utilities (`exportToCsv`, `buildHeaderRows`, `computeAggregations`, etc.). 237 tests.

- **`@alaarab/ogrid-js`**  -  New vanilla JS data grid package. Class-based architecture with `EventEmitter`, `GridState`, and `TableRenderer`. Full feature parity with React: pagination, status bar, column chooser, cell selection, keyboard navigation, clipboard, undo/redo, inline editing, context menu, column resize, fill handle, marching ants overlay, row selection, column pinning, server-side data via `IDataSource`, sidebar (columns + filters panels), header filter popovers (text, multiSelect, date), CSV export, and table layout with ResizeObserver. 194 tests.

### Improved

- **React package deduplication**  -  `@alaarab/ogrid-react` now imports shared utilities and constants from `@alaarab/ogrid-core` instead of maintaining duplicate copies. Eliminates ~800 lines of duplicated source code and ~1,200 lines of duplicated tests. React's `IColumnDef<T>` now extends Core's `IColumnDef<T>` (no duplicate type definitions). `dataGridTypes.ts` reduced from ~207 to ~42 lines. `gridRowComparator.ts` is now a 3-line re-export from Core.

- **Lint cleanup**  -  Removed all unused imports, variables, and type parameters across all 6 packages. Added `eslint-disable` comments with explanations for intentional `exhaustive-deps` suppressions (stable refs excluded from dependency arrays).

- **Fluent build fix**  -  Added type declaration shim for `@fluentui/react-icons` (upstream package ships broken typings in v2.0.318).

### Changed

- **954 tests** across 6 packages (Core: 237, JS: 194, React: 247, Radix: 92, Fluent: 92, Material: 92). React test count decreased from 484 to 247 because duplicate utility tests were removed (those tests now run only in Core). JS test count increased from 68 to 194 with full feature parity.

---

## [1.9.0] – 2026-02-10

### BREAKING CHANGES

- **Grouped `useOGrid` returns**  -  The hook's flat return object is now organized into 4 logical groups: `pagination`, `columnChooser`, `layout`, `filters`. The `dataGridProps` field is unchanged.
  ```typescript
  // Before (1.8.x)
  const { page, setPage, pageSize, ... } = useOGrid(props, ref);
  // After (1.9.0)
  const { dataGridProps, pagination, columnChooser, layout, filters } = useOGrid(props, ref);
  pagination.page;  pagination.setPage(2);
  columnChooser.columns;  columnChooser.onVisibilityChange('col', true);
  ```
  Renamed: `columnChooserColumns`  to  `columnChooser.columns`, `handleVisibilityChange`  to  `columnChooser.onVisibilityChange`, `columnChooserPlacement`  to  `columnChooser.placement`.

- **`useKeyboardNavigation` params restructured**  -  Flat params object replaced with 4 groups: `data`, `state`, `handlers`, `features`. Internal change  -  only affects direct hook consumers (not OGrid/DataGridTable users).

- **`useUndoRedo` param renamed**  -  `maxHistory`  to  `maxUndoDepth` (default raised from 50 to 100). Result now also exposes `maxUndoDepth`.

### Added

- **New `IOGridApi` methods**  -  5 new methods on the grid API ref:
  - `clearFilters()`  -  Remove all active filters.
  - `clearSort()`  -  Reset to default sort field/direction.
  - `resetGridState(options?)`  -  Clear filters, sort, and selection in one call. Pass `{ keepSelection: true }` to preserve row selection.
  - `getDisplayedRows()`  -  Returns the currently visible (post-filter/sort/paginate) rows.
  - `refreshData()`  -  Re-trigger server-side data fetch (no-op for client-side).

- **Filter sub-hooks**  -  `useColumnHeaderFilterState` decomposed into 4 composable sub-hooks, each independently exported:
  - `useTextFilterState`  -  Text filter temp value and apply/clear.
  - `useMultiSelectFilterState`  -  Multi-select checkboxes, search, select/clear all.
  - `usePeopleFilterState`  -  People search with debounce, suggestions, select/clear.
  - `useDateFilterState`  -  Date range from/to temp values, apply/clear.

- **`useLatestRef` utility hook**  -  Generic hook that keeps a ref synced to the latest value. Eliminates boilerplate 2-line `useRef` + assignment pattern across all UI packages.

- **`UseOGridPagination`, `UseOGridColumnChooser`, `UseOGridLayout`, `UseOGridFilters`**  -  New exported sub-interfaces for the grouped `useOGrid` return type.

- **234 new tests** (total: **755** across all packages at v1.9.0  -  Core: 479, Radix: 92, Fluent: 92, Material: 92). New test suites:
  - `useTextFilterState.test.ts`, `useMultiSelectFilterState.test.ts`, `usePeopleFilterState.test.ts`, `useDateFilterState.test.ts`
  - `useColumnChooserState.test.ts`, `useColumnResize.test.ts`, `useInlineCellEditorState.test.ts`
  - `clientSideData.test.ts`, `paginationHelpers.test.ts`, `ogridHelpers.test.ts`, `dataGridStatusBar.test.ts`, `gridContextMenuHelpers.test.ts`

- **`pageSizeOptions` prop** on `IOGridProps`  -  Customizable page size dropdown options (default `[10, 25, 50, 100]`). Active page size is auto-inserted if missing.

### Improved

- **`dataGridProps` memoized**  -  `useOGrid` now wraps `dataGridProps` in `useMemo`, preventing unnecessary re-renders of `DataGridTable` when only pagination or column chooser state changes.

- **`useDataGridState` sub-objects memoized**  -  Each of the 6 return groups (`layout`, `rowSelection`, `editing`, `interaction`, `contextMenu`, `viewModels`) is individually `useMemo`-ized, so consumers only re-render when their specific slice changes.

- **Stable `handleGridKeyDown`**  -  `useKeyboardNavigation` now reads params from a ref instead of closing over 20+ values. The returned handler is a single stable callback (no dependency array churn).

- **Client-side filtering: single-pass predicate pipeline**  -  `processClientSideData` builds a predicate array and runs one `.filter()` pass instead of N sequential `.filter()` calls (one per column). Reduces allocations for grids with many filtered columns.

- **`buildHeaderRows` leaf count caching**  -  Uses a `Map` cache to avoid O(n^2) repeated subtree traversals for deeply nested column groups.

- **`useFilterOptions` stable deps**  -  `fields` array sorted+joined into a `useMemo` string key instead of inline `.slice().sort().join()` in the dependency array.

- **Stable empty-object references**  -  `EMPTY_LOADING_OPTIONS` constant avoids creating `{}` on every render for `loadingFilterOptions`.

- **`useLatestRef` across all UI packages**  -  Replaced 7+ manual `useRef`+assignment pairs per DataGridTable with `useLatestRef(value)` one-liners. Reduces boilerplate and ensures consistency.

- **Inline style hoisting**  -  All three InlineCellEditor components hoist rich-select styles (wrapper, dropdown, option, highlight, no-matches) to module-scope constants. Eliminates per-render object allocation.

- **Material DataGridTable sx hoisting**  -  Loading overlay, empty state, table wrapper, and inner loading box sx objects moved to module-scope constants.

- **Fluent row className optimization**  -  Replaced `.filter(Boolean).join(' ')` with template literal concatenation for row class computation.

- **Material fill handle / selection CSS vars**  -  Hardcoded colors (`#217346`, `#fff`) replaced with CSS custom properties (`--ogrid-selection`, `--ogrid-bg`, `--ogrid-bg-range`) for theme consistency.

- **MarchingAntsOverlay deduplication**  -  Keyframe injection checks for existing `<style id="ogrid-marching-ants-keyframes">` element instead of module-scope boolean, preventing issues with multiple OGrid instances or HMR.

- **`useOGrid` return sub-objects memoized**  -  `pagination`, `columnChooser`, `layout`, and `filters` return groups are each individually `useMemo`-ized. Previously they were plain objects recreated every render, defeating the grouping benefit.

- **`useClipboard` stable callbacks**  -  `handleCopy`, `handleCut`, and `handlePaste` now use `useLatestRef` for volatile dependencies (`items`, `visibleCols`, `selectionRange`, `activeCell`, `editable`, `onCellValueChanged`). Callbacks no longer recreate when data or selection changes  -  only `colOffset`, `beginBatch`, and `endBatch` remain as true deps.

- **`GridContextMenu` useMemo fix**  -  The handler memoization was using `[props]` as the dependency, which always changes (object identity). Now destructures individual handler props as deps, so handlers are only recomputed when actual callbacks change.

- **`SideBar` inline style hoisting**  -  ~20 inline style objects (tab strip, buttons, panels, filters, checkboxes) hoisted to module-scope constants. Eliminates per-render object allocation for every sidebar render.

- **`OGridLayout` rootStyle hoisted**  -  Root container style moved from inline to module scope.

- **Stable context menu props (all 3 UI packages)**  -  `onUndo`/`onRedo` fallbacks use module-scope `NOOP` instead of inline `() => {}`. `onPaste` wrapper uses `useCallback` (`handlePasteVoid`) instead of inline arrow function.

- **`commitCellEdit` stable callback**  -  `useDataGridState`'s `commitCellEdit` now reads `visibleCols` and `items.length` via `useLatestRef` instead of closing over them. The callback no longer recreates when columns or data change, which keeps the `editingState` memo group stable.

- **Client-side multiSelect filter: Set lookup**  -  `processClientSideData` multiSelect filter now uses `Set.has()` (O(1)) instead of `Array.includes()` (O(n)) per row. Significant for grids with many filter options.

- **`MarchingAntsOverlay` animation style hoisted**  -  Static marching ants CSS animation object moved to module scope.

- **`useColumnResize` cleanup on unmount**  -  Drag event listeners are now properly removed if the component unmounts mid-resize.

- **`mergeFilter` people filter cleanup**  -  Empty people filter values are now correctly removed from the filter object.

- **`ensurePageSizeInOptions`**  -  Pagination helper auto-inserts the active page size into the options list if it's not already present, preventing a missing option when `defaultPageSize` doesn't match standard options.

### Fixed

- **Fluent filter popover positioning**  -  Replaced manual `position: fixed` popover with Fluent UI's native `Popover`/`PopoverSurface` component. The filter dropdown was rendering far from the header when the grid was inside a scrollable container (e.g. SPFx web parts). Removed `Tooltip` wrapper around column name (was causing layout issues).

- **Page scroll on cell click**  -  Replaced `scrollIntoView()` with manual wrapper-only scroll math that only scrolls the grid container, not ancestor containers or the page. All `focus()` calls use `{ preventScroll: true }`.

- **Fluent hardcoded link colors**  -  Replaced `#0f6cbd`/`#115ea3`/`#0c3b5e` with Fluent design tokens (`--colorBrandForeground1`, etc.) for proper dark mode support.

- **Fill handle border color**  -  Radix and Fluent fill handle border changed from hardcoded `#fff` to `var(--ogrid-bg, #fff)`.

### Changed

- **Package READMEs**  -  All 4 package READMEs updated with feature highlights, AG Grid comparison table, and links to full documentation.

- **Docs improvements**  -  All feature doc pages (column-chooser, column-groups, column-pinning, editing, filtering, pagination, sorting) updated with richer examples showing numeric types, value formatters, rich select editors, and `defaultPageSize`/`pageSizeOptions`. Homepage hero grid now showcases rich select editors, date editing, and sidebar panel.

- **Fluent mock updated**  -  Added `Popover` and `PopoverSurface` mocks for the new filter popover implementation.

---

## [1.8.x] – 2026-02-10

### 1.8.2
- **DataGrid row rendering optimization**  -  Memoized row components to reduce unnecessary re-renders during cell selection and drag operations.

### 1.8.1
- Version bump with minor fixes.

### 1.8.0
- **Drag-selecting state**  -  `isDragging` flag in `DataGridCellInteractionState`.
- **`isRowInRange` utility**  -  Row-level selection range check for render optimization.
- **Mobile touch support**  -  Touch events for cell drag-selection and fill handle.
- **Memoized row rendering**  -  All three UI packages use memoized row components.

---

## [1.7.2] – 2026-02-10

### Improved

- **DataGridTable performance**  -  Added memoization across all three UI packages for row rendering and cell interaction.
- **Story consistency**  -  OGrid stories updated with consistent title wrapping.

### Changed

- **Material peer deps**  -  Updated to require MUI v7 (`@mui/material ^7.0.0`).

---

## [1.7.0] – 2026-02-09

### Added

- **`toolbarBelow` prop**  -  New slot on `OGrid` and `OGridLayout` for a secondary toolbar row below the primary toolbar (e.g. filter chips, breadcrumbs).

### Changed

- **Removed deprecated exports**  -  `FluentDataTable` and `IFluentDataTableProps` removed from Fluent package exports. Use `OGrid` instead.
- **Story refactor**  -  DataGridTable stories across all three UI packages updated to use unified `filters` prop and `onFilterChange`.
- **Simplified Material/Fluent internals**  -  `MaterialDataTable` and `FluentDataTable` components streamlined to remove deprecated types.

---

## [1.6.0] – 2026-02-09

### BREAKING CHANGES

- **FilterValue discriminated union**  -  `IFilters` values are now typed discriminated unions instead of raw values. All filter values must specify their `type`:
  ```typescript
  // Before (1.5.x)
  { status: ['Active', 'Closed'], name: 'Alice' }
  // After (1.6.0)
  { status: { type: 'multiSelect', value: ['Active', 'Closed'] }, name: { type: 'text', value: 'Alice' } }
  ```
  Supported types: `{ type: 'text', value: string }`, `{ type: 'multiSelect', value: string[] }`, `{ type: 'people', value: UserLike }`, `{ type: 'date', value: IDateFilterValue }`.

- **Unified filter API on DataGridTable**  -  `IOGridDataGridProps` now uses `filters: IFilters` + `onFilterChange: (key, value) => void` instead of the 8 split filter props (`multiSelectFilters`, `textFilters`, `peopleFilters`, `dateFilters` and their onChange handlers). This does NOT affect `OGrid` consumers  -  only direct `DataGridTable` users.

- **Grouped `useDataGridState` returns**  -  The hook's return object is now organized into 6 logical groups instead of 42 flat properties:
  - `layout`  -  column structure, sizing, container dimensions
  - `rowSelection`  -  selected rows, selection handlers
  - `editing`  -  cell editing state, commit/cancel
  - `interaction`  -  active cell, selection range, keyboard, clipboard, fill handle, undo/redo
  - `contextMenu`  -  menu position, handlers (note: `contextMenu` position renamed to `menuPosition`)
  - `viewModels`  -  headerFilterInput, cellDescriptorInput, statusBarConfig, showEmptyInGrid

- **Removed deprecated props**  -  `title`, `gap`, and `columnChooser` removed from `OGridLayout`. Consumers should render titles outside `<OGrid>` and use `toolbarEnd` for column chooser placement.

- **Removed `toDataGridFilterProps`**  -  This helper was replaced by the unified filter API; use `filters`/`onFilterChange` directly.

### Added

- **`processClientSideData` utility**  -  Pure function extracted from `useOGrid` for client-side filtering and sorting. Can be used independently for custom data processing pipelines.
- **Wildcard re-exports**  -  All three UI packages now use `export * from '@alaarab/ogrid-core'` instead of cherry-picked re-export lists. Every core type is automatically available from any UI package import.
- **Grouped state sub-interfaces**  -  `DataGridLayoutState`, `DataGridRowSelectionState`, `DataGridEditingState`, `DataGridCellInteractionState`, `DataGridContextMenuState`, `DataGridViewModelState` are exported for consumers building custom grid wrappers.

### Fixed

- **Material InlineCellEditor auto-focus**  -  Added `useEffect` auto-focus matching Radix/Fluent behavior.

### Improved

- **Phase 2: Descriptor-to-component pattern**  -  All three UI packages now use the full suite of 6 core helpers (`getCellRenderDescriptor`, `buildInlineEditorProps`, `buildPopoverEditorProps`, `getCellInteractionProps`, `resolveCellDisplayContent`, `resolveCellStyle`). Each package's `renderCellContent` is now a thin ~50-line mapping from descriptors to framework-specific JSX.

---

## [1.5.0] – 2026-02-09

### Added

- **Side Bar**  -  Toggle-able side panel with `sideBar` prop (`boolean | ISideBarDef`). Includes two panels:
  - **Columns Panel**  -  Show/hide column visibility with checkboxes, Select All / Clear All buttons
  - **Filters Panel**  -  Inline filter controls (text, multiSelect, date range, people) per filterable column
- **Column State Persistence API**  -  Save and restore complete grid state with `getColumnState()` and `applyColumnState(state)` on `IOGridApi`. State includes:
  - `columnOrder`, `columnWidths`, `filters`, `pinnedColumns`, `visibleColumns`, `sort`
  - New callbacks: `onColumnResized(columnId, width)`, `onColumnPinned(columnId, pinned)`
  - `initialColumnWidths` and `pinnedColumns` props on `IOGridDataGridProps` for declarative initialization
- **Multi-Row Grouped Column Headers**  -  `buildHeaderRows()` utility handles arbitrary nesting depth. `IColumnGroupDef` with `headerName` and `children`. All three UI packages render multi-row `<thead>` with `.groupHeaderCell` styling.
- **Built-in Column Types**  -  Extended `IColumnMeta.type` to `'text' | 'numeric' | 'date' | 'boolean'`:
  - **Date type**: Auto-formats via `toLocaleDateString()`, date range filter (from/to), chronological sorting, native `<input type="date">` editor
  - **Boolean type**: Displays `True`/`False`, center-aligned, defaults to checkbox editor
- **Rich Select Editor**  -  New `cellEditor: 'richSelect'` with searchable dropdown. Headless `useRichSelectState` hook (search, filter, keyboard nav). All three UI packages implement the dropdown with inline search.
- **Status Bar Aggregation**  -  `computeAggregations()` utility calculates `sum`, `avg`, `min`, `max`, `count` for numeric selected cells. Rendered in StatusBar when selection range exists.
- **Ctrl+Arrow Excel-Style Navigation**  -  Ctrl+Up/Down/Left/Right jumps to data region edges (Excel behavior):
  - Non-empty + non-empty neighbor  to  scan to last non-empty before gap/edge
  - Empty or empty neighbor  to  skip empties to next non-empty or edge
  - Ctrl+Shift+Arrow extends selection to the same target
- **Unified Grid Layout**  -  `OGridLayout` wraps everything in a single bordered container:
  - **Toolbar strip**: `toolbar` (custom ReactNode, left) + `toolbarEnd` (column chooser, right)
  - **Footer strip**: Pagination controls inside bordered container
  - **Column chooser placement**: `columnChooser` prop (`boolean | 'toolbar' | 'sidebar'`) controls where column chooser renders
  - `title` prop deprecated (renders above container for backward compat)
- **Undo/Redo Context Menu**  -  Context menu items for Undo/Redo with keyboard shortcut labels (Ctrl+Z/Y, ⌘ on Mac). `canUndo`/`canRedo` boolean props on `IOGridProps` and `IOGridDataGridProps`.
- **521 tests** across all packages (Core: 245, Radix: 92, Fluent: 92, Material: 92).

### Changed

- **Cell Selection Colors**  -  Selection colors changed from blue (#0066cc) to Excel green (#217346) via `--ogrid-selection` CSS variable
- **Drag Selection Performance**  -  Eliminated 60-120Hz re-renders during drag selection. During drag, bypass React state entirely using refs + `requestAnimationFrame` + DOM attribute toggling (`data-drag-range`). React state only committed on mouseup (single re-render). Same optimization applied to fill handle.
- **Context Menu Behavior**  -  Context menu now only appears on cell right-click (not wrapper/headers/empty space). `useContextMenu.handleCellContextMenu` now calls `preventDefault()` on the event.
- **useOGrid Layout Mode**  -  Default `layoutMode` changed from `'content'` to `'fill'` for consistency with DataGridTable
- **Clipboard Copy**  -  `useClipboard.handleCopy` now uses `col.valueFormatter` before `String()` conversion, fixing `[object Object]` output for complex types like `UserLike`
- **DataGridTable Styling**  -  Removed outer `border` and `border-radius` from DataGridTable components (OGridLayout provides the container border)

### Fixed

- **Cell Click Target**  -  Padding moved from `<td>` to `.cellContent` div so entire cell is clickable
- **Batch Visibility Bug**  -  Select All / Clear All in side bar now use `onSetVisibleColumns(Set)` instead of per-column `onVisibilityChange` to avoid stale closure batching bugs

---

## [1.3.2] – 2026-02-09

### Fixed

- **Pinned column sticky positioning**  -  Radix: boosted SCSS specificity with `.dataTable` qualifier to override `position: relative` on `th`/`td`. Fluent/Material: applied sticky `left`/`right` positioning to both header and body cells for pinned columns.

### Improved

- **Drag selection performance**  -  Bypassed React state during mouse drag using refs + `requestAnimationFrame` + DOM `data-drag-range` attributes for visual feedback. React state committed only on mouseup (single re-render). Same pattern applied to `useFillHandle`.

---

## [1.3.1] – 2026-02-09

### Changed

- **Default layout mode**  -  `useOGrid` default `layoutMode` changed from `'content'` to `'fill'` for consistency with DataGridTable.
- **Batch processing**  -  Clipboard, fill handle, and undo/redo hooks now support batch operations (`beginBatch`/`endBatch`) for grouped edits.

### Improved

- **Cell selection**  -  Enhanced selection and clipboard handling, improved checkbox styling.

---

## [1.3.0] – 2026-02-09

### Added

- **Marching Ants Overlay**  -  `MarchingAntsOverlay` component for visual feedback on selection and copy/cut ranges (animated dashed border).
- **Value Parsers**  -  Utility functions for parsing various data types: `parseNumber`, `parseCurrency`, `parseDate`, `parseEmail`, `parseBoolean` with unit tests.
- **Context Menu Enhancements**  -  Undo/redo actions with keyboard shortcut labels displayed in context menu.

### Improved

- **Clipboard**  -  Enhanced copy/cut/paste with proper range tracking and marching ants visual feedback.
- **Keyboard navigation**  -  Additional keybindings and improved cell navigation.

---

## [1.2.2] – 2026-02-09

### Changed

- **`getRowId` type widened**  -  Return type changed from `string` to `string | number`.
- **`sortBy` made optional**  -  `sortBy` is now optional in `IOGridDataGridProps` (was required).

---

## [1.2.0] – 2026-02-08

### Added

- **Radix UI package** (`@alaarab/ogrid`)  -  Lightweight default implementation using Radix primitives and native HTML. Same feature set as Fluent and Material.
- **Spreadsheet features**  -  Cell range selection, copy/cut/paste (TSV), fill handle, context menu (Shift+F10), keyboard navigation, undo/redo, row selection, status bar.
- **Shared test factories**  -  `core/src/testing/` contains `createDataGridTableTests`, `createColumnHeaderFilterTests`, `createOGridTests`, `createSpreadsheetTests`, `createColumnChooserTests`, `createPaginationControlsTests`. UI package tests are 5-line wrappers calling these factories, ensuring feature parity.
- **266 tests** across all packages (Core: 86, Radix: 60, Fluent: 60, Material: 60).
- **Headless state hooks** in core  -  `useDataGridState`, `useColumnHeaderFilterState`, `useColumnChooserState`, `useInlineCellEditorState`. UI packages are thin view layers.
- **Core utilities**  -  `getPaginationViewModel`, `getHeaderFilterConfig`, `getCellRenderDescriptor`, `getStatusBarParts`, `getContextMenuHandlers`.
- **Headless components**  -  `OGridLayout`, `StatusBar`, `GridContextMenu` in core.

### Fixed

- **Infinite re-render** in `useColumnHeaderFilterState`  -  Destructuring defaults (`selectedValues = []`, `options = []`) created new array references on every render, triggering infinite `useEffect` cycles when the popover was open.
- **Material popover not opening in tests**  -  `Popover open` was gated on `!!popoverPosition` (set via `setTimeout(0)`), preventing the popover from rendering synchronously. Aligned with Radix/Fluent pattern.

### Changed

- **Test architecture**  -  Eliminated ~3,000 lines of duplicated test code across UI packages. All UI tests now delegate to shared factories in core.
- **Core build**  -  `tsconfig.json` excludes `**/testing/**` from production build (testing files use jest globals).

---

## [1.1.0] – 2026-02-07

### Added

- **Cell editing (P0)**  -  Inline editing with `onCellValueChanged`; built-in editors: `text`, `select` (with `cellEditorParams.values`), `checkbox`. Column-level `editable` and `cellEditor` on `IColumnDef`; optional `cellEditorParams`. Fluent: inline `Input`/`Select`/`Checkbox`; Material: `editable` + `processRowUpdate` with `singleSelect`/`valueOptions`.
- **Custom popup editors (P0)**  -  `cellEditorPopup` on column def; custom React component as `cellEditor` rendered in Popover (Fluent) or Popover (Material). `ICellEditorProps` with `value`, `onValueChange`, `onCommit`, `onCancel`, `item`, `column`, `cellEditorParams`.
- **Value getters / formatters (P0)**  -  `valueGetter` and `valueFormatter` on `IColumnDef`; core `getCellValue()`; used for filtering, sorting, and display when no `renderCell`.
- **Cell styles (P0)**  -  `cellStyle` on `IColumnDef` (static or `(item) => CSSProperties`); applied in both Fluent and Material DataGridTable cell rendering.
- **Column groups (P0)**  -  `IColumnGroupDef` with `headerName` and `children`; core `flattenColumns()`; `columns` prop accepts flat or tree. Fluent: single header row from flattened columns; Material: `columnGroupingModel` for multi-row group headers.
- **Dynamic columns (P0)**  -  Column change handling: Fluent clears sizing overrides for removed columns; DynamicColumns story (Fluent + Material) toggles column set.
- **Grid API (P0)**  -  `IOGridApi<T>` with `setRowData`, `setLoading`, `getColumnState`, `setFilterModel`. OGrid (Fluent + Material) uses `forwardRef` + `useImperativeHandle`; optional `isLoading` prop; internal data/loading state when using API without controlled props.

### Changed

- **OGrid**  -  Now a `forwardRef` component; pass a ref to access `IOGridApi`. When neither `data` nor `dataSource` is provided, grid uses internal data (empty by default); `setRowData` updates it.

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
