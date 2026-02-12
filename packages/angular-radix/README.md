# @alaarab/ogrid-angular-radix

Lightweight Angular data grid with sorting, filtering, pagination, column chooser, and CSV export. Built with Angular CDK for overlays.

## Installation

```bash
npm install @alaarab/ogrid-angular-radix
```

## Features

- ✅ **Lightweight**: Uses Angular CDK only - no heavy UI framework dependency
- ✅ **Full-featured**: Sorting, filtering, pagination, column management
- ✅ **Cell Selection**: Excel-like spreadsheet selection and editing
- ✅ **Keyboard Navigation**: Arrow keys, Enter, Escape, Tab
- ✅ **Copy/Paste**: Clipboard integration with Excel-compatible formats
- ✅ **Fill Handle**: Drag to fill cells like Excel
- ✅ **Undo/Redo**: Full edit history support
- ✅ **Context Menu**: Right-click menu for common operations
- ✅ **Column Resize**: Drag column borders to resize
- ✅ **Column Reorder**: Drag column headers to reorder
- ✅ **Customizable**: CSS variables for theming

## Quick Start

```typescript
import { Component } from '@angular/core';
import { OGridComponent } from '@alaarab/ogrid-angular-radix';

interface Employee {
  id: number;
  name: string;
  department: string;
  salary: number;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [OGridComponent],
  template: `
    <ogrid
      [props]="{
        columns: columns,
        data: data,
        cellSelection: true,
        editable: true,
        statusBar: true
      }"
    />
  `
})
export class AppComponent {
  columns = [
    { columnId: 'id', name: 'ID', type: 'numeric' as const },
    { columnId: 'name', name: 'Name', type: 'text' as const },
    { columnId: 'department', name: 'Department', type: 'text' as const, filterable: { type: 'multiSelect' as const } },
    { columnId: 'salary', name: 'Salary', type: 'numeric' as const, editable: true }
  ];

  data: Employee[] = [
    { id: 1, name: 'Alice', department: 'Engineering', salary: 120000 },
    { id: 2, name: 'Bob', department: 'Marketing', salary: 90000 },
    { id: 3, name: 'Carol', department: 'Engineering', salary: 115000 }
  ];
}
```

## Documentation

Full documentation available at: https://alaarab.github.io/ogrid

## License

MIT © Ala Arab
