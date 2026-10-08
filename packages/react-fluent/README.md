# @alaarab/ogrid-react-fluent

OGrid data grid for React, built with Fluent UI v9.

## Install

```bash
npm install @alaarab/ogrid-react-fluent
```

## Usage

```tsx
import { OGrid, type IColumnDef } from '@alaarab/ogrid-react-fluent';

const columns: IColumnDef<Employee>[] = [
  { columnId: 'name', name: 'Name', sortable: true, editable: true },
  { columnId: 'department', name: 'Department', filterable: { type: 'multiSelect' } },
];

<OGrid columns={columns} data={employees} getRowId={(e) => e.id} />
```

See the [OGrid docs](https://alaarab.github.io/ogrid/) for full documentation.

## Tests and SSR

All component styles, including lazy dialogs and panels, ship in one stylesheet. The package entry imports it (`import './index.css'`), so bundlers pick up the styles with no extra import. An explicit `import '@alaarab/ogrid-react-fluent/index.css'` also works; `styles/index.css` remains an alias. JavaScript for optional UI still loads on demand. Plain Node has no CSS loader, so the package also publishes a `node` export condition that points at the same code without the stylesheet import. Bundlers match the `module` condition first and keep the styles; tools that load `node_modules` with Node itself get the CSS-free entry:

- **Vite SSR** (dev `ssrLoadModule` and `vite build --ssr`) and **Vitest**: no configuration needed.
- **Jest:** Jest resolves the `browser`/`default` conditions under jsdom, so it still sees the CSS import. Transform the ESM packages and stub CSS: `transformIgnorePatterns: ['node_modules/(?!@alaarab/)']` plus `moduleNameMapper: { '\\.css$': '<rootDir>/styleStub.js' }` (a file containing `module.exports = {};`).
