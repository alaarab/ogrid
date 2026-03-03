# @alaarab/ogrid-react-material

OGrid data grid for React, built with Material UI v7.

## Install

```bash
npm install @alaarab/ogrid-react-material
```

## Usage

```tsx
import { OGrid, type IColumnDef } from '@alaarab/ogrid-react-material';

const columns: IColumnDef<Employee>[] = [
  { columnId: 'name', name: 'Name', sortable: true, editable: true },
  { columnId: 'department', name: 'Department', filterable: { type: 'multiSelect' } },
];

<OGrid columns={columns} data={employees} getRowId={(e) => e.id} />
```

See the [OGrid docs](https://alaarab.github.io/ogrid/) for full documentation.
