import {
  createReactProject,
  createAngularProject,
  createVueProject,
  createJSProject,
  type StackBlitzProject,
} from './projects';

export interface FeatureDemoSet {
  React: StackBlitzProject;
  Angular: StackBlitzProject;
  Vue: StackBlitzProject;
  JS: StackBlitzProject;
}

// ── Sorting ──

export const sorting: FeatureDemoSet = {
  React: createReactProject(
    `import { OGrid } from '@alaarab/ogrid-react-radix';
import { people, getRowId, type Person } from './data';

const columns = [
  { columnId: 'name', name: 'Name', sortable: true },
  { columnId: 'age', name: 'Age', sortable: true, type: 'numeric' as const },
  { columnId: 'department', name: 'Department', sortable: true },
  { columnId: 'salary', name: 'Salary', sortable: true, type: 'numeric' as const,
    valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
];

export default function App() {
  return <OGrid<Person> columns={columns} data={people} getRowId={getRowId} defaultPageSize={10} />;
}
`,
    'OGrid Sorting — React',
  ),
  Angular: createAngularProject(
    `import { Component } from '@angular/core';
import { OGridComponent, type IColumnDef } from '@alaarab/ogrid-angular-material';
import { people, getRowId, type Person } from './data';

@Component({
  standalone: true,
  imports: [OGridComponent],
  template: \`<ogrid [props]="gridProps" />\`,
})
export class AppComponent {
  gridProps = {
    columns: [
      { columnId: 'name', name: 'Name', sortable: true },
      { columnId: 'age', name: 'Age', sortable: true, type: 'numeric' },
      { columnId: 'department', name: 'Department', sortable: true },
      { columnId: 'salary', name: 'Salary', sortable: true, type: 'numeric',
        valueFormatter: (v: unknown) => \`$\${Number(v).toLocaleString()}\` },
    ] as IColumnDef<Person>[],
    data: people,
    getRowId,
    defaultPageSize: 10,
  };
}
`,
    'OGrid Sorting — Angular',
  ),
  Vue: createVueProject(
    `<script setup lang="ts">
import { OGrid, type IColumnDef } from '@alaarab/ogrid-vue-vuetify';
import { people, getRowId, type Person } from './data';

const columns: IColumnDef<Person>[] = [
  { columnId: 'name', name: 'Name', sortable: true },
  { columnId: 'age', name: 'Age', sortable: true, type: 'numeric' },
  { columnId: 'department', name: 'Department', sortable: true },
  { columnId: 'salary', name: 'Salary', sortable: true, type: 'numeric',
    valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
];

const gridProps = { columns, data: people, getRowId, defaultPageSize: 10 };
</script>

<template>
  <v-app>
    <OGrid :gridProps="gridProps" />
  </v-app>
</template>
`,
    'OGrid Sorting — Vue',
  ),
  JS: createJSProject(
    `import { OGrid } from '@alaarab/ogrid-js';
import '@alaarab/ogrid-js/styles';
import { people, getRowId } from './data';

const grid = new OGrid(document.getElementById('grid')!, {
  columns: [
    { columnId: 'name', name: 'Name', sortable: true },
    { columnId: 'age', name: 'Age', sortable: true, type: 'numeric' },
    { columnId: 'department', name: 'Department', sortable: true },
    { columnId: 'salary', name: 'Salary', sortable: true, type: 'numeric',
      valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
  ],
  data: people,
  getRowId,
  pageSize: 10,
});
`,
    'OGrid Sorting — JS',
  ),
};

// ── Filtering ──

export const filtering: FeatureDemoSet = {
  React: createReactProject(
    `import { OGrid } from '@alaarab/ogrid-react-radix';
import { people, getRowId, type Person } from './data';

const columns = [
  { columnId: 'name', name: 'Name', filterable: { type: 'text' } },
  { columnId: 'department', name: 'Department',
    filterable: { type: 'multiSelect', filterField: 'department' } },
  { columnId: 'status', name: 'Status',
    filterable: { type: 'multiSelect', filterField: 'status' } },
  { columnId: 'salary', name: 'Salary', type: 'numeric' as const,
    valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
];

export default function App() {
  return <OGrid<Person> columns={columns} data={people} getRowId={getRowId} defaultPageSize={10} />;
}
`,
    'OGrid Filtering — React',
  ),
  Angular: createAngularProject(
    `import { Component } from '@angular/core';
import { OGridComponent, type IColumnDef } from '@alaarab/ogrid-angular-material';
import { people, getRowId, type Person } from './data';

@Component({
  standalone: true,
  imports: [OGridComponent],
  template: \`<ogrid [props]="gridProps" />\`,
})
export class AppComponent {
  gridProps = {
    columns: [
      { columnId: 'name', name: 'Name', filterable: { type: 'text' } },
      { columnId: 'department', name: 'Department',
        filterable: { type: 'multiSelect', filterField: 'department' } },
      { columnId: 'status', name: 'Status',
        filterable: { type: 'multiSelect', filterField: 'status' } },
      { columnId: 'salary', name: 'Salary', type: 'numeric',
        valueFormatter: (v: unknown) => \`$\${Number(v).toLocaleString()}\` },
    ] as IColumnDef<Person>[],
    data: people,
    getRowId,
    defaultPageSize: 10,
  };
}
`,
    'OGrid Filtering — Angular',
  ),
  Vue: createVueProject(
    `<script setup lang="ts">
import { OGrid, type IColumnDef } from '@alaarab/ogrid-vue-vuetify';
import { people, getRowId, type Person } from './data';

const columns: IColumnDef<Person>[] = [
  { columnId: 'name', name: 'Name', filterable: { type: 'text' } },
  { columnId: 'department', name: 'Department',
    filterable: { type: 'multiSelect', filterField: 'department' } },
  { columnId: 'status', name: 'Status',
    filterable: { type: 'multiSelect', filterField: 'status' } },
  { columnId: 'salary', name: 'Salary', type: 'numeric',
    valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
];

const gridProps = { columns, data: people, getRowId, defaultPageSize: 10 };
</script>

<template>
  <v-app>
    <OGrid :gridProps="gridProps" />
  </v-app>
</template>
`,
    'OGrid Filtering — Vue',
  ),
  JS: createJSProject(
    `import { OGrid } from '@alaarab/ogrid-js';
import '@alaarab/ogrid-js/styles';
import { people, getRowId } from './data';

const grid = new OGrid(document.getElementById('grid')!, {
  columns: [
    { columnId: 'name', name: 'Name', filterable: { type: 'text' } },
    { columnId: 'department', name: 'Department',
      filterable: { type: 'multiSelect', filterField: 'department' } },
    { columnId: 'status', name: 'Status',
      filterable: { type: 'multiSelect', filterField: 'status' } },
    { columnId: 'salary', name: 'Salary', type: 'numeric',
      valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
  ],
  data: people,
  getRowId,
  pageSize: 10,
});
`,
    'OGrid Filtering — JS',
  ),
};

// ── Pagination ──

export const pagination: FeatureDemoSet = {
  React: createReactProject(
    `import { OGrid } from '@alaarab/ogrid-react-radix';
import { people, getRowId, type Person } from './data';

const columns = [
  { columnId: 'name', name: 'Name' },
  { columnId: 'email', name: 'Email' },
  { columnId: 'department', name: 'Department' },
  { columnId: 'salary', name: 'Salary', type: 'numeric' as const,
    valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
];

export default function App() {
  return (
    <OGrid<Person>
      columns={columns}
      data={people}
      getRowId={getRowId}
      defaultPageSize={5}
      pageSizeOptions={[5, 10, 25]}
      entityLabelPlural="people"
    />
  );
}
`,
    'OGrid Pagination — React',
  ),
  Angular: createAngularProject(
    `import { Component } from '@angular/core';
import { OGridComponent, type IColumnDef } from '@alaarab/ogrid-angular-material';
import { people, getRowId, type Person } from './data';

@Component({
  standalone: true,
  imports: [OGridComponent],
  template: \`<ogrid [props]="gridProps" />\`,
})
export class AppComponent {
  gridProps = {
    columns: [
      { columnId: 'name', name: 'Name' },
      { columnId: 'email', name: 'Email' },
      { columnId: 'department', name: 'Department' },
      { columnId: 'salary', name: 'Salary', type: 'numeric',
        valueFormatter: (v: unknown) => \`$\${Number(v).toLocaleString()}\` },
    ] as IColumnDef<Person>[],
    data: people,
    getRowId,
    defaultPageSize: 5,
    pageSizeOptions: [5, 10, 25],
    entityLabelPlural: 'people',
  };
}
`,
    'OGrid Pagination — Angular',
  ),
  Vue: createVueProject(
    `<script setup lang="ts">
import { OGrid, type IColumnDef } from '@alaarab/ogrid-vue-vuetify';
import { people, getRowId, type Person } from './data';

const columns: IColumnDef<Person>[] = [
  { columnId: 'name', name: 'Name' },
  { columnId: 'email', name: 'Email' },
  { columnId: 'department', name: 'Department' },
  { columnId: 'salary', name: 'Salary', type: 'numeric',
    valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
];

const gridProps = {
  columns, data: people, getRowId,
  defaultPageSize: 5,
  pageSizeOptions: [5, 10, 25],
  entityLabelPlural: 'people',
};
</script>

<template>
  <v-app>
    <OGrid :gridProps="gridProps" />
  </v-app>
</template>
`,
    'OGrid Pagination — Vue',
  ),
  JS: createJSProject(
    `import { OGrid } from '@alaarab/ogrid-js';
import '@alaarab/ogrid-js/styles';
import { people, getRowId } from './data';

const grid = new OGrid(document.getElementById('grid')!, {
  columns: [
    { columnId: 'name', name: 'Name' },
    { columnId: 'email', name: 'Email' },
    { columnId: 'department', name: 'Department' },
    { columnId: 'salary', name: 'Salary', type: 'numeric',
      valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
  ],
  data: people,
  getRowId,
  pageSize: 5,
  pageSizeOptions: [5, 10, 25],
  entityLabelPlural: 'people',
});
`,
    'OGrid Pagination — JS',
  ),
};

