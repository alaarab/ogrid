# @alaarab/ogrid-js

OGrid data grid for vanilla JavaScript  -  no framework required.

## Install

```bash
npm install @alaarab/ogrid-js
```

## Usage

```typescript
import { OGrid } from '@alaarab/ogrid-js';

const grid = new OGrid(document.getElementById('grid')!, {
  columns: [
    { columnId: 'name', name: 'Name', sortable: true },
    { columnId: 'age', name: 'Age', type: 'numeric' },
  ],
  data: [{ name: 'Alice', age: 30 }],
});
```

See the [OGrid docs](https://alaarab.github.io/ogrid/) for full documentation.
