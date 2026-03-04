import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { OGridComponent } from './ogrid.component';
import type { IOGridProps, IColumnDef } from '@alaarab/ogrid-angular';

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
  { columnId: 'salary', name: 'Salary', sortable: true, compare: (a, b) => a.salary - b.salary, valueFormatter: (v: unknown) => typeof v === 'number' ? `$${v.toLocaleString()}` : String(v ?? '') },
];

const getRowId = (e: Employee) => e.id;

function makeGridProps(overrides: Record<string, unknown> = {}): IOGridProps<Employee> {
  return {
    data: makeEmployees(30),
    columns,
    getRowId,
    defaultPageSize: 50,
    ...overrides,
  } as IOGridProps<Employee>;
}

const meta: Meta<OGridComponent<Employee>> = {
  title: 'OGrid/Angular Material/RowGrouping',
  component: OGridComponent,
  decorators: [
    moduleMetadata({
      imports: [OGridComponent],
    }),
  ],
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<OGridComponent<Employee>>;

export const BasicGrouping: Story = {
  render: () => ({
    template: `<ogrid [props]="gridProps" />`,
    props: {
      gridProps: makeGridProps({ groupBy: ['department'] }),
    },
  }),
};

export const MultiLevelGrouping: Story = {
  render: () => ({
    template: `<ogrid [props]="gridProps" />`,
    props: {
      gridProps: makeGridProps({ groupBy: ['country', 'department'] }),
    },
  }),
};

export const ManyGroups: Story = {
  name: 'Many Collapsed Groups',
  render: () => ({
    template: `<ogrid [props]="gridProps" />`,
    props: {
      gridProps: makeGridProps({ data: makeEmployees(50), groupBy: ['country'], defaultPageSize: 100 }),
    },
  }),
};
