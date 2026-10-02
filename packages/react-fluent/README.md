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

The package entry imports its own stylesheet (`import './index.css'`), so bundlers pick up the styles with no extra import. Tools that load `node_modules` with plain Node instead of a bundler can't parse that import. Let them process the package instead:

- **Vitest:** `test: { server: { deps: { inline: [/@alaarab\/ogrid-/] } } }`
- **Vite SSR:** `ssr: { noExternal: [/@alaarab\/ogrid-/] }`
- **Jest:** transform the ESM packages and stub CSS: `transformIgnorePatterns: ['node_modules/(?!@alaarab/)']` plus `moduleNameMapper: { '\\.css$': '<rootDir>/styleStub.js' }` (a file containing `module.exports = {};`)