// ── Editing ──

export const editing: FeatureDemoSet = {
  React: createReactProject(
    `import { useState } from 'react';
import { OGrid, useUndoRedo } from '@alaarab/ogrid-react-radix';
import { people, getRowId, type Person } from './data';

const DEPTS = ['Engineering', 'Marketing', 'Sales', 'Finance', 'Operations'];
const STATUSES = ['Active', 'Draft', 'Archived'];

const columns = [
  { columnId: 'name', name: 'Name', editable: true },
  { columnId: 'department', name: 'Department', editable: true,
    cellEditor: 'richSelect' as const, cellEditorParams: { values: DEPTS } },
  { columnId: 'status', name: 'Status', editable: true,
    cellEditor: 'select' as const, cellEditorParams: { values: STATUSES } },
  { columnId: 'salary', name: 'Salary', editable: true, type: 'numeric' as const,
    valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\`,
    valueParser: ({ newValue }) => { const n = Number(newValue); return isNaN(n) || n < 0 ? undefined : n; } },
];

export default function App() {
  const [data, setData] = useState(people);
  const { handleCellValueChanged, undo, redo, canUndo, canRedo } = useUndoRedo({
    data, setData, getRowId,
  });

  return (
    <OGrid<Person>
      columns={columns} data={data} getRowId={getRowId}
      editable onCellValueChanged={handleCellValueChanged}
      onUndo={undo} onRedo={redo} canUndo={canUndo} canRedo={canRedo}
      defaultPageSize={10}
    />
  );
}
`,
    'OGrid Editing — React',
  ),
  Angular: createAngularProject(
    `import { Component } from '@angular/core';
import { OGridComponent, type IColumnDef } from '@alaarab/ogrid-angular-material';
import { people, getRowId, type Person } from './data';

const DEPTS = ['Engineering', 'Marketing', 'Sales', 'Finance', 'Operations'];
const STATUSES = ['Active', 'Draft', 'Archived'];

@Component({
  standalone: true,
  imports: [OGridComponent],
  template: \`<ogrid [props]="gridProps" />\`,
})
export class AppComponent {
  gridProps = {
    columns: [
      { columnId: 'name', name: 'Name', editable: true },
      { columnId: 'department', name: 'Department', editable: true,
        cellEditor: 'richSelect', cellEditorParams: { values: DEPTS } },
      { columnId: 'status', name: 'Status', editable: true,
        cellEditor: 'select', cellEditorParams: { values: STATUSES } },
      { columnId: 'salary', name: 'Salary', editable: true, type: 'numeric',
        valueFormatter: (v: unknown) => \`$\${Number(v).toLocaleString()}\`,
        valueParser: ({ newValue }: any) => { const n = Number(newValue); return isNaN(n) || n < 0 ? undefined : n; } },
    ] as IColumnDef<Person>[],
    data: people,
    getRowId,
    defaultPageSize: 10,
    editable: true,
  };
}
`,
    'OGrid Editing — Angular',
  ),
  Vue: createVueProject(
    `<script setup lang="ts">
import { ref } from 'vue';
import { OGrid, type IColumnDef } from '@alaarab/ogrid-vue-vuetify';
import { people, getRowId, type Person } from './data';

const DEPTS = ['Engineering', 'Marketing', 'Sales', 'Finance', 'Operations'];
const STATUSES = ['Active', 'Draft', 'Archived'];

const columns: IColumnDef<Person>[] = [
  { columnId: 'name', name: 'Name', editable: true },
  { columnId: 'department', name: 'Department', editable: true,
    cellEditor: 'richSelect', cellEditorParams: { values: DEPTS } },
  { columnId: 'status', name: 'Status', editable: true,
    cellEditor: 'select', cellEditorParams: { values: STATUSES } },
  { columnId: 'salary', name: 'Salary', editable: true, type: 'numeric',
    valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\`,
    valueParser: ({ newValue }) => { const n = Number(newValue); return isNaN(n) || n < 0 ? undefined : n; } },
];

const gridProps = {
  columns, data: people, getRowId,
  defaultPageSize: 10, editable: true,
};
</script>

<template>
  <v-app>
    <OGrid :gridProps="gridProps" />
  </v-app>
</template>
`,
    'OGrid Editing — Vue',
  ),
  JS: createJSProject(
    `import { OGrid } from '@alaarab/ogrid-js';
import '@alaarab/ogrid-js/styles';
import { people, getRowId } from './data';

const DEPTS = ['Engineering', 'Marketing', 'Sales', 'Finance', 'Operations'];
const STATUSES = ['Active', 'Draft', 'Archived'];

const grid = new OGrid(document.getElementById('grid')!, {
  columns: [
    { columnId: 'name', name: 'Name', editable: true },
    { columnId: 'department', name: 'Department', editable: true,
      cellEditor: 'richSelect', cellEditorParams: { values: DEPTS } },
    { columnId: 'status', name: 'Status', editable: true,
      cellEditor: 'select', cellEditorParams: { values: STATUSES } },
    { columnId: 'salary', name: 'Salary', editable: true, type: 'numeric',
      valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\`,
      valueParser: ({ newValue }) => { const n = Number(newValue); return isNaN(n) || n < 0 ? undefined : n; } },
  ],
  data: people,
  getRowId,
  editable: true,
});
`,
    'OGrid Editing — JS',
  ),
};

// ── Spreadsheet Selection ──

export const spreadsheetSelection: FeatureDemoSet = {
  React: createReactProject(
    `import { OGrid } from '@alaarab/ogrid-react-radix';
import { people, getRowId, type Person } from './data';

const columns = [
  { columnId: 'name', name: 'Name' },
  { columnId: 'age', name: 'Age', type: 'numeric' as const },
  { columnId: 'department', name: 'Department' },
  { columnId: 'salary', name: 'Salary', type: 'numeric' as const,
    valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
  { columnId: 'email', name: 'Email' },
];

export default function App() {
  return <OGrid<Person> columns={columns} data={people} getRowId={getRowId} cellSelection defaultPageSize={10} />;
}
`,
    'OGrid Selection — React',
  ),
  Angular: createAngularProject(
    `import { Component } from '@angular/core';
import { OGridComponent, type IColumnDef } from '@alaarab/ogrid-angular-material';
import { people, getRowId, type Person } from './data';

@Component({
  standalone: true,
  imports: [OGridComponent],
  template: \`<ogrid [props]="gridProps" />\`,
})
export class AppComponent {
  gridProps = {
    columns: [
      { columnId: 'name', name: 'Name' },
      { columnId: 'age', name: 'Age', type: 'numeric' },
      { columnId: 'department', name: 'Department' },
      { columnId: 'salary', name: 'Salary', type: 'numeric',
        valueFormatter: (v: unknown) => \`$\${Number(v).toLocaleString()}\` },
      { columnId: 'email', name: 'Email' },
    ] as IColumnDef<Person>[],
    data: people,
    getRowId,
    cellSelection: true,
    defaultPageSize: 10,
  };
}
`,
    'OGrid Selection — Angular',
  ),
  Vue: createVueProject(
    `<script setup lang="ts">
import { OGrid, type IColumnDef } from '@alaarab/ogrid-vue-vuetify';
import { people, getRowId, type Person } from './data';

const columns: IColumnDef<Person>[] = [
  { columnId: 'name', name: 'Name' },
  { columnId: 'age', name: 'Age', type: 'numeric' },
  { columnId: 'department', name: 'Department' },
  { columnId: 'salary', name: 'Salary', type: 'numeric',
    valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
  { columnId: 'email', name: 'Email' },
];

const gridProps = { columns, data: people, getRowId, cellSelection: true, defaultPageSize: 10 };
</script>

<template>
  <v-app>
    <OGrid :gridProps="gridProps" />
  </v-app>
</template>
`,
    'OGrid Selection — Vue',
  ),
  JS: createJSProject(
    `import { OGrid } from '@alaarab/ogrid-js';
import '@alaarab/ogrid-js/styles';
import { people, getRowId } from './data';

const grid = new OGrid(document.getElementById('grid')!, {
  columns: [
    { columnId: 'name', name: 'Name' },
    { columnId: 'age', name: 'Age', type: 'numeric' },
    { columnId: 'department', name: 'Department' },
    { columnId: 'salary', name: 'Salary', type: 'numeric',
      valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
    { columnId: 'email', name: 'Email' },
  ],
  data: people,
  getRowId,
  cellSelection: true,
  pageSize: 10,
});
`,
    'OGrid Selection — JS',
  ),
};

// ── Row Selection ──

