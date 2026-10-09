# @alaarab/ogrid-react-radix

OGrid's Radix UI kit. Supports React and ReactDOM 17, 18 and 19, and re-exports the React hooks and core types/utilities.

```bash
npm install @alaarab/ogrid-react-radix react react-dom @radix-ui/react-checkbox @radix-ui/react-popover
```

```tsx
import { useState, type ComponentType } from 'react';
import { OGrid, type IColumnDef, type IOGridProps } from '@alaarab/ogrid-react-radix';

interface Row { id: string; name: string }
// v2.19.0's forwardRef declaration needs a typed alias in strict TypeScript.
const RowGrid = OGrid as ComponentType<IOGridProps<Row>>;

const columns: IColumnDef<Row>[] = [
  { columnId: 'name', name: 'Name', sortable: true, editable: true,
    filterable: { type: 'text' } },
];

export function Example() {
  const [rows, setRows] = useState<Row[]>([{ id: '1', name: 'Alex' }]);
  return (
    <div style={{ height: 400 }}>
      <RowGrid
        data={rows} columns={columns} getRowId={(row) => row.id}
        editable cellSelection cellReferences findReplace statusBar
        onCellValueChanged={({ item, columnId, newValue }) => {
          setRows((data) => data.map((row) =>
            row.id === item.id ? { ...row, [columnId]: newValue } : row));
        }}
      />
    </div>
  );
}
```

Includes multi-level sort, number/condition filters, Excel selection/keyboard behavior, fill series, clipboard and undo. Opt into merges, freezing, structure edits, hiding, sheet-tab callbacks, find/replace, conditional formatting, notes, wrapping/row heights, formulas/spills, validation and drag/drop through the shared [props](https://alaarab.github.io/ogrid/docs/api/ogrid-props).

The entry imports grid/popover CSS; `@alaarab/ogrid-react-radix/index.css` is also available explicitly (`styles/index.css` is an alias). Optional dialogs load their own styles. For shadcn tokens, import `@alaarab/ogrid-react-radix/styles/preset-shadcn.css`; see [theming](https://alaarab.github.io/ogrid/docs/guides/theming).

The `node` export supplies a CSS-free entry for Node loaders; bundlers use the styled `module` entry. Jest consumers need ESM transforms and a CSS stub. See [installation](https://alaarab.github.io/ogrid/docs/getting-started/installation) and the [headless guide](https://alaarab.github.io/ogrid/docs/headless).

MIT licensed; version 2.19.0.
