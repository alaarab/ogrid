<p align="center">
  <img src="packages/docs/static/img/favicon.svg" width="64" height="64" alt="OGrid" />
</p>

<h1 align="center">OGrid</h1>

<p align="center">
  A React data grid with spreadsheet editing, selection, formulas and XLSX import/export. Use the OGrid component with Radix or Fluent UI, or compose the headless hooks onto your own table. MIT licensed.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@alaarab/ogrid-core"><img src="https://img.shields.io/npm/v/@alaarab/ogrid-core?color=%23217346&label=npm" alt="npm" /></a>
  <a href="https://github.com/alaarab/ogrid/actions/workflows/ci.yml"><img src="https://github.com/alaarab/ogrid/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI" /></a>
  <a href="https://github.com/alaarab/ogrid/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License" /></a>
</p>

<p align="center">
  <a href="https://alaarab.github.io/ogrid/">Documentation</a> &middot;
  <a href="https://alaarab.github.io/ogrid/docs/getting-started/quick-start">Quick Start</a> &middot;
  <a href="https://alaarab.github.io/ogrid/docs/api/ogrid-props">API Reference</a> &middot;
  <a href="https://alaarab.github.io/ogrid/docs/guides/migration-from-ag-grid">Migrate from AG Grid</a> &middot;
  <a href="https://discord.gg/KMajyx9j4m">Discord</a>
</p>

## Quick start

```bash
npm install @alaarab/ogrid-react-radix react react-dom @radix-ui/react-checkbox @radix-ui/react-popover
```

React 17, 18 and 19 are supported by the grid kits, hooks and optional editors. `react-xlsx` requires React 18 or 19. The browser XLSX package bundles its own React.

```tsx
import { useRef, useState } from 'react';
import { OGrid, type IColumnDef, type IOGridApi } from '@alaarab/ogrid-react-radix';

interface Employee {
  id: string;
  name: string;
  department: string;
  salary: number;
}

const columns: IColumnDef<Employee>[] = [
  { columnId: 'name', name: 'Name', sortable: true, editable: true },
  { columnId: 'department', name: 'Department', filterable: { type: 'multiSelect' } },
  { columnId: 'salary', name: 'Salary', type: 'numeric', editable: true,
    filterable: { type: 'number' }, valueParser: (value) => Number(value) },
];

export default function App() {
  const [employees, setEmployees] = useState<Employee[]>([
    { id: '1', name: 'Alex', department: 'Engineering', salary: 90000 },
    { id: '2', name: 'Sam', department: 'Finance', salary: 85000 },
  ]);
  const gridRef = useRef<IOGridApi<Employee>>(null);

  return (
    <div style={{ height: 400 }}>
      <button type="button" onClick={() => gridRef.current?.setCellValue('1', 'salary', 95000)}>
        Update Alex's salary
      </button>
      <OGrid<Employee>
        ref={gridRef}
        columns={columns}
        data={employees}
        getRowId={(employee) => employee.id}
        editable
        cellSelection
        cellReferences
        findReplace
        statusBar
        onCellValueChanged={({ item, columnId, newValue }) => {
          setEmployees((rows) => rows.map((row) =>
            row.id === item.id ? { ...row, [columnId]: newValue } : row));
        }}
      />
    </div>
  );
}
```

The kits load their grid stylesheet from the package entry. For explicit CSS imports, use `@alaarab/ogrid-react-radix/index.css` or `@alaarab/ogrid-react-fluent/index.css`; lazy dialogs carry their own styles. For Fluent UI, install [the Fluent package and its peers](./packages/react-fluent/README.md) and wrap the grid in `FluentProvider`.

## Why OGrid?

OGrid includes spreadsheet features that other grids license as add-ons, under MIT. Use it when you need editable tables with ranges, clipboard operations and formulas, or an XLSX editor in a React app. The headless hooks let you supply your own table markup.