export const rowSelection: FeatureDemoSet = {
  React: createReactProject(
    `import { OGrid } from '@alaarab/ogrid-react-radix';
import { people, getRowId, type Person } from './data';

const columns = [
  { columnId: 'name', name: 'Name' },
  { columnId: 'email', name: 'Email' },
  { columnId: 'department', name: 'Department' },
  { columnId: 'status', name: 'Status' },
];

export default function App() {
  return (
    <OGrid<Person>
      columns={columns} data={people} getRowId={getRowId}
      rowSelection="multiple"
      onSelectionChange={(e) => console.log(e.selectedItems.length, 'selected')}
      defaultPageSize={10}
    />
  );
}
`,
    'OGrid Row Selection — React',
  ),
  Angular: createAngularProject(
    `import { Component } from '@angular/core';
import { OGridComponent, type IColumnDef } from '@alaarab/ogrid-angular-material';
import { people, getRowId, type Person } from './data';

@Component({
  standalone: true,
  imports: [OGridComponent],
  template: \`<ogrid [props]="gridProps" />\`,
})
export class AppComponent {
  gridProps = {
    columns: [
      { columnId: 'name', name: 'Name' },
      { columnId: 'email', name: 'Email' },
      { columnId: 'department', name: 'Department' },
      { columnId: 'status', name: 'Status' },
    ] as IColumnDef<Person>[],
    data: people,
    getRowId,
    rowSelection: 'multiple' as const,
    defaultPageSize: 10,
  };
}
`,
    'OGrid Row Selection — Angular',
  ),
  Vue: createVueProject(
    `<script setup lang="ts">
import { OGrid, type IColumnDef } from '@alaarab/ogrid-vue-vuetify';
import { people, getRowId, type Person } from './data';

const columns: IColumnDef<Person>[] = [
  { columnId: 'name', name: 'Name' },
  { columnId: 'email', name: 'Email' },
  { columnId: 'department', name: 'Department' },
  { columnId: 'status', name: 'Status' },
];

const gridProps = { columns, data: people, getRowId, rowSelection: 'multiple', defaultPageSize: 10 };
</script>

<template>
  <v-app>
    <OGrid :gridProps="gridProps" />
  </v-app>
</template>
`,
    'OGrid Row Selection — Vue',
  ),
  JS: createJSProject(
    `import { OGrid } from '@alaarab/ogrid-js';
import '@alaarab/ogrid-js/styles';
import { people, getRowId } from './data';

const grid = new OGrid(document.getElementById('grid')!, {
  columns: [
    { columnId: 'name', name: 'Name' },
    { columnId: 'email', name: 'Email' },
    { columnId: 'department', name: 'Department' },
    { columnId: 'status', name: 'Status' },
  ],
  data: people,
  getRowId,
  rowSelection: 'multiple',
  pageSize: 10,
});
`,
    'OGrid Row Selection — JS',
  ),
};

// ── Column Pinning ──

export const columnPinning: FeatureDemoSet = {
  React: createReactProject(
    `import { OGrid, type IColumnDef } from '@alaarab/ogrid-react-radix';
import { people, getRowId, type Person } from './data';

const columns: IColumnDef<Person>[] = [
  { columnId: 'name', name: 'Name', pinned: 'left', defaultWidth: 160 },
  { columnId: 'email', name: 'Email', defaultWidth: 220 },
  { columnId: 'department', name: 'Department', defaultWidth: 160 },
  { columnId: 'salary', name: 'Salary', type: 'numeric', defaultWidth: 120,
    valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
  { columnId: 'status', name: 'Status', defaultWidth: 120 },
  { columnId: 'age', name: 'Age', type: 'numeric', defaultWidth: 80 },
  { columnId: 'startDate', name: 'Start Date', defaultWidth: 130 },
];

export default function App() {
  return <OGrid<Person> columns={columns} data={people} getRowId={getRowId} defaultPageSize={10} />;
}
`,
    'OGrid Column Pinning — React',
  ),
  Angular: createAngularProject(
    `import { Component } from '@angular/core';
import { OGridComponent, type IColumnDef } from '@alaarab/ogrid-angular-material';
import { people, getRowId, type Person } from './data';

@Component({
  standalone: true,
  imports: [OGridComponent],
  template: \`<ogrid [props]="gridProps" />\`,
})
export class AppComponent {
  gridProps = {
    columns: [
      { columnId: 'name', name: 'Name', pinned: 'left', defaultWidth: 160 },
      { columnId: 'email', name: 'Email', defaultWidth: 220 },
      { columnId: 'department', name: 'Department', defaultWidth: 160 },
      { columnId: 'salary', name: 'Salary', type: 'numeric', defaultWidth: 120,
        valueFormatter: (v: unknown) => \`$\${Number(v).toLocaleString()}\` },
      { columnId: 'status', name: 'Status', defaultWidth: 120 },
      { columnId: 'age', name: 'Age', type: 'numeric', defaultWidth: 80 },
      { columnId: 'startDate', name: 'Start Date', defaultWidth: 130 },
    ] as IColumnDef<Person>[],
    data: people,
    getRowId,
    defaultPageSize: 10,
  };
}
`,
    'OGrid Column Pinning — Angular',
  ),
  Vue: createVueProject(
    `<script setup lang="ts">
import { OGrid, type IColumnDef } from '@alaarab/ogrid-vue-vuetify';
import { people, getRowId, type Person } from './data';

const columns: IColumnDef<Person>[] = [
  { columnId: 'name', name: 'Name', pinned: 'left', defaultWidth: 160 },
  { columnId: 'email', name: 'Email', defaultWidth: 220 },
  { columnId: 'department', name: 'Department', defaultWidth: 160 },
  { columnId: 'salary', name: 'Salary', type: 'numeric', defaultWidth: 120,
    valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
  { columnId: 'status', name: 'Status', defaultWidth: 120 },
  { columnId: 'age', name: 'Age', type: 'numeric', defaultWidth: 80 },
  { columnId: 'startDate', name: 'Start Date', defaultWidth: 130 },
];

const gridProps = { columns, data: people, getRowId, defaultPageSize: 10 };
</script>

<template>
  <v-app>
    <OGrid :gridProps="gridProps" />
  </v-app>
</template>
`,
    'OGrid Column Pinning — Vue',
  ),
  JS: createJSProject(
    `import { OGrid } from '@alaarab/ogrid-js';
import '@alaarab/ogrid-js/styles';
import { people, getRowId } from './data';

const grid = new OGrid(document.getElementById('grid')!, {
  columns: [
    { columnId: 'name', name: 'Name', pinned: 'left', defaultWidth: 160 },
    { columnId: 'email', name: 'Email', defaultWidth: 220 },
    { columnId: 'department', name: 'Department', defaultWidth: 160 },
    { columnId: 'salary', name: 'Salary', type: 'numeric', defaultWidth: 120,
      valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
    { columnId: 'status', name: 'Status', defaultWidth: 120 },
    { columnId: 'age', name: 'Age', type: 'numeric', defaultWidth: 80 },
    { columnId: 'startDate', name: 'Start Date', defaultWidth: 130 },
  ],
  data: people,
  getRowId,
  pageSize: 10,
});
`,
    'OGrid Column Pinning — JS',
  ),
};

// ── Column Reordering ──

export const columnReordering: FeatureDemoSet = {
  React: createReactProject(
    `import { OGrid } from '@alaarab/ogrid-react-radix';
import { people, getRowId, type Person } from './data';

const columns = [
  { columnId: 'name', name: 'Name' },
  { columnId: 'email', name: 'Email' },
  { columnId: 'department', name: 'Department' },
  { columnId: 'salary', name: 'Salary', type: 'numeric' as const,
    valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
  { columnId: 'status', name: 'Status' },
];

export default function App() {
  return (
    <OGrid<Person>
      columns={columns} data={people} getRowId={getRowId}
      columnReorder defaultPageSize={10}
    />
  );
}
`,
    'OGrid Column Reordering — React',
  ),
  Angular: createAngularProject(
    `import { Component } from '@angular/core';
import { OGridComponent, type IColumnDef } from '@alaarab/ogrid-angular-material';
import { people, getRowId, type Person } from './data';

@Component({
  standalone: true,
  imports: [OGridComponent],
  template: \`<ogrid [props]="gridProps" />\`,
})
export class AppComponent {
  gridProps = {
    columns: [
      { columnId: 'name', name: 'Name' },
      { columnId: 'email', name: 'Email' },
      { columnId: 'department', name: 'Department' },
      { columnId: 'salary', name: 'Salary', type: 'numeric',
        valueFormatter: (v: unknown) => \`$\${Number(v).toLocaleString()}\` },
      { columnId: 'status', name: 'Status' },
    ] as IColumnDef<Person>[],
    data: people,
    getRowId,
    columnReorder: true,
    defaultPageSize: 10,
  };
}
`,
    'OGrid Column Reordering — Angular',
  ),
  Vue: createVueProject(
    `<script setup lang="ts">
import { OGrid, type IColumnDef } from '@alaarab/ogrid-vue-vuetify';
import { people, getRowId, type Person } from './data';

const columns: IColumnDef<Person>[] = [
  { columnId: 'name', name: 'Name' },
  { columnId: 'email', name: 'Email' },
  { columnId: 'department', name: 'Department' },
  { columnId: 'salary', name: 'Salary', type: 'numeric',
    valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
  { columnId: 'status', name: 'Status' },
];

const gridProps = {
  columns, data: people, getRowId,
  columnReorder: true, defaultPageSize: 10,
};
</script>

<template>
  <v-app>
    <OGrid :gridProps="gridProps" />
  </v-app>
</template>
`,
    'OGrid Column Reordering — Vue',
  ),
  JS: createJSProject(
    `import { OGrid } from '@alaarab/ogrid-js';
import '@alaarab/ogrid-js/styles';
import { people, getRowId } from './data';

const grid = new OGrid(document.getElementById('grid')!, {
  columns: [
    { columnId: 'name', name: 'Name' },
    { columnId: 'email', name: 'Email' },
    { columnId: 'department', name: 'Department' },
    { columnId: 'salary', name: 'Salary', type: 'numeric',
      valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
    { columnId: 'status', name: 'Status' },
  ],
  data: people,
  getRowId,
  columnReorder: true,
  pageSize: 10,
});
`,
    'OGrid Column Reordering — JS',
  ),
};

// ── Column Groups ──

