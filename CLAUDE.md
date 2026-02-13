# CLAUDE.md — OGrid

## Project Skills

This project has custom skills in the `.claude/skills/` directory:

- **`/verify`** — Pre-commit verification gate. Checks version sync, builds all packages, runs all tests, runs lint. Use before ANY commit.

See `.claude/skills/README.md` for details.

## Project Overview

OGrid is a lightweight, multi-framework data grid library. A pure-TypeScript core provides types, algorithms, and utilities. Framework-specific packages wrap the core for **React** (Fluent UI, Material UI, Radix UI), **Angular** (Angular Material, PrimeNG), **Vue** (Vuetify, PrimeVue), and **vanilla JS**.

- **Author:** Ala Arab
- **License:** MIT
- **Node:** >= 18 (developed with Node 22 via nvm)
- **React:** 17, 18, or 19
- **Angular:** 21
- **Vue:** 3.3+
- **Language:** TypeScript 5.7 (strict mode)

## Monorepo Structure

```
packages/
  core/               → @alaarab/ogrid-core             — Pure TS types, algorithms, utilities (zero deps)
  react/              → @alaarab/ogrid-react             — React hooks, headless components, shared test factories
  react-radix/        → @alaarab/ogrid-react-radix       — Radix UI implementation (default, lightweight)
  react-fluent/       → @alaarab/ogrid-react-fluent      — Fluent UI implementation
  react-material/     → @alaarab/ogrid-react-material    — Material UI implementation
  angular/            → @alaarab/ogrid-angular           — Angular v21 services with signals, headless components
  angular-material/   → @alaarab/ogrid-angular-material  — Angular Material v21 implementation
  angular-primeng/    → @alaarab/ogrid-angular-primeng   — PrimeNG v21 implementation
  vue/                → @alaarab/ogrid-vue               — Vue 3 composables, headless components
  vue-vuetify/        → @alaarab/ogrid-vue-vuetify       — Vuetify 3 implementation
  vue-primevue/       → @alaarab/ogrid-vue-primevue      — PrimeVue 4 implementation
  js/                 → @alaarab/ogrid-js                — Vanilla JS data grid (class-based, no framework)
  docs/               → @alaarab/ogrid-docs              — Docusaurus documentation site (private)
  examples/           → @alaarab/ogrid-examples          — Vite-powered example apps (private)
```

**Dependency graph:**
```
@alaarab/ogrid-core (zero deps)
├── @alaarab/ogrid-react         → core
│   ├── @alaarab/ogrid-react-radix
│   ├── @alaarab/ogrid-react-fluent
│   └── @alaarab/ogrid-react-material
├── @alaarab/ogrid-angular       → core
│   ├── @alaarab/ogrid-angular-material
│   └── @alaarab/ogrid-angular-primeng
├── @alaarab/ogrid-vue           → core
│   ├── @alaarab/ogrid-vue-vuetify
│   └── @alaarab/ogrid-vue-primevue
└── @alaarab/ogrid-js            → core
```

Managed with **npm workspaces** and **Turborepo**.

## Commands

```bash
npm ci                          # Install
npm run build                   # Build all (Turborepo dependency order)
npm run test:all                # Test all packages
npm run test:core               # Test core only
npm run test:js                 # Test JS only
npm run test:react              # Test React hooks only
npm run test:radix              # Test Radix UI (also: test:fluent, test:material)
npm run lint                    # ESLint
npm run storybook:fluent        # Storybook on port 6006 (also: storybook:material :6007, storybook:radix :6008)
npm run docs:dev                # Docusaurus dev server
npm run docs:build              # Build docs site
```

## Architecture

### Core (`packages/core/src/`) — `@alaarab/ogrid-core`

**Types** — `IColumnDef`, `IColumnGroupDef`, `IDataSource`, `IFilters`, `IDateFilterValue`, `UserLike`, `IOGridApi`, `IOGridProps`, `ICellEditorProps`, `FilterValue`, etc. in `types/`. Column types: `'text' | 'numeric' | 'date' | 'boolean'`. Filter types: `'none' | 'text' | 'multiSelect' | 'people' | 'date'`. `FilterValue` is a discriminated union: `{ type: 'text', value: string } | { type: 'multiSelect', value: string[] } | { type: 'people', value: UserLike } | { type: 'date', value: IDateFilterValue }`.