This comparison covers built-in features, not custom implementations. AG Grid Community also supports ordinary browser text selection and copying; its grid clipboard operations are Enterprise features.

| Feature | OGrid | AG Grid Community | AG Grid Enterprise |
|---|---|---|---|
| Cell editing, sorting, text/number/date filters | Yes | Yes | Yes |
| [Cell range selection](https://www.ag-grid.com/react-data-grid/cell-selection/) | Yes | Enterprise only | Yes |
| [Fill handle](https://www.ag-grid.com/react-data-grid/cell-selection-fill-handle/) | Yes | Enterprise only | Yes |
| [Grid clipboard operations](https://www.ag-grid.com/react-data-grid/clipboard/) | Yes | Enterprise only | Yes |
| [Spreadsheet formulas](https://www.ag-grid.com/react-data-grid/formulas/) | Yes | Enterprise only | Yes |
| [Excel export](https://www.ag-grid.com/react-data-grid/excel-export/) | Optional MIT XLSX package | Enterprise only | Yes |
| [Cell context menu](https://www.ag-grid.com/react-data-grid/context-menu/) | Yes | Enterprise only | Yes |
| License | MIT | MIT | Commercial |

AG Grid availability was checked against its [Community / Enterprise documentation](https://www.ag-grid.com/react-data-grid/community-vs-enterprise/) on October 9, 2026. These rows don't imply identical APIs or Excel compatibility. See [Migrate from AG Grid](https://alaarab.github.io/ogrid/docs/guides/migration-from-ag-grid) for API mappings.

## Features

Both React kits share the same behavior. Features are enabled through props and column definitions; see the linked pages for defaults and limits.

**Data and layout**

- [Multi-level sorting](https://alaarab.github.io/ogrid/docs/features/sorting): Shift+click adds sort levels; custom comparators and worker sorting are supported.
- [Filters](https://alaarab.github.io/ogrid/docs/features/filtering): text, multi-select, date, people, number and condition filters, including two conditions joined with And/Or.
- Client pagination, [server data sources](https://alaarab.github.io/ogrid/docs/features/server-side-data), row/column virtualization, grouped headers, column pinning, resizing, reordering and saved column state.
- [Merged cells](https://alaarab.github.io/ogrid/docs/features/merged-cells) through `mergedCells`; selection, navigation, editing and clipboard operations honor the anchor.
- [Frozen rows and columns](https://alaarab.github.io/ogrid/docs/features/frozen-rows); `allowFreeze` adds Freeze panes, Freeze top row, Freeze first column and Unfreeze panes commands.
- [Insert/delete rows and columns, and row resize](https://alaarab.github.io/ogrid/docs/features/structure-editing) through the API or opt-in menus. Structure changes shift local formula references and undo in one step.
- [Hide/unhide rows and columns](https://alaarab.github.io/ogrid/docs/features/hiding), with header/row markers; [sheet tabs](https://alaarab.github.io/ogrid/docs/features/multi-sheet) support rename, reorder, delete and color changes through callbacks.
- [Wrap text and variable row heights](https://alaarab.github.io/ogrid/docs/features/wrap-text), including measured virtual rows and Alt+Enter line breaks.

**Editing and selection**

- Inline text, select, checkbox, date and rich-select editors, custom popup editors, and [optional date/time, rating, color, slider and tags editors](https://alaarab.github.io/ogrid/docs/features/premium-inputs).
- [Excel keyboard and selection](https://alaarab.github.io/ogrid/docs/features/keyboard-navigation): type-to-replace, Ctrl+R fill right, F4 reference cycling, row/column header selection and movement within a selected range. The editable [name box](https://alaarab.github.io/ogrid/docs/features/cell-references) accepts cells, ranges and named ranges.
- [Fill series and clipboard](https://alaarab.github.io/ogrid/docs/features/editing): number/date/text series, double-click fill down, tiled paste, shifted copied formulas, values-only paste, HTML tables and quoted multiline cells.
- Undo/redo with grouped paste, fill and structure edits; [cell get/set API](https://alaarab.github.io/ogrid/docs/api/grid-api) alongside row, selection, filter and column-state methods. Plain value writes need `onCellValueChanged` to update your data, as in the quick start.
- [Find & Replace](https://alaarab.github.io/ogrid/docs/features/find-replace): values or formulas, case/whole-cell/selection options, and one undo step for Replace all.
- [Cell notes](https://alaarab.github.io/ogrid/docs/features/cell-notes), [conditional formatting](https://alaarab.github.io/ogrid/docs/features/conditional-formatting) (highlight rules, formulas, scales, bars and icons), and [data validation](https://alaarab.github.io/ogrid/docs/features/data-validation) (lists, whole/decimal numbers, dates, times, text length and custom formulas; prompts and alerts).
- [Drag and drop](https://alaarab.github.io/ogrid/docs/features/drag-and-drop): opt-in row reorder, range move/copy and external cell drops. Row reorder requires an unsorted view; spill children are protected.

**Formulas and workbooks**

- [Formula engine](https://alaarab.github.io/ogrid/docs/features/formulas): **191 registered built-in functions**, plus evaluator-level `LET` bindings, custom functions, autocomplete, argument hints and dependency recalculation. Dynamic arrays spill into empty cells with `A1#` references, `@` intersection and `#SPILL!` collision errors.
- [XLSX/CSV/TSV import and XLSX export](https://alaarab.github.io/ogrid/docs/features/xlsx-import) through `@alaarab/ogrid-react-xlsx`: workbook styles, number formats, widths, row heights, merges, frozen panes, validation, conditional formatting and notes round-trip. Images display; charts and pivots are preserved from the original file. Insert/delete operations shift formulas and worksheet metadata.
- Large XLSX Blobs open in a progressive worker preview with progress and Cancel. Enable editing prepares the full document; unedited streamed export returns the original bytes. See [Large files](https://alaarab.github.io/ogrid/docs/features/xlsx-import#large-files) for measured load times, memory use and configurable limits.
- Toolbar, column chooser, sidebar, status aggregates, context menu and CSV export; [MCP docs and live-grid bridge](#editor-integration-mcp) for development tools.

### Known limits

- OGrid is not a complete Excel implementation. `SUBTOTAL` includes filtered-out rows; codes 101–111 skip explicitly hidden rows. See [formula differences](https://alaarab.github.io/ogrid/docs/features/formulas#where-ogrid-differs-from-excel).
- XLSX charts show title placeholders, and pivots show saved result cells. Chart rendering and pivot authoring aren't implemented. Chart/pivot preservation needs original bytes loaded through `blob` or `workbookFromBlob` and exported through OGrid's Blob helpers. Media anchors and chart/pivot ranges don't shift with structural edits.
- ExcelJS cannot write native dynamic-array metadata itself. OGrid adds/preserves that metadata in its OOXML Blob export; raw ExcelJS `writeBuffer()` bypasses this and chart/pivot preservation.
- Streaming is a value preview; editing and edited export still require ExcelJS's full workbook in memory. XLSX rows without saved heights don't auto-fit wrapped text, and formatting a virtual selection applies to rendered rows. See [XLSX limits](https://alaarab.github.io/ogrid/docs/features/xlsx-import#images-charts-and-pivot-tables).
- Windowed data sources don't support merges or hidden rows. Variable heights use a fixed-height fallback for windowed sources and the scaled scrolling model. [Merged spans](https://alaarab.github.io/ogrid/docs/features/merged-cells) are clipped at paging, pinning and frozen-row boundaries.

## Packages and dependencies

All nine published packages are released together at one shared version. UI kits re-export the React adapter and shared core API; use the core formula subpath for a standalone engine.

| Package | Purpose | Runtime peers |
|---|---|---|
| [`@alaarab/ogrid-core`](./packages/core/README.md) | Pure TypeScript types, algorithms and formula engine; no dependencies | None |
| [`@alaarab/ogrid-inputs`](./packages/inputs/README.md) | Framework-free editor helpers; no dependencies | None |
| [`@alaarab/ogrid-react`](./packages/react/README.md) | Hooks and headless components | React + ReactDOM 17/18/19 |
| [`@alaarab/ogrid-react-radix`](./packages/react-radix/README.md) | Radix UI grid kit | React + ReactDOM 17/18/19, Radix Checkbox + Popover |
| [`@alaarab/ogrid-react-fluent`](./packages/react-fluent/README.md) | Fluent UI v9 grid kit | React + ReactDOM 17/18/19, Fluent components + icons |
| [`@alaarab/ogrid-react-inputs`](./packages/react-inputs/README.md) | Optional React cell editors | React + ReactDOM 17/18/19 |
| [`@alaarab/ogrid-react-xlsx`](./packages/react-xlsx/README.md) | ExcelJS workbook editor and import/export helpers | React + ReactDOM 18/19 |
| [`@alaarab/ogrid-react-xlsx-browser`](./packages/react-xlsx-browser/README.md) | Browser ESM bundle, including React, ExcelJS and local chunks | None required at runtime |
| [`@alaarab/ogrid-mcp`](./packages/mcp/README.md) | Standalone documentation server and optional live bridge | None |

[`packages/docs`](./packages/docs/README.md) (Docusaurus) and [`packages/examples`](./packages/examples/README.md) (Vite apps) are private workspaces.

```text
core (no dependencies)
└── react → core + @tanstack/react-virtual
    ├── react-radix → react + core; Radix peers
    │   └── react-xlsx → react-radix + react + core + ExcelJS + ZIP/XML helpers
    │       └── react-xlsx-browser (bundles react-xlsx and its dependencies)
    └── react-fluent → react + core; Fluent peers
inputs (no dependencies) + core
└── react-inputs
mcp → MCP SDK + Zod (no grid dependency)
```

### Bundle sizes (minified + Brotli)

Regenerated with `npm run build && npm run size` using size-limit and esbuild. Sizes include each entry's dependencies and are measured independently: don't add the rows together or treat them as initial-download sizes.

| Entry | Minified + Brotli | Budget |
|---|---|---|
| core | 29.96 kB | 31.2 kB |
| core formula assist (lazy) | 5.34 kB | 5.4 kB |
| react | 147.75 kB | 152 kB |
| react-radix | 184.73 kB | 184.8 kB |
| react-fluent | 224.61 kB | 226.1 kB |
| react-xlsx | 508.20 kB | 509.7 kB |
| react-xlsx streaming reader (lazy) | 12.11 kB | 14 kB |
| react-xlsx-browser | 506.66 kB | 522 kB |
| react validation form (lazy) | 6.66 kB | 6.7 kB |
| react-radix validation dialog (lazy) | 9.68 kB | 29.7 kB |
| react-fluent validation dialog (lazy) | 55.14 kB | 56.4 kB |
| react-xlsx-browser validation dialog (lazy) | 9.39 kB | 29.3 kB |

Main entries exclude the formula-assist module and validation dialogs where configured, and `react-xlsx` excludes its streaming reader. Size-limit otherwise follows dynamic imports without code splitting; separately emitted worker assets aren't included in these entry measurements. See [.size-limit.json](./.size-limit.json) for the exact scope.

Optional panels, notes, validation dialogs, XLSX controls/media and streaming code load lazily. ESM exports are tree-shakeable, so unused exports and optional editor imports can be removed by your bundler. ExcelJS is a static dependency of `react-xlsx`; lazy-load the route that imports it to keep it out of your app's initial bundle. No-bundler hosts must copy the browser package's complete `dist/` directory, including sibling chunks, CSS and the worker.

## Headless hooks

`useHeadlessGrid` supplies sorted, filtered and paginated rows with state and handlers. Compose `useInlineEdit`, `useRangeSelection`, `useFillHandle`, `useCellClipboard`, `useUndoRedo` and `useGridFocus` to add spreadsheet interactions to your own table.

See the [React package example](./packages/react/README.md), [headless guide](https://alaarab.github.io/ogrid/docs/headless) and [hook reference](https://alaarab.github.io/ogrid/docs/api/headless-hooks). The individual hooks require you to wire their events and render the UI.

## Editor integration (MCP)

`@alaarab/ogrid-mcp` serves bundled docs over stdio. Add it to your editor's MCP configuration:

```json
{
  "mcpServers": {
    "ogrid": { "command": "npx", "args": ["-y", "@alaarab/ogrid-mcp"] }
  }
}
```

Docs tools: `search_docs`, `list_docs`, `get_docs`, `get_code_example`, `detect_version`. Resources: `ogrid://quick-reference`, `ogrid://docs/{path}`, `ogrid://migration-guide`.

Run `npx -y @alaarab/ogrid-mcp --bridge` to enable the local HTTP bridge (port 7890 by default; configurable through `OGRID_BRIDGE_PORT`). A dev app connects through `@alaarab/ogrid-mcp/bridge-client`; this enables `list_grids`, `get_grid_state` and `send_grid_command`. See the [MCP README](./packages/mcp/README.md) and [live testing guide](https://alaarab.github.io/ogrid/docs/guides/mcp-live-testing).

## Development and testing

The repository requires **Bun >= 1.4.2** and **Node.js >= 22.19.0**. Published packages declare Node >= 18; the repository uses newer tools.

```bash
bun install --frozen-lockfile
npm run build                      # All 11 workspaces, in dependency order
npm run lint                       # Biome
bun run check:versions             # Manifests and lockfile
bun run typecheck                  # All workspace types
bun run test:all                   # Bun unit/component tests
bun run check:exports              # Public exports and documented imports
bun run check:types                # Published type resolution after building
npm run size                      # Minified + Brotli budgets
bun run test:react-compat          # Packed React packages on React 17/18
bun run test:browser-bundle        # Standalone XLSX browser runtime
bun run test:e2e:smoke             # Radix + Fluent browser smoke tests
bun run test:e2e:matrix            # Sequential browser matrix
bun run test:e2e:docs              # Built docs browser checks

bun run dev:react-radix            # Vite example app
bun run dev:react-fluent           # Vite example app
bun run storybook:react-radix      # Port 6008
bun run storybook:react-fluent      # Port 6006
bun run docs:dev:full              # Build grid packages, then start Docusaurus
bun run docs:build
bun run docs:serve
bun run mcp                       # Built MCP server
```

Tests use `bun:test` and happy-dom. The optional `@alaarab/ogrid-react/testing` entry supplies shared test factories and needs React 18+ with Testing Library 16.

[CI](./.github/workflows/ci.yml) runs on main pushes, pull requests targeting main and manual dispatch: lint, versions/exports, types, unit tests, build/size, packed types, React compatibility, browser bundle and smoke checks. [Full Verification](./.github/workflows/full-verification.yml) runs on main pushes or manually with coverage; [Playwright Matrix](./.github/workflows/playwright-matrix.yml) is manual. [Deploy Docs](./.github/workflows/deploy-docs.yml) publishes the site; [Publish Packages](./.github/workflows/publish.yml) handles lockstep npm releases. See [RELEASING.md](./RELEASING.md).

### Frozen adapters

Material UI, vanilla JS, Angular and Vue variants are frozen on `legacy/multiframework`. Their published versions remain available, but they are outside the active build, test and release workflow. New work targets React Radix and Fluent.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) and [ARCHITECTURE.md](./ARCHITECTURE.md). UI changes should preserve Radix/Fluent parity. Run the verification commands above before submitting a pull request.

## License

[MIT](./LICENSE) — [Ala Arab](https://github.com/alaarab)