export const columnGroups: FeatureDemoSet = {
  React: createReactProject(
    `import { OGrid } from '@alaarab/ogrid-react-radix';
import { people, getRowId, type Person } from './data';

const columns = [
  {
    headerName: 'Personal Info',
    children: [
      { columnId: 'name', name: 'Name' },
      { columnId: 'age', name: 'Age', type: 'numeric' as const },
      { columnId: 'email', name: 'Email' },
    ],
  },
  {
    headerName: 'Employment',
    children: [
      { columnId: 'department', name: 'Department' },
      { columnId: 'salary', name: 'Salary', type: 'numeric' as const,
        valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
      { columnId: 'status', name: 'Status' },
    ],
  },
];

export default function App() {
  return <OGrid<Person> columns={columns} data={people} getRowId={getRowId} defaultPageSize={10} />;
}
`,
    'OGrid Column Groups — React',
  ),
  Angular: createAngularProject(
    `import { Component } from '@angular/core';
import { OGridComponent } from '@alaarab/ogrid-angular-material';
import { people, getRowId } from './data';

@Component({
  standalone: true,
  imports: [OGridComponent],
  template: \`<ogrid [props]="gridProps" />\`,
})
export class AppComponent {
  gridProps = {
    columns: [
      {
        headerName: 'Personal Info',
        children: [
          { columnId: 'name', name: 'Name' },
          { columnId: 'age', name: 'Age', type: 'numeric' },
          { columnId: 'email', name: 'Email' },
        ],
      },
      {
        headerName: 'Employment',
        children: [
          { columnId: 'department', name: 'Department' },
          { columnId: 'salary', name: 'Salary', type: 'numeric',
            valueFormatter: (v: unknown) => \`$\${Number(v).toLocaleString()}\` },
          { columnId: 'status', name: 'Status' },
        ],
      },
    ],
    data: people,
    getRowId,
    defaultPageSize: 10,
  };
}
`,
    'OGrid Column Groups — Angular',
  ),
  Vue: createVueProject(
    `<script setup lang="ts">
import { OGrid } from '@alaarab/ogrid-vue-vuetify';
import { people, getRowId } from './data';

const columns = [
  {
    headerName: 'Personal Info',
    children: [
      { columnId: 'name', name: 'Name' },
      { columnId: 'age', name: 'Age', type: 'numeric' },
      { columnId: 'email', name: 'Email' },
    ],
  },
  {
    headerName: 'Employment',
    children: [
      { columnId: 'department', name: 'Department' },
      { columnId: 'salary', name: 'Salary', type: 'numeric',
        valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
      { columnId: 'status', name: 'Status' },
    ],
  },
];

const gridProps = { columns, data: people, getRowId, defaultPageSize: 10 };
</script>

<template>
  <v-app>
    <OGrid :gridProps="gridProps" />
  </v-app>
</template>
`,
    'OGrid Column Groups — Vue',
  ),
  JS: createJSProject(
    `import { OGrid } from '@alaarab/ogrid-js';
import '@alaarab/ogrid-js/styles';
import { people, getRowId } from './data';

const grid = new OGrid(document.getElementById('grid')!, {
  columns: [
    {
      headerName: 'Personal Info',
      children: [
        { columnId: 'name', name: 'Name' },
        { columnId: 'age', name: 'Age', type: 'numeric' },
        { columnId: 'email', name: 'Email' },
      ],
    },
    {
      headerName: 'Employment',
      children: [
        { columnId: 'department', name: 'Department' },
        { columnId: 'salary', name: 'Salary', type: 'numeric',
          valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
        { columnId: 'status', name: 'Status' },
      ],
    },
  ],
  data: people,
  getRowId,
  pageSize: 10,
});
`,
    'OGrid Column Groups — JS',
  ),
};

// ── Context Menu ──

export const contextMenu: FeatureDemoSet = {
  React: createReactProject(
    `import { OGrid } from '@alaarab/ogrid-react-radix';
import { people, getRowId, type Person } from './data';

const columns = [
  { columnId: 'name', name: 'Name', sortable: true, editable: true },
  { columnId: 'department', name: 'Department', sortable: true },
  { columnId: 'salary', name: 'Salary', type: 'numeric' as const, editable: true,
    valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
];

export default function App() {
  return (
    <OGrid<Person>
      columns={columns} data={people} getRowId={getRowId}
      contextMenu editable defaultPageSize={10}
    />
  );
}
`,
    'OGrid Context Menu — React',
  ),
  Angular: createAngularProject(
    `import { Component } from '@angular/core';
import { OGridComponent, type IColumnDef } from '@alaarab/ogrid-angular-material';
import { people, getRowId, type Person } from './data';

@Component({
  standalone: true,
  imports: [OGridComponent],
  template: \`<ogrid [props]="gridProps" />\`,
})
export class AppComponent {
  gridProps = {
    columns: [
      { columnId: 'name', name: 'Name', sortable: true, editable: true },
      { columnId: 'department', name: 'Department', sortable: true },
      { columnId: 'salary', name: 'Salary', type: 'numeric', editable: true,
        valueFormatter: (v: unknown) => \`$\${Number(v).toLocaleString()}\` },
    ] as IColumnDef<Person>[],
    data: people,
    getRowId,
    contextMenu: true,
    editable: true,
    defaultPageSize: 10,
  };
}
`,
    'OGrid Context Menu — Angular',
  ),
  Vue: createVueProject(
    `<script setup lang="ts">
import { OGrid, type IColumnDef } from '@alaarab/ogrid-vue-vuetify';
import { people, getRowId, type Person } from './data';

const columns: IColumnDef<Person>[] = [
  { columnId: 'name', name: 'Name', sortable: true, editable: true },
  { columnId: 'department', name: 'Department', sortable: true },
  { columnId: 'salary', name: 'Salary', type: 'numeric', editable: true,
    valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
];

const gridProps = {
  columns, data: people, getRowId,
  contextMenu: true, editable: true, defaultPageSize: 10,
};
</script>

<template>
  <v-app>
    <OGrid :gridProps="gridProps" />
  </v-app>
</template>
`,
    'OGrid Context Menu — Vue',
  ),
  JS: createJSProject(
    `import { OGrid } from '@alaarab/ogrid-js';
import '@alaarab/ogrid-js/styles';
import { people, getRowId } from './data';

const grid = new OGrid(document.getElementById('grid')!, {
  columns: [
    { columnId: 'name', name: 'Name', sortable: true, editable: true },
    { columnId: 'department', name: 'Department', sortable: true },
    { columnId: 'salary', name: 'Salary', type: 'numeric', editable: true,
      valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
  ],
  data: people,
  getRowId,
  contextMenu: true,
  editable: true,
  pageSize: 10,
});
`,
    'OGrid Context Menu — JS',
  ),
};

// ── Status Bar ──

export const statusBar: FeatureDemoSet = {
  React: createReactProject(
    `import { OGrid } from '@alaarab/ogrid-react-radix';
import { people, getRowId, type Person } from './data';

const columns = [
  { columnId: 'name', name: 'Name' },
  { columnId: 'age', name: 'Age', type: 'numeric' as const },
  { columnId: 'salary', name: 'Salary', type: 'numeric' as const,
    valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
  { columnId: 'department', name: 'Department' },
];

export default function App() {
  return <OGrid<Person> columns={columns} data={people} getRowId={getRowId} statusBar defaultPageSize={10} />;
}
`,
    'OGrid Status Bar — React',
  ),
  Angular: createAngularProject(
    `import { Component } from '@angular/core';
import { OGridComponent, type IColumnDef } from '@alaarab/ogrid-angular-material';
import { people, getRowId, type Person } from './data';

@Component({
  standalone: true,
  imports: [OGridComponent],
  template: \`<ogrid [props]="gridProps" />\`,
})
export class AppComponent {
  gridProps = {
    columns: [
      { columnId: 'name', name: 'Name' },
      { columnId: 'age', name: 'Age', type: 'numeric' },
      { columnId: 'salary', name: 'Salary', type: 'numeric',
        valueFormatter: (v: unknown) => \`$\${Number(v).toLocaleString()}\` },
      { columnId: 'department', name: 'Department' },
    ] as IColumnDef<Person>[],
    data: people,
    getRowId,
    statusBar: true,
    defaultPageSize: 10,
  };
}
`,
    'OGrid Status Bar — Angular',
  ),
  Vue: createVueProject(
    `<script setup lang="ts">
import { OGrid, type IColumnDef } from '@alaarab/ogrid-vue-vuetify';
import { people, getRowId, type Person } from './data';

const columns: IColumnDef<Person>[] = [
  { columnId: 'name', name: 'Name' },
  { columnId: 'age', name: 'Age', type: 'numeric' },
  { columnId: 'salary', name: 'Salary', type: 'numeric',
    valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
  { columnId: 'department', name: 'Department' },
];

const gridProps = { columns, data: people, getRowId, statusBar: true, defaultPageSize: 10 };
</script>

<template>
  <v-app>
    <OGrid :gridProps="gridProps" />
  </v-app>
</template>
`,
    'OGrid Status Bar — Vue',
  ),
  JS: createJSProject(
    `import { OGrid } from '@alaarab/ogrid-js';
import '@alaarab/ogrid-js/styles';
import { people, getRowId } from './data';

const grid = new OGrid(document.getElementById('grid')!, {
  columns: [
    { columnId: 'name', name: 'Name' },
    { columnId: 'age', name: 'Age', type: 'numeric' },
    { columnId: 'salary', name: 'Salary', type: 'numeric',
      valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
    { columnId: 'department', name: 'Department' },
  ],
  data: people,
  getRowId,
  statusBar: true,
  pageSize: 10,
});
`,
    'OGrid Status Bar — JS',
  ),
};

// ── Grid API ──