Core is **pure TypeScript with zero dependencies** — no React, no DOM APIs. It contains types, algorithms, and utilities shared by all framework packages.

### React (`packages/react/src/`) — `@alaarab/ogrid-react`

React hooks, headless components, and shared test factories. Depends on `@alaarab/ogrid-core`.

**Orchestration hooks:**
- `useOGrid` — Pagination, sorting, filtering, visibility, editing, row selection, status bar. Exposes `IOGridApi` ref.
- `useDataGridState` — All DataGridTable state, grouped into 6 sub-objects: `layout`, `rowSelection`, `editing`, `interaction`, `contextMenu`, `viewModels`.

**Headless state hooks** (consumed by UI packages):
- `useColumnHeaderFilterState` — Filter popover state (open, temp values, apply/clear, people search debounce)
- `useColumnChooserState` — Column visibility dropdown
- `useInlineCellEditorState` — Inline cell editor
- `useRichSelectState` — Searchable rich select dropdown (search, filter, keyboard nav)
- `useSideBarState` — Side bar panel management (active panel, toggle, config parsing)

**Feature hooks:** `useActiveCell`, `useCellEditing`, `useCellSelection`, `useRowSelection`, `useKeyboardNavigation`, `useClipboard`, `useFillHandle`, `useUndoRedo`, `useContextMenu`, `useColumnResize`, `useFilterOptions`, `useDebounce`

**Utilities:** `exportToCsv`, `getCellValue`, `flattenColumns`, `buildHeaderRows`, `getPaginationViewModel`, `getHeaderFilterConfig`, `getCellRenderDescriptor`, `resolveCellDisplayContent`, `resolveCellStyle`, `buildInlineEditorProps`, `buildPopoverEditorProps`, `getCellInteractionProps`, `getStatusBarParts`, `getDataGridStatusBarConfig`, `computeAggregations`, `processClientSideData`, `GRID_CONTEXT_MENU_ITEMS`, `getContextMenuHandlers`, `formatShortcut`

**Headless components:** `OGridLayout`, `StatusBar`, `GridContextMenu`, `SideBar`

### Angular (`packages/angular/src/`) — `@alaarab/ogrid-angular`

Angular v21 services with signals (`signal()`, `computed()`, `effect()`). Standalone components with inline templates. Zone-less by default. Depends on `@alaarab/ogrid-core`.

**Services:**
- `OGridService` — Signals-based orchestration (equivalent to React `useOGrid`). Pagination, sorting, filtering, column visibility, row selection, sidebar management, server-side data fetching.
- `DataGridStateService` — Grid interaction state (6 sub-objects: layout, rowSelection, editing, interaction, contextMenu, viewModels).

**Components:** `OGridLayoutComponent`, `StatusBarComponent`, `GridContextMenuComponent`, `SideBarComponent`, `MarchingAntsOverlayComponent`, `EmptyStateComponent`

### Angular UI Packages (`packages/angular-material/`, `packages/angular-primeng/`)

Both expose the same component API and depend on `@alaarab/ogrid-angular`:
- `OGridComponent` — Top-level data table
- `DataGridTableComponent` — Lower-level grid
- `ColumnHeaderFilterComponent` — Column filtering UI
- `ColumnChooserComponent` — Column visibility dropdown
- `PaginationControlsComponent` — Pagination UI
- `InlineCellEditorComponent` — Inline cell editor (PrimeNG only)

All re-export everything from `@alaarab/ogrid-angular` (which re-exports from `@alaarab/ogrid-core`).

### Vue (`packages/vue/src/`) — `@alaarab/ogrid-vue`

Vue 3 Composition API composables using `ref()`, `computed()`, `watch()`. Depends on `@alaarab/ogrid-core`.

**Composables (27):**
- Orchestration: `useOGrid`, `useDataGridState`
- Feature: `useActiveCell`, `useCellEditing`, `useCellSelection`, `useClipboard`, `useColumnResize`, `useContextMenu`, `useFillHandle`, `useKeyboardNavigation`, `useRowSelection`, `useUndoRedo`, `useFilterOptions`, `useDebounce`, `useTableLayout`
- Headless state: `useColumnChooserState`, `useColumnHeaderFilterState`, `useInlineCellEditorState`, `useRichSelectState`, `useSideBarState`, `useTextFilterState`, `useMultiSelectFilterState`, `useDateFilterState`, `usePeopleFilterState`

