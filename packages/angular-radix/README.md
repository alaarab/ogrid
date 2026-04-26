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

## Headless API — `createHeadlessGrid`

Render OGrid's sort/filter/paginate/select state with your own table chrome.
Same logic that powers `<ogrid>` exposed as a signal-based factory. Call
from a component constructor or field initializer; inputs accept signals,
getters, or plain values.

```typescript
import { Component } from '@angular/core';
import { createHeadlessGrid } from '@alaarab/ogrid-angular-radix';

@Component({
  selector: 'app-headless',
  standalone: true,
  template: `
    <table>
      <thead>
        <tr>
          @for (col of grid.columns(); track col.columnId) {
            <th (click)="grid.toggleSort(col.columnId)">
              {{ col.name }} {{ grid.sortIndicator(col.columnId)() }}
            </th>
          }
        </tr>
      </thead>
      <tbody>
        @for (row of grid.rows(); track grid.getRowId(row)) {
          <tr>
            @for (col of grid.columns(); track col.columnId) {
              <td>{{ grid.getCellValue(row, col.columnId) }}</td>
            }
          </tr>
        }
      </tbody>
    </table>
  `,
})
export class HeadlessComponent {
  grid = createHeadlessGrid({
    columns: this.columns,
    data: this.data,
    getRowId: (e: Employee) => e.id,
    initialSort: { field: 'salary', direction: 'desc' },
    initialPageSize: 25,
  });

  columns = [/* ... */];
  data = [/* ... */];
}
```

The factory returns writable signals (`sort`, `filters`, `page`,
`pageSize`, `selectedRowIds`), computed signals (`columns`, `rows`,
`totalCount`, `totalPages`, `allFilteredRows`, `hasActiveFilters`), and
plain action methods. See the React `useHeadlessGrid` docs for the full
API reference — the shape is identical, just signal-based.

See the [OGrid docs](https://alaarab.github.io/ogrid/) for full documentation.
