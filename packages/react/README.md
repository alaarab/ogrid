<p align="center">
  <strong>OGrid React</strong> — React hooks, headless components, and utilities for OGrid data grids.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@alaarab/ogrid-react"><img src="https://img.shields.io/npm/v/@alaarab/ogrid-react?color=%23217346&label=npm" alt="npm version" /></a>
  <a href="https://github.com/alaarab/ogrid/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License" /></a>
  <img src="https://img.shields.io/badge/React-17%20%7C%2018%20%7C%2019-blue" alt="React 17, 18, 19" />
  <img src="https://img.shields.io/badge/TypeScript-strict-blue" alt="TypeScript strict" />
</p>

<p align="center">
  <a href="https://alaarab.github.io/ogrid/">Documentation</a> · <a href="https://alaarab.github.io/ogrid/docs/getting-started/overview">Getting Started</a> · <a href="https://alaarab.github.io/ogrid/docs/api/ogrid-props">API Reference</a>
</p>

---

React hooks and headless components for [OGrid](https://github.com/alaarab/ogrid) data grids. You typically don't need to install this directly — the UI packages ([`@alaarab/ogrid-react-radix`](https://www.npmjs.com/package/@alaarab/ogrid-react-radix), [`@alaarab/ogrid-react-fluent`](https://www.npmjs.com/package/@alaarab/ogrid-react-fluent), [`@alaarab/ogrid-react-material`](https://www.npmjs.com/package/@alaarab/ogrid-react-material)) re-export everything from this package.

## What's Inside

### Hooks

- `useOGrid` — Orchestrator: pagination, sorting, filtering, visibility, editing, row selection, status bar, grid API
- `useDataGridState` — All DataGridTable state: layout, selection, editing, interaction, context menu, view models
- `useColumnHeaderFilterState` — Filter popover (open, temp values, apply/clear, people search debounce)
- `useColumnChooserState` — Column visibility dropdown
- `useInlineCellEditorState` — Inline cell editor
- `useRichSelectState` — Searchable rich select dropdown
- `useSideBarState` — Side bar panel management
- `useActiveCell`, `useCellSelection`, `useCellEditing`, `useRowSelection`, `useKeyboardNavigation`, `useClipboard`, `useFillHandle`, `useUndoRedo`, `useContextMenu`, `useColumnResize`, `useFilterOptions`, `useDebounce`

### Headless Components

`OGridLayout` · `StatusBar` · `GridContextMenu` · `SideBar` · `MarchingAntsOverlay`

### Utilities

`processClientSideData` · `exportToCsv` · `getCellValue` · `flattenColumns` · `buildHeaderRows` · `getPaginationViewModel` · `getHeaderFilterConfig` · `getCellRenderDescriptor` · `computeAggregations` · `formatShortcut` · `GRID_CONTEXT_MENU_ITEMS`

## Install

```bash
npm install @alaarab/ogrid-react
```

Peer dep: `react ^17 || ^18 || ^19`.

## Documentation

Full docs at **[alaarab.github.io/ogrid](https://alaarab.github.io/ogrid/)**.

## License

MIT — Free forever.