**Utilities:** `getHeaderFilterConfig`, `getCellRenderDescriptor`, `resolveCellDisplayContent`, `resolveCellStyle`, `buildInlineEditorProps`, `buildPopoverEditorProps`, `getCellInteractionProps`

### Vue UI Packages (`packages/vue-vuetify/`, `packages/vue-primevue/`)

Both expose the same component API and depend on `@alaarab/ogrid-vue`:
- `OGrid` — Top-level data table
- `DataGridTable` — Lower-level grid (with InlineCellEditor, StatusBar, GridContextMenu)
- `ColumnHeaderFilter` — Column filtering UI (with TextFilterPopover, MultiSelectFilterPopover, PeopleFilterPopover)
- `ColumnChooser` — Column visibility dropdown
- `PaginationControls` — Pagination UI

All re-export everything from `@alaarab/ogrid-vue` (which re-exports from `@alaarab/ogrid-core`).

### JS (`packages/js/src/`) — `@alaarab/ogrid-js`

Vanilla JS data grid with no framework dependency. Full feature parity with React. Class-based state with EventEmitter (replaces React hooks). Depends on `@alaarab/ogrid-core`.

**State classes:**
- `GridState` — Core data state (sorting, filtering, pagination, columns, server-side fetch). Combines `useOGrid` + `useDataGridState`.
- `SelectionState` — Active cell, selection range, drag selection via RAF + `data-drag-range` attributes
- `FillHandleState` — Drag-to-fill with RAF optimization, batch undo support
- `RowSelectionState` — Single/multiple modes, shift-click range, select-all/deselect-all
- `ColumnResizeState` — Drag column borders to resize
- `ColumnPinningState` — Sticky left/right column positioning with cumulative offsets
- `UndoRedoState` — Edit history with batch support (`beginBatch`/`endBatch`)
- `SideBarState` — Panel management (columns, filters), position (left/right)
- `HeaderFilterState` — Text/multiSelect/date filter popover state, apply/clear
- `TableLayoutState` — ResizeObserver-based container measurement, column width computation

**Components:**
- `TableRenderer` — DOM rendering (`<table>`, headers, rows, cells, pinning styles, filter icons, checkbox column)
- `InlineCellEditor` — Text/select/checkbox/date inline editors
- `PaginationControls` — Page navigation with page size dropdown
- `StatusBar` — Row count, filtered count, selection aggregations
- `ColumnChooser` — Show/hide columns dropdown
- `SideBar` — Sidebar with columns panel (checkboxes) and filters panel (text/multiSelect/date inputs)
- `HeaderFilter` — Positioned filter popovers per column
- `MarchingAntsOverlay` — SVG animated copy/cut selection border

**Entry point:** `OGrid` class — constructor takes a container element + `OGridOptions<T>`, wires all state and components, exposes `getApi()` and `destroy()`.

### React UI Packages (`packages/react-radix/`, `packages/react-fluent/`, `packages/react-material/`)

All three expose the same component API and depend on `@alaarab/ogrid-react`:
- `OGrid` — Top-level data table (accepts `ref` for `IOGridApi`)
- `DataGridTable` — Lower-level grid
- `ColumnHeaderFilter` — Column filtering UI (text, multiSelect, people)
- `ColumnChooser` — Column visibility dropdown
- `PaginationControls` — Pagination UI

All re-export everything from `@alaarab/ogrid-react` (which re-exports from `@alaarab/ogrid-core`).

**Feature parity:** All three React UI packages, both Angular UI packages, and both Vue UI packages support the same features and export the same component shapes within their respective framework.

### Layout Architecture

`OGridLayout` wraps everything in a **single bordered container**:

```
[deprecated title above]
┌───────────────────────────────────────────────┐
│ [Toolbar strip]  custom | columnChooser        │
├───────────────────────────────────────────────┤
│ [Sidebar]? [DataGridTable + StatusBar]         │
├───────────────────────────────────────────────┤
│ [Footer strip]  pagination controls            │
└───────────────────────────────────────────────┘
```

