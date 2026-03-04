import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { OGrid } from './OGrid';
import type { IOGridProps, IColumnDef } from '@alaarab/ogrid-vue';

interface Employee {
  id: string;
  name: string;
  department: string;
  country: string;
  salary: number;
}

const DEPARTMENTS = ['Engineering', 'Marketing', 'Sales', 'Finance', 'Operations'];
const COUNTRIES = ['US', 'UK', 'Germany', 'Japan', 'Canada'];
const NAMES = ['Alice', 'Bob', 'Charlie', 'Dave', 'Eve', 'Frank', 'Grace', 'Hank', 'Ivy', 'Jack'];

function makeEmployees(count: number): Employee[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `emp-${i + 1}`,
    name: NAMES[i % NAMES.length],
    department: DEPARTMENTS[i % DEPARTMENTS.length],
    country: COUNTRIES[i % COUNTRIES.length],
    salary: 50000 + Math.floor(Math.random() * 80000),
  }));
}

const columns: IColumnDef<Employee>[] = [
  { columnId: 'name', name: 'Name', sortable: true },
  { columnId: 'department', name: 'Department', sortable: true, filterable: { type: 'multiSelect', filterField: 'department' } },
  { columnId: 'country', name: 'Country', sortable: true, filterable: { type: 'multiSelect', filterField: 'country' } },
  { columnId: 'salary', name: 'Salary', sortable: true, compare: (a: Employee, b: Employee) => a.salary - b.salary, valueFormatter: (v: unknown) => typeof v === 'number' ? `$${v.toLocaleString()}` : String(v ?? '') },
];

const getRowId = (e: Employee) => e.id;

function makeGridProps(overrides: Partial<IOGridProps<Employee>> = {}): IOGridProps<Employee> {
  return {
    data: makeEmployees(30),
    columns,
    getRowId,
    defaultPageSize: 50,
    ...overrides,
  };
}

const meta: Meta<typeof OGrid> = {
  title: 'OGrid/Vue Radix/RowGrouping',
  component: OGrid,
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof OGrid>;

export const BasicGrouping: Story = {
  render: () => ({
    components: { OGrid },
    setup() {
      return { gridProps: makeGridProps({ groupBy: ['department'] }) };
    },
    template: '<OGrid :grid-props="gridProps" />',
  }),
};

export const MultiLevelGrouping: Story = {
  render: () => ({
    components: { OGrid },
    setup() {
      return { gridProps: makeGridProps({ groupBy: ['country', 'department'] }) };
    },
    template: '<OGrid :grid-props="gridProps" />',
  }),
};

export const ManyGroups: Story = {
  name: 'Many Collapsed Groups',
  render: () => ({
    components: { OGrid },
    setup() {
      return { gridProps: makeGridProps({ data: makeEmployees(50), groupBy: ['country'], defaultPageSize: 100 }) };
    },
    template: '<OGrid :grid-props="gridProps" />',
  }),
};