export const gridApi: FeatureDemoSet = {
  React: createReactProject(
    `import { useRef } from 'react';
import { OGrid, type IOGridApi } from '@alaarab/ogrid-react-radix';
import { people, getRowId, type Person } from './data';

const columns = [
  { columnId: 'name', name: 'Name', sortable: true },
  { columnId: 'department', name: 'Department', sortable: true,
    filterable: { type: 'multiSelect', filterField: 'department' } },
  { columnId: 'salary', name: 'Salary', type: 'numeric' as const, sortable: true,
    valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
  { columnId: 'status', name: 'Status',
    filterable: { type: 'multiSelect', filterField: 'status' } },
];

export default function App() {
  const ref = useRef<IOGridApi<Person>>(null);
  return (
    <div>
      <button onClick={() => console.log(ref.current?.getColumnState())}>Log State</button>
      <OGrid<Person> ref={ref} columns={columns} data={people} getRowId={getRowId} defaultPageSize={10} />
    </div>
  );
}
`,
    'OGrid Grid API — React',
  ),
  Angular: createAngularProject(
    `import { Component } from '@angular/core';
import { OGridComponent, OGridService, type IColumnDef } from '@alaarab/ogrid-angular-material';
import { people, getRowId, type Person } from './data';

@Component({
  standalone: true,
  imports: [OGridComponent],
  template: \`
    <button (click)="logState()">Log State</button>
    <ogrid [props]="gridProps" />
  \`,
})
export class AppComponent {
  constructor(private gridService: OGridService) {}

  logState() {
    console.log(this.gridService.getColumnState());
  }

  gridProps = {
    columns: [
      { columnId: 'name', name: 'Name', sortable: true },
      { columnId: 'department', name: 'Department', sortable: true,
        filterable: { type: 'multiSelect', filterField: 'department' } },
      { columnId: 'salary', name: 'Salary', type: 'numeric', sortable: true,
        valueFormatter: (v: unknown) => \`$\${Number(v).toLocaleString()}\` },
      { columnId: 'status', name: 'Status',
        filterable: { type: 'multiSelect', filterField: 'status' } },
    ] as IColumnDef<Person>[],
    data: people,
    getRowId,
    defaultPageSize: 10,
  };
}
`,
    'OGrid Grid API — Angular',
  ),
  Vue: createVueProject(
    `<script setup lang="ts">
import { OGrid, useOGrid, type IColumnDef } from '@alaarab/ogrid-vue-vuetify';
import { people, getRowId, type Person } from './data';

const columns: IColumnDef<Person>[] = [
  { columnId: 'name', name: 'Name', sortable: true },
  { columnId: 'department', name: 'Department', sortable: true,
    filterable: { type: 'multiSelect', filterField: 'department' } },
  { columnId: 'salary', name: 'Salary', type: 'numeric', sortable: true,
    valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
  { columnId: 'status', name: 'Status',
    filterable: { type: 'multiSelect', filterField: 'status' } },
];

const gridProps = { columns, data: people, getRowId, defaultPageSize: 10 };
</script>

<template>
  <v-app>
    <OGrid :gridProps="gridProps" />
  </v-app>
</template>
`,
    'OGrid Grid API — Vue',
  ),
  JS: createJSProject(
    `import { OGrid } from '@alaarab/ogrid-js';
import '@alaarab/ogrid-js/styles';
import { people, getRowId } from './data';

const grid = new OGrid(document.getElementById('grid')!, {
  columns: [
    { columnId: 'name', name: 'Name', sortable: true },
    { columnId: 'department', name: 'Department', sortable: true,
      filterable: { type: 'multiSelect', filterField: 'department' } },
    { columnId: 'salary', name: 'Salary', type: 'numeric', sortable: true,
      valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
    { columnId: 'status', name: 'Status',
      filterable: { type: 'multiSelect', filterField: 'status' } },
  ],
  data: people,
  getRowId,
  pageSize: 10,
});

const api = grid.getApi();
console.log('Column state:', api.getColumnState());
`,
    'OGrid Grid API — JS',
  ),
};

// ── Column Chooser ──

export const columnChooser: FeatureDemoSet = {
  React: createReactProject(
    `import { OGrid, type IColumnDef } from '@alaarab/ogrid-react-radix';
import { people, getRowId, type Person } from './data';

const columns: IColumnDef<Person>[] = [
  { columnId: 'name', name: 'Name', required: true },
  { columnId: 'email', name: 'Email' },
  { columnId: 'age', name: 'Age', type: 'numeric', defaultVisible: false },
  { columnId: 'department', name: 'Department' },
  { columnId: 'salary', name: 'Salary', type: 'numeric',
    valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
  { columnId: 'startDate', name: 'Start Date', defaultVisible: false },
];

export default function App() {
  return <OGrid<Person> columns={columns} data={people} getRowId={getRowId} columnChooser defaultPageSize={10} />;
}
`,
    'OGrid Column Chooser — React',
  ),
  Angular: createAngularProject(
    `import { Component } from '@angular/core';
import { OGridComponent, type IColumnDef } from '@alaarab/ogrid-angular-material';
import { people, getRowId, type Person } from './data';

@Component({
  standalone: true,
  imports: [OGridComponent],
  template: \`<ogrid [props]="gridProps" />\`,
})
export class AppComponent {
  gridProps = {
    columns: [
      { columnId: 'name', name: 'Name', required: true },
      { columnId: 'email', name: 'Email' },
      { columnId: 'age', name: 'Age', type: 'numeric', defaultVisible: false },
      { columnId: 'department', name: 'Department' },
      { columnId: 'salary', name: 'Salary', type: 'numeric',
        valueFormatter: (v: unknown) => \`$\${Number(v).toLocaleString()}\` },
      { columnId: 'startDate', name: 'Start Date', defaultVisible: false },
    ] as IColumnDef<Person>[],
    data: people,
    getRowId,
    columnChooser: true,
    defaultPageSize: 10,
  };
}
`,
    'OGrid Column Chooser — Angular',
  ),
  Vue: createVueProject(
    `<script setup lang="ts">
import { OGrid, type IColumnDef } from '@alaarab/ogrid-vue-vuetify';
import { people, getRowId, type Person } from './data';

const columns: IColumnDef<Person>[] = [
  { columnId: 'name', name: 'Name', required: true },
  { columnId: 'email', name: 'Email' },
  { columnId: 'age', name: 'Age', type: 'numeric', defaultVisible: false },
  { columnId: 'department', name: 'Department' },
  { columnId: 'salary', name: 'Salary', type: 'numeric',
    valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
  { columnId: 'startDate', name: 'Start Date', defaultVisible: false },
];

const gridProps = { columns, data: people, getRowId, columnChooser: true, defaultPageSize: 10 };
</script>

<template>
  <v-app>
    <OGrid :gridProps="gridProps" />
  </v-app>
</template>
`,
    'OGrid Column Chooser — Vue',
  ),
  JS: createJSProject(
    `import { OGrid } from '@alaarab/ogrid-js';
import '@alaarab/ogrid-js/styles';
import { people, getRowId } from './data';

const grid = new OGrid(document.getElementById('grid')!, {
  columns: [
    { columnId: 'name', name: 'Name', required: true },
    { columnId: 'email', name: 'Email' },
    { columnId: 'age', name: 'Age', type: 'numeric', defaultVisible: false },
    { columnId: 'department', name: 'Department' },
    { columnId: 'salary', name: 'Salary', type: 'numeric',
      valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
    { columnId: 'startDate', name: 'Start Date', defaultVisible: false },
  ],
  data: people,
  getRowId,
  columnChooser: true,
  pageSize: 10,
});
`,
    'OGrid Column Chooser — JS',
  ),
};

// ── Toolbar ──

export const toolbar: FeatureDemoSet = {
  React: createReactProject(
    `import { OGrid, type IColumnDef } from '@alaarab/ogrid-react-radix';
import { people, getRowId, type Person } from './data';

const columns: IColumnDef<Person>[] = [
  { columnId: 'name', name: 'Name', sortable: true, filterable: { type: 'text' } },
  { columnId: 'email', name: 'Email' },
  { columnId: 'department', name: 'Department', sortable: true,
    filterable: { type: 'multiSelect', filterField: 'department' } },
  { columnId: 'salary', name: 'Salary', type: 'numeric', sortable: true,
    valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
];

export default function App() {
  return (
    <OGrid<Person>
      columns={columns} data={people} getRowId={getRowId}
      columnChooser toolbar={<span>My Grid</span>}
      defaultPageSize={10}
    />
  );
}
`,
    'OGrid Toolbar — React',
  ),
  Angular: createAngularProject(
    `import { Component } from '@angular/core';
import { OGridComponent, type IColumnDef } from '@alaarab/ogrid-angular-material';
import { people, getRowId, type Person } from './data';

@Component({
  standalone: true,
  imports: [OGridComponent],
  template: \`<ogrid [props]="gridProps" />\`,
})
export class AppComponent {
  gridProps = {
    columns: [
      { columnId: 'name', name: 'Name', sortable: true, filterable: { type: 'text' } },
      { columnId: 'email', name: 'Email' },
      { columnId: 'department', name: 'Department', sortable: true,
        filterable: { type: 'multiSelect', filterField: 'department' } },
      { columnId: 'salary', name: 'Salary', type: 'numeric', sortable: true,
        valueFormatter: (v: unknown) => \`$\${Number(v).toLocaleString()}\` },
    ] as IColumnDef<Person>[],
    data: people,
    getRowId,
    columnChooser: true,
    defaultPageSize: 10,
  };
}
`,
    'OGrid Toolbar — Angular',
  ),
  Vue: createVueProject(
    `<script setup lang="ts">
import { OGrid, type IColumnDef } from '@alaarab/ogrid-vue-vuetify';
import { people, getRowId, type Person } from './data';

const columns: IColumnDef<Person>[] = [
  { columnId: 'name', name: 'Name', sortable: true, filterable: { type: 'text' } },
  { columnId: 'email', name: 'Email' },
  { columnId: 'department', name: 'Department', sortable: true,
    filterable: { type: 'multiSelect', filterField: 'department' } },
  { columnId: 'salary', name: 'Salary', type: 'numeric', sortable: true,
    valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
];

const gridProps = { columns, data: people, getRowId, columnChooser: true, defaultPageSize: 10 };
</script>

<template>
  <v-app>
    <OGrid :gridProps="gridProps" />
  </v-app>
</template>
`,
    'OGrid Toolbar — Vue',
  ),
  JS: createJSProject(
    `import { OGrid } from '@alaarab/ogrid-js';
import '@alaarab/ogrid-js/styles';
import { people, getRowId } from './data';

const grid = new OGrid(document.getElementById('grid')!, {
  columns: [
    { columnId: 'name', name: 'Name', sortable: true, filterable: { type: 'text' } },
    { columnId: 'email', name: 'Email' },
    { columnId: 'department', name: 'Department', sortable: true,
      filterable: { type: 'multiSelect', filterField: 'department' } },
    { columnId: 'salary', name: 'Salary', type: 'numeric', sortable: true,
      valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
  ],
  data: people,
  getRowId,
  columnChooser: true,
  pageSize: 10,
});
`,
    'OGrid Toolbar — JS',
  ),
};

