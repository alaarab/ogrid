import type { IColumnDef, IColumnGroupDef } from '@alaarab/ogrid';

export interface Person {
  id: number;
  name: string;
  age: number;
  email: string;
  department: string;
  salary: number;
  status: string;
  startDate: string;
}

const NAMES = [
  'Alice Johnson', 'Bob Smith', 'Carol Lee', 'David Kim', 'Eve Torres',
  'Frank Wu', 'Grace Park', 'Henry Adams', 'Irene Costa', 'Jack Rivera',
  'Karen Liu', 'Leo Martinez', 'Mona Chen', 'Nate Brown', 'Olivia Scott',
  'Paul Davis', 'Quinn Foster', 'Rachel Green', 'Sam Wilson', 'Tina Hall',
  'Uma Patel', 'Vince Moore', 'Wendy Diaz', 'Xander Young', 'Yara King',
];

const DEPTS = ['Engineering', 'Marketing', 'Sales', 'Finance', 'Operations'];
const STATUSES = ['Active', 'Draft', 'Archived'];

export const people: Person[] = NAMES.map((name, i) => ({
  id: i + 1,
  name,
  age: 25 + (i % 30),
  email: `${name.split(' ')[0].toLowerCase()}@example.com`,
  department: DEPTS[i % DEPTS.length],
  salary: 50000 + i * 3500,
  status: STATUSES[i % STATUSES.length],
  startDate: `2024-${String((i % 12) + 1).padStart(2, '0')}-15`,
}));

export const getRowId = (p: Person) => p.id;

// ── Per-feature column configs ──

export const sortingColumns: IColumnDef<Person>[] = [
  { columnId: 'name', name: 'Name', sortable: true },
  { columnId: 'age', name: 'Age', sortable: true, type: 'numeric' },
  { columnId: 'department', name: 'Department', sortable: true },
  { columnId: 'salary', name: 'Salary', sortable: true, type: 'numeric',
    valueFormatter: (v) => `$${Number(v).toLocaleString()}` },
];

export const filteringColumns: IColumnDef<Person>[] = [
  { columnId: 'name', name: 'Name', filterable: { type: 'text' } },
  { columnId: 'department', name: 'Department',
    filterable: { type: 'multiSelect', filterField: 'department' } },
  { columnId: 'status', name: 'Status',
    filterable: { type: 'multiSelect', filterField: 'status' } },
  { columnId: 'salary', name: 'Salary', type: 'numeric',
    valueFormatter: (v) => `$${Number(v).toLocaleString()}` },
];

export const paginationColumns: IColumnDef<Person>[] = [
  { columnId: 'name', name: 'Name' },
  { columnId: 'email', name: 'Email' },
  { columnId: 'department', name: 'Department' },
  { columnId: 'salary', name: 'Salary', type: 'numeric',
    valueFormatter: (v) => `$${Number(v).toLocaleString()}` },
];

export const editingColumns: IColumnDef<Person>[] = [
  { columnId: 'name', name: 'Name', editable: true },
  { columnId: 'department', name: 'Department', editable: true,
    cellEditor: 'richSelect',
    cellEditorParams: { values: DEPTS } },
  { columnId: 'status', name: 'Status', editable: true,
    cellEditor: 'select',
    cellEditorParams: { values: STATUSES } },
  { columnId: 'salary', name: 'Salary', editable: true, type: 'numeric',
    valueFormatter: (v) => `$${Number(v).toLocaleString()}`,
    valueParser: ({ newValue }) => {
      const n = Number(newValue);
      return isNaN(n) || n < 0 ? undefined : n;
    } },
];

export const selectionColumns: IColumnDef<Person>[] = [
  { columnId: 'name', name: 'Name' },
  { columnId: 'age', name: 'Age', type: 'numeric' },
  { columnId: 'department', name: 'Department' },
  { columnId: 'salary', name: 'Salary', type: 'numeric',
    valueFormatter: (v) => `$${Number(v).toLocaleString()}` },
  { columnId: 'email', name: 'Email' },
];