- **`columnChooser`** prop on `IOGridProps`: `boolean | 'toolbar' | 'sidebar'` (default `true`/`'toolbar'`). Controls where column chooser renders.
- **`toolbar`** prop: `ReactNode` — custom content in left side of toolbar strip.
- **`toolbarEnd`** prop on `OGridLayoutProps`: right side of toolbar (column chooser goes here).
- **`title`** prop: **deprecated** — renders above the bordered container. Consumers should render their own heading outside `<OGrid>`.
- DataGridTable has **no outer border/radius** (the container provides it).
- PaginationControls has **no border-top/padding** (the footer strip provides it).

### Data Flow

- **Client-side:** Pass `data` array — sorting, filtering, pagination in-memory
- **Server-side:** Pass `dataSource` implementing `IDataSource<T>` — grid calls `fetchPage()` with params

### State

**React packages:** Pure React hooks. No external state libraries. Supports uncontrolled (internal) and controlled (parent passes values + `on*Change` callbacks) modes.

**JS package:** Class-based state with EventEmitter. `GridState` = `useOGrid` + `useDataGridState` combined.

## Testing

**2,028 tests** across 14 packages (100% pass rate). Each framework uses its native testing tools for maintainability and idiomaticity.

- **Core:** 237 tests (pure TypeScript utilities, no framework dependencies)
- **JS:** 241 tests (native DOM testing)
- **React packages:** 523 tests using React Testing Library 16
  - React core: 247 tests
  - Radix/Fluent/Material: 92 tests each
- **Angular packages:** 505 tests using Angular Testing utilities
  - Angular base: 111 tests
  - Angular Material: 131 tests
  - Angular PrimeNG: 132 tests
  - Angular Radix: 131 tests
- **Vue packages:** 522 tests (composable-level + factory tests)
  - Vue base: 222 tests
  - Vuetify: 100 tests
  - PrimeVue: 100 tests
  - Vue Radix: 100 tests
  - **Note:** Vue UI packages do NOT have `exports.test.ts` files (intentionally skipped - see `__tests__/README.md` in each package). Vue 3 SFCs are ESM-only and cannot be loaded via CommonJS `require()` which Jest uses for export tests. Factory tests already verify all exports work correctly.

### Testing Setup

- Jest 29 + ts-jest, jsdom environment, 10s timeout
- Core tests: `packages/core/src/*/__tests__/**/*.test.ts(x)`
- UI tests: `packages/*/src/__tests__/**/*.test.ts(x)`

### Framework-Specific Testing

Each framework uses its idiomatic testing tools:

- **React:** React Testing Library for component testing (render, screen, userEvent, waitFor)
- **Angular:** Angular Testing utilities (TestBed, ComponentFixture, fakeAsync)
- **Vue:** Vue Test Utils (mount, shallowMount, wrapper queries)
- **JS:** Native DOM APIs + jsdom (querySelector, addEventListener, dispatchEvent)

Tests are co-located with components in `__tests__/` directories.

### Framework Mocks

- Fluent: `packages/react-fluent/jest-mocks/fluentui-react-components.cjs.js`
- Material: `packages/react-material/jest-mocks/mui-material.cjs.js`, `mui-icons-material.cjs.js`

When adding new MUI component props in tests, update the mock (e.g., `MenuListProps` passthrough on `Menu`).

### Known Testing Pitfalls

- **Fake timers + async:** `jest.useFakeTimers()` deadlocks `waitFor`/`findByText` (they poll via `setTimeout`). Use real timers: `await act(async () => { await new Promise(r => setTimeout(r, 350)); })`
- **Destructuring defaults in hooks:** `const { selectedValues = [] } = params` creates a new array ref each render, causing infinite re-render loops in `useEffect` deps. Use `const { selectedValues } = params; const safe = selectedValues ?? STABLE_EMPTY;`
- **Material popover gating:** Don't gate MUI `Popover open` on `!!popoverPosition` — the position is set via `setTimeout(0)` which blocks sync tests. Use `open={isFilterOpen && filterType !== 'none'}`.

## Build

All packages emit ESM to `dist/esm/` + type declarations to `dist/types/`. Fluent and Radix also compile SCSS via `scripts/compile-styles.js`.

