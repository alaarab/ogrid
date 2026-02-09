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
```

## Architecture

### Core (`packages/core/src/`)

**Types** — `IColumnDef`, `IColumnGroupDef`, `IDataSource`, `IFilters`, `UserLike`, `IOGridApi`, `IOGridProps`, `ICellEditorProps`, etc. in `types/`.

**Orchestration hooks:**
- `useOGrid` — Pagination, sorting, filtering, visibility, editing, row selection, status bar. Exposes `IOGridApi` ref.
- `useDataGridState` — All DataGridTable state (layout, selection, editing, keyboard, clipboard, context menu).

**Headless state hooks** (consumed by UI packages):
- `useColumnHeaderFilterState` — Filter popover state (open, temp values, apply/clear, people search debounce)
- `useColumnChooserState` — Column visibility dropdown
- `useInlineCellEditorState` — Inline cell editor

**Feature hooks:** `useActiveCell`, `useCellEditing`, `useCellSelection`, `useRowSelection`, `useKeyboardNavigation`, `useClipboard`, `useFillHandle`, `useUndoRedo`, `useContextMenu`, `useFilterOptions`, `useDebounce`

**Utilities:** `exportToCsv`, `getCellValue`, `flattenColumns`, `getPaginationViewModel`, `getHeaderFilterConfig`, `getCellRenderDescriptor`, `getStatusBarParts`, `GRID_CONTEXT_MENU_ITEMS`, `getContextMenuHandlers`

**Headless components:** `OGridLayout`, `StatusBar`, `GridContextMenu`

### UI Packages (`packages/fluent/`, `packages/material/`, `packages/radix/`)

All three expose the same component API:
- `OGrid` — Top-level data table (accepts `ref` for `IOGridApi`)
- `DataGridTable` — Lower-level grid
- `ColumnHeaderFilter` — Column filtering UI (text, multiSelect, people)
- `ColumnChooser` — Column visibility dropdown
- `PaginationControls` — Pagination UI

All re-export everything from `@alaarab/ogrid-core`.

### Data Flow

- **Client-side:** Pass `data` array — sorting, filtering, pagination in-memory
- **Server-side:** Pass `dataSource` implementing `IDataSource<T>` — grid calls `fetchPage()` with params

### State

Pure React hooks. No external state libraries. Supports uncontrolled (internal) and controlled (parent passes values + `on*Change` callbacks) modes.

## Testing

**266 tests** across 4 packages (Core: 86, Radix: 60, Fluent: 60, Material: 60).

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

Factories: `createColumnChooserTests`, `createPaginationControlsTests`, `createColumnHeaderFilterTests`, `createDataGridTableTests`, `createOGridTests`, `createSpreadsheetTests`

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

## Remaining Duplication (Future Work)

State and behavior are centralized in core. The remaining triplication is in the **view layer** of DataGridTable:

| What's shared | What's triplicated |
|---|---|
| `useDataGridState`, all sub-hooks, types, utils | Table primitives (Fluent DataGrid vs MUI Table vs native `<table>`) |
| `getCellRenderDescriptor` (cell mode, flags) | Cell rendering (editing vs display, active/range styling) |
| `getHeaderFilterConfig` | Header filter rendering (Fluent/MUI/Radix popovers) |
| `getPaginationViewModel` | Pagination rendering (Fluent/MUI/native buttons) |

**Next step (Phase 2):** Use `getCellRenderDescriptor` in all three DataGridTable implementations so cell rendering is "map descriptor to component" instead of reimplementing the booleans and callbacks. This would make each DataGridTable a thin mapping from descriptors to framework-specific primitives.