export const rowSelectionColumns: IColumnDef<Person>[] = [
  { columnId: 'name', name: 'Name' },
  { columnId: 'email', name: 'Email' },
  { columnId: 'department', name: 'Department' },
  { columnId: 'status', name: 'Status' },
];

export const columnChooserColumns: IColumnDef<Person>[] = [
  { columnId: 'name', name: 'Name', required: true },
  { columnId: 'email', name: 'Email' },
  { columnId: 'age', name: 'Age', type: 'numeric', defaultVisible: false },
  { columnId: 'department', name: 'Department' },
  { columnId: 'salary', name: 'Salary', type: 'numeric',
    valueFormatter: (v) => `$${Number(v).toLocaleString()}` },
  { columnId: 'startDate', name: 'Start Date', defaultVisible: false },
];

export const pinningColumns: IColumnDef<Person>[] = [
  { columnId: 'name', name: 'Name', pinned: 'left', defaultWidth: 160 },
  { columnId: 'email', name: 'Email', defaultWidth: 220 },
  { columnId: 'department', name: 'Department', defaultWidth: 160 },
  { columnId: 'salary', name: 'Salary', type: 'numeric', defaultWidth: 120,
    valueFormatter: (v) => `$${Number(v).toLocaleString()}` },
  { columnId: 'status', name: 'Status', defaultWidth: 120 },
  { columnId: 'age', name: 'Age', type: 'numeric', defaultWidth: 80 },
  { columnId: 'startDate', name: 'Start Date', defaultWidth: 130 },
];

export const columnGroupColumns: (IColumnDef<Person> | IColumnGroupDef<Person>)[] = [
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
        valueFormatter: (v) => `$${Number(v).toLocaleString()}` },
      { columnId: 'status', name: 'Status' },
    ],
  },
];

export const statusBarColumns: IColumnDef<Person>[] = [
  { columnId: 'name', name: 'Name' },
  { columnId: 'age', name: 'Age', type: 'numeric' },
  { columnId: 'salary', name: 'Salary', type: 'numeric',
    valueFormatter: (v) => `$${Number(v).toLocaleString()}` },
  { columnId: 'department', name: 'Department' },
];

export const gridApiColumns: IColumnDef<Person>[] = [
  { columnId: 'name', name: 'Name', sortable: true },
  { columnId: 'department', name: 'Department', sortable: true,
    filterable: { type: 'multiSelect', filterField: 'department' } },
  { columnId: 'salary', name: 'Salary', type: 'numeric', sortable: true,
    valueFormatter: (v) => `$${Number(v).toLocaleString()}` },
  { columnId: 'status', name: 'Status',
    filterable: { type: 'multiSelect', filterField: 'status' } },
];

export const toolbarColumns: IColumnDef<Person>[] = [
  { columnId: 'name', name: 'Name', sortable: true, filterable: { type: 'text' } },
  { columnId: 'email', name: 'Email' },
  { columnId: 'department', name: 'Department', sortable: true,
    filterable: { type: 'multiSelect', filterField: 'department' } },
  { columnId: 'salary', name: 'Salary', type: 'numeric', sortable: true,
    valueFormatter: (v) => `$${Number(v).toLocaleString()}` },
  { columnId: 'status', name: 'Status',
    filterable: { type: 'multiSelect', filterField: 'status' } },
  { columnId: 'age', name: 'Age', type: 'numeric', defaultVisible: false },
  { columnId: 'startDate', name: 'Start Date', defaultVisible: false },
];

/** Button style used by toolbar demos */
export const btnStyle: React.CSSProperties = {
  padding: '5px 12px',
  borderRadius: 6,
  cursor: 'pointer',
  border: '1px solid var(--ogrid-border, #ccc)',
  background: 'var(--ogrid-bg, #fff)',
  color: 'var(--ogrid-fg, #333)',
  fontSize: '0.8rem',
  fontFamily: 'inherit',
};