- `tsconfig.json` — Dev config (includes tests)
- `tsconfig.build.json` — Build config (excludes tests, emits to `dist/`)

Core must be built before UI packages. Turborepo handles this.

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`): push to `main` + PRs. Node 22, ubuntu-latest. Steps: `npm ci` → `npm run build` → `npm run test:all` → `npm run lint`.

## Conventions

1. **TypeScript strict mode** — Do not weaken type safety.
2. **ESM-first** — `import`/`export`, not `require`.
3. **Peer deps** — Fluent UI, MUI are peer deps. Radix UI is bundled as a regular dep.
4. **Component structure** — Each component in its own PascalCase directory with co-located styles and stories.
5. **Naming** — `I` prefix for interfaces (`IColumnDef`, `IDataSource`).
6. **Test co-location** — Tests in `__tests__/` dirs. Each framework uses native testing tools.
7. **Headless architecture** — Core owns types and utilities; React owns hooks and state logic; UI packages are thin view layers.
8. **Feature parity** — All UI packages within each framework must support the same features and pass the same tests. Cross-framework parity: React (3 packages), Angular (2 packages), Vue (2 packages), and JS (1 package) all share the same headless core and expose equivalent APIs.
9. **Type deduplication** — React's `IColumnDef<T>` extends Core's `IColumnDef<T>` (not a duplicate). React-specific additions (`renderCell`, `cellStyle`, React `cellEditor` types) are in the extension. `dataGridTypes.ts` re-exports shared types from Core. Safe casts (`as IColumnDef<T>[]`) are used at framework boundaries where Core utilities return Core types.

## Pre-Commit Verification (MANDATORY)

**BEFORE ANY `git commit`**, run this comprehensive verification checklist:

### 1. Version Synchronization
```bash
# Check root version
grep '"version"' package.json

