# @alaarab/ogrid-angular-radix

OGrid data grid for Angular, built with Angular CDK.

## Install

```bash
npm install @alaarab/ogrid-angular-radix
```

## Usage

```typescript
import { Component } from '@angular/core';
import { OGridComponent } from '@alaarab/ogrid-angular-radix';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [OGridComponent],
  template: `<ogrid [props]="{ columns: columns, data: data, editable: true }" />`,
})
export class AppComponent {
  columns = [
    { columnId: 'name', name: 'Name', sortable: true },
    { columnId: 'department', name: 'Department', filterable: { type: 'multiSelect' as const } },
  ];
  data = [{ name: 'Alice', department: 'Engineering' }];
}
```

See the [OGrid docs](https://alaarab.github.io/ogrid/) for full documentation.
