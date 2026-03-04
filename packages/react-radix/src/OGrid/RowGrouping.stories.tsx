import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { OGrid } from './OGrid';
import type { IColumnDef } from '@alaarab/ogrid-react';

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
  { columnId: 'salary', name: 'Salary', sortable: true, compare: (a, b) => a.salary - b.salary, valueFormatter: (v) => `$${Number(v).toLocaleString()}` },
];

const getRowId = (e: Employee) => e.id;

const meta: Meta<typeof OGrid<Employee>> = {
  title: 'OGrid/React Radix/RowGrouping',
  component: OGrid as React.ComponentType,
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof OGrid<Employee>>;

export const BasicGrouping: Story = {
  render: () => (
    <OGrid<Employee>
      data={makeEmployees(30)}
      columns={columns}
      getRowId={getRowId}
      groupBy={['department']}
      defaultPageSize={50}
    />
  ),
};

export const MultiLevelGrouping: Story = {
  render: () => (
    <OGrid<Employee>
      data={makeEmployees(30)}
      columns={columns}
      getRowId={getRowId}
      groupBy={['country', 'department']}
      defaultPageSize={50}
    />
  ),
};

export const ManyGroups: Story = {
  name: 'Many Collapsed Groups',
  render: () => (
    <OGrid<Employee>
      data={makeEmployees(50)}
      columns={columns}
      getRowId={getRowId}
      groupBy={['country']}
      defaultPageSize={100}
    />
  ),
};
