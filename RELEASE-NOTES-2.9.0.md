# OGrid 2.9.0 — Spreadsheet behavior for any table chrome

**TL;DR:** OGrid now ships six headless hooks for inline edit, range select,
fill handle, copy/paste, undo/redo, and keyboard navigation. Drop them on
your shadcn `<Table>`, your Material `<mat-table>`, your own `<table>` —
anything. Same logic the built-in `<OGrid>` uses, available as composable
hooks on React, Vue, and Angular. MIT-licensed.

## What's new

### Six headless hooks across three frameworks

| Hook (React / Vue) | Factory (Angular) | Purpose |
|---|---|---|
| `useInlineEdit` | `createInlineEdit` | Cell-edit lifecycle (start / commit / cancel) with `valueParser` validation |
| `useRangeSelection` | `createRangeSelection` | Excel-style anchor + focus range, `isInRange`, `selectAll` |
| `useFillHandle` | `createFillHandle` | Drag-to-fill with type-compatibility checks and smart-fill series |
| `useCellClipboard` | `createCellClipboard` | TSV copy/cut/paste round-trippable through Excel + Google Sheets |
| `useUndoRedo` | `createUndoRedo` | Wraps `onCellEdit` with an undo/redo history stack |
| `useGridFocus` | `createGridFocus` | Arrow / Tab / Enter / Home / End / PageUp / PageDown navigation |

All compose around `useHeadlessGrid` (shipped in 2.8.1) as the data layer.
The existing `<OGrid>` component is unchanged — these hooks are purely
additive.

### Why this matters

Until now, "I want spreadsheet features on my shadcn table" meant either:

- Use **AG Grid Enterprise** ($1,400/dev/year, fights your design system), or
- Use **TanStack Table** (great composition, but you build inline edit / fill
  handle / range select / clipboard yourself), or
- Use **OGrid `<OGrid>` component** (great features, but the chrome is opinionated).

OGrid 2.9.0 is the only library that gives you **AG-Grid-Enterprise-tier
spreadsheet features as headless hooks, MIT-licensed, on the framework you
already use**. Compose them onto whatever chrome fits your app.

## Quick start

```tsx
import {
  useHeadlessGrid,
  useInlineEdit,
  useRangeSelection,
  useFillHandle,
  useCellClipboard,
  useUndoRedo,
  useGridFocus,
} from "@alaarab/ogrid-react-radix";

const grid = useHeadlessGrid({ columns, data, getRowId: (r) => r.id });
const range = useRangeSelection({
  rowCount: grid.rows.length,
  colCount: grid.columns.length,
});
const undo = useUndoRedo({ onCellValueChanged: applyEdit });
const edit = useInlineEdit({
  columns,
  getRowId: (r) => r.id,
  onCellEdit: undo.onCellValueChanged,
});
const fill = useFillHandle({
  rangeSelection: range,
  rows: grid.rows,
  columns,
  onFillCells: (events) => events.forEach(undo.onCellValueChanged),
});
const clipboard = useCellClipboard({
  rangeSelection: range,
  rows: grid.rows,
  columns,
  onCellEdit: (events) => events.forEach(undo.onCellValueChanged),
});
const focus = useGridFocus({
  rowCount: grid.rows.length,
  colCount: grid.columns.length,
  rangeSelection: range,
});

// Render with your own table chrome. See the SpreadsheetDemo Storybook
// story for ~200 lines of full integration code on a plain HTML table.
```

## See it live

The canonical demo combining all six hooks:
**`packages/react-radix/src/OGrid/SpreadsheetDemo.stories.tsx`**

Run locally:

```bash
npm run storybook:react-radix
# Open http://localhost:6008 → OGrid / React Radix / SpreadsheetDemo
```

The demo gives you double-click cell edit, click+drag range selection,
drag-to-fill from the bottom-right corner, Cmd/Ctrl+C/X/V for clipboard,
Cmd/Ctrl+Z for undo, and full keyboard navigation — all on a plain HTML
table that's ~200 lines you can copy into your project.

## Per-package quick reference

**React** — `@alaarab/ogrid-react`, `@alaarab/ogrid-react-radix`
- All six hooks export from both packages
- React `useHeadlessGrid` ships server-side `dataSource` mode + worker sort

**Vue** — `@alaarab/ogrid-vue`, `@alaarab/ogrid-vue-radix`
- All six composables export with Vue-native ref/computed reactivity
- `useHeadlessGrid` is client-side-only in 2.9.0; server-side parity comes in 2.9.x

**Angular** — `@alaarab/ogrid-angular`, `@alaarab/ogrid-angular-radix`
- All six factories export with Angular-signal reactivity
- Naming convention: `create*` (factory called from component constructors), not `use*` hooks
- `createHeadlessGrid` is client-side-only in 2.9.0; server-side parity comes in 2.9.x

## Tooling + quality

- `sync:theme:check` runs in CI on every push. Theme drift across the
  three theme stylesheet copies (core SCSS, Vue CSS, JS CSS) now fails
  the build instead of silently shipping.
- `publish.yml` no longer fails when versions were pre-bumped locally —
  the "Create git tag" step skips the no-op commit and tolerates re-runs.
- The existing chrome-coupled `useFillHandle` is renamed to
  `useFillHandleInternal` so the public name resolves to the new headless
  hook (React + Vue). Internal consumers update automatically; nobody
  outside OGrid was using the old shape.

## Tests

4,086 tests passing across 10 framework packages:

| | core | js | react | react-radix | react-fluent | react-material | vue | vue-radix | angular | angular-radix |
|---|---|---|---|---|---|---|---|---|---|---|
| **2.9.0** | 1575 | 468 | 573 | 153 | 153 | 154 | 437 | 141 | 262 | 170 |
| Δ from 2.8.1 | — | — | +63 | — | — | — | +9 | — | +6 | — |

## Coming in 2.9.x

- Vue + Angular Storybook combo demos (mirror the React `SpreadsheetDemo`)
- Server-side `dataSource` parity for Vue + Angular `useHeadlessGrid`
- Dedicated docs-site `/spreadsheet-hooks` section
- Arc consumer page migration as a real-world case study

## Migrating from 2.8.x

Nothing breaks. The new hooks are purely additive. Adopt them per page as
you want.

## License

MIT. Always.