# Verify all packages match (should see same version 14 times)
grep -r '"version"' packages/*/package.json | grep -v node_modules

# Check StackBlitz version constant
grep 'OGRID_VERSION' packages/docs/src/stackblitz/projects.ts
```
✅ All versions must match

### 2. Full Build
```bash
npm run build
```
✅ Must complete with zero errors across all 15 packages

### 3. Full Test Suite
```bash
npm run test:all
```
✅ All 2000+ tests must pass, zero errors, zero warnings

### 4. Lint
```bash
npm run lint
```
✅ Must show zero errors, zero warnings

### 5. Git Status Review
```bash
git status
```
✅ No untracked .env, credentials, or temp files

**OUTPUT:** Report ✅ ALL CHECKS PASSED or ❌ ISSUES FOUND with details

**ONLY COMMIT IF ALL CHECKS PASS** (unless user explicitly overrides)

## Definition of Done

**Every feature, fix, or change must satisfy ALL of these before it's considered complete.** Use a TodoWrite checklist to track progress.

### 1. Code
- [ ] Implementation in core (headless hooks/utils) when possible — avoid duplicating logic in UI packages.
- [ ] If UI package changes are needed, update **all** UI packages equally:
  - **React:** Radix, Fluent, Material (3 packages)
  - **Angular:** Angular Material, PrimeNG (2 packages)
  - **Vue:** Vuetify, PrimeVue (2 packages)
  - **JS:** ogrid-js (1 package)
- [ ] Types exported from `core/src/types/index.ts` and `core/src/index.ts` as needed.

### 2. Tests
- [ ] Core unit tests for new hooks/utilities in `core/src/*/__tests__/`.
- [ ] If UI-specific rendering is involved, add tests to each UI package using native testing tools (React Testing Library, Angular Testing utilities, Vue Test Utils).
- [ ] Run `npm run test:all` — **all tests must pass** across all 14 packages.

### 3. Build
- [ ] Run `npm run build` — must succeed with zero errors.

### 4. Storybook
- [ ] If the feature adds or changes **visual UI** (new component, new cell editor, new panel, changed styles), add or update a story in all relevant React UI packages (Radix, Fluent, Material).
- [ ] Stories should demonstrate the feature interactively (not just render it). Use args/controls where useful.
- [ ] Pure headless/keyboard-only changes (like keyboard shortcuts) don't need new stories unless they visibly change UI.

### 5. Documentation — Feature Pages
- [ ] Update the relevant page in `packages/docs/docs/features/` (or create one for new features).
- [ ] Feature page must have **4 framework tabs**: React, Angular, Vue, Vanilla JS (`groupId="framework"`).
  - **React tab:** Show Radix import as default + tip admonition listing Fluent/Material alternatives.
  - **Angular tab:** Show Angular Material import + tip listing PrimeNG alternative.
  - **Vue tab:** Show Vuetify import + tip listing PrimeVue alternative.
  - **JS tab:** Show `@alaarab/ogrid-js` usage.
- [ ] Update `README.md` feature list if the feature is user-facing.
- [ ] Update `CLAUDE.md` if conventions, architecture, or API surface changed.

### 6. Documentation — StackBlitz Demos
- [ ] Add a `FeatureDemoSet` entry in `packages/docs/src/stackblitz/featureDemos.ts` with working code for all 4 frameworks (React, Angular, Vue, JS).
- [ ] Update the feature's demo component to pass `stackblitz={featureName}` to `<LiveDemo>`.
- [ ] StackBlitz projects reference the **current published version** of `@alaarab/ogrid-*` packages.

### 7. Documentation — Framework Showcase
- [ ] If adding a **new UI package**, add its section to `packages/docs/docs/guides/framework-showcase.mdx` with install command, code example, and StackBlitz button.
- [ ] Update the comparison table in framework-showcase.mdx to include the new package.

### 8. Memory
- [ ] Update `MEMORY.md` with key decisions, patterns, and test counts.

### 9. No Unnecessary Duplication
- [ ] State logic stays in core hooks — UI packages should only add view-layer code.
- [ ] If the same pattern appears in 2+ UI packages, consider a shared factory or headless component.

### Parity Matrix

When any feature changes, these artifacts must stay in sync:

| Artifact | Scope | Location |
|----------|-------|----------|
| **Core logic** | 1 (shared) | `packages/core/src/` |
| **React hooks** | 1 (shared) | `packages/react/src/` |
| **React UI** | 3 packages | `packages/react-{radix,fluent,material}/` |
| **Angular services** | 1 (shared) | `packages/angular/src/` |
| **Angular UI** | 2 packages | `packages/angular-{material,primeng}/` |
| **Vue composables** | 1 (shared) | `packages/vue/src/` |
| **Vue UI** | 2 packages | `packages/vue-{vuetify,primevue}/` |
| **Vanilla JS** | 1 package | `packages/js/src/` |
| **Tests** | 14 packages | All `__tests__/` dirs — native testing tools per framework |
| **Storybook** | 3 (React UI) | `packages/react-{radix,fluent,material}/src/stories/` |
| **Feature docs** | 1 file per feature | `packages/docs/docs/features/*.mdx` — 4 framework tabs each |
| **StackBlitz demos** | 1 entry per feature | `packages/docs/src/stackblitz/featureDemos.ts` — 4 frameworks each |
| **Demo components** | 1 per feature | `packages/docs/src/components/demos/*Demo.tsx` — pass `stackblitz` prop |
| **Framework showcase** | 1 page | `packages/docs/docs/guides/framework-showcase.mdx` — all 8 UI packages |

## View Layer Architecture (Phase 2 Complete)

State and behavior are centralized in the React package (`@alaarab/ogrid-react`). Each UI package's `renderCellContent` is a thin ~50-line mapping from React-computed descriptors to framework-specific JSX, using 6 helpers: `getCellRenderDescriptor`, `buildInlineEditorProps`, `buildPopoverEditorProps`, `getCellInteractionProps`, `resolveCellDisplayContent`, `resolveCellStyle`.

| What's in React (`@alaarab/ogrid-react`) | What's per-framework |
|---|---|
| `useDataGridState`, all sub-hooks, types, utils | Table primitives (Fluent DataGrid vs MUI Table vs native `<table>`) |
| `getCellRenderDescriptor` + 5 builder helpers | Popover rendering (Radix/Fluent/MUI popover APIs) |
| `getHeaderFilterConfig` | Header filter rendering (framework-specific popovers) |
| `getPaginationViewModel` | Pagination rendering (Fluent/MUI/native buttons) |
| `processClientSideData` | CSS/styling (CSS modules vs MUI sx) |