// ── Side Bar ──

export const sidebar: FeatureDemoSet = {
  React: createReactProject(
    `import { OGrid, type IColumnDef } from '@alaarab/ogrid-react-radix';
import { people, getRowId, type Person } from './data';

const columns: IColumnDef<Person>[] = [
  { columnId: 'name', name: 'Name', sortable: true, filterable: { type: 'text' } },
  { columnId: 'department', name: 'Department', sortable: true,
    filterable: { type: 'multiSelect', filterField: 'department' } },
  { columnId: 'salary', name: 'Salary', type: 'numeric',
    valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
  { columnId: 'status', name: 'Status',
    filterable: { type: 'multiSelect', filterField: 'status' } },
];

export default function App() {
  return (
    <OGrid<Person>
      columns={columns} data={people} getRowId={getRowId}
      sideBar columnChooser="sidebar" pagination defaultPageSize={10}
    />
  );
}
`,
    'OGrid Side Bar — React',
  ),
  Angular: createAngularProject(
    `import { Component } from '@angular/core';
import { OGridComponent, type IColumnDef } from '@alaarab/ogrid-angular-material';
import { people, getRowId, type Person } from './data';

@Component({
  standalone: true,
  imports: [OGridComponent],
  template: \`<ogrid [props]="gridProps" />\`,
})
export class AppComponent {
  gridProps = {
    columns: [
      { columnId: 'name', name: 'Name', sortable: true, filterable: { type: 'text' } },
      { columnId: 'department', name: 'Department', sortable: true,
        filterable: { type: 'multiSelect', filterField: 'department' } },
      { columnId: 'salary', name: 'Salary', type: 'numeric',
        valueFormatter: (v: unknown) => \`$\${Number(v).toLocaleString()}\` },
      { columnId: 'status', name: 'Status',
        filterable: { type: 'multiSelect', filterField: 'status' } },
    ] as IColumnDef<Person>[],
    data: people,
    getRowId,
    sideBar: true,
    columnChooser: 'sidebar',
    pagination: true,
    defaultPageSize: 10,
  };
}
`,
    'OGrid Side Bar — Angular',
  ),
  Vue: createVueProject(
    `<script setup lang="ts">
import { OGrid, type IColumnDef } from '@alaarab/ogrid-vue-vuetify';
import { people, getRowId, type Person } from './data';

const columns: IColumnDef<Person>[] = [
  { columnId: 'name', name: 'Name', sortable: true, filterable: { type: 'text' } },
  { columnId: 'department', name: 'Department', sortable: true,
    filterable: { type: 'multiSelect', filterField: 'department' } },
  { columnId: 'salary', name: 'Salary', type: 'numeric',
    valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
  { columnId: 'status', name: 'Status',
    filterable: { type: 'multiSelect', filterField: 'status' } },
];

const gridProps = {
  columns, data: people, getRowId,
  sideBar: true, columnChooser: 'sidebar', pagination: true, defaultPageSize: 10,
};
</script>

<template>
  <v-app>
    <OGrid :gridProps="gridProps" />
  </v-app>
</template>
`,
    'OGrid Side Bar — Vue',
  ),
  JS: createJSProject(
    `import { OGrid } from '@alaarab/ogrid-js';
import '@alaarab/ogrid-js/styles';
import { people, getRowId } from './data';

const grid = new OGrid(document.getElementById('grid')!, {
  columns: [
    { columnId: 'name', name: 'Name', sortable: true, filterable: { type: 'text' } },
    { columnId: 'department', name: 'Department', sortable: true,
      filterable: { type: 'multiSelect', filterField: 'department' } },
    { columnId: 'salary', name: 'Salary', type: 'numeric',
      valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
    { columnId: 'status', name: 'Status',
      filterable: { type: 'multiSelect', filterField: 'status' } },
  ],
  data: people,
  getRowId,
  sideBar: true,
  columnChooser: 'sidebar',
  pagination: true,
  pageSize: 10,
});
`,
    'OGrid Side Bar — JS',
  ),
};

// ── CSV Export ──

export const csvExport: FeatureDemoSet = {
  React: createReactProject(
    `import { useRef } from 'react';
import { OGrid, type IOGridApi } from '@alaarab/ogrid-react-radix';
import { people, getRowId, type Person } from './data';

const columns = [
  { columnId: 'name', name: 'Name' },
  { columnId: 'email', name: 'Email' },
  { columnId: 'department', name: 'Department' },
  { columnId: 'salary', name: 'Salary', type: 'numeric' as const,
    valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
];

export default function App() {
  const ref = useRef<IOGridApi<Person>>(null);
  return (
    <div>
      <button onClick={() => ref.current?.exportToCsv()}>Export CSV</button>
      <OGrid<Person> ref={ref} columns={columns} data={people} getRowId={getRowId} defaultPageSize={10} />
    </div>
  );
}
`,
    'OGrid CSV Export — React',
  ),
  Angular: createAngularProject(
    `import { Component } from '@angular/core';
import { OGridComponent, OGridService, type IColumnDef } from '@alaarab/ogrid-angular-material';
import { people, getRowId, type Person } from './data';

@Component({
  standalone: true,
  imports: [OGridComponent],
  template: \`
    <button (click)="exportCsv()">Export CSV</button>
    <ogrid [props]="gridProps" />
  \`,
})
export class AppComponent {
  constructor(private gridService: OGridService) {}

  exportCsv() {
    this.gridService.exportToCsv();
  }

  gridProps = {
    columns: [
      { columnId: 'name', name: 'Name' },
      { columnId: 'email', name: 'Email' },
      { columnId: 'department', name: 'Department' },
      { columnId: 'salary', name: 'Salary', type: 'numeric',
        valueFormatter: (v: unknown) => \`$\${Number(v).toLocaleString()}\` },
    ] as IColumnDef<Person>[],
    data: people,
    getRowId,
    defaultPageSize: 10,
  };
}
`,
    'OGrid CSV Export — Angular',
  ),
  Vue: createVueProject(
    `<script setup lang="ts">
import { OGrid, useOGrid, type IColumnDef } from '@alaarab/ogrid-vue-vuetify';
import { people, getRowId, type Person } from './data';

const columns: IColumnDef<Person>[] = [
  { columnId: 'name', name: 'Name' },
  { columnId: 'email', name: 'Email' },
  { columnId: 'department', name: 'Department' },
  { columnId: 'salary', name: 'Salary', type: 'numeric',
    valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
];

const gridProps = { columns, data: people, getRowId, defaultPageSize: 10 };
</script>

<template>
  <v-app>
    <OGrid :gridProps="gridProps" />
  </v-app>
</template>
`,
    'OGrid CSV Export — Vue',
  ),
  JS: createJSProject(
    `import { OGrid } from '@alaarab/ogrid-js';
import '@alaarab/ogrid-js/styles';
import { people, getRowId } from './data';

const grid = new OGrid(document.getElementById('grid')!, {
  columns: [
    { columnId: 'name', name: 'Name' },
    { columnId: 'email', name: 'Email' },
    { columnId: 'department', name: 'Department' },
    { columnId: 'salary', name: 'Salary', type: 'numeric',
      valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
  ],
  data: people,
  getRowId,
  pageSize: 10,
});

// Export via API
document.querySelector('button')?.addEventListener('click', () => {
  grid.getApi().exportToCsv();
});
`,
    'OGrid CSV Export — JS',
  ),
};

// ── Server-Side Data ──

