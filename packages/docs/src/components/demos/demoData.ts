import type { IColumnDef, IColumnGroupDef } from '@alaarab/ogrid-react-radix';

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

const FIRST_NAMES = [
  'Alice', 'Bob', 'Carol', 'David', 'Eve', 'Frank', 'Grace', 'Henry', 'Irene', 'Jack',
  'Karen', 'Leo', 'Mona', 'Nate', 'Olivia', 'Paul', 'Quinn', 'Rachel', 'Sam', 'Tina',
  'Uma', 'Vince', 'Wendy', 'Xander', 'Yara', 'Zoe', 'Aaron', 'Beth', 'Carlos', 'Dana',
  'Ethan', 'Fiona', 'George', 'Hannah', 'Ivan', 'Julia', 'Kyle', 'Luna', 'Marco', 'Nina',
];

const LAST_NAMES = [
  'Johnson', 'Smith', 'Lee', 'Kim', 'Torres', 'Wu', 'Park', 'Adams', 'Costa', 'Rivera',
  'Liu', 'Martinez', 'Chen', 'Brown', 'Scott', 'Davis', 'Foster', 'Green', 'Wilson', 'Hall',
  'Patel', 'Moore', 'Diaz', 'Young', 'King',
];

const DEPTS = ['Engineering', 'Marketing', 'Sales', 'Finance', 'Operations'];
const STATUSES = ['Active', 'Draft', 'Archived'];

export const people: Person[] = Array.from({ length: 1000 }, (_, i) => {
  const first = FIRST_NAMES[i % FIRST_NAMES.length];
  const last = LAST_NAMES[(i * 7 + Math.floor(i / FIRST_NAMES.length)) % LAST_NAMES.length];
  return {
    id: i + 1,
    name: `${first} ${last}`,
    age: 22 + (i % 40),
    email: `${first.toLowerCase()}${i}@example.com`,
    department: DEPTS[i % DEPTS.length],
    salary: 40000 + (i % 80) * 1500,
    status: STATUSES[i % STATUSES.length],
    startDate: `202${3 + (i % 3)}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
  };
});

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

export const cellReferencesColumns: IColumnDef<Person>[] = [
  { columnId: 'name', name: 'Name' },
  { columnId: 'age', name: 'Age', type: 'numeric' },
  { columnId: 'email', name: 'Email' },
  { columnId: 'department', name: 'Department' },
  { columnId: 'salary', name: 'Salary', type: 'numeric',
    valueFormatter: (v) => `$${Number(v).toLocaleString()}` },
  { columnId: 'status', name: 'Status' },
  { columnId: 'startDate', name: 'Start Date' },
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
