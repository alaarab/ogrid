# @alaarab/ogrid-react-fluent

OGrid's Fluent UI v9 kit. Supports React and ReactDOM 17, 18 and 19, and re-exports the React hooks and core types/utilities.

```bash
npm install @alaarab/ogrid-react-fluent react react-dom @fluentui/react-components @fluentui/react-icons
```

```tsx
import { useState } from 'react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { OGrid, type IColumnDef } from '@alaarab/ogrid-react-fluent';

interface Row { id: string; name: string }

const columns: IColumnDef<Row>[] = [
  { columnId: 'name', name: 'Name', sortable: true, editable: true,
    filterable: { type: 'text' } },
];

export function Example() {
  const [rows, setRows] = useState<Row[]>([{ id: '1', name: 'Alex' }]);
  return (
    <FluentProvider theme={webLightTheme} style={{ height: 400 }}>
      <OGrid<Row>
        data={rows} columns={columns} getRowId={(row) => row.id}
        editable cellSelection cellReferences findReplace statusBar
        onCellValueChanged={({ item, columnId, newValue }) => {
          setRows((data) => data.map((row) =>
            row.id === item.id ? { ...row, [columnId]: newValue } : row));
        }}
      />
    </FluentProvider>
  );
}
```

Includes multi-level sort, number/condition filters, Excel selection/keyboard behavior, fill series, clipboard and undo. Opt into merges, freezing, structure edits, hiding, sheet-tab callbacks, find/replace, conditional formatting, notes, wrapping/row heights, formulas/spills, validation and drag/drop through the shared [props](https://alaarab.github.io/ogrid/docs/api/ogrid-props).

The entry imports grid/popover CSS; `@alaarab/ogrid-react-fluent/index.css` is also available explicitly (`styles/index.css` is an alias). Optional dialogs load their own styles. Wrap the grid in `FluentProvider` with your theme; see [theming](https://alaarab.github.io/ogrid/docs/guides/theming).

The `node` export supplies a CSS-free entry for Node loaders; bundlers use the styled `module` entry. Jest consumers need ESM transforms and a CSS stub. See [installation](https://alaarab.github.io/ogrid/docs/getting-started/installation) and the [headless guide](https://alaarab.github.io/ogrid/docs/headless).

MIT licensed.