export const serverSideData: FeatureDemoSet = {
  React: createReactProject(
    `import { OGrid, type IDataSource } from '@alaarab/ogrid-react-radix';
import { people, getRowId, type Person } from './data';

// Simulated server-side data source
const dataSource: IDataSource<Person> = {
  fetchPage: async ({ page, pageSize, sort, filters }) => {
    // In a real app, this would be an API call
    let items = [...people];
    if (sort?.field) {
      items.sort((a, b) => {
        const val = String(a[sort.field]) > String(b[sort.field]) ? 1 : -1;
        return sort.direction === 'desc' ? -val : val;
      });
    }
    const start = (page - 1) * pageSize;
    return { items: items.slice(start, start + pageSize), totalCount: items.length };
  },
};

const columns = [
  { columnId: 'name', name: 'Name', sortable: true },
  { columnId: 'email', name: 'Email' },
  { columnId: 'department', name: 'Department', sortable: true },
  { columnId: 'salary', name: 'Salary', type: 'numeric' as const, sortable: true,
    valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
];

export default function App() {
  return <OGrid<Person> columns={columns} dataSource={dataSource} getRowId={getRowId} defaultPageSize={5} />;
}
`,
    'OGrid Server-Side — React',
  ),
  Angular: createAngularProject(
    `import { Component } from '@angular/core';
import { OGridComponent, type IColumnDef, type IDataSource } from '@alaarab/ogrid-angular-material';
import { people, getRowId, type Person } from './data';

const dataSource: IDataSource<Person> = {
  fetchPage: async ({ page, pageSize, sort }) => {
    let items = [...people];
    if (sort?.field) {
      items.sort((a: any, b: any) => {
        const val = String(a[sort.field]) > String(b[sort.field]) ? 1 : -1;
        return sort.direction === 'desc' ? -val : val;
      });
    }
    const start = (page - 1) * pageSize;
    return { items: items.slice(start, start + pageSize), totalCount: items.length };
  },
};

@Component({
  standalone: true,
  imports: [OGridComponent],
  template: \`<ogrid [props]="gridProps" />\`,
})
export class AppComponent {
  gridProps = {
    columns: [
      { columnId: 'name', name: 'Name', sortable: true },
      { columnId: 'email', name: 'Email' },
      { columnId: 'department', name: 'Department', sortable: true },
      { columnId: 'salary', name: 'Salary', type: 'numeric', sortable: true,
        valueFormatter: (v: unknown) => \`$\${Number(v).toLocaleString()}\` },
    ] as IColumnDef<Person>[],
    dataSource,
    getRowId,
    defaultPageSize: 5,
  };
}
`,
    'OGrid Server-Side — Angular',
  ),
  Vue: createVueProject(
    `<script setup lang="ts">
import { OGrid, type IColumnDef, type IDataSource } from '@alaarab/ogrid-vue-vuetify';
import { people, getRowId, type Person } from './data';

const dataSource: IDataSource<Person> = {
  fetchPage: async ({ page, pageSize, sort }) => {
    let items = [...people];
    if (sort?.field) {
      items.sort((a: any, b: any) => {
        const val = String(a[sort.field]) > String(b[sort.field]) ? 1 : -1;
        return sort.direction === 'desc' ? -val : val;
      });
    }
    const start = (page - 1) * pageSize;
    return { items: items.slice(start, start + pageSize), totalCount: items.length };
  },
};

const columns: IColumnDef<Person>[] = [
  { columnId: 'name', name: 'Name', sortable: true },
  { columnId: 'email', name: 'Email' },
  { columnId: 'department', name: 'Department', sortable: true },
  { columnId: 'salary', name: 'Salary', type: 'numeric', sortable: true,
    valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
];

const gridProps = { columns, dataSource, getRowId, defaultPageSize: 5 };
</script>

<template>
  <v-app>
    <OGrid :gridProps="gridProps" />
  </v-app>
</template>
`,
    'OGrid Server-Side — Vue',
  ),
  JS: createJSProject(
    `import { OGrid } from '@alaarab/ogrid-js';
import '@alaarab/ogrid-js/styles';
import { people, getRowId } from './data';

const grid = new OGrid(document.getElementById('grid')!, {
  columns: [
    { columnId: 'name', name: 'Name', sortable: true },
    { columnId: 'email', name: 'Email' },
    { columnId: 'department', name: 'Department', sortable: true },
    { columnId: 'salary', name: 'Salary', type: 'numeric', sortable: true,
      valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
  ],
  dataSource: {
    fetchPage: async ({ page, pageSize, sort }) => {
      let items = [...people];
      if (sort?.field) {
        items.sort((a, b) => {
          const val = String(a[sort.field]) > String(b[sort.field]) ? 1 : -1;
          return sort.direction === 'desc' ? -val : val;
        });
      }
      const start = (page - 1) * pageSize;
      return { items: items.slice(start, start + pageSize), totalCount: items.length };
    },
  },
  getRowId,
  pageSize: 5,
});
`,
    'OGrid Server-Side — JS',
  ),
};

// ── Keyboard Navigation ──

export const keyboardNavigation: FeatureDemoSet = {
  React: createReactProject(
    `import { OGrid } from '@alaarab/ogrid-react-radix';
import { people, getRowId, type Person } from './data';

const columns = [
  { columnId: 'name', name: 'Name', editable: true },
  { columnId: 'age', name: 'Age', type: 'numeric' as const },
  { columnId: 'department', name: 'Department' },
  { columnId: 'salary', name: 'Salary', type: 'numeric' as const,
    valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
  { columnId: 'email', name: 'Email' },
];

export default function App() {
  return <OGrid<Person> columns={columns} data={people} getRowId={getRowId} editable defaultPageSize={10} />;
}
`,
    'OGrid Keyboard Nav — React',
  ),
  Angular: createAngularProject(
    `import { Component } from '@angular/core';
import { OGridComponent, type IColumnDef } from '@alaarab/ogrid-angular-material';
import { people, getRowId, type Person } from './data';

@Component({
  standalone: true,
  imports: [OGridComponent],
  template: \`<ogrid [props]="gridProps" />\`,
})
export class AppComponent {
  gridProps = {
    columns: [
      { columnId: 'name', name: 'Name', editable: true },
      { columnId: 'age', name: 'Age', type: 'numeric' },
      { columnId: 'department', name: 'Department' },
      { columnId: 'salary', name: 'Salary', type: 'numeric',
        valueFormatter: (v: unknown) => \`$\${Number(v).toLocaleString()}\` },
      { columnId: 'email', name: 'Email' },
    ] as IColumnDef<Person>[],
    data: people,
    getRowId,
    editable: true,
    defaultPageSize: 10,
  };
}
`,
    'OGrid Keyboard Nav — Angular',
  ),
  Vue: createVueProject(
    `<script setup lang="ts">
import { OGrid, type IColumnDef } from '@alaarab/ogrid-vue-vuetify';
import { people, getRowId, type Person } from './data';

const columns: IColumnDef<Person>[] = [
  { columnId: 'name', name: 'Name', editable: true },
  { columnId: 'age', name: 'Age', type: 'numeric' },
  { columnId: 'department', name: 'Department' },
  { columnId: 'salary', name: 'Salary', type: 'numeric',
    valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
  { columnId: 'email', name: 'Email' },
];

const gridProps = { columns, data: people, getRowId, editable: true, defaultPageSize: 10 };
</script>

<template>
  <v-app>
    <OGrid :gridProps="gridProps" />
  </v-app>
</template>
`,
    'OGrid Keyboard Nav — Vue',
  ),
  JS: createJSProject(
    `import { OGrid } from '@alaarab/ogrid-js';
import '@alaarab/ogrid-js/styles';
import { people, getRowId } from './data';

const grid = new OGrid(document.getElementById('grid')!, {
  columns: [
    { columnId: 'name', name: 'Name', editable: true },
    { columnId: 'age', name: 'Age', type: 'numeric' },
    { columnId: 'department', name: 'Department' },
    { columnId: 'salary', name: 'Salary', type: 'numeric',
      valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
    { columnId: 'email', name: 'Email' },
  ],
  data: people,
  getRowId,
  editable: true,
  pageSize: 10,
});
`,
    'OGrid Keyboard Nav — JS',
  ),
};

// ── Column Types ──

export const columnTypes: FeatureDemoSet = {
  React: createReactProject(
    `import { OGrid, type IColumnDef } from '@alaarab/ogrid-react-radix';
import { people, getRowId, type Person } from './data';

const columns: IColumnDef<Person>[] = [
  { columnId: 'name', name: 'Name' },
  { columnId: 'age', name: 'Age', type: 'numeric' },
  { columnId: 'salary', name: 'Salary', type: 'numeric',
    valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
  { columnId: 'startDate', name: 'Start Date', type: 'date' },
  { columnId: 'department', name: 'Department' },
];

export default function App() {
  return <OGrid<Person> columns={columns} data={people} getRowId={getRowId} defaultPageSize={10} />;
}
`,
    'OGrid Column Types — React',
  ),
  Angular: createAngularProject(
    `import { Component } from '@angular/core';
import { OGridComponent, type IColumnDef } from '@alaarab/ogrid-angular-material';
import { people, getRowId, type Person } from './data';

@Component({
  standalone: true,
  imports: [OGridComponent],
  template: \`<ogrid [props]="gridProps" />\`,
})
export class AppComponent {
  gridProps = {
    columns: [
      { columnId: 'name', name: 'Name' },
      { columnId: 'age', name: 'Age', type: 'numeric' },
      { columnId: 'salary', name: 'Salary', type: 'numeric',
        valueFormatter: (v: unknown) => \`$\${Number(v).toLocaleString()}\` },
      { columnId: 'startDate', name: 'Start Date', type: 'date' },
      { columnId: 'department', name: 'Department' },
    ] as IColumnDef<Person>[],
    data: people,
    getRowId,
    defaultPageSize: 10,
  };
}
`,
    'OGrid Column Types — Angular',
  ),
  Vue: createVueProject(
    `<script setup lang="ts">
import { OGrid, type IColumnDef } from '@alaarab/ogrid-vue-vuetify';
import { people, getRowId, type Person } from './data';

const columns: IColumnDef<Person>[] = [
  { columnId: 'name', name: 'Name' },
  { columnId: 'age', name: 'Age', type: 'numeric' },
  { columnId: 'salary', name: 'Salary', type: 'numeric',
    valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
  { columnId: 'startDate', name: 'Start Date', type: 'date' },
  { columnId: 'department', name: 'Department' },
];

const gridProps = { columns, data: people, getRowId, defaultPageSize: 10 };
</script>

<template>
  <v-app>
    <OGrid :gridProps="gridProps" />
  </v-app>
</template>
`,
    'OGrid Column Types — Vue',
  ),
  JS: createJSProject(
    `import { OGrid } from '@alaarab/ogrid-js';
import '@alaarab/ogrid-js/styles';
import { people, getRowId } from './data';

const grid = new OGrid(document.getElementById('grid')!, {
  columns: [
    { columnId: 'name', name: 'Name' },
    { columnId: 'age', name: 'Age', type: 'numeric' },
    { columnId: 'salary', name: 'Salary', type: 'numeric',
      valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
    { columnId: 'startDate', name: 'Start Date', type: 'date' },
    { columnId: 'department', name: 'Department' },
  ],
  data: people,
  getRowId,
  pageSize: 10,
});
`,
    'OGrid Column Types — JS',
  ),
};

// ── Showcase (full-featured demo for framework-showcase page) ──

