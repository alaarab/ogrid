# CLAUDE.md — OGrid

## Project Overview

OGrid is a lightweight, multi-framework data grid library. A pure-TypeScript core provides types, algorithms, and utilities. Framework-specific packages wrap the core for **React** (with **Fluent UI**, **Material UI**, and **Radix UI** implementations) and **vanilla JS**.

- **Author:** Ala Arab
- **License:** MIT
- **Node:** >= 18 (developed with Node 22 via nvm)
- **React:** 17, 18, or 19
- **Language:** TypeScript 5.7 (strict mode)

## Monorepo Structure

```
packages/
  core/             → @alaarab/ogrid-core           — Pure TS types, algorithms, utilities (zero deps)
  react/            → @alaarab/ogrid-react           — React hooks, headless components, shared test factories
  react-radix/      → @alaarab/ogrid-react-radix     — Radix UI implementation (default, lightweight)
  react-fluent/     → @alaarab/ogrid-react-fluent    — Fluent UI implementation
  react-material/   → @alaarab/ogrid-react-material  — Material UI implementation
  js/               → @alaarab/ogrid-js              — Vanilla JS data grid (class-based, no framework)
  docs/             → @alaarab/ogrid-docs             — Docusaurus documentation site (private)
  examples/         → @alaarab/ogrid-examples         — Vite-powered example apps (private)
```

**Dependency graph:**
```
@alaarab/ogrid-core (zero deps)
├── @alaarab/ogrid-react       → core
│   ├── @alaarab/ogrid-react-radix
│   ├── @alaarab/ogrid-react-fluent
│   └── @alaarab/ogrid-react-material
└── @alaarab/ogrid-js          → core
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

**954 tests** across 6 packages (Core: 237, JS: 194, React: 247, Radix: 92, Fluent: 92, Material: 92).

- Jest 29 + React Testing Library 16 + ts-jest, jsdom environment, 10s timeout
- Core tests: `packages/core/src/*/__tests__/**/*.test.ts(x)`
- UI tests: `packages/*/src/__tests__/**/*.test.ts(x)`

### Shared Test Factories

UI package tests are **5-line wrappers** calling shared factories from `core/src/testing/`:

```typescript
// Example: packages/react-radix/src/__tests__/DataGridTable.test.tsx
import { DataGridTable } from '../DataGridTable/DataGridTable';
import { createDataGridTableTests } from '@alaarab/ogrid-core/testing';
describe('DataGridTable', () => { createDataGridTableTests(DataGridTable); });
```

Factories: `createColumnChooserTests`, `createPaginationControlsTests`, `createColumnHeaderFilterTests`, `createDataGridTableTests`, `createOGridTests`, `createSpreadsheetTests`, `createColumnGroupTests`, `createSideBarTests`

Mapped in all jest configs: `moduleNameMapper: { '^@alaarab/ogrid-core/testing': '<rootDir>/../core/src/testing/index.ts' }`

`core/tsconfig.json` excludes `**/testing/**` from production build (testing files use jest globals).

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
6. **Test co-location** — Tests in `__tests__/` dirs. UI package tests use shared factories.
7. **Headless architecture** — Core owns types and utilities; React owns hooks and state logic; UI packages are thin view layers.
8. **Feature parity** — All three React UI packages must support the same features and pass the same tests. The JS package has full feature parity with React.
9. **Type deduplication** — React's `IColumnDef<T>` extends Core's `IColumnDef<T>` (not a duplicate). React-specific additions (`renderCell`, `cellStyle`, React `cellEditor` types) are in the extension. `dataGridTypes.ts` re-exports shared types from Core. Safe casts (`as IColumnDef<T>[]`) are used at framework boundaries where Core utilities return Core types.

## Definition of Done

**Every feature, fix, or change must satisfy ALL of these before it's considered complete.** Use a TodoWrite checklist to track progress.

### 1. Code
- [ ] Implementation in core (headless hooks/utils) when possible — avoid duplicating logic in UI packages.
- [ ] If UI package changes are needed, update **all three** (Radix, Fluent, Material) equally.
- [ ] Types exported from `core/src/types/index.ts` and `core/src/index.ts` as needed.

### 2. Tests
- [ ] Core unit tests for new hooks/utilities in `core/src/*/__tests__/`.
- [ ] If UI-specific rendering is involved, add a shared test factory in `core/src/testing/` and call it from all 3 UI packages.
- [ ] Run `npm run test:all` — **all tests must pass** across all 6 packages.

### 3. Build
- [ ] Run `npm run build` — must succeed with zero errors.

### 4. Storybook
- [ ] If the feature adds or changes **visual UI** (new component, new cell editor, new panel, changed styles), add or update a story in all relevant UI packages.
- [ ] Stories should demonstrate the feature interactively (not just render it). Use args/controls where useful.
- [ ] Pure headless/keyboard-only changes (like keyboard shortcuts) don't need new stories unless they visibly change UI.

### 5. Documentation
- [ ] Update the relevant page in `packages/docs/docs/features/` (or create one for new features).
- [ ] Update `README.md` feature list if the feature is user-facing.
- [ ] Update `CLAUDE.md` if conventions, architecture, or API surface changed.

### 6. Memory
- [ ] Update `MEMORY.md` with key decisions, patterns, and test counts.

### 7. No Unnecessary Duplication
- [ ] State logic stays in core hooks — UI packages should only add view-layer code.
- [ ] If the same pattern appears in 2+ UI packages, consider a shared factory or headless component.

## View Layer Architecture (Phase 2 Complete)

State and behavior are centralized in the React package (`@alaarab/ogrid-react`). Each UI package's `renderCellContent` is a thin ~50-line mapping from React-computed descriptors to framework-specific JSX, using 6 helpers: `getCellRenderDescriptor`, `buildInlineEditorProps`, `buildPopoverEditorProps`, `getCellInteractionProps`, `resolveCellDisplayContent`, `resolveCellStyle`.

| What's in React (`@alaarab/ogrid-react`) | What's per-framework |
|---|---|
| `useDataGridState`, all sub-hooks, types, utils | Table primitives (Fluent DataGrid vs MUI Table vs native `<table>`) |
| `getCellRenderDescriptor` + 5 builder helpers | Popover rendering (Radix/Fluent/MUI popover APIs) |
| `getHeaderFilterConfig` | Header filter rendering (framework-specific popovers) |
| `getPaginationViewModel` | Pagination rendering (Fluent/MUI/native buttons) |
| `processClientSideData` | CSS/styling (CSS modules vs MUI sx) |
