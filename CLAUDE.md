# CLAUDE.md — OGrid

## Project Overview

OGrid is a lightweight, framework-agnostic React data grid library with separate implementations for **Fluent UI**, **Material UI**, and **Radix UI**, sharing a core of types, hooks, and utilities.

- **Author:** Ala Arab
- **License:** MIT
- **Node:** >= 18 (developed with Node 22 via nvm)
- **React:** 17, 18, or 19
- **Language:** TypeScript 5.7 (strict mode)

## Monorepo Structure

```
packages/
  core/       → @alaarab/ogrid-core      — Types, hooks, utilities, headless components, shared test factories
  fluent/     → @alaarab/ogrid-fluent     — Fluent UI implementation
  material/   → @alaarab/ogrid-material   — Material UI implementation
  radix/      → @alaarab/ogrid            — Radix UI implementation (default, lightweight)
  docs/       → Docusaurus documentation site (features, API reference, guides)
  examples/   → @alaarab/ogrid-examples   — Vite-powered example apps (private)
```

Managed with **npm workspaces** and **Turborepo**.

## Commands

```bash
npm ci                          # Install
npm run build                   # Build all (Turborepo dependency order)
npm run test:all                # Test all packages
npm run test:core               # Test core only (also: test:fluent, test:material, test:radix)
npm run lint                    # ESLint
npm run storybook:fluent        # Storybook on port 6006 (also: storybook:material :6007, storybook:radix :6008)
npm run docs:dev                # Docusaurus dev server
npm run docs:build              # Build docs site
```

## Architecture

### Core (`packages/core/src/`)

**Types** — `IColumnDef`, `IColumnGroupDef`, `IDataSource`, `IFilters`, `IDateFilterValue`, `UserLike`, `IOGridApi`, `IOGridProps`, `ICellEditorProps`, `FilterValue`, etc. in `types/`. Column types: `'text' | 'numeric' | 'date' | 'boolean'`. Filter types: `'none' | 'text' | 'multiSelect' | 'people' | 'date'`. `FilterValue` is a discriminated union: `{ type: 'text', value: string } | { type: 'multiSelect', value: string[] } | { type: 'people', value: UserLike } | { type: 'date', value: IDateFilterValue }`.

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

### UI Packages (`packages/fluent/`, `packages/material/`, `packages/radix/`)

All three expose the same component API:
- `OGrid` — Top-level data table (accepts `ref` for `IOGridApi`)
- `DataGridTable` — Lower-level grid
- `ColumnHeaderFilter` — Column filtering UI (text, multiSelect, people)
- `ColumnChooser` — Column visibility dropdown
- `PaginationControls` — Pagination UI

All re-export everything from `@alaarab/ogrid-core`.

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

Pure React hooks. No external state libraries. Supports uncontrolled (internal) and controlled (parent passes values + `on*Change` callbacks) modes.

## Testing

**521 tests** across 4 packages (Core: 245, Radix: 92, Fluent: 92, Material: 92).

- Jest 29 + React Testing Library 16 + ts-jest, jsdom environment, 10s timeout
- Core tests: `packages/core/src/*/__tests__/**/*.test.ts(x)`
- UI tests: `packages/*/src/__tests__/**/*.test.ts(x)`

### Shared Test Factories

UI package tests are **5-line wrappers** calling shared factories from `core/src/testing/`:

```typescript
// Example: packages/radix/src/__tests__/DataGridTable.test.tsx
import { DataGridTable } from '../DataGridTable/DataGridTable';
import { createDataGridTableTests } from '@alaarab/ogrid-core/testing';
describe('DataGridTable', () => { createDataGridTableTests(DataGridTable); });
```

Factories: `createColumnChooserTests`, `createPaginationControlsTests`, `createColumnHeaderFilterTests`, `createDataGridTableTests`, `createOGridTests`, `createSpreadsheetTests`, `createColumnGroupTests`, `createSideBarTests`

Mapped in all jest configs: `moduleNameMapper: { '^@alaarab/ogrid-core/testing': '<rootDir>/../core/src/testing/index.ts' }`

`core/tsconfig.json` excludes `**/testing/**` from production build (testing files use jest globals).

### Framework Mocks

- Fluent: `packages/fluent/jest-mocks/fluentui-react-components.cjs.js`
- Material: `packages/material/jest-mocks/mui-material.cjs.js`, `mui-icons-material.cjs.js`

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
7. **Headless architecture** — Core owns all state logic; UI packages are thin view layers.
8. **Feature parity** — All three UI packages must support the same features and pass the same tests.

## Agent Workflow

Opus is the **orchestrator**. For multi-step tasks, break the work into well-scoped subtasks and delegate to **Sonnet subagents** (up to 3 concurrently). Sonnet is highly capable and cheaper — use it for mechanical, well-defined work.

### When to Use Subagents
- **Parallel UI package changes** — e.g., send one Sonnet per package (Radix, Fluent, Material) when implementing the same view-layer change across all three.
- **Independent workstreams** — e.g., one agent writes tests while another updates docs while another implements the feature in core.
- **Research + implementation** — e.g., one agent explores the codebase while another starts on the parts that are already clear.

### Rules
1. **Max 3 subagents at a time.** Don't over-parallelize — keep tasks non-overlapping so agents don't edit the same files.
2. **Use `model: "sonnet"` for subagents.** Reserve Opus for orchestration, planning, and complex decisions.
3. **Give each agent a complete, self-contained prompt.** Include file paths, expected patterns, and clear acceptance criteria so the agent can work autonomously.
4. **Avoid file conflicts.** Don't send two agents to edit the same file. If tasks touch shared files, run them sequentially or split the file edits so each agent owns a distinct section.
5. **Verify after merge.** After subagent results come back, run `npm run test:all` and `npm run build` from the orchestrator to catch integration issues.

## Definition of Done

**Every feature, fix, or change must satisfy ALL of these before it's considered complete.** Use a TodoWrite checklist to track progress.

### 1. Code
- [ ] Implementation in core (headless hooks/utils) when possible — avoid duplicating logic in UI packages.
- [ ] If UI package changes are needed, update **all three** (Radix, Fluent, Material) equally.
- [ ] Types exported from `core/src/types/index.ts` and `core/src/index.ts` as needed.

### 2. Tests
- [ ] Core unit tests for new hooks/utilities in `core/src/*/__tests__/`.
- [ ] If UI-specific rendering is involved, add a shared test factory in `core/src/testing/` and call it from all 3 UI packages.
- [ ] Run `npm run test:all` — **all tests must pass** across all 4 packages.

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

State and behavior are centralized in core. Each UI package's `renderCellContent` is a thin ~50-line mapping from core-computed descriptors to framework-specific JSX, using 6 core helpers: `getCellRenderDescriptor`, `buildInlineEditorProps`, `buildPopoverEditorProps`, `getCellInteractionProps`, `resolveCellDisplayContent`, `resolveCellStyle`.

| What's in core | What's per-framework |
|---|---|
| `useDataGridState`, all sub-hooks, types, utils | Table primitives (Fluent DataGrid vs MUI Table vs native `<table>`) |
| `getCellRenderDescriptor` + 5 builder helpers | Popover rendering (Radix/Fluent/MUI popover APIs) |
| `getHeaderFilterConfig` | Header filter rendering (framework-specific popovers) |
| `getPaginationViewModel` | Pagination rendering (Fluent/MUI/native buttons) |
| `processClientSideData` | CSS/styling (CSS modules vs MUI sx) |