export const showcase: FeatureDemoSet = {
  React: createReactProject(
    `import { useState, useRef } from 'react';
import { OGrid, useUndoRedo, type IOGridApi, type IColumnDef } from '@alaarab/ogrid-react-radix';
import { people, getRowId, type Person } from './data';

const DEPTS = ['Engineering', 'Marketing', 'Sales', 'Finance', 'Operations'];

const columns: IColumnDef<Person>[] = [
  { columnId: 'name', name: 'Name', sortable: true, editable: true,
    filterable: { type: 'text' } },
  { columnId: 'age', name: 'Age', type: 'numeric', sortable: true, editable: true },
  { columnId: 'email', name: 'Email' },
  { columnId: 'department', name: 'Department', sortable: true, editable: true,
    cellEditor: 'richSelect', cellEditorParams: { values: DEPTS },
    filterable: { type: 'multiSelect', filterField: 'department' } },
  { columnId: 'salary', name: 'Salary', type: 'numeric', sortable: true, editable: true,
    valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
  { columnId: 'status', name: 'Status',
    filterable: { type: 'multiSelect', filterField: 'status' } },
];

export default function App() {
  const [data, setData] = useState(people);
  const { handleCellValueChanged, undo, redo, canUndo, canRedo } = useUndoRedo({
    data, setData, getRowId,
  });

  return (
    <OGrid<Person>
      columns={columns} data={data} getRowId={getRowId}
      editable onCellValueChanged={handleCellValueChanged}
      onUndo={undo} onRedo={redo} canUndo={canUndo} canRedo={canRedo}
      contextMenu statusBar columnChooser sideBar
      defaultPageSize={10} defaultSortBy="name"
    />
  );
}
`,
    'OGrid Full Demo — React',
  ),
  Angular: createAngularProject(
    `import { Component } from '@angular/core';
import { OGridComponent, type IColumnDef } from '@alaarab/ogrid-angular-material';
import { people, getRowId, type Person } from './data';

const DEPTS = ['Engineering', 'Marketing', 'Sales', 'Finance', 'Operations'];

@Component({
  standalone: true,
  imports: [OGridComponent],
  template: \`<ogrid [props]="gridProps" />\`,
})
export class AppComponent {
  gridProps = {
    columns: [
      { columnId: 'name', name: 'Name', sortable: true, editable: true,
        filterable: { type: 'text' } },
      { columnId: 'age', name: 'Age', type: 'numeric', sortable: true, editable: true },
      { columnId: 'email', name: 'Email' },
      { columnId: 'department', name: 'Department', sortable: true, editable: true,
        cellEditor: 'richSelect', cellEditorParams: { values: DEPTS },
        filterable: { type: 'multiSelect', filterField: 'department' } },
      { columnId: 'salary', name: 'Salary', type: 'numeric', sortable: true, editable: true,
        valueFormatter: (v: unknown) => \`$\${Number(v).toLocaleString()}\` },
      { columnId: 'status', name: 'Status',
        filterable: { type: 'multiSelect', filterField: 'status' } },
    ] as IColumnDef<Person>[],
    data: people,
    getRowId,
    editable: true,
    contextMenu: true,
    statusBar: true,
    columnChooser: true,
    sideBar: true,
    defaultPageSize: 10,
    defaultSortBy: 'name',
  };
}
`,
    'OGrid Full Demo — Angular',
  ),
  Vue: createVueProject(
    `<script setup lang="ts">
import { OGrid, type IColumnDef } from '@alaarab/ogrid-vue-vuetify';
import { people, getRowId, type Person } from './data';

const DEPTS = ['Engineering', 'Marketing', 'Sales', 'Finance', 'Operations'];

const columns: IColumnDef<Person>[] = [
  { columnId: 'name', name: 'Name', sortable: true, editable: true,
    filterable: { type: 'text' } },
  { columnId: 'age', name: 'Age', type: 'numeric', sortable: true, editable: true },
  { columnId: 'email', name: 'Email' },
  { columnId: 'department', name: 'Department', sortable: true, editable: true,
    cellEditor: 'richSelect', cellEditorParams: { values: DEPTS },
    filterable: { type: 'multiSelect', filterField: 'department' } },
  { columnId: 'salary', name: 'Salary', type: 'numeric', sortable: true, editable: true,
    valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
  { columnId: 'status', name: 'Status',
    filterable: { type: 'multiSelect', filterField: 'status' } },
];

const gridProps = {
  columns, data: people, getRowId,
  editable: true, contextMenu: true, statusBar: true,
  columnChooser: true, sideBar: true,
  defaultPageSize: 10, defaultSortBy: 'name',
};
</script>

<template>
  <v-app>
    <OGrid :gridProps="gridProps" />
  </v-app>
</template>
`,
    'OGrid Full Demo — Vue',
  ),
  JS: createJSProject(
    `import { OGrid } from '@alaarab/ogrid-js';
import '@alaarab/ogrid-js/styles';
import { people, getRowId } from './data';

const DEPTS = ['Engineering', 'Marketing', 'Sales', 'Finance', 'Operations'];

const grid = new OGrid(document.getElementById('grid')!, {
  columns: [
    { columnId: 'name', name: 'Name', sortable: true, editable: true,
      filterable: { type: 'text' } },
    { columnId: 'age', name: 'Age', type: 'numeric', sortable: true, editable: true },
    { columnId: 'email', name: 'Email' },
    { columnId: 'department', name: 'Department', sortable: true, editable: true,
      cellEditor: 'richSelect', cellEditorParams: { values: DEPTS },
      filterable: { type: 'multiSelect', filterField: 'department' } },
    { columnId: 'salary', name: 'Salary', type: 'numeric', sortable: true, editable: true,
      valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
    { columnId: 'status', name: 'Status',
      filterable: { type: 'multiSelect', filterField: 'status' } },
  ],
  data: people,
  getRowId,
  editable: true,
  contextMenu: true,
  statusBar: true,
  columnChooser: true,
  sideBar: true,
  pageSize: 10,
});
`,
    'OGrid Full Demo — JS',
  ),
};

// ── Virtual Scrolling ──

const VIRTUAL_SCROLL_DATA = `
const DEPTS = ['Engineering', 'Marketing', 'Sales', 'Finance', 'Operations'];
const STATUSES = ['Active', 'Draft', 'Archived'];

const data = Array.from({ length: 10_000 }, (_, i) => ({
  id: i + 1,
  name: \`Person \${i + 1}\`,
  department: DEPTS[i % DEPTS.length],
  salary: 40000 + (i % 80) * 1000,
  status: STATUSES[i % STATUSES.length],
}));

const getRowId = (r) => r.id;
`;

export const virtualScrolling: FeatureDemoSet = {
  React: createReactProject(
    `import { OGrid } from '@alaarab/ogrid-react-radix';
${VIRTUAL_SCROLL_DATA}
const columns = [
  { columnId: 'id', name: 'ID', type: 'numeric' as const },
  { columnId: 'name', name: 'Name' },
  { columnId: 'department', name: 'Department' },
  { columnId: 'salary', name: 'Salary', type: 'numeric' as const,
    valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
  { columnId: 'status', name: 'Status' },
];

export default function App() {
  return (
    <OGrid
      columns={columns} data={data} getRowId={getRowId}
      virtualScroll={{ rowHeight: 36 }} statusBar
    />
  );
}
`,
    'OGrid Virtual Scrolling — React',
  ),
  Angular: createAngularProject(
    `import { Component } from '@angular/core';
import { OGridComponent, type IColumnDef } from '@alaarab/ogrid-angular-material';
${VIRTUAL_SCROLL_DATA}
@Component({
  standalone: true,
  imports: [OGridComponent],
  template: \`<ogrid [props]="gridProps" />\`,
})
export class AppComponent {
  gridProps = {
    columns: [
      { columnId: 'id', name: 'ID', type: 'numeric' },
      { columnId: 'name', name: 'Name' },
      { columnId: 'department', name: 'Department' },
      { columnId: 'salary', name: 'Salary', type: 'numeric',
        valueFormatter: (v: unknown) => \`$\${Number(v).toLocaleString()}\` },
      { columnId: 'status', name: 'Status' },
    ] as IColumnDef<any>[],
    data,
    getRowId,
    virtualScroll: { rowHeight: 36 },
    statusBar: true,
  };
}
`,
    'OGrid Virtual Scrolling — Angular',
  ),
  Vue: createVueProject(
    `<script setup lang="ts">
import { OGrid, type IColumnDef } from '@alaarab/ogrid-vue-vuetify';
${VIRTUAL_SCROLL_DATA}
const columns: IColumnDef<any>[] = [
  { columnId: 'id', name: 'ID', type: 'numeric' },
  { columnId: 'name', name: 'Name' },
  { columnId: 'department', name: 'Department' },
  { columnId: 'salary', name: 'Salary', type: 'numeric',
    valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
  { columnId: 'status', name: 'Status' },
];

const gridProps = {
  columns, data, getRowId,
  virtualScroll: { rowHeight: 36 }, statusBar: true,
};
</script>

<template>
  <v-app>
    <OGrid :gridProps="gridProps" />
  </v-app>
</template>
`,
    'OGrid Virtual Scrolling — Vue',
  ),
  JS: createJSProject(
    `import { OGrid } from '@alaarab/ogrid-js';
import '@alaarab/ogrid-js/styles';
${VIRTUAL_SCROLL_DATA}
const grid = new OGrid(document.getElementById('grid')!, {
  columns: [
    { columnId: 'id', name: 'ID', type: 'numeric' },
    { columnId: 'name', name: 'Name' },
    { columnId: 'department', name: 'Department' },
    { columnId: 'salary', name: 'Salary', type: 'numeric',
      valueFormatter: (v) => \`$\${Number(v).toLocaleString()}\` },
    { columnId: 'status', name: 'Status' },
  ],
  data,
  getRowId,
  virtualScroll: { rowHeight: 36 },
  statusBar: true,
});
`,
    'OGrid Virtual Scrolling — JS',
  ),
};
