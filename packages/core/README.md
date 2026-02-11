<p align="center">
  <strong>OGrid Core</strong> — Pure TypeScript types, algorithms, and utilities for OGrid data grids.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@alaarab/ogrid-core"><img src="https://img.shields.io/npm/v/@alaarab/ogrid-core?color=%23217346&label=npm" alt="npm version" /></a>
  <a href="https://github.com/alaarab/ogrid/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License" /></a>
  <img src="https://img.shields.io/badge/TypeScript-strict-blue" alt="TypeScript strict" />
</p>

<p align="center">
  <a href="https://alaarab.github.io/ogrid/">Documentation</a> · <a href="https://alaarab.github.io/ogrid/docs/getting-started/overview">Getting Started</a> · <a href="https://alaarab.github.io/ogrid/docs/api/ogrid-props">API Reference</a>
</p>

---

Framework-agnostic foundation for [OGrid](https://github.com/alaarab/ogrid) data grids. **Zero dependencies** — pure TypeScript types and utilities shared by [`@alaarab/ogrid-react`](https://www.npmjs.com/package/@alaarab/ogrid-react) and [`@alaarab/ogrid-js`](https://www.npmjs.com/package/@alaarab/ogrid-js).

You typically don't need to install this directly — the UI packages re-export everything from core.

## What's Inside

### Types

`IColumnDef<T>` · `IColumnGroupDef` · `IDataSource<T>` · `IFilters` · `FilterValue` · `IDateFilterValue` · `UserLike` · `IOGridApi<T>` · `IOGridProps<T>` · `IOGridDataGridProps<T>` · `ICellEditorProps<T>` · `IGridColumnState` · `ISideBarDef` · `ColumnFilterType` · `IColumnMeta`

### Utilities

`getCellValue` · `buildHeaderRows` · `parseValue` · `normalizeSelectionRange` · `isInSelectionRange` · `toUserLike`

## Install

```bash
npm install @alaarab/ogrid-core
```

No peer dependencies. No framework dependencies.

## Documentation

Full docs at **[alaarab.github.io/ogrid](https://alaarab.github.io/ogrid/)**.

## License

MIT — Free forever.
